import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = "administrator" | "fraud_analyst" | "investigator" | "auditor";

export interface Profile {
  id: string;
  email?: string;
  display_name: string;
  role: UserRole;
  status: string;
  avatar_url?: string;
  organization?: string;
  country?: string;
  use_case?: string;
}

export interface OnboardingData {
  fullName: string;
  organization: string;
  country: string;
  jobTitle: string;
  volumeRange: string;
  intendedUseCase: string;
  initialDataMode: "synthetic" | "csv" | "later";
  currency?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    onboarding?: Partial<OnboardingData>
  ) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateProfile: (displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  enterSandboxDemo?: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isConfigured: false,
  isAdmin: false,
  signInWithPassword: async () => ({ error: null }),
  signUpWithPassword: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  updateProfile: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string, email?: string, userObj?: User | null) => {
    if (!supabase) return;
    
    // Only app_metadata is server-controlled; user_metadata can be edited by the user themselves
    const metaRole = userObj?.app_metadata?.role as UserRole | undefined;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        setProfile({
          id: data.id,
          email: data.email || email,
          display_name: data.display_name || userObj?.user_metadata?.display_name || email?.split("@")[0] || "Analyst",
          role: (data.role as UserRole) || metaRole || "fraud_analyst",
          status: data.status || "active",
          avatar_url: data.avatar_url,
          organization: data.organization,
          country: data.country,
          use_case: data.use_case,
        });
      } else {
        // Fallback profile if profile row query fails or hasn't synced
        setProfile({
          id: userId,
          email,
          display_name: userObj?.user_metadata?.display_name || email?.split("@")[0] || "Analyst",
          role: metaRole || "fraud_analyst",
          status: "active",
        });
      }
    } catch {
      setProfile({
        id: userId,
        email,
        display_name: userObj?.user_metadata?.display_name || email?.split("@")[0] || "Analyst",
        role: metaRole || "fraud_analyst",
        status: "active",
      });
    }
  };

  useEffect(() => {
    // Clean up any stale legacy demo keys in sessionStorage or localStorage
    try {
      localStorage.removeItem("aegis_demo_session");
      localStorage.removeItem("aegis_mock_user");
      localStorage.removeItem("aegis_role_override");
    } catch {
      // Storage access exception ignored
    }

    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // 1. Initial session restoration check
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setSession(session);
      setUser(session.user);
      fetchProfile(session.user.id, session.user.email, session.user).finally(() => {
        setIsLoading(false);
      });
    });

    // 2. Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email, session.user);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) return { error: "Supabase connection is not configured." };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    if (data.user) {
      await fetchProfile(data.user.id, data.user.email);
    }
    return { error: null };
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
    onboarding?: Partial<OnboardingData>
  ): Promise<{ error: string | null; requiresEmailConfirmation?: boolean }> => {
    if (!supabase) return { error: "Supabase connection is not configured." };

    const displayName = onboarding?.fullName?.trim() || email.split("@")[0];

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName,
          organization: onboarding?.organization,
          country: onboarding?.country,
          intendedUseCase: onboarding?.intendedUseCase,
          volumeRange: onboarding?.volumeRange,
          role: "fraud_analyst", // Strict restricted default
        },
      },
    });

    if (error) return { error: error.message };

    // If Supabase has email confirmations enabled and no session is returned
    if (data.user && !data.session) {
      return { error: null, requiresEmailConfirmation: true };
    }

    if (data.user && data.session) {
      // Create or ensure user profile row with least privilege
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        display_name: displayName,
        // role and status come from column defaults; RLS and tr_protect_profile_role reject anything else
        organization: onboarding?.organization,
        country: onboarding?.country,
        use_case: onboarding?.intendedUseCase,
      });
      await fetchProfile(data.user.id, data.user.email);
    }
    return { error: null, requiresEmailConfirmation: false };
  };

  const resetPassword = async (email: string) => {
    if (!supabase) return { error: "Supabase connection is not configured." };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? error.message : null };
  };

  const updatePassword = async (password: string) => {
    if (!supabase) return { error: "Supabase connection is not configured." };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  };

  const updateProfile = async (displayName: string) => {
    if (isSupabaseConfigured && supabase && user) {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim(), updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) return { error: error.message };
    }
    setProfile((prev) => (prev ? { ...prev, display_name: displayName.trim() } : prev));
    return { error: null };
  };

  const signOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // Ignored
    } finally {
      setUser(null);
      setSession(null);
      setProfile(null);
      try {
        localStorage.removeItem("aegis_demo_session");
        localStorage.removeItem("aegis_mock_user");
        localStorage.removeItem("aegis_role_override");
      } catch {
        // Storage access exception ignored
      }
    }
  };

  // Explicit opt-in sandbox mode when Supabase is not configured
  const enterSandboxDemo = () => {
    if (isSupabaseConfigured) return;
    setProfile({
      id: "demo-analyst-1",
      email: "analyst@aegisai.internal",
      display_name: "Demo Analyst",
      role: "fraud_analyst",
      status: "active",
      organization: "Aegis Sandbox",
      country: "IN",
      use_case: "Sandbox Testing",
    });
  };

  const isAdmin = profile?.role === "administrator";

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isConfigured: isSupabaseConfigured,
        isAdmin,
        signInWithPassword,
        signUpWithPassword,
        resetPassword,
        updatePassword,
        updateProfile,
        signOut,
        enterSandboxDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

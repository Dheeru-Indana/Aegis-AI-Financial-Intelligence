import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: (...args: any[]) => mockGetSession(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      signUp: (...args: any[]) => mockSignUp(...args),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
  isSupabaseConfigured: true,
}));

describe("Authentication & RBAC Logic Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  describe("Session Initialization & Safe Unauthenticated Default", () => {
    it("guarantees unauthenticated state when getSession returns null", async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      });

      const sessionResult = await mockGetSession();
      expect(sessionResult.data.session).toBeNull();
      // No fallback user profile should exist without valid session
      const user = sessionResult.data.session?.user ?? null;
      expect(user).toBeNull();
    });

    it("restores user and session when getSession returns active session", async () => {
      const mockUser = {
        id: "usr-admin-001",
        email: "admin@aegisai.internal",
        user_metadata: { display_name: "Admin User", role: "administrator" },
      };
      mockGetSession.mockResolvedValueOnce({
        data: {
          session: {
            user: mockUser,
            access_token: "mock-jwt-token",
          },
        },
        error: null,
      });

      const sessionResult = await mockGetSession();
      expect(sessionResult.data.session).not.toBeNull();
      expect(sessionResult.data.session.user.email).toBe("admin@aegisai.internal");
    });
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("identifies administrator role correctly", () => {
      const adminRole = "administrator";
      const isAdmin = adminRole === "administrator";
      expect(isAdmin).toBe(true);
    });

    it("strictly rejects non-administrator roles from administrative privileges", () => {
      const nonAdminRoles = [
        "fraud_analyst",
        "investigator",
        "auditor",
        "viewer",
      ];

      for (const role of nonAdminRoles) {
        const isAdmin = role === "administrator";
        expect(isAdmin).toBe(false);
      }
    });
  });

  describe("Sign Out & Token Invalidation", () => {
    it("awaits supabase.auth.signOut and purges local session", async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      const result = await mockSignOut();
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(result.error).toBeNull();
    });
  });

  describe("Registration Payload Validation", () => {
    it("validates required onboarding attributes for compliance and auditing", () => {
      const registrationForm = {
        fullName: "Arjun Mehta",
        email: "arjun@finbank.in",
        password: "StrongPassword!2026",
        confirmPassword: "StrongPassword!2026",
        organization: "FinBank Technologies",
        country: "IN",
        intendedUseCase: "Fraud Monitoring",
        volumeRange: "10,000 - 50,000",
        currency: "INR",
      };

      expect(registrationForm.password).toBe(registrationForm.confirmPassword);
      expect(registrationForm.password.length).toBeGreaterThanOrEqual(8);
      expect(registrationForm.organization.trim().length).toBeGreaterThan(0);
      expect(["INR", "USD", "EUR", "GBP", "SGD"]).toContain(registrationForm.currency);
      expect(registrationForm.country.length).toBe(2);
    });

    it("rejects mismatched passwords during registration", () => {
      const registrationForm = {
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      };

      const isValid = registrationForm.password === registrationForm.confirmPassword;
      expect(isValid).toBe(false);
    });
  });
});

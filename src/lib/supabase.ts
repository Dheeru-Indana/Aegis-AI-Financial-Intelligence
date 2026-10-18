import { createClient } from "@supabase/supabase-js";

// Standardized environment variable contract
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project-id") &&
  !supabaseAnonKey.includes("your-anon-key") &&
  supabaseUrl.startsWith("https://")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export interface SystemHealthStatus {
  database: "connected" | "disconnected" | "unconfigured";
  auth: "operational" | "unavailable";
  modelService: "ready" | "offline";
  eventStream: "realtime" | "simulated" | "paused";
  latencyMs: number;
  lastChecked: string;
  errorMessage?: string;
}

/**
 * Truthful, non-deceptive health check against configured Supabase project.
 * Performs a lightweight SELECT from public.risk_rules or profiles.
 */
export async function checkSystemHealth(): Promise<SystemHealthStatus> {
  const startTime = performance.now();
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);

  if (!isSupabaseConfigured || !supabase) {
    return {
      database: "unconfigured",
      auth: "unavailable",
      modelService: "ready", // Lightweight deterministic engine in client
      eventStream: "simulated",
      latencyMs: 0,
      lastChecked: nowStr,
      errorMessage: "Supabase credentials are not set in .env.local",
    };
  }

  try {
    // Check active session or query public.risk_rules to test database connectivity safely
    const session = (await supabase.auth.getSession()).data.session;
    const testQuery = session
      ? supabase.from("profiles").select("id").limit(1)
      : supabase.from("risk_rules").select("id").limit(1);

    const { error } = await testQuery;
    const latency = Math.round(performance.now() - startTime);

    if (error) {
      // If error is permission denied on anonymous, verify if auth is still working
      return {
        database: "disconnected",
        auth: "operational",
        modelService: "ready",
        eventStream: "simulated",
        latencyMs: latency,
        lastChecked: nowStr,
        errorMessage: error.message,
      };
    }

    return {
      database: "connected",
      auth: "operational",
      modelService: "ready",
      eventStream: "realtime",
      latencyMs: latency,
      lastChecked: nowStr,
    };
  } catch (err) {
    return {
      database: "disconnected",
      auth: "unavailable",
      modelService: "ready",
      eventStream: "simulated",
      latencyMs: Math.round(performance.now() - startTime),
      lastChecked: nowStr,
      errorMessage: (err as Error).message,
    };
  }
}

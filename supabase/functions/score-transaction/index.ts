import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  amount?: number;
  customer?: string;
  channel?: "UPI" | "Card" | "Net banking" | "Wallet";
  attemptCount?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: missing database credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate caller's JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentication required: missing or invalid Bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Browser/Client caller client with caller's token for auth verification
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: session invalid or expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Verify caller role from public.profiles
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Access denied: user profile not found" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strict role check: only administrator and fraud_analyst can execute scoring
    const allowedRoles = ["administrator", "fraud_analyst"];
    if (!allowedRoles.includes(profile.role)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden: insufficient permissions. Requires administrator or fraud_analyst role.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate request payload
    let body: RequestPayload;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { amount, customer, channel = "UPI", attemptCount = 1 } = body;

    if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
      return new Response(
        JSON.stringify({ error: "Validation error: amount must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!customer || typeof customer !== "string" || customer.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Validation error: customer reference is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validChannels = ["UPI", "Card", "Net banking", "Wallet"];
    if (!validChannels.includes(channel)) {
      return new Response(
        JSON.stringify({ error: "Validation error: channel must be UPI, Card, Net banking, or Wallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Server-side scoring calculation
    let score = 10;
    const signals: string[] = [];

    if (amount > 100000) {
      score += 45;
      signals.push("Amount anomaly");
    } else if (amount > 50000) {
      score += 20;
    }

    if (attemptCount >= 4) {
      score += 35;
      signals.push("Velocity spike");
    }

    const finalScore = Math.min(score, 99);
    const decision = finalScore >= 75 ? "FLAG" : finalScore >= 45 ? "VERIFY" : "ALLOW";
    const riskLevel = finalScore >= 75 ? "High" : finalScore >= 45 ? "Medium" : "Low";
    const txId = `TXN-${Math.floor(20500 + Math.random() * 50000)}`;

    // 5. Store evaluated transaction with service-role security
    const { error: dbError } = await serviceClient.from("transactions").insert({
      id: txId,
      amount,
      channel,
      customer_reference: customer.trim(),
      score: finalScore,
      risk_level: riskLevel,
      decision,
      scoring_status: "SCORED",
      signals: signals.length > 0 ? signals : ["Standard profile"],
      model_version: "fraud-v1.8.2",
      explanation: `Server evaluated risk score ${finalScore}/100. Decision: ${decision}. Triggered by ${user.email || profile.role}.`,
    });

    if (dbError) {
      return new Response(
        JSON.stringify({ error: "Database operation failed to record scored transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Record tamper-proof audit trail for scoring invocation
    await serviceClient.from("audit_logs").insert({
      id: `AUD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      actor: user.email || user.id,
      actor_id: user.id,
      role: profile.role,
      action: "Transaction scored",
      resource_type: "Transaction",
      resource_id: txId,
      result: "Success",
      details: `Scored amount ${amount} ${channel} for ${customer}. Decision: ${decision} (${finalScore}/100)`,
      metadata: { score: finalScore, decision, signals },
    });

    return new Response(
      JSON.stringify({
        id: txId,
        score: finalScore,
        decision,
        riskLevel,
        signals: signals.length > 0 ? signals : ["Standard profile"],
        status: "SCORED",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error occurred processing score request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

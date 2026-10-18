import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODEL_VERSION, scoreWithModel } from "../_shared/fraudModel.ts";
import { authorizeScoringProfile, validateScoringPayload } from "../_shared/scoringGuards.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ML_SERVICE_TIMEOUT_MS = 2000;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const startedAt = performance.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return json({ error: "Server configuration error: missing database credentials" }, 500);
    }

    // 1. Validate caller's JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Authentication required: missing or invalid Bearer token" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Browser/Client caller client with caller's token for auth verification
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized: session invalid or expired" }, 401);
    }

    // 2. Verify caller role and account status from public.profiles
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profileRow, error: profileError } = await serviceClient
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    const access = authorizeScoringProfile(profileError ? null : profileRow);
    if (!access.ok) {
      return json({ error: access.error }, access.status);
    }
    const profile = access.value;

    // 3. Validate request payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON request body" }, 400);
    }

    const payload = validateScoringPayload(body);
    if (!payload.ok) {
      return json({ error: payload.error }, payload.status);
    }
    const { amount, customer, channel, attemptCount } = payload.value;

    // 4. ML scoring: FastAPI model service, else the in-process port of the same pipeline
    const pythonApiUrl = Deno.env.get("PYTHON_MODEL_SERVICE_URL") || "http://localhost:8000";
    let finalScore: number;
    let decision: "ALLOW" | "VERIFY" | "FLAG";
    let riskLevel: "Low" | "Medium" | "High";
    let signals: string[] = [];
    let modelVersion = MODEL_VERSION;
    let explanation: string;

    try {
      const mlResponse = await fetch(`${pythonApiUrl}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, customer, channel, attempt_count: attemptCount }),
        signal: AbortSignal.timeout(ML_SERVICE_TIMEOUT_MS),
      });

      if (!mlResponse.ok) {
        throw new Error(`ML service returned ${mlResponse.status}`);
      }
      const mlData = await mlResponse.json();
      finalScore = mlData.risk_score;
      decision = mlData.recommended_action;
      riskLevel = mlData.risk_band;
      signals = mlData.reason_codes || [];
      modelVersion = mlData.model_version || modelVersion;
      explanation = `Python FastAPI ML scored probability ${mlData.fraud_probability} (${finalScore}/100). Recommended: ${decision}.`;
    } catch {
      const result = scoreWithModel({ amount, channel, attemptCount });
      finalScore = result.riskScore;
      decision = result.decision;
      riskLevel = result.riskBand;
      if (amount / 25000 > 2.0) signals.push("Amount anomaly");
      if (attemptCount - 1 >= 3) signals.push("Velocity spike");
      if (signals.length === 0) signals.push("Standard profile");
      explanation = `Logistic regression ${MODEL_VERSION} scored ${finalScore}/100 (in-process fallback). Decision: ${decision}.`;
    }

    const txId = `TXN-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;

    // 5. Store evaluated transaction with service-role security
    const { error: dbError } = await serviceClient.from("transactions").insert({
      id: txId,
      amount,
      channel,
      customer_reference: customer,
      score: finalScore,
      risk_level: riskLevel,
      decision,
      scoring_status: "SCORED",
      signals: signals.length > 0 ? signals : ["Standard profile"],
      model_version: modelVersion,
      latency_ms: Math.round(performance.now() - startedAt),
      explanation,
    });

    if (dbError) {
      return json({ error: "Database operation failed to record scored transaction" }, 500);
    }

    // 6. Record tamper-proof audit trail for scoring invocation
    const { error: auditError } = await serviceClient.from("audit_logs").insert({
      id: `AUD-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      actor: user.email || user.id,
      actor_id: user.id,
      role: profile.role,
      action: "Transaction scored",
      resource_type: "Transaction",
      resource_id: txId,
      result: "Success",
      details: `Scored amount ${amount} ${channel} for ${customer}. Decision: ${decision} (${finalScore}/100)`,
      metadata: { score: finalScore, decision, signals, model_version: modelVersion },
    });
    if (auditError) {
      console.error(`Audit log write failed for ${txId}: ${auditError.message}`);
    }

    return json(
      {
        id: txId,
        score: finalScore,
        decision,
        riskLevel,
        signals: signals.length > 0 ? signals : ["Standard profile"],
        modelVersion,
        status: "SCORED",
      },
      200
    );
  } catch {
    return json({ error: "Internal server error occurred processing score request" }, 500);
  }
});

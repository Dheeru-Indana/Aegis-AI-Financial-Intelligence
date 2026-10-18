import { transactions as mockTransactions } from "../mocks/data";
import { apiRequest, USE_MOCKS } from "./apiClient";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Transaction } from "../types";
import { riskBandForDecision } from "../../supabase/functions/_shared/fraudModel.ts";

export async function listTransactions(): Promise<Transaction[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) {
      throw new Error(`Failed to list transactions from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp).toISOString().replace("T", " ").slice(0, 19),
        amount: Number(row.amount),
        channel: row.channel,
        customer: row.customer,
        score: row.score,
        decision: row.decision,
        signals: Array.isArray(row.signals) ? row.signals : [],
        modelVersion: row.model_version || "unrecorded",
        latency: row.latency ?? 0,
        explanation: row.explanation || "",
        caseId: row.case_id || undefined,
      }));
    }
  }

  if (USE_MOCKS) return mockTransactions;
  return apiRequest<Transaction[]>("/api/transactions");
}

export async function insertTransaction(tx: Transaction): Promise<Transaction> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("transactions")
      .insert({
        id: tx.id,
        timestamp: new Date().toISOString(),
        amount: tx.amount,
        channel: tx.channel,
        customer: tx.customer,
        score: tx.score,
        decision: tx.decision,
        signals: tx.signals,
        model_version: tx.modelVersion,
        latency: tx.latency,
        explanation: tx.explanation,
        case_id: tx.caseId || null,
      });

    if (error) {
      throw new Error(`Failed to insert transaction to Supabase: ${error.message}`);
    }
    return tx;
  }
  return tx;
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get transaction from Supabase: ${error.message}`);
    }

    if (data) {
      return {
        id: data.id,
        timestamp: new Date(data.timestamp).toISOString().replace("T", " ").slice(0, 19),
        amount: Number(data.amount),
        channel: data.channel,
        customer: data.customer,
        score: data.score,
        decision: data.decision,
        signals: Array.isArray(data.signals) ? data.signals : [],
        modelVersion: data.model_version || "unrecorded",
        latency: data.latency ?? 0,
        explanation: data.explanation || "",
        caseId: data.case_id || undefined,
      };
    }
  }

  if (USE_MOCKS) return mockTransactions.find((t) => t.id === id);
  return apiRequest<Transaction>(`/api/transactions/${encodeURIComponent(id)}`);
}

export async function scoreTransaction(payload: Record<string, unknown>) {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${apiBase}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payload.amount,
        channel: payload.channel || "UPI",
        customer: payload.customer || "CUST-ANON",
        attempt_count: payload.attemptCount || 1,
        is_new_device: payload.isNewDevice || false,
        location_change: payload.locationChange || false,
        hour_of_day: payload.hourOfDay ?? new Date().getHours(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        mode: "live_ml",
        score: data.risk_score,
        probability: data.fraud_probability,
        decision: data.recommended_action,
        riskLevel: data.risk_band,
        signals: data.reason_codes,
        modelVersion: data.model_version,
        latency: data.inference_latency_ms,
        explanation: `ML Pipeline scored risk ${data.risk_score}/100. Recommended action: ${data.recommended_action}.`,
        attributions: (data.local_attributions || []).map((a: { name: string; contribution: number }) => ({
          name: a.name,
          value: a.contribution,
        })),
      };
    }
  } catch {
    // Graceful offline fallback to synchronized local TrainedMLScorer
  }

  // Fallback to client-side trained ML estimator
  const { TrainedMLScorer } = await import("./modelScorers");
  const scorer = new TrainedMLScorer();
  const res = scorer.score({
    amount: Number(payload.amount) || 1000,
    channel: String(payload.channel || "UPI"),
    attemptCount: Number(payload.attemptCount) || 1,
    isNewDevice: Boolean(payload.isNewDevice),
    locationChange: Boolean(payload.locationChange),
    hourOfDay: payload.hourOfDay === undefined ? new Date().getHours() : Number(payload.hourOfDay),
  });

  return {
    mode: "client_ml_fallback",
    score: res.score,
    probability: res.probability,
    decision: res.decision,
    riskLevel: riskBandForDecision(res.decision),
    signals: res.signals,
    modelVersion: `fraud-v${res.version}`,
    latency: res.latencyMs,
    explanation: res.explanation,
    attributions: res.attributions,
  };
}

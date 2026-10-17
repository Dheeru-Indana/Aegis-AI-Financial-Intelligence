import { transactions as mockTransactions } from "../mocks/data";
import { apiRequest, USE_MOCKS } from "./apiClient";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { Transaction } from "../types";

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
        modelVersion: row.model_version || "fraud-v1.8.2",
        latency: row.latency || 18,
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
        modelVersion: data.model_version || "fraud-v1.8.2",
        latency: data.latency || 18,
        explanation: data.explanation || "",
        caseId: data.case_id || undefined,
      };
    }
  }

  if (USE_MOCKS) return mockTransactions.find((t) => t.id === id);
  return apiRequest<Transaction>(`/api/transactions/${encodeURIComponent(id)}`);
}

export async function scoreTransaction(payload: Record<string, unknown>) {
  if (USE_MOCKS) {
    return {
      mode: "mock",
      message: "Scoring is a demo interaction; no backend request was made.",
      payload,
    };
  }
  return apiRequest("/api/transactions/score", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

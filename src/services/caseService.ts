import { cases as mockCases } from "../mocks/data";
import { apiRequest, USE_MOCKS } from "./apiClient";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { FraudCase } from "../types";

export async function listCases(): Promise<FraudCase[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("fraud_cases")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch fraud cases from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        transactionId: row.transaction_id,
        created: new Date(row.created_at).toISOString().replace("T", " ").slice(0, 16),
        score: row.score,
        priority: row.priority,
        analyst: row.analyst,
        status: row.status,
        updated: new Date(row.updated_at).toISOString().replace("T", " ").slice(0, 16),
        notes: Array.isArray(row.notes) ? row.notes : [],
      }));
    }
  }

  if (USE_MOCKS) return mockCases;
  return apiRequest<FraudCase[]>("/api/cases");
}

export async function createCaseRemote(newCase: FraudCase): Promise<FraudCase> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("fraud_cases").insert({
      id: newCase.id,
      transaction_id: newCase.transactionId,
      score: newCase.score,
      priority: newCase.priority,
      analyst: newCase.analyst,
      status: newCase.status,
      notes: newCase.notes,
    });
    if (error) {
      throw new Error(`Supabase case insertion rejected: ${error.message}`);
    }
  }
  return newCase;
}

export async function updateCase(id: string, patch: Partial<FraudCase>) {
  if (isSupabaseConfigured && supabase) {
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (patch.status) payload.status = patch.status;
    if (patch.priority) payload.priority = patch.priority;
    if (patch.analyst) payload.analyst = patch.analyst;
    if (patch.notes) payload.notes = patch.notes;

    const { error } = await supabase
      .from("fraud_cases")
      .update(payload)
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase case update failed: ${error.message}`);
    }
    return { mode: "supabase", id, patch };
  }

  if (USE_MOCKS) return { mode: "mock", id, patch };
  return apiRequest(`/api/cases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function submitDisposition(id: string, disposition: string) {
  const status = disposition === "Escalate for Review" ? "In review" : "Resolved";
  return updateCase(id, { status });
}

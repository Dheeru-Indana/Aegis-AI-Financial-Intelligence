import { rules as mockRules } from "../mocks/data";
import { apiRequest, USE_MOCKS } from "./apiClient";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { RiskRule } from "../types";

export async function listRules(): Promise<RiskRule[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("risk_rules")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch risk rules from Supabase: ${error.message}`);
    }

    if (data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || "",
        feature: row.feature,
        operator: row.operator,
        threshold: Number(row.threshold),
        severity: row.severity,
        impact: Number(row.impact),
        enabled: Boolean(row.enabled),
        modified: row.modified || "Just now",
      }));
    }
  }

  if (USE_MOCKS) return mockRules;
  return apiRequest<RiskRule[]>("/api/rules");
}

export async function createRule(rule: RiskRule) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("risk_rules").insert({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      feature: rule.feature,
      operator: rule.operator,
      threshold: rule.threshold,
      severity: rule.severity,
      impact: rule.impact,
      enabled: rule.enabled,
      modified: rule.modified,
    });
    if (error) {
      throw new Error(`Supabase rule creation failed: ${error.message}`);
    }
    return { mode: "supabase", rule };
  }

  if (USE_MOCKS) return { mode: "mock", rule };
  return apiRequest("/api/rules", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export async function toggleRuleRemote(id: string, enabled: boolean) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("risk_rules")
      .update({ enabled, modified: "Just now" })
      .eq("id", id);
    if (error) {
      throw new Error(`Failed to update rule status in Supabase: ${error.message}`);
    }
  }
}

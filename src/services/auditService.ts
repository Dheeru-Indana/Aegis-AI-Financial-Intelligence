import { audit as mockAudit } from "../mocks/data";
import { apiRequest, USE_MOCKS } from "./apiClient";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { AuditEvent } from "../types";

export async function listAudit(): Promise<AuditEvent[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp).toISOString().replace("T", " ").slice(0, 19),
        actor: row.actor,
        role: row.role,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        result: row.result,
        details: row.details || "",
      }));
    }
  }

  if (USE_MOCKS) return mockAudit;
  return apiRequest<AuditEvent[]>("/api/audit");
}

export async function recordAuditRemote(event: AuditEvent) {
  if (isSupabaseConfigured && supabase) {
    await supabase.from("audit_logs").insert({
      id: event.id,
      timestamp: new Date().toISOString(),
      actor: event.actor,
      role: event.role,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      result: event.result,
      details: event.details,
    });
  }
}

import {audit} from "../mocks/data"; import {apiRequest,USE_MOCKS} from "./apiClient"; import type {AuditEvent} from "../types";
export async function listAudit():Promise<AuditEvent[]>{return USE_MOCKS?audit:apiRequest<AuditEvent[]>("/api/audit");}

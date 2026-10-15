import {rules} from "../mocks/data"; import {apiRequest,USE_MOCKS} from "./apiClient"; import type {RiskRule} from "../types";
export async function listRules():Promise<RiskRule[]>{return USE_MOCKS?rules:apiRequest<RiskRule[]>("/api/rules");}
export async function createRule(rule:RiskRule){return USE_MOCKS?{mode:"mock",rule}:apiRequest("/api/rules",{method:"POST",body:JSON.stringify(rule)});}

import {cases} from "../mocks/data"; import {apiRequest,USE_MOCKS} from "./apiClient"; import type {FraudCase} from "../types";
export async function listCases():Promise<FraudCase[]>{return USE_MOCKS?cases:apiRequest<FraudCase[]>("/api/cases");}
export async function updateCase(id:string,patch:Partial<FraudCase>){return USE_MOCKS?{mode:"mock",id,patch}:apiRequest(`/api/cases/${id}`,{method:"PATCH",body:JSON.stringify(patch)});}
export async function submitDisposition(id:string,disposition:string){return USE_MOCKS?{mode:"mock",id,disposition}:apiRequest(`/api/cases/${id}/disposition`,{method:"POST",body:JSON.stringify({disposition})});}

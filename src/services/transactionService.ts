import { transactions } from "../mocks/data"; import { apiRequest,USE_MOCKS } from "./apiClient"; import type {Transaction} from "../types";
export async function listTransactions():Promise<Transaction[]>{return USE_MOCKS?transactions:apiRequest<Transaction[]>("/api/transactions");}
export async function getTransaction(id:string):Promise<Transaction|undefined>{return USE_MOCKS?transactions.find(t=>t.id===id):apiRequest<Transaction>(`/api/transactions/${encodeURIComponent(id)}`);}
export async function scoreTransaction(payload:Record<string,unknown>){return USE_MOCKS?{mode:"mock",message:"Scoring is a demo interaction; no backend request was made.",payload}:apiRequest("/api/transactions/score",{method:"POST",body:JSON.stringify(payload)});}

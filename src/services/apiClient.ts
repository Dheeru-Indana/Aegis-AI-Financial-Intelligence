const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? "true") !== "false";
export async function apiRequest<T>(path:string, init?:RequestInit):Promise<T>{
  if(USE_MOCKS) throw new Error("Mock mode enabled: use the typed mock service instead.");
  const response=await fetch(`${API_BASE_URL}${path}`,{...init,headers:{"Content-Type":"application/json",...init?.headers}});
  if(!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}
export const apiContract={transactions:"/api/transactions",score:"/api/transactions/score",metrics:"/api/metrics",cases:"/api/cases",rules:"/api/rules",audit:"/api/audit"} as const;

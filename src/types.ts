export type Decision = "ALLOW" | "VERIFY" | "FLAG";
export type RiskBand = "Low" | "Medium" | "High";
export interface Transaction { id:string; timestamp:string; amount:number; channel:string; customer:string; score:number; decision:Decision; signals:string[]; modelVersion:string; latency:number; explanation:string; caseId?:string; }
export interface FraudCase { id:string; transactionId:string; created:string; score:number; priority:"Low"|"Medium"|"High"; analyst:string; status:"Open"|"In review"|"Resolved"; updated:string; notes:{text:string;at:string;author:string}[]; }
export interface RiskRule { id:string; name:string; description:string; feature:string; operator:string; threshold:number; severity:"Low"|"Medium"|"High"; impact:number; enabled:boolean; modified:string; }
export interface AuditEvent { id:string; timestamp:string; actor:string; role:string; action:string; resourceType:string; resourceId:string; result:"Success"|"Review"|"Blocked"; details:string; }

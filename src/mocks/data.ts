import type { Transaction,FraudCase,RiskRule,AuditEvent } from "../types";
export const transactions:Transaction[]=[
{id:"TXN-20481",timestamp:"2026-10-15 11:18:42",amount:184500,channel:"UPI",customer:"CUST-7A21",score:94,decision:"FLAG",signals:["Velocity spike","Amount anomaly","New device"],modelVersion:"fraud-v2.0.0",latency:18,explanation:"Multiple operational signals crossed the configured review threshold.",caseId:"CASE-0081",provenance:"demo"},
{id:"TXN-20482",timestamp:"2026-10-15 11:18:39",amount:2450,channel:"Card",customer:"CUST-19D4",score:18,decision:"ALLOW",signals:["Known device"],modelVersion:"fraud-v2.0.0",latency:16,explanation:"Observed features are consistent with the low-risk profile.",provenance:"demo"},
{id:"TXN-20483",timestamp:"2026-10-15 11:18:33",amount:38600,channel:"Net banking",customer:"CUST-3F90",score:71,decision:"VERIFY",signals:["Unusual timing","Location change"],modelVersion:"fraud-v2.0.0",latency:21,explanation:"Elevated risk signals suggest additional verification.",provenance:"demo"},
{id:"TXN-20484",timestamp:"2026-10-15 11:18:27",amount:790,channel:"UPI",customer:"CUST-0C62",score:9,decision:"ALLOW",signals:["Known device"],modelVersion:"fraud-v2.0.0",latency:14,explanation:"No configured risk rule was triggered.",provenance:"demo"},
{id:"TXN-20485",timestamp:"2026-10-15 11:18:14",amount:98200,channel:"Card",customer:"CUST-8B13",score:86,decision:"FLAG",signals:["Repeated attempts","Amount anomaly"],modelVersion:"fraud-v2.0.0",latency:19,explanation:"Repeated attempts and a high amount contributed to the elevated score.",caseId:"CASE-0082",provenance:"demo"},
{id:"TXN-20486",timestamp:"2026-10-15 11:17:58",amount:5200,channel:"Wallet",customer:"CUST-1E44",score:43,decision:"VERIFY",signals:["Device change"],modelVersion:"fraud-v2.0.0",latency:17,explanation:"One risk signal warrants a lightweight verification step.",provenance:"demo"},
{id:"TXN-20487",timestamp:"2026-10-15 11:17:42",amount:1250,channel:"UPI",customer:"CUST-77A0",score:12,decision:"ALLOW",signals:["Known device"],modelVersion:"fraud-v2.0.0",latency:15,explanation:"Low estimated risk based on available demo features.",provenance:"demo"},
{id:"TXN-20488",timestamp:"2026-10-15 11:17:21",amount:44600,channel:"Net banking",customer:"CUST-6D02",score:78,decision:"FLAG",signals:["Velocity spike","Location change"],modelVersion:"fraud-v2.0.0",latency:20,explanation:"Multiple signals increased estimated risk.",provenance:"demo"}
];
export const cases:FraudCase[]=[
{id:"CASE-0081",transactionId:"TXN-20481",created:"2026-10-15 11:18",score:94,priority:"High",analyst:"A. Sharma",status:"Open",updated:"2 min ago",notes:[{text:"Velocity spike and amount anomaly require review.",at:"11:19",author:"System"}]},
{id:"CASE-0082",transactionId:"TXN-20485",created:"2026-10-15 11:16",score:86,priority:"High",analyst:"R. Iyer",status:"In review",updated:"4 min ago",notes:[{text:"Reviewing repeated attempts across the session.",at:"11:17",author:"R. Iyer"}]},
{id:"CASE-0083",transactionId:"TXN-20483",created:"2026-10-15 11:13",score:71,priority:"Medium",analyst:"Unassigned",status:"Open",updated:"7 min ago",notes:[]},
{id:"CASE-0084",transactionId:"TXN-20479",created:"2026-10-15 10:58",score:63,priority:"Medium",analyst:"A. Sharma",status:"Resolved",updated:"18 min ago",notes:[{text:"Customer verification completed.",at:"11:05",author:"A. Sharma"}]}
];
export const rules:RiskRule[]=[
{id:"R-01",name:"High Transaction Amount",description:"Flag unusually large transaction amounts",feature:"amount",operator:">",threshold:100000,severity:"High",impact:25,enabled:true,modified:"Today, 10:42"},
{id:"R-02",name:"Repeated Transaction Attempts",description:"Detect repeated attempts in a short window",feature:"attempt_count",operator:">=",threshold:4,severity:"High",impact:30,enabled:true,modified:"Today, 09:18"},
{id:"R-03",name:"Unusual Transaction Timing",description:"Review transactions outside expected hours",feature:"hour_of_day",operator:"outside",threshold:6,severity:"Medium",impact:12,enabled:true,modified:"Yesterday"},
{id:"R-04",name:"Multiple Risk Signals",description:"Escalate when multiple signals are present",feature:"risk_signal_count",operator:">=",threshold:3,severity:"Medium",impact:18,enabled:false,modified:"Oct 12"}
];
export const audit:AuditEvent[]=[
{id:"AUD-91A2",timestamp:"2026-10-15 11:18:42",actor:"risk-engine",role:"System",action:"Transaction scored",resourceType:"Transaction",resourceId:"TXN-20481",result:"Review",details:"Risk score 94; decision FLAG; demo seed record."},
{id:"AUD-91A1",timestamp:"2026-10-15 11:18:10",actor:"A. Sharma",role:"Analyst",action:"Fraud case opened",resourceType:"Case",resourceId:"CASE-0081",result:"Success",details:"Case created for high-risk transaction."},
{id:"AUD-91A0",timestamp:"2026-10-15 10:42:00",actor:"A. Sharma",role:"Analyst",action:"Risk rule updated",resourceType:"Risk rule",resourceId:"R-01",result:"Success",details:"High Transaction Amount threshold reviewed."},
{id:"AUD-919F",timestamp:"2026-10-15 10:21:33",actor:"model-service",role:"System",action:"Model evaluated",resourceType:"Model",resourceId:"fraud-v2.0.0-logistic",result:"Success",details:"Held-out synthetic test split evaluation completed."},
{id:"AUD-919E",timestamp:"2026-10-15 09:55:12",actor:"R. Iyer",role:"Analyst",action:"Analyst note added",resourceType:"Case",resourceId:"CASE-0082",result:"Success",details:"Added investigation note."}
];
export const activity = [
{time:"08:00",volume:1220,flagged:12},{time:"09:00",volume:1840,flagged:18},{time:"10:00",volume:2310,flagged:24},{time:"11:00",volume:2680,flagged:31},{time:"12:00",volume:2190,flagged:21},{time:"13:00",volume:2870,flagged:28},{time:"14:00",volume:2510,flagged:22},{time:"15:00",volume:3020,flagged:34}];

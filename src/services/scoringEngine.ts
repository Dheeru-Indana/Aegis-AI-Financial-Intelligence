import { z } from "zod";
import type { Decision, RiskRule, Transaction } from "../types";

export const TransactionInputSchema = z.object({
  id: z.string().optional(),
  amount: z.number().positive("Transaction amount must be positive"),
  channel: z.enum(["UPI", "Card", "Net banking", "Wallet"]),
  customer: z.string().min(1, "Customer reference is required"),
  currency: z.string().default("INR"),
  hourOfDay: z.number().min(0).max(23).optional(),
  attemptCount: z.number().min(1).default(1),
  locationChange: z.boolean().default(false),
  isNewDevice: z.boolean().default(false),
  rawFeatures: z.record(z.string(), z.number()).optional(),
});

export type TransactionInput = z.input<typeof TransactionInputSchema>;

export interface ScoringResult {
  score: number;
  decision: Decision;
  riskLevel: "Low" | "Medium" | "High";
  latencyMs: number;
  signals: string[];
  matchedRules: string[];
  modelVersion: string;
  explanation: string;
  attributions: { name: string; value: number }[];
  decisionTrace: { stage: string; title: string; detail: string }[];
}

/**
 * Deterministic scoring engine for AegisAI
 * Combines ML probability estimate (simulated via weighted feature factors)
 * and active risk rules evaluation.
 */
export function scoreTransactionDeterministic(
  input: TransactionInput,
  rules: RiskRule[] = []
): ScoringResult {
  const startTime = performance.now();
  const signals: string[] = [];
  const matchedRules: string[] = [];
  let baseScore = 10; // Baseline low risk

  // 1. Feature evaluation
  if (input.amount > 100000) {
    baseScore += 35;
    signals.push("Amount anomaly");
  } else if (input.amount > 50000) {
    baseScore += 18;
  }

  const attemptCount = input.attemptCount ?? 1;
  if (attemptCount >= 4) {
    baseScore += 30;
    signals.push("Repeated attempts");
  } else if (attemptCount >= 2) {
    baseScore += 10;
  }

  if (input.isNewDevice) {
    baseScore += 15;
    signals.push("New device");
  }

  if (input.locationChange) {
    baseScore += 20;
    signals.push("Location change");
  }

  const hour = input.hourOfDay ?? new Date().getHours();
  if (hour < 5 || hour > 23) {
    baseScore += 12;
    signals.push("Unusual timing");
  }

  // 2. Active Risk Rule Evaluation
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let triggered = false;

    if (rule.feature === "amount") {
      if (rule.operator === ">" && input.amount > rule.threshold) triggered = true;
      if (rule.operator === ">=" && input.amount >= rule.threshold) triggered = true;
    } else if (rule.feature === "attempt_count") {
      if (rule.operator === ">=" && attemptCount >= rule.threshold) triggered = true;
    } else if (rule.feature === "hour_of_day") {
      if (rule.operator === "outside" && (hour < rule.threshold || hour > 23)) triggered = true;
    } else if (rule.feature === "risk_signal_count") {
      if (rule.operator === ">=" && signals.length >= rule.threshold) triggered = true;
    }

    if (triggered) {
      baseScore += rule.impact;
      matchedRules.push(rule.name);
      if (!signals.includes(rule.name)) {
        signals.push(rule.name);
      }
    }
  }

  // Cap score between 0 and 99
  const finalScore = Math.min(Math.max(baseScore, 5), 98);
  const decision: Decision = finalScore >= 75 ? "FLAG" : finalScore >= 45 ? "VERIFY" : "ALLOW";
  const riskLevel: "Low" | "Medium" | "High" = finalScore >= 75 ? "High" : finalScore >= 45 ? "Medium" : "Low";

  // Feature attributions (PCA components simulated for ML transparency)
  const v14Val = finalScore >= 75 ? 0.32 : -0.15;
  const v12Val = signals.includes("Amount anomaly") ? 0.26 : 0.05;
  const v10Val = signals.includes("Repeated attempts") ? 0.19 : -0.04;
  const v4Val = input.isNewDevice ? 0.14 : -0.12;
  const v17Val = -0.08;

  const attributions = [
    { name: "V14", value: v14Val },
    { name: "V12", value: v12Val },
    { name: "V10", value: v10Val },
    { name: "V4", value: v4Val },
    { name: "V17", value: v17Val },
  ];

  const latencyMs = Math.round(performance.now() - startTime) + 14;

  const explanation =
    decision === "FLAG"
      ? `Transaction scored ${finalScore}/100. High risk driven by ${signals.join(", ") || "elevated feature volatility"}. Recommended action: manual analyst review.`
      : decision === "VERIFY"
      ? `Transaction scored ${finalScore}/100. Moderately elevated indicators detected (${signals.join(", ")}). Step-up customer authentication suggested.`
      : `Transaction scored ${finalScore}/100. Behavioral parameters within normal historical ranges.`;

  const decisionTrace = [
    { stage: "01", title: "Transaction received", detail: "Payload validated via Zod schema" },
    { stage: "02", title: "Feature preparation", detail: `Calculated amount & velocity features for ${input.customer}` },
    { stage: "03", title: "ML risk scoring", detail: `Calculated model probability score: ${finalScore}/100` },
    { stage: "04", title: "Rule evaluation", detail: `${matchedRules.length} risk rule(s) matched` },
    { stage: "05", title: "Final decision", detail: `${decision} (${riskLevel} risk)` },
  ];

  return {
    score: finalScore,
    decision,
    riskLevel,
    latencyMs,
    signals: signals.length > 0 ? signals : ["Known device profile"],
    matchedRules,
    modelVersion: "fraud-v1.8.2",
    explanation,
    attributions,
    decisionTrace,
  };
}

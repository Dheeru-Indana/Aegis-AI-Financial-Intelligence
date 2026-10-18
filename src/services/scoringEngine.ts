import { z } from "zod";
import type { Decision, RiskRule } from "../types";
import {
  MODEL_VERSION,
  decisionForProbability,
  riskBandForDecision,
  scoreWithModel,
} from "../../supabase/functions/_shared/fraudModel.ts";

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
 * Deterministic scoring engine for AegisAI.
 * Scores the transaction with the trained logistic regression (fraud-v2.0.0-logistic,
 * synthetic training data), then adds the impact of every matched risk rule.
 */
export function scoreTransactionDeterministic(
  rawInput: TransactionInput,
  rules: RiskRule[] = []
): ScoringResult {
  const startTime = performance.now();
  const input = TransactionInputSchema.parse(rawInput);
  const signals: string[] = [];
  const matchedRules: string[] = [];

  const attemptCount = input.attemptCount;
  const hour = input.hourOfDay ?? new Date().getHours();

  // 1. ML risk scoring
  const model = scoreWithModel({ ...input, hourOfDay: hour });

  if (input.amount > 100000) signals.push("Amount anomaly");
  if (attemptCount >= 4) signals.push("Repeated attempts");
  if (input.isNewDevice) signals.push("New device");
  if (input.locationChange) signals.push("Location change");
  if (hour < 5 || hour >= 23) signals.push("Unusual timing");

  // 2. Active Risk Rule Evaluation
  let ruleImpact = 0;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    let triggered = false;

    if (rule.feature === "amount") {
      if (rule.operator === ">" && input.amount > rule.threshold) triggered = true;
      if (rule.operator === ">=" && input.amount >= rule.threshold) triggered = true;
    } else if (rule.feature === "attempt_count") {
      if (rule.operator === ">=" && attemptCount >= rule.threshold) triggered = true;
    } else if (rule.feature === "hour_of_day") {
      if (rule.operator === "outside" && (hour < rule.threshold || hour >= 23)) triggered = true;
    } else if (rule.feature === "risk_signal_count") {
      if (rule.operator === ">=" && signals.length >= rule.threshold) triggered = true;
    }

    if (triggered) {
      ruleImpact += rule.impact;
      matchedRules.push(rule.name);
      if (!signals.includes(rule.name)) {
        signals.push(rule.name);
      }
    }
  }

  // 3. Rule impacts are score points on top of the model probability; with no matched
  // rules the decision is exactly the model's own threshold decision.
  const adjusted = Math.min(1, Math.max(0, model.probability + ruleImpact / 100));
  const finalScore = Math.round(adjusted * 100);
  const decision: Decision = decisionForProbability(adjusted);
  const riskLevel = riskBandForDecision(decision);

  const attributions = model.contributions
    .slice(0, 5)
    .map((c) => ({ name: c.name, value: Number(c.contribution.toFixed(3)) }));

  const latencyMs = Math.round(performance.now() - startTime);

  const explanation =
    decision === "FLAG"
      ? `Transaction scored ${finalScore}/100. High risk driven by ${signals.join(", ") || "the model score"}. Recommended action: manual analyst review.`
      : decision === "VERIFY"
      ? `Transaction scored ${finalScore}/100. Moderately elevated indicators detected (${signals.join(", ") || "model score"}). Step-up customer authentication suggested.`
      : `Transaction scored ${finalScore}/100. Model score and rules below review thresholds.`;

  const decisionTrace = [
    { stage: "01", title: "Transaction received", detail: "Payload validated via Zod schema" },
    { stage: "02", title: "Feature preparation", detail: `Calculated amount, velocity, device, location and time features for ${input.customer}` },
    { stage: "03", title: "ML risk scoring", detail: `${MODEL_VERSION} score: ${model.probability.toFixed(3)}` },
    { stage: "04", title: "Rule evaluation", detail: `${matchedRules.length} risk rule(s) matched (+${ruleImpact} points)` },
    { stage: "05", title: "Final decision", detail: `${decision} (${riskLevel} risk)` },
  ];

  return {
    score: finalScore,
    decision,
    riskLevel,
    latencyMs,
    signals: signals.length > 0 ? signals : ["Known device profile"],
    matchedRules,
    modelVersion: MODEL_VERSION,
    explanation,
    attributions,
    decisionTrace,
  };
}

import type { Decision, RiskRule } from "../types";
import {
  FLAG_THRESHOLD,
  MODEL_VERSION,
  extractFeatures,
  scoreWithModel,
} from "../../supabase/functions/_shared/fraudModel.ts";

export interface ScorerOutput {
  scorerId: string;
  scorerType: "RuleBased" | "TrainedML" | "Ensemble" | "Simulation";
  version: string;
  score: number;
  probability: number;
  decision: Decision;
  latencyMs: number;
  signals: string[];
  explanation: string;
  attributions: { name: string; value: number }[];
}

export interface IScorer {
  score(tx: {
    amount: number;
    channel: string;
    attemptCount?: number;
    isNewDevice?: boolean;
    locationChange?: boolean;
    hourOfDay?: number;
  }): ScorerOutput;
}

/**
 * 1. RuleBasedScorer
 * Pure deterministic rule engine evaluating financial boundary constraints.
 */
export class RuleBasedScorer implements IScorer {
  scorerId = "rule-engine-v1.0";
  scorerType = "RuleBased" as const;
  version = "1.0.4";

  constructor(private rules: RiskRule[] = []) {}

  score(tx: { amount: number; channel: string; attemptCount?: number; isNewDevice?: boolean; hourOfDay?: number }): ScorerOutput {
    const start = performance.now();
    let score = 5;
    const signals: string[] = [];
    // Points each triggered rule added, reported as a fraction of the 0-100 scale
    const contributions: { name: string; value: number }[] = [];
    const apply = (points: number, signal: string, name: string) => {
      score += points;
      signals.push(signal);
      contributions.push({ name, value: points / 100 });
    };

    if (tx.amount > 100000) {
      apply(40, "RULE: High Transaction Amount (> ₹1L)", "Amount > ₹1L");
    } else if (tx.amount > 50000) {
      apply(20, "RULE: Elevated Amount (> ₹50k)", "Amount > ₹50k");
    }

    if ((tx.attemptCount ?? 1) >= 4) {
      apply(35, "RULE: Velocity Spike (>= 4 attempts)", "Attempts >= 4");
    }

    if (tx.isNewDevice) {
      apply(15, "RULE: Unrecognized Hardware Signature", "New device");
    }

    // Dynamic rule evaluations
    for (const r of this.rules.filter((r) => r.enabled)) {
      if (r.feature === "amount" && r.operator === ">" && tx.amount > r.threshold) {
        apply(r.impact, `RULE: ${r.name}`, r.name);
      }
    }

    const clamped = Math.min(100, Math.max(0, score));
    const decision: Decision = clamped >= 75 ? "FLAG" : clamped >= 45 ? "VERIFY" : "ALLOW";

    return {
      scorerId: this.scorerId,
      scorerType: this.scorerType,
      version: this.version,
      score: clamped,
      probability: clamped / 100,
      decision,
      latencyMs: Math.max(1, Math.round(performance.now() - start)),
      signals,
      explanation: signals.length
        ? `Rule engine triggered ${signals.length} operational constraints.`
        : "Standard transaction parameters within default thresholds.",
      attributions: contributions,
    };
  }
}

/**
 * 2. TrainedMLScorer
 * Browser-side copy of the trained logistic regression pipeline (fraud-v2.0.0-logistic).
 * Trained on synthetic demo data by ml/train.py; see supabase/functions/_shared/fraudModel.ts.
 */
export class TrainedMLScorer implements IScorer {
  scorerId = "ml-logistic-v2.0.0";
  scorerType = "TrainedML" as const;
  version = "2.0.0";

  score(tx: {
    amount: number;
    channel: string;
    attemptCount?: number;
    isNewDevice?: boolean;
    locationChange?: boolean;
    hourOfDay?: number;
  }): ScorerOutput {
    const start = performance.now();
    const result = scoreWithModel(tx);
    const [amountNorm, velocityNorm, deviceFlag, locationFlag, nightFlag] = extractFeatures(tx).numeric;

    const signals: string[] = [];
    if (result.decision === "FLAG") signals.push(`High ML fraud score (p >= ${FLAG_THRESHOLD})`);
    else if (result.decision === "VERIFY") signals.push("Elevated ML fraud score");
    if (amountNorm > 2.0) signals.push("Amount anomaly");
    if (velocityNorm >= 3.0) signals.push("Velocity spike");
    if (deviceFlag) signals.push("Unrecognized device fingerprint");
    if (locationFlag) signals.push("Location change");
    if (nightFlag) signals.push("Night-time activity");

    return {
      scorerId: this.scorerId,
      scorerType: this.scorerType,
      version: this.version,
      score: result.riskScore,
      probability: Number(result.probability.toFixed(4)),
      decision: result.decision,
      latencyMs: Math.max(1, Math.round(performance.now() - start)),
      signals,
      explanation: `Logistic regression ${MODEL_VERSION} (synthetic training data): logit ${result.logit.toFixed(2)}, score ${result.probability.toFixed(3)}.`,
      attributions: result.contributions.map((c) => ({ name: c.name, value: Number(c.contribution.toFixed(3)) })),
    };
  }
}

/**
 * 3. EnsemblePolicyScorer
 * Blends the ML score with the rule engine score. This is a fixed weighting policy,
 * not a separately trained model.
 */
export function scoreWithEnsemble(
  tx: {
    amount: number;
    channel: string;
    attemptCount?: number;
    isNewDevice?: boolean;
    locationChange?: boolean;
    hourOfDay?: number;
  },
  rules: RiskRule[] = []
): {
  primary: ScorerOutput;
  ruleBased: ScorerOutput;
  mlBased: ScorerOutput;
  consensus: boolean;
} {
  const ruleScorer = new RuleBasedScorer(rules);
  const mlScorer = new TrainedMLScorer();

  const ruleRes = ruleScorer.score(tx);
  const mlRes = mlScorer.score(tx);

  // Ensemble weighted blend (65% ML, 35% Rules)
  const blendedScore = Math.round(mlRes.score * 0.65 + ruleRes.score * 0.35);
  const blendedDecision: Decision = blendedScore >= 75 ? "FLAG" : blendedScore >= 45 ? "VERIFY" : "ALLOW";

  const primary: ScorerOutput = {
    scorerId: "rule-ml-blend-v1.0.0",
    scorerType: "Ensemble",
    version: "1.0.0",
    score: blendedScore,
    probability: blendedScore / 100,
    decision: blendedDecision,
    latencyMs: Math.max(ruleRes.latencyMs, mlRes.latencyMs),
    signals: Array.from(new Set([...mlRes.signals, ...ruleRes.signals])),
    explanation: `Fixed 65/35 blend of ML classifier (score ${mlRes.score}) and rule engine (score ${ruleRes.score}).`,
    // Rule contributions are score points, not log-odds, so only the model's are reported here
    attributions: mlRes.attributions,
  };

  return {
    primary,
    ruleBased: ruleRes,
    mlBased: mlRes,
    consensus: ruleRes.decision === mlRes.decision,
  };
}

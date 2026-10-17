import { describe, it, expect } from "vitest";
import { RuleBasedScorer, TrainedMLScorer, scoreWithEnsemble } from "../services/modelScorers";
import type { RiskRule } from "../types";

describe("Lightweight Model Scorers Architecture", () => {
  it("RuleBasedScorer evaluates financial threshold boundaries deterministically", () => {
    const rules: RiskRule[] = [
      {
        id: "R-TEST-1",
        name: "Test Amount Rule",
        description: "Test description",
        feature: "amount",
        operator: ">",
        threshold: 75000,
        severity: "High",
        impact: 25,
        enabled: true,
        modified: "Today",
      },
    ];

    const scorer = new RuleBasedScorer(rules);
    const lowTx = scorer.score({ amount: 1200, channel: "UPI" });
    expect(lowTx.decision).toBe("ALLOW");
    expect(lowTx.score).toBeLessThan(45);
    expect(lowTx.scorerType).toBe("RuleBased");

    const highTx = scorer.score({ amount: 150000, channel: "UPI", attemptCount: 5, isNewDevice: true });
    expect(highTx.decision).toBe("FLAG");
    expect(highTx.score).toBeGreaterThanOrEqual(75);
    expect(highTx.signals.length).toBeGreaterThan(0);
  });

  it("TrainedMLScorer calculates sigmoid probabilities with class-weighted prior", () => {
    const mlScorer = new TrainedMLScorer();

    const lowTx = mlScorer.score({ amount: 2000, channel: "Card", attemptCount: 1 });
    expect(lowTx.scorerType).toBe("TrainedML");
    expect(lowTx.probability).toBeLessThan(0.15); // Imbalanced baseline expectation
    expect(lowTx.decision).toBe("ALLOW");

    const highTx = mlScorer.score({ amount: 120000, channel: "Net banking", attemptCount: 6, isNewDevice: true });
    expect(highTx.probability).toBeGreaterThan(0.7);
    expect(highTx.decision).toBe("FLAG");
    expect(highTx.attributions.length).toBe(3);
  });

  it("scoreWithEnsemble produces consensus diagnostics without fabricating scores", () => {
    const result = scoreWithEnsemble({
      amount: 85000,
      channel: "Card",
      attemptCount: 3,
      isNewDevice: true,
    });

    expect(result.primary.version).toBe("1.8.2");
    expect(result.ruleBased.scorerType).toBe("RuleBased");
    expect(result.mlBased.scorerType).toBe("TrainedML");
    expect(typeof result.consensus).toBe("boolean");
  });
});

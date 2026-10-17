import { describe, it, expect } from "vitest";
import { scoreTransactionDeterministic } from "../services/scoringEngine";
import { sanitizeForCsv } from "../services/ingestionService";
import type { RiskRule } from "../types";

describe("AegisAI Scoring Engine", () => {
  const sampleRules: RiskRule[] = [
    {
      id: "R-01",
      name: "High Transaction Amount",
      description: "Flag transactions above 100k",
      feature: "amount",
      operator: ">",
      threshold: 100000,
      severity: "High",
      impact: 25,
      enabled: true,
      modified: "Today",
    },
  ];

  it("assigns low risk score to a benign small transaction", () => {
    const result = scoreTransactionDeterministic(
      {
        amount: 500,
        channel: "UPI",
        customer: "CUST-TEST",
        attemptCount: 1,
        isNewDevice: false,
        locationChange: false,
        hourOfDay: 14,
      },
      sampleRules
    );

    expect(result.score).toBeLessThan(45);
    expect(result.decision).toBe("ALLOW");
    expect(result.riskLevel).toBe("Low");
  });

  it("triggers rules and flags a high-value anomalous transaction", () => {
    const result = scoreTransactionDeterministic(
      {
        amount: 250000,
        channel: "Card",
        customer: "CUST-HIGH",
        attemptCount: 5,
        isNewDevice: true,
        locationChange: true,
        hourOfDay: 2,
      },
      sampleRules
    );

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.decision).toBe("FLAG");
    expect(result.signals).toContain("Amount anomaly");
    expect(result.signals).toContain("Repeated attempts");
    expect(result.signals).toContain("High Transaction Amount");
    expect(result.matchedRules).toContain("High Transaction Amount");
  });
});

describe("CSV Sanitization Security (Formula Injection Protection)", () => {
  it("prefixes dangerous formula trigger characters with single quote", () => {
    expect(sanitizeForCsv("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeForCsv("+12345")).toBe("'+12345");
    expect(sanitizeForCsv("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeForCsv("@HYPERLINK('http://malicious.com')")).toBe("'@HYPERLINK('http://malicious.com')");
  });

  it("leaves standard text untouched", () => {
    expect(sanitizeForCsv("TXN-20481")).toBe("TXN-20481");
    expect(sanitizeForCsv("CUST-7A21")).toBe("CUST-7A21");
    expect(sanitizeForCsv(184500)).toBe("184500");
  });
});

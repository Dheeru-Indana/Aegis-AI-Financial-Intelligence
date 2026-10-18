import { describe, it, expect } from "vitest";
import { parseAndIngestCsv, sanitizeForCsv } from "../services/ingestionService";
import type { RiskRule, Transaction } from "../types";

describe("CSV End-to-End Ingestion Pipeline", () => {
  const dummyRules: RiskRule[] = [
    {
      id: "R-01",
      name: "High Amount",
      description: "Flag > 100k",
      feature: "amount",
      operator: ">",
      threshold: 100000,
      severity: "High",
      impact: 30,
      enabled: true,
      modified: "today",
    },
  ];

  const sampleCsvContent = `id,amount,channel,customer,timestamp
TXN-90001,1500,UPI,CUST-TEST-1,2026-10-18 10:00:00
TXN-90002,125000,Card,CUST-TEST-2,2026-10-18 10:05:00
TXN-90003,54000,Net banking,CUST-TEST-3,2026-10-18 10:10:00
TXN-90004,-500,UPI,CUST-INVALID,2026-10-18 10:15:00
TXN-90001,1500,UPI,CUST-DUPLICATE,2026-10-18 10:20:00`;

  it("should parse, validate rows, deduplicate, and score via ML with provenance=imported", async () => {
    const existing: Transaction[] = [];
    const result = await parseAndIngestCsv(sampleCsvContent, existing, dummyRules);

    expect(result.total).toBe(5);
    expect(result.accepted).toBe(3);
    expect(result.rejected).toBe(1); // negative amount rejected
    expect(result.duplicates).toBe(1); // TXN-90001 duplicated
    expect(result.newTransactions.length).toBe(3);

    // Verify ML scoring and provenance
    const highAmountTx = result.newTransactions.find((t) => t.id === "TXN-90002");
    expect(highAmountTx).toBeDefined();
    expect(highAmountTx?.provenance).toBe("imported");
    expect(highAmountTx?.importBatchId).toContain("BATCH-");
    expect(typeof highAmountTx?.score).toBe("number");
    expect(highAmountTx?.score).toBeGreaterThan(0);
    expect(highAmountTx?.modelVersion).toBeDefined();
  });

  it("should sanitize formula injection characters in CSV exports", () => {
    expect(sanitizeForCsv("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeForCsv("+123456")).toBe("'+123456");
    expect(sanitizeForCsv("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(sanitizeForCsv("@alert()")).toBe("'@alert()");
    expect(sanitizeForCsv("Safe Customer")).toBe("Safe Customer");
  });
});

import Papa from "papaparse";
import { z } from "zod";
import type { Transaction, RiskRule } from "../types";
import { insertTransaction, scoreTransaction } from "./transactionService";

const CsvRowSchema = z.object({
  id: z.string().optional(),
  amount: z.coerce.number().positive(),
  channel: z.enum(["UPI", "Card", "Net banking", "Wallet"]).catch("UPI"),
  customer: z.string().min(1),
  timestamp: z.string().optional(),
});

export interface IngestionResult {
  total: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  errors: string[];
  newTransactions: Transaction[];
}

/**
 * Sanitizes fields to prevent CSV Formula Injection in exported files
 * Any string starting with =, +, -, @, \t, \r is prefixed with a single quote.
 */
export function sanitizeForCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function parseAndIngestCsv(
  fileContent: string,
  existingTransactions: Transaction[],
  activeRules: RiskRule[]
): Promise<IngestionResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const existingIds = new Set(existingTransactions.map((t) => t.id));
        let accepted = 0;
        let rejected = 0;
        let duplicates = 0;
        const errors: string[] = [];
        const newTransactions: Transaction[] = [];

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const parsed = CsvRowSchema.safeParse(row);

          if (!parsed.success) {
            rejected++;
            errors.push(`Row ${i + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`);
            continue;
          }

          const txId = parsed.data.id || `TXN-${Math.floor(20500 + Math.random() * 50000)}`;

          if (existingIds.has(txId)) {
            duplicates++;
            continue;
          }
          existingIds.add(txId);

          const importBatchId = `BATCH-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

          // Evaluate genuine ML risk using the v2.0.0 scoring pipeline
          const scoring = await scoreTransaction({
            amount: parsed.data.amount,
            channel: parsed.data.channel,
            customer: parsed.data.customer,
            attemptCount: 1,
            isNewDevice: false,
            locationChange: false,
            hourOfDay: new Date().getHours(),
          });

          const newTx: Transaction = {
            id: txId,
            timestamp: parsed.data.timestamp || new Date().toISOString().replace("T", " ").slice(0, 19),
            amount: parsed.data.amount,
            channel: parsed.data.channel,
            customer: parsed.data.customer,
            score: scoring.score,
            decision: scoring.decision as any,
            signals: scoring.signals,
            modelVersion: scoring.modelVersion,
            latency: scoring.latency,
            explanation: scoring.explanation,
            provenance: "imported",
            importBatchId: importBatchId,
          };

          try {
            await insertTransaction(newTx);
          } catch (insertErr) {
            // Log persistence error without silently dropping
            errors.push(`Row ${i + 1} (${txId}): ${(insertErr as Error).message}`);
          }

          newTransactions.push(newTx);
          accepted++;
        }

        resolve({
          total: results.data.length,
          accepted,
          rejected,
          duplicates,
          errors,
          newTransactions,
        });
      },
      error: (err: Error) => {
        resolve({
          total: 0,
          accepted: 0,
          rejected: 0,
          duplicates: 0,
          errors: [err.message],
          newTransactions: [],
        });
      },
    });
  });
}

export function exportTransactionsToCsv(transactions: Transaction[]): void {
  const headers = [
    "Transaction ID",
    "Timestamp",
    "Amount",
    "Channel",
    "Customer Ref",
    "Risk Score",
    "Decision",
    "Signals",
    "Model Version",
  ];

  const rows = transactions.map((t) => [
    sanitizeForCsv(t.id),
    sanitizeForCsv(t.timestamp),
    sanitizeForCsv(t.amount),
    sanitizeForCsv(t.channel),
    sanitizeForCsv(t.customer),
    sanitizeForCsv(t.score),
    sanitizeForCsv(t.decision),
    sanitizeForCsv(t.signals.join("; ")),
    sanitizeForCsv(t.modelVersion),
  ]);

  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aegisai-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

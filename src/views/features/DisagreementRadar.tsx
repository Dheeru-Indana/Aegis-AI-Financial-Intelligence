import React, { useState, useMemo } from "react";
import { GitCompare, AlertTriangle, ArrowRight, CheckCircle2, Shield, Eye, Plus, Info } from "lucide-react";
import type { Transaction, RiskRule } from "../../types";
import { scoreWithEnsemble, type ScorerOutput } from "../../services/modelScorers";

interface DisagreementRow {
  txId: string;
  amount: number;
  customer: string;
  mlModel: ScorerOutput;
  ruleEngine: ScorerOutput;
  consensus: boolean;
  delta: number;
  severity: "High Divergence" | "Moderate Divergence" | "Consensus Agreement";
}

export const DisagreementRadar: React.FC<{
  transactions?: Transaction[];
  rules?: RiskRule[];
  onTriageCase?: (txId: string) => void;
}> = ({ transactions = [], rules = [], onTriageCase }) => {
  const isIllustrative = transactions.length === 0;

  // Compute live disagreements or use illustrative candidate transactions
  const disagreements: DisagreementRow[] = useMemo(() => {
    const candidateInputs = transactions.length > 0
      ? transactions.slice(0, 10).map((t) => ({
          txId: t.id,
          amount: t.amount,
          customer: t.customer,
          channel: t.channel,
          attemptCount: t.signals.some((s) => s.toLowerCase().includes("velocity") || s.toLowerCase().includes("attempts")) ? 4 : 1,
          isNewDevice: t.signals.some((s) => s.toLowerCase().includes("device")),
          locationChange: t.signals.some((s) => s.toLowerCase().includes("location")),
        }))
      : [
          { txId: "TXN-20485", amount: 98200, customer: "CUST-8B13", channel: "Card", attemptCount: 4, isNewDevice: false, locationChange: false },
          { txId: "TXN-20483", amount: 38600, customer: "CUST-3F90", channel: "Net banking", attemptCount: 1, isNewDevice: false, locationChange: true },
          { txId: "TXN-20486", amount: 5200, customer: "CUST-1E44", channel: "Wallet", attemptCount: 1, isNewDevice: true, locationChange: false },
          { txId: "TXN-20481", amount: 184500, customer: "CUST-7A21", channel: "UPI", attemptCount: 4, isNewDevice: true, locationChange: false },
        ];

    return candidateInputs.map((tx) => {
      const { ruleBased, mlBased, consensus } = scoreWithEnsemble(tx, rules);
      const delta = Math.abs(mlBased.score - ruleBased.score);
      const severity = !consensus && delta >= 30
        ? "High Divergence"
        : !consensus
        ? "Moderate Divergence"
        : "Consensus Agreement";

      return {
        txId: tx.txId,
        amount: tx.amount,
        customer: tx.customer,
        mlModel: mlBased,
        ruleEngine: ruleBased,
        consensus,
        delta,
        severity,
      };
    });
  }, [transactions, rules]);

  const [selectedTxId, setSelectedTxId] = useState<string | null>(disagreements[0]?.txId || null);
  const selectedTx = disagreements.find((d) => d.txId === selectedTxId) || disagreements[0];
  const [triageNotice, setTriageNotice] = useState<string | null>(null);

  const divergentCount = disagreements.filter((d) => !d.consensus).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Model Disagreement Radar</h2>
          <p>
            Consensus triage comparing the trained logistic regression model (<code>fraud-v2.0.0-logistic</code>) against the deterministic boundary rules.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isIllustrative && (
            <span className="badge amber">
              <Info size={12} style={{ marginRight: 4 }} /> Illustrative Candidate Samples
            </span>
          )}
          <span className={`badge ${divergentCount > 0 ? "amber" : "green"}`}>
            {divergentCount} DIVERGENT TRANSACTIONS
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px" }}>
        {/* Table of Disagreements */}
        <section className="panel" style={{ padding: "16px" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TRANSACTION</th>
                  <th>AMOUNT</th>
                  <th>ML MODEL (v2.0.0)</th>
                  <th>RULE ENGINE</th>
                  <th>SCORE DELTA</th>
                  <th>CONSENSUS</th>
                </tr>
              </thead>
              <tbody>
                {disagreements.map((row) => (
                  <tr
                    key={row.txId}
                    onClick={() => { setSelectedTxId(row.txId); setTriageNotice(null); }}
                    style={{
                      cursor: "pointer",
                      background: selectedTx?.txId === row.txId ? "rgba(34, 211, 238, 0.05)" : undefined,
                    }}
                  >
                    <td><strong>{row.txId}</strong></td>
                    <td>₹{row.amount.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${row.mlModel.decision === "FLAG" ? "red" : row.mlModel.decision === "VERIFY" ? "amber" : "green"}`}>
                        {row.mlModel.score} ({row.mlModel.decision})
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.ruleEngine.decision === "FLAG" ? "red" : row.ruleEngine.decision === "VERIFY" ? "amber" : "green"}`}>
                        {row.ruleEngine.score} ({row.ruleEngine.decision})
                      </span>
                    </td>
                    <td><strong className={row.delta >= 30 ? "red-text" : "amber-text"}>±{row.delta} pts</strong></td>
                    <td>
                      <span className={`badge ${row.severity === "High Divergence" ? "red" : row.severity === "Moderate Divergence" ? "amber" : "green"}`}>
                        {row.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Side-by-Side Comparison Inspector */}
        <section className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#22d3ee", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <GitCompare size={16} /> Scorer Disagreement Inspector
          </h3>

          {selectedTx ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <span className="badge cyan">{selectedTx.txId}</span>
                <div style={{ fontSize: "16px", fontWeight: 700, margin: "6px 0 2px", color: "#f8fafc" }}>
                  ₹{selectedTx.amount.toLocaleString()}
                </div>
                <small style={{ color: "#94a3b8" }}>Customer: {selectedTx.customer}</small>
              </div>

              {/* Scorer Breakdown */}
              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>TRAINED LOGISTIC REGRESSION (v2.0.0)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <strong style={{ fontSize: "15px" }}>Score: {selectedTx.mlModel.score}/100</strong>
                    <span className={`badge ${selectedTx.mlModel.decision === "FLAG" ? "red" : selectedTx.mlModel.decision === "VERIFY" ? "amber" : "green"}`}>{selectedTx.mlModel.decision}</span>
                  </div>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>{selectedTx.mlModel.signals.join(", ") || "No high ML signals"}</small>
                </div>

                <div style={{ borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>DETERMINISTIC RULE ENGINE (v1.0.4)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <strong style={{ fontSize: "15px" }}>Score: {selectedTx.ruleEngine.score}/100</strong>
                    <span className={`badge ${selectedTx.ruleEngine.decision === "FLAG" ? "red" : selectedTx.ruleEngine.decision === "VERIFY" ? "amber" : "green"}`}>{selectedTx.ruleEngine.decision}</span>
                  </div>
                  <small style={{ color: "#64748b", fontSize: "11px" }}>{selectedTx.ruleEngine.signals.join(", ") || "Thresholds passed"}</small>
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.4" }}>
                <strong>DISAGREEMENT RATIONALE:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  {selectedTx.delta === 0
                    ? "Both scoring systems agree on the risk assessment."
                    : selectedTx.mlModel.score > selectedTx.ruleEngine.score
                    ? "The logistic model calculated elevated continuous log-odds from standardized feature interactions, exceeding the static rule boundary."
                    : "Deterministic boundary rules fired on hard thresholds (amount or velocity), while normalized model features produced lower combined probability."}
                </p>
              </div>

              {triageNotice && (
                <div style={{ fontSize: "12px", color: "#34d399", padding: "8px", background: "rgba(52, 211, 153, 0.1)", borderRadius: "6px" }}>
                  {triageNotice}
                </div>
              )}

              <button
                className="btn primary"
                onClick={() => {
                  setTriageNotice(`Investigation Case dispatched for ${selectedTx.txId}`);
                  if (onTriageCase) onTriageCase(selectedTx.txId);
                }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              >
                <Plus size={15} /> Open Triage Case
              </button>
            </div>
          ) : (
            <p style={{ color: "#64748b" }}>Select a transaction from the disagreement queue to compare scorers.</p>
          )}
        </section>
      </div>
    </div>
  );
};

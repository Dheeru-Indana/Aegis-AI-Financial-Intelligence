import React, { useState } from "react";
import { GitCompare, AlertTriangle, ArrowRight, CheckCircle2, Shield, Eye, Plus } from "lucide-react";

interface DisagreementRow {
  txId: string;
  amount: number;
  customer: string;
  primaryModel: { name: string; score: number; decision: string };
  candidateModel: { name: string; score: number; decision: string };
  ruleEngine: { score: number; decision: string };
  delta: number;
  severity: "High Divergence" | "Moderate Divergence";
}

const mockDisagreements: DisagreementRow[] = [
  {
    txId: "TXN-20485",
    amount: 98200,
    customer: "CUST-8B13",
    primaryModel: { name: "Random Forest (v1.8.2)", score: 86, decision: "FLAG" },
    candidateModel: { name: "LightGBM (v2.0-rc)", score: 48, decision: "VERIFY" },
    ruleEngine: { score: 90, decision: "FLAG" },
    delta: 38,
    severity: "High Divergence",
  },
  {
    txId: "TXN-20483",
    amount: 38600,
    customer: "CUST-3F90",
    primaryModel: { name: "Random Forest (v1.8.2)", score: 71, decision: "VERIFY" },
    candidateModel: { name: "LightGBM (v2.0-rc)", score: 82, decision: "FLAG" },
    ruleEngine: { score: 45, decision: "VERIFY" },
    delta: 11,
    severity: "Moderate Divergence",
  },
  {
    txId: "TXN-20486",
    amount: 5200,
    customer: "CUST-1E44",
    primaryModel: { name: "Random Forest (v1.8.2)", score: 43, decision: "VERIFY" },
    candidateModel: { name: "LightGBM (v2.0-rc)", score: 14, decision: "ALLOW" },
    ruleEngine: { score: 35, decision: "ALLOW" },
    delta: 29,
    severity: "High Divergence",
  },
];

export const DisagreementRadar: React.FC<{ onTriageCase?: (txId: string) => void }> = ({ onTriageCase }) => {
  const [disagreements] = useState<DisagreementRow[]>(mockDisagreements);
  const [selectedTx, setSelectedTx] = useState<DisagreementRow | null>(mockDisagreements[0]);
  const [triageNotice, setTriageNotice] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Model Disagreement Radar</h2>
          <p>Multi-scorer consensus evaluator. Discloses transactions where ensemble models & rules diverge.</p>
        </div>
        <span className="badge amber">3 DIVERGENT TRANSACTIONS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px" }}>
        {/* Table of Disagreements */}
        <section className="panel" style={{ padding: "16px" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TRANSACTION</th>
                  <th>AMOUNT</th>
                  <th>PRIMARY ML (v1.8.2)</th>
                  <th>CANDIDATE (v2.0-rc)</th>
                  <th>RULES</th>
                  <th>SCORE DELTA</th>
                  <th>SEVERITY</th>
                </tr>
              </thead>
              <tbody>
                {disagreements.map((row) => (
                  <tr
                    key={row.txId}
                    onClick={() => { setSelectedTx(row); setTriageNotice(null); }}
                    style={{
                      cursor: "pointer",
                      background: selectedTx?.txId === row.txId ? "rgba(34, 211, 238, 0.05)" : undefined,
                    }}
                  >
                    <td><strong>{row.txId}</strong></td>
                    <td>₹{row.amount.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${row.primaryModel.decision === "FLAG" ? "red" : "amber"}`}>
                        {row.primaryModel.score} ({row.primaryModel.decision})
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.candidateModel.decision === "FLAG" ? "red" : row.candidateModel.decision === "VERIFY" ? "amber" : "green"}`}>
                        {row.candidateModel.score} ({row.candidateModel.decision})
                      </span>
                    </td>
                    <td><strong>{row.ruleEngine.score}</strong></td>
                    <td><strong className="red-text">+{row.delta} pts</strong></td>
                    <td>
                      <span className={`badge ${row.severity === "High Divergence" ? "red" : "amber"}`}>
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
            <GitCompare size={16} /> Disagreement Inspector
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
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>PRODUCTION MODEL (RF v1.8.2)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <strong style={{ fontSize: "15px" }}>Score: {selectedTx.primaryModel.score}/100</strong>
                    <span className={`badge ${selectedTx.primaryModel.decision === "FLAG" ? "red" : "amber"}`}>{selectedTx.primaryModel.decision}</span>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>CHALLENGER MODEL (LGBM v2.0-rc)</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <strong style={{ fontSize: "15px" }}>Score: {selectedTx.candidateModel.score}/100</strong>
                    <span className={`badge ${selectedTx.candidateModel.decision === "FLAG" ? "red" : selectedTx.candidateModel.decision === "VERIFY" ? "amber" : "green"}`}>{selectedTx.candidateModel.decision}</span>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>DETERMINISTIC RULE ENGINE</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                    <strong style={{ fontSize: "15px" }}>Score: {selectedTx.ruleEngine.score}/100</strong>
                    <span className="badge neutral">{selectedTx.ruleEngine.decision}</span>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.4" }}>
                <strong>DISAGREEMENT RATIONALE:</strong>
                <p style={{ margin: "4px 0 0" }}>
                  Challenger model heavily penalizes card channel history, while Production model flags recent velocity bursts.
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

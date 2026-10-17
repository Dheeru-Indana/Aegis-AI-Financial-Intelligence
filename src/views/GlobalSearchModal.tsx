import React, { useState, useEffect } from "react";
import { Search, Activity, FileSearch, Shield, FileClock, X, ArrowRight, CornerDownLeft } from "lucide-react";
import type { Transaction, FraudCase, RiskRule, AuditEvent } from "../types";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  cases: FraudCase[];
  rules: RiskRule[];
  auditLogs: AuditEvent[];
  onSelectTransaction: (t: Transaction) => void;
  onSelectCase: (c: FraudCase) => void;
  onSelectRule: (r: RiskRule) => void;
  onSelectAudit: (a: AuditEvent) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  transactions,
  cases,
  rules,
  auditLogs,
  onSelectTransaction,
  onSelectCase,
  onSelectRule,
  onSelectAudit,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = searchTerm.toLowerCase().trim();

  const matchedTxns = q
    ? transactions
        .filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.customer.toLowerCase().includes(q) ||
            t.channel.toLowerCase().includes(q) ||
            t.decision.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  const matchedCases = q
    ? cases
        .filter(
          (c) =>
            c.id.toLowerCase().includes(q) ||
            c.transactionId.toLowerCase().includes(q) ||
            c.analyst.toLowerCase().includes(q) ||
            c.status.toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];

  const matchedRules = q
    ? rules
        .filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.feature.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];

  const matchedAudit = q
    ? auditLogs
        .filter(
          (a) =>
            a.id.toLowerCase().includes(q) ||
            a.actor.toLowerCase().includes(q) ||
            a.action.toLowerCase().includes(q) ||
            a.resourceId.toLowerCase().includes(q)
        )
        .slice(0, 3)
    : [];

  const hasResults =
    matchedTxns.length > 0 || matchedCases.length > 0 || matchedRules.length > 0 || matchedAudit.length > 0;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{
          width: "min(640px, 95vw)",
          background: "#0f172a",
          border: "1px solid #2a3a52",
          borderRadius: "12px",
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 25px 60px -15px rgba(0,0,0,0.7)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #1e293b",
            background: "#131e33",
            gap: "12px",
          }}
        >
          <Search size={18} color="#22d3ee" />
          <input
            autoFocus
            style={{
              background: "transparent",
              border: 0,
              outline: 0,
              color: "#f1f5f9",
              fontSize: "14px",
              width: "100%",
            }}
            placeholder="Search transactions, fraud cases, rules, models, audit logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="icon-btn" onClick={() => setSearchTerm("")}>
              <X size={15} />
            </button>
          )}
          <span style={{ fontSize: "10px", color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: "4px" }}>
            ESC to close
          </span>
        </div>

        {/* Results Area */}
        <div style={{ maxHeight: "420px", overflowY: "auto", padding: "16px 20px" }}>
          {!searchTerm ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
              <p style={{ margin: "0 0 6px" }}>Type a transaction ID (e.g. <code>TXN-20481</code>), customer ID, or case number.</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "12px" }}>
                <span className="badge">Transactions</span>
                <span className="badge">Cases</span>
                <span className="badge">Rules</span>
                <span className="badge">Audit Trail</span>
              </div>
            </div>
          ) : !hasResults ? (
            <div style={{ padding: "30px 20px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
              No entities found matching "<strong>{searchTerm}</strong>"
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Transactions */}
              {matchedTxns.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: "8px" }}>
                    TRANSACTIONS ({matchedTxns.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {matchedTxns.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => { onSelectTransaction(t); onClose(); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#162238",
                          cursor: "pointer",
                          border: "1px solid transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Activity size={15} color="#22d3ee" />
                          <div>
                            <strong style={{ fontSize: "12px", color: "#f1f5f9" }}>{t.id}</strong>
                            <small style={{ color: "#94a3b8", display: "block" }}>
                              {t.customer} · {t.channel} · ₹{t.amount.toLocaleString()}
                            </small>
                          </div>
                        </div>
                        <span className={`badge ${t.decision === "FLAG" ? "red" : t.decision === "VERIFY" ? "amber" : "green"}`}>
                          {t.decision} ({t.score})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fraud Cases */}
              {matchedCases.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: "8px" }}>
                    FRAUD CASES ({matchedCases.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {matchedCases.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => { onSelectCase(c); onClose(); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#162238",
                          cursor: "pointer",
                          border: "1px solid transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <FileSearch size={15} color="#fbbf24" />
                          <div>
                            <strong style={{ fontSize: "12px", color: "#f1f5f9" }}>{c.id}</strong>
                            <small style={{ color: "#94a3b8", display: "block" }}>
                              Ref: {c.transactionId} · Assigned: {c.analyst}
                            </small>
                          </div>
                        </div>
                        <span className={`badge ${c.status === "Resolved" ? "green" : "amber"}`}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Rules */}
              {matchedRules.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: "8px" }}>
                    RISK RULES ({matchedRules.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {matchedRules.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => { onSelectRule(r); onClose(); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#162238",
                          cursor: "pointer",
                          border: "1px solid transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Shield size={15} color="#34d399" />
                          <div>
                            <strong style={{ fontSize: "12px", color: "#f1f5f9" }}>{r.name}</strong>
                            <small style={{ color: "#94a3b8", display: "block" }}>
                              <code>{r.feature} {r.operator} {r.threshold}</code> · +{r.impact} pts
                            </small>
                          </div>
                        </div>
                        <span className={`badge ${r.enabled ? "green" : "neutral"}`}>
                          {r.enabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Logs */}
              {matchedAudit.length > 0 && (
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", letterSpacing: "1px", marginBottom: "8px" }}>
                    AUDIT EVENTS ({matchedAudit.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {matchedAudit.map((a) => (
                      <div
                        key={a.id}
                        onClick={() => { onSelectAudit(a); onClose(); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          background: "#162238",
                          cursor: "pointer",
                          border: "1px solid transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <FileClock size={15} color="#818cf8" />
                          <div>
                            <strong style={{ fontSize: "12px", color: "#f1f5f9" }}>{a.action}</strong>
                            <small style={{ color: "#94a3b8", display: "block" }}>
                              {a.actor} ({a.role}) · {a.resourceId}
                            </small>
                          </div>
                        </div>
                        <span className={`badge ${a.result === "Success" ? "green" : "red"}`}>{a.result}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 16px",
            background: "#0c1220",
            borderTop: "1px solid #1e293b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "10px",
            color: "#64748b",
          }}
        >
          <span>Quick triage search across indexed PostgreSQL collections</span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            Press <CornerDownLeft size={10} /> to select
          </span>
        </div>
      </div>
    </div>
  );
};

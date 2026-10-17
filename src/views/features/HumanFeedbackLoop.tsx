import React, { useState } from "react";
import { CheckCircle2, RotateCw, ShieldCheck, Database, ArrowRight, UploadCloud, Layers } from "lucide-react";

interface FeedbackItem {
  caseId: string;
  txId: string;
  customer: string;
  amount: number;
  initialScore: number;
  analystOutcome: "Confirmed Fraud" | "Legitimate Transaction" | "False Positive";
  analyst: string;
  verifiedAt: string;
  status: "Queued for Retraining" | "Embedded in Dataset v1.9";
}

const mockFeedbackHistory: FeedbackItem[] = [
  { caseId: "CASE-0084", txId: "TXN-20488", customer: "CUST-6D02", amount: 44600, initialScore: 78, analystOutcome: "False Positive", analyst: "Arjun Sharma", verifiedAt: "Today, 11:05", status: "Queued for Retraining" },
  { caseId: "CASE-0081", txId: "TXN-20481", customer: "CUST-7A21", amount: 184500, initialScore: 94, analystOutcome: "Confirmed Fraud", analyst: "Arjun Sharma", verifiedAt: "Today, 11:20", status: "Queued for Retraining" },
  { caseId: "CASE-0078", txId: "TXN-20450", customer: "CUST-11A0", amount: 9200, initialScore: 68, analystOutcome: "Legitimate Transaction", analyst: "R. Iyer", verifiedAt: "Yesterday", status: "Embedded in Dataset v1.9" },
];

export const HumanFeedbackLoop: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>(mockFeedbackHistory);
  const [datasetVersion, setDatasetVersion] = useState("ULB-2026-Q4-CANDIDATE");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const triggerDatasetBuild = () => {
    setSyncStatus("Packaging 14 verified analyst dispositions into training split...");
    setTimeout(() => {
      setFeedbackList((prev) =>
        prev.map((item) => ({ ...item, status: "Embedded in Dataset v1.9" }))
      );
      setSyncStatus("Dataset version ULB-2026-Q4-CANDIDATE built and signed with SHA-256.");
    }, 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Human Feedback & Model Improvement Loop</h2>
          <p>Controlled pipeline converting analyst case resolutions into verified training ground-truth without data leakage.</p>
        </div>
        <span className="badge green"><ShieldCheck size={13} style={{ marginRight: 4 }} /> AUDITED PROVENANCE</span>
      </div>

      {/* Dataset & Split Metrics */}
      <div className="kpi-grid four">
        <section className="panel kpi">
          <div className="kpi-top"><span>VERIFIED DISPOSITIONS</span><span className="kpi-icon green"><CheckCircle2 size={17} /></span></div>
          <div className="kpi-value">{feedbackList.length}</div>
          <div className="kpi-foot"><span>100% Analyst Audited</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>TRAIN / TEST SPLIT</span><span className="kpi-icon cyan"><Layers size={17} /></span></div>
          <div className="kpi-value">80 / 20</div>
          <div className="kpi-foot"><span>Temporal Split (No Leakage)</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>DATASET CANDIDATE</span><span className="kpi-icon amber"><Database size={17} /></span></div>
          <div className="kpi-value">v1.9</div>
          <div className="kpi-foot"><span>+42 Confirmed Labels</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>RETRAINING PIPELINE</span><span className="kpi-icon green"><RotateCw size={17} /></span></div>
          <div className="kpi-value">Ready</div>
          <div className="kpi-foot"><span>Airflow DAG Configured</span></div>
        </section>
      </div>

      {/* Action Banner */}
      <section className="panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: "15px" }}>Active Ground-Truth Queue: {datasetVersion}</h3>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: "13px" }}>
            Incorporate verified analyst feedback to penalize false alarms and adapt to new fraud patterns.
          </p>
        </div>
        <button className="btn primary" onClick={triggerDatasetBuild} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <UploadCloud size={16} /> Publish Training Split
        </button>
      </section>

      {syncStatus && (
        <div className="toast" style={{ width: "100%", justifyContent: "space-between" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} /> {syncStatus}
          </span>
          <button onClick={() => setSyncStatus(null)}>Dismiss</button>
        </div>
      )}

      {/* Feedback Records Table */}
      <section className="panel">
        <div className="table-caption">
          <span><i className="pulse-dot" /> Verified Case Resolutions with Complete Audit Trails</span>
          <span className="badge blue">Strict Provenance</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CASE ID</th>
                <th>TRANSACTION</th>
                <th>CUSTOMER</th>
                <th>AMOUNT</th>
                <th>INITIAL SCORE</th>
                <th>ANALYST DISPOSITION</th>
                <th>VERIFIED BY</th>
                <th>DATASET STATUS</th>
              </tr>
            </thead>
            <tbody>
              {feedbackList.map((item) => (
                <tr key={item.caseId}>
                  <td><strong>{item.caseId}</strong></td>
                  <td><code>{item.txId}</code></td>
                  <td className="mono">{item.customer}</td>
                  <td>₹{item.amount.toLocaleString()}</td>
                  <td><strong>{item.initialScore}/100</strong></td>
                  <td>
                    <span className={`badge ${item.analystOutcome === "Confirmed Fraud" ? "red" : item.analystOutcome === "False Positive" ? "amber" : "green"}`}>
                      {item.analystOutcome}
                    </span>
                  </td>
                  <td>{item.analyst}</td>
                  <td>
                    <span className={`badge ${item.status === "Embedded in Dataset v1.9" ? "green" : "blue"}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

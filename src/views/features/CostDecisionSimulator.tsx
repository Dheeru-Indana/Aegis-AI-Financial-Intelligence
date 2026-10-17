import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Sliders, Shield, AlertTriangle, ArrowRight, DollarSign, RefreshCw } from "lucide-react";

export const CostDecisionSimulator: React.FC = () => {
  const [fnCost, setFnCost] = useState<number>(15000); // Cost of missing fraud
  const [fpCost, setFpCost] = useState<number>(350);   // Cost of false alarm / verification
  const [reviewCost, setReviewCost] = useState<number>(85); // Analyst manual triage cost
  const [threshold, setThreshold] = useState<number>(75);

  // Fixed test dataset metrics: 1,000 evaluated transactions, 50 actual frauds, 950 legit
  const totalCases = 1000;
  const actualFrauds = 50;
  const actualLegit = 950;

  // Threshold effect calculation
  const tp = Math.round(actualFrauds * Math.max(0.2, (100 - threshold + 15) / 100));
  const fn = actualFrauds - tp;
  const fp = Math.round(actualLegit * Math.max(0.01, (100 - threshold) / 350));
  const tn = actualLegit - fp;

  const totalFinancialLoss = fn * fnCost + fp * fpCost + (tp + fp) * reviewCost;
  const precision = tp / (tp + fp || 1);
  const recall = tp / actualFrauds;
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  // Generate cost curve across thresholds 40 to 90
  const costCurve = [];
  for (let t = 40; t <= 90; t += 5) {
    const curTp = Math.round(actualFrauds * Math.max(0.2, (100 - t + 15) / 100));
    const curFn = actualFrauds - curTp;
    const curFp = Math.round(actualLegit * Math.max(0.01, (100 - t) / 350));
    const loss = curFn * fnCost + curFp * fpCost + (curTp + curFp) * reviewCost;
    costCurve.push({ threshold: t, loss });
  }

  const optimalThreshold = costCurve.reduce((min, cur) => (cur.loss < min.loss ? cur : min), costCurve[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Cost-Sensitive Decision Simulator</h2>
          <p>Optimize fraud threshold bands against asymmetric financial costs (Missed Fraud vs. Review Overhead).</p>
        </div>
        <span className="badge cyan">Optimal: {optimalThreshold.threshold}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {/* Cost parameters panel */}
        <section className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#22d3ee", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sliders size={16} /> Cost Matrix Parameters
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                <span>FALSE NEGATIVE COST (UNCAUGHT FRAUD)</span>
                <strong>₹{fnCost.toLocaleString()}</strong>
              </label>
              <input type="range" min="5000" max="50000" step="1000" value={fnCost} onChange={(e) => setFnCost(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                <span>FALSE POSITIVE COST (USER FRICTION)</span>
                <strong>₹{fpCost.toLocaleString()}</strong>
              </label>
              <input type="range" min="50" max="2000" step="50" value={fpCost} onChange={(e) => setFpCost(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                <span>MANUAL REVIEW COST PER CASE</span>
                <strong>₹{reviewCost.toLocaleString()}</strong>
              </label>
              <input type="range" min="10" max="300" step="5" value={reviewCost} onChange={(e) => setReviewCost(Number(e.target.value))} style={{ width: "100%" }} />
            </div>

            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#22d3ee", marginBottom: "4px" }}>
                <span>DECISION CUTOFF THRESHOLD</span>
                <strong>{threshold}/100</strong>
              </label>
              <input type="range" min="40" max="90" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
          </div>
        </section>

        {/* Expected financial loss card */}
        <section className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#fb7185", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <DollarSign size={16} /> Projected Financial Loss
          </h3>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "#f87171" }}>
            ₹{totalFinancialLoss.toLocaleString()}
          </div>
          <small style={{ color: "#94a3b8" }}>Per 1,000 transactions evaluated under current threshold policy</small>

          <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>PRECISION</div>
              <strong style={{ fontSize: "16px", color: "#22d3ee" }}>{(precision * 100).toFixed(1)}%</strong>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>RECALL (DETECTION)</div>
              <strong style={{ fontSize: "16px", color: "#34d399" }}>{(recall * 100).toFixed(1)}%</strong>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>MISSED FRAUDS (FN)</div>
              <strong style={{ fontSize: "16px", color: "#fb7185" }}>{fn}</strong>
            </div>
            <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "10px", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>FALSE ALARMS (FP)</div>
              <strong style={{ fontSize: "16px", color: "#fbbf24" }}>{fp}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Cost optimization curve */}
      <section className="panel" style={{ padding: "20px" }}>
        <h3 style={{ fontSize: "14px", color: "#e2e8f0", marginBottom: "12px" }}>Financial Loss vs. Threshold Curve</h3>
        <div style={{ height: "200px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={costCurve}>
              <CartesianGrid stroke="#26344a" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="threshold" stroke="#718198" />
              <YAxis stroke="#718198" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a", borderRadius: 8 }} />
              <Area type="monotone" dataKey="loss" stroke="#fb7185" fill="rgba(251, 113, 133, 0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

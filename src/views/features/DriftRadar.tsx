import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, AlertTriangle, ShieldCheck, ArrowUpRight, TrendingUp } from "lucide-react";

interface DriftMetric {
  feature: string;
  baselineMean: number;
  currentMean: number;
  psiScore: number;
  status: "Normal" | "Moderate Drift" | "Severe Drift";
}

const mockDriftData: DriftMetric[] = [
  { feature: "Transaction Amount", baselineMean: 12400, currentMean: 18950, psiScore: 0.28, status: "Severe Drift" },
  { feature: "Attempt Velocity", baselineMean: 1.2, currentMean: 2.1, psiScore: 0.19, status: "Moderate Drift" },
  { feature: "New Device Ratio", baselineMean: 0.08, currentMean: 0.22, psiScore: 0.21, status: "Moderate Drift" },
  { feature: "Location Change Ratio", baselineMean: 0.05, currentMean: 0.14, psiScore: 0.17, status: "Moderate Drift" },
  { feature: "Hour of Day", baselineMean: 14.5, currentMean: 14.2, psiScore: 0.04, status: "Normal" },
];

const driftTrends = [
  { day: "Oct 09", psi: 0.06 },
  { day: "Oct 10", psi: 0.08 },
  { day: "Oct 11", psi: 0.12 },
  { day: "Oct 12", psi: 0.15 },
  { day: "Oct 13", psi: 0.21 },
  { day: "Oct 14", psi: 0.25 },
  { day: "Oct 15", psi: 0.28 },
];

export const DriftRadar: React.FC = () => {
  const [selectedFeature, setSelectedFeature] = useState<DriftMetric>(mockDriftData[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Fraud & Model Drift Radar</h2>
          <p>Population Stability Index (PSI) and feature distribution tracking against verified training baselines.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge amber">Illustrative Demo Data · Continuous Monitor Pending</span>
          <span className="badge red">PSI 0.28 — DRIFT DETECTED</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid four">
        <section className="panel kpi">
          <div className="kpi-top"><span>AGGREGATE PSI</span><span className="kpi-icon red"><AlertTriangle size={17} /></span></div>
          <div className="kpi-value">0.28</div>
          <div className="kpi-foot"><span className="negative">Exceeds 0.25 Threshold</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>DRIFTING FEATURES</span><span className="kpi-icon amber"><TrendingUp size={17} /></span></div>
          <div className="kpi-value">3 / 7</div>
          <div className="kpi-foot"><span>Amount, Velocity, New Device</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>ALERT RATE DRIFT</span><span className="kpi-icon cyan"><Activity size={17} /></span></div>
          <div className="kpi-value">0.51%</div>
          <div className="kpi-foot"><span>Baseline: 0.47%</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top"><span>MODEL STABILITY</span><span className="kpi-icon green"><ShieldCheck size={17} /></span></div>
          <div className="kpi-value">v2.0.0</div>
          <div className="kpi-foot"><span>fraud-v2.0.0-logistic</span></div>
        </section>
      </div>

      {/* Drift Trend Chart & Table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <section className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#e2e8f0", marginBottom: "14px" }}>7-Day Population Stability Index (PSI)</h3>
          <div style={{ height: "220px", width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={driftTrends}>
                <CartesianGrid stroke="#26344a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="#718198" />
                <YAxis domain={[0, 0.35]} stroke="#718198" />
                <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a", borderRadius: 8 }} />
                <Line type="monotone" dataKey="psi" stroke="#fb7185" strokeWidth={2.5} dot={{ r: 4, fill: "#fb7185" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <small style={{ color: "#94a3b8" }}>PSI &gt; 0.25 indicates significant shift in consumer behavioral patterns.</small>
        </section>

        <section className="panel" style={{ padding: "16px" }}>
          <h3 style={{ fontSize: "14px", color: "#22d3ee", marginBottom: "12px" }}>Feature Shift Matrix</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>FEATURE</th>
                  <th>BASELINE</th>
                  <th>CURRENT</th>
                  <th>PSI</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {mockDriftData.map((d) => (
                  <tr
                    key={d.feature}
                    onClick={() => setSelectedFeature(d)}
                    style={{ cursor: "pointer", background: selectedFeature.feature === d.feature ? "rgba(34, 211, 238, 0.05)" : undefined }}
                  >
                    <td><strong>{d.feature}</strong></td>
                    <td>{d.baselineMean.toLocaleString()}</td>
                    <td>{d.currentMean.toLocaleString()}</td>
                    <td><strong>{d.psiScore}</strong></td>
                    <td>
                      <span className={`badge ${d.status === "Severe Drift" ? "red" : d.status === "Moderate Drift" ? "amber" : "green"}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

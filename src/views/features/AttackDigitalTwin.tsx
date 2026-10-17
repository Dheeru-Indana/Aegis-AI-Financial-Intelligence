import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, ShieldAlert, Zap, AlertTriangle, ArrowRight } from "lucide-react";
import { scoreTransactionDeterministic } from "../../services/scoringEngine";
import type { Decision, Transaction } from "../../types";

export const AttackDigitalTwin: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [scenario, setScenario] = useState<"carding" | "account_takeover" | "flash_crowd">("carding");
  const [speedMs, setSpeedMs] = useState(1200);
  const [simulatedTxns, setSimulatedTxns] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({ total: 0, flagged: 0, verified: 0, allowed: 0 });

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      let amount = 500;
      let attemptCount = 1;
      let channel: any = "UPI";
      let isNewDevice = false;
      let locationChange = false;
      const customer = `SYNTH-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      if (scenario === "carding") {
        amount = Math.floor(Math.random() * 800 + 100);
        attemptCount = Math.floor(Math.random() * 6 + 1);
        channel = "Card";
        isNewDevice = true;
      } else if (scenario === "account_takeover") {
        amount = Math.floor(Math.random() * 150000 + 45000);
        channel = "Net banking";
        locationChange = true;
        isNewDevice = true;
      } else {
        // Flash crowd legitimate high velocity
        amount = Math.floor(Math.random() * 2500 + 200);
        channel = "UPI";
      }

      const res = scoreTransactionDeterministic({
        amount,
        channel,
        customer,
        attemptCount,
        isNewDevice,
        locationChange,
      });

      const newTx: Transaction = {
        id: `SIM-${Math.floor(80000 + Math.random() * 10000)}`,
        timestamp: new Date().toLocaleTimeString(),
        amount,
        channel,
        customer,
        score: res.score,
        decision: res.decision,
        signals: res.signals,
        modelVersion: "fraud-v1.8.2-twin",
        latency: res.latencyMs,
        explanation: `[ATTACK TWIN] ${res.explanation}`,
      };

      setSimulatedTxns((prev) => [newTx, ...prev.slice(0, 19)]);
      setStats((prev) => ({
        total: prev.total + 1,
        flagged: prev.flagged + (res.decision === "FLAG" ? 1 : 0),
        verified: prev.verified + (res.decision === "VERIFY" ? 1 : 0),
        allowed: prev.allowed + (res.decision === "ALLOW" ? 1 : 0),
      }));
    }, speedMs);

    return () => clearInterval(interval);
  }, [isRunning, scenario, speedMs]);

  const resetSimulation = () => {
    setIsRunning(false);
    setSimulatedTxns([]);
    setStats({ total: 0, flagged: 0, verified: 0, allowed: 0 });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Fraud Attack Digital Twin</h2>
          <p>Sandboxed adversarial stress-testing environment. Zero risk to production transaction records.</p>
        </div>
        <span className="badge amber">ISOLATED SANDBOX</span>
      </div>

      {/* Control Strip */}
      <section className="panel" style={{ padding: "18px 24px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className={`btn ${isRunning ? "secondary" : "primary"}`}
              onClick={() => setIsRunning(!isRunning)}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
              {isRunning ? "Pause Scenario" : "Launch Attack Simulation"}
            </button>
            <button className="btn secondary" onClick={resetSimulation} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>SCENARIO PROFILE</label>
              <select
                className="select"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as any)}
                disabled={isRunning}
              >
                <option value="carding">Automated Card Velocity Burst</option>
                <option value="account_takeover">Account Takeover & High-Value Drain</option>
                <option value="flash_crowd">Legitimate Flash Festival (False Positive Test)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>STREAM SPEED</label>
              <select className="select" value={speedMs} onChange={(e) => setSpeedMs(Number(e.target.value))}>
                <option value={2000}>0.5 events/sec (Slow)</option>
                <option value={1000}>1 event/sec (Normal)</option>
                <option value={400}>2.5 events/sec (High Burst)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Attack Metrics */}
      <div className="metric-strip">
        <div>
          <span>Simulated Payloads</span>
          <strong>{stats.total}</strong>
          <small>Synthetic stream</small>
        </div>
        <div>
          <span>Flagged Interceptions</span>
          <strong className="red-text">{stats.flagged}</strong>
          <small>{((stats.flagged / (stats.total || 1)) * 100).toFixed(0)}% detection rate</small>
        </div>
        <div>
          <span>Step-Up Challenges</span>
          <strong className="amber-text">{stats.verified}</strong>
          <small>VERIFY triggered</small>
        </div>
        <div>
          <span>Clean Passes</span>
          <strong style={{ color: "#34d399" }}>{stats.allowed}</strong>
          <small>Low risk</small>
        </div>
      </div>

      {/* Live Stream Table */}
      <section className="panel">
        <div className="table-caption">
          <span><i className="pulse-dot" /> Live Twin Feed: {simulatedTxns.length} recent synthetic events</span>
          <span className="badge amber">Isolated from PostgreSQL</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PAYLOAD ID</th>
                <th>TIME</th>
                <th>AMOUNT</th>
                <th>CHANNEL</th>
                <th>SYNTHETIC ACTOR</th>
                <th>SCORE</th>
                <th>DECISION</th>
                <th>TRIGGERED SIGNALS</th>
              </tr>
            </thead>
            <tbody>
              {simulatedTxns.map((t) => (
                <tr key={t.id}>
                  <td><code>{t.id}</code></td>
                  <td>{t.timestamp}</td>
                  <td>₹{t.amount.toLocaleString()}</td>
                  <td>{t.channel}</td>
                  <td className="mono">{t.customer}</td>
                  <td><strong>{t.score}/100</strong></td>
                  <td>
                    <span className={`badge ${t.decision === "FLAG" ? "red" : t.decision === "VERIFY" ? "amber" : "green"}`}>
                      {t.decision}
                    </span>
                  </td>
                  <td>
                    <div className="signal-chips">
                      {t.signals.map((s) => <span key={s}>{s}</span>)}
                    </div>
                  </td>
                </tr>
              ))}
              {simulatedTxns.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>
                    Select a scenario and click "Launch Attack Simulation" to observe real-time adversarial interception.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

import React, { useState } from "react";
import { Bot, Send, Sparkles, Shield, AlertTriangle, ArrowRight, BookOpen, Check } from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  citations?: { type: string; ref: string; detail: string }[];
  timestamp: string;
}

const presetQueries = [
  "Why was transaction TXN-20481 flagged?",
  "Which active risk rules contributed most this week?",
  "Summarize evidence for Fraud Case CASE-0081",
  "What features dominate the fraud-v2.0.0-logistic score?",
];

export const AnalystCopilot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "m-1",
      sender: "copilot",
      text: "Hello Analyst. I am the AegisAI Investigation Copilot (scripted demo assistant). I answer common triage questions using pattern matching against demo case notes, rule triggers, and model coefficients. How can I assist your triage?",
      timestamp: "Just now",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsTyping(true);

    setTimeout(() => {
      let replyText = "";
      let citations: Message["citations"] = [];

      if (queryText.includes("TXN-20481")) {
        replyText =
          "Transaction TXN-20481 was flagged with an estimated risk score of 94/100. Key drivers include an amount anomaly of ₹1,84,500 (> ₹1,00,000 threshold), an unrecognized device fingerprint, and 4 repeated attempts contributing heavily to normalized velocity.";
        citations = [
          { type: "Transaction Record", ref: "TXN-20481", detail: "Amount: ₹1,84,500 via UPI" },
          { type: "Active Risk Rule", ref: "R-01", detail: "High Transaction Amount (> ₹1,00,000)" },
          { type: "Model Attribution", ref: "fraud-v2.0.0-logistic", detail: "Log-odds: amount_norm +37.24, velocity_norm +6.48" },
        ];
      } else if (queryText.includes("CASE-0081") || queryText.includes("Summarize")) {
        replyText =
          "Case CASE-0081 represents a High-Priority alert created for customer CUST-7A21. The linked event occurred at 11:18 UTC. Analyst note confirms out-of-band verification is underway following an IP location discrepancy.";
        citations = [
          { type: "Case Queue", ref: "CASE-0081", detail: "Status: Open, Assigned to Arjun Sharma" },
          { type: "Audit Log", ref: "AUD-91A1", detail: "Case opened timestamped 11:18:10 UTC" },
        ];
      } else if (queryText.includes("rules") || queryText.includes("contributed")) {
        replyText =
          "Across the evaluated transactions, Rule R-01 (High Transaction Amount) and Rule R-02 (Repeated Transaction Attempts) triggered the majority of elevated VERIFY and FLAG outcomes.";
        citations = [
          { type: "Risk Engine", ref: "R-01 & R-02", detail: "Combined impact: +55 risk points" },
        ];
      } else {
        replyText = `Based on scripted pattern matching for "${queryText}": Active transactions are evaluated under model fraud-v2.0.0-logistic (trained on synthetic data). No active rule violations found.`;
        citations = [
          { type: "Scoring Scope", ref: "fraud-v2.0.0-logistic", detail: "Standardized logistic regression pipeline" },
        ];
      }

      const copilotMsg: Message = {
        id: `c-${Date.now()}`,
        sender: "copilot",
        text: replyText,
        citations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, copilotMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Analyst Copilot</h2>
          <p>Scripted investigation assistant demonstrating evidence extraction across demo audit traces, logistic coefficients, and rule triggers (No external LLM connected).</p>
        </div>
        <span className="badge amber"><Sparkles size={13} style={{ marginRight: 4 }} /> SCRIPTED DEMO</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>
        {/* Chat Stream Panel */}
        <section className="panel" style={{ display: "flex", flexDirection: "column", height: "500px", padding: "16px" }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", paddingRight: "8px" }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  background: m.sender === "user" ? "#1e293b" : "rgba(18, 27, 45, 0.9)",
                  border: `1px solid ${m.sender === "user" ? "#334155" : "#26344a"}`,
                  borderRadius: "12px",
                  padding: "14px 16px",
                  color: "#f1f5f9",
                  fontSize: "13px",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  {m.sender === "copilot" ? (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#22d3ee", fontWeight: 600, fontSize: "12px" }}>
                      <Bot size={15} /> Aegis Copilot
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: "12px" }}>Analyst</span>
                  )}
                  <small style={{ color: "#64748b", marginLeft: "auto", fontSize: "11px" }}>{m.timestamp}</small>
                </div>

                <p style={{ margin: 0 }}>{m.text}</p>

                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "11px" }}>
                    <div style={{ color: "#22d3ee", fontWeight: 600, marginBottom: "4px" }}>GROUNDING EVIDENCE:</div>
                    {m.citations.map((c, idx) => (
                      <div key={idx} style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "6px" }}>
                        <BookOpen size={11} style={{ color: "#64748b" }} />
                        <strong>[{c.ref}]</strong> {c.detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: "flex-start", color: "#94a3b8", fontSize: "12px", padding: "8px 12px" }}>
                Copilot is verifying database evidence...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(inputQuery); }}
            style={{ display: "flex", gap: "10px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #1e293b" }}
          >
            <input
              className="field"
              type="text"
              placeholder="Ask Copilot about any transaction, case evidence, or policy rule..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              style={{ flex: 1, height: "42px" }}
            />
            <button type="submit" className="btn primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Send size={15} /> Send
            </button>
          </form>
        </section>

        {/* Quick Question Prompts */}
        <section className="panel" style={{ padding: "18px" }}>
          <h3 style={{ fontSize: "13px", color: "#22d3ee", marginBottom: "14px" }}>VERIFIED INVESTIGATION QUERIES</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {presetQueries.map((q, idx) => (
              <button
                key={idx}
                className="btn secondary"
                onClick={() => handleSend(q)}
                style={{ textAlign: "left", fontSize: "12px", padding: "10px 12px", lineHeight: "1.4", height: "auto" }}
              >
                {q}
              </button>
            ))}
          </div>

          <div style={{ marginTop: "20px", background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px", fontSize: "11px", color: "#94a3b8" }}>
            <Shield size={14} style={{ color: "#22d3ee", marginBottom: "4px" }} />
            <div><strong>Prompt Injection Defense:</strong> Copilot answers are sandboxed and read-only. No raw SQL or prompt override execution is permitted.</div>
          </div>
        </section>
      </div>
    </div>
  );
};

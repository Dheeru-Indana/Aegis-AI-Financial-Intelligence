import React, { useState } from "react";
import { Share2, AlertTriangle, Shield, User, Smartphone, CreditCard, Building, ArrowRight, Plus } from "lucide-react";

interface Node {
  id: string;
  type: "account" | "device" | "merchant" | "card";
  label: string;
  risk: "High" | "Medium" | "Low";
  details: string;
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  label: string;
}

const initialNodes: Node[] = [
  { id: "ACC-1", type: "account", label: "CUST-7A21", risk: "High", details: "Primary suspect account with ₹1.84L spike", x: 200, y: 150 },
  { id: "DEV-1", type: "device", label: "DEV-F8291", risk: "High", details: "Emulated Android Fingerprint (Shared across 4 accounts)", x: 380, y: 120 },
  { id: "ACC-2", type: "account", label: "CUST-8B13", risk: "High", details: "Rapid card attempt anomaly account", x: 560, y: 150 },
  { id: "CARD-1", type: "card", label: "CARD-**4902", risk: "High", details: "Stolen BIN vector 411123", x: 380, y: 260 },
  { id: "MERCH-1", type: "merchant", label: "MERCH-LUXURY", risk: "Medium", details: "High-value digital electronics merchant", x: 560, y: 280 },
  { id: "ACC-3", type: "account", label: "CUST-3F90", risk: "Medium", details: "Step-up OTP failed account", x: 200, y: 280 },
];

const initialEdges: Edge[] = [
  { from: "ACC-1", to: "DEV-1", label: "Device Fingerprint" },
  { from: "ACC-2", to: "DEV-1", label: "Device Fingerprint" },
  { from: "ACC-2", to: "CARD-1", label: "Card Used" },
  { from: "ACC-3", to: "CARD-1", label: "Card Used" },
  { from: "ACC-2", to: "MERCH-1", label: "Target Transaction" },
];

export const FraudRingExplorer: React.FC<{ onCreateCase?: (ref: string) => void }> = ({ onCreateCase }) => {
  const [nodes] = useState<Node[]>(initialNodes);
  const [edges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(nodes[1]); // DEV-1 shared device
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const getNodeIcon = (type: Node["type"]) => {
    switch (type) {
      case "account": return <User size={16} />;
      case "device": return <Smartphone size={16} />;
      case "card": return <CreditCard size={16} />;
      case "merchant": return <Building size={16} />;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="section-title">
        <div>
          <h2>Fraud Ring Network Explorer</h2>
          <p>Multi-hop relationship visualizer. Discloses coordinated syndicates sharing devices, BINs, and IPs.</p>
        </div>
        <span className="badge red">COLLUSION CLUSTER DETECTED</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px" }}>
        {/* SVG Graph Canvas */}
        <section className="panel" style={{ padding: "16px", minHeight: "440px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "16px", left: "16px", display: "flex", gap: "12px", zIndex: 10 }}>
            <span className="badge red"><i style={{ background: "#fb7185", width: 6, height: 6, borderRadius: "50%", display: "inline-block", marginRight: 4 }} /> High Risk Syndicate</span>
            <span className="badge amber">Shared Device Vector</span>
          </div>

          <svg width="100%" height="400" viewBox="0 0 760 380" style={{ cursor: "crosshair" }}>
            {/* Draw Links */}
            {edges.map((e, idx) => {
              const fromN = nodes.find((n) => n.id === e.from);
              const toN = nodes.find((n) => n.id === e.to);
              if (!fromN || !toN) return null;
              const isHighlighted = selectedNode?.id === fromN.id || selectedNode?.id === toN.id;

              return (
                <g key={idx}>
                  <line
                    x1={fromN.x}
                    y1={fromN.y}
                    x2={toN.x}
                    y2={toN.y}
                    stroke={isHighlighted ? "#22d3ee" : "#26344a"}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={isHighlighted ? "none" : "4 4"}
                  />
                  <text
                    x={(fromN.x + toN.x) / 2}
                    y={(fromN.y + toN.y) / 2 - 6}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                </g>
              );
            })}

            {/* Draw Nodes */}
            {nodes.map((n) => {
              const isSelected = selectedNode?.id === n.id;
              const color = n.risk === "High" ? "#fb7185" : n.risk === "Medium" ? "#fbbf24" : "#34d399";

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => setSelectedNode(n)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={isSelected ? 26 : 20}
                    fill="#121b2d"
                    stroke={isSelected ? "#22d3ee" : color}
                    strokeWidth={isSelected ? 3 : 2}
                  />
                  <circle
                    r={isSelected ? 30 : 0}
                    fill="none"
                    stroke="#22d3ee"
                    strokeOpacity={0.3}
                    strokeWidth={4}
                  />
                  <text
                    y="36"
                    fill={isSelected ? "#22d3ee" : "#94a3b8"}
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>

        {/* Node Inspector Panel */}
        <section className="panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", color: "#22d3ee", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Share2 size={16} /> Cluster Inspector
          </h3>

          {selectedNode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="badge blue">{selectedNode.type.toUpperCase()}</span>
                <span className={`badge ${selectedNode.risk === "High" ? "red" : "amber"}`}>{selectedNode.risk} Risk</span>
              </div>

              <div>
                <h4 style={{ margin: "0 0 4px", fontSize: "16px", color: "#f8fafc" }}>{selectedNode.label}</h4>
                <small style={{ color: "#94a3b8" }}>Entity Identifier: {selectedNode.id}</small>
              </div>

              <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "12px", borderRadius: "8px", fontSize: "13px", lineHeight: "1.5", color: "#cbd5e1" }}>
                {selectedNode.details}
              </div>

              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                <strong>COLLUSION EVIDENCE:</strong>
                <ul style={{ paddingLeft: "18px", margin: "6px 0 0" }}>
                  <li>Shared hardware device hash with 4 unique accounts</li>
                  <li>Velocity: 6 attempts within 180 seconds</li>
                  <li>Geographic IP hop from Mumbai to Singapore</li>
                </ul>
              </div>

              {actionNotice && (
                <div style={{ fontSize: "12px", color: "#34d399", padding: "8px", background: "rgba(52, 211, 153, 0.1)", borderRadius: "6px" }}>
                  {actionNotice}
                </div>
              )}

              <button
                className="btn primary"
                onClick={() => {
                  setActionNotice(`Syndicate Case opened for ${selectedNode.label}`);
                  if (onCreateCase) onCreateCase(selectedNode.label);
                }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginTop: "8px" }}
              >
                <Plus size={15} /> Escalate Fraud Ring Case
              </button>
            </div>
          ) : (
            <p style={{ color: "#64748b", fontSize: "13px" }}>Click on any node in the graph to inspect relationships.</p>
          )}
        </section>
      </div>
    </div>
  );
};

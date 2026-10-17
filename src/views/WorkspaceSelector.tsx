import React from "react";
import { Activity, Shield, ChevronDown, Check, ArrowRight } from "lucide-react";
import type { UserRole } from "../lib/authContext";

interface WorkspaceSelectorProps {
  currentWorkspace: "risk_operations" | "admin_governance";
  onSelectWorkspace: (ws: "risk_operations" | "admin_governance") => void;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  currentWorkspace,
  onSelectWorkspace,
  isAdmin,
  isOpen,
  onToggle,
  onClose,
}) => {
  return (
    <div style={{ position: "relative", margin: "0 3px 25px" }}>
      {/* Clickable Workspace Capsule */}
      <div
        className="workspace"
        onClick={onToggle}
        style={{ margin: 0, cursor: "pointer", transition: "border-color 0.2s" }}
      >
        <div className="workspace-icon">
          {currentWorkspace === "admin_governance" ? <Shield size={17} color="#fb7185" /> : <Activity size={17} />}
        </div>
        <div>
          <strong>{currentWorkspace === "admin_governance" ? "Admin Governance" : "Risk Operations"}</strong>
          <small>{currentWorkspace === "admin_governance" ? "Security & User Controls" : "Fraud Triage & Pipelines"}</small>
        </div>
        <ChevronDown size={15} style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 35 }}
            onClick={onClose}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "#10192a",
              border: "1px solid #2a3a52",
              borderRadius: "8px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              zIndex: 40,
              padding: "6px",
            }}
          >
            {/* Risk Operations Workspace */}
            <div
              onClick={() => {
                onSelectWorkspace("risk_operations");
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "6px",
                cursor: "pointer",
                background: currentWorkspace === "risk_operations" ? "#16273b" : "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#182740")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = currentWorkspace === "risk_operations" ? "#16273b" : "transparent")
              }
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "#143143",
                  display: "grid",
                  placeItems: "center",
                  color: "#22d3ee",
                }}
              >
                <Activity size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: "11px", color: "#f1f5f9", display: "block" }}>Risk Operations</strong>
                <small style={{ fontSize: "9px", color: "#94a3b8" }}>Transactions & investigations</small>
              </div>
              {currentWorkspace === "risk_operations" && <Check size={14} color="#22d3ee" />}
            </div>

            {/* Admin Governance Workspace */}
            <div
              onClick={() => {
                if (isAdmin) {
                  onSelectWorkspace("admin_governance");
                  onClose();
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 10px",
                borderRadius: "6px",
                marginTop: "4px",
                cursor: isAdmin ? "pointer" : "not-allowed",
                opacity: isAdmin ? 1 : 0.6,
                background: currentWorkspace === "admin_governance" ? "#2d1624" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (isAdmin) e.currentTarget.style.background = "#301a27";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = currentWorkspace === "admin_governance" ? "#2d1624" : "transparent";
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "#381a27",
                  display: "grid",
                  placeItems: "center",
                  color: "#fb7185",
                }}
              >
                <Shield size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: "11px", color: "#f1f5f9", display: "block" }}>Admin Governance</strong>
                <small style={{ fontSize: "9px", color: "#94a3b8" }}>
                  {isAdmin ? "User supervision & telemetry" : "Requires Administrator role"}
                </small>
              </div>
              {currentWorkspace === "admin_governance" ? (
                <Check size={14} color="#fb7185" />
              ) : !isAdmin ? (
                <span style={{ fontSize: "8px", background: "#26344a", padding: "2px 5px", borderRadius: "3px", color: "#94a3b8" }}>
                  LOCKED
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

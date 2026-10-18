import React, { useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, ShieldAlert, Check, X, Clock3, Filter } from "lucide-react";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: "high" | "medium" | "low" | "info";
  timestamp: string;
  read: boolean;
  linkRef?: string;
}

const mockNotifications: NotificationItem[] = [
  {
    id: "notif-1",
    title: "High-Risk Spike Detected",
    message: "Transaction TXN-20481 flagged with risk score 94/100 (Velocity Anomaly).",
    severity: "high",
    timestamp: "10 mins ago",
    read: false,
    linkRef: "TXN-20481",
  },
  {
    id: "notif-2",
    title: "Model Disagreement Alert",
    message: "Score divergence detected between ML model (v2.0.0) and rule engine on TXN-20485.",
    severity: "medium",
    timestamp: "35 mins ago",
    read: false,
    linkRef: "TXN-20485",
  },
  {
    id: "notif-3",
    title: "Population Drift Warning",
    message: "Aggregate PSI reached 0.28 on Amount & Velocity features exceeding tolerance.",
    severity: "high",
    timestamp: "2 hours ago",
    read: false,
  },
  {
    id: "notif-4",
    title: "Case Assignment",
    message: "Fraud Case CASE-0084 assigned to Arjun Sharma for investigation.",
    severity: "info",
    timestamp: "4 hours ago",
    read: true,
    linkRef: "CASE-0084",
  },
  {
    id: "notif-5",
    title: "Rule Policy Synchronized",
    message: "Risk Rule 'High transaction amount' updated by Administrator.",
    severity: "low",
    timestamp: "Yesterday",
    read: true,
  },
];

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRef?: (ref: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onSelectRef,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  if (!isOpen) return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markSingleRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const filtered = notifications.filter((n) => (filter === "unread" ? !n.read : true));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      style={{
        position: "absolute",
        top: "60px",
        right: "60px",
        width: "360px",
        background: "#0f172a",
        border: "1px solid #2a3a52",
        borderRadius: "10px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "#131e33",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Bell size={16} color="#22d3ee" />
          <strong style={{ fontSize: "12px", color: "#f1f5f9" }}>Notifications</strong>
          {unreadCount > 0 && <span className="badge red">{unreadCount}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: "transparent",
                border: 0,
                color: "#22d3ee",
                fontSize: "10px",
                cursor: "pointer",
                padding: "2px 4px",
              }}
            >
              Mark all read
            </button>
          )}
          <button className="icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "4px", padding: "8px 12px", background: "#0c1322", borderBottom: "1px solid #1e293b" }}>
        <button
          onClick={() => setFilter("all")}
          style={{
            background: filter === "all" ? "#1e293b" : "transparent",
            color: filter === "all" ? "#22d3ee" : "#64748b",
            border: 0,
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "10px",
            cursor: "pointer",
          }}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter("unread")}
          style={{
            background: filter === "unread" ? "#1e293b" : "transparent",
            color: filter === "unread" ? "#22d3ee" : "#64748b",
            border: 0,
            borderRadius: "4px",
            padding: "4px 8px",
            fontSize: "10px",
            cursor: "pointer",
          }}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: "360px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#64748b", fontSize: "11px" }}>
            No notifications in this view.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                markSingleRead(item.id);
                if (item.linkRef && onSelectRef) {
                  onSelectRef(item.linkRef);
                  onClose();
                }
              }}
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid #1a2333",
                background: item.read ? "transparent" : "#142033",
                cursor: "pointer",
                display: "flex",
                gap: "10px",
                alignItems: "flex-start",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#182740")}
              onMouseLeave={(e) => (e.currentTarget.style.background = item.read ? "transparent" : "#142033")}
            >
              <div style={{ marginTop: "2px" }}>
                {item.severity === "high" ? (
                  <ShieldAlert size={16} color="#fb7185" />
                ) : item.severity === "medium" ? (
                  <AlertTriangle size={16} color="#fbbf24" />
                ) : (
                  <CheckCircle2 size={16} color="#34d399" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ fontSize: "11px", color: item.read ? "#cbd5e1" : "#f1f5f9" }}>{item.title}</strong>
                  <span style={{ fontSize: "9px", color: "#64748b" }}>{item.timestamp}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "10px", color: "#94a3b8", lineHeight: 1.4 }}>
                  {item.message}
                </p>
                {item.linkRef && (
                  <span style={{ display: "inline-block", marginTop: "4px", fontSize: "9px", color: "#22d3ee" }}>
                    View {item.linkRef} →
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "8px 12px", background: "#0c1220", textAlign: "center", borderTop: "1px solid #1e293b", fontSize: "9px", color: "#64748b" }}>
        Notifications synchronized with Supabase Realtime alerts
      </div>
    </div>
  );
};

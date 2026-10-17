import React, { useState } from "react";
import { Shield, Users, Activity, AlertTriangle, FileClock, CheckCircle2, ShieldAlert, SlidersHorizontal, RefreshCw, X } from "lucide-react";
import type { UserRole } from "../lib/authContext";

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: "active" | "suspended";
  created_at: string;
}

const mockAdminUsers: AdminUser[] = [
  { id: "USR-01", email: "arjun.sharma@aegisai.internal", display_name: "Arjun Sharma", role: "fraud_analyst", status: "active", created_at: "2026-09-12" },
  { id: "USR-02", email: "admin@aegisai.internal", display_name: "SecOps Admin", role: "administrator", status: "active", created_at: "2026-08-01" },
  { id: "USR-03", email: "r.iyer@aegisai.internal", display_name: "R. Iyer", role: "investigator", status: "active", created_at: "2026-10-02" },
  { id: "USR-04", email: "compliance@aegisai.internal", display_name: "Audit Officer", role: "auditor", status: "active", created_at: "2026-10-05" },
];

export const AdminWorkspace: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [users, setUsers] = useState<AdminUser[]>(mockAdminUsers);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("fraud_analyst");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setToastMsg(`User ${userId} role updated to ${newRole}`);
    setSelectedUser(null);
  };

  const handleToggleStatus = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === "active" ? "suspended" : "active" }
          : u
      )
    );
    setToastMsg(`User status updated.`);
  };

  return (
    <div className="admin-workspace" style={{ padding: "24px 32px" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <div className="eyebrow" style={{ color: "#22d3ee" }}>SECURITY & GOVERNANCE</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0" }}>Administrative Monitoring & Control</h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            Supervise user permissions, system health, and model telemetry across all risk instances.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn secondary" onClick={() => setToastMsg("System telemetry refreshed")}>
            <RefreshCw size={15} /> Refresh Health
          </button>
          <button className="btn primary" onClick={onExit}>
            Exit Admin Workspace
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="toast" style={{ marginBottom: "16px" }}>
          <CheckCircle2 size={16} /> <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Admin KPIs */}
      <div className="kpi-grid four" style={{ marginBottom: "24px" }}>
        <section className="panel kpi">
          <div className="kpi-top">
            <span>REGISTERED ANALYSTS</span>
            <span className="kpi-icon cyan"><Users size={17} /></span>
          </div>
          <div className="kpi-value">{users.length}</div>
          <div className="kpi-foot"><span>4 Active Organizations</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top">
            <span>INGESTION PIPELINES</span>
            <span className="kpi-icon green"><Activity size={17} /></span>
          </div>
          <div className="kpi-value">3 Active</div>
          <div className="kpi-foot"><span className="positive">0 Errors in 24h</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top">
            <span>SECURITY AUDIT TRAIL</span>
            <span className="kpi-icon amber"><FileClock size={17} /></span>
          </div>
          <div className="kpi-value">1,284</div>
          <div className="kpi-foot"><span>Append-only PostgreSQL</span></div>
        </section>
        <section className="panel kpi">
          <div className="kpi-top">
            <span>EDGE SCORING WORKER</span>
            <span className="kpi-icon cyan"><ShieldAlert size={17} /></span>
          </div>
          <div className="kpi-value">99.98%</div>
          <div className="kpi-foot"><span>Latency p99: 42ms</span></div>
        </section>
      </div>

      {/* User Management Section */}
      <section className="panel" style={{ marginBottom: "24px" }}>
        <div className="table-toolbar" style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: "16px", margin: 0 }}>Authorized User Directory & RBAC</h2>
            <p style={{ color: "#94a3b8", fontSize: "13px", margin: "2px 0 0" }}>
              Enforce least-privilege roles across analysts, investigators, and auditors.
            </p>
          </div>
          <span className="badge blue">RLS Enforced</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>USER REF</th>
                <th>NAME / EMAIL</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>PROVISIONED</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.id}</strong></td>
                  <td>
                    <div><strong>{u.display_name}</strong></div>
                    <small style={{ color: "#94a3b8" }}>{u.email}</small>
                  </td>
                  <td>
                    <span className={`badge ${u.role === "administrator" ? "red" : u.role === "fraud_analyst" ? "cyan" : "neutral"}`}>
                      {u.role.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.status === "active" ? "green" : "amber"}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{u.created_at}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                        onClick={() => { setSelectedUser(u); setEditRole(u.role); }}
                      >
                        Change Role
                      </button>
                      <button
                        className="btn secondary"
                        style={{ padding: "4px 8px", fontSize: "12px", color: u.status === "active" ? "#fb7185" : "#34d399" }}
                        onClick={() => handleToggleStatus(u.id)}
                      >
                        {u.status === "active" ? "Suspend" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Role Modification Modal */}
      {selectedUser && (
        <div className="modal-backdrop" onMouseDown={() => setSelectedUser(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-icon"><Shield size={22} /></div>
            <h2>Modify Role Assignment</h2>
            <p>Update access permissions for <strong>{selectedUser.display_name}</strong> ({selectedUser.email}):</p>
            <div style={{ margin: "16px 0" }}>
              <select
                className="field"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                style={{ width: "100%", height: "40px" }}
              >
                <option value="fraud_analyst">Fraud Analyst (Standard Operator)</option>
                <option value="investigator">Investigator (Case Queue Only)</option>
                <option value="auditor">Auditor (Strict Read-Only)</option>
                <option value="administrator">Administrator (Privileged Access)</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setSelectedUser(null)}>Cancel</button>
              <button className="btn primary" onClick={() => handleRoleChange(selectedUser.id, editRole)}>
                Confirm Role Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

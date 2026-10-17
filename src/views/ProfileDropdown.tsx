import React, { useState } from "react";
import { User, Shield, LogOut, Settings, LayoutDashboard, Check, X, Mail } from "lucide-react";
import type { Profile, UserRole } from "../lib/authContext";

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  isAdmin: boolean;
  isConfigured: boolean;
  onOpenAdmin: () => void;
  onSignOut: () => void;
  onUpdateProfile: (name: string) => Promise<{ error: string | null }>;
  toast: (msg: string) => void;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  profile,
  isAdmin,
  isConfigured,
  onOpenAdmin,
  onSignOut,
  onUpdateProfile,
  toast,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await onUpdateProfile(name);
    setSaving(false);
    if (res.error) {
      toast(`Failed to update profile: ${res.error}`);
    } else {
      toast("Profile updated successfully");
      setIsEditing(false);
    }
  };

  const getRoleBadgeTone = (role?: string) => {
    switch (role) {
      case "administrator":
        return "red";
      case "fraud_analyst":
        return "cyan";
      case "investigator":
        return "amber";
      case "auditor":
        return "blue";
      default:
        return "neutral";
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "60px",
        right: "24px",
        width: "300px",
        background: "#0f172a",
        border: "1px solid #2a3a52",
        borderRadius: "10px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Identity Card */}
      <div style={{ padding: "16px", background: "#131e33", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              background: "#1e3a5f",
              border: "2px solid #22d3ee",
              display: "grid",
              placeItems: "center",
              fontSize: "14px",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            {profile?.display_name ? profile.display_name.slice(0, 2).toUpperCase() : "AS"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input
                  style={{
                    background: "#0b1020",
                    border: "1px solid #22d3ee",
                    color: "#f1f5f9",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "11px",
                    width: "120px",
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  className="icon-btn"
                  onClick={handleSaveName}
                  disabled={saving}
                  style={{ width: "24px", height: "24px", color: "#34d399" }}
                >
                  <Check size={14} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setIsEditing(false)}
                  style={{ width: "24px", height: "24px" }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <strong style={{ fontSize: "13px", color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profile?.display_name || "Arjun Sharma"}
                </strong>
                <button
                  onClick={() => setIsEditing(true)}
                  style={{ background: "transparent", border: 0, color: "#22d3ee", fontSize: "10px", cursor: "pointer" }}
                >
                  Edit
                </button>
              </div>
            )}
            <small style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", marginTop: "2px" }}>
              <Mail size={11} /> {profile?.email || "analyst@aegisai.internal"}
            </small>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
          <span style={{ fontSize: "10px", color: "#64748b" }}>Assigned Role</span>
          <span className={`badge ${getRoleBadgeTone(profile?.role)}`}>
            {profile?.role?.replace("_", " ").toUpperCase() || "FRAUD ANALYST"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "8px 0" }}>
        {isAdmin && (
          <button
            onClick={() => {
              onOpenAdmin();
              onClose();
            }}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 16px",
              background: "transparent",
              border: 0,
              color: "#fb7185",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#182030")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Shield size={16} /> Admin Monitoring Workspace
          </button>
        )}

        <button
          onClick={() => {
            onSignOut();
            onClose();
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 16px",
            background: "transparent",
            border: 0,
            color: "#94a3b8",
            fontSize: "12px",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#182030")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
};

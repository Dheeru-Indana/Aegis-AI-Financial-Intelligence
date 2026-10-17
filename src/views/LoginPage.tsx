import React, { useState } from "react";
import {
  Shield,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Building,
  Globe,
  Briefcase,
  HelpCircle,
  Database,
  UserCheck,
} from "lucide-react";
import { useAuth, type OnboardingData } from "../lib/authContext";

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { signInWithPassword, signUpWithPassword, resetPassword, isConfigured, enterSandboxDemo } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Credentials, Step 2: Onboarding Use-Case details

  // Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Onboarding Fields
  const [onboarding, setOnboarding] = useState<OnboardingData>({
    fullName: "",
    organization: "",
    country: "India",
    jobTitle: "Fraud Analyst",
    volumeRange: "10,000 - 100,000 / mo",
    intendedUseCase: "Real-Time Payment Fraud Prevention",
    initialDataMode: "synthetic",
    currency: "INR",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setEmailConfirmationRequired(false);

    if (mode === "signup" && step === 1) {
      if (!email.trim() || !password) {
        setErrorMsg("Please provide both email and password.");
        return;
      }
      if (password.length < 8) {
        setErrorMsg("Password must be at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please verify your password.");
        return;
      }
      // Move to step 2 for use-case collection
      setStep(2);
      return;
    }

    setLoading(true);

    try {
      if (mode === "forgot") {
        if (!email.trim()) throw new Error("Please enter your registered email address.");
        const res = await resetPassword(email);
        if (res.error) throw new Error(res.error);
        setSuccessMsg("Password reset email sent! Check your inbox.");
      } else if (mode === "signup") {
        const res = await signUpWithPassword(email, password, onboarding);
        if (res.error) throw new Error(res.error);
        if (res.requiresEmailConfirmation) {
          setEmailConfirmationRequired(true);
          setSuccessMsg("Registration initiated! Supabase requires email confirmation. Please check your inbox and verify your email before signing in.");
        } else {
          setSuccessMsg("Account registered successfully! Entering risk console...");
          setTimeout(() => onSuccess(), 1000);
        }
      } else {
        if (!email.trim() || !password) throw new Error("Please enter your email and password.");
        const res = await signInWithPassword(email, password);
        if (res.error) throw new Error(res.error);
        onSuccess();
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-screen"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 20%, #152238 0%, #0a0f1d 80%)",
        padding: "24px",
        color: "#e2e8f0",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: mode === "signup" && step === 2 ? "540px" : "440px",
          background: "rgba(18, 27, 45, 0.9)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(38, 52, 74, 0.8)",
          borderRadius: "16px",
          padding: "36px 32px",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
          transition: "all 0.25s ease",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(96, 165, 250, 0.2) 100%)",
              border: "1px solid rgba(34, 211, 238, 0.4)",
              color: "#22d3ee",
              marginBottom: "12px",
            }}
          >
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.5px" }}>
            Aegis<span style={{ color: "#22d3ee" }}>AI</span>
          </h1>
          <p
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              marginTop: "4px",
            }}
          >
            Financial Intelligence & Fraud Detection
          </p>
        </div>

        {/* Configuration Notice */}
        {!isConfigured && (
          <div
            style={{
              background: "rgba(251, 191, 36, 0.1)",
              border: "1px solid rgba(251, 191, 36, 0.3)",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "18px",
              fontSize: "11px",
              color: "#fbbf24",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={16} />
            <span>
              Supabase .env not configured. Add credentials to <code>.env.local</code> to authenticate against live
              PostgreSQL.
            </span>
          </div>
        )}

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div
            style={{
              background: "rgba(251, 113, 133, 0.1)",
              border: "1px solid rgba(251, 113, 133, 0.3)",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "18px",
              fontSize: "12px",
              color: "#fb7185",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: "rgba(52, 211, 153, 0.1)",
              border: "1px solid rgba(52, 211, 153, 0.3)",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "18px",
              fontSize: "12px",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 6px" }}>
            {mode === "forgot"
              ? "Recover Account Password"
              : mode === "signup"
              ? step === 1
                ? "Create Analyst Account"
                : "Step 2: Onboarding & Use-Case"
              : "Sign In to Risk Console"}
          </h2>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            {mode === "forgot"
              ? "Enter your verified work email to receive password reset link."
              : mode === "signup"
              ? step === 1
                ? "Enter your credentials to create a secure analyst workspace."
                : "Tell us about your organization and transaction monitoring goals."
              : "Access real-time transaction scoring, investigations, and models."}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* STEP 1: CREDENTIALS */}
          {(mode === "login" || mode === "forgot" || (mode === "signup" && step === 1)) && (
            <>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                  Work Email
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={16} style={{ position: "absolute", left: "12px", top: "11px", color: "#64748b" }} />
                  <input
                    type="email"
                    required
                    placeholder="analyst@aegisai.internal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                    style={{ width: "100%", paddingLeft: "36px" }}
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#cbd5e1" }}>Password</label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setErrorMsg(null);
                        }}
                        style={{ background: "transparent", border: 0, color: "#22d3ee", fontSize: "11px", cursor: "pointer", padding: 0 }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                    <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "12px", top: "11px", color: "#64748b" }} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field"
                      style={{ width: "100%", paddingLeft: "36px", paddingRight: "36px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "8px",
                        background: "transparent",
                        border: 0,
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && step === 1 && (
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "6px" }}>
                    Confirm Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={16} style={{ position: "absolute", left: "12px", top: "11px", color: "#64748b" }} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="field"
                      style={{ width: "100%", paddingLeft: "36px", paddingRight: "36px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "8px",
                        background: "transparent",
                        border: 0,
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: ONBOARDING USE-CASE METADATA */}
          {mode === "signup" && step === 2 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Full Name
                </label>
                <input
                  required
                  placeholder="Arjun Sharma"
                  value={onboarding.fullName}
                  onChange={(e) => setOnboarding({ ...onboarding, fullName: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Organization / Team
                </label>
                <input
                  required
                  placeholder="Fintech Risk Ops"
                  value={onboarding.organization}
                  onChange={(e) => setOnboarding({ ...onboarding, organization: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Job Role
                </label>
                <select
                  value={onboarding.jobTitle}
                  onChange={(e) => setOnboarding({ ...onboarding, jobTitle: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option>Fraud Analyst</option>
                  <option>Senior Risk Investigator</option>
                  <option>Compliance / Auditor</option>
                  <option>Security Engineer</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Operating Region
                </label>
                <select
                  value={onboarding.country}
                  onChange={(e) => setOnboarding({ ...onboarding, country: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option>India (INR)</option>
                  <option>United States (USD)</option>
                  <option>European Union (EUR)</option>
                  <option>Singapore (SGD)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Estimated Monthly Volume
                </label>
                <select
                  value={onboarding.volumeRange}
                  onChange={(e) => setOnboarding({ ...onboarding, volumeRange: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option>&lt; 10,000 txns / mo</option>
                  <option>10,000 - 100,000 / mo</option>
                  <option>100,000 - 1,000,000 / mo</option>
                  <option>&gt; 1,000,000 / mo</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Preferred Currency
                </label>
                <select
                  value={onboarding.currency || "INR"}
                  onChange={(e) => setOnboarding({ ...onboarding, currency: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Primary Objective
                </label>
                <select
                  value={onboarding.intendedUseCase}
                  onChange={(e) => setOnboarding({ ...onboarding, intendedUseCase: e.target.value })}
                  className="field"
                  style={{ width: "100%" }}
                >
                  <option>Real-Time Payment Fraud Prevention (UPI, Cards)</option>
                  <option>Fraud Ring & Multi-Hop Network Investigation</option>
                  <option>Model Drift & Disagreement Supervised Governance</option>
                  <option>Cost-Sensitive Decision Optimization</option>
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#cbd5e1", marginBottom: "4px" }}>
                  Initial Data Mode
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    ["synthetic", "Synthetic Data Sandbox"],
                    ["csv", "Upload Sample CSV"],
                  ].map(([val, label]) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => setOnboarding({ ...onboarding, initialDataMode: val as any })}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: onboarding.initialDataMode === val ? "#22d3ee" : "#26344a",
                        background: onboarding.initialDataMode === val ? "#14283b" : "#0d1424",
                        color: onboarding.initialDataMode === val ? "#22d3ee" : "#94a3b8",
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ marginTop: "8px" }}>
            <button
              type="submit"
              disabled={loading}
              className="btn primary"
              style={{ width: "100%", justifyContent: "center", height: "40px", fontSize: "13px" }}
            >
              {loading
                ? "Processing..."
                : mode === "forgot"
                ? "Send Reset Link"
                : mode === "signup"
                ? step === 1
                  ? "Continue to Step 2 →"
                  : "Complete Registration & Enter Console"
                : "Sign In"}
            </button>

            {mode === "signup" && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#94a3b8",
                  fontSize: "11px",
                  cursor: "pointer",
                  width: "100%",
                  marginTop: "8px",
                  textAlign: "center",
                }}
              >
                ← Back to credentials
              </button>
            )}
          </div>
        </form>

        {/* Mode Switcher */}
        <div style={{ marginTop: "22px", textAlign: "center", borderTop: "1px solid #1e293b", paddingTop: "16px" }}>
          {mode === "login" ? (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
              Need an analyst account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setStep(1);
                  setErrorMsg(null);
                }}
                style={{ background: "transparent", border: 0, color: "#22d3ee", cursor: "pointer", fontWeight: 600, padding: 0 }}
              >
                Register now
              </button>
            </p>
          ) : (
            <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
              Already registered?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setStep(1);
                  setErrorMsg(null);
                }}
                style={{ background: "transparent", border: 0, color: "#22d3ee", cursor: "pointer", fontWeight: 600, padding: 0 }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>

        {/* Security Notice */}
        <div
          style={{
            marginTop: "16px",
            padding: "8px 10px",
            background: "#0c1322",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "10px",
            color: "#64748b",
          }}
        >
          <UserCheck size={14} color="#22d3ee" />
          <span>Registrations receive least-privilege default roles. Admins are provisioned via verified SQL bootstrap.</span>
        </div>

        {/* Separately labeled demo entry point only when Supabase is not configured */}
        {!isConfigured && (
          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                if (enterSandboxDemo) {
                  enterSandboxDemo();
                  onSuccess();
                }
              }}
              style={{
                background: "rgba(34, 211, 238, 0.08)",
                border: "1px dashed rgba(34, 211, 238, 0.3)",
                color: "#22d3ee",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "11px",
                cursor: "pointer",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <Database size={13} />
              <span>Explore Offline Simulation Mode (Demo Only)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

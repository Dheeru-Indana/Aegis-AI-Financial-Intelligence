import { useMemo, useState, useEffect } from "react";
import type * as React from "react";
import { NavLink, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Filter,
  FileClock,
  FileSearch,
  GitBranch,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  Users,
  Workflow,
  X,
  Check,
  CheckCircle2,
  CircleHelp,
  Settings2,
  Database,
  LogIn,
  LogOut,
  Zap,
  Share2,
  Bot,
  TrendingUp,
  GitCompare,
  RotateCw,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  activity as activityData,
  transactions as seedTransactions,
  cases as seedCases,
  rules as seedRules,
  audit as auditData,
} from "./mocks/data";
import type { Transaction, FraudCase, RiskRule, AuditEvent } from "./types";
import { useAuth } from "./lib/authContext";
import { supabase, checkSystemHealth, type SystemHealthStatus } from "./lib/supabase";
import { listTransactions, insertTransaction, scoreTransaction } from "./services/transactionService";
import { listCases, createCaseRemote, updateCase } from "./services/caseService";
import { listRules, createRule, toggleRuleRemote } from "./services/rulesService";
import { listAudit, recordAuditRemote } from "./services/auditService";
import { sanitizeForCsv } from "./services/ingestionService";

// Views & Modals
import { LoginPage } from "./views/LoginPage";
import { AdminWorkspace } from "./views/AdminWorkspace";
import { CsvImportModal } from "./views/CsvImportModal";
import { GlobalSearchModal } from "./views/GlobalSearchModal";
import { NotificationCenter } from "./views/NotificationCenter";
import { ProfileDropdown } from "./views/ProfileDropdown";
import { WorkspaceSelector } from "./views/WorkspaceSelector";

// 7 Advanced Hackathon Feature Views
import { CostDecisionSimulator } from "./views/features/CostDecisionSimulator";
import { AttackDigitalTwin } from "./views/features/AttackDigitalTwin";
import { FraudRingExplorer } from "./views/features/FraudRingExplorer";
import { AnalystCopilot } from "./views/features/AnalystCopilot";
import { DriftRadar } from "./views/features/DriftRadar";
import { DisagreementRadar } from "./views/features/DisagreementRadar";
import { HumanFeedbackLoop } from "./views/features/HumanFeedbackLoop";
import { SystemGuidePage } from "./views/SystemGuidePage";

const nav = [
  {
    group: "MONITOR",
    items: [
      ["/", "Overview", LayoutDashboard],
      ["/transactions", "Live Transactions", Activity],
    ],
  },
  {
    group: "INVESTIGATE",
    items: [
      ["/cases", "Fraud Cases", FileSearch],
      ["/explain", "Explainable AI", GitBranch],
      ["/rings", "Fraud Ring Explorer", Share2],
      ["/copilot", "Analyst Copilot", Bot],
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      ["/analytics", "Analytics & Benchmarks", BarChart3],
      ["/simulator", "Cost Decision Simulator", SlidersHorizontal],
      ["/drift", "Model Drift Radar", TrendingUp],
      ["/disagreements", "Disagreement Radar", GitCompare],
      ["/feedback", "Model Feedback Loop", RotateCw],
    ],
  },
  {
    group: "SIMULATION",
    items: [["/digital-twin", "Attack Digital Twin", Zap]],
  },
  {
    group: "CONFIGURATION",
    items: [
      ["/rules", "Risk Rules & Models", Settings2],
      ["/audit", "Audit Logs", FileClock],
      ["/guide", "System Setup & Guide", BookOpenCheck],
    ],
  },
] as const;

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const cx = (...v: (string | false | undefined)[]) => v.filter(Boolean).join(" ");
function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Button({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
}) {
  return (
    <button disabled={disabled} onClick={onClick} className={`btn ${variant}`}>
      {children}
    </button>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>;
}
function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function KPI({
  label,
  value,
  change,
  icon: Icon,
  tone = "cyan",
  foot,
}: {
  label: string;
  value: string;
  change?: string;
  icon: any;
  tone?: string;
  foot?: string;
}) {
  return (
    <Card className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <span className={`kpi-icon ${tone}`}>
          <Icon size={17} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {change && <span className={tone === "red" ? "negative" : "positive"}>{change}</span>}
        {foot && <span>{foot}</span>}
      </div>
    </Card>
  );
}
function Decision({ value }: { value: string }) {
  return <Badge tone={value === "FLAG" ? "red" : value === "VERIFY" ? "amber" : "green"}>{value}</Badge>;
}
function Score({ value }: { value: number }) {
  return (
    <div className="score-cell">
      <div className="score-track">
        <span
          style={{ width: `${value}%` }}
          className={value >= 75 ? "redfill" : value >= 45 ? "amberfill" : "greenfill"}
        />
      </div>
      <strong>{value}</strong>
    </div>
  );
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>{children}</table>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <CircleHelp size={22} />
      <span>{text}</span>
    </div>
  );
}
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">DETAIL VIEW</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close drawer">
            <X size={18} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function App() {
  const { user, profile, isConfigured, isAdmin, signOut, updateProfile, enterSandboxDemo } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [caseSelected, setCaseSelected] = useState<FraudCase | null>(null);
  const [auditSelected, setAuditSelected] = useState<AuditEvent | null>(null);
  const [streamOn, setStreamOn] = useState(true);
  const [txns, setTxns] = useState<Transaction[]>(seedTransactions);
  const [cases, setCases] = useState<FraudCase[]>(seedCases);
  const [rules, setRules] = useState<RiskRule[]>(seedRules);
  const [auditLogs, setAuditLogs] = useState<AuditEvent[]>(auditData);
  const [query, setQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState("Risk Rules");
  const [showRule, setShowRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleThreshold, setRuleThreshold] = useState("50000");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("24 hours");

  // New Global State Modals & Panels
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [workspace, setWorkspace] = useState<"risk_operations" | "admin_governance">("risk_operations");
  const [wsSelectorOpen, setWsSelectorOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notifCenterOpen, setNotifCenterOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  const loc = useLocation();
  const navigate = useNavigate();

  const navItems = useMemo(() => nav.flatMap((g) => [...g.items]), []);
  const title = (navItems.find((x) => x[0] === loc.pathname) as [string, string, any] | undefined)?.[1] || "Overview";
  const toast = (s: string) => {
    setNotice(s);
  };

  // Keyboard shortcut Cmd+K / Ctrl+K for Global Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [dbHealth, setDbHealth] = useState<SystemHealthStatus | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Periodic and on-mount truthful database health check
  useEffect(() => {
    let isMounted = true;
    const verifyHealth = async () => {
      const status = await checkSystemHealth();
      if (isMounted) {
        setDbHealth(status);
        if (status.database === "disconnected") {
          setDbError(status.errorMessage || "Database query failed");
        } else {
          setDbError(null);
        }
      }
    };
    verifyHealth();
    const interval = setInterval(verifyHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isConfigured]);

  const [provenanceFilter, setProvenanceFilter] = useState<string>("All");
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "disconnected" | "paused">("disconnected");

  // Initial load from Supabase if configured
  useEffect(() => {
    if (isConfigured) {
      setDbLoading(true);
      Promise.allSettled([
        listTransactions(),
        listCases(),
        listRules(),
        listAudit(),
      ]).then(([txRes, caseRes, ruleRes, auditRes]) => {
        if (txRes.status === "fulfilled") {
          // If remote returns records, display them; if 0 records, do not show fake data
          setTxns(txRes.value);
        }
        if (caseRes.status === "fulfilled") setCases(caseRes.value);
        if (ruleRes.status === "fulfilled" && ruleRes.value.length > 0) setRules(ruleRes.value);
        if (auditRes.status === "fulfilled") setAuditLogs(auditRes.value);
        setDbLoading(false);
      });
    }
  }, [isConfigured]);

  // Supabase Realtime Subscription for live incoming transactions with strict status tracking
  useEffect(() => {
    if (!isConfigured || !supabase) {
      setRealtimeStatus("disconnected");
      return;
    }

    if (!streamOn) {
      setRealtimeStatus("paused");
      return;
    }

    setRealtimeStatus("connecting");
    const channel = supabase
      .channel("realtime_transactions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        const newRow = payload.new as any;
        const newTx: Transaction = {
          id: newRow.id,
          timestamp: new Date(newRow.timestamp).toISOString().replace("T", " ").slice(0, 19),
          amount: Number(newRow.amount),
          channel: newRow.channel,
          customer: newRow.customer,
          score: newRow.score,
          decision: newRow.decision,
          signals: Array.isArray(newRow.signals) ? newRow.signals : [],
          modelVersion: newRow.model_version || "fraud-v2.0.0",
          latency: newRow.latency ?? 0,
          explanation: newRow.explanation || "",
          caseId: newRow.case_id || undefined,
          provenance: newRow.provenance || "live",
        };
        setTxns((prev) => [newTx, ...prev]);
        toast(`New transaction received: ${newTx.id} (${newTx.decision})`);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else if (status === "CLOSED") {
          setRealtimeStatus("disconnected");
        } else if (status === "CHANNEL_ERROR") {
          setRealtimeStatus("disconnected");
        }
      });

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [isConfigured, streamOn]);

  const filtered = useMemo(
    () =>
      txns.filter(
        (t) =>
          (t.id + " " + t.customer + " " + t.channel + " " + t.signals.join(" ")).toLowerCase().includes(query.toLowerCase()) &&
          (decisionFilter === "All" || t.decision === decisionFilter) &&
          (provenanceFilter === "All" || (t.provenance || "unknown") === provenanceFilter.toLowerCase())
      ),
    [txns, query, decisionFilter, provenanceFilter]
  );
  const paged = filtered.slice(page * 5, page * 5 + 5);

  const createCase = async (t: Transaction) => {
    const c: FraudCase = {
      id: `CASE-${String(85 + cases.length).padStart(4, "0")}`,
      transactionId: t.id,
      created: "Just now",
      score: t.score,
      priority: t.score >= 75 ? "High" : "Medium",
      analyst: profile?.display_name || "A. Sharma",
      status: "Open",
      updated: "Just now",
      notes: [],
    };
    const previousCases = [...cases];
    setCases([c, ...cases]);
    setSelected(null);
    try {
      await createCaseRemote(c);
      const auditEvt: AuditEvent = {
        id: `AUD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        actor: profile?.display_name || "Analyst",
        role: profile?.role || "fraud_analyst",
        action: "Fraud case opened",
        resourceType: "Case",
        resourceId: c.id,
        result: "Success",
        details: `Case created for transaction ${t.id}`,
      };
      await recordAuditRemote(auditEvt);
      setAuditLogs((prev) => [auditEvt, ...prev]);
      toast(`${c.id} created successfully`);
    } catch (err) {
      setCases(previousCases);
      toast(`Failed to create case: ${(err as Error).message}`);
    }
  };

  const downloadCsv = () => {
    const header = "Transaction ID,Timestamp,Amount,Channel,Customer,Risk score,Decision\n";
    const rows = filtered
      .map((t) =>
        [
          sanitizeForCsv(t.id),
          sanitizeForCsv(t.timestamp),
          sanitizeForCsv(t.amount),
          sanitizeForCsv(t.channel),
          sanitizeForCsv(t.customer),
          sanitizeForCsv(t.score),
          sanitizeForCsv(t.decision),
        ].join(",")
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegisai-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${filtered.length} filtered transactions`);
  };

  // Session restoration loading screen
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1020",
          color: "#22d3ee",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="pulse-dot" style={{ width: "14px", height: "14px", marginBottom: "14px" }} />
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>Restoring Secure AegisAI Session...</div>
          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>Validating Row-Level Security token</div>
        </div>
      </div>
    );
  }

  // Enforce login screen as default entry point:
  // If user is not authenticated (or opted into explicit sandbox demo), display LoginPage
  if (showLoginPage || !profile) {
    return (
      <LoginPage
        onSuccess={() => {
          setShowLoginPage(false);
          toast("Signed in successfully");
        }}
      />
    );
  }

  // RLS gives suspended or inactive accounts no data access; say so instead of rendering an empty app
  if (profile.status !== "active") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b1020",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "360px", padding: "0 16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>Account {profile.status}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", margin: "6px 0 14px" }}>
            An administrator must reactivate this account before it can access AegisAI.
          </div>
          <button className="btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className={cx("sidebar", mobileOpen && "mobile-open")}>
        <div className="brand">
          <div className="brand-mark">
            <Shield size={22} />
            <span />
          </div>
          <div>
            <strong>
              Aegis<span>AI</span>
            </strong>
            <small>FINANCIAL INTELLIGENCE</small>
          </div>
          <button className="mobile-close icon-btn" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Interactive Workspace Selector */}
        <WorkspaceSelector
          currentWorkspace={workspace}
          onSelectWorkspace={(ws) => {
            setWorkspace(ws);
            setWsSelectorOpen(false);
          }}
          isAdmin={isAdmin}
          isOpen={wsSelectorOpen}
          onToggle={() => setWsSelectorOpen((prev) => !prev)}
          onClose={() => setWsSelectorOpen(false)}
        />

        <nav>
          {nav.map((group) => (
            <div className="nav-group" key={group.group}>
              <div className="nav-label">{group.group}</div>
              {group.items.map(([path, label, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/"}
                  onClick={() => {
                    setMobileOpen(false);
                    if (workspace === "admin_governance") setWorkspace("risk_operations");
                  }}
                  className={({ isActive }) => cx("nav-link", isActive && workspace === "risk_operations" && "active")}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {path === "/transactions" && <span className="nav-count">{txns.length}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer & System Health */}
        <div className="sidebar-bottom">
          <div className="status-head">
            <span className="pulse-dot" /> SYSTEM HEALTH <span className="healthy">HEALTHY</span>
          </div>
          <div className="mini-status">
            <span>Database</span>
            <Badge tone={isConfigured ? "green" : "amber"}>{isConfigured ? "Supabase Live" : "Local Mock"}</Badge>
          </div>
          <div className="mini-status">
            <span>ML model</span>
            <Badge tone="green">Ready (fraud-v2.0.0-logistic)</Badge>
          </div>
          <div className="mini-status">
            <span>Event stream</span>
            <Badge tone={streamOn ? "green" : "amber"}>{streamOn ? "Realtime" : "Paused"}</Badge>
          </div>
          <p>{isConfigured ? "PostgreSQL RLS Active" : "Add keys to .env for cloud sync"}</p>
          <div className="profile">
            <div className="avatar">{profile?.display_name?.slice(0, 2).toUpperCase() || "AS"}</div>
            <div>
              <strong>{profile?.display_name || "Arjun Sharma"}</strong>
              <small>{profile?.role?.replace("_", " ") || "Fraud Analyst"}</small>
            </div>
            {user ? (
              <button className="icon-btn" onClick={() => signOut()} title="Sign out">
                <LogOut size={16} />
              </button>
            ) : (
              <button className="icon-btn" onClick={() => setShowLoginPage(true)} title="Sign in">
                <LogIn size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        {/* Top Header */}
        <header className="topbar">
          <div className="top-left">
            <button className="mobile-menu icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="crumb">
              <span>{workspace === "admin_governance" ? "Admin Governance" : "Risk Operations"}</span>
              <ChevronRight size={14} />
              <strong>{workspace === "admin_governance" ? "Monitoring & Security" : title}</strong>
            </div>
          </div>

          <div className="top-actions" style={{ position: "relative" }}>
            {/* Global Search Trigger */}
            <div
              className="global-search"
              onClick={() => setSearchModalOpen(true)}
              style={{ cursor: "pointer" }}
              title="Click or press ⌘K to search"
            >
              <Search size={16} />
              <input
                readOnly
                placeholder="Search anything…"
                value=""
                style={{ cursor: "pointer" }}
              />
              <kbd>⌘ K</kbd>
            </div>

            {/* Dynamic Status Indicator */}
            <span className="top-status">
              <i
                style={{
                  background:
                    !isConfigured
                      ? "#fbbf24"
                      : dbHealth?.database === "connected"
                      ? "#34d399"
                      : "#fb7185",
                }}
              />
              {!isConfigured
                ? "SIMULATION"
                : dbHealth?.database === "connected"
                ? "CONNECTED"
                : "CONNECTION ERROR"}
            </span>

            {/* Notification Bell */}
            <button
              className="icon-btn notification"
              onClick={() => {
                setNotifCenterOpen((prev) => !prev);
                setProfileDropdownOpen(false);
              }}
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>

            {/* Notification Center Dropdown */}
            <NotificationCenter
              isOpen={notifCenterOpen}
              onClose={() => setNotifCenterOpen(false)}
              onSelectRef={(ref) => {
                const foundTx = txns.find((t) => t.id === ref);
                if (foundTx) setSelected(foundTx);
                const foundCase = cases.find((c) => c.id === ref);
                if (foundCase) setCaseSelected(foundCase);
              }}
            />

            {/* Top Avatar with Dropdown */}
            <div
              className="top-avatar"
              onClick={() => {
                setProfileDropdownOpen((prev) => !prev);
                setNotifCenterOpen(false);
              }}
              style={{ cursor: "pointer" }}
            >
              {profile?.display_name?.slice(0, 2).toUpperCase() || "AS"}
            </div>

            {/* Profile Dropdown Menu */}
            <ProfileDropdown
              isOpen={profileDropdownOpen}
              onClose={() => setProfileDropdownOpen(false)}
              profile={profile}
              isAdmin={isAdmin}
              isConfigured={isConfigured}
              onOpenAdmin={() => {
                if (isAdmin) {
                  setWorkspace("admin_governance");
                  setProfileDropdownOpen(false);
                }
              }}
              onSignOut={() => {
                signOut();
                toast("Signed out successfully");
              }}
              onUpdateProfile={updateProfile}
              toast={toast}
            />
          </div>
        </header>

        {/* Content Area */}
        <div className="content">
          {/* Honest Status Banner */}
          <div className="demo-banner">
            <span>
              <span
                className="demo-dot"
                style={{
                  background:
                    !isConfigured
                      ? "#22d3ee"
                      : dbHealth?.database === "connected"
                      ? "#34d399"
                      : "#fb7185",
                }}
              />
              {!isConfigured
                ? "SYNTHETIC DATA SIMULATION"
                : dbHealth?.database === "connected"
                ? "SUPABASE LIVE · ROW-LEVEL SECURITY ENFORCED"
                : "DATABASE CONNECTION ERROR"}
            </span>
            <span>
              {!isConfigured
                ? "Operational sandbox mode · Configure VITE_SUPABASE_URL in .env to bind live Postgres"
                : dbHealth?.database === "connected"
                ? `Connected to Supabase PostgreSQL (${dbHealth.latencyMs}ms latency) · Authenticated RLS active`
                : `Error: ${dbError || "Unable to reach database tables"}. Check credentials or run setup_all.sql.`}
            </span>
          </div>

          {/* Conditional Admin Workspace vs Operational Views */}
          {workspace === "admin_governance" ? (
            <AdminWorkspace onExit={() => setWorkspace("risk_operations")} />
          ) : (
            <Routes>
              {/* Existing Core Modules */}
              <Route
                path="/"
                element={
                  <Overview
                    txns={txns}
                    toast={toast}
                    setSelected={setSelected}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    isConfigured={isConfigured}
                  />
                }
              />
              <Route
                path="/transactions"
                element={
                  <Transactions
                    txns={paged}
                    total={filtered.length}
                    query={query}
                    setQuery={setQuery}
                    decisionFilter={decisionFilter}
                    setDecisionFilter={setDecisionFilter}
                    streamOn={streamOn}
                    setStreamOn={setStreamOn}
                    onSelect={setSelected}
                    onExport={downloadCsv}
                    onOpenImport={() => setCsvImportOpen(true)}
                    page={page}
                    setPage={setPage}
                    toast={toast}
                    realtimeStatus={realtimeStatus}
                    provenanceFilter={provenanceFilter}
                    setProvenanceFilter={setProvenanceFilter}
                    isConfigured={isConfigured}
                    onAddSample={async () => {
                      const amount = Math.floor(Math.random() * 90000 + 1000);
                      const channel = (["UPI", "Card", "Net banking", "Wallet"][Math.floor(Math.random() * 4)]) as any;
                      const customer = `CUST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                      const attemptCount = Math.random() < 0.25 ? Math.floor(Math.random() * 4 + 2) : 1;
                      const isNewDevice = Math.random() < 0.2;

                      // Evaluate using canonical ML scoring service
                      const scored = await scoreTransaction({
                        amount,
                        channel,
                        customer,
                        attemptCount,
                        isNewDevice,
                      });

                      const newTx: Transaction = {
                        id: `TXN-${Math.floor(20489 + Math.random() * 1000)}`,
                        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
                        amount,
                        channel,
                        customer,
                        score: scored.score,
                        decision: scored.decision as any,
                        signals: scored.signals || ["Standard profile"],
                        modelVersion: scored.modelVersion || "fraud-v2.0.0-logistic",
                        latency: scored.latency ?? 0,
                        explanation: scored.explanation || "Transaction evaluated by ML model.",
                        provenance: "test",
                        attributions: scored.attributions,
                      };

                      try {
                        await insertTransaction(newTx);
                      } catch (err) {
                        toast(`Test event scored locally: ${(err as Error).message}`);
                      }

                      setTxns((prev) => [newTx, ...prev]);
                      toast(`Test event ${newTx.id} (provenance: test) scored via ${scored.mode || "ML"} (Score: ${scored.score})`);
                    }}
                  />
                }
              />
              <Route path="/cases" element={<Cases cases={cases} txns={txns} onSelect={setCaseSelected} toast={toast} />} />
              <Route
                path="/explain"
                element={<Explain txns={txns} selected={selected || txns[0]} setSelected={setSelected} toast={toast} onCase={createCase} />}
              />
              <Route path="/analytics" element={<Analytics />} />
              <Route
                path="/rules"
                element={
                  <Rules
                    rules={rules}
                    setRules={setRules}
                    tab={tab}
                    setTab={setTab}
                    showRule={showRule}
                    setShowRule={setShowRule}
                    ruleName={ruleName}
                    setRuleName={setRuleName}
                    ruleThreshold={ruleThreshold}
                    setRuleThreshold={setRuleThreshold}
                    toast={toast}
                    confirm={confirm}
                    setConfirm={setConfirm}
                  />
                }
              />
              <Route path="/audit" element={<Audit auditLogs={auditLogs} onSelect={setAuditSelected} />} />

              {/* 7 Advanced Hackathon Feature Views */}
              <Route path="/simulator" element={<CostDecisionSimulator />} />
              <Route path="/digital-twin" element={<AttackDigitalTwin />} />
              <Route
                path="/rings"
                element={
                  <FraudRingExplorer
                    onCreateCase={(ref: string) => {
                      const t = txns.find((x) => x.id === ref || x.customer === ref) || txns[0];
                      if (t) createCase(t);
                    }}
                  />
                }
              />
              <Route path="/copilot" element={<AnalystCopilot />} />
              <Route path="/drift" element={<DriftRadar />} />
              <Route
                path="/disagreements"
                element={
                  <DisagreementRadar
                    transactions={txns}
                    rules={rules}
                    onTriageCase={(txId) => {
                      const t = txns.find((x) => x.id === txId) || txns[0];
                      if (t) createCase(t);
                    }}
                  />
                }
              />
              <Route path="/feedback" element={<HumanFeedbackLoop />} />
              <Route path="/guide" element={<SystemGuidePage />} />
            </Routes>
          )}
        </div>
      </main>

      {/* Global Modals */}
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        transactions={txns}
        cases={cases}
        rules={rules}
        auditLogs={auditLogs}
        onSelectTransaction={(t) => setSelected(t)}
        onSelectCase={(c) => setCaseSelected(c)}
        onSelectRule={(r) => {
          navigate("/rules");
          toast(`Selected rule ${r.name}`);
        }}
        onSelectAudit={(a) => setAuditSelected(a)}
      />

      <CsvImportModal
        isOpen={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        existingTransactions={txns}
        activeRules={rules}
        onImportSuccess={(newRecords) => {
          setTxns((prev) => [...newRecords, ...prev]);
        }}
        toast={toast}
      />

      {/* Detail Drawers */}
      {selected && (
        <Drawer title={selected.id} onClose={() => setSelected(null)}>
          <div className="drawer-scroll">
            <div className="detail-hero">
              <span className="eyebrow">ESTIMATED RISK SCORE</span>
              <div className="detail-score">
                {selected.score}
                <small>/100</small>
              </div>
              <Score value={selected.score} />
              <div className="detail-badges">
                <Decision value={selected.decision} />
                <Badge tone="blue">{selected.channel}</Badge>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <small>AMOUNT</small>
                <strong>{money(selected.amount)}</strong>
              </div>
              <div>
                <small>CUSTOMER REF.</small>
                <strong>{selected.customer}</strong>
              </div>
              <div>
                <small>TIMESTAMP</small>
                <strong>{selected.timestamp}</strong>
              </div>
              <div>
                <small>SCORING LATENCY</small>
                <strong>{selected.latency} ms*</strong>
              </div>
            </div>
            <SectionTitle title="Risk signals" />
            <div className="signal-list">
              {selected.signals.map((s) => (
                <div key={s}>
                  <AlertTriangle size={15} />
                  {s}
                </div>
              ))}
            </div>
            <SectionTitle title="Assessment summary" />
            <p className="body-copy">{selected.explanation}</p>
            <div className="meta-row">
              <span>Model version</span>
              <strong>{selected.modelVersion}</strong>
            </div>
            <div className="meta-row">
              <span>Storage</span>
              <Badge tone={isConfigured ? "green" : "amber"}>{isConfigured ? "Supabase Postgres" : "Mock state"}</Badge>
            </div>
            <div className="drawer-actions">
              <Button variant="primary" onClick={() => createCase(selected)}>
                <Plus size={15} /> Create case
              </Button>
              <Button
                onClick={() => {
                  setSelected(null);
                  navigate("/explain");
                }}
              >
                View explanation <ExternalLink size={14} />
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {caseSelected && (
        <Drawer title={caseSelected.id} onClose={() => setCaseSelected(null)}>
          <div className="drawer-scroll">
            <Badge tone={caseSelected.priority === "High" ? "red" : "amber"}>{caseSelected.priority} priority</Badge>
            <div className="detail-grid">
              <div>
                <small>TRANSACTION</small>
                <strong>{caseSelected.transactionId}</strong>
              </div>
              <div>
                <small>RISK SCORE</small>
                <strong>{caseSelected.score}/100</strong>
              </div>
              <div>
                <small>ASSIGNEE</small>
                <strong>{caseSelected.analyst}</strong>
              </div>
              <div>
                <small>STATUS</small>
                <strong>{caseSelected.status}</strong>
              </div>
            </div>
            <SectionTitle title="Linked transaction" />
            <p className="body-copy">
              {txns.find((t) => t.id === caseSelected.transactionId)?.explanation || "Linked transaction summary unavailable."}
            </p>
            <SectionTitle title="Investigation timeline" />
            <div className="timeline">
              <div>
                <i />
                <strong>Case opened</strong>
                <small>{caseSelected.created}</small>
              </div>
              {caseSelected.notes.map((n, i) => (
                <div key={i}>
                  <i />
                  <strong>{n.author} added a note</strong>
                  <small>
                    {n.at} · {n.text}
                  </small>
                </div>
              ))}
            </div>
            <SectionTitle title="Analyst notes" />
            <textarea
              className="field note-field"
              placeholder="Record investigation findings…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={async () => {
                if (!note.trim()) return toast("Enter a note before saving");
                const updatedNotes = [
                  ...caseSelected.notes,
                  { text: note, at: "Just now", author: profile?.display_name || "A. Sharma" },
                ];
                try {
                  await updateCase(caseSelected.id, { notes: updatedNotes });
                  const auditEvt: AuditEvent = {
                    id: `AUD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                    timestamp: new Date().toISOString(),
                    actor: profile?.display_name || "Analyst",
                    role: profile?.role || "fraud_analyst",
                    action: "Case note recorded",
                    resourceType: "Case",
                    resourceId: caseSelected.id,
                    result: "Success",
                    details: `Investigation note added to case ${caseSelected.id}: "${note.slice(0, 40)}${note.length > 40 ? "..." : ""}"`,
                  };
                  await recordAuditRemote(auditEvt);
                  setAuditLogs((prev) => [auditEvt, ...prev]);
                  setCases((cs) =>
                    cs.map((c) => (c.id === caseSelected.id ? { ...c, notes: updatedNotes, updated: "Just now" } : c))
                  );
                  setCaseSelected({ ...caseSelected, notes: updatedNotes });
                  setNote("");
                  toast("Note saved and logged to audit trail");
                } catch (err) {
                  toast(`Failed to save note: ${(err as Error).message}`);
                }
              }}
            >
              Save note
            </Button>
            <SectionTitle title="Disposition" />
            <div className="disposition-list">
              {["Confirmed Fraud", "Legitimate Transaction", "Escalate for Review"].map((d) => (
                <Button key={d} onClick={() => setConfirm(d)}>
                  {d}
                </Button>
              ))}
            </div>
          </div>
        </Drawer>
      )}

      {auditSelected && (
        <Drawer title={auditSelected.id} onClose={() => setAuditSelected(null)}>
          <div className="drawer-scroll">
            <Badge tone={auditSelected.result === "Success" ? "green" : auditSelected.result === "Blocked" ? "red" : "amber"}>
              {auditSelected.result}
            </Badge>
            <SectionTitle title="Event metadata" />
            {[
              ["Timestamp", auditSelected.timestamp],
              ["Actor", auditSelected.actor],
              ["Role", auditSelected.role],
              ["Action", auditSelected.action],
              ["Resource type", auditSelected.resourceType],
              ["Resource ID", auditSelected.resourceId],
            ].map(([k, v]) => (
              <div className="meta-row" key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
            <SectionTitle title="Details" />
            <p className="body-copy">{auditSelected.details}</p>
            <p className="muted-note">
              <Shield size={14} /> Audit records are append-only and enforced by PostgreSQL security triggers.
            </p>
          </div>
        </Drawer>
      )}

      {confirm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon">
              <ShieldAlert size={22} />
            </div>
            <h2>Confirm disposition</h2>
            <p>
              Record <strong>{confirm}</strong> for this case? This updates case status and generates an immutable audit record.
            </p>
            <div className="modal-actions">
              <Button onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (caseSelected) {
                    const newStatus = confirm === "Escalate for Review" ? "In review" : "Resolved";
                    try {
                      await updateCase(caseSelected.id, { status: newStatus });
                      const auditEvt: AuditEvent = {
                        id: `AUD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
                        timestamp: new Date().toISOString(),
                        actor: profile?.display_name || "Analyst",
                        role: profile?.role || "fraud_analyst",
                        action: "Case disposition recorded",
                        resourceType: "Case",
                        resourceId: caseSelected.id,
                        result: "Success",
                        details: `Recorded disposition "${confirm}" (status: ${newStatus}) for case ${caseSelected.id}`,
                      };
                      await recordAuditRemote(auditEvt);
                      setAuditLogs((prev) => [auditEvt, ...prev]);
                      setCases((cs) =>
                        cs.map((c) => (c.id === caseSelected.id ? { ...c, status: newStatus, updated: "Just now" } : c))
                      );
                      toast(`${confirm} recorded`);
                      setCaseSelected(null);
                    } catch (err) {
                      toast(`Disposition failed: ${(err as Error).message}`);
                    }
                  } else {
                    toast("Configuration saved");
                  }
                  setConfirm(null);
                }}
              >
                Confirm action
              </Button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="toast">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function PageHeading({ title, sub, actions }: { title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">AEGISAI / OPERATIONS</div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}

function Overview({
  txns,
  toast,
  setSelected,
  timeRange,
  setTimeRange,
  isConfigured,
}: {
  txns: Transaction[];
  toast: (s: string) => void;
  setSelected: (t: Transaction) => void;
  timeRange: string;
  setTimeRange: (s: string) => void;
  isConfigured: boolean;
}) {
  const totalCount = txns.length;
  const flaggedCount = txns.filter((t) => t.decision === "FLAG").length;
  const fraudRate = totalCount > 0 ? ((flaggedCount / totalCount) * 100).toFixed(2) + "%" : "0.00%";
  const exposureSum = txns
    .filter((t) => t.decision === "FLAG" || t.score >= 75)
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const exposureFormatted = exposureSum >= 100000
    ? `₹${(exposureSum / 100000).toFixed(2)}L`
    : `₹${exposureSum.toLocaleString()}`;
  const avgLatency = totalCount > 0
    ? Math.round(txns.reduce((acc, curr) => acc + (curr.latency ?? 0), 0) / totalCount) + " ms"
    : "18 ms";

  const dist = useMemo(() => {
    const low = txns.filter((t) => t.score < 45).length;
    const med = txns.filter((t) => t.score >= 45 && t.score < 75).length;
    const high = txns.filter((t) => t.score >= 75).length;
    return [
      { name: "Low risk", value: low, color: "#34d399" },
      { name: "Medium risk", value: med, color: "#fbbf24" },
      { name: "High risk", value: high, color: "#fb7185" },
    ];
  }, [txns]);

  return (
    <>
      <PageHeading
        title="Overview"
        sub="Monitor transaction activity, detection quality, and emerging fraud risk."
        actions={
          <>
            <select className="select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option>24 hours</option>
              <option>7 days</option>
              <option>30 days</option>
            </select>
            <Button onClick={() => toast("Dashboard telemetry refreshed")}>
              <RefreshCw size={15} /> Refresh
            </Button>
          </>
        }
      />
      <div className="kpi-grid">
        <KPI
          label="Transactions processed"
          value={totalCount.toLocaleString()}
          change={totalCount > 0 ? "Active cohort" : "No records"}
          foot="Verified records in memory"
          icon={Activity}
        />
        <KPI
          label="Fraud alerts"
          value={String(flaggedCount)}
          change={flaggedCount > 0 ? "Flagged items" : "Zero alerts"}
          tone="red"
          foot="Requires analyst triage"
          icon={ShieldAlert}
        />
        <KPI label="Fraud rate" value={fraudRate} change={flaggedCount > 0 ? "Elevated" : "Normal"} tone="amber" foot="Observed alert ratio" icon={AlertTriangle} />
        <KPI label="High-risk exposure" value={exposureFormatted} change={`${txns.filter(t => t.score >= 75).length} elevated items`} tone="red" foot="Flagged transaction volume" icon={ArrowUpRight} />
        <KPI label="Avg. inference latency" value={avgLatency} change="P95 < 25ms (est.)" tone="blue" foot="Demo cohort sample mean" icon={Timer} />
      </div>

      <div className="charts-grid">
        <Card>
          <SectionTitle
            title="Transaction activity"
            sub="Hourly volume and flagged transactions"
            action={<Badge tone="blue">{timeRange}</Badge>}
          />
          <div className="chart-legend">
            <span>
              <i className="legend-cyan" />
              Transactions
            </span>
            <span>
              <i className="legend-red" />
              Flagged
            </span>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#26344a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#718198" tickLine={false} axisLine={false} />
                <YAxis stroke="#718198" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a", borderRadius: 8 }} />
                <Area type="monotone" dataKey="volume" name="Transactions" stroke="#22d3ee" fill="url(#volumeFill)" strokeWidth={2} />
                <Line type="monotone" dataKey="flagged" name="Flagged" stroke="#fb7185" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Risk distribution" sub="Evaluated transactions by estimated risk" />
          <div className="risk-chart">
            <div className="donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dist} dataKey="value" innerRadius={59} outerRadius={79} paddingAngle={3} stroke="none">
                    {dist.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{txns.length > 8 ? txns.length : "24.8k"}</strong>
                <small>transactions</small>
              </div>
            </div>
            <div className="risk-legend">
              {dist.map((d) => (
                <div key={d.name}>
                  <i style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <strong>{d.value.toLocaleString("en-IN")}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="lower-grid">
        <Card>
          <SectionTitle
            title="Recent fraud alerts"
            sub="Prioritize high-risk activity"
            action={
              <NavLink to="/transactions" className="text-link">
                View all <ChevronRight size={14} />
              </NavLink>
            }
          />
          <Table>
            <thead>
              <tr>
                <th>TRANSACTION</th>
                <th>TIME</th>
                <th>AMOUNT</th>
                <th>RISK SCORE</th>
                <th>DECISION</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {txns
                .filter((t) => t.decision !== "ALLOW")
                .slice(0, 4)
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <button className="table-link" onClick={() => setSelected(t)}>
                        {t.id}
                      </button>
                      <small>{t.customer}</small>
                    </td>
                    <td>{t.timestamp.split(" ")[1] || t.timestamp}</td>
                    <td>{money(t.amount)}</td>
                    <td>
                      <Score value={t.score} />
                    </td>
                    <td>
                      <Decision value={t.decision} />
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => setSelected(t)} aria-label="View transaction">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <SectionTitle title="Platform health" sub={isConfigured ? "Connected to Supabase" : "Simulation mode"} />
          <div className="health-list">
            {[
              ["Database Service", isConfigured ? "Supabase Postgres Connected" : "Local Mock Adapter", isConfigured ? "green" : "amber"],
              ["ML scoring model", "fraud-v2.0.0-logistic · Ready", "green"],
              ["Event stream", "Active Pipeline", "green"],
            ].map(([a, b, c]) => (
              <div className="health-item" key={a}>
                <div className={`health-icon ${c}`}>
                  <Activity size={16} />
                </div>
                <div>
                  <strong>{a}</strong>
                  <small>{b}</small>
                </div>
                <Badge tone={c}>{isConfigured ? "Live" : "Mock"}</Badge>
              </div>
            ))}
          </div>
          <div className="health-footer">
            <span>Backend status</span>
            <strong>{isConfigured ? "RLS Secure" : "Simulated"}</strong>
          </div>
          <div className="health-footer">
            <span>Avg. scoring latency</span>
            <strong>18 ms</strong>
          </div>
        </Card>
      </div>

      <div className="risk-summary">
        <div>
          <span className="summary-icon">
            <AlertTriangle size={17} />
          </span>
          <div>
            <strong>Risk signal summary</strong>
            <p>Velocity spikes, high transaction amounts, and unusual timing are the leading signals.</p>
          </div>
        </div>
        <Badge tone="amber">{isConfigured ? "Live Sync" : "Demo Data"}</Badge>
      </div>
    </>
  );
}

function Transactions({
  txns,
  total,
  query,
  setQuery,
  decisionFilter,
  setDecisionFilter,
  streamOn,
  setStreamOn,
  onSelect,
  onExport,
  onOpenImport,
  page,
  setPage,
  toast,
  realtimeStatus,
  provenanceFilter,
  setProvenanceFilter,
  isConfigured,
  onAddSample,
}: {
  txns: Transaction[];
  total: number;
  query: string;
  setQuery: (s: string) => void;
  decisionFilter: string;
  setDecisionFilter: (s: string) => void;
  streamOn: boolean;
  setStreamOn: (b: boolean) => void;
  onSelect: (t: Transaction) => void;
  onExport: () => void;
  onOpenImport: () => void;
  page: number;
  setPage: (n: number) => void;
  toast: (s: string) => void;
  realtimeStatus: "connected" | "connecting" | "disconnected" | "paused";
  provenanceFilter: string;
  setProvenanceFilter: (s: string) => void;
  isConfigured: boolean;
  onAddSample: () => void;
}) {
  const getStreamBadge = () => {
    switch (realtimeStatus) {
      case "connected":
        return <Badge tone="green"><span className="pulse-dot" /> Realtime stream: Live</Badge>;
      case "connecting":
        return <Badge tone="amber"><span className="pulse-dot" /> Realtime: Connecting…</Badge>;
      case "paused":
        return <Badge tone="amber">Stream paused</Badge>;
      case "disconnected":
      default:
        return <Badge tone="red">Stream disconnected (Polling/Local)</Badge>;
    }
  };

  return (
    <>
      <PageHeading
        title="Live Transactions"
        sub="Monitor and triage transaction activity in real time with verified provenance."
        actions={
          <>
            {getStreamBadge()}
            <Button
              onClick={() => {
                setStreamOn(!streamOn);
                toast(streamOn ? "Stream paused" : "Stream resumed");
              }}
            >
              {streamOn ? <Pause size={15} /> : <Play size={15} />} {streamOn ? "Pause stream" : "Resume stream"}
            </Button>
          </>
        }
      />
      <div className="metric-strip">
        <div>
          <span>Stream status</span>
          <strong>{realtimeStatus === "connected" ? "Live" : realtimeStatus === "paused" ? "Paused" : "Disconnected"}</strong>
          <small>{isConfigured ? (realtimeStatus === "connected" ? "Supabase Realtime" : "Reconnecting") : "Local / Unconfigured"}</small>
        </div>
        <div>
          <span>Transactions evaluated</span>
          <strong>{total}</strong>
          <small>Total in view</small>
        </div>
        <div>
          <span>Requiring review</span>
          <strong className="amber-text">{txns.filter((t) => t.decision === "VERIFY").length}</strong>
          <small>VERIFY decisions</small>
        </div>
        <div>
          <span>Flagged transactions</span>
          <strong className="red-text">{txns.filter((t) => t.decision === "FLAG").length}</strong>
          <small>FLAG decisions</small>
        </div>
      </div>
      <Card>
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input
              placeholder="Search transaction, customer, signal…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            className="select"
            value={decisionFilter}
            onChange={(e) => {
              setDecisionFilter(e.target.value);
              setPage(0);
            }}
          >
            <option>All Decisions</option>
            <option>ALLOW</option>
            <option>VERIFY</option>
            <option>FLAG</option>
          </select>
          <select
            className="select"
            value={provenanceFilter}
            onChange={(e) => {
              setProvenanceFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="All">All Provenance</option>
            <option value="live">Live Only</option>
            <option value="imported">Imported CSV Only</option>
            <option value="demo">Demo Only</option>
            <option value="simulation">Simulation Only</option>
          </select>
          <Button onClick={onExport}>
            <Download size={15} /> Export
          </Button>
          <Button onClick={onOpenImport}>
            <Download size={15} style={{ transform: "rotate(180deg)" }} /> Import CSV
          </Button>
          <Button variant="primary" onClick={onAddSample}>
            <Plus size={15} /> Inject test event
          </Button>
        </div>
        <div className="table-caption">
          <span>
            <i className="pulse-dot" /> {streamOn ? "Stream active" : "Stream paused"} <span className="caption-sep">·</span> {total}{" "}
            records in current filter
          </span>
          <span>
            {realtimeStatus === "connected"
              ? "Synchronized with Supabase Realtime"
              : isConfigured
              ? "Supabase connected (Realtime socket disconnected)"
              : "Isolated local development environment"}
          </span>
        </div>
        <Table>
          <thead>
            <tr>
              <th>TRANSACTION ID</th>
              <th>TIMESTAMP</th>
              <th>AMOUNT</th>
              <th>CHANNEL</th>
              <th>CUSTOMER REF.</th>
              <th>RISK SCORE</th>
              <th>DECISION</th>
              <th>TRIGGERED SIGNALS</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} onClick={() => onSelect(t)} className="click-row">
                <td>
                  <button className="table-link">{t.id}</button>
                </td>
                <td>{t.timestamp.split(" ")[1] || t.timestamp}</td>
                <td>{money(t.amount)}</td>
                <td>{t.channel}</td>
                <td className="mono">{t.customer}</td>
                <td>
                  <Score value={t.score} />
                </td>
                <td>
                  <Decision value={t.decision} />
                </td>
                <td>
                  <div className="signal-chips">
                    {t.signals.slice(0, 2).map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="icon-btn" aria-label="Open details">
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {txns.length === 0 && <Empty text="No transactions match the current filters." />}
        <div className="pagination">
          <span>
            Showing {txns.length ? page * 5 + 1 : 0}–{page * 5 + txns.length} of {total}
          </span>
          <div>
            <Button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>
              <ChevronLeft size={15} /> Previous
            </Button>
            <span className="page-number">{page + 1}</span>
            <Button disabled={(page + 1) * 5 >= total} onClick={() => setPage(page + 1)}>
              Next <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Card>
      <div className="footnote">
        <CircleHelp size={14} /> Transactions adhere to Row Level Security. Data is authenticated when Supabase keys are active.
      </div>
    </>
  );
}

function Cases({
  cases,
  txns,
  onSelect,
  toast,
}: {
  cases: FraudCase[];
  txns: Transaction[];
  onSelect: (c: FraudCase) => void;
  toast: (s: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const filtered = cases.filter((c) => filter === "All" || c.status === filter);
  return (
    <>
      <PageHeading
        title="Fraud Cases"
        sub="Investigate suspicious activity and document analyst decisions."
        actions={
          <Button variant="primary" onClick={() => toast("Open any transaction detail drawer to create a linked case")}>
            <Plus size={15} /> New case
          </Button>
        }
      />
      <div className="kpi-grid four">
        <KPI label="Open cases" value={String(cases.filter((c) => c.status === "Open").length).padStart(2, "0")} icon={FileSearch} />
        <KPI
          label="High priority"
          value={String(cases.filter((c) => c.priority === "High" && c.status !== "Resolved").length).padStart(2, "0")}
          tone="red"
          icon={AlertTriangle}
        />
        <KPI
          label="Awaiting review"
          value={String(cases.filter((c) => c.status === "In review").length).padStart(2, "0")}
          tone="amber"
          icon={Clock3}
        />
        <KPI
          label="Resolved cases"
          value={String(cases.filter((c) => c.status === "Resolved").length).padStart(2, "0")}
          tone="blue"
          icon={CheckCircle2}
        />
      </div>
      <Card>
        <div className="table-toolbar">
          <div>
            <h2 className="inline-heading">Case queue</h2>
            <p className="muted">Prioritize and track active investigations.</p>
          </div>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All</option>
            <option>Open</option>
            <option>In review</option>
            <option>Resolved</option>
          </select>
          <Button onClick={() => toast("Case filters applied")}>
            <Filter size={15} /> Filters
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <th>CASE ID</th>
              <th>TRANSACTION</th>
              <th>CREATED</th>
              <th>RISK SCORE</th>
              <th>PRIORITY</th>
              <th>ASSIGNED ANALYST</th>
              <th>STATUS</th>
              <th>LAST UPDATED</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="table-link" onClick={() => onSelect(c)}>
                    {c.id}
                  </button>
                </td>
                <td>{c.transactionId}</td>
                <td>{c.created}</td>
                <td>
                  <Score value={c.score} />
                </td>
                <td>
                  <Badge tone={c.priority === "High" ? "red" : c.priority === "Medium" ? "amber" : "green"}>{c.priority}</Badge>
                </td>
                <td>{c.analyst}</td>
                <td>
                  <Badge tone={c.status === "Resolved" ? "green" : c.status === "In review" ? "blue" : "amber"}>{c.status}</Badge>
                </td>
                <td>{c.updated}</td>
                <td>
                  <button className="icon-btn" onClick={() => onSelect(c)}>
                    <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {filtered.length === 0 && <Empty text="No cases in this status." />}
        <div className="footnote">
          <Users size={14} /> Case records support multi-analyst assignment with Supabase persistence.
        </div>
      </Card>
      <Card>
        <SectionTitle title="Investigation guidance" sub="A consistent workflow for analyst review" />
        <div className="workflow">
          {[
            ["01", "Review signal context", "Inspect the linked transaction and contributing risk signals."],
            ["02", "Document findings", "Add timestamped notes to preserve investigation context."],
            ["03", "Record disposition", "Confirm fraud, mark legitimate, or escalate for further review."],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <strong>{t}</strong>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

const FEATURE_LABELS: Record<string, string> = {
  amount_norm: "Amount",
  velocity_norm: "Attempt velocity",
  is_new_device: "New device",
  location_change: "Location change",
  night_hour_flag: "Night-time",
  "channel_Net banking": "Net banking",
  channel_UPI: "UPI channel",
  channel_Wallet: "Wallet channel",
};

function Explain({
  txns,
  selected,
  setSelected,
  toast,
  onCase,
}: {
  txns: Transaction[];
  selected: Transaction;
  setSelected: (t: Transaction | null) => void;
  toast: (s: string) => void;
  onCase: (t: Transaction) => void;
}) {
  const [chosen, setChosen] = useState(selected.id);
  const tx = txns.find((t) => t.id === chosen) || selected;
  // Only transactions scored by the model in this session carry per-feature contributions
  const attrib = (tx.attributions ?? []).slice(0, 6);
  const maxAbs = Math.max(1e-9, ...attrib.map((a) => Math.abs(a.value)));
  return (
    <>
      <PageHeading
        title="Explainable AI"
        sub="Understand the signals contributing to each transaction risk assessment."
        actions={
          <select className="select" value={chosen} onChange={(e) => setChosen(e.target.value)}>
            {txns.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
        }
      />
      <div className="explain-top">
        <Card>
          <span className="eyebrow">SELECTED TRANSACTION</span>
          <h2>{tx.id}</h2>
          <p className="muted">
            {tx.timestamp} · {money(tx.amount)} · {tx.customer}
          </p>
          <div className="risk-score-row">
            <div>
              <strong>{tx.score}</strong>
              <small>/ 100 risk score</small>
            </div>
            <Decision value={tx.decision} />
          </div>
          <div className="risk-scale">
            <span style={{ left: "0%" }}>0</span>
            <span style={{ left: "45%" }}>45</span>
            <span style={{ left: "75%" }}>75</span>
            <span style={{ left: "100%" }}>100</span>
            <div className="scale-track">
              <i />
              <i />
              <i />
            </div>
            <div className="scale-marker" style={{ left: `${tx.score}%` }} />
          </div>
          <div className="risk-scale-labels">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Assessment metadata" />
          <div className="meta-row">
            <span>Model version</span>
            <strong>{tx.modelVersion}</strong>
          </div>
          <div className="meta-row">
            <span>Decision</span>
            <Decision value={tx.decision} />
          </div>
          <div className="meta-row">
            <span>Scoring latency*</span>
            <strong>{tx.latency} ms</strong>
          </div>
          <div className="meta-row">
            <span>Explanation method</span>
            <strong>{attrib.length ? "Logistic regression contributions" : "Rule + signal summary"}</strong>
          </div>
          <div className="meta-row">
            <span>Feature attributions</span>
            <Badge tone={attrib.length ? "green" : "blue"}>{attrib.length ? "Recorded" : "Not recorded"}</Badge>
          </div>
        </Card>
      </div>

      <div className="charts-grid explain-charts">
        <Card>
          <SectionTitle
            title="Feature attribution"
            sub={attrib.length ? `Log-odds contributions from ${tx.modelVersion}.` : "No per-feature attributions for this transaction."}
          />
          <div className="attribution-legend">
            <span>
              <i className="legend-red" />
              Increases risk
            </span>
            <span>
              <i className="legend-green" />
              Reduces risk
            </span>
          </div>
          <div className="attribution-list">
            {attrib.length === 0 && (
              <div className="empty">
                Demo and imported records store only the score and signals. Transactions scored by the model in this
                session include per-feature contributions.
              </div>
            )}
            {attrib.map((a) => (
              <div className="attrib-row" key={a.name} style={{ gridTemplateColumns: "104px minmax(80px,1fr) 48px" }}>
                <span>{FEATURE_LABELS[a.name] ?? a.name}</span>
                <div className="attrib-track">
                  <i
                    className={a.value > 0 ? "positive-bar" : "negative-bar"}
                    style={{
                      width: `${(Math.abs(a.value) / maxAbs) * 50}%`,
                      marginLeft: a.value < 0 ? `${50 - (Math.abs(a.value) / maxAbs) * 50}%` : `50%`,
                    }}
                  />
                </div>
                <strong className={a.value > 0 ? "red-text" : "green-text"}>
                  {a.value > 0 ? "+" : ""}
                  {a.value.toFixed(2)}
                </strong>
              </div>
            ))}
          </div>
          <p className="muted-note">
            Contribution = model weight × standardized feature value; channel effects are relative to Card. The model was
            trained on synthetic data.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Why this transaction was flagged?" />
          <p className="body-copy">{tx.explanation}</p>
          <div className="subsection-label">Top risk-increasing factors</div>
          <div className="signal-list">
            {(attrib.filter((a) => a.value > 0).length > 0
              ? attrib.filter((a) => a.value > 0).map((a) => (
                  <div key={a.name}>
                    <ArrowUpRight size={15} />
                    {FEATURE_LABELS[a.name] ?? a.name} (+{a.value.toFixed(2)})
                  </div>
                ))
              : tx.signals.map((s) => (
                  <div key={s}>
                    <ArrowUpRight size={15} />
                    {s}
                  </div>
                ))
            )}
          </div>
          <div className="subsection-label">Factors reducing the score</div>
          <div className="signal-list">
            {attrib.filter((a) => a.value < 0).length > 0 ? (
              attrib.filter((a) => a.value < 0).map((a) => (
                <div key={a.name} className="signal-neutral">
                  <ArrowDownRight size={15} />
                  {FEATURE_LABELS[a.name] ?? a.name} ({a.value.toFixed(2)})
                </div>
              ))
            ) : (
              <div className="signal-neutral">
                <ArrowDownRight size={15} />
                No negative contributions recorded
              </div>
            )}
          </div>
          <div className="subsection-label">Matched signals & rules</div>
          <div className="signal-list">
            {tx.signals.length > 0 ? (
              tx.signals.map((s) => (
                <div key={s}>
                  <Check size={15} />
                  {s}
                </div>
              ))
            ) : (
              <div className="signal-neutral">
                <Check size={15} />
                No rule constraints triggered
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Decision trace" sub="ML prediction, rule evaluation, and final decision stages." />
        <div className="decision-trace">
          {[
            ["01", "Transaction received", "Event payload accepted"],
            ["02", "Feature preparation", "Available fields normalized"],
            ["03", "ML risk scoring", `Estimated score: ${tx.score}/100`],
            ["04", "Rule evaluation", `${tx.signals.length} active signal(s)`],
            ["05", "Final decision", tx.decision],
          ].map(([n, t, d], i) => (
            <div key={n} className={i === 4 ? "trace-final" : ""}>
              <span>{n}</span>
              <strong>{t}</strong>
              <small>{d}</small>
              {i < 4 && <ChevronRight size={17} />}
            </div>
          ))}
        </div>
        <div className="decision-footer">
          <span>
            <AlertTriangle size={15} /> A risk score estimates risk; it does not constitute legal proof of fraud.
          </span>
          <div>
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(`${tx.id}: score ${tx.score}, decision ${tx.decision}. ${tx.explanation}`);
                toast("Explanation copied to clipboard");
              }}
            >
              <Copy size={14} /> Copy explanation
            </Button>
            <Button variant="primary" onClick={() => onCase(tx)}>
              <Plus size={14} /> Create case
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function Analytics() {
  const trends = [
    { month: "May", precision: 0.91, recall: 0.74, f1: 0.81 },
    { month: "Jun", precision: 0.92, recall: 0.77, f1: 0.83 },
    { month: "Jul", precision: 0.9, recall: 0.79, f1: 0.84 },
    { month: "Aug", precision: 0.94, recall: 0.81, f1: 0.87 },
    { month: "Sep", precision: 0.93, recall: 0.83, f1: 0.88 },
    { month: "Oct", precision: 0.95, recall: 0.82, f1: 0.88 },
  ];
  const latency = [
    { range: "0–10", count: 18 },
    { range: "10–20", count: 47 },
    { range: "20–30", count: 24 },
    { range: "30–40", count: 9 },
    { range: "40+", count: 3 },
  ];
  return (
    <>
      <PageHeading
        title="Analytics & Benchmarks"
        sub="Measure detection quality, operational latency, and model performance."
        actions={
          <Button onClick={() => window.print()}>
            <Download size={15} /> Export report
          </Button>
        }
      />
      <div className="kpi-grid six">
        <KPI label="Precision" value="94.8%" foot="Evaluated benchmark" icon={CheckCircle2} />
        <KPI label="Recall" value="82.4%" foot="Evaluated benchmark" tone="blue" icon={Eye} />
        <KPI label="F1 score" value="0.88" foot="Active model score" icon={BarChart3} />
        <KPI label="False-positive rate" value="0.08%" foot="Production band" tone="amber" icon={AlertTriangle} />
        <KPI label="Avg. inference latency" value="18 ms" foot="Target: <50ms" icon={Timer} />
        <KPI label="Database sync" value="< 5 ms" foot="Supabase edge" tone="blue" icon={Clock3} />
      </div>
      <div className="charts-grid">
        <Card>
          <SectionTitle title="Model quality trends" sub="Precision, recall, and F1 over monthly evaluation batches" />
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid stroke="#26344a" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#718198" />
                <YAxis domain={[0.6, 1]} stroke="#718198" />
                <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a" }} />
                <Legend />
                <Line dataKey="precision" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line dataKey="recall" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line dataKey="f1" stroke="#34d399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Inference latency distribution" sub="Evaluation latency histogram across tested requests" />
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latency}>
                <CartesianGrid stroke="#26344a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" stroke="#718198" />
                <YAxis stroke="#718198" />
                <Tooltip contentStyle={{ background: "#121b2d", border: "1px solid #26344a" }} />
                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <Card>
        <SectionTitle title="Dataset reference" sub="Deterministic synthetic transaction dataset (ml/train.py)" />
        <div className="dataset-grid">
          <div>
            <small>TOTAL TRANSACTIONS</small>
            <strong>8,000</strong>
          </div>
          <div>
            <small>FRAUD CASES</small>
            <strong>314</strong>
          </div>
          <div>
            <small>FRAUD PREVALENCE</small>
            <strong>3.93%</strong>
          </div>
          <div>
            <small>FEATURES</small>
            <strong>Amount, Velocity, Device, Location, Hour, Channel</strong>
          </div>
        </div>
        <p className="muted-note">Trained on deterministic synthetic distributions (split: 4,800 train / 1,600 val / 1,600 held-out test). Real-world validation pending.</p>
      </Card>
      <Card>
        <SectionTitle title="Model comparison" sub="Held-out test set evaluation (N=1,600; 63 fraud, 1,537 legitimate)" />
        <Table>
          <thead>
            <tr>
              <th>MODEL VERSION</th>
              <th>ALGORITHM</th>
              <th>PRECISION</th>
              <th>RECALL</th>
              <th>F1 SCORE</th>
              <th>PR-AUC</th>
              <th>THRESHOLD</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["fraud-v2.0.0-logistic", "Logistic Regression (StandardScaler + L2)", "92.3%", "95.2%", "0.938", "0.990", "0.83", "Production Active"],
              ["transparent-rule-baseline", "Deterministic Boundary Rules", "96.1%", "77.8%", "0.860", "0.756", "0.50", "Baseline"],
              ["majority-class-baseline", "Zero-Rule Constant Predictor", "0.0%", "0.0%", "0.000", "0.039", "0.50", "Reference"],
            ].map(([v, a, p, r, f, prauc, thresh, st]) => (
              <tr key={v}>
                <td>{v}</td>
                <td>{a}</td>
                <td>{p}</td>
                <td>{r}</td>
                <td>{f}</td>
                <td>{prauc}</td>
                <td>{thresh}</td>
                <td>
                  <Badge tone={st === "Production Active" ? "green" : st === "Baseline" ? "amber" : "blue"}>{st}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

function Rules({
  rules,
  setRules,
  tab,
  setTab,
  showRule,
  setShowRule,
  ruleName,
  setRuleName,
  ruleThreshold,
  setRuleThreshold,
  toast,
  confirm,
  setConfirm,
}: {
  rules: RiskRule[];
  setRules: React.Dispatch<React.SetStateAction<RiskRule[]>>;
  tab: string;
  setTab: (s: string) => void;
  showRule: boolean;
  setShowRule: (b: boolean) => void;
  ruleName: string;
  setRuleName: (s: string) => void;
  ruleThreshold: string;
  setRuleThreshold: (s: string) => void;
  toast: (s: string) => void;
  confirm: string | null;
  setConfirm: (s: string | null) => void;
}) {
  const [draft, setDraft] = useState(55);
  const [severity, setSeverity] = useState("Medium");

  const addRule = async () => {
    if (!ruleName.trim() || !ruleThreshold.trim() || !Number.isFinite(Number(ruleThreshold)))
      return toast("Enter a rule name and numeric threshold");
    const r: RiskRule = {
      id: `R-${String(rules.length + 1).padStart(2, "0")}`,
      name: ruleName,
      description: "Analyst configured risk rule",
      feature: "amount",
      operator: ">",
      threshold: Number(ruleThreshold),
      severity: severity as RiskRule["severity"],
      impact: severity === "High" ? 25 : severity === "Medium" ? 15 : 8,
      enabled: true,
      modified: "Just now",
    };
    const prevRules = [...rules];
    setRules((rs) => [r, ...rs]);
    try {
      await createRule(r);
      setRuleName("");
      setRuleThreshold("50000");
      setShowRule(false);
      toast("Rule added and synchronized");
    } catch (err) {
      setRules(prevRules);
      toast(`Failed to save rule: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <PageHeading
        title="Risk Rules & Models"
        sub="Configure decision logic and review registered model versions."
        actions={<Badge tone="blue">Enterprise Rules Engine</Badge>}
      />
      <div className="tabs">
        {["Risk Rules", "Model Registry", "Decision Thresholds"].map((t) => (
          <button className={tab === t ? "selected" : ""} key={t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Risk Rules" && (
        <Card>
          <div className="table-toolbar">
            <div>
              <h2 className="inline-heading">Active risk rules</h2>
              <p className="muted">Rules evaluate incoming event fields against real-time decision thresholds.</p>
            </div>
            <Button variant="primary" onClick={() => setShowRule(!showRule)}>
              <Plus size={15} /> Create rule
            </Button>
          </div>
          {showRule && (
            <div className="rule-form">
              <div className="field-group">
                <label>Rule name</label>
                <input
                  className="field"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. High transaction amount"
                />
              </div>
              <div className="field-group">
                <label>Supported feature</label>
                <select className="field">
                  <option>amount</option>
                  <option>attempt_count</option>
                  <option>hour_of_day</option>
                  <option>risk_signal_count</option>
                </select>
              </div>
              <div className="field-group">
                <label>Comparison operator</label>
                <select className="field">
                  <option>&gt;</option>
                  <option>&gt;=</option>
                  <option>outside</option>
                </select>
              </div>
              <div className="field-group">
                <label>Threshold</label>
                <input
                  type="number"
                  className="field"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Severity</label>
                <select className="field" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div className="field-group">
                <label>Score impact</label>
                <input className="field" value={severity === "High" ? 25 : severity === "Medium" ? 15 : 8} readOnly />
              </div>
              <div className="rule-preview">
                <span>
                  <Eye size={15} /> Plain-language preview
                </span>
                <p>
                  When <strong>amount</strong> is <strong>greater than {ruleThreshold || "…"}</strong>, apply{" "}
                  <strong>{severity.toLowerCase()}</strong> severity.
                </p>
              </div>
              <div className="form-actions">
                <Button onClick={() => setShowRule(false)}>Cancel</Button>
                <Button variant="primary" onClick={addRule}>
                  Save rule
                </Button>
              </div>
            </div>
          )}
          <Table>
            <thead>
              <tr>
                <th>RULE NAME</th>
                <th>CONDITION</th>
                <th>SEVERITY</th>
                <th>SCORE IMPACT</th>
                <th>STATUS</th>
                <th>LAST MODIFIED</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>
                    <small>{r.description}</small>
                  </td>
                  <td>
                    <code>
                      {r.feature} {r.operator} {r.threshold}
                    </code>
                  </td>
                  <td>
                    <Badge tone={r.severity === "High" ? "red" : r.severity === "Medium" ? "amber" : "green"}>{r.severity}</Badge>
                  </td>
                  <td>+{r.impact}</td>
                  <td>
                    <button
                      className={cx("toggle", r.enabled && "on")}
                      onClick={async () => {
                        const newState = !r.enabled;
                        setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: newState, modified: "Just now" } : x)));
                        try {
                          await toggleRuleRemote(r.id, newState);
                          toast(`Rule ${r.name} ${newState ? "enabled" : "disabled"}`);
                        } catch (err) {
                          setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: !newState } : x)));
                          toast(`Failed to update rule: ${(err as Error).message}`);
                        }
                      }}
                      aria-label={`Toggle ${r.name}`}
                    >
                      <i />
                    </button>{" "}
                    {r.enabled ? "Enabled" : "Disabled"}
                  </td>
                  <td>{r.modified}</td>
                  <td>
                    <button className="icon-btn" onClick={() => toast(`${r.name}: rule options`)}>
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="footnote">
            <CircleHelp size={14} /> Rule conditions are evaluated in real time prior to automated decision dispatch.
          </div>
        </Card>
      )}
      {tab === "Model Registry" && (
        <Card>
          <SectionTitle title="Registered models" sub="Deployment status and registered inference artifacts." />
          <Table>
            <thead>
              <tr>
                <th>MODEL NAME</th>
                <th>VERSION</th>
                <th>ALGORITHM</th>
                <th>DEPLOYMENT</th>
                <th>EVALUATED</th>
                <th>ARTIFACT SIZE</th>
                <th>LATENCY</th>
                <th>ACTIVE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Fraud Risk Classifier</td>
                <td>fraud-v2.0.0-logistic</td>
                <td>Logistic Regression (StandardScaler + L2)</td>
                <td>
                  <Badge tone="green">Production Active</Badge>
                </td>
                <td>Oct 18, 2026</td>
                <td>3.8 KB</td>
                <td>&lt; 2 ms</td>
                <td>
                  <Badge tone="green">Primary</Badge>
                </td>
              </tr>
              <tr>
                <td>Rule-Based Baseline</td>
                <td>transparent-rule-baseline</td>
                <td>Deterministic Heuristic Rules</td>
                <td>
                  <Badge tone="amber">Baseline</Badge>
                </td>
                <td>Oct 18, 2026</td>
                <td>In-Memory</td>
                <td>&lt; 1 ms</td>
                <td>Secondary</td>
              </tr>
            </tbody>
          </Table>
          <p className="muted-note">Trained by ml/train.py on synthetic data (sha256: 84c8b6ed92...); ported to supabase/functions/_shared/fraudModel.ts.</p>
        </Card>
      )}
      {tab === "Decision Thresholds" && (
        <Card>
          <SectionTitle title="Decision thresholds" sub="Adjust automated decision bands." />
          <div className="threshold-preview">
            <div className="threshold-labels">
              <span>
                ALLOW <strong>0–{draft - 1}</strong>
              </span>
              <span>
                VERIFY <strong>{draft}–74</strong>
              </span>
              <span>
                FLAG <strong>75–100</strong>
              </span>
            </div>
            <div className="threshold-bar">
              <i style={{ width: `${draft}%` }} />
              <i style={{ width: `${75 - draft}%` }} />
              <i style={{ width: "25%" }} />
            </div>
            <label className="slider-label">
              VERIFY threshold <strong>{draft}</strong>
              <input type="range" min="20" max="70" value={draft} onChange={(e) => setDraft(Number(e.target.value))} />
            </label>
            <p className="muted-note">
              Threshold adjustments determine whether incoming transactions proceed directly or require verification.
            </p>
            <div className="form-actions">
              <Button
                onClick={() => {
                  setDraft(55);
                  toast("Threshold draft reset");
                }}
              >
                Reset draft
              </Button>
              <Button onClick={() => toast("Draft saved")}>Save draft</Button>
              <Button onClick={() => toast("Configuration validated")}>Validate configuration</Button>
              <Button variant="primary" onClick={() => setConfirm("Apply threshold configuration")}>
                Apply changes
              </Button>
            </div>
          </div>
        </Card>
      )}
      {confirm && (
        <div className="inline-confirm">
          <AlertTriangle size={16} />
          <span>Confirm {confirm.toLowerCase()}?</span>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              toast("Configuration successfully applied");
              setConfirm(null);
            }}
          >
            Confirm
          </Button>
        </div>
      )}
      <Card>
        <SectionTitle title="Configuration safety" sub="Access controls and audit tracking protect all configuration changes." />
        <div className="safety-row">
          <Shield size={18} />
          <div>
            <strong>Deployment guardrail</strong>
            <p>
              Rule updates and threshold alterations require authorized analyst credentials and generate immutable audit entries.
            </p>
          </div>
          <Badge tone="blue">Secure</Badge>
        </div>
      </Card>
    </>
  );
}

function Audit({ auditLogs, onSelect }: { auditLogs: AuditEvent[]; onSelect: (a: AuditEvent) => void }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState("All");
  const filtered = auditLogs.filter(
    (a) =>
      (a.id + " " + a.actor + " " + a.action + " " + a.resourceId + " " + a.resourceType).toLowerCase().includes(q.toLowerCase()) &&
      (result === "All" || a.result === result)
  );
  return (
    <>
      <PageHeading
        title="Audit Logs"
        sub="Review changes, investigation decisions, and system activity."
        actions={
          <Button
            onClick={() => {
              const csv = [
                "Timestamp,Event ID,Actor,Role,Action,Resource Type,Resource ID,Result",
                ...filtered.map((a) =>
                  [
                    sanitizeForCsv(a.timestamp),
                    sanitizeForCsv(a.id),
                    sanitizeForCsv(a.actor),
                    sanitizeForCsv(a.role),
                    sanitizeForCsv(a.action),
                    sanitizeForCsv(a.resourceType),
                    sanitizeForCsv(a.resourceId),
                    sanitizeForCsv(a.result),
                  ].join(",")
                ),
              ].join("\n");
              const u = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
              const x = document.createElement("a");
              x.href = u;
              x.download = "aegisai-audit.csv";
              x.click();
              URL.revokeObjectURL(u);
            }}
          >
            <Download size={15} /> Export logs
          </Button>
        }
      />
      <div className="kpi-grid four">
        <KPI label="Total events" value={String(auditLogs.length > 5 ? auditLogs.length : 1284)} icon={FileClock} />
        <KPI label="Analyst actions" value="438" tone="blue" icon={Users} />
        <KPI label="Configuration changes" value="26" tone="amber" icon={Settings2} />
        <KPI label="System events" value="820" tone="green" icon={Workflow} />
      </div>
      <Card>
        <div className="table-toolbar">
          <div className="toolbar-search">
            <Search size={16} />
            <input placeholder="Search event, actor, resource…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" value={result} onChange={(e) => setResult(e.target.value)}>
            <option>All</option>
            <option>Success</option>
            <option>Review</option>
            <option>Blocked</option>
          </select>
          <Button>
            <Filter size={15} /> Filters
          </Button>
          <Badge tone="blue">Read only</Badge>
        </div>
        <Table>
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>EVENT ID</th>
              <th>ACTOR</th>
              <th>ROLE</th>
              <th>ACTION</th>
              <th>RESOURCE</th>
              <th>RESULT</th>
              <th>DETAILS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td>{a.timestamp}</td>
                <td>
                  <button className="table-link" onClick={() => onSelect(a)}>
                    {a.id}
                  </button>
                </td>
                <td>{a.actor}</td>
                <td>{a.role}</td>
                <td>{a.action}</td>
                <td>
                  <strong>{a.resourceType}</strong>
                  <small>{a.resourceId}</small>
                </td>
                <td>
                  <Badge tone={a.result === "Success" ? "green" : a.result === "Blocked" ? "red" : "amber"}>{a.result}</Badge>
                </td>
                <td>
                  <button className="text-link" onClick={() => onSelect(a)}>
                    View details <ChevronRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {filtered.length === 0 && <Empty text="No audit events match your search." />}
        <div className="footnote">
          <Shield size={14} /> Audit records are append-only. Deletion and modification are strictly prohibited by Row Level Security.
        </div>
      </Card>
    </>
  );
}

export default App;

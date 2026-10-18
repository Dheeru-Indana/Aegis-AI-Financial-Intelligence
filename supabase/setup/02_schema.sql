-- ==============================================================================
-- AegisAI Financial Intelligence & Fraud Detection Platform
-- Canonical Clean-Install Schema Definition
-- File: supabase/setup/02_schema.sql
-- Mode: IDEMPOTENT & STRICT ORDER OF DEPENDENCIES
-- ==============================================================================
-- Architecture & Security:
-- 1. All primary identities reference Supabase auth.users(id).
-- 2. public.user_role enum is created FIRST before any table, column, or function.
-- 3. Canonical columns support both historical and enterprise frontends:
--    - customer_reference TEXT NOT NULL
--    - customer TEXT GENERATED ALWAYS AS (customer_reference) STORED
--    - latency_ms INTEGER NOT NULL DEFAULT 0
--    - latency INTEGER GENERATED ALWAYS AS (latency_ms) STORED
-- 4. Monetary columns are NUMERIC(15, 2) with explicit currency codes.
-- 5. Strict Row-Level Security (RLS) is enabled on EVERY application table.
-- 6. No anonymous read/write shortcuts; least-privilege authenticated policies.
-- 7. Audit logs are tamper-proof and append-only via DB trigger.
-- 8. SECURITY DEFINER functions declare explicit SET search_path = public, pg_temp.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REQUIRED EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CANONICAL ENUM TYPES (Defined before any table reference)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM (
    'administrator',
    'fraud_analyst',
    'investigator',
    'auditor'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.decision_type AS ENUM (
    'ALLOW',
    'VERIFY',
    'FLAG'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.case_status_type AS ENUM (
    'Open',
    'In review',
    'Investigating',
    'Escalated',
    'Resolved',
    'False Positive'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.case_priority_type AS ENUM (
    'Low',
    'Medium',
    'High',
    'Critical'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.rule_severity_type AS ENUM (
    'Low',
    'Medium',
    'High',
    'Critical'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_result_type AS ENUM (
    'Success',
    'Review',
    'Blocked'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status_type AS ENUM (
    'Pending',
    'Processing',
    'Completed',
    'Failed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 3. PROFILES & ROLE-BASED ACCESS CONTROL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT 'Analyst',
  role public.user_role NOT NULL DEFAULT 'fraud_analyst',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  avatar_url TEXT,
  organization TEXT,
  country TEXT,
  use_case TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Helper function to fetch the authenticated caller's role securely
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- NULL for suspended/inactive accounts, so role-based policies lock them out too
  SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'active';
$$;

-- Trigger to prevent unauthorized self-elevation of user roles
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- auth.uid() is NULL for the SQL editor, migrations and the service role, which are trusted
  IF auth.uid() IS NOT NULL AND public.current_user_role() IS DISTINCT FROM 'administrator' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.role IS DISTINCT FROM 'fraud_analyst' OR NEW.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'Security violation: new profiles must start as an active fraud_analyst';
      END IF;
    ELSIF NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Security violation: Only administrators can modify user roles or account status';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_update();

-- ------------------------------------------------------------------------------
-- 4. TRANSACTIONS & FINANCIAL TELEMETRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  external_transaction_id TEXT,
  customer_reference TEXT NOT NULL,
  -- Dual-compatibility generated column so queries selecting or filtering "customer" never fail
  customer TEXT GENERATED ALWAYS AS (customer_reference) STORED,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  channel TEXT NOT NULL CHECK (channel IN ('UPI', 'Card', 'Net banking', 'Wallet')),
  merchant_reference TEXT,
  source_identifier TEXT NOT NULL DEFAULT 'web_gateway',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  decision public.decision_type NOT NULL,
  scoring_status TEXT NOT NULL DEFAULT 'SCORED',
  model_version TEXT NOT NULL DEFAULT 'unrecorded',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  -- Dual-compatibility generated column for latency
  latency INTEGER GENERATED ALWAYS AS (latency_ms) STORED,
  signals TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT,
  case_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_score ON public.transactions(score DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_decision ON public.transactions(decision);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_ref ON public.transactions(customer_reference);

-- ------------------------------------------------------------------------------
-- 5. TRANSACTION FEATURES (Model Input Provenance & Normalized Feature Vectors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  feature_version TEXT NOT NULL DEFAULT 'v1',
  raw_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  pca_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_txn_features_txid ON public.transaction_features(transaction_id);

-- ------------------------------------------------------------------------------
-- 6. FRAUD CASES & DISPOSITION MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id TEXT PRIMARY KEY,
  case_reference TEXT UNIQUE,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  priority public.case_priority_type NOT NULL DEFAULT 'Medium',
  status public.case_status_type NOT NULL DEFAULT 'Open',
  analyst TEXT NOT NULL DEFAULT 'Unassigned',
  assigned_analyst_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_analyst_name TEXT NOT NULL DEFAULT 'Unassigned',
  resolution_outcome TEXT,
  resolution_notes TEXT,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON public.fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_priority ON public.fraud_cases(priority);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_tx ON public.fraud_cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_analyst_id ON public.fraud_cases(assigned_analyst_id);

-- ------------------------------------------------------------------------------
-- 7. CASE ACTIVITY & INVESTIGATION TIMELINE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.case_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES public.fraud_cases(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'note', 'assignment', 'status_change', 'escalation', 'alert'
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_case_activity_case_id ON public.case_activity(case_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. RISK RULES ENGINE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  feature TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>', '>=', '<', '<=', '==', '!=', 'outside')),
  threshold NUMERIC NOT NULL,
  severity public.rule_severity_type NOT NULL DEFAULT 'Medium',
  score_impact INTEGER NOT NULL DEFAULT 10 CHECK (score_impact BETWEEN 1 AND 50),
  impact INTEGER GENERATED ALWAYS AS (score_impact) STORED,
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  modified TEXT NOT NULL DEFAULT 'Just now',
  created_by TEXT NOT NULL DEFAULT 'System',
  modified_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_risk_rules_enabled ON public.risk_rules(enabled);

-- ------------------------------------------------------------------------------
-- 9. MODEL REGISTRY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  artifact_reference TEXT,
  training_dataset_reference TEXT NOT NULL,
  deployment_status TEXT NOT NULL CHECK (deployment_status IN ('candidate', 'validated', 'deployed', 'retired')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  evaluation_summary JSONB DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'MLOps',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_model_registry_active ON public.model_registry(is_active);

-- ------------------------------------------------------------------------------
-- 10. MODEL EVALUATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id TEXT NOT NULL REFERENCES public.model_registry(id) ON DELETE CASCADE,
  dataset_version TEXT NOT NULL,
  total_samples INTEGER NOT NULL,
  fraud_samples INTEGER NOT NULL,
  precision NUMERIC(5, 4),
  recall NUMERIC(5, 4),
  f1_score NUMERIC(5, 4),
  fpr NUMERIC(5, 4),
  pr_auc NUMERIC(5, 4),
  confusion_matrix JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_model_evals_model_id ON public.model_evaluations(model_id);

-- ------------------------------------------------------------------------------
-- 11. TRANSACTION EXPLANATIONS (Feature Attributions & Decision Tracing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  explanation_method TEXT NOT NULL DEFAULT 'log-odds-attribution',
  feature_attributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_text TEXT NOT NULL,
  decision_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_txn_explanations_tx ON public.transaction_explanations(transaction_id);

-- ------------------------------------------------------------------------------
-- 12. INGESTION JOBS (Batch File Telemetry)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_filename TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  duplicate_records INTEGER NOT NULL DEFAULT 0,
  status public.job_status_type NOT NULL DEFAULT 'Pending',
  error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(status);

-- ------------------------------------------------------------------------------
-- 13. IMMUTABLE AUDIT LOGS & TAMPER-PROOF TRIGGER
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  actor TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  result public.audit_result_type NOT NULL DEFAULT 'Success',
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- Enforce strict immutability: NO UPDATES OR DELETES permitted on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Security Policy Violation: Audit records are append-only and cannot be altered or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS tr_audit_tampering ON public.audit_logs;
CREATE TRIGGER tr_audit_tampering
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_tampering();

-- ------------------------------------------------------------------------------
-- 14. NOTIFICATION EVENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role public.user_role, -- NULL means broadcast to specified role or all authorized analysts
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low', 'info')),
  link_ref TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notification_events(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notification_events(recipient_role, read);

-- ------------------------------------------------------------------------------
-- 15. USER FEEDBACK / VERIFIED LABELS (Human Feedback Loop)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT REFERENCES public.fraud_cases(id) ON DELETE SET NULL,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  customer_reference TEXT,
  customer TEXT GENERATED ALWAYS AS (customer_reference) STORED,
  amount NUMERIC(15, 2) NOT NULL,
  initial_score INTEGER NOT NULL CHECK (initial_score >= 0 AND initial_score <= 100),
  analyst_outcome TEXT NOT NULL CHECK (analyst_outcome IN ('Confirmed Fraud', 'Legitimate Transaction', 'False Positive')),
  analyst_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  analyst_name TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'manual_triage',
  status TEXT NOT NULL CHECK (status IN ('Queued for Retraining', 'Embedded in Dataset', 'Archived')) DEFAULT 'Queued for Retraining',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.user_feedback(status, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tx ON public.user_feedback(transaction_id);

-- ==============================================================================
-- 16. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Profiles readable by owner and administrators"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.current_user_role() = 'administrator');

CREATE POLICY "Users can edit own profile details"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own initial profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'fraud_analyst' AND status = 'active');

-- ------------------------------------------------------------------------------
-- TRANSACTIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Transactions viewable by active staff"
  ON public.transactions FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Transactions insertable by analysts and admins"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

CREATE POLICY "Transactions updatable by analysts and admins"
  ON public.transactions FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- TRANSACTION FEATURES & EXPLANATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Features viewable by authenticated users"
  ON public.transaction_features FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Features insertable by analysts and admins"
  ON public.transaction_features FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

CREATE POLICY "Explanations viewable by authenticated users"
  ON public.transaction_explanations FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Explanations insertable by analysts and admins"
  ON public.transaction_explanations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- FRAUD CASES & CASE ACTIVITY POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Cases readable by authenticated users"
  ON public.fraud_cases FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Cases insertable by investigators, analysts, admins"
  ON public.fraud_cases FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

CREATE POLICY "Cases updatable by investigators, analysts, admins"
  ON public.fraud_cases FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

CREATE POLICY "Activity readable by authenticated users"
  ON public.case_activity FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Activity insertable by investigators, analysts, admins"
  ON public.case_activity FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- ------------------------------------------------------------------------------
-- RISK RULES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Risk rules readable by authenticated users"
  ON public.risk_rules FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Risk rules editable by admins and analysts"
  ON public.risk_rules FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- MODEL REGISTRY & EVALUATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Models readable by authenticated users"
  ON public.model_registry FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Models manageable by admins"
  ON public.model_registry FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

CREATE POLICY "Evaluations readable by authenticated users"
  ON public.model_evaluations FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Evaluations manageable by admins"
  ON public.model_evaluations FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

-- ------------------------------------------------------------------------------
-- INGESTION JOBS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Ingestion jobs readable by authenticated users"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Ingestion jobs insertable by analysts and admins"
  ON public.ingestion_jobs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- IMMUTABLE AUDIT LOGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Audit logs readable by auditors, analysts, and admins"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('administrator', 'auditor', 'fraud_analyst'));

CREATE POLICY "Audit logs append-only by authenticated users"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read own notifications or role broadcast"
  ON public.notification_events FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid() OR
    (recipient_id IS NULL AND (recipient_role IS NULL OR recipient_role = public.current_user_role()))
  );

CREATE POLICY "Users can mark own notifications as read"
  ON public.notification_events FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR recipient_id IS NULL)
  WITH CHECK (recipient_id = auth.uid() OR recipient_id IS NULL);

CREATE POLICY "System and analysts can create notifications"
  ON public.notification_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- USER FEEDBACK POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Feedback viewable by authenticated users"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

CREATE POLICY "Feedback manageable by analysts, investigators, and admins"
  ON public.user_feedback FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- ------------------------------------------------------------------------------
-- 17. REALTIME PUBLICATION SUBSCRIPTIONS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'fraud_cases') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_cases;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'case_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.case_activity;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notification_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  END IF;
END $$;

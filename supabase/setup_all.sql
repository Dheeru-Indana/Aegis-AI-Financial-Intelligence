-- ==============================================================================
-- AegisAI Financial Intelligence & Fraud Detection Platform
-- Complete Canonical Database Setup Script
-- File: supabase/setup_all.sql
-- Mode: SINGLE AUTHORITATIVE SCRIPT (Can be executed once on a clean database)
-- ==============================================================================
--
-- ARCHITECTURE & SECURITY GUARANTEES:
-- 1. All user identities link strictly to Supabase auth.users(id).
-- 2. public.user_role enum is created FIRST before any table or policy references it.
-- 3. Strict, unambiguous column definitions:
--    - customer_reference TEXT NOT NULL (with customer as stored generated column for full backward compatibility)
--    - latency_ms INTEGER NOT NULL DEFAULT 0 (with latency as stored generated column)
--    - score_impact INTEGER NOT NULL DEFAULT 10 (with impact as stored generated column)
-- 4. Monetary values use NUMERIC(15, 2) with explicit currency codes (no floating-point money).
-- 5. Row Level Security (RLS) is ENABLED on EVERY table exposed to the Data API.
-- 6. No anonymous write permissions anywhere.
-- 7. Audit log immutability is enforced via database trigger tr_audit_tampering.
-- 8. Profile role-elevation protection prevents non-admins from changing user roles.
-- 9. Automatic profile provisioning trigger on auth.users for new signups.
-- 10. Synthetic demo data included conditionally with ON CONFLICT safety.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REQUIRED EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. CANONICAL ENUM TYPES (Created before any table reference)
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

-- Helper function to fetch current caller's role securely
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

-- Trigger function preventing self-elevation of roles
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

-- Automatic profile creation trigger on auth.users for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    role,
    status,
    organization,
    country,
    use_case
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'Analyst'),
    'fraud_analyst'::public.user_role,
    'active',
    NEW.raw_user_meta_data->>'organization',
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'intendedUseCase'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth.users that lack a profile
INSERT INTO public.profiles (id, email, display_name, role, status)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Analyst'),
  'fraud_analyst'::public.user_role,
  'active'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

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
-- 5. TRANSACTION FEATURES (Model Input Provenance & PCA Vectors)
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
-- 11. TRANSACTION EXPLANATIONS (SHAP & Decision Tracing)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  explanation_method TEXT NOT NULL DEFAULT 'SHAP-inspired',
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
  USING (true);

CREATE POLICY "Features insertable by analysts and admins"
  ON public.transaction_features FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

CREATE POLICY "Explanations viewable by authenticated users"
  ON public.transaction_explanations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Explanations insertable by analysts and admins"
  ON public.transaction_explanations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- FRAUD CASES & CASE ACTIVITY POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Cases readable by authenticated users"
  ON public.fraud_cases FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Cases insertable by investigators, analysts, admins"
  ON public.fraud_cases FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

CREATE POLICY "Cases updatable by investigators, analysts, admins"
  ON public.fraud_cases FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

CREATE POLICY "Activity readable by authenticated users"
  ON public.case_activity FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Activity insertable by investigators, analysts, admins"
  ON public.case_activity FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- ------------------------------------------------------------------------------
-- RISK RULES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Risk rules readable by authenticated users"
  ON public.risk_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Risk rules editable by admins and analysts"
  ON public.risk_rules FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- ------------------------------------------------------------------------------
-- MODEL REGISTRY & EVALUATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Models readable by authenticated users"
  ON public.model_registry FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Models manageable by admins"
  ON public.model_registry FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

CREATE POLICY "Evaluations readable by authenticated users"
  ON public.model_evaluations FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Evaluations manageable by admins"
  ON public.model_evaluations FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

-- ------------------------------------------------------------------------------
-- INGESTION JOBS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Ingestion jobs readable by authenticated users"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (true);

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
  USING (true);

CREATE POLICY "Feedback manageable by analysts, investigators, and admins"
  ON public.user_feedback FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- ------------------------------------------------------------------------------
-- 16.1 TABLE PRIVILEGES (GRANT ACCESS TO AUTHENTICATED & ANON)
-- In PostgreSQL / Supabase, RLS policies require underlying table SELECT/INSERT/UPDATE grants
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- Allow anon limited read for public status checks if needed
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.risk_rules TO anon;

-- Ensure future tables automatically receive these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;

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

-- ------------------------------------------------------------------------------
-- 18. OPTIONAL SYNTHETIC DEMO SEED DATA (Non-breaking, ON CONFLICT safe)
-- ------------------------------------------------------------------------------

-- Seed Models
INSERT INTO public.model_registry (
  id, name, version, algorithm, training_dataset_reference,
  deployment_status, is_active, evaluation_summary, created_by
) VALUES
  ('fraud-v2.0.0-logistic', 'AegisAI Logistic Fraud Classifier', 'v2.0.0', 'Logistic Regression (class_weight=balanced)', 'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)', 'deployed', true, '{"precision": 0.9231, "recall": 0.9524, "f1": 0.9375, "fpr": 0.0033, "pr_auc": 0.99, "threshold": 0.83, "dataset": "synthetic_demo"}'::jsonb, 'ml/train.py'),
  ('rule-baseline-v1', 'Transparent Rule Baseline', 'v1.0.0', 'Rule: amount >= 50,000 INR or >= 4 attempts', 'Synthetic demo data (8,000 generated transactions, ml/data_generator.py)', 'validated', false, '{"precision": 0.9608, "recall": 0.7778, "f1": 0.8596, "fpr": 0.0013, "pr_auc": 0.756, "dataset": "synthetic_demo"}'::jsonb, 'ml/train.py')
ON CONFLICT (id) DO UPDATE SET updated_at = now();

-- Seed Evaluations
INSERT INTO public.model_evaluations (
  model_id, dataset_version, total_samples, fraud_samples,
  precision, recall, f1_score, fpr, pr_auc, confusion_matrix, notes
) VALUES
  ('fraud-v2.0.0-logistic', 'synthetic-demo-test-split (caf8ae97c06a0ce1)', 1600, 63, 0.9231, 0.9524, 0.9375, 0.0033, 0.9900, '{"tp": 60, "fp": 5, "tn": 1532, "fn": 3}'::jsonb, 'Held-out synthetic test split at validated threshold 0.83. Not validated on real transactions.'),
  ('rule-baseline-v1', 'synthetic-demo-test-split (caf8ae97c06a0ce1)', 1600, 63, 0.9608, 0.7778, 0.8596, 0.0013, 0.7560, '{"tp": 49, "fp": 2, "tn": 1535, "fn": 14}'::jsonb, 'Same held-out synthetic test split; rule baseline from ml/train.py.')
ON CONFLICT DO NOTHING;

-- Seed Synthetic Transactions
INSERT INTO public.transactions (
  id, external_transaction_id, customer_reference, amount, currency, channel,
  merchant_reference, timestamp, score, risk_level, decision, scoring_status,
  model_version, latency_ms, signals, explanation, case_id
) VALUES
  ('TXN-20481', 'EXT-98214', 'CUST-7A21', 184500.00, 'INR', 'UPI', 'MERCH-ELECTRONICS-09', now() - interval '2 minutes', 94, 'High', 'FLAG', 'SCORED', 'demo-seed', 18, ARRAY['Velocity spike', 'Amount anomaly', 'New device'], 'Multiple operational signals crossed the configured review threshold.', 'CASE-0081'),
  ('TXN-20482', 'EXT-98215', 'CUST-19D4', 2450.00, 'INR', 'Card', 'MERCH-GROCERY-01', now() - interval '3 minutes', 18, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 16, ARRAY['Known device'], 'Observed features are consistent with the low-risk profile.', NULL),
  ('TXN-20483', 'EXT-98216', 'CUST-3F90', 38600.00, 'INR', 'Net banking', 'MERCH-JEWELRY-04', now() - interval '5 minutes', 71, 'Medium', 'VERIFY', 'SCORED', 'demo-seed', 21, ARRAY['Unusual timing', 'Location change'], 'Elevated risk signals suggest step-up OTP verification.', 'CASE-0083'),
  ('TXN-20484', 'EXT-98217', 'CUST-0C62', 790.00, 'INR', 'UPI', 'MERCH-COFFEE-12', now() - interval '7 minutes', 9, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 14, ARRAY['Known device'], 'No configured risk rule was triggered.', NULL),
  ('TXN-20485', 'EXT-98218', 'CUST-8B13', 98200.00, 'INR', 'Card', 'MERCH-LUXURY-02', now() - interval '10 minutes', 86, 'High', 'FLAG', 'SCORED', 'demo-seed', 19, ARRAY['Repeated attempts', 'Amount anomaly'], 'Repeated attempts and a high amount contributed to the elevated score.', 'CASE-0082'),
  ('TXN-20486', 'EXT-98219', 'CUST-1E44', 5200.00, 'INR', 'Wallet', 'MERCH-UTILITY-05', now() - interval '14 minutes', 43, 'Medium', 'VERIFY', 'SCORED', 'demo-seed', 17, ARRAY['Device change'], 'One risk signal warrants lightweight verification step.', NULL),
  ('TXN-20487', 'EXT-98220', 'CUST-77A0', 1250.00, 'INR', 'UPI', 'MERCH-RETAIL-08', now() - interval '18 minutes', 12, 'Low', 'ALLOW', 'SCORED', 'demo-seed', 15, ARRAY['Known device'], 'Low estimated risk based on available demo features.', NULL),
  ('TXN-20488', 'EXT-98221', 'CUST-6D02', 44600.00, 'INR', 'Net banking', 'MERCH-TRAVEL-03', now() - interval '25 minutes', 78, 'High', 'FLAG', 'SCORED', 'demo-seed', 20, ARRAY['Velocity spike', 'Location change'], 'Multiple signals increased estimated risk.', 'CASE-0084')
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  score = EXCLUDED.score,
  decision = EXCLUDED.decision,
  case_id = EXCLUDED.case_id,
  updated_at = timezone('utc'::text, now());

-- Seed Explanations
INSERT INTO public.transaction_explanations (
  transaction_id, model_version, explanation_method,
  feature_attributions, summary_text, decision_trace
) VALUES
  (
    'TXN-20481',
    'fraud-v2.0.0-logistic',
    'Logistic regression log-odds contributions (w * x)',
    '[{"name":"amount_norm","value":37.24},{"name":"velocity_norm","value":6.48},{"name":"is_new_device","value":2.96},{"name":"channel_UPI","value":-1.75},{"name":"location_change","value":-0.25}]'::jsonb,
    'Amount (184,500 INR, far above the training average), 4 attempts and a new device dominate the log-odds; the UPI channel lowers them. Features reconstructed from the seed signals.',
    '[{"stage":"01","title":"Transaction received","detail":"Event accepted at gateway"},
      {"stage":"02","title":"Feature preparation","detail":"Amount, velocity, device, location and time features calculated"},
      {"stage":"03","title":"ML risk scoring","detail":"fraud-v2.0.0-logistic score: 1.000"},
      {"stage":"04","title":"Rule evaluation","detail":"Triggered: High Transaction Amount, Velocity Spike"},
      {"stage":"05","title":"Final decision","detail":"FLAG"}]'::jsonb
  )
ON CONFLICT DO NOTHING;

-- Seed Fraud Cases
INSERT INTO public.fraud_cases (
  id, case_reference, transaction_id, title, description, score,
  priority, status, analyst, assigned_analyst_name, notes, opened_at, updated_at
) VALUES
  ('CASE-0081', 'AEGIS-2026-0081', 'TXN-20481', 'Flagged High-Value UPI Transfer', 'Velocity spike and amount anomaly observed in short window.', 94, 'High', 'Open', 'Arjun Sharma', 'Arjun Sharma', '[{"text":"Velocity spike and amount anomaly require review.","at":"11:19","author":"System"}]'::jsonb, now() - interval '2 minutes', now()),
  ('CASE-0082', 'AEGIS-2026-0082', 'TXN-20485', 'Rapid Card Attempts Anomaly', 'Repeated transaction attempts exceeding threshold on luxury merchant.', 86, 'High', 'In review', 'R. Iyer', 'R. Iyer', '[{"text":"Reviewing repeated attempts across the session.","at":"11:17","author":"R. Iyer"}]'::jsonb, now() - interval '10 minutes', now()),
  ('CASE-0083', 'AEGIS-2026-0083', 'TXN-20483', 'Step-up Verification Escalation', 'Unusual login timing from new IP address.', 71, 'Medium', 'Open', 'Unassigned', 'Unassigned', '[]'::jsonb, now() - interval '20 minutes', now()),
  ('CASE-0084', 'AEGIS-2026-0084', 'TXN-20488', 'Cross-State Net Banking Transfer', 'Location discrepancy confirmed legitimate by cardholder.', 63, 'Medium', 'Resolved', 'Arjun Sharma', 'Arjun Sharma', '[{"text":"Customer verification completed.","at":"11:05","author":"Arjun Sharma"}]'::jsonb, now() - interval '45 minutes', now())
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::text, now());

-- Seed Case Activity
INSERT INTO public.case_activity (case_id, actor_name, activity_type, message)
VALUES
  ('CASE-0081', 'System Scorer', 'alert', 'Case auto-opened due to risk score 94 exceeding threshold 75.'),
  ('CASE-0081', 'Arjun Sharma', 'note', 'Customer contacted for out-of-band verification. Awaiting callback.'),
  ('CASE-0082', 'R. Iyer', 'assignment', 'Case assigned to Senior Investigator R. Iyer.'),
  ('CASE-0084', 'Arjun Sharma', 'status_change', 'Case marked Resolved after customer phone verification.')
ON CONFLICT DO NOTHING;

-- Seed Risk Rules
INSERT INTO public.risk_rules (
  id, name, description, feature, operator, threshold,
  severity, score_impact, enabled, version, modified, created_by, modified_by
) VALUES
  ('R-01', 'High Transaction Amount', 'Flag unusually large single transactions', 'amount', '>', 100000, 'High', 25, true, 1, 'Today, 10:42', 'Risk Team', 'Arjun Sharma'),
  ('R-02', 'Repeated Transaction Attempts', 'Detect repeated attempts in a 5-minute sliding window', 'attempt_count', '>=', 4, 'High', 30, true, 1, 'Today, 09:18', 'Risk Team', 'System'),
  ('R-03', 'Unusual Transaction Timing', 'Flag transactions originating in low-velocity night hours', 'hour_of_day', 'outside', 6, 'Medium', 12, true, 1, 'Yesterday', 'Risk Team', 'Arjun Sharma'),
  ('R-04', 'Multiple Risk Signals', 'Escalate transaction if 3 or more concurrent risk signals are raised', 'risk_signal_count', '>=', 3, 'Medium', 18, false, 1, 'Oct 12', 'Risk Team', 'R. Iyer')
ON CONFLICT (id) DO UPDATE SET
  threshold = EXCLUDED.threshold,
  score_impact = EXCLUDED.score_impact,
  enabled = EXCLUDED.enabled,
  modified = EXCLUDED.modified,
  updated_at = timezone('utc'::text, now());

-- Seed Immutable Audit Logs
INSERT INTO public.audit_logs (
  id, timestamp, actor, role, action, resource_type,
  resource_id, result, details, metadata
) VALUES
  ('AUD-91A2', now() - interval '2 minutes', 'risk-engine', 'System', 'Transaction scored', 'Transaction', 'TXN-20481', 'Review', 'Risk score 94; decision FLAG; demo seed record.', '{"score": 94, "decision": "FLAG"}'::jsonb),
  ('AUD-91A1', now() - interval '5 minutes', 'Arjun Sharma', 'Analyst', 'Fraud case opened', 'Case', 'CASE-0081', 'Success', 'Case created for high-risk transaction.', '{"case_id": "CASE-0081"}'::jsonb),
  ('AUD-91A0', now() - interval '1 hour', 'Arjun Sharma', 'Analyst', 'Risk rule updated', 'Risk rule', 'R-01', 'Success', 'High Transaction Amount threshold reviewed.', '{"threshold": 100000}'::jsonb),
  ('AUD-919F', now() - interval '2 hours', 'model-service', 'System', 'Model evaluated', 'Model', 'fraud-v2.0.0-logistic', 'Success', 'Held-out synthetic test split evaluation completed.', '{"f1": 0.9375}'::jsonb),
  ('AUD-919E', now() - interval '3 hours', 'R. Iyer', 'Analyst', 'Analyst note added', 'Case', 'CASE-0082', 'Success', 'Added investigation note regarding repeated attempts.', '{"author": "R. Iyer"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Notification Events
INSERT INTO public.notification_events (
  recipient_id, recipient_role, title, message, severity, link_ref, read, created_at
) VALUES
  (NULL, 'fraud_analyst', 'High-Risk Spike Detected', 'Transaction TXN-20481 flagged with risk score 94/100 (Velocity Anomaly).', 'high', 'TXN-20481', false, now() - interval '10 minutes'),
  (NULL, 'fraud_analyst', 'Model Disagreement Alert', 'High score divergence detected between Random Forest v1.8.2 and LightGBM on TXN-20485.', 'medium', 'TXN-20485', false, now() - interval '35 minutes'),
  (NULL, 'administrator', 'Population Drift Warning', 'Aggregate PSI reached 0.28 on Amount & Velocity features exceeding tolerance.', 'high', NULL, false, now() - interval '2 hours'),
  (NULL, 'investigator', 'Case Assignment', 'Fraud Case CASE-0084 assigned for investigation.', 'info', 'CASE-0084', true, now() - interval '4 hours')
ON CONFLICT DO NOTHING;

-- Seed User Feedback / Verified Dispositions
INSERT INTO public.user_feedback (
  case_id, transaction_id, customer_reference, amount, initial_score,
  analyst_outcome, analyst_name, provenance, status, verified_at
) VALUES
  ('CASE-0084', 'TXN-20488', 'CUST-6D02', 44600.00, 78, 'False Positive', 'Arjun Sharma', 'manual_triage', 'Queued for Retraining', now() - interval '45 minutes'),
  ('CASE-0081', 'TXN-20481', 'CUST-7A21', 184500.00, 94, 'Confirmed Fraud', 'Arjun Sharma', 'manual_triage', 'Queued for Retraining', now() - interval '2 minutes')
ON CONFLICT DO NOTHING;

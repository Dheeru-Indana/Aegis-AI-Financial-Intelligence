-- ====================================================================
-- AegisAI Financial Intelligence & Fraud Detection Platform
-- Comprehensive PostgreSQL Schema with Multi-Role Row Level Security (RLS)
-- File: supabase/migrations/20261015000001_enterprise_schema.sql
-- ====================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('administrator', 'fraud_analyst', 'investigator', 'auditor');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE decision_type AS ENUM ('ALLOW', 'VERIFY', 'FLAG');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE case_status_type AS ENUM ('Open', 'Investigating', 'Escalated', 'Resolved', 'False Positive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE case_priority_type AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE rule_severity_type AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE audit_result_type AS ENUM ('Success', 'Review', 'Blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE job_status_type AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. PROFILES & ROLE-BASED ACCESS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT 'Analyst',
  role user_role NOT NULL DEFAULT 'fraud_analyst',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to prevent self-elevation of role
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'administrator'
    ) THEN
      RAISE EXCEPTION 'Only administrators can modify user roles';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.check_profile_role_update();

-- 3. TRANSACTIONS & NORMALIZED METADATA
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  external_transaction_id TEXT,
  customer_reference TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  channel TEXT NOT NULL,
  merchant_reference TEXT,
  source_identifier TEXT NOT NULL DEFAULT 'web_gateway',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  decision decision_type NOT NULL,
  scoring_status TEXT NOT NULL DEFAULT 'SCORED',
  model_version TEXT NOT NULL DEFAULT 'fraud-v1.8.2',
  latency_ms INTEGER NOT NULL DEFAULT 18,
  signals TEXT[] NOT NULL DEFAULT '{}',
  explanation TEXT,
  case_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_score ON public.transactions(score DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_decision ON public.transactions(decision);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON public.transactions(customer_reference);

-- 4. TRANSACTION FEATURES (Model input provenance & PCA components)
CREATE TABLE IF NOT EXISTS public.transaction_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  feature_version TEXT NOT NULL DEFAULT 'v1',
  raw_features JSONB NOT NULL DEFAULT '{}'::jsonb,
  pca_components JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_txn_features_txid ON public.transaction_features(transaction_id);

-- 5. FRAUD CASES
CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id TEXT PRIMARY KEY,
  case_reference TEXT UNIQUE NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  score INTEGER NOT NULL,
  priority case_priority_type NOT NULL DEFAULT 'Medium',
  status case_status_type NOT NULL DEFAULT 'Open',
  assigned_analyst_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_analyst_name TEXT NOT NULL DEFAULT 'Unassigned',
  resolution_outcome TEXT,
  resolution_notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON public.fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_priority ON public.fraud_cases(priority);
CREATE INDEX IF NOT EXISTS idx_fraud_cases_tx ON public.fraud_cases(transaction_id);

-- 6. CASE ACTIVITY & TIMELINE
CREATE TABLE IF NOT EXISTS public.case_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id TEXT NOT NULL REFERENCES public.fraud_cases(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'note', 'assignment', 'status_change', 'escalation'
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_case_activity_case_id ON public.case_activity(case_id, created_at DESC);

-- 7. RISK RULES
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  feature TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>', '>=', '<', '<=', '==', '!=', 'outside')),
  threshold NUMERIC NOT NULL,
  severity rule_severity_type NOT NULL DEFAULT 'Medium',
  score_impact INTEGER NOT NULL CHECK (score_impact BETWEEN 1 AND 50),
  enabled BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL DEFAULT 'System',
  modified_by TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. MODEL REGISTRY
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

-- 9. MODEL EVALUATIONS
CREATE TABLE IF NOT EXISTS public.model_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 10. TRANSACTION EXPLANATIONS
CREATE TABLE IF NOT EXISTS public.transaction_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  model_version TEXT NOT NULL,
  explanation_method TEXT NOT NULL DEFAULT 'SHAP-inspired',
  feature_attributions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_text TEXT NOT NULL,
  decision_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. INGESTION JOBS
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_filename TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  accepted_records INTEGER NOT NULL DEFAULT 0,
  rejected_records INTEGER NOT NULL DEFAULT 0,
  duplicate_records INTEGER NOT NULL DEFAULT 0,
  status job_status_type NOT NULL DEFAULT 'Pending',
  error_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ
);

-- 12. IMMUTABLE AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  actor TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  result audit_result_type NOT NULL DEFAULT 'Success',
  details TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Strict immutability protection trigger on audit_logs: NO UPDATES OR DELETES
CREATE OR REPLACE FUNCTION public.prevent_audit_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are append-only and cannot be altered or removed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_tampering ON public.audit_logs;
CREATE TRIGGER tr_audit_tampering
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_tampering();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

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

-- Helper function to fetch current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Authenticated users can read all profiles; users can update their own display_name
CREATE POLICY "Profiles readable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can edit own profile details"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Transactions: All authenticated roles can view transactions
CREATE POLICY "Transactions viewable by authenticated users"
  ON public.transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transactions insertable by analysts and admins"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

CREATE POLICY "Transactions updatable by analysts and admins"
  ON public.transactions FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- Transaction features & explanations
-- Transaction features & explanations: Authenticated only
CREATE POLICY "Features viewable by authenticated users"
  ON public.transaction_features FOR SELECT TO authenticated USING (true);

CREATE POLICY "Features insertable by analysts and admins"
  ON public.transaction_features FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

CREATE POLICY "Explanations viewable by authenticated users"
  ON public.transaction_explanations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Explanations insertable by analysts and admins"
  ON public.transaction_explanations FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- Fraud Cases: viewable by authenticated users; updatable by investigators, analysts, admins
CREATE POLICY "Cases readable by authenticated users"
  ON public.fraud_cases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Cases insertable by investigators, analysts, admins"
  ON public.fraud_cases FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

CREATE POLICY "Cases updatable by investigators, analysts, admins"
  ON public.fraud_cases FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- Case activity:
CREATE POLICY "Activity readable by authenticated users"
  ON public.case_activity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Activity insertable by investigators, analysts, admins"
  ON public.case_activity FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- Risk rules: viewable by all authenticated users; manageable strictly by admins and analysts
CREATE POLICY "Risk rules readable by authenticated users"
  ON public.risk_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Risk rules editable by admins and analysts"
  ON public.risk_rules FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- Models & Evaluations: Read-only for authenticated roles; manageable strictly by administrators
CREATE POLICY "Models readable by authenticated users"
  ON public.model_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Models manageable by admins"
  ON public.model_registry FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

CREATE POLICY "Evaluations readable by authenticated users"
  ON public.model_evaluations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Evaluations manageable by admins"
  ON public.model_evaluations FOR ALL TO authenticated
  USING (public.current_user_role() = 'administrator');

-- Ingestion jobs:
CREATE POLICY "Ingestion jobs readable by authenticated users"
  ON public.ingestion_jobs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Ingestion jobs insertable by analysts and admins"
  ON public.ingestion_jobs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('administrator', 'fraud_analyst'));

-- Audit logs: Strict Read-only for auditors, analysts and admins; Append-only insert by authenticated users
CREATE POLICY "Audit logs readable by auditors and admins"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('administrator', 'auditor', 'fraud_analyst'));

CREATE POLICY "Audit logs append-only by authenticated users"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ====================================================================
-- REALTIME SUBSCRIPTIONS
-- ====================================================================
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
END $$;

-- ====================================================================
-- SEED DATA (Realistic, Audit-ready Financial Data)
-- ====================================================================

INSERT INTO public.model_registry (id, name, version, algorithm, training_dataset_reference, deployment_status, is_active, evaluation_summary, created_by)
VALUES
  ('fraud-v1.8.2', 'Fraud Risk Ensemble', 'v1.8.2', 'Random Forest Classifier', 'ULB Credit Card Fraud (284,807 transactions)', 'deployed', true, '{"precision": 0.948, "recall": 0.824, "f1": 0.881, "fpr": 0.0008, "latency_ms": 18}'::jsonb, 'MLOps Team'),
  ('lr-v0.1', 'Baseline Risk Scorer', 'v0.1.0', 'Logistic Regression', 'ULB Credit Card Fraud (284,807 transactions)', 'candidate', false, '{"precision": 0.882, "recall": 0.710, "f1": 0.787, "fpr": 0.0022, "latency_ms": 4}'::jsonb, 'MLOps Team')
ON CONFLICT (id) DO UPDATE SET updated_at = now();

INSERT INTO public.model_evaluations (model_id, dataset_version, total_samples, fraud_samples, precision, recall, f1_score, fpr, pr_auc, confusion_matrix, notes)
VALUES
  ('fraud-v1.8.2', 'ULB-2026-Q3-TEST', 56962, 98, 0.9480, 0.8240, 0.8810, 0.0008, 0.8730, '{"tp": 81, "fp": 4, "tn": 56860, "fn": 17}'::jsonb, 'Evaluated at default probability threshold 0.75')
ON CONFLICT DO NOTHING;

INSERT INTO public.transactions (id, external_transaction_id, customer_reference, amount, currency, channel, merchant_reference, timestamp, score, risk_level, decision, scoring_status, model_version, latency_ms, signals, explanation, case_id)
VALUES
  ('TXN-20481', 'EXT-98214', 'CUST-7A21', 184500.00, 'INR', 'UPI', 'MERCH-ELECTRONICS-09', now() - interval '2 minutes', 94, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 18, ARRAY['Velocity spike', 'Amount anomaly', 'New device'], 'Multiple operational signals crossed the configured review threshold.', 'CASE-0081'),
  ('TXN-20482', 'EXT-98215', 'CUST-19D4', 2450.00, 'INR', 'Card', 'MERCH-GROCERY-01', now() - interval '3 minutes', 18, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 16, ARRAY['Known device'], 'Observed features are consistent with the low-risk profile.', NULL),
  ('TXN-20483', 'EXT-98216', 'CUST-3F90', 38600.00, 'INR', 'Net banking', 'MERCH-JEWELRY-04', now() - interval '5 minutes', 71, 'Medium', 'VERIFY', 'SCORED', 'fraud-v1.8.2', 21, ARRAY['Unusual timing', 'Location change'], 'Elevated risk signals suggest step-up OTP verification.', 'CASE-0083'),
  ('TXN-20484', 'EXT-98217', 'CUST-0C62', 790.00, 'INR', 'UPI', 'MERCH-COFFEE-12', now() - interval '7 minutes', 9, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 14, ARRAY['Known device'], 'No configured risk rule was triggered.', NULL),
  ('TXN-20485', 'EXT-98218', 'CUST-8B13', 98200.00, 'INR', 'Card', 'MERCH-LUXURY-02', now() - interval '10 minutes', 86, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 19, ARRAY['Repeated attempts', 'Amount anomaly'], 'Repeated attempts and a high amount contributed to the elevated score.', 'CASE-0082'),
  ('TXN-20486', 'EXT-98219', 'CUST-1E44', 5200.00, 'INR', 'Wallet', 'MERCH-UTILITY-05', now() - interval '14 minutes', 43, 'Medium', 'VERIFY', 'SCORED', 'fraud-v1.8.2', 17, ARRAY['Device change'], 'One risk signal warrants lightweight verification step.', NULL),
  ('TXN-20487', 'EXT-98220', 'CUST-77A0', 1250.00, 'INR', 'UPI', 'MERCH-RETAIL-08', now() - interval '18 minutes', 12, 'Low', 'ALLOW', 'SCORED', 'fraud-v1.8.2', 15, ARRAY['Known device'], 'Low estimated risk based on available demo features.', NULL),
  ('TXN-20488', 'EXT-98221', 'CUST-6D02', 44600.00, 'INR', 'Net banking', 'MERCH-TRAVEL-03', now() - interval '25 minutes', 78, 'High', 'FLAG', 'SCORED', 'fraud-v1.8.2', 20, ARRAY['Velocity spike', 'Location change'], 'Multiple signals increased estimated risk.', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transaction_explanations (transaction_id, model_version, explanation_method, feature_attributions, summary_text, decision_trace)
VALUES
  ('TXN-20481', 'fraud-v1.8.2', 'SHAP Feature Attribution',
   '[{"name":"V14","value":0.31},{"name":"V12","value":0.24},{"name":"V10","value":0.18},{"name":"V4","value":-0.12},{"name":"V17","value":-0.08}]'::jsonb,
   'High amount and velocity spike along with PCA component V14 deviation triggered an automated FLAG decision.',
   '[{"stage":"01","title":"Transaction received","detail":"Event accepted at gateway"},
     {"stage":"02","title":"Feature preparation","detail":"PCA features & velocity metrics calculated"},
     {"stage":"03","title":"ML risk scoring","detail":"Estimated raw score: 94/100"},
     {"stage":"04","title":"Rule evaluation","detail":"Triggered: High Transaction Amount, Velocity Spike"},
     {"stage":"05","title":"Final decision","detail":"FLAG"}]'::jsonb
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.fraud_cases (id, case_reference, transaction_id, title, description, score, priority, status, assigned_analyst_name, opened_at, updated_at)
VALUES
  ('CASE-0081', 'AEGIS-2026-0081', 'TXN-20481', 'Flagged High-Value UPI Transfer', 'Velocity spike and amount anomaly observed in short window.', 94, 'High', 'Open', 'Arjun Sharma', now() - interval '2 minutes', now()),
  ('CASE-0082', 'AEGIS-2026-0082', 'TXN-20485', 'Rapid Card Attempts Anomaly', 'Repeated transaction attempts exceeding threshold on luxury merchant.', 86, 'High', 'Investigating', 'R. Iyer', now() - interval '10 minutes', now()),
  ('CASE-0083', 'AEGIS-2026-0083', 'TXN-20483', 'Step-up Verification Escalation', 'Unusual login timing from new IP address.', 71, 'Medium', 'Open', 'Unassigned', now() - interval '20 minutes', now()),
  ('CASE-0084', 'AEGIS-2026-0084', 'TXN-20488', 'Cross-State Net Banking Transfer', 'Location discrepancy confirmed legitimate by cardholder.', 63, 'Medium', 'Resolved', 'Arjun Sharma', now() - interval '45 minutes', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.case_activity (case_id, actor_name, activity_type, message)
VALUES
  ('CASE-0081', 'System Scorer', 'alert', 'Case auto-opened due to risk score 94 exceeding threshold 75.'),
  ('CASE-0081', 'Arjun Sharma', 'note', 'Customer contacted for out-of-band verification. Awaiting callback.'),
  ('CASE-0082', 'R. Iyer', 'assignment', 'Case assigned to Senior Investigator R. Iyer.'),
  ('CASE-0084', 'Arjun Sharma', 'status_change', 'Case marked Resolved after customer phone verification.')
ON CONFLICT DO NOTHING;

INSERT INTO public.risk_rules (id, name, description, feature, operator, threshold, severity, score_impact, enabled, version, created_by, modified_by)
VALUES
  ('R-01', 'High Transaction Amount', 'Flag unusually large single transactions', 'amount', '>', 100000, 'High', 25, true, 1, 'Risk Team', 'Arjun Sharma'),
  ('R-02', 'Repeated Transaction Attempts', 'Detect repeated attempts in a 5-minute sliding window', 'attempt_count', '>=', 4, 'High', 30, true, 1, 'Risk Team', 'System'),
  ('R-03', 'Unusual Transaction Timing', 'Flag transactions originating in low-velocity night hours', 'hour_of_day', 'outside', 6, 'Medium', 12, true, 1, 'Risk Team', 'Arjun Sharma'),
  ('R-04', 'Multiple Risk Signals', 'Escalate transaction if 3 or more concurrent risk signals are raised', 'risk_signal_count', '>=', 3, 'Medium', 18, false, 1, 'Risk Team', 'R. Iyer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (id, timestamp, actor, role, action, resource_type, resource_id, result, details, metadata)
VALUES
  ('AUD-91A2', now() - interval '2 minutes', 'risk-engine', 'System', 'Transaction scored', 'Transaction', 'TXN-20481', 'Review', 'Risk score 94; decision FLAG; model fraud-v1.8.2.', '{"score": 94, "decision": "FLAG"}'::jsonb),
  ('AUD-91A1', now() - interval '5 minutes', 'Arjun Sharma', 'Analyst', 'Fraud case opened', 'Case', 'CASE-0081', 'Success', 'Case created for high-risk transaction.', '{"case_id": "CASE-0081"}'::jsonb),
  ('AUD-91A0', now() - interval '1 hour', 'Arjun Sharma', 'Analyst', 'Risk rule updated', 'Risk rule', 'R-01', 'Success', 'High Transaction Amount threshold reviewed.', '{"threshold": 100000}'::jsonb),
  ('AUD-919F', now() - interval '2 hours', 'model-service', 'System', 'Model evaluated', 'Model', 'fraud-v1.8.2', 'Success', 'Evaluation run on test dataset completed.', '{"f1": 0.881}'::jsonb),
  ('AUD-919E', now() - interval '3 hours', 'R. Iyer', 'Analyst', 'Analyst note added', 'Case', 'CASE-0082', 'Success', 'Added investigation note regarding repeated attempts.', '{"author": "R. Iyer"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

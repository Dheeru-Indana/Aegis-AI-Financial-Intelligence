-- AegisAI Financial Intelligence - Initial Supabase Schema Migration
-- Idempotent script: Safe to run in Supabase SQL Editor

-- 1. Profiles Table (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Analyst',
  role TEXT NOT NULL CHECK (role IN ('analyst', 'senior_analyst', 'admin', 'viewer')) DEFAULT 'analyst',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  amount NUMERIC(12, 2) NOT NULL,
  channel TEXT NOT NULL,
  customer TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'VERIFY', 'FLAG')),
  signals TEXT[] NOT NULL DEFAULT '{}',
  model_version TEXT NOT NULL DEFAULT 'fraud-v1.8.2',
  latency INTEGER NOT NULL DEFAULT 18,
  explanation TEXT,
  case_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Fraud Cases Table
CREATE TABLE IF NOT EXISTS public.fraud_cases (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
  analyst TEXT NOT NULL DEFAULT 'Unassigned',
  analyst_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('Open', 'In review', 'Resolved')) DEFAULT 'Open',
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Risk Rules Table
CREATE TABLE IF NOT EXISTS public.risk_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  feature TEXT NOT NULL,
  operator TEXT NOT NULL,
  threshold NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High')),
  impact INTEGER NOT NULL DEFAULT 10,
  enabled BOOLEAN NOT NULL DEFAULT true,
  modified TEXT NOT NULL DEFAULT 'Just now',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Audit Logs Table (Immutable audit trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  actor TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Analyst',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Success', 'Review', 'Blocked')),
  details TEXT
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone authenticated can read profiles; users can update their own profile
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Transactions: Authenticated users can view transactions; authenticated users can insert/update (or service role)
CREATE POLICY "Transactions viewable by authenticated users"
  ON public.transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Transactions can be inserted by authenticated users"
  ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Transactions can be updated by authenticated users"
  ON public.transactions FOR UPDATE TO authenticated USING (true);

-- Also allow public anon read access if anonymous demo reading is desired:
CREATE POLICY "Transactions readable by anon for demo"
  ON public.transactions FOR SELECT TO anon USING (true);

CREATE POLICY "Transactions insertable by anon for demo"
  ON public.transactions FOR INSERT TO anon WITH CHECK (true);

-- Fraud Cases:
CREATE POLICY "Cases viewable by all"
  ON public.fraud_cases FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Cases insertable by all"
  ON public.fraud_cases FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Cases updatable by all"
  ON public.fraud_cases FOR UPDATE TO authenticated, anon USING (true);

-- Risk Rules:
CREATE POLICY "Rules viewable by all"
  ON public.risk_rules FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Rules editable by authenticated and anon"
  ON public.risk_rules FOR ALL TO authenticated, anon USING (true);

-- Audit Logs: Read-only for everyone; inserts permitted; updates & deletes strictly prohibited
CREATE POLICY "Audit logs readable by all"
  ON public.audit_logs FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Audit logs insertable by all"
  ON public.audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);

-- ==========================================
-- REALTIME REPLICATION ENABLEMENT
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'fraud_cases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fraud_cases;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;

-- ==========================================
-- SEED INITIAL SEED DATA
-- ==========================================

INSERT INTO public.transactions (id, timestamp, amount, channel, customer, score, decision, signals, model_version, latency, explanation, case_id)
VALUES
  ('TXN-20481', '2026-10-15 11:18:42+00', 184500, 'UPI', 'CUST-7A21', 94, 'FLAG', ARRAY['Velocity spike','Amount anomaly','New device'], 'fraud-v1.8.2', 18, 'Multiple operational signals crossed the configured review threshold.', 'CASE-0081'),
  ('TXN-20482', '2026-10-15 11:18:39+00', 2450, 'Card', 'CUST-19D4', 18, 'ALLOW', ARRAY['Known device'], 'fraud-v1.8.2', 16, 'Observed features are consistent with the low-risk profile.', NULL),
  ('TXN-20483', '2026-10-15 11:18:33+00', 38600, 'Net banking', 'CUST-3F90', 71, 'VERIFY', ARRAY['Unusual timing','Location change'], 'fraud-v1.8.2', 21, 'Elevated risk signals suggest additional verification.', 'CASE-0083'),
  ('TXN-20484', '2026-10-15 11:18:27+00', 790, 'UPI', 'CUST-0C62', 9, 'ALLOW', ARRAY['Known device'], 'fraud-v1.8.2', 14, 'No configured risk rule was triggered.', NULL),
  ('TXN-20485', '2026-10-15 11:18:14+00', 98200, 'Card', 'CUST-8B13', 86, 'FLAG', ARRAY['Repeated attempts','Amount anomaly'], 'fraud-v1.8.2', 19, 'Repeated attempts and a high amount contributed to the elevated score.', 'CASE-0082'),
  ('TXN-20486', '2026-10-15 11:17:58+00', 5200, 'Wallet', 'CUST-1E44', 43, 'VERIFY', ARRAY['Device change'], 'fraud-v1.8.2', 17, 'One risk signal warrants a lightweight verification step.', NULL),
  ('TXN-20487', '2026-10-15 11:17:42+00', 1250, 'UPI', 'CUST-77A0', 12, 'ALLOW', ARRAY['Known device'], 'fraud-v1.8.2', 15, 'Low estimated risk based on available demo features.', NULL),
  ('TXN-20488', '2026-10-15 11:17:21+00', 44600, 'Net banking', 'CUST-6D02', 78, 'FLAG', ARRAY['Velocity spike','Location change'], 'fraud-v1.8.2', 20, 'Multiple signals increased estimated risk.', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fraud_cases (id, transaction_id, score, priority, analyst, status, notes, created_at, updated_at)
VALUES
  ('CASE-0081', 'TXN-20481', 94, 'High', 'A. Sharma', 'Open', '[{"text":"Velocity spike and amount anomaly require review.","at":"11:19","author":"System"}]'::jsonb, now() - interval '10 minutes', now()),
  ('CASE-0082', 'TXN-20485', 86, 'High', 'R. Iyer', 'In review', '[{"text":"Reviewing repeated attempts across the session.","at":"11:17","author":"R. Iyer"}]'::jsonb, now() - interval '20 minutes', now()),
  ('CASE-0083', 'TXN-20483', 71, 'Medium', 'Unassigned', 'Open', '[]'::jsonb, now() - interval '30 minutes', now()),
  ('CASE-0084', 'TXN-20481', 63, 'Medium', 'A. Sharma', 'Resolved', '[{"text":"Customer verification completed.","at":"11:05","author":"A. Sharma"}]'::jsonb, now() - interval '60 minutes', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.risk_rules (id, name, description, feature, operator, threshold, severity, impact, enabled, modified)
VALUES
  ('R-01', 'High Transaction Amount', 'Flag unusually large transaction amounts', 'amount', '>', 100000, 'High', 25, true, 'Today, 10:42'),
  ('R-02', 'Repeated Transaction Attempts', 'Detect repeated attempts in a short window', 'attempt_count', '>=', 4, 'High', 30, true, 'Today, 09:18'),
  ('R-03', 'Unusual Transaction Timing', 'Review transactions outside expected hours', 'hour_of_day', 'outside', 6, 'Medium', 12, true, 'Yesterday'),
  ('R-04', 'Multiple Risk Signals', 'Escalate when multiple signals are present', 'risk_signal_count', '>=', 3, 'Medium', 18, false, 'Oct 12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.audit_logs (id, timestamp, actor, role, action, resource_type, resource_id, result, details)
VALUES
  ('AUD-91A2', now() - interval '2 minutes', 'risk-engine', 'System', 'Transaction scored', 'Transaction', 'TXN-20481', 'Review', 'Risk score 94; decision FLAG; model fraud-v1.8.2.'),
  ('AUD-91A1', now() - interval '5 minutes', 'A. Sharma', 'Analyst', 'Fraud case opened', 'Case', 'CASE-0081', 'Success', 'Case created for high-risk transaction.'),
  ('AUD-91A0', now() - interval '1 hour', 'A. Sharma', 'Analyst', 'Risk rule updated', 'Risk rule', 'R-01', 'Success', 'High Transaction Amount threshold reviewed.'),
  ('AUD-919F', now() - interval '2 hours', 'model-service', 'System', 'Model evaluated', 'Model', 'fraud-v1.8.2', 'Success', 'Evaluation event for model version.'),
  ('AUD-919E', now() - interval '3 hours', 'R. Iyer', 'Analyst', 'Analyst note added', 'Case', 'CASE-0082', 'Success', 'Added investigation note.')
ON CONFLICT (id) DO NOTHING;

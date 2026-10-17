-- ==============================================================================
-- AegisAI Financial Intelligence - Schema Verification & Audit Queries
-- File: supabase/setup/04_verify.sql
-- Mode: READ-ONLY (Safe to run in all environments)
-- ==============================================================================
-- PURPOSE:
-- 1. Confirm that all 13 canonical tables exist in the 'public' schema.
-- 2. Confirm that all required enum types and their permitted labels exist.
-- 3. Verify that Row Level Security (RLS) is ENABLED on every application table.
-- 4. Audit active RLS policies to guarantee NO UNINTENDED ANONYMOUS WRITE access.
-- 5. Verify dual-compatibility columns (customer_reference & customer, latency_ms & latency).
-- 6. Audit database triggers and audit log immutability protections.
-- 7. Audit Supabase Realtime publication tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- CHECK 1: Table Inventory & RLS Verification
-- All 13 tables must appear with rls_enabled = true
-- ------------------------------------------------------------------------------
WITH expected_tables(name) AS (
  VALUES
    ('profiles'),
    ('transactions'),
    ('transaction_features'),
    ('fraud_cases'),
    ('case_activity'),
    ('risk_rules'),
    ('model_registry'),
    ('model_evaluations'),
    ('transaction_explanations'),
    ('ingestion_jobs'),
    ('audit_logs'),
    ('notification_events'),
    ('user_feedback')
)
SELECT
  e.name AS expected_table,
  t.tablename IS NOT NULL AS exists,
  COALESCE(t.rowsecurity, false) AS rls_enabled,
  CASE
    WHEN t.tablename IS NULL THEN 'MISSING TABLE'
    WHEN NOT t.rowsecurity THEN 'RLS DISABLED - SECURITY HAZARD'
    ELSE 'OK'
  END AS status
FROM expected_tables e
LEFT JOIN pg_tables t
  ON t.tablename = e.name AND t.schemaname = 'public'
ORDER BY e.name;

-- ------------------------------------------------------------------------------
-- CHECK 2: Enum Types & Allowed Values
-- Confirms user_role, decision_type, etc. are properly defined
-- ------------------------------------------------------------------------------
SELECT
  t.typname AS enum_type,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS allowed_labels
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- ------------------------------------------------------------------------------
-- CHECK 3: Security Audit - Anonymous Permissions & Unintended Write Policies
-- Expected Result: Zero rows for anon INSERT/UPDATE/DELETE/ALL
-- ------------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  'FAIL: Anonymous write policy detected' AS security_alert
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles)
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

-- ------------------------------------------------------------------------------
-- CHECK 4: Complete RLS Policy Audit
-- Lists all active policies, their targeted commands, and permitted roles
-- ------------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ------------------------------------------------------------------------------
-- CHECK 5: Dual-Compatibility Columns in Transactions Table
-- Confirms both customer_reference & customer, latency_ms & latency exist
-- ------------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  is_generated
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transactions'
  AND column_name IN ('customer_reference', 'customer', 'latency_ms', 'latency', 'amount', 'score', 'decision')
ORDER BY ordinal_position;

-- ------------------------------------------------------------------------------
-- CHECK 6: Foreign Key Relationships
-- Confirms referential integrity is established across child and parent tables
-- ------------------------------------------------------------------------------
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ------------------------------------------------------------------------------
-- CHECK 7: Database Triggers & Immutability Protections
-- Confirms tr_audit_tampering and tr_protect_profile_role are active
-- ------------------------------------------------------------------------------
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ------------------------------------------------------------------------------
-- CHECK 8: Realtime Publication Tables
-- Confirms realtime event streaming is enabled for client telemetry
-- ------------------------------------------------------------------------------
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

-- ------------------------------------------------------------------------------
-- CHECK 9: Table Row Counts (Post-Seed Sanity Check)
-- ------------------------------------------------------------------------------
SELECT
  table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::int AS approximate_row_count
FROM (
  SELECT
    table_name,
    query_to_xml(format('SELECT count(*) AS cnt FROM public.%I', table_name), false, true, '') AS xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
) counts
ORDER BY table_name;

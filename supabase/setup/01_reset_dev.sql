-- ==============================================================================
-- AegisAI Financial Intelligence - Selective Development Reset Script
-- File: supabase/setup/01_reset_dev.sql
-- Mode: DESTRUCTIVE (Development and Staging environments ONLY)
-- ==============================================================================
-- WARNING:
-- This script drops all AegisAI application-owned tables, views, functions,
-- triggers, and enum types in the 'public' schema.
--
-- WHAT THIS SCRIPT DELETES:
--   - All application tables: notification_events, user_feedback,
--     transaction_explanations, transaction_features, case_activity,
--     fraud_cases, transactions, risk_rules, model_evaluations,
--     model_registry, ingestion_jobs, audit_logs, profiles.
--   - All custom application triggers, functions, and enums.
--   - All data currently stored inside these application tables.
--
-- WHAT THIS SCRIPT NEVER TOUCHES (IMMUTABLE SAFEGUARDS):
--   - It NEVER drops schema 'public' or executes `DROP SCHEMA ... CASCADE`.
--   - It NEVER drops or deletes `auth.users`, auth identities, or auth tokens.
--   - It NEVER touches storage buckets, realtime internals, or Supabase extensions.
--   - It drops application objects strictly in reverse foreign-key dependency order.
--
-- SAFETY CONFIRMATION REQUIREMENT:
-- To prevent accidental execution in production, this script contains an explicit
-- safety latch: v_confirm_destructive_reset MUST be changed from FALSE to TRUE
-- before execution.
-- ==============================================================================

DO $$
DECLARE
  -- SAFETY LATCH: Set this to TRUE only after verifying your database is a DEV instance.
  v_confirm_destructive_reset BOOLEAN := FALSE;
BEGIN
  IF NOT v_confirm_destructive_reset THEN
    RAISE EXCEPTION 'SAFETY STOP: Selective reset aborted. You must open supabase/setup/01_reset_dev.sql and set v_confirm_destructive_reset := TRUE before executing in the Supabase SQL Editor.';
  END IF;

  RAISE NOTICE 'Executing AegisAI selective application reset...';
END $$;

-- 1. Remove Tables from Supabase Realtime Publication (Safe No-Op if not published)
DO $$
DECLARE
  v_tbl RECORD;
BEGIN
  FOR v_tbl IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename IN (
        'notification_events', 'user_feedback', 'case_activity',
        'fraud_cases', 'transactions', 'audit_logs'
      )
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', v_tbl.tablename);
    RAISE NOTICE 'Removed public.% from supabase_realtime publication', v_tbl.tablename;
  END LOOP;
END $$;

-- 2. Drop Triggers on Application Tables
DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
DROP TRIGGER IF EXISTS tr_audit_tampering ON public.audit_logs;
DROP TRIGGER IF EXISTS tr_prevent_audit_tampering ON public.audit_logs;

-- 3. Drop Views (if any exist)
DROP VIEW IF EXISTS public.v_transaction_overview CASCADE;
DROP VIEW IF EXISTS public.v_fraud_case_queue CASCADE;

-- 4. Drop Application Tables in Reverse-Dependency Order
-- Leaf child tables first, then parent tables, to prevent foreign-key lockouts
DROP TABLE IF EXISTS public.notification_events CASCADE;
DROP TABLE IF EXISTS public.user_feedback CASCADE;
DROP TABLE IF EXISTS public.case_activity CASCADE;
DROP TABLE IF EXISTS public.transaction_explanations CASCADE;
DROP TABLE IF EXISTS public.transaction_features CASCADE;
DROP TABLE IF EXISTS public.fraud_cases CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.risk_rules CASCADE;
DROP TABLE IF EXISTS public.model_evaluations CASCADE;
DROP TABLE IF EXISTS public.model_registry CASCADE;
DROP TABLE IF EXISTS public.ingestion_jobs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 5. Drop Application Helper Functions
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.check_profile_role_update() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_audit_tampering() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 6. Drop Application Custom Types / Enums
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.decision_type CASCADE;
DROP TYPE IF EXISTS public.case_status_type CASCADE;
DROP TYPE IF EXISTS public.case_priority_type CASCADE;
DROP TYPE IF EXISTS public.rule_severity_type CASCADE;
DROP TYPE IF EXISTS public.audit_result_type CASCADE;
DROP TYPE IF EXISTS public.job_status_type CASCADE;

-- 7. Log Clean Completion Notice
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Selective application reset complete. The public schema is now ready for 02_schema.sql.';
END $$;

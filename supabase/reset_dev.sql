-- ==============================================================================
-- AegisAI Financial Intelligence - Development-Only Reset Script
-- File: supabase/reset_dev.sql
-- Mode: DESTRUCTIVE (Development and Staging environments ONLY)
-- ==============================================================================
--
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- !                              WARNING: DATA LOSS                            !
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- This script selectively drops all AegisAI application-owned tables, views,
-- triggers, functions, policies, and custom enum types in schema 'public'.
--
-- EXECUTION IS OPTIONAL AND DESTRUCTIVE:
-- If executed against a database containing data, ALL records inside AegisAI
-- application tables will be irreversibly erased.
--
-- SCOPE OF DELETION (AegisAI-Owned Objects Only):
--   Tables:
--     - public.notification_events
--     - public.user_feedback
--     - public.case_activity
--     - public.transaction_explanations
--     - public.transaction_features
--     - public.fraud_cases
--     - public.transactions
--     - public.risk_rules
--     - public.model_evaluations
--     - public.model_registry
--     - public.ingestion_jobs
--     - public.audit_logs
--     - public.profiles
--   Enums:
--     - public.user_role
--     - public.decision_type
--     - public.case_status_type
--     - public.case_priority_type
--     - public.rule_severity_type
--     - public.audit_result_type
--     - public.job_status_type
--   Functions & Triggers:
--     - public.current_user_role()
--     - public.check_profile_role_update() / tr_protect_profile_role
--     - public.prevent_audit_tampering() / tr_audit_tampering
--     - public.handle_new_user()
--
-- WHAT THIS SCRIPT NEVER TOUCHES (IMMUTABLE SAFETY BOUNDARIES):
--   - NEVER drops the 'public' schema or runs DROP SCHEMA ... CASCADE.
--   - NEVER drops or deletes 'auth.users', authentication credentials, or user identities.
--   - NEVER alters or drops Supabase platform schemas ('auth', 'storage', 'vault', 'realtime').
--   - NEVER drops platform extensions ('uuid-ossp', 'pgcrypto', etc.).
--   - NEVER drops unrelated tables or objects owned by other applications.
--
-- SAFETY CONFIRMATION LATCH:
-- You MUST explicitly change v_confirm_destructive_reset from FALSE to TRUE below
-- before this script will execute.
-- ==============================================================================

DO $$
DECLARE
  -- SAFETY LATCH: Set this to TRUE only after verifying you are connected to DEVELOPMENT.
  v_confirm_destructive_reset BOOLEAN := FALSE;
BEGIN
  IF NOT v_confirm_destructive_reset THEN
    RAISE EXCEPTION 'SAFETY STOP: Selective reset aborted. You must edit supabase/reset_dev.sql and set v_confirm_destructive_reset := TRUE before executing in the Supabase SQL Editor.';
  END IF;

  RAISE NOTICE 'Starting selective AegisAI application reset in public schema...';
END $$;

-- 1. Remove Application Tables from Supabase Realtime Publication
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
    RAISE NOTICE 'Removed public.% from supabase_realtime', v_tbl.tablename;
  END LOOP;
END $$;

-- 2. Drop Triggers on Application Tables
DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
DROP TRIGGER IF EXISTS tr_audit_tampering ON public.audit_logs;
DROP TRIGGER IF EXISTS tr_prevent_audit_tampering ON public.audit_logs;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Drop Views (if any exist)
DROP VIEW IF EXISTS public.v_transaction_overview CASCADE;
DROP VIEW IF EXISTS public.v_fraud_case_queue CASCADE;

-- 4. Drop Application Tables in Reverse Foreign-Key Dependency Order
-- Child leaf tables first, then parent tables
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

-- 7. Log Completion
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: AegisAI selective reset complete. Application schema is clean and ready for setup_all.sql.';
END $$;

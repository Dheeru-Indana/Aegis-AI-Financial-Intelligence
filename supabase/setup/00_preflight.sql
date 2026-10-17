-- ==============================================================================
-- AegisAI Financial Intelligence - Supabase Preflight Verification
-- File: supabase/setup/00_preflight.sql
-- Mode: READ-ONLY (Safe to run in any environment)
-- ==============================================================================
-- PURPOSE:
-- 1. Inspect the target Supabase / PostgreSQL database environment.
-- 2. Verify current database name, connected user, and search_path.
-- 3. Check for the existence of required PostgreSQL extensions.
-- 4. Audit existing application tables and enum types before any reset.
-- 5. Confirm that the operator is connected to the intended DEVELOPMENT project.
--
-- INSTRUCTIONS FOR THE OPERATOR:
-- 1. Open Supabase Dashboard -> Your Project -> SQL Editor.
-- 2. Paste this entire script into a new query tab and execute it.
-- 3. Inspect the returned result sets to verify your target project details.
-- 4. DO NOT proceed with 01_reset_dev.sql if you see production database names,
--    production connection strings, or unbacked-up critical business data.
-- ==============================================================================

-- 1. Target Environment & Session Diagnostics
SELECT
  current_database() AS database_name,
  current_user AS session_user,
  current_setting('server_version') AS pg_version,
  current_setting('search_path') AS active_search_path,
  timezone('utc'::text, now()) AS executed_at_utc;

-- 2. Verify Required & Available PostgreSQL Extensions
SELECT
  extname AS extension_name,
  extversion AS installed_version,
  CASE
    WHEN extname = 'uuid-ossp' THEN 'Required for deterministic/random UUID generation'
    WHEN extname = 'pgcrypto' THEN 'Supported for gen_random_uuid()'
    ELSE 'Standard Supabase extension'
  END AS notes
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'plpgsql')
ORDER BY extname;

-- 3. Audit Existing Public Tables (Checking what currently exists)
SELECT
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 4. Audit Existing Public Enums (Checking for user_role, decision_type, etc.)
SELECT
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS allowed_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- 5. Audit Existing Foreign Key Constraints in public schema
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 6. Audit Supabase Realtime Publication Status
SELECT
  pubname,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;

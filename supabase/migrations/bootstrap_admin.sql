-- ====================================================================
-- AegisAI - Table Grants & Administrator Promotion Script
-- File: supabase/migrations/bootstrap_admin.sql
-- ====================================================================
--
-- INSTRUCTIONS: Run this query in Supabase SQL Editor.
-- This script does two essential things:
-- 1. Grants table permissions to authenticated users (fixes "permission denied for table profiles").
-- 2. Confirms and elevates 'admin@aegisai.com' to administrator.
-- ====================================================================

-- 1. Grant table access to authenticated and service_role in public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.risk_rules TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated, service_role;

-- 2. Ensure trigger allows SQL Editor updates
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role <> OLD.role THEN
    IF auth.uid() IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'administrator'
    ) THEN
      RAISE EXCEPTION 'Security violation: Only administrators can modify user roles';
    END IF;
  END IF;
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- 3. Elevate user to administrator and confirm email
DO $$
DECLARE
  v_user_id UUID;
  v_email TEXT := 'admin@aegisai.com'; -- <--- YOUR REGISTERED EMAIL
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User % not found in auth.users.', v_email;
  ELSE
    -- Confirm email and store admin role in JWT metadata
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"administrator"}'::jsonb,
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role":"administrator"}'::jsonb
    WHERE id = v_user_id;

    -- Upsert profile with administrator role
    INSERT INTO public.profiles (id, email, display_name, role, status, updated_at)
    VALUES (v_user_id, v_email, 'SecOps Admin', 'administrator', 'active', now())
    ON CONFLICT (id) DO UPDATE
    SET role = 'administrator',
        updated_at = now();

    -- Insert audit log
    INSERT INTO public.audit_logs (
      id, timestamp, actor, role, action, resource_type,
      resource_id, result, details, metadata
    ) VALUES (
      'AUD-BOOTSTRAP-' || substring(replace(gen_random_uuid()::text, '-', ''), 1, 6),
      now(),
      'Database Superuser (SQL Editor)',
      'administrator',
      'Administrator role bootstrapped & table grants applied',
      'Profile',
      v_user_id::text,
      'Success',
      'User ' || v_email || ' elevated to administrator',
      jsonb_build_object('target_email', v_email, 'target_uid', v_user_id)
    );

    RAISE NOTICE 'SUCCESS: User % (UUID %) is now confirmed and elevated to administrator.', v_email, v_user_id;
  END IF;
END $$;

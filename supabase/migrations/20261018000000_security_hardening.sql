-- ====================================================================
-- AegisAI - Security hardening for profiles and transactions
-- File: supabase/migrations/20261018000000_security_hardening.sql
-- ====================================================================
--
-- Run after the enterprise schema (or on a database built by setup_all.sql /
-- setup/02_schema.sql). Idempotent: safe to run more than once.
--
-- 1. current_user_role() returns NULL unless the caller's account is active, so every
--    role-based policy also locks out suspended and inactive accounts.
-- 2. Only administrators (or the SQL editor / service role) can change a profile's
--    role or status, and self-created profiles must start as an active fraud_analyst.
--    Previously status was unprotected, so suspended users could reactivate themselves,
--    and the insert policy allowed a user to create their own profile as administrator.
-- 3. Profiles are readable by their owner and by administrators, not by every account.
-- 4. Transactions are readable only by active staff accounts.
-- 5. transactions.model_version / latency_ms no longer default to invented values.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND status = 'active';
$$;

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

-- Profiles
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by owner and administrators" ON public.profiles;
CREATE POLICY "Profiles readable by owner and administrators"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.current_user_role() = 'administrator');

DROP POLICY IF EXISTS "Users can insert own initial profile" ON public.profiles;
CREATE POLICY "Users can insert own initial profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'fraud_analyst' AND status = 'active');

-- Transactions
DROP POLICY IF EXISTS "Transactions viewable by authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Transactions viewable by active staff" ON public.transactions;
CREATE POLICY "Transactions viewable by active staff"
  ON public.transactions FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

ALTER TABLE public.transactions ALTER COLUMN model_version SET DEFAULT 'unrecorded';
ALTER TABLE public.transactions ALTER COLUMN latency_ms SET DEFAULT 0;

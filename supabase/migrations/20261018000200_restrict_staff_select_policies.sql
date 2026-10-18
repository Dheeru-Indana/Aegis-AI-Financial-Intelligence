-- ====================================================================
-- AegisAI - Restrict staff table SELECT policies to active staff
-- File: supabase/migrations/20261018000200_restrict_staff_select_policies.sql
-- ====================================================================
--
-- Closes security loophole where SELECT policies used USING (true), allowing
-- suspended accounts or accounts without a profile to read sensitive operational
-- data including cases, features, explanations, feedback, jobs, and rules.
--
-- Idempotent: safe to run more than once.
-- ====================================================================

-- 1. transaction_features
DROP POLICY IF EXISTS "Features viewable by authenticated users" ON public.transaction_features;
CREATE POLICY "Features viewable by active staff"
  ON public.transaction_features FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 2. transaction_explanations
DROP POLICY IF EXISTS "Explanations viewable by authenticated users" ON public.transaction_explanations;
CREATE POLICY "Explanations viewable by active staff"
  ON public.transaction_explanations FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 3. fraud_cases
DROP POLICY IF EXISTS "Cases readable by authenticated users" ON public.fraud_cases;
CREATE POLICY "Cases readable by active staff"
  ON public.fraud_cases FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 4. case_activity
DROP POLICY IF EXISTS "Activity readable by authenticated users" ON public.case_activity;
CREATE POLICY "Activity readable by active staff"
  ON public.case_activity FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 5. risk_rules
DROP POLICY IF EXISTS "Risk rules readable by authenticated users" ON public.risk_rules;
CREATE POLICY "Risk rules readable by active staff"
  ON public.risk_rules FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 6. model_registry
DROP POLICY IF EXISTS "Models readable by authenticated users" ON public.model_registry;
CREATE POLICY "Models readable by active staff"
  ON public.model_registry FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 7. model_evaluations
DROP POLICY IF EXISTS "Evaluations readable by authenticated users" ON public.model_evaluations;
CREATE POLICY "Evaluations readable by active staff"
  ON public.model_evaluations FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 8. ingestion_jobs
DROP POLICY IF EXISTS "Ingestion jobs readable by authenticated users" ON public.ingestion_jobs;
CREATE POLICY "Ingestion jobs readable by active staff"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

-- 9. user_feedback
DROP POLICY IF EXISTS "Feedback viewable by authenticated users" ON public.user_feedback;
CREATE POLICY "Feedback viewable by active staff"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (public.current_user_role() IS NOT NULL);

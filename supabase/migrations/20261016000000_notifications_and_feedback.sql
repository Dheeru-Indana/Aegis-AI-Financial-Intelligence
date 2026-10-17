-- ====================================================================
-- AegisAI Financial Intelligence - Additional Enterprise Tables & RLS
-- Migration: 20261016000000_notifications_and_feedback.sql
-- ====================================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role user_role, -- NULL means broadcast to specified role or all analysts
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low', 'info')),
  link_ref TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notification_events(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_role ON public.notification_events(recipient_role, read);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

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

-- 2. USER FEEDBACK / VERIFIED LABELS (Feature 7)
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT REFERENCES public.fraud_cases(id) ON DELETE SET NULL,
  transaction_id TEXT NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  customer_reference TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  initial_score INTEGER NOT NULL,
  analyst_outcome TEXT NOT NULL CHECK (analyst_outcome IN ('Confirmed Fraud', 'Legitimate Transaction', 'False Positive')),
  analyst_id UUID REFERENCES auth.users(id),
  analyst_name TEXT NOT NULL,
  provenance TEXT NOT NULL DEFAULT 'manual_triage',
  status TEXT NOT NULL CHECK (status IN ('Queued for Retraining', 'Embedded in Dataset', 'Archived')) DEFAULT 'Queued for Retraining',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.user_feedback(status, verified_at DESC);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback viewable by authenticated users"
  ON public.user_feedback FOR SELECT TO authenticated USING (true);

CREATE POLICY "Feedback insertable and editable by analysts and admins"
  ON public.user_feedback FOR ALL TO authenticated
  USING (public.current_user_role() IN ('administrator', 'fraud_analyst', 'investigator'));

-- 3. REALTIME PUBLICATION EXTENSION
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notification_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  END IF;
END $$;

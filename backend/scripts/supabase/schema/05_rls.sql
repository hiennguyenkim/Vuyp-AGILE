-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Run after tables 01 -> 04 have been created.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_admin_insert"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Optional own-profile update policy:
-- CREATE POLICY "profiles_own_update"
--   ON public.profiles FOR UPDATE
--   TO authenticated
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());

-- ---- EVENTS ----
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_admin_insert" ON public.events;
DROP POLICY IF EXISTS "events_admin_update" ON public.events;
DROP POLICY IF EXISTS "events_admin_delete" ON public.events;

CREATE POLICY "events_select_all"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "events_admin_insert"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "events_admin_update"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "events_admin_delete"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ---- REGISTRATIONS ----
DROP POLICY IF EXISTS "registrations_select_authenticated" ON public.registrations;
DROP POLICY IF EXISTS "registrations_student_insert" ON public.registrations;
DROP POLICY IF EXISTS "registrations_admin_insert" ON public.registrations;
DROP POLICY IF EXISTS "registrations_admin_update" ON public.registrations;
DROP POLICY IF EXISTS "registrations_admin_delete" ON public.registrations;

CREATE POLICY "registrations_select_authenticated"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "registrations_student_insert"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "registrations_admin_insert"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "registrations_admin_update"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "registrations_admin_delete"
  ON public.registrations FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- ---- EVENT_FEEDBACK ----
DROP POLICY IF EXISTS "event_feedback_select_authenticated" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_student_insert" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_student_update" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_student_delete" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_admin_insert" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_admin_update" ON public.event_feedback;
DROP POLICY IF EXISTS "event_feedback_admin_delete" ON public.event_feedback;

CREATE POLICY "event_feedback_select_authenticated"
  ON public.event_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "event_feedback_student_insert"
  ON public.event_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.registrations
      WHERE public.registrations.event_id = public.event_feedback.event_id
        AND public.registrations.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.events
      WHERE public.events.id = public.event_feedback.event_id
        AND public.events."end" <= NOW()
    )
  );

CREATE POLICY "event_feedback_student_update"
  ON public.event_feedback FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.registrations
      WHERE public.registrations.event_id = public.event_feedback.event_id
        AND public.registrations.user_id = auth.uid()
    )
  );

CREATE POLICY "event_feedback_student_delete"
  ON public.event_feedback FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "event_feedback_admin_insert"
  ON public.event_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "event_feedback_admin_update"
  ON public.event_feedback FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "event_feedback_admin_delete"
  ON public.event_feedback FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

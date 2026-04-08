-- ============================================================
-- TABLE: registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id     TEXT NOT NULL,
  profile_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name   TEXT NOT NULL,
  student_course TEXT,
  student_gender TEXT,
  status         TEXT NOT NULL DEFAULT 'Đã đăng ký',
  registered_at  TIMESTAMPTZ DEFAULT NOW(),
  checked_in     BOOLEAN DEFAULT FALSE,
  checked_in_at  TIMESTAMPTZ,
  checked_in_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, student_id)
);

CREATE INDEX IF NOT EXISTS registrations_event_id_idx
  ON public.registrations(event_id);
CREATE INDEX IF NOT EXISTS registrations_student_id_idx
  ON public.registrations(student_id);
CREATE INDEX IF NOT EXISTS registrations_user_id_idx
  ON public.registrations(user_id);

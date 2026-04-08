-- ============================================================
-- TABLE: event_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content       TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_feedback_event_id_idx
  ON public.event_feedback(event_id);
CREATE INDEX IF NOT EXISTS event_feedback_user_id_idx
  ON public.event_feedback(user_id);
CREATE INDEX IF NOT EXISTS event_feedback_created_at_idx
  ON public.event_feedback(created_at DESC);

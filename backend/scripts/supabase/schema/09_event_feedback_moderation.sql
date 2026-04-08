-- ============================================================
-- Upgrade existing event_feedback table with moderation fields
-- Run this only if event_feedback already exists from an older schema.
-- ============================================================
ALTER TABLE public.event_feedback
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.event_feedback
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

ALTER TABLE public.event_feedback
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS event_feedback_visible_event_created_idx
  ON public.event_feedback(event_id, created_at DESC)
  WHERE is_hidden = FALSE;

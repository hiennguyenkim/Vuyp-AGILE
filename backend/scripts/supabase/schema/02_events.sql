-- ============================================================
-- TABLE: events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  speaker     TEXT,
  start       TIMESTAMPTZ NOT NULL,
  "end"       TIMESTAMPTZ NOT NULL,
  location    TEXT NOT NULL,
  max         INTEGER NOT NULL DEFAULT 50 CHECK (max >= 1),
  registered  INTEGER NOT NULL DEFAULT 0 CHECK (registered >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_code_idx
  ON public.events(code);
CREATE INDEX IF NOT EXISTS events_start_idx
  ON public.events(start);

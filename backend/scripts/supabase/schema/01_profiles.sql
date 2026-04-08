-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  login_id       TEXT UNIQUE,
  role           TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  display_name   TEXT,
  student_id     TEXT UNIQUE,
  student_name   TEXT,
  student_course TEXT,
  student_gender TEXT CHECK (student_gender IN ('Nam', 'Nu', 'Nữ', 'Khac', 'Khác', '')),
  username       TEXT UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_student_id_idx
  ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS profiles_login_id_idx
  ON public.profiles(login_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx
  ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx
  ON public.profiles(role);

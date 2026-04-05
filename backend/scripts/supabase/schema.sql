-- ============================================================
-- PHẦN 1: BLOCK SIGNUP (TÙY CHỌN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Chỉ cho phép admin (service_role) tạo user
  -- Nếu không có service_role thì block
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Tự đăng ký tài khoản không được phép. Liên hệ quản trị viên.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sẽ block bất kỳ insert vào auth.users từ phía client
-- (Ưu tiên tắt Email Signup trong Dashboard hơn là dùng trigger này)


-- ============================================================
-- PHẦN 2: TẠO BẢNG profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  login_id      TEXT UNIQUE,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  display_name  TEXT,
  student_id    TEXT UNIQUE,
  student_name  TEXT,
  student_course TEXT,
  student_gender TEXT CHECK (student_gender IN ('Nam', 'Nữ', 'Nu', 'Khác', 'Khac', '')),
  username      TEXT UNIQUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index để tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS profiles_student_id_idx ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS profiles_login_id_idx   ON public.profiles(login_id);
CREATE INDEX IF NOT EXISTS profiles_email_idx       ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_role_idx        ON public.profiles(role);


-- ============================================================
-- PHẦN 3: TẠO BẢNG events
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

CREATE INDEX IF NOT EXISTS events_code_idx      ON public.events(code);
CREATE INDEX IF NOT EXISTS events_start_idx     ON public.events(start);


-- ============================================================
-- PHẦN 4: TẠO BẢNG registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.registrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL,
  profile_id      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name    TEXT NOT NULL,
  student_course  TEXT,
  student_gender  TEXT,
  status          TEXT NOT NULL DEFAULT 'Đã đăng ký',
  registered_at   TIMESTAMPTZ DEFAULT NOW(),
  -- QR check-in fields
  checked_in      BOOLEAN DEFAULT FALSE,
  checked_in_at   TIMESTAMPTZ,
  checked_in_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(event_id, student_id)
);

CREATE INDEX IF NOT EXISTS registrations_event_id_idx    ON public.registrations(event_id);
CREATE INDEX IF NOT EXISTS registrations_student_id_idx  ON public.registrations(student_id);
CREATE INDEX IF NOT EXISTS registrations_user_id_idx     ON public.registrations(user_id);


-- ============================================================
-- PHẦN 5: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Bật RLS cho cả 3 bảng
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations  ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
-- Tất cả đã đăng nhập xem được profiles (để lookup tên)
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Chỉ admin mới INSERT / UPDATE / DELETE profiles
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

-- Sinh viên chỉ được UPDATE profile của chính mình (nếu muốn mở)
-- (Bỏ comment nếu muốn cho phép sinh viên tự cập nhật)
-- CREATE POLICY "profiles_own_update"
--   ON public.profiles FOR UPDATE
--   TO authenticated
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());

-- ---- EVENTS ----
-- Anon và authenticated đều đọc được events
CREATE POLICY "events_select_all"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);

-- Chỉ admin mới tạo/sửa/xóa events
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
-- Authenticated xem tất cả (admin xem toàn bộ, sinh viên xem của mình sẽ cần filter ở app)
CREATE POLICY "registrations_select_authenticated"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (true);

-- Sinh viên tự đăng ký (chỉ chính mình)
CREATE POLICY "registrations_student_insert"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin có thể insert bất kỳ
CREATE POLICY "registrations_admin_insert"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin có thể update (check-in QR)
CREATE POLICY "registrations_admin_update"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- Admin có thể xóa
CREATE POLICY "registrations_admin_delete"
  ON public.registrations FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );


-- ============================================================
-- PHẦN 6: AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- PHẦN 7: AUTO-SYNC registered count
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_event_registered_count()
RETURNS TRIGGER AS $$
DECLARE
  target_event_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_event_id := OLD.event_id;
  ELSE
    target_event_id := NEW.event_id;
  END IF;

  UPDATE public.events
  SET registered = (
    SELECT COUNT(*) FROM public.registrations
    WHERE event_id = target_event_id
  ),
  updated_at = NOW()
  WHERE id = target_event_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER registrations_sync_count
  AFTER INSERT OR DELETE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_registered_count();


-- ============================================================
-- PHẦN 8: AUTO-CREATE profile khi admin tạo user
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

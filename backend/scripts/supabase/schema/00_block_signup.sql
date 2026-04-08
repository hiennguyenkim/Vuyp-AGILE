-- ============================================================
-- OPTIONAL: BLOCK SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Chi cho phep admin (service_role) tao user.
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Tu dang ky tai khoan khong duoc phep. Lien he quan tri vien.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger block insert vao auth.users tu phia client khong duoc bat san trong repo.
-- Uu tien tat Email Signup trong Supabase Dashboard neu co the.

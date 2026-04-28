-- ============================================================
-- MIGRATION: Feedback chỉ cần check-in (bỏ điều kiện events.end <= NOW())
-- AC: Sinh viên đã check-in thực tế → được gửi feedback
--     Mỗi sinh viên chỉ được gửi 1 lần / 1 sự kiện (duplicate bị block bởi UNIQUE constraint)
-- Chạy file này sau 05_rls.sql hoặc apply độc lập lên Supabase SQL Editor.
-- ============================================================

-- Xóa policy cũ (có điều kiện sự kiện phải đã kết thúc)
DROP POLICY IF EXISTS "event_feedback_student_insert" ON public.event_feedback;

-- Tạo lại policy mới: chỉ cần check-in, không cần sự kiện kết thúc
CREATE POLICY "event_feedback_student_insert"
  ON public.event_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Sinh viên chỉ được gửi feedback của chính mình
    user_id = auth.uid()
    -- Không được điền sẵn các cờ moderation
    AND COALESCE(is_hidden, FALSE) = FALSE
    AND hidden_at IS NULL
    AND hidden_by IS NULL
    -- ĐIỀU KIỆN CHÍNH: Sinh viên PHẢI đã check-in thực tế tại sự kiện
    AND EXISTS (
      SELECT 1
      FROM public.registrations
      WHERE public.registrations.event_id = public.event_feedback.event_id
        AND (
          -- Match theo auth user id
          public.registrations.user_id = auth.uid()
          OR (
            -- Hoặc match theo student_id trong profile
            COALESCE(
              (SELECT student_id FROM public.profiles WHERE id = auth.uid()),
              ''
            ) <> ''
            AND public.registrations.student_id =
              (SELECT student_id FROM public.profiles WHERE id = auth.uid())
          )
        )
        -- Bắt buộc phải có check-in (checked_in = TRUE hoặc checked_in_at được ghi nhận)
        AND (
          COALESCE(public.registrations.checked_in, FALSE) = TRUE
          OR public.registrations.checked_in_at IS NOT NULL
        )
    )
  );

-- Lưu ý: chống trùng lặp (mỗi MSSV chỉ gửi 1 lần) được đảm bảo bởi:
--   UNIQUE(event_id, user_id) trên bảng event_feedback (file 04_event_feedback.sql)
-- Không cần thêm policy — DB sẽ tự throw lỗi 23505 khi vi phạm unique constraint.

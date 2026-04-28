-- ============================================================
-- MIGRATION: Thêm cột reward_link vào bảng events
-- Dùng để Admin cài đặt link quà tặng / chứng nhận cho mỗi sự kiện.
-- Sinh viên chỉ nhận được link này sau khi gửi đánh giá thành công.
-- Chạy file này trong Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS reward_link TEXT;

COMMENT ON COLUMN public.events.reward_link IS
  'Link quà tặng / giấy chứng nhận do Admin cài. Trả về cho sinh viên sau khi gửi đánh giá thành công.';

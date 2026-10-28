-- ============================================================
-- Happy Home — Điểm thưởng cho khách đóng tiền đúng hạn: cột cấu hình theo tòa nhà
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần được, không đụng dữ liệu có sẵn.
--
-- Điểm KHÔNG lưu ở đâu cả: app tính lại từ hóa đơn + phiếu thu mỗi lần, điểm đã đổi nằm trên chính hóa đơn được giảm
-- (một dòng loại 'reward' trong cột lines). Chỉ cấu hình của chương trình cần một cột, mặc định rỗng = tắt.
-- Chưa chạy tệp này thì app vẫn dùng được, chỉ là cài đặt chương trình không lưu lên máy chủ (app báo ngay trong hộp thoại cài đặt).
-- ============================================================
alter table public.buildings add column if not exists reward_config jsonb;

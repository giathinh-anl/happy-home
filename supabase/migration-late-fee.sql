-- ============================================================
-- Happy Home — Chính sách phí trễ hạn (trang "Nhắc nợ")
-- Chạy trong Supabase → SQL Editor → New query → Run
-- Chạy lại nhiều lần vẫn an toàn (đều có "if not exists").
--
-- Không chạy tệp này thì app vẫn dùng được, nhưng chính sách phí chỉ nằm
-- trong bộ nhớ trình duyệt và sẽ mất khi tải lại trang (app sẽ báo khi bạn lưu).
-- Dòng "Phí trễ hạn" trên hóa đơn nằm trong cột lines (jsonb) sẵn có nên KHÔNG cần cột mới.
-- ============================================================

-- Phí mỗi ngày (đồng). 0 hoặc trống = tắt, là mặc định.
alter table public.buildings add column if not exists late_fee_per_day bigint default 0;
-- Số ngày đầu sau hạn không tính phí
alter table public.buildings add column if not exists late_grace_days int default 3;

-- ============================================================
-- Happy Home — Quét hợp đồng giấy (minh chứng + chữ ký)
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- Không ảnh hưởng dữ liệu đang có.
--
-- Sau khi chạy: ảnh hợp đồng giấy và chữ ký khách thuê được lưu lên máy chủ,
-- mở ở máy nào cũng xem lại được (chưa chạy thì chỉ lưu trong máy đang dùng).
-- ============================================================

alter table public.contracts add column if not exists scans jsonb default '[]'::jsonb;  -- ảnh/PDF bản giấy
alter table public.contracts add column if not exists signature text;                   -- chữ ký khách thuê (ảnh cắt ra)
alter table public.contracts add column if not exists scan_note text;                   -- ghi chú đọc được trên giấy
alter table public.contracts add column if not exists scanned_at timestamptz;           -- lúc quét
alter table public.contracts add column if not exists source text;                      -- 'scan' nếu tạo từ bản giấy

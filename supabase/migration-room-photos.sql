-- ============================================================
-- Happy Home — Bổ sung: ảnh phòng & thông tin đăng tin
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- Không ảnh hưởng dữ liệu đang có.
-- (Nếu chưa chạy, app vẫn hoạt động — chỉ là ảnh/mô tả không lưu lên máy chủ.)
-- ============================================================

alter table public.rooms add column if not exists photos jsonb default '[]'::jsonb;
alter table public.rooms add column if not exists description text;
alter table public.rooms add column if not exists amenities jsonb default '[]'::jsonb;

-- Thông tin liên hệ đăng tin của tòa nhà
alter table public.buildings add column if not exists contact_name text;
alter table public.buildings add column if not exists contact_phone text;

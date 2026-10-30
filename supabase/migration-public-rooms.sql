-- ============================================================
-- Happy Home — Trang công khai giới thiệu phòng trống
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần được, không đụng dữ liệu có sẵn.
-- Cần chạy migration-room-photos.sql trước (cột ảnh, mô tả, tiện nghi, liên hệ tòa nhà); thiếu thì hàm vẫn chạy, chỉ là phần đó rỗng.
--
-- Chủ trọ bật "Link giới thiệu công khai" cho một phòng: app ghi public_on = true và một mã ngẫu nhiên khó đoán vào public_slug.
-- Người ngoài (chưa đăng nhập) mở  .../phong/#<mã>  và trang gọi hàm public_room(mã) để lấy thông tin.
--
-- AN TOÀN:
--   * Bảng rooms vẫn khóa kín với người lạ (RLS: chỉ chủ trọ). Người lạ KHÔNG đọc được bảng, chỉ gọi được ĐÚNG MỘT hàm này.
--   * Hàm chỉ trả những gì chủ trọ đã nhập để đăng tin: số phòng, tầng, diện tích, giá, loại, số người tối đa, mô tả, tiện nghi, tối đa 5 ảnh,
--     tên + địa chỉ tòa nhà, tên + số điện thoại liên hệ. KHÔNG có tên khách, công nợ, hợp đồng, chỉ số, ảnh CCCD.
--   * Trạng thái chỉ có 3 loại (vacant / reserved / occupied): sắp trả phòng, đang dọn, ngưng... đều ra "occupied", không lộ chi tiết.
--   * Phòng không bật công khai, mã sai dạng, mã không có: cùng trả { error: 'not_found' } (không phân biệt, để không dò được mã nào tồn tại).
-- ============================================================

alter table public.rooms add column if not exists public_on boolean default false;
alter table public.rooms add column if not exists public_slug text;
create unique index if not exists rooms_public_slug_key on public.rooms (public_slug) where public_slug is not null;

create or replace function public.public_room(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.rooms;
  b public.buildings;
  v_photos jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]{12,40}$' then return jsonb_build_object('error', 'not_found'); end if;
  select * into r from public.rooms where public_slug = p_slug and public_on is true limit 1;
  if r.id is null then return jsonb_build_object('error', 'not_found'); end if;
  select * into b from public.buildings where owner_id = r.owner_id and id = r.building_id;

  -- ảnh: chỉ ảnh nhúng jpeg/png/webp (không nhận đường dẫn ngoài, svg), mỗi ảnh tối đa 700.000 ký tự, tối đa 5 ảnh, giữ thứ tự
  select coalesce(jsonb_agg(x.p order by x.i), '[]'::jsonb) into v_photos from (
    select t.p, t.i
    from jsonb_array_elements_text(case when jsonb_typeof(to_jsonb(r) -> 'photos') = 'array' then to_jsonb(r) -> 'photos' else '[]'::jsonb end) with ordinality as t(p, i)
    where length(t.p) <= 700000 and t.p ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
    order by t.i limit 5
  ) x;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'code', r.code, 'floor', r.floor, 'area', r.area, 'price', r.price, 'typeLabel', r.type_label, 'maxOccupants', r.max_occupants,
      'description', to_jsonb(r) ->> 'description',
      'amenities', case when jsonb_typeof(to_jsonb(r) -> 'amenities') = 'array' then to_jsonb(r) -> 'amenities' else '[]'::jsonb end,
      'photos', v_photos,
      'status', case when r.status in ('vacant', 'reserved') then r.status else 'occupied' end),
    'building', jsonb_build_object('name', b.name, 'address', b.address),
    'contact', jsonb_build_object('name', to_jsonb(b) ->> 'contact_name', 'phone', to_jsonb(b) ->> 'contact_phone'));
end $$;

-- Supabase mặc định cho anon quyền chạy mọi hàm mới ở schema public; ở đây chủ ý CHO phép đúng hàm này và không hàm nào khác thêm
revoke all on function public.public_room(text) from public;
grant execute on function public.public_room(text) to anon, authenticated;

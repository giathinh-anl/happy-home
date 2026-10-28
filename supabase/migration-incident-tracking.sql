-- ============================================================
-- Happy Home — Báo hỏng có theo dõi tiến độ
--
-- Trước đây một sự cố chỉ có 3 trạng thái và mọi mốc trên app khách đều hiện ngày báo. Giờ mỗi sự cố có:
--   * history: các sự kiện đã xảy ra (tiếp nhận, bắt đầu xử lý, hẹn thợ, ghi chú, sửa xong, mở lại) kèm giờ
--   * thợ phụ trách + số điện thoại, ngày hẹn, chi phí và ai chịu, ngày hoàn tất
-- Khách chỉ thấy các sự kiện chủ trọ đánh dấu "cho khách thấy" (congKhai). Ghi chú nội bộ, chi phí và tên người
-- thao tác KHÔNG bao giờ rời máy chủ: lọc ngay trong hàm tenant_incident_updates bên dưới.
--
-- Chưa chạy tệp này thì web và app vẫn dùng được như cũ, nhưng tiến độ chỉ nằm trong bộ nhớ trình duyệt và mất khi tải
-- lại trang (cột mới chưa có để lưu), và app khách chưa thấy tiến độ.
--
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================

alter table public.incidents add column if not exists history jsonb default '[]'::jsonb;
alter table public.incidents add column if not exists assignee text;
alter table public.incidents add column if not exists assignee_phone text;
alter table public.incidents add column if not exists scheduled_for date;
alter table public.incidents add column if not exists cost bigint;
alter table public.incidents add column if not exists cost_payer text;           -- chu | khach
alter table public.incidents add column if not exists done_at timestamptz;

-- Khách xem tiến độ các sự cố của phòng mình (token đăng nhập app, như các hàm tenant_* khác).
-- Chỉ trả sự kiện công khai và chỉ các trường an toàn.
create or replace function public.tenant_incident_updates(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id,
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'at', e.v -> 'at', 'loai', e.v -> 'loai', 'ghiChu', e.v -> 'ghiChu',
                 'tho', e.v -> 'tho', 'thoSdt', e.v -> 'thoSdt', 'ngayHen', e.v -> 'ngayHen') order by e.n)
          from jsonb_array_elements(case when jsonb_typeof(x.history) = 'array' then x.history else '[]'::jsonb end)
               with ordinality as e(v, n)
         where e.v -> 'congKhai' = 'true'::jsonb), '[]'::jsonb)
    ) order by x.created_at desc)
    from (select * from public.incidents i
           where i.owner_id = v_t.owner_id and i.building_id = v_t.building_id and i.room_code = v_t.room_code
           order by i.created_at desc limit 20) x), '[]'::jsonb);
end $$;
revoke execute on function public.tenant_incident_updates(text) from public;
grant execute on function public.tenant_incident_updates(text) to anon, authenticated;

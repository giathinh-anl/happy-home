-- ============================================================
-- Happy Home — Khách chấm sao sau khi sự cố được sửa xong
--
-- Khi một yêu cầu sửa chữa đã "Hoàn tất", app khách hiện "Anh/chị thấy việc sửa thế nào?" với 1 đến 5 sao và một dòng nhận
-- xét (không bắt buộc). Chủ trọ thấy sao và nhận xét ngay trên sự cố ở web quản trị, để biết thợ nào làm tốt, thợ nào hay bị chê.
--   * Chỉ chấm được sự cố CỦA PHÒNG MÌNH và chỉ khi đã hoàn tất.
--   * Chấm lại được (ghi đè lần trước). Nhận xét tối đa 300 ký tự.
--   * Trình duyệt chủ trọ không ghi đè được sao khách đã chấm (cột do máy chủ ghi, xem SERVER_FIELDS trong js/backend.js).
--
-- Chưa chạy tệp này thì app vẫn dùng được: chỉ là phần chấm sao không hiện hoặc báo "chưa bật".
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================

alter table public.incidents add column if not exists rating smallint check (rating between 1 and 5);
alter table public.incidents add column if not exists rating_note text;
alter table public.incidents add column if not exists rated_at timestamptz;

create or replace function public.tenant_rate_incident(p_token text, p_incident_id text, p_stars int, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_i public.incidents;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;                       -- token sai hoặc hết hạn
  if p_stars is null or p_stars < 1 or p_stars > 5 then return jsonb_build_object('error', 'invalid'); end if;
  select * into v_i from public.incidents
   where owner_id = v_t.owner_id and id = p_incident_id and building_id = v_t.building_id and room_code = v_t.room_code;
  if v_i.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_i.status is distinct from 'done' then return jsonb_build_object('error', 'not_done'); end if;
  update public.incidents
     set rating = p_stars, rating_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''), rated_at = now(), updated_at = now()
   where owner_id = v_t.owner_id and id = p_incident_id;
  return jsonb_build_object('ok', true);
end $$;

-- Khách xem lại sao mình đã chấm (để không hỏi lại)
create or replace function public.tenant_incident_ratings(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'rating', i.rating, 'ratingNote', i.rating_note, 'ratedAt', i.rated_at) order by i.created_at desc)
      from public.incidents i
     where i.owner_id = v_t.owner_id and i.building_id = v_t.building_id and i.room_code = v_t.room_code and i.rating is not null
  ), '[]'::jsonb);
end $$;

revoke execute on function public.tenant_rate_incident(text, text, int, text) from public;
revoke execute on function public.tenant_incident_ratings(text) from public;
grant execute on function public.tenant_rate_incident(text, text, int, text) to anon, authenticated;
grant execute on function public.tenant_incident_ratings(text) to anon, authenticated;

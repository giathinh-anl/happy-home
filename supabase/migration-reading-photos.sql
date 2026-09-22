-- ============================================================
-- Happy Home — Khách gửi chỉ số điện KÈM ẢNH đồng hồ
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- Không ảnh hưởng dữ liệu đang có.
--
-- Sau khi chạy: khách chụp ảnh đồng hồ trong app, ảnh gửi thẳng sang web
-- quản trị; nhân viên mở xem rồi bấm Duyệt là chỉ số vào hóa đơn.
-- (Chưa chạy thì app vẫn gửi được số, chỉ là không có ảnh.)
-- ============================================================

alter table public.readings add column if not exists photos jsonb default '[]'::jsonb;

-- Khách tự gửi chỉ số điện + ảnh đồng hồ -> lưu chờ chủ trọ duyệt (source='tenant')
-- p_water giữ lại cho tương thích bản cũ, hiện không dùng (tiền nước tính theo số người).
create or replace function public.tenant_submit_reading(
  p_phone text, p_period text, p_elec numeric, p_water numeric, p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_rd public.readings;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;

  select * into v_rd from public.readings
    where owner_id = v_t.owner_id and building_id = v_t.building_id
      and room_code = v_t.room_code and period = p_period limit 1;

  if v_rd.id is null then
    insert into public.readings(owner_id, id, building_id, room_code, period,
      elec_curr, water_curr, photos, source, approved, updated_at)
    values (v_t.owner_id, 'rd-' || substr(md5(random()::text), 1, 8), v_t.building_id, v_t.room_code, p_period,
      p_elec, p_water, coalesce(p_photos, '[]'::jsonb), 'tenant', false, now());
  else
    update public.readings
      set elec_curr = p_elec,
          water_curr = coalesce(p_water, water_curr),
          photos = coalesce(p_photos, '[]'::jsonb),
          source = 'tenant', approved = false, updated_at = now()
      where owner_id = v_rd.owner_id and id = v_rd.id;
  end if;

  -- Báo cho chủ trọ biết có chỉ số mới cần duyệt
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text), 1, 8), now(),
          coalesce(v_t.full_name, 'Khách thuê'), 'reading.tenant',
          'Khách phòng ' || coalesce(v_t.room_code, '') || ' gửi chỉ số điện kỳ ' || p_period, null)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'period', p_period);
end $$;

grant execute on function public.tenant_submit_reading(text, text, numeric, numeric, jsonb) to anon, authenticated;

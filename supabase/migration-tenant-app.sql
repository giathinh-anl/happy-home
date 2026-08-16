-- ============================================================
-- Happy Home — Hàm cho APP KHÁCH THUÊ (tenant app)
-- Cho phép khách (không đăng nhập chủ trọ) đọc/ghi dữ liệu của CHÍNH họ theo SĐT.
-- SECURITY DEFINER: hàm chạy với quyền chủ hàm nên vượt RLS, nhưng chỉ trả/ghi
-- dữ liệu ứng với SĐT truyền vào.
-- LƯU Ý (demo): chưa xác thực OTP phía máy chủ. Thực tế nên thêm bước xác thực SĐT.
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- ============================================================

-- Lấy toàn bộ dữ liệu màn hình khách theo SĐT (phòng, hóa đơn, sự cố)
create or replace function public.tenant_data(p_phone text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_t public.tenants; v_b public.buildings; v_r public.rooms;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  select * into v_b from public.buildings where owner_id = v_t.owner_id and id = v_t.building_id;
  select * into v_r from public.rooms where owner_id = v_t.owner_id and building_id = v_t.building_id and code = v_t.room_code limit 1;
  return jsonb_build_object(
    'tenant',   jsonb_build_object('id', v_t.id, 'fullName', v_t.full_name, 'phone', v_t.phone, 'roomCode', v_t.room_code),
    'building', jsonb_build_object('id', v_b.id, 'name', v_b.name, 'address', v_b.address),
    'room',     jsonb_build_object('code', v_r.code, 'price', v_r.price, 'status', v_r.status, 'typeLabel', v_r.type_label),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', i.id, 'period', i.period, 'total', i.total, 'paid', i.paid, 'status', i.status,
                  'dueDate', i.due_date, 'periodStart', i.period_start, 'periodEnd', i.period_end, 'lines', i.lines
                ) order by i.period desc)
                from public.invoices i
                where i.owner_id = v_t.owner_id and i.building_id = v_t.building_id and i.room_code = v_t.room_code
                  and i.status <> 'cancelled'), '[]'::jsonb),
    'incidents', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', x.id, 'category', x.category, 'title', x.title, 'status', x.status, 'createdAt', x.created_at
                ) order by x.created_at desc)
                from public.incidents x
                where x.owner_id = v_t.owner_id and x.building_id = v_t.building_id and x.room_code = v_t.room_code), '[]'::jsonb)
  );
end $$;

-- Khách gửi yêu cầu báo hỏng -> tạo bản ghi sự cố cho phòng của họ (chủ trọ thấy trong "Sự cố phòng")
create or replace function public.tenant_create_incident(p_phone text, p_category text, p_title text)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_id text;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  v_id := 'sc-' || substr(md5(random()::text), 1, 8);
  insert into public.incidents(owner_id, id, building_id, room_code, category, title, status, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, p_category, p_title, 'open', now(), now());
  return jsonb_build_object('id', v_id, 'category', p_category, 'title', p_title, 'status', 'open', 'createdAt', now());
end $$;

-- Khách bấm "Tôi đã chuyển khoản" -> ghi vào nhật ký để chủ trọ đối soát
create or replace function public.tenant_notify_paid(p_phone text, p_invoice_id text)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text), 1, 8), now(), v_t.full_name, 'tenant.paid',
          'Khách báo đã chuyển khoản cho ' || coalesce(p_invoice_id, ''), null);
  return jsonb_build_object('ok', true);
end $$;

-- Khách tự ghi chỉ số điện/nước -> lưu chờ chủ trọ duyệt (source='tenant')
create or replace function public.tenant_submit_reading(p_phone text, p_period text, p_elec numeric, p_water numeric)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_rd public.readings;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  select * into v_rd from public.readings
    where owner_id = v_t.owner_id and building_id = v_t.building_id and room_code = v_t.room_code and period = p_period limit 1;
  if v_rd.id is null then
    insert into public.readings(owner_id, id, building_id, room_code, period, elec_curr, water_curr, source, approved, updated_at)
    values (v_t.owner_id, 'rd-' || substr(md5(random()::text), 1, 8), v_t.building_id, v_t.room_code, p_period, p_elec, p_water, 'tenant', false, now());
  else
    update public.readings set elec_curr = p_elec, water_curr = p_water, source = 'tenant', approved = false, updated_at = now()
      where owner_id = v_rd.owner_id and id = v_rd.id;
  end if;
  return jsonb_build_object('ok', true, 'period', p_period);
end $$;

-- Cho phép app khách (dùng anon key) gọi các hàm trên
grant execute on function public.tenant_data(text) to anon, authenticated;
grant execute on function public.tenant_create_incident(text, text, text) to anon, authenticated;
grant execute on function public.tenant_notify_paid(text, text) to anon, authenticated;
grant execute on function public.tenant_submit_reading(text, text, numeric, numeric) to anon, authenticated;

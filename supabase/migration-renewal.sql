-- ============================================================
-- Happy Home — Khách xin gia hạn hợp đồng ngay trong app khách thuê
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- An toàn chạy lại nhiều lần.
--
-- Luồng: người đại diện hợp đồng bấm "Xin gia hạn" trong app → có một dòng chờ ở
-- bảng renewal_requests → chủ trọ vào trang Hợp đồng bấm Chấp nhận (hợp đồng gia hạn
-- thật) hoặc Từ chối (kèm lý do, khách đọc được trong app).
--
-- LƯU Ý: tệp này tạo lại hàm tenant_data (bản v2 + thêm khóa "renewal"). Nếu bạn đã
-- sửa tenant_data ở nơi khác (vd. vá xác thực), hãy gộp phần "renewal" vào bản của bạn.
-- ============================================================

create table if not exists public.renewal_requests (
  owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id           text not null,
  building_id  text not null,
  room_code    text,
  contract_id  text,
  tenant_id    text,
  tenant_name  text,
  months       int  not null default 12,
  note         text,                          -- lời nhắn của khách
  status       text not null default 'pending',   -- pending | approved | rejected
  reply        text,                          -- lý do từ chối (khách đọc được)
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   text,
  updated_at   timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists renewal_bid_idx on public.renewal_requests (owner_id, building_id, status);

alter table public.renewal_requests enable row level security;
drop policy if exists own_all on public.renewal_requests;
create policy own_all on public.renewal_requests for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Nhân viên được phép như các bảng khác (cần đã chạy migration-staff-vehicles.sql)
do $$ begin
  execute 'drop policy if exists staff_access on public.renewal_requests';
  execute 'create policy staff_access on public.renewal_requests for all to authenticated
    using (owner_id in (select public.accessible_owners()))
    with check (owner_id in (select public.accessible_owners()))';
exception when undefined_function then raise notice 'Chưa có accessible_owners() — bỏ qua policy nhân viên';
end $$;
grant all on public.renewal_requests to authenticated;

-- Khách xin gia hạn. Trả null nếu không có số điện thoại này, hoặc {"error": "..."} khi không đủ điều kiện.
create or replace function public.tenant_request_renewal(p_phone text, p_months int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_c public.contracts; v_old public.renewal_requests; v_id text;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  if p_months not in (3, 6, 12, 24) then return jsonb_build_object('error', 'bad_months'); end if;
  -- chỉ người đại diện hợp đồng mới xin gia hạn cho cả phòng
  if not coalesce(v_t.is_rep, false) then return jsonb_build_object('error', 'not_rep'); end if;

  select * into v_c from public.contracts
    where owner_id = v_t.owner_id and building_id = v_t.building_id and room_code = v_t.room_code
      and status in ('active','terminating','expired') order by end_date desc limit 1;
  if v_c.id is null then return jsonb_build_object('error', 'no_contract'); end if;
  -- chỉ xin khi hợp đồng còn tối đa 90 ngày, hoặc đã quá hạn
  if v_c.end_date > current_date + 90 then return jsonb_build_object('error', 'too_early'); end if;

  -- đang có yêu cầu chờ thì trả lại chính nó, không tạo thêm
  select * into v_old from public.renewal_requests
    where owner_id = v_t.owner_id and contract_id = v_c.id and status = 'pending' limit 1;
  if v_old.id is not null then
    return jsonb_build_object('id', v_old.id, 'status', 'pending', 'months', v_old.months, 'duplicate', true);
  end if;

  v_id := 'rn-' || substr(md5(random()::text), 1, 8);
  insert into public.renewal_requests(owner_id, id, building_id, room_code, contract_id, tenant_id, tenant_name,
    months, note, status, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, v_c.id, v_t.id, v_t.full_name,
    p_months, nullif(left(coalesce(p_note, ''), 300), ''), 'pending', now(), now());
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text), 1, 8), now(), v_t.full_name,
    'tenant.renewal', 'Khách xin gia hạn hợp đồng phòng ' || coalesce(v_t.room_code, '') || ' thêm ' || p_months || ' tháng', null);
  return jsonb_build_object('id', v_id, 'status', 'pending', 'months', p_months);
end $$;
grant execute on function public.tenant_request_renewal(text, int, text) to anon, authenticated;

-- tenant_data: bản v2 (migration-tenant-app-v2.sql) + khóa "renewal" (yêu cầu gia hạn gần nhất của phòng)
create or replace function public.tenant_data(p_phone text)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare v_t public.tenants; v_b public.buildings; v_r public.rooms; v_c public.contracts;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;

  select * into v_b from public.buildings where owner_id = v_t.owner_id and id = v_t.building_id;
  select * into v_r from public.rooms
    where owner_id = v_t.owner_id and building_id = v_t.building_id and code = v_t.room_code limit 1;
  select * into v_c from public.contracts
    where owner_id = v_t.owner_id and building_id = v_t.building_id and room_code = v_t.room_code
      and status in ('active','terminating','expired') order by end_date desc limit 1;

  return jsonb_build_object(
    'tenant',   jsonb_build_object('id', v_t.id, 'fullName', v_t.full_name, 'phone', v_t.phone,
                  'roomCode', v_t.room_code, 'idNumber', v_t.id_number, 'dob', v_t.dob,
                  'gender', v_t.gender, 'isRep', v_t.is_rep, 'tamtru', v_t.tamtru,
                  'vehiclePlate', v_t.vehicle_plate),
    'building', jsonb_build_object('id', v_b.id, 'name', v_b.name, 'address', v_b.address,
                  'contactName', to_jsonb(v_b) ->> 'contact_name',
                  'contactPhone', to_jsonb(v_b) ->> 'contact_phone'),
    'room',     jsonb_build_object('code', v_r.code, 'price', v_r.price, 'status', v_r.status,
                  'typeLabel', v_r.type_label, 'area', v_r.area, 'maxOccupants', v_r.max_occupants),
    'contract', case when v_c.id is null then null else jsonb_build_object(
                  'id', v_c.id, 'rent', v_c.rent, 'deposit', v_c.deposit,
                  'start', v_c.start_date, 'end', v_c.end_date, 'status', v_c.status,
                  'billingDay', v_c.billing_day, 'dueDays', v_c.due_days,
                  'terms', to_jsonb(v_c) -> 'terms') end,
    'renewal',  (select jsonb_build_object('id', x.id, 'months', x.months, 'status', x.status,
                  'createdAt', x.created_at, 'decidedAt', x.decided_at, 'reply', x.reply)
                  from public.renewal_requests x
                  where x.owner_id = v_t.owner_id and x.building_id = v_t.building_id and x.room_code = v_t.room_code
                  order by x.created_at desc limit 1),
    'roommates', coalesce((select jsonb_agg(jsonb_build_object(
                  'fullName', t2.full_name, 'phone', t2.phone, 'isRep', t2.is_rep) order by t2.is_rep desc)
                  from public.tenants t2
                  where t2.owner_id = v_t.owner_id and t2.building_id = v_t.building_id
                    and t2.room_code = v_t.room_code and t2.id <> v_t.id), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object(
                  'name', s.name, 'method', s.method, 'unit', s.unit, 'unitLabel', s.unit_label))
                  from public.services s
                  where s.owner_id = v_t.owner_id and s.building_id = v_t.building_id), '[]'::jsonb),
    'assets',   coalesce((select jsonb_agg(jsonb_build_object(
                  'name', a.name, 'icon', a.icon, 'quantity', a.quantity, 'condition', a.condition))
                  from public.assets a
                  where a.owner_id = v_t.owner_id and a.building_id = v_t.building_id
                    and a.room_code = v_t.room_code), '[]'::jsonb),
    'readings', coalesce((select jsonb_agg(jsonb_build_object(
                  'period', rd.period, 'elecPrev', rd.elec_prev, 'elecCurr', rd.elec_curr,
                  'waterPrev', rd.water_prev, 'waterCurr', rd.water_curr,
                  'source', rd.source, 'approved', rd.approved) order by rd.period desc)
                  from public.readings rd
                  where rd.owner_id = v_t.owner_id and rd.building_id = v_t.building_id
                    and rd.room_code = v_t.room_code), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                  'id', p.id, 'invoiceId', p.invoice_id, 'amount', p.amount,
                  'method', p.method, 'date', p.paid_date) order by p.paid_date desc)
                  from public.payments p
                  join public.invoices i on i.owner_id = p.owner_id and i.id = p.invoice_id
                  where p.owner_id = v_t.owner_id and i.room_code = v_t.room_code
                    and i.building_id = v_t.building_id), '[]'::jsonb),
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

grant execute on function public.tenant_data(text) to anon, authenticated;

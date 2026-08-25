-- ============================================================
-- Happy Home — App khách thuê (bản 2): trả thêm hợp đồng, dịch vụ,
-- chỉ số, thanh toán, người ở cùng, tài sản trong phòng.
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- An toàn chạy lại nhiều lần (create or replace).
-- ============================================================

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
    'building', jsonb_build_object('id', v_b.id, 'name', v_b.name, 'address', v_b.address),
    'room',     jsonb_build_object('code', v_r.code, 'price', v_r.price, 'status', v_r.status,
                  'typeLabel', v_r.type_label, 'area', v_r.area, 'maxOccupants', v_r.max_occupants),
    'contract', case when v_c.id is null then null else jsonb_build_object(
                  'id', v_c.id, 'rent', v_c.rent, 'deposit', v_c.deposit,
                  'start', v_c.start_date, 'end', v_c.end_date, 'status', v_c.status,
                  'billingDay', v_c.billing_day, 'dueDays', v_c.due_days,
                  'terms', to_jsonb(v_c) -> 'terms') end,
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

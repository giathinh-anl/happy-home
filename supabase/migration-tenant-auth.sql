-- ============================================================
-- Happy Home — Đăng nhập THẬT cho app khách thuê
--
-- VẤN ĐỀ CŨ: mọi hàm tenant_* chỉ cần số điện thoại, nên ai biết một số điện thoại
-- là đọc được cả hồ sơ khách (CCCD, ngày sinh, hóa đơn, bạn cùng phòng) và gửi thay khách.
-- OTP trong app là mã cố định kiểm tra ngay trong trình duyệt, máy chủ không hề biết.
--
-- CÁCH MỚI:
--   1. Chủ trọ cấp cho từng khách một MÃ VÀO APP 6 số (trang Khách thuê → "Mã vào app").
--      Máy chủ chỉ lưu bản băm (bcrypt), không lưu mã. Mã hiện đúng một lần lúc cấp.
--   2. Khách nhập số điện thoại + mã → hàm tenant_login kiểm ở máy chủ, đúng thì trả
--      một token ngẫu nhiên (hiệu lực 30 ngày, lưu băm sha256).
--   3. Mọi hàm tenant_* khác nhận token thay cho số điện thoại.
--   4. Sai 5 lần liên tiếp thì khóa số đó 15 phút. Cấp lại mã sẽ mở khóa và đăng xuất mọi thiết bị.
--
-- LƯU Ý KHI CHẠY:
--   * Chạy SAU KHI bản app khách mới đã lên (app cũ gọi hàm cũ sẽ báo lỗi ngay khi chạy xong tệp này).
--   * Khách hiện có CHƯA có mã nên chưa vào được app cho tới khi chủ trọ cấp mã
--     (Khách thuê → Cấp mã vào app cho cả tòa).
--   * Các hàm tenant_* cũ nhận số điện thoại bị XÓA hẳn.
--   * Chạy lại nhiều lần vẫn an toàn.
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Bảng ----------
-- Bản băm mã vào app. Tách khỏi bảng tenants để trình duyệt của chủ trọ không bao giờ tải về.
create table if not exists public.tenant_access (
  owner_id  uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  code_hash text not null,
  set_at    timestamptz not null default now(),
  set_by    uuid,
  primary key (owner_id, tenant_id)
);

create table if not exists public.tenant_sessions (
  token_hash   text primary key,                 -- sha256 của token, không lưu token
  owner_id     uuid not null,
  tenant_id    text not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  last_used_at timestamptz
);
create index if not exists tenant_sessions_tenant_idx on public.tenant_sessions (owner_id, tenant_id);

create table if not exists public.tenant_login_fail (
  phone        text primary key,                 -- số đã chuẩn hóa 0xxxxxxxxx
  fails        int not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- Bật RLS và KHÔNG có policy nào: trình duyệt (anon / authenticated) không đọc được gì.
-- Chỉ các hàm security definer bên dưới mới đụng tới các bảng này.
alter table public.tenant_access     enable row level security;
alter table public.tenant_sessions   enable row level security;
alter table public.tenant_login_fail enable row level security;
revoke all on public.tenant_access, public.tenant_sessions, public.tenant_login_fail from public, anon, authenticated;

-- Cờ "đã cấp mã" cho giao diện chủ trọ (không phải bí mật)
alter table public.tenants add column if not exists app_code_set_at timestamptz;

-- ---------- Hàm nội bộ ----------
-- Số điện thoại về dạng 0xxxxxxxxx (bỏ khoảng trắng, +84 / 84 thành 0)
create or replace function public._norm_phone(p text)
returns text language sql immutable set search_path = public as $$
  select case
    when d like '84%' and length(d) = 11 then '0' || substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

-- Mã 6 số ngẫu nhiên từ nguồn ngẫu nhiên mật mã (không dùng random())
create or replace function public._new_code()
returns text language plpgsql volatile set search_path = public, extensions as $$
declare b bytea := extensions.gen_random_bytes(4);
begin
  return lpad(((get_byte(b, 0)::bigint * 16777216 + get_byte(b, 1)::bigint * 65536
              + get_byte(b, 2)::bigint * 256 + get_byte(b, 3)::bigint) % 1000000)::text, 6, '0');
end $$;

-- Token -> khách. Trả dòng trống (id null) nếu token sai hoặc hết hạn.
create or replace function public._tenant_from_token(p_token text)
returns public.tenants language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_h text;
begin
  if p_token is null or length(p_token) < 20 then return v_t; end if;
  v_h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  select t.* into v_t
    from public.tenant_sessions s
    join public.tenants t on t.owner_id = s.owner_id and t.id = s.tenant_id
   where s.token_hash = v_h and s.expires_at > now();
  if v_t.id is not null then
    update public.tenant_sessions set last_used_at = now() where token_hash = v_h;
  end if;
  return v_t;
end $$;

-- Cấp mã mới cho MỘT khách (nội bộ: đã kiểm quyền ở hàm gọi). Trả mã thật, chỉ để hiện một lần.
create or replace function public._issue_code(p_owner uuid, p_t public.tenants)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_code text := public._new_code();
begin
  insert into public.tenant_access(owner_id, tenant_id, code_hash, set_at, set_by)
  values (p_owner, p_t.id, extensions.crypt(v_code, extensions.gen_salt('bf')), now(), p_owner)
  on conflict (owner_id, tenant_id) do update
    set code_hash = excluded.code_hash, set_at = now(), set_by = p_owner;
  delete from public.tenant_sessions where owner_id = p_owner and tenant_id = p_t.id;   -- đăng xuất mọi thiết bị cũ
  delete from public.tenant_login_fail where phone = public._norm_phone(p_t.phone);      -- mở khóa nếu đang bị khóa
  update public.tenants set app_code_set_at = now() where owner_id = p_owner and id = p_t.id;
  return v_code;
end $$;

revoke execute on function public._tenant_from_token(text) from public, anon, authenticated;
revoke execute on function public._issue_code(uuid, public.tenants) from public, anon, authenticated;
revoke execute on function public._new_code() from public, anon, authenticated;

-- ---------- Đăng nhập / đăng xuất của khách ----------
create or replace function public.tenant_login(p_phone text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_phone text := public._norm_phone(p_phone);
  v_fail  public.tenant_login_fail;
  v_t     public.tenants;
  v_token text;
  v_left  int;
begin
  -- dọn rác định kỳ, rẻ vì bảng nhỏ
  delete from public.tenant_sessions where expires_at < now() - interval '1 day';
  delete from public.tenant_login_fail where updated_at < now() - interval '1 day' and (locked_until is null or locked_until < now());

  if v_phone !~ '^0[0-9]{9}$' then return jsonb_build_object('error', 'invalid'); end if;

  select * into v_fail from public.tenant_login_fail where phone = v_phone for update;
  if v_fail.phone is not null and v_fail.locked_until is not null and v_fail.locked_until > now() then
    v_left := ceil(extract(epoch from (v_fail.locked_until - now())))::int;
    return jsonb_build_object('error', 'locked', 'retryAfterSec', v_left);
  end if;

  -- Chỉ khách ĐÃ được cấp mã mới khớp được. Cùng một số có thể có ở nhiều chủ trọ: mã quyết định đúng người.
  if coalesce(p_code, '') ~ '^[0-9]{6}$' then
    select t.* into v_t
      from public.tenants t
      join public.tenant_access a on a.owner_id = t.owner_id and a.tenant_id = t.id
     where public._norm_phone(t.phone) = v_phone
       and a.code_hash = extensions.crypt(p_code, a.code_hash)
     order by t.is_rep desc, t.id
     limit 1;
  end if;

  if v_t.id is null then
    -- một lần băm giả cho đường "số lạ" tốn thời gian gần bằng đường "mã sai", đỡ lộ số nào có trong hệ thống qua độ trễ
    perform extensions.crypt(coalesce(p_code, ''), extensions.gen_salt('bf'));
    insert into public.tenant_login_fail(phone, fails, updated_at) values (v_phone, 1, now())
    on conflict (phone) do update
      set fails = public.tenant_login_fail.fails + 1, updated_at = now();
    update public.tenant_login_fail
       set fails = 0, locked_until = now() + interval '15 minutes'
     where phone = v_phone and fails >= 5;
    select * into v_fail from public.tenant_login_fail where phone = v_phone;
    if v_fail.locked_until is not null and v_fail.locked_until > now() then
      return jsonb_build_object('error', 'locked', 'retryAfterSec', 900);
    end if;
    return jsonb_build_object('error', 'invalid');       -- số lạ và mã sai trả y hệt nhau, không lộ số nào có trong hệ thống
  end if;

  delete from public.tenant_login_fail where phone = v_phone;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.tenant_sessions(token_hash, owner_id, tenant_id, expires_at, last_used_at)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_t.owner_id, v_t.id, now() + interval '30 days', now());
  return jsonb_build_object('token', v_token, 'expiresAt', now() + interval '30 days');
end $$;

create or replace function public.tenant_logout(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  delete from public.tenant_sessions where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  return jsonb_build_object('ok', true);
end $$;

grant execute on function public.tenant_login(text, text) to anon, authenticated;
grant execute on function public.tenant_logout(text) to anon, authenticated;

-- ---------- Chủ trọ cấp / thu hồi mã (phải đăng nhập tài khoản chủ trọ) ----------
-- Chỉ CHỦ dữ liệu được cấp mã (nhân viên thì không). Trả mã thật một lần.
create or replace function public.owner_issue_tenant_code(p_tenant_id text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_owner uuid := auth.uid(); v_t public.tenants; v_code text;
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  select * into v_t from public.tenants where owner_id = v_owner and id = p_tenant_id;
  if v_t.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if public._norm_phone(v_t.phone) !~ '^0[0-9]{9}$' then return jsonb_build_object('error', 'no_phone'); end if;
  v_code := public._issue_code(v_owner, v_t);
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_owner, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Chủ trọ', 'tenant.code',
    'Cấp mã vào app cho ' || coalesce(v_t.full_name, '') || ' (phòng ' || coalesce(v_t.room_code, '') || ')', null);
  return jsonb_build_object('code', v_code, 'tenantId', v_t.id, 'name', v_t.full_name,
    'phone', v_t.phone, 'roomCode', v_t.room_code);
end $$;

-- Cấp hàng loạt cho một tòa (mặc định chỉ những khách chưa có mã). Trả danh sách để chủ trọ gửi cho khách.
create or replace function public.owner_issue_tenant_codes(p_building_id text, p_only_missing boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_owner uuid := auth.uid(); v_t public.tenants; v_out jsonb := '[]'::jsonb; v_code text; v_n int := 0;
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  for v_t in
    select * from public.tenants
     where owner_id = v_owner and building_id = p_building_id
       and public._norm_phone(phone) ~ '^0[0-9]{9}$'
       and (not coalesce(p_only_missing, true) or app_code_set_at is null)
     order by room_code, is_rep desc, full_name
  loop
    v_code := public._issue_code(v_owner, v_t);
    v_out := v_out || jsonb_build_array(jsonb_build_object('code', v_code, 'tenantId', v_t.id, 'name', v_t.full_name,
      'phone', v_t.phone, 'roomCode', v_t.room_code, 'isRep', coalesce(v_t.is_rep, false)));
    v_n := v_n + 1;
  end loop;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_owner, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Chủ trọ', 'tenant.code',
    'Cấp mã vào app hàng loạt cho ' || v_n || ' khách (tòa ' || p_building_id || ')', null);
  return jsonb_build_object('count', v_n, 'codes', v_out);
end $$;

-- Thu hồi quyền vào app (khách đã trả phòng, mất điện thoại...). Đăng xuất mọi thiết bị.
create or replace function public.owner_revoke_tenant_access(p_tenant_id text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  delete from public.tenant_access where owner_id = v_owner and tenant_id = p_tenant_id;
  delete from public.tenant_sessions where owner_id = v_owner and tenant_id = p_tenant_id;
  update public.tenants set app_code_set_at = null where owner_id = v_owner and id = p_tenant_id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.owner_issue_tenant_code(text) from public, anon;
revoke execute on function public.owner_issue_tenant_codes(text, boolean) from public, anon;
revoke execute on function public.owner_revoke_tenant_access(text) from public, anon;
grant execute on function public.owner_issue_tenant_code(text) to authenticated;
grant execute on function public.owner_issue_tenant_codes(text, boolean) to authenticated;
grant execute on function public.owner_revoke_tenant_access(text) to authenticated;

-- ---------- Xóa các hàm tenant_* CŨ (nhận số điện thoại) ----------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('tenant_data', 'tenant_create_incident', 'tenant_notify_paid', 'tenant_submit_payment_claim',
                         'tenant_submit_reading', 'tenant_messages', 'tenant_send_message', 'tenant_request_renewal')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

-- ---------- Các hàm cho khách, nhận TOKEN ----------
-- Quy ước: token sai hoặc hết hạn → trả null (app hiểu là phải đăng nhập lại).

create or replace function public.tenant_data(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_b public.buildings; v_r public.rooms; v_c public.contracts;
begin
  v_t := public._tenant_from_token(p_token);
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

create or replace function public.tenant_create_incident(p_token text, p_category text, p_title text, p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_id text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  v_id := 'sc-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  insert into public.incidents(owner_id, id, building_id, room_code, category, title, status, photos, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, p_category, left(p_title, 500), 'open',
          coalesce(p_photos, '[]'::jsonb), now(), now());
  return jsonb_build_object('id', v_id, 'category', p_category, 'title', p_title, 'status', 'open', 'createdAt', now());
end $$;

create or replace function public.tenant_notify_paid(p_token text, p_invoice_id text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), v_t.full_name, 'tenant.paid',
          'Khách báo đã chuyển khoản cho ' || coalesce(left(p_invoice_id, 60), ''), null);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.tenant_submit_payment_claim(
  p_token text, p_invoice_id text, p_amount bigint, p_note text, p_photo text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_id text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  v_id := 'cl-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  insert into public.payment_claims(owner_id, id, building_id, room_code, tenant_name,
    invoice_id, amount, note, photo, status, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, v_t.full_name,
    p_invoice_id, coalesce(p_amount, 0), left(p_note, 500), p_photo, 'pending', now(), now());
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), v_t.full_name,
    'tenant.claim', 'Khách báo đã chuyển khoản cho ' || coalesce(left(p_invoice_id, 60), ''), null);
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

create or replace function public.tenant_submit_reading(
  p_token text, p_period text, p_elec numeric, p_water numeric, p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_rd public.readings;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;

  select * into v_rd from public.readings
    where owner_id = v_t.owner_id and building_id = v_t.building_id
      and room_code = v_t.room_code and period = p_period limit 1;

  if v_rd.id is null then
    insert into public.readings(owner_id, id, building_id, room_code, period,
      elec_curr, water_curr, photos, source, approved, updated_at)
    values (v_t.owner_id, 'rd-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), v_t.building_id, v_t.room_code, p_period,
      p_elec, p_water, coalesce(p_photos, '[]'::jsonb), 'tenant', false, now());
  else
    update public.readings
      set elec_curr = p_elec,
          water_curr = coalesce(p_water, water_curr),
          photos = coalesce(p_photos, '[]'::jsonb),
          source = 'tenant', approved = false, updated_at = now()
      where owner_id = v_rd.owner_id and id = v_rd.id;
  end if;

  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(),
          coalesce(v_t.full_name, 'Khách thuê'), 'reading.tenant',
          'Khách phòng ' || coalesce(v_t.room_code, '') || ' gửi chỉ số điện kỳ ' || coalesce(left(p_period, 10), ''), null)
  on conflict do nothing;

  return jsonb_build_object('ok', true, 'period', p_period);
end $$;

create or replace function public.tenant_send_message(p_token text, p_body text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_id text;
begin
  if coalesce(btrim(p_body), '') = '' then return null; end if;
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;

  v_id := 'ms-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.support_messages(
    owner_id, id, building_id, room_code, tenant_phone, tenant_name,
    sender, body, read_by_staff, read_by_tenant, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, public._norm_phone(v_t.phone), v_t.full_name,
    'tenant', left(btrim(p_body), 2000), false, true, now(), now());

  return jsonb_build_object('id', v_id, 'ok', true, 'createdAt', now());
end $$;

create or replace function public.tenant_messages(p_token text, p_after timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_out jsonb; v_ph text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  v_ph := public._norm_phone(v_t.phone);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'sender', m.sender, 'body', m.body,
           'staffName', m.staff_name, 'createdAt', m.created_at
         ) order by m.created_at), '[]'::jsonb)
    into v_out
    from public.support_messages m
   where m.owner_id = v_t.owner_id
     and public._norm_phone(m.tenant_phone) = v_ph
     and (p_after is null or m.created_at > p_after);

  update public.support_messages
     set read_by_tenant = true, updated_at = now()
   where owner_id = v_t.owner_id and public._norm_phone(tenant_phone) = v_ph
     and sender = 'staff' and read_by_tenant = false;

  return jsonb_build_object('messages', v_out, 'now', now());
end $$;

create or replace function public.tenant_request_renewal(p_token text, p_months int, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_c public.contracts; v_old public.renewal_requests; v_id text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  if p_months not in (3, 6, 12, 24) then return jsonb_build_object('error', 'bad_months'); end if;
  if not coalesce(v_t.is_rep, false) then return jsonb_build_object('error', 'not_rep'); end if;

  select * into v_c from public.contracts
    where owner_id = v_t.owner_id and building_id = v_t.building_id and room_code = v_t.room_code
      and status in ('active','terminating','expired') order by end_date desc limit 1;
  if v_c.id is null then return jsonb_build_object('error', 'no_contract'); end if;
  if v_c.end_date > current_date + 90 then return jsonb_build_object('error', 'too_early'); end if;

  select * into v_old from public.renewal_requests
    where owner_id = v_t.owner_id and contract_id = v_c.id and status = 'pending' limit 1;
  if v_old.id is not null then
    return jsonb_build_object('id', v_old.id, 'status', 'pending', 'months', v_old.months, 'duplicate', true);
  end if;

  v_id := 'rn-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  insert into public.renewal_requests(owner_id, id, building_id, room_code, contract_id, tenant_id, tenant_name,
    months, note, status, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, v_c.id, v_t.id, v_t.full_name,
    p_months, nullif(left(coalesce(p_note, ''), 300), ''), 'pending', now(), now());
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), v_t.full_name,
    'tenant.renewal', 'Khách xin gia hạn hợp đồng phòng ' || coalesce(v_t.room_code, '') || ' thêm ' || p_months || ' tháng', null);
  return jsonb_build_object('id', v_id, 'status', 'pending', 'months', p_months);
end $$;

grant execute on function public.tenant_data(text) to anon, authenticated;
grant execute on function public.tenant_create_incident(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.tenant_notify_paid(text, text) to anon, authenticated;
grant execute on function public.tenant_submit_payment_claim(text, text, bigint, text, text) to anon, authenticated;
grant execute on function public.tenant_submit_reading(text, text, numeric, numeric, jsonb) to anon, authenticated;
grant execute on function public.tenant_send_message(text, text) to anon, authenticated;
grant execute on function public.tenant_messages(text, timestamptz) to anon, authenticated;
grant execute on function public.tenant_request_renewal(text, int, text) to anon, authenticated;

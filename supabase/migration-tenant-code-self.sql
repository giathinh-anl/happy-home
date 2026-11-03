-- ============================================================
-- Happy Home — Khách tự đổi mã vào app + xin cấp lại mã khi quên
--
-- TRƯỚC: mã vào app (6 số) chỉ chủ trọ cấp. Khách muốn đổi, hoặc quên mã, phải nhắn chủ trọ.
-- BÂY GIỜ:
--   1. Khách đã đăng nhập tự đổi mã: nhập mã cũ + mã mới (hàm tenant_change_code).
--      Sai mã cũ 5 lần thì khóa 15 phút (dùng chung bộ đếm với lúc đăng nhập). Đổi xong, các máy khác bị đăng xuất.
--      Mã mới phải đủ 6 số, không phải 6 số giống nhau hay dãy liên tiếp, và không trùng mã cũ.
--   2. Khách quên mã bấm "Quên mã?" ở màn đăng nhập (hàm tenant_request_code). Hàm này luôn trả y hệt dù số có trong
--      hệ thống hay không, nên không dùng để dò số điện thoại. Mỗi khách tối đa 1 yêu cầu mỗi giờ.
--   3. Chủ trọ thấy các yêu cầu chưa xử lý (hàm owner_code_requests) và cấp lại mã như thường lệ; cấp mã là yêu cầu tự hết.
--      Không muốn cấp thì bấm bỏ qua (hàm owner_dismiss_code_requests).
--
-- LƯU Ý: chạy SAU migration-tenant-auth.sql. Chạy lại nhiều lần vẫn an toàn.
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- ============================================================

create table if not exists public.tenant_code_requests (
  id           bigserial primary key,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  tenant_id    text not null,
  requested_at timestamptz not null default now()
);
create index if not exists tenant_code_requests_idx on public.tenant_code_requests (owner_id, tenant_id, requested_at desc);
alter table public.tenant_code_requests enable row level security;
revoke all on public.tenant_code_requests from anon, authenticated;
-- Cố ý không có policy nào: chỉ các hàm security definer bên dưới đọc và ghi được.

-- ---------- Khách tự đổi mã ----------
create or replace function public.tenant_change_code(p_token text, p_old text, p_new text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_t public.tenants; v_phone text; v_fail public.tenant_login_fail; v_ok boolean; v_h text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;                          -- token sai hoặc hết hạn: app hiểu là phải đăng nhập lại
  v_phone := public._norm_phone(v_t.phone);

  select * into v_fail from public.tenant_login_fail where phone = v_phone for update;
  if v_fail.phone is not null and v_fail.locked_until is not null and v_fail.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'retryAfterSec', ceil(extract(epoch from (v_fail.locked_until - now())))::int);
  end if;

  -- mã mới: kiểm trước, chưa tốn lượt thử mã cũ
  if coalesce(p_new, '') !~ '^[0-9]{6}$' then return jsonb_build_object('error', 'invalid_new'); end if;
  if p_new ~ '^([0-9])\1{5}$'
     or p_new in ('012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210') then
    return jsonb_build_object('error', 'weak');
  end if;
  if p_new = p_old then return jsonb_build_object('error', 'same'); end if;

  select exists (
    select 1 from public.tenant_access a
     where a.owner_id = v_t.owner_id and a.tenant_id = v_t.id
       and coalesce(p_old, '') ~ '^[0-9]{6}$'
       and a.code_hash = extensions.crypt(p_old, a.code_hash)
  ) into v_ok;

  if not v_ok then
    perform extensions.crypt(coalesce(p_old, ''), extensions.gen_salt('bf'));
    insert into public.tenant_login_fail(phone, fails, updated_at) values (v_phone, 1, now())
    on conflict (phone) do update set fails = public.tenant_login_fail.fails + 1, updated_at = now();
    update public.tenant_login_fail set fails = 0, locked_until = now() + interval '15 minutes'
     where phone = v_phone and fails >= 5;
    select * into v_fail from public.tenant_login_fail where phone = v_phone;
    if v_fail.locked_until is not null and v_fail.locked_until > now() then
      return jsonb_build_object('error', 'locked', 'retryAfterSec', 900);
    end if;
    return jsonb_build_object('error', 'wrong_old');
  end if;

  v_h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  update public.tenant_access
     set code_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), set_at = now()
   where owner_id = v_t.owner_id and tenant_id = v_t.id;
  delete from public.tenant_sessions where owner_id = v_t.owner_id and tenant_id = v_t.id and token_hash <> v_h;   -- máy khác phải nhập mã mới
  delete from public.tenant_login_fail where phone = v_phone;
  update public.tenants set app_code_set_at = now() where owner_id = v_t.owner_id and id = v_t.id;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Khách thuê', 'tenant.code',
    coalesce(v_t.full_name, '') || ' (phòng ' || coalesce(v_t.room_code, '') || ') tự đổi mã vào app', null);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Khách quên mã: gửi yêu cầu cho chủ trọ (gọi không cần đăng nhập) ----------
create or replace function public.tenant_request_code(p_phone text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_phone text := public._norm_phone(p_phone); v_t public.tenants;
begin
  if v_phone ~ '^0[0-9]{9}$' then
    delete from public.tenant_code_requests where requested_at < now() - interval '30 days';
    for v_t in select * from public.tenants where public._norm_phone(phone) = v_phone loop
      if not exists (select 1 from public.tenant_code_requests r
                      where r.owner_id = v_t.owner_id and r.tenant_id = v_t.id and r.requested_at > now() - interval '1 hour') then
        insert into public.tenant_code_requests(owner_id, tenant_id) values (v_t.owner_id, v_t.id);
      end if;
    end loop;
  end if;
  return jsonb_build_object('ok', true);        -- luôn y hệt: không lộ số nào có trong hệ thống
end $$;

-- ---------- Chủ trọ xem và xử lý yêu cầu ----------
-- Yêu cầu còn mở = gửi SAU lần cấp mã gần nhất của khách đó.
create or replace function public.owner_code_requests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(q.x order by q.at desc)
      from (
        select jsonb_build_object('tenantId', t.id, 'name', t.full_name, 'roomCode', t.room_code, 'buildingId', t.building_id,
                 'phone', t.phone, 'requestedAt', max(r.requested_at), 'n', count(*)) as x, max(r.requested_at) as at
          from public.tenant_code_requests r
          join public.tenants t on t.owner_id = r.owner_id and t.id = r.tenant_id
         where r.owner_id = v_owner and r.requested_at > coalesce(t.app_code_set_at, '-infinity'::timestamptz)
         group by t.id, t.full_name, t.room_code, t.building_id, t.phone
      ) q
  ), '[]'::jsonb);
end $$;

create or replace function public.owner_dismiss_code_requests(p_tenant_id text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_owner uuid := auth.uid();
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  delete from public.tenant_code_requests where owner_id = v_owner and tenant_id = p_tenant_id;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.tenant_change_code(text, text, text) from public;
revoke execute on function public.tenant_request_code(text) from public;
revoke execute on function public.owner_code_requests() from public, anon;
revoke execute on function public.owner_dismiss_code_requests(text) from public, anon;
grant execute on function public.tenant_change_code(text, text, text) to anon, authenticated;
grant execute on function public.tenant_request_code(text) to anon, authenticated;
grant execute on function public.owner_code_requests() to authenticated;
grant execute on function public.owner_dismiss_code_requests(text) to authenticated;

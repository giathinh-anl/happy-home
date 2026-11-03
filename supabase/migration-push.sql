-- ============================================================
-- Happy Home — Thông báo đẩy lên điện thoại khách thuê (Web Push)
--
-- Khách bật thông báo ở app (Tài khoản → Thông báo trên điện thoại). Từ đó điện thoại báo khi:
--   * chủ nhà gửi nhắc hạn đóng tiền (bảng tenant_notices, do việc chạy ban đêm ghi)
--   * nhân viên trả lời tin nhắn của khách (support_messages, sender = 'staff')
-- Mỗi thông báo chỉ có tiêu đề + một dòng ngắn, bấm vào mở đúng màn trong app.
--
-- CÁCH GỬI: trigger gom các máy đã đăng ký của đúng khách rồi gọi hàm Edge "push-send" qua pg_net. Hàm đó giữ khóa VAPID
-- riêng (bí mật) và gọi dịch vụ đẩy của trình duyệt. Hàm kiểm một chuỗi bí mật chung (push_config.secret) trước khi làm gì.
--   * Chưa bật pg_net, chưa điền push_config hoặc chưa triển khai hàm: app vẫn chạy bình thường, chỉ là không có thông báo đẩy.
--   * Trigger KHÔNG BAO GIỜ làm hỏng việc ghi tin nhắn hay thông báo (mọi lỗi khi gửi bị nuốt).
--   * Chỉ nhận địa chỉ đăng ký thuộc dịch vụ đẩy của Google, Mozilla, Apple, Microsoft (chặn việc nhét địa chỉ nội bộ).
--
-- LƯU Ý: chạy SAU migration-tenant-auth.sql, migration-support-chat.sql, migration-nightly.sql. Chạy lại nhiều lần vẫn an toàn.
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Sau đó làm theo mục "Thông báo đẩy" trong README.
-- ============================================================

create table if not exists public.tenant_push_subs (
  endpoint   text primary key,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  tenant_id  text not null,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists tenant_push_subs_tenant_idx on public.tenant_push_subs (owner_id, tenant_id);
alter table public.tenant_push_subs enable row level security;
revoke all on public.tenant_push_subs from public, anon, authenticated;     -- không có policy: chỉ hàm security definer đụng tới

-- Một dòng duy nhất: địa chỉ hàm push-send và chuỗi bí mật chung. Điền tay sau khi triển khai hàm (xem README).
create table if not exists public.push_config (
  id     int primary key default 1 check (id = 1),
  url    text,
  secret text
);
insert into public.push_config(id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from public, anon, authenticated;

-- ---------- Khách đăng ký / hủy trên máy này ----------
create or replace function public.tenant_push_subscribe(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  if coalesce(p_endpoint, '') !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com)/[^\s]*$'
     or length(p_endpoint) > 1000 then
    return jsonb_build_object('error', 'bad_endpoint');
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{20,200}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('error', 'bad_keys');
  end if;
  -- mỗi khách tối đa 10 máy: cũ nhất bị thay
  delete from public.tenant_push_subs where endpoint in (
    select endpoint from public.tenant_push_subs where owner_id = v_t.owner_id and tenant_id = v_t.id and endpoint <> p_endpoint
     order by created_at desc offset 9);
  insert into public.tenant_push_subs(endpoint, owner_id, tenant_id, p256dh, auth, ua)
  values (p_endpoint, v_t.owner_id, v_t.id, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update
    set owner_id = excluded.owner_id, tenant_id = excluded.tenant_id, p256dh = excluded.p256dh, auth = excluded.auth,
        ua = excluded.ua, created_at = now();                 -- cùng một máy đăng nhập sang khách khác thì chuyển chủ
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.tenant_push_unsubscribe(p_token text, p_endpoint text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  delete from public.tenant_push_subs where endpoint = p_endpoint and owner_id = v_t.owner_id and tenant_id = v_t.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Gửi (nội bộ) ----------
-- p_tenant_ids: các khách nhận. Không có máy nào đăng ký, chưa cấu hình, hoặc chưa có pg_net thì lặng lẽ bỏ qua.
create or replace function public._push_send(p_owner uuid, p_tenant_ids text[], p_title text, p_body text, p_url text)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_subs jsonb; v_cfg public.push_config;
begin
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) into v_subs
    from public.tenant_push_subs s where s.owner_id = p_owner and s.tenant_id = any(p_tenant_ids);
  if v_subs is null then return; end if;
  select * into v_cfg from public.push_config where id = 1;
  if coalesce(v_cfg.url, '') = '' or coalesce(v_cfg.secret, '') = '' then return; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'net' and p.proname = 'http_post') then return; end if;
  perform net.http_post(url := v_cfg.url,
    body := jsonb_build_object('subs', v_subs, 'title', left(coalesce(p_title, ''), 80), 'body', left(coalesce(p_body, ''), 160), 'url', coalesce(p_url, '#/home')),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_cfg.secret));
exception when others then
  null;           -- gửi thông báo hỏng không được làm hỏng việc ghi tin nhắn / thông báo
end $$;
revoke execute on function public._push_send(uuid, text[], text, text, text) from public, anon, authenticated;

-- Nhắc hạn đóng tiền (tenant_notices theo PHÒNG): báo cho mọi khách đang ở phòng đó
create or replace function public._push_on_notice() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._push_send(new.owner_id,
    coalesce((select array_agg(t.id) from public.tenants t where t.owner_id = new.owner_id and t.building_id = new.building_id and t.room_code = new.room_code), '{}'::text[]),
    new.title, new.body, '#/invoices');
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists push_on_notice on public.tenant_notices;
create trigger push_on_notice after insert on public.tenant_notices for each row execute function public._push_on_notice();

-- Nhân viên trả lời: báo cho khách có số điện thoại đó (cùng chủ trọ)
create or replace function public._push_on_support() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.sender is distinct from 'staff' then return null; end if;
  perform public._push_send(new.owner_id,
    coalesce((select array_agg(t.id) from public.tenants t where t.owner_id = new.owner_id and public._norm_phone(t.phone) = public._norm_phone(new.tenant_phone)), '{}'::text[]),
    'Nhân viên vừa trả lời anh/chị', new.body, '#/chat');
  return null;
exception when others then
  return null;
end $$;
drop trigger if exists push_on_support on public.support_messages;
create trigger push_on_support after insert on public.support_messages for each row execute function public._push_on_support();

revoke execute on function public.tenant_push_subscribe(text, text, text, text, text) from public;
revoke execute on function public.tenant_push_unsubscribe(text, text) from public;
revoke execute on function public._push_on_notice() from public, anon, authenticated;
revoke execute on function public._push_on_support() from public, anon, authenticated;
grant execute on function public.tenant_push_subscribe(text, text, text, text, text) to anon, authenticated;
grant execute on function public.tenant_push_unsubscribe(text, text) to anon, authenticated;

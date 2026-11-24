-- ============================================================
-- Happy Home — Thông báo đẩy tới điện thoại / máy tính của CHỦ TRỌ (Web Push), kể cả khi đã đóng web
--
-- Báo khi KHÁCH THUÊ (từ app khách) tạo việc mới:
--   * nhắn tin (support_messages, sender = 'tenant'); một khách nhắn liền nhiều câu thì 2 phút chỉ báo một lần
--   * báo đã chuyển khoản (payment_claims)
--   * báo hỏng (incidents, trạng thái 'open')
--   * xin gia hạn hợp đồng (renewal_requests)
--   * tự gửi chỉ số điện chờ duyệt (readings, source = 'tenant', approved = false)
-- Việc do chính chủ trọ hay nhân viên ghi từ web (đang đăng nhập) thì KHÔNG báo: chỉ báo khi lệnh không mang tài khoản
-- đăng nhập nào (auth.uid() rỗng), tức là đến từ app khách thuê.
--
-- DÙNG LẠI hạ tầng thông báo của app khách (supabase/migration-push.sql): bảng push_config, hàm Edge "push-send", khóa VAPID.
-- KHÔNG cần triển khai lại hàm Edge, không cần thêm khóa bí mật nào.
--   * Chưa có pg_net hay chưa điền push_config: web chủ trọ vẫn chạy bình thường, chỉ là không có thông báo đẩy.
--   * Trigger KHÔNG BAO GIỜ làm hỏng việc khách gửi tin, gửi chỉ số... (mọi lỗi khi gửi thông báo bị nuốt).
--   * Chỉ nhận địa chỉ đăng ký của dịch vụ đẩy Google, Mozilla, Apple, Microsoft (chặn việc nhét địa chỉ nội bộ).
--
-- Chạy SAU migration-push.sql. Chạy lại nhiều lần vẫn an toàn. Không xóa, không sửa dữ liệu có sẵn
-- (chỉ có lệnh xóa bên trong hàm: bỏ máy cũ nhất khi một tài khoản đăng ký quá 5 máy, và khi chủ trọ tự tắt trên một máy).
-- ============================================================

create table if not exists public.owner_push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,   -- tài khoản đã bật thông báo trên máy này
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
create index if not exists owner_push_subs_user_idx on public.owner_push_subs (user_id);
alter table public.owner_push_subs enable row level security;
revoke all on public.owner_push_subs from public, anon, authenticated;        -- không có policy: chỉ hàm security definer đụng tới

-- ---------- Chủ trọ bật / tắt trên máy này (phải đăng nhập) ----------
create or replace function public.owner_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error', 'auth'); end if;
  if coalesce(p_endpoint, '') !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com)/[^\s]*$'
     or length(p_endpoint) > 1000 then
    return jsonb_build_object('error', 'bad_endpoint');
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{20,200}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{8,64}$' then
    return jsonb_build_object('error', 'bad_keys');
  end if;
  -- mỗi tài khoản tối đa 5 máy: máy cũ nhất bị thay (máy đã gỡ / đổi trình duyệt không nằm mãi trong danh sách)
  delete from public.owner_push_subs where endpoint in (
    select endpoint from public.owner_push_subs where user_id = v_uid and endpoint <> p_endpoint
     order by created_at desc offset 4);
  insert into public.owner_push_subs(endpoint, user_id, p256dh, auth, ua)
  values (p_endpoint, v_uid, p_p256dh, p_auth, left(p_ua, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.owner_push_unsubscribe(p_endpoint text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth'); end if;
  delete from public.owner_push_subs where endpoint = p_endpoint and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Gửi (nội bộ): mọi máy của tài khoản p_owner, qua hàm Edge push-send ----------
create or replace function public._owner_push_send(p_owner uuid, p_title text, p_body text, p_url text)
returns int language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_subs jsonb; v_cfg public.push_config; v_n int;
begin
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), count(*)
    into v_subs, v_n from public.owner_push_subs s where s.user_id = p_owner;
  if v_subs is null then return 0; end if;
  select * into v_cfg from public.push_config where id = 1;
  if coalesce(v_cfg.url, '') = '' or coalesce(v_cfg.secret, '') = '' then return 0; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'net' and p.proname = 'http_post') then return 0; end if;
  perform net.http_post(url := v_cfg.url,
    body := jsonb_build_object('subs', v_subs, 'title', left(coalesce(p_title, ''), 80), 'body', left(coalesce(p_body, ''), 160),
                               'url', case when p_url ~ '^#/[A-Za-z0-9/_-]{1,40}$' then p_url else '#/dashboard' end),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_cfg.secret)
      || case when coalesce(v_cfg.anon_key, '') <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_cfg.anon_key, 'apikey', v_cfg.anon_key) else '{}'::jsonb end);
  return v_n;
exception when others then
  return 0;       -- gửi thông báo hỏng không được làm hỏng việc khách vừa làm
end $$;
revoke execute on function public._owner_push_send(uuid, text, text, text) from public, anon, authenticated;

-- Đường dẫn trong web chủ trọ tới trang của một tòa; mã tòa lạ thì về trang Tổng quan
create or replace function public._owner_push_url(p_building text, p_page text)
returns text language sql immutable set search_path = public as $$
  select case when coalesce(p_building, '') ~ '^[A-Za-z0-9_-]{1,30}$' then '#/b/' || p_building || '/' || p_page else '#/dashboard' end
$$;
revoke execute on function public._owner_push_url(text, text) from public, anon, authenticated;

-- "P101" hoặc "P101 · Tên khách"
create or replace function public._owner_push_ai(p_room text, p_name text)
returns text language sql immutable set search_path = public as $$
  select concat_ws(' · ', nullif(btrim(coalesce(p_room, '')), ''), nullif(btrim(coalesce(p_name, '')), ''))
$$;
revoke execute on function public._owner_push_ai(text, text) from public, anon, authenticated;

-- Số tiền kiểu Việt Nam: 3.500.000
create or replace function public._owner_push_tien(p bigint)
returns text language sql immutable set search_path = public as $$
  select replace(to_char(coalesce(p, 0), 'FM999,999,999,999,999'), ',', '.')
$$;
revoke execute on function public._owner_push_tien(bigint) from public, anon, authenticated;

-- ---------- Trigger: chỉ việc đến từ app khách (không có tài khoản đăng nhập) ----------
create or replace function public._owner_push_on_message() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null or new.sender is distinct from 'tenant' then return null; end if;
  -- khách nhắn liền nhiều câu: câu chưa đọc trước đó trong 2 phút đã được báo rồi
  if exists (select 1 from public.support_messages m
              where m.owner_id = new.owner_id and m.tenant_phone = new.tenant_phone and m.sender = 'tenant' and m.id <> new.id
                and not m.read_by_staff and m.created_at > new.created_at - interval '2 minutes' and m.created_at <= new.created_at) then
    return null;
  end if;
  perform public._owner_push_send(new.owner_id, 'Tin nhắn mới · ' || coalesce(nullif(new.room_code, ''), 'khách thuê'),
    coalesce(nullif(btrim(new.tenant_name), '') || ': ', '') || left(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'), 120),
    public._owner_push_url(new.building_id, 'support'));
  return null;
exception when others then
  return null;
end $$;

create or replace function public._owner_push_on_claim() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null then return null; end if;
  perform public._owner_push_send(new.owner_id, 'Khách báo đã chuyển khoản · ' || coalesce(nullif(new.room_code, ''), '?'),
    concat_ws(' · ', nullif(btrim(coalesce(new.tenant_name, '')), ''), public._owner_push_tien(new.amount) || ' ₫', nullif(left(coalesce(new.invoice_id, ''), 30), ''))
      || '. Mở để đối soát.',
    '#/transfers');
  return null;
exception when others then
  return null;
end $$;

create or replace function public._owner_push_on_incident() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null or coalesce(new.status, 'open') <> 'open' then return null; end if;
  perform public._owner_push_send(new.owner_id, 'Báo hỏng mới · ' || coalesce(nullif(new.room_code, ''), '?'),
    left(regexp_replace(coalesce(nullif(btrim(new.title), ''), 'Khách báo cần sửa chữa'), '\s+', ' ', 'g'), 140),
    public._owner_push_url(new.building_id, 'incidents'));
  return null;
exception when others then
  return null;
end $$;

create or replace function public._owner_push_on_renewal() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null or coalesce(new.status, 'pending') <> 'pending' then return null; end if;
  perform public._owner_push_send(new.owner_id, 'Khách xin gia hạn hợp đồng · ' || coalesce(nullif(new.room_code, ''), '?'),
    coalesce(nullif(btrim(new.tenant_name), ''), 'Khách') || ' xin gia hạn thêm ' || coalesce(new.months, 0) || ' tháng.',
    public._owner_push_url(new.building_id, 'contracts'));
  return null;
exception when others then
  return null;
end $$;

create or replace function public._owner_push_on_reading() returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null or new.source is distinct from 'tenant' or coalesce(new.approved, true) then return null; end if;
  -- sửa lại đúng số đã gửi (không đổi gì) thì thôi
  if tg_op = 'UPDATE' and old.source = 'tenant' and not coalesce(old.approved, true) and old.elec_curr is not distinct from new.elec_curr then return null; end if;
  perform public._owner_push_send(new.owner_id, 'Khách gửi chỉ số điện · ' || coalesce(nullif(new.room_code, ''), '?'),
    'Kỳ ' || coalesce(new.period, '?') || ': '
      || coalesce(case when new.elec_curr = trunc(new.elec_curr) then public._owner_push_tien(new.elec_curr::bigint) else new.elec_curr::text end, '?')
      || '. Chờ anh/chị duyệt.',
    public._owner_push_url(new.building_id, 'readings'));
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists owner_push_on_message on public.support_messages;
create trigger owner_push_on_message after insert on public.support_messages for each row execute function public._owner_push_on_message();
drop trigger if exists owner_push_on_claim on public.payment_claims;
create trigger owner_push_on_claim after insert on public.payment_claims for each row execute function public._owner_push_on_claim();
drop trigger if exists owner_push_on_incident on public.incidents;
create trigger owner_push_on_incident after insert on public.incidents for each row execute function public._owner_push_on_incident();
drop trigger if exists owner_push_on_renewal on public.renewal_requests;
create trigger owner_push_on_renewal after insert on public.renewal_requests for each row execute function public._owner_push_on_renewal();
drop trigger if exists owner_push_on_reading on public.readings;
create trigger owner_push_on_reading after insert or update of elec_curr, source, approved on public.readings for each row execute function public._owner_push_on_reading();

-- ---------- Gửi thử tới các máy của chính mình (nút "Gửi thử" ở Cài đặt chung) ----------
create or replace function public.owner_push_test()
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_n int;
begin
  if auth.uid() is null then return jsonb_build_object('error', 'auth'); end if;
  v_n := public._owner_push_send(auth.uid(), 'Happy Home: thông báo thử', 'Máy này sẽ báo như thế này khi khách nhắn tin, báo chuyển khoản, báo hỏng.', '#/config');
  return jsonb_build_object('ok', true, 'devices', v_n);
end $$;

revoke execute on function public._owner_push_on_message() from public, anon, authenticated;
revoke execute on function public._owner_push_on_claim() from public, anon, authenticated;
revoke execute on function public._owner_push_on_incident() from public, anon, authenticated;
revoke execute on function public._owner_push_on_renewal() from public, anon, authenticated;
revoke execute on function public._owner_push_on_reading() from public, anon, authenticated;
revoke execute on function public.owner_push_subscribe(text, text, text, text) from public, anon;
revoke execute on function public.owner_push_unsubscribe(text) from public, anon;
revoke execute on function public.owner_push_test() from public, anon;
grant execute on function public.owner_push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.owner_push_unsubscribe(text) to authenticated;
grant execute on function public.owner_push_test() to authenticated;

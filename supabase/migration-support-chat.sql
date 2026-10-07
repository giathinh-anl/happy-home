-- ============================================================
-- Happy Home — Khách nhắn thẳng cho nhân viên trực
--
-- VÌ SAO CẦN?
--   Trợ lý ảo trong app khách thuê chỉ trả lời được mấy việc tra cứu sẵn.
--   Câu nào nó không hiểu thì trước đây đẩy thành một "sự cố" tên là
--   "[Câu hỏi] ...", khách không nhận được câu trả lời nào trong app, mà nhân
--   viên cũng không có chỗ để trả lời. Bảng này là chỗ hai bên nhắn qua lại.
--
--   Mỗi số điện thoại khách là MỘT cuộc trò chuyện. sender='tenant' là khách
--   nhắn, sender='staff' là nhân viên trả lời.
--
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- ============================================================

create table if not exists public.support_messages (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text,
  room_code text,
  tenant_phone text not null,
  tenant_name text,
  sender text not null,                       -- 'tenant' | 'staff'
  staff_name text,                            -- tên người trực đã trả lời
  body text not null,
  created_at timestamptz not null default now(),
  read_by_staff boolean not null default false,
  read_by_tenant boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

-- Mở một cuộc trò chuyện: luôn lọc theo số điện thoại rồi xếp theo thời gian
create index if not exists support_msg_phone_idx on public.support_messages (owner_id, tenant_phone, created_at);
-- Hộp thư của nhân viên: đếm nhanh câu chưa đọc
create index if not exists support_msg_unread_idx on public.support_messages (owner_id, read_by_staff) where sender = 'tenant';

alter table public.support_messages enable row level security;
drop policy if exists own_all on public.support_messages;
create policy own_all on public.support_messages for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant all on public.support_messages to authenticated;

-- ============================================================
-- Hàm cho APP KHÁCH THUÊ (khách không đăng nhập tài khoản chủ trọ)
-- SECURITY DEFINER: vượt RLS nhưng chỉ đụng tới dữ liệu ứng với SĐT truyền vào.
-- ============================================================

-- Khách gửi một câu hỏi cho nhân viên trực
create or replace function public.tenant_send_message(p_phone text, p_body text)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_id text;
begin
  if coalesce(btrim(p_body), '') = '' then return null; end if;
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;

  v_id := 'ms-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.support_messages(
    owner_id, id, building_id, room_code, tenant_phone, tenant_name,
    sender, body, read_by_staff, read_by_tenant, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, p_phone, v_t.full_name,
    'tenant', btrim(p_body), false, true, now(), now());

  return jsonb_build_object('id', v_id, 'ok', true, 'createdAt', now());
end $$;

-- Khách mở màn trò chuyện: lấy tin nhắn, đồng thời đánh dấu đã đọc phần của nhân viên.
-- p_after: chỉ lấy tin mới hơn mốc này (để hỏi lại cho nhẹ), để null thì lấy tất.
create or replace function public.tenant_messages(p_phone text, p_after timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_out jsonb;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'sender', m.sender, 'body', m.body,
           'staffName', m.staff_name, 'createdAt', m.created_at
         ) order by m.created_at), '[]'::jsonb)
    into v_out
    from public.support_messages m
   where m.owner_id = v_t.owner_id
     and m.tenant_phone = p_phone
     and (p_after is null or m.created_at > p_after);

  update public.support_messages
     set read_by_tenant = true, updated_at = now()
   where owner_id = v_t.owner_id and tenant_phone = p_phone
     and sender = 'staff' and read_by_tenant = false;

  return jsonb_build_object('messages', v_out, 'now', now());
end $$;

grant execute on function public.tenant_send_message(text, text) to anon, authenticated;
grant execute on function public.tenant_messages(text, timestamptz) to anon, authenticated;

-- ============================================================
-- KIỂM TRA: xem các cuộc trò chuyện đang có
--   select tenant_phone, tenant_name, count(*) as so_tin,
--          count(*) filter (where sender = 'tenant' and not read_by_staff) as chua_tra_loi
--     from support_messages group by 1, 2 order by 3 desc;
-- ============================================================

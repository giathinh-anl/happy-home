-- ============================================================
-- Happy Home — Ảnh đính kèm trong chat khách <-> nhân viên (chủ trọ)
-- Chạy trong Supabase → SQL Editor → New query → Run
-- Chạy lại nhiều lần vẫn an toàn. Chỉ THÊM (một cột, một bảng, hai hàm), không đụng tin nhắn có sẵn.
-- Phải chạy SAU migration-tenant-auth.sql (dùng hàm kiểm token của khách).
--
-- Vì sao ảnh nằm ở BẢNG RIÊNG chứ không nhét vào support_messages?
--   Trang "Hỏi đáp khách thuê" của chủ trọ hỏi máy chủ mỗi 3,5 giây và tải TOÀN BỘ dòng của support_messages.
--   Ảnh vài trăm KB mỗi tấm nằm cùng bảng thì mỗi lượt hỏi nặng thêm hàng MB. Nên tin nhắn chỉ ghi SỐ ảnh (photo_count),
--   ảnh nằm ở support_message_photos và chỉ được tải khi mở cuộc trò chuyện đó.
--
-- Giới hạn (khớp js/chat-photos.js): tối đa 3 ảnh mỗi tin, mỗi ảnh tối đa 300.000 ký tự (khoảng 220 KB), cả tin tối đa 700.000 ký tự,
-- chỉ JPG / PNG / WebP dạng data URL (không SVG vì SVG chạy được mã). Khách gửi tối đa 20 tin có ảnh mỗi giờ.
-- ============================================================

alter table public.support_messages add column if not exists photo_count int not null default 0;
do $$ begin
  alter table public.support_messages add constraint support_messages_photo_count_chk check (photo_count between 0 and 3);
exception when duplicate_object then null; end $$;

create table if not exists public.support_message_photos (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message_id text not null,
  idx        int  not null,
  data       text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, message_id, idx),
  constraint support_photos_idx_chk check (idx between 0 and 2),
  constraint support_photos_data_chk check (length(data) <= 300000 and data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$')
);

alter table public.support_message_photos enable row level security;
drop policy if exists own_all on public.support_message_photos;
create policy own_all on public.support_message_photos for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke all on public.support_message_photos from public, anon;
grant all on public.support_message_photos to authenticated;

-- Danh sách ảnh có hợp lệ không (mảng, tối đa 3, từng ảnh đúng dạng và cỡ, tổng cỡ). Viết bằng if để không phụ thuộc thứ tự tính của AND.
create or replace function public._chat_photos_hop_le(p jsonb) returns boolean
language plpgsql immutable as $$
declare e jsonb; s text; tong int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return false; end if;
  if jsonb_array_length(p) > 3 then return false; end if;
  for e in select * from jsonb_array_elements(p) loop
    if jsonb_typeof(e) <> 'string' then return false; end if;
    s := e #>> '{}';
    if length(s) > 300000 or s !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
    tong := tong + length(s);
  end loop;
  return tong <= 700000;
end $$;
revoke execute on function public._chat_photos_hop_le(jsonb) from public, anon, authenticated;

-- Khách gửi tin (có thể kèm ảnh). Hàm cũ 2 tham số bị thay bằng hàm 3 tham số (p_photos mặc định rỗng): gọi kiểu cũ vẫn chạy, và
-- không còn hai hàm trùng tên làm Postgres không biết chọn hàm nào. Quy ước như các hàm tenant_* khác: token sai trả null.
drop function if exists public.tenant_send_message(text, text);
create or replace function public.tenant_send_message(p_token text, p_body text, p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_id text; v_body text := left(btrim(coalesce(p_body, ''), E' \t\r\n'), 2000); v_n int; v_ph text; i int;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  if p_photos is null or jsonb_typeof(p_photos) = 'null' then p_photos := '[]'::jsonb; end if;
  if not public._chat_photos_hop_le(p_photos) then return jsonb_build_object('error', 'invalid'); end if;
  v_n := jsonb_array_length(p_photos);
  if v_body = '' and v_n = 0 then return null; end if;
  v_ph := public._norm_phone(v_t.phone);

  if v_n > 0 and (select count(*) from public.support_messages m
                   where m.owner_id = v_t.owner_id and public._norm_phone(m.tenant_phone) = v_ph and m.sender = 'tenant'
                     and m.photo_count > 0 and m.created_at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('error', 'too_many');
  end if;

  v_id := 'ms-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.support_messages(
    owner_id, id, building_id, room_code, tenant_phone, tenant_name,
    sender, body, photo_count, read_by_staff, read_by_tenant, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, v_ph, v_t.full_name,
    'tenant', v_body, v_n, false, true, now(), now());
  for i in 0 .. v_n - 1 loop
    insert into public.support_message_photos(owner_id, message_id, idx, data) values (v_t.owner_id, v_id, i, p_photos ->> i);
  end loop;

  return jsonb_build_object('id', v_id, 'ok', true, 'createdAt', now());
end $$;

-- Khách đọc tin: như cũ, thêm photoCount để app biết tin nào có ảnh rồi tải ảnh riêng
create or replace function public.tenant_messages(p_token text, p_after timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_out jsonb; v_ph text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  v_ph := public._norm_phone(v_t.phone);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'sender', m.sender, 'body', m.body,
           'staffName', m.staff_name, 'createdAt', m.created_at, 'photoCount', m.photo_count
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

-- Khách tải ảnh của các tin trong cuộc trò chuyện CỦA MÌNH (tối đa 10 tin mỗi lần). Tin của người khác không bao giờ trả ra.
-- Trả { "mã tin": ["data:image/...", ...] }.
create or replace function public.tenant_message_photos(p_token text, p_ids jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_ph text; v_out jsonb;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  if p_ids is null or jsonb_typeof(p_ids) <> 'array' then return '{}'::jsonb; end if;
  v_ph := public._norm_phone(v_t.phone);
  select coalesce(jsonb_object_agg(x.mid, x.arr), '{}'::jsonb) into v_out
    from (
      select m.id as mid,
             (select jsonb_agg(p.data order by p.idx) from public.support_message_photos p
               where p.owner_id = m.owner_id and p.message_id = m.id) as arr
        from public.support_messages m
       where m.owner_id = v_t.owner_id and public._norm_phone(m.tenant_phone) = v_ph and m.photo_count > 0
         and m.id in (select e #>> '{}' from jsonb_array_elements(p_ids) e limit 10)
    ) x
   where x.arr is not null;
  return v_out;
end $$;

revoke all on function public.tenant_send_message(text, text, jsonb) from public;
revoke all on function public.tenant_message_photos(text, jsonb) from public;
grant execute on function public.tenant_send_message(text, text, jsonb) to anon, authenticated;
grant execute on function public.tenant_message_photos(text, jsonb) to anon, authenticated;

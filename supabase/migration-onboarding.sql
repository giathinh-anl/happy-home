-- ============================================================
-- Happy Home — Khách tự khai thông tin qua 1 đường link / mã QR
--
-- Luồng: chủ trọ tạo lời mời cho một phòng → hệ thống sinh link có token ngẫu nhiên (hết hạn, dùng một lần)
-- → khách mở link trên điện thoại, tự điền thông tin và chụp CCCD hai mặt, KHÔNG cần đăng nhập hay cài gì
-- → hồ sơ chờ chủ trọ duyệt → chủ trọ đối chiếu ảnh, sửa nếu cần, lưu thành khách thuê.
--
-- BẢO MẬT (CCCD là dữ liệu nhạy cảm):
--   * Máy chủ chỉ lưu BĂM của token (sha256), không lưu token. Link chỉ hiện một lần lúc tạo. Quên thì tạo link mới.
--   * Token 144 bit ngẫu nhiên, không đoán được. Hết hạn (mặc định 72 giờ), dùng đúng MỘT lần: gửi xong link chết.
--   * Link sai / hết hạn / đã dùng / đã thu hồi đều trả cùng một câu "không hợp lệ": không dò ra được link nào còn sống.
--   * Khách (anon) không đọc được bảng nào. Chỉ có hai hàm: xem thông tin phòng, và gửi hồ sơ. Hàm gửi kiểm tra lại
--     MỌI trường ở máy chủ (không tin trình duyệt) và chỉ nhận đúng các trường cần.
--   * Ảnh CCCD nằm ở bảng riêng, chỉ chủ trọ của lời mời đọc được (RLS). Ảnh của hồ sơ bị từ chối / hết hạn bị xóa sau 30 ngày,
--     dữ liệu khai của hồ sơ đã duyệt xóa khỏi bảng lời mời sau 30 ngày (hồ sơ khách đã nằm ở bảng khách thuê).
--
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần vẫn an toàn.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Bảng ----------
create table if not exists public.onboarding_invites (
  owner_id       uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  token_hash     text not null unique,            -- sha256 của token; không lưu token
  building_id    text not null,
  room_code      text,                             -- null = chưa gắn phòng, chủ trọ chọn lúc duyệt
  note           text,                             -- ghi chú của chủ trọ, khách không thấy
  status         text not null default 'pending',  -- pending | submitted | approved | rejected | revoked
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  submitted_at   timestamptz,
  submitted_data jsonb,                            -- thông tin khách khai (đã kiểm tra ở máy chủ), không gồm ảnh
  decided_at     timestamptz,
  decision_note  text,
  tenant_id      text,                             -- hồ sơ khách tạo ra khi duyệt
  primary key (owner_id, id)
);
create index if not exists onboarding_invites_bid_idx on public.onboarding_invites (owner_id, building_id, status);

-- Ảnh CCCD tách bảng riêng để không bị tải theo mỗi lần mở danh sách (mỗi ảnh vài trăm KB)
create table if not exists public.onboarding_docs (
  owner_id   uuid not null,
  invite_id  text not null,
  front      text,
  back       text,
  created_at timestamptz not null default now(),
  primary key (owner_id, invite_id),
  foreign key (owner_id, invite_id) references public.onboarding_invites (owner_id, id) on delete cascade
);

alter table public.onboarding_invites enable row level security;
alter table public.onboarding_docs    enable row level security;
drop policy if exists own_read   on public.onboarding_invites;
drop policy if exists own_delete on public.onboarding_invites;
drop policy if exists own_read   on public.onboarding_docs;
drop policy if exists own_delete on public.onboarding_docs;
create policy own_read   on public.onboarding_invites for select to authenticated using (owner_id = auth.uid());
create policy own_delete on public.onboarding_invites for delete to authenticated using (owner_id = auth.uid());
create policy own_read   on public.onboarding_docs    for select to authenticated using (owner_id = auth.uid());
create policy own_delete on public.onboarding_docs    for delete to authenticated using (owner_id = auth.uid());

-- Không ai (kể cả chủ trọ) đọc được cột băm token; mọi thay đổi trạng thái đi qua hàm bên dưới.
revoke all on public.onboarding_invites, public.onboarding_docs from public, anon, authenticated;
grant select (id, owner_id, building_id, room_code, note, status, created_at, expires_at, submitted_at, submitted_data,
              decided_at, decision_note, tenant_id) on public.onboarding_invites to authenticated;
grant delete on public.onboarding_invites to authenticated;
grant select, delete on public.onboarding_docs to authenticated;

-- ---------- Hàm nội bộ ----------
create or replace function public._invite_hash(p_token text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

-- dd/mm/yyyy -> date, null nếu không phải ngày có thật (chặn 31/02, 45/13)
create or replace function public._parse_dmy(p text)
returns date language plpgsql immutable set search_path = public as $$
declare m text[];
begin
  m := regexp_match(coalesce(p, ''), '^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$');
  if m is null then return null; end if;
  return make_date(m[3]::int, m[2]::int, m[1]::int);
exception when others then
  return null;
end $$;

revoke execute on function public._invite_hash(text) from public, anon, authenticated;
revoke execute on function public._parse_dmy(text) from public, anon, authenticated;

-- ---------- Khách (không đăng nhập) ----------
-- Xem lời mời: chỉ trả thông tin phòng, không có dữ liệu cá nhân. Mọi lý do không dùng được đều trả chung một câu.
create or replace function public.invite_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v public.onboarding_invites; b public.buildings;
begin
  select * into v from public.onboarding_invites
   where token_hash = public._invite_hash(p_token) and status = 'pending' and expires_at > now();
  if v.id is null then return jsonb_build_object('error', 'invalid'); end if;
  select * into b from public.buildings where owner_id = v.owner_id and id = v.building_id;
  return jsonb_build_object('ok', true, 'roomCode', v.room_code, 'buildingName', b.name, 'address', b.address,
    'contactName', to_jsonb(b) ->> 'contact_name', 'contactPhone', to_jsonb(b) ->> 'contact_phone', 'expiresAt', v.expires_at);
end $$;

-- Gửi hồ sơ. Kiểm tra lại từng trường ở máy chủ; token chỉ dùng được một lần (khóa dòng để hai lần gửi cùng lúc
-- không cùng thành công). Trả { ok } hoặc { error: 'invalid' } hoặc { error: 'validation', fields: { trường: lời báo } }.
create or replace function public.invite_submit(p_token text, p_data jsonb, p_front text, p_back text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v public.onboarding_invites; d jsonb := coalesce(p_data, '{}'::jsonb); err jsonb := '{}'::jsonb;
  ten text; sdt text; cccd text; gt text; que text; dia text; cap text; nghe text; bien text; ns date; nc date;
  re_anh constant text := '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$';
begin
  if jsonb_typeof(d) <> 'object' then d := '{}'::jsonb; end if;
  select * into v from public.onboarding_invites
   where token_hash = public._invite_hash(p_token) and status = 'pending' and expires_at > now()
   for update;
  if v.id is null then return jsonb_build_object('error', 'invalid'); end if;

  ten := regexp_replace(btrim(coalesce(d ->> 'fullName', '')), '\s+', ' ', 'g');
  if array_length(string_to_array(ten, ' '), 1) is null or array_length(string_to_array(ten, ' '), 1) < 2 then err := err || jsonb_build_object('fullName', 'Nhập đủ họ và tên');
  elsif ten ~ '\d' then err := err || jsonb_build_object('fullName', 'Họ tên không có chữ số');
  elsif length(ten) > 80 then err := err || jsonb_build_object('fullName', 'Họ tên quá dài'); end if;

  sdt := regexp_replace(coalesce(d ->> 'phone', ''), '[\s.\-()]', '', 'g');
  if sdt ~ '^\+84\d{9}$' then sdt := '0' || substr(sdt, 4); elsif sdt ~ '^84\d{9}$' then sdt := '0' || substr(sdt, 3); end if;
  if sdt !~ '^0\d{9}$' then err := err || jsonb_build_object('phone', 'Số di động 10 chữ số, bắt đầu bằng 0'); end if;

  cccd := regexp_replace(coalesce(d ->> 'idNumber', ''), '[\s.]', '', 'g');
  if cccd !~ '^(\d{9}|\d{12})$' then err := err || jsonb_build_object('idNumber', 'CCCD có 12 số, CMND cũ có 9 số'); end if;

  ns := public._parse_dmy(d ->> 'dob');
  if ns is null then err := err || jsonb_build_object('dob', 'Nhập ngày sinh dạng dd/mm/yyyy, phải là ngày có thật');
  elsif ns > current_date then err := err || jsonb_build_object('dob', 'Ngày sinh không thể ở tương lai');
  elsif extract(year from ns) < 1900 then err := err || jsonb_build_object('dob', 'Năm sinh không hợp lý'); end if;

  -- lower()/upper() của Postgres chỉ đổi chữ không dấu khi cơ sở dữ liệu dùng collation C, nên liệt kê rõ các cách viết "Nữ"
  gt := case when lower(btrim(coalesce(d ->> 'gender', ''))) = 'nam' then 'Nam'
             when btrim(coalesce(d ->> 'gender', '')) in ('Nữ', 'nữ', 'NỮ', 'Nu', 'nu', 'NU') then 'Nữ' else null end;
  if gt is null then err := err || jsonb_build_object('gender', 'Chọn Nam hoặc Nữ'); end if;

  que := btrim(coalesce(d ->> 'hometown', ''));
  if length(que) < 2 or length(que) > 200 then err := err || jsonb_build_object('hometown', 'Nhập quê quán'); end if;
  dia := btrim(coalesce(d ->> 'address', ''));
  if length(dia) < 2 or length(dia) > 200 then err := err || jsonb_build_object('address', 'Nhập địa chỉ thường trú'); end if;

  -- ngày cấp thẻ: không bắt buộc (chủ trọ đọc từ ảnh mặt sau), nhưng đã nhập thì phải đúng
  cap := btrim(coalesce(d ->> 'cccdIssueDate', ''));
  if cap <> '' then
    nc := public._parse_dmy(cap);
    if nc is null then err := err || jsonb_build_object('cccdIssueDate', 'Nhập ngày cấp dạng dd/mm/yyyy, phải là ngày có thật');
    elsif nc > current_date then err := err || jsonb_build_object('cccdIssueDate', 'Ngày cấp không thể ở tương lai'); end if;
  end if;

  nghe := btrim(coalesce(d ->> 'occupation', ''));
  if length(nghe) > 80 then err := err || jsonb_build_object('occupation', 'Nghề nghiệp quá dài'); end if;

  bien := translate(upper(regexp_replace(coalesce(d ->> 'vehiclePlate', ''), '[\s.\-]', '', 'g')), 'đ', 'Đ');
  if bien <> '' and bien !~ '^\d{2}[A-ZĐ]{1,2}\d?\d{4,5}$' then err := err || jsonb_build_object('vehiclePlate', 'Biển số chưa đúng, ví dụ 59X1-123.45'); end if;

  -- dấu < > không bao giờ có trong tên, quê quán, địa chỉ, nghề nghiệp: chặn từ máy chủ, phòng khi nơi nào đó hiển thị quên thoát HTML
  if ten ~ '[<>]' and not err ? 'fullName' then err := err || jsonb_build_object('fullName', 'Họ tên có ký tự không hợp lệ'); end if;
  if que ~ '[<>]' and not err ? 'hometown' then err := err || jsonb_build_object('hometown', 'Quê quán có ký tự không hợp lệ'); end if;
  if dia ~ '[<>]' and not err ? 'address' then err := err || jsonb_build_object('address', 'Địa chỉ có ký tự không hợp lệ'); end if;
  if nghe ~ '[<>]' and not err ? 'occupation' then err := err || jsonb_build_object('occupation', 'Nghề nghiệp có ký tự không hợp lệ'); end if;

  if coalesce(d ->> 'consent', '') <> 'true' then err := err || jsonb_build_object('consent', 'Cần đồng ý cho chủ nhà dùng thông tin này'); end if;

  -- kiểm độ dài TRƯỚC khi chạy biểu thức chính quy: chuỗi khổng lồ không được làm máy chủ tốn công
  if p_front is null or length(p_front) > 700000 or p_front !~ re_anh then err := err || jsonb_build_object('front', 'Cần ảnh mặt trước CCCD (ảnh JPG, PNG hoặc WebP)'); end if;
  if p_back is null or length(p_back) > 700000 or p_back !~ re_anh then err := err || jsonb_build_object('back', 'Cần ảnh mặt sau CCCD (ảnh JPG, PNG hoặc WebP)'); end if;

  if err <> '{}'::jsonb then return jsonb_build_object('error', 'validation', 'fields', err); end if;

  update public.onboarding_invites
     set status = 'submitted', submitted_at = now(),
         submitted_data = jsonb_strip_nulls(jsonb_build_object('fullName', ten, 'phone', sdt, 'idNumber', cccd,
           'dob', to_char(ns, 'DD/MM/YYYY'), 'gender', gt, 'hometown', que, 'address', dia,
           'cccdIssueDate', case when cap <> '' then to_char(nc, 'DD/MM/YYYY') end,
           'occupation', nullif(nghe, ''), 'vehiclePlate', nullif(bien, '')))
   where owner_id = v.owner_id and id = v.id;
  insert into public.onboarding_docs(owner_id, invite_id, front, back) values (v.owner_id, v.id, p_front, p_back)
    on conflict (owner_id, invite_id) do update set front = excluded.front, back = excluded.back, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.invite_info(text) from public;
revoke execute on function public.invite_submit(text, jsonb, text, text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;
grant execute on function public.invite_submit(text, jsonb, text, text) to anon, authenticated;

-- ---------- Chủ trọ ----------
-- Tạo lời mời. Token trả về ĐÚNG MỘT LẦN (chỉ lưu băm). p_hours từ 1 đến 336 (14 ngày).
create or replace function public.owner_create_invite(p_building_id text, p_room_code text default null,
                                                       p_hours int default 72, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_owner uuid := auth.uid(); v_id text; v_token text; v_exp timestamptz; v_room text := nullif(btrim(coalesce(p_room_code, '')), '');
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  if not exists (select 1 from public.buildings where owner_id = v_owner and id = p_building_id) then
    return jsonb_build_object('error', 'not_found'); end if;
  if v_room is not null and not exists (select 1 from public.rooms where owner_id = v_owner and building_id = p_building_id and code = v_room) then
    return jsonb_build_object('error', 'room_not_found'); end if;
  if (select count(*) from public.onboarding_invites where owner_id = v_owner and status = 'pending' and expires_at > now()) >= 50 then
    return jsonb_build_object('error', 'too_many'); end if;
  v_exp := now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 72), 336)));
  v_id := 'oi-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  v_token := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', '-_');
  insert into public.onboarding_invites(owner_id, id, token_hash, building_id, room_code, note, expires_at)
  values (v_owner, v_id, public._invite_hash(v_token), p_building_id, v_room, left(nullif(btrim(coalesce(p_note, '')), ''), 200), v_exp);
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_owner, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Chủ trọ', 'onboarding.invite',
    'Tạo link khai thông tin cho khách' || case when v_room is not null then ' (phòng ' || v_room || ')' else '' end, null);
  return jsonb_build_object('id', v_id, 'token', v_token, 'expiresAt', v_exp, 'roomCode', v_room);
end $$;

-- Thu hồi link chưa dùng
create or replace function public.owner_revoke_invite(p_id text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_owner uuid := auth.uid(); n int;
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  update public.onboarding_invites set status = 'revoked', decided_at = now() where owner_id = v_owner and id = p_id and status = 'pending';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'not_found'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Duyệt / từ chối hồ sơ khách đã gửi. Duyệt thì ghi mã hồ sơ khách vừa tạo.
create or replace function public.owner_decide_invite(p_id text, p_decision text, p_note text default null, p_tenant_id text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_owner uuid := auth.uid(); n int;
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  if p_decision not in ('approved', 'rejected') then return jsonb_build_object('error', 'bad_decision'); end if;
  update public.onboarding_invites
     set status = p_decision, decided_at = now(), decision_note = left(nullif(btrim(coalesce(p_note, '')), ''), 300),
         tenant_id = case when p_decision = 'approved' then p_tenant_id end
   where owner_id = v_owner and id = p_id and status = 'submitted';
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'not_found'); end if;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_owner, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Chủ trọ', 'onboarding.' || p_decision,
    case when p_decision = 'approved' then 'Duyệt hồ sơ khách tự khai' else 'Từ chối hồ sơ khách tự khai' end, left(p_note, 300));
  return jsonb_build_object('ok', true);
end $$;

-- Xóa ảnh CCCD của một hồ sơ (chủ trọ chủ động xóa khi không cần giữ nữa)
create or replace function public.owner_delete_invite_docs(p_id text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_owner uuid := auth.uid(); n int;
begin
  if v_owner is null then return jsonb_build_object('error', 'auth'); end if;
  delete from public.onboarding_docs where owner_id = v_owner and invite_id = p_id;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('error', 'not_found'); end if;
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_owner, 'lg-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8), now(), 'Chủ trọ', 'onboarding.docs_delete', 'Xóa ảnh CCCD của hồ sơ khách tự khai', null);
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.owner_create_invite(text, text, int, text) from public, anon;
revoke execute on function public.owner_revoke_invite(text) from public, anon;
revoke execute on function public.owner_decide_invite(text, text, text, text) from public, anon;
revoke execute on function public.owner_delete_invite_docs(text) from public, anon;
grant execute on function public.owner_create_invite(text, text, int, text) to authenticated;
grant execute on function public.owner_revoke_invite(text) to authenticated;
grant execute on function public.owner_decide_invite(text, text, text, text) to authenticated;
grant execute on function public.owner_delete_invite_docs(text) to authenticated;

-- ---------- Dọn dữ liệu nhạy cảm ----------
-- Chạy mỗi ngày: ảnh CCCD của hồ sơ bị từ chối / thu hồi / hết hạn quá 30 ngày; dữ liệu khai của hồ sơ đã duyệt quá 30 ngày
-- (hồ sơ khách đã nằm ở bảng khách thuê); lời mời không còn ý nghĩa quá 90 ngày.
create or replace function public.hh_purge_onboarding()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare a int; b int; c int;
begin
  delete from public.onboarding_docs d using public.onboarding_invites i
   where i.owner_id = d.owner_id and i.id = d.invite_id
     and ((i.status in ('rejected', 'revoked') and coalesce(i.decided_at, i.created_at) < now() - interval '30 days')
          or (i.status in ('pending', 'submitted') and i.expires_at < now() - interval '30 days'));
  get diagnostics a = row_count;
  update public.onboarding_invites set submitted_data = null where status = 'approved' and submitted_data is not null and decided_at < now() - interval '30 days';
  get diagnostics b = row_count;
  delete from public.onboarding_invites where status in ('rejected', 'revoked', 'pending') and coalesce(decided_at, expires_at) < now() - interval '90 days';
  get diagnostics c = row_count;
  return jsonb_build_object('docs', a, 'approved_cleared', b, 'invites', c);
end $$;
revoke execute on function public.hh_purge_onboarding() from public, anon, authenticated;

-- Lịch dọn dẹp mỗi ngày lúc 1 giờ sáng giờ Việt Nam (= 18:00 UTC), nếu Supabase có pg_cron (xem migration-nightly.sql)
do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'Chưa bật được pg_cron (%). Bật ở Database → Extensions → pg_cron rồi chạy lại tệp này để tự dọn ảnh CCCD cũ.', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'hh-purge-onboarding';
    perform cron.schedule('hh-purge-onboarding', '0 18 * * *', 'select public.hh_purge_onboarding()');
  end if;
end $$;

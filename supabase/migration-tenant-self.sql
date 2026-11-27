-- ============================================================
-- Happy Home — App khách: tự gửi ảnh CCCD (27/11/2026)
-- Chạy trong Supabase → SQL Editor → New query → Run. Chạy lại nhiều lần vẫn an toàn. Không xóa, không sửa dòng dữ liệu cũ nào.
-- Chạy sau migration-tenant-auth.sql (cần _tenant_from_token) và migration-staff-scope.sql (cần nv_duoc_vao; thiếu thì chỉ chủ trọ xem ảnh).
--
-- Bạn chủ trọ báo 27/11: "úp CCCD của khách ... bên khách không có". Trước đây khách chỉ nộp ảnh CCCD qua link
-- "Mời khách tự khai" lúc mới vào ở, còn bảng tenants chỉ có cờ đã nộp / chưa nộp (cccd_front, cccd_back), không có ảnh.
-- Nay:
--   * Bảng tenant_docs giữ ảnh CCCD khách tự gửi từ app (mỗi khách một ảnh mặt trước, một ảnh mặt sau; gửi lại thì thay).
--     Chủ trọ đọc được; nhân viên có quyền "Khách thuê" của tòa đó đọc được; khách và người lạ không đọc trực tiếp được.
--   * tenant_upload_cccd: khách gửi một mặt ảnh (đúng dạng ảnh JPG/PNG/WebP, tối đa ~500 KB), bật cờ đã nộp trên hồ sơ.
--   * tenant_cccd_status: app khách biết mình đã nộp mặt nào (không trả ảnh về).
-- ============================================================

create table if not exists public.tenant_docs (
  owner_id    uuid not null references auth.users(id) on delete cascade,
  tenant_id   text not null,
  building_id text,
  kind        text not null,
  data        text not null,
  created_at  timestamptz not null default now(),
  primary key (owner_id, tenant_id, kind),
  constraint tenant_docs_kind_chk check (kind in ('cccd_front', 'cccd_back')),
  constraint tenant_docs_data_chk check (length(data) <= 700000 and data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$')
);
alter table public.tenant_docs enable row level security;
revoke all on public.tenant_docs from anon;

drop policy if exists own_all on public.tenant_docs;
create policy own_all on public.tenant_docs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
begin
  execute 'drop policy if exists staff_xem on public.tenant_docs';
  execute $f$create policy staff_xem on public.tenant_docs for select to authenticated
    using (public.nv_duoc_vao(owner_id, building_id, 'tenants'))$f$;
exception when undefined_function then
  raise notice 'Chưa có nv_duoc_vao (migration-staff-scope.sql): tạm thời chỉ chủ trọ xem được ảnh CCCD khách gửi';
end $$;

-- Khách gửi MỘT mặt ảnh CCCD. Trả { ok } | { error: 'bad_kind' | 'too_big' | 'bad_image' } | null (phiên hết hạn)
create or replace function public.tenant_upload_cccd(p_token text, p_kind text, p_data text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  if p_kind is null or p_kind not in ('cccd_front', 'cccd_back') then return jsonb_build_object('error', 'bad_kind'); end if;
  if p_data is null or length(p_data) > 700000 then return jsonb_build_object('error', 'too_big'); end if;
  if p_data !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' then return jsonb_build_object('error', 'bad_image'); end if;

  insert into public.tenant_docs(owner_id, tenant_id, building_id, kind, data, created_at)
  values (v_t.owner_id, v_t.id, v_t.building_id, p_kind, p_data, now())
  on conflict (owner_id, tenant_id, kind) do update
    set data = excluded.data, building_id = excluded.building_id, created_at = now();

  if p_kind = 'cccd_front' then
    update public.tenants set cccd_front = true, updated_at = now() where owner_id = v_t.owner_id and id = v_t.id;
  else
    update public.tenants set cccd_back = true, updated_at = now() where owner_id = v_t.owner_id and id = v_t.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Khách đã nộp mặt CCCD nào (theo cờ trên hồ sơ: gồm cả ảnh nộp qua link tự khai hay chủ trọ nhập)
create or replace function public.tenant_cccd_status(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  return jsonb_build_object('front', coalesce(v_t.cccd_front, false), 'back', coalesce(v_t.cccd_back, false));
end $$;

revoke all on function public.tenant_upload_cccd(text, text, text) from public;
revoke all on function public.tenant_cccd_status(text) from public;
grant execute on function public.tenant_upload_cccd(text, text, text) to anon, authenticated;
grant execute on function public.tenant_cccd_status(text) to anon, authenticated;

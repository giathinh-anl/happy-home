-- ============================================================
-- Happy Home — Ảnh báo hỏng + Khách báo đã chuyển khoản (có ảnh chứng từ)
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- An toàn khi chạy lại nhiều lần.
-- ============================================================

-- 1) Ảnh đính kèm yêu cầu sửa chữa
alter table public.incidents add column if not exists photos jsonb default '[]'::jsonb;

-- 2) Phiếu báo chuyển khoản của khách (chờ chủ trọ đối soát)
create table if not exists public.payment_claims (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text,
  room_code text,
  tenant_name text,
  invoice_id text,
  amount bigint default 0,
  note text,
  photo text,                                  -- ảnh chứng từ (data URL)
  status text not null default 'pending',      -- pending | confirmed | rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists claims_bid_idx on public.payment_claims (owner_id, building_id, status);

alter table public.payment_claims enable row level security;
drop policy if exists own_all on public.payment_claims;
create policy own_all on public.payment_claims for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Cho nhân viên có quyền truy cập dữ liệu của chủ trọ (nếu đã chạy migration-staff-vehicles)
do $$ begin
  execute 'drop policy if exists staff_access on public.payment_claims';
  execute 'create policy staff_access on public.payment_claims for all to authenticated
    using (owner_id in (select public.accessible_owners()))
    with check (owner_id in (select public.accessible_owners()))';
exception when undefined_function then raise notice 'Chưa có accessible_owners() — bỏ qua policy nhân viên';
end $$;
grant all on public.payment_claims to authenticated;

-- 3) Tạo yêu cầu sửa chữa KÈM ẢNH
create or replace function public.tenant_create_incident(p_phone text, p_category text, p_title text, p_photos jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_id text;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  v_id := 'sc-' || substr(md5(random()::text), 1, 8);
  insert into public.incidents(owner_id, id, building_id, room_code, category, title, status, photos, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, p_category, p_title, 'open', coalesce(p_photos,'[]'::jsonb), now(), now());
  return jsonb_build_object('id', v_id, 'category', p_category, 'title', p_title, 'status', 'open', 'createdAt', now());
end $$;
grant execute on function public.tenant_create_incident(text, text, text, jsonb) to anon, authenticated;

-- 4) Khách gửi phiếu báo đã chuyển khoản (kèm ảnh chứng từ)
create or replace function public.tenant_submit_payment_claim(
  p_phone text, p_invoice_id text, p_amount bigint, p_note text, p_photo text)
returns jsonb language plpgsql security definer set search_path = public volatile as $$
declare v_t public.tenants; v_id text;
begin
  select * into v_t from public.tenants where phone = p_phone order by is_rep desc, id limit 1;
  if v_t.id is null then return null; end if;
  v_id := 'cl-' || substr(md5(random()::text), 1, 8);
  insert into public.payment_claims(owner_id, id, building_id, room_code, tenant_name,
    invoice_id, amount, note, photo, status, created_at, updated_at)
  values (v_t.owner_id, v_id, v_t.building_id, v_t.room_code, v_t.full_name,
    p_invoice_id, coalesce(p_amount,0), p_note, p_photo, 'pending', now(), now());
  insert into public.audit_log(owner_id, id, at, actor, action, message, reason)
  values (v_t.owner_id, 'lg-' || substr(md5(random()::text), 1, 8), now(), v_t.full_name,
    'tenant.claim', 'Khách báo đã chuyển khoản cho ' || coalesce(p_invoice_id,''), null);
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;
grant execute on function public.tenant_submit_payment_claim(text, text, bigint, text, text) to anon, authenticated;

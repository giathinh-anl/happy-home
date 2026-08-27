-- ============================================================
-- Happy Home — Nhân viên & phân quyền + Quản lý xe
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần).
-- An toàn khi chạy lại nhiều lần.
-- ============================================================

-- 1) Xe của khách thuê (nhiều xe / 1 khách)
alter table public.tenants add column if not exists vehicles jsonb default '[]'::jsonb;

-- 2) Bảng nhân viên: chủ trọ tạo, nhân viên tự đăng ký tài khoản bằng đúng email này
create table if not exists public.staff (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'staff',          -- 'manager' (quản lý) | 'staff' (nhân viên)
  permissions jsonb default '[]'::jsonb,       -- ví dụ: ["rooms","tenants","invoices"]
  building_ids jsonb default '[]'::jsonb,      -- [] = tất cả tòa nhà
  status text not null default 'active',       -- 'active' | 'disabled'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists staff_email_idx on public.staff (lower(email));

alter table public.staff enable row level security;

-- Chủ trọ toàn quyền trên nhân viên của mình
drop policy if exists staff_owner_all on public.staff;
create policy staff_owner_all on public.staff for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Nhân viên được xem dòng của chính mình (để biết mình thuộc chủ nào, quyền gì)
drop policy if exists staff_self_read on public.staff;
create policy staff_self_read on public.staff for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- 3) Hàm tiện ích: các owner_id mà người đang đăng nhập được phép truy cập
create or replace function public.accessible_owners()
returns setof uuid language sql stable security definer set search_path = public as $$
  select auth.uid()
  union
  select s.owner_id from public.staff s
   where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     and s.status = 'active';
$$;
grant execute on function public.accessible_owners() to authenticated;

-- 4) Mở quyền cho nhân viên trên toàn bộ bảng nghiệp vụ
--    (chủ trọ vẫn giữ nguyên quyền như cũ qua policy own_all)
do $$
declare t text;
begin
  foreach t in array array[
    'buildings','rooms','tenants','contracts','services',
    'readings','invoices','payments','assets','incidents','transactions','audit_log'
  ] loop
    begin
      execute format('drop policy if exists staff_access on public.%I;', t);
      execute format($f$create policy staff_access on public.%I for all to authenticated
        using (owner_id in (select public.accessible_owners()))
        with check (owner_id in (select public.accessible_owners()));$f$, t);
    exception when undefined_table then
      raise notice 'Bỏ qua bảng chưa tạo: %', t;
    end;
  end loop;
end $$;

-- ============================================================
-- Happy Home — Lược đồ cơ sở dữ liệu (Supabase / PostgreSQL)
-- Chạy toàn bộ file này trong: Supabase → SQL Editor → New query → Run
-- Mỗi người dùng (auth.users) chỉ thấy & sửa dữ liệu của chính mình (RLS).
-- ============================================================

-- Bảng hồ sơ người dùng (tên hiển thị, vai trò)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'owner',           -- 'owner' | 'staff'
  created_at timestamptz not null default now()
);

-- Tự tạo hồ sơ khi có người đăng ký
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================
-- Các bảng nghiệp vụ. Khóa chính ghép (owner_id, id) để mã của
-- người này không đụng mã của người khác. owner_id mặc định = auth.uid().
-- ============================================================

create table if not exists public.buildings (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  address text,
  floors int default 1,
  per_floor int default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.rooms (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  code text not null,
  floor int,
  type text,
  type_label text,
  area numeric,
  price bigint default 0,
  max_occupants int,
  status text,                         -- vacant|reserved|occupied|notice|cleaning|inactive
  tenant_name text,
  tenant_id text,
  contract_id text,
  contract_end date,
  debt bigint default 0,
  holding_deposit bigint default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.tenants (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  full_name text not null,
  id_number text,
  dob text,
  gender text,
  hometown text,
  phone text,
  occupation text,
  address text,
  cccd_issue_date text,
  cccd_issue_place text,
  cccd_front boolean default false,
  cccd_back boolean default false,
  vehicle_plate text,
  ttlock boolean default false,
  tamtru boolean default false,
  occupants int default 1,
  is_rep boolean default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.contracts (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  room_type text,
  tenant_name text,
  tenant_id text,
  rent bigint default 0,
  deposit bigint default 0,
  start_date date,
  end_date date,
  billing_day int default 1,
  due_days int default 5,
  cycle text default 'monthly',
  status text,                          -- active|terminating|terminated|expired|draft
  debt bigint default 0,
  expiring_soon boolean default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.services (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  name text not null,
  method text,                          -- per_kwh|per_person|flat
  unit bigint default 0,
  unit_label text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.readings (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  period text,                          -- 'YYYY-MM'
  elec_prev numeric,
  elec_curr numeric,
  water_prev numeric,
  water_curr numeric,
  elec_photo boolean default false,
  water_photo boolean default false,
  elec_avg numeric,
  source text default 'staff',          -- staff|tenant
  approved boolean default true,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.invoices (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  contract_id text,
  tenant_id text,
  tenant_name text,
  period text,
  period_start date,
  period_end date,
  due_date date,
  lines jsonb default '[]'::jsonb,      -- các dòng: {label, amount, meta, type}
  total bigint default 0,
  paid bigint default 0,
  status text,                          -- draft|issued|partial|paid|overdue|cancelled
  edited boolean default false,
  edited_at text,
  edited_by text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.payments (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  invoice_id text,
  building_id text,
  contract_id text,
  paid_date date,
  method text,
  amount bigint default 0,
  note text,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.assets (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  icon text,
  name text not null,
  buy_price bigint default 0,
  buy_date date,
  life_months int default 60,
  condition text default 'good',        -- good|wear|broken
  quantity int default 1,
  unit text default 'cái',
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.incidents (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  room_code text,
  category text,
  title text,
  status text default 'open',           -- open|processing|done
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create table if not exists public.audit_log (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  at timestamptz not null default now(),
  actor text,
  action text,
  message text,
  reason text,
  primary key (owner_id, id)
);

-- Chỉ mục lọc theo tòa nhà
create index if not exists rooms_bid_idx    on public.rooms (owner_id, building_id);
create index if not exists tenants_bid_idx  on public.tenants (owner_id, building_id);
create index if not exists contracts_bid_idx on public.contracts (owner_id, building_id);
create index if not exists services_bid_idx on public.services (owner_id, building_id);
create index if not exists readings_bid_idx on public.readings (owner_id, building_id);
create index if not exists invoices_bid_idx on public.invoices (owner_id, building_id);
create index if not exists assets_bid_idx   on public.assets (owner_id, building_id);
create index if not exists incidents_bid_idx on public.incidents (owner_id, building_id);

-- ============================================================
-- Bật Row Level Security + chính sách "chỉ chủ sở hữu" cho mọi bảng
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','buildings','rooms','tenants','contracts','services',
    'readings','invoices','payments','assets','incidents','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists own_all on public.%I;', t);
    if t = 'profiles' then
      execute 'create policy own_all on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());';
    else
      execute format($f$create policy own_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());$f$, t);
    end if;
  end loop;
end $$;

-- Quyền cho vai trò đã đăng nhập (RLS vẫn lọc theo từng dòng)
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
alter default privileges in schema public grant all on tables to authenticated;

-- Xong. Tiếp theo: bật Email provider trong Authentication, rồi điền js/config.js.

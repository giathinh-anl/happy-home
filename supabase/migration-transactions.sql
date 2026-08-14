-- ============================================================
-- Happy Home — Bổ sung bảng Thu chi (transactions)
-- Chạy trong: Supabase → SQL Editor → New query → Run
-- Chỉ cần chạy 1 lần. Không ảnh hưởng dữ liệu đang có.
-- ============================================================
create table if not exists public.transactions (
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  building_id text not null,
  kind text,                 -- 'income' (thu) | 'expense' (chi)
  category text,
  amount bigint default 0,
  note text,
  tx_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);

create index if not exists transactions_bid_idx on public.transactions (owner_id, building_id);

alter table public.transactions enable row level security;
drop policy if exists own_all on public.transactions;
create policy own_all on public.transactions for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

grant all on public.transactions to authenticated;

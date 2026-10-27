-- ============================================================
-- Happy Home — Chốt sổ tháng theo đợt (xem trước, phát hành cả đợt, hoàn tác cả đợt)
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần vẫn an toàn.
--
-- Chưa chạy thì web vẫn chốt sổ được, nhưng danh sách đợt và nút "Hoàn tác đợt" mất sau khi tải lại trang
-- (hóa đơn không còn biết mình thuộc đợt nào).
-- ============================================================

create table if not exists public.invoice_batches (
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id            text not null,
  building_id   text not null,
  period        text not null,                       -- 'YYYY-MM'
  created_at    timestamptz not null default now(),
  created_by    text,
  invoice_count int not null default 0,
  total_amount  bigint not null default 0,
  status        text not null default 'draft',       -- draft | issued | undone | partial
  issued_at     timestamptz,
  undone_at     timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists invoice_batches_bid_idx on public.invoice_batches (owner_id, building_id, period);

alter table public.invoice_batches enable row level security;
drop policy if exists own_all on public.invoice_batches;
create policy own_all on public.invoice_batches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
do $$ begin
  execute 'drop policy if exists staff_access on public.invoice_batches';
  execute 'create policy staff_access on public.invoice_batches for all to authenticated
    using (owner_id in (select public.accessible_owners()))
    with check (owner_id in (select public.accessible_owners()))';
exception when undefined_function then raise notice 'Chưa có accessible_owners() — bỏ qua policy nhân viên';
end $$;
grant all on public.invoice_batches to authenticated;

-- Hóa đơn nhớ mình thuộc đợt nào
alter table public.invoices add column if not exists batch_id text;
create index if not exists invoices_batch_idx on public.invoices (owner_id, batch_id) where batch_id is not null;

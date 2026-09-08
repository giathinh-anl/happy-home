-- ============================================================
-- Happy Home — Đối soát ngân hàng tự động + cờ tiện nghi tin đăng
-- Chạy trong Supabase → SQL Editor → New query → Run
-- Chạy lại nhiều lần vẫn an toàn (đều có "if not exists").
-- ============================================================

-- 1) Nhớ đúng lựa chọn tiện nghi của chủ trọ (kể cả khi bỏ chọn hết)
alter table public.rooms add column if not exists amenities_set boolean default false;

-- 2) Đánh dấu phiếu thu nào do đối soát tự động sinh ra + chống ghi trùng
alter table public.payments add column if not exists bank_ref text;
alter table public.payments add column if not exists auto boolean default false;
create unique index if not exists payments_owner_bankref_uidx
  on public.payments (owner_id, bank_ref) where bank_ref is not null;

-- 3) Giao dịch ngân hàng nhận về (từ webhook SePay/Casso hoặc dán sao kê)
create table if not exists public.bank_transactions (
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id          text not null,
  ref         text,                       -- mã giao dịch của ngân hàng (chống trùng)
  amount      numeric not null default 0,
  content     text,                       -- nội dung chuyển khoản
  date        timestamptz,
  source      text default 'webhook',     -- webhook | paste
  handled     boolean default false,      -- đã ghi thu chưa
  invoice_id  text,
  payment_id  text,
  match_note  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (owner_id, id)
);
create unique index if not exists bank_tx_owner_ref_uidx
  on public.bank_transactions (owner_id, ref) where ref is not null;

alter table public.bank_transactions enable row level security;

drop policy if exists "bank_tx_own" on public.bank_transactions;
create policy "bank_tx_own" on public.bank_transactions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Nhân viên được xem/đối soát dữ liệu của chủ trọ mình
drop policy if exists "bank_tx_staff" on public.bank_transactions;
create policy "bank_tx_staff" on public.bank_transactions
  for all using (exists (
    select 1 from public.staff s
    where s.owner_id = bank_transactions.owner_id
      and lower(s.email) = lower(auth.jwt() ->> 'email')
      and s.status = 'active'))
  with check (exists (
    select 1 from public.staff s
    where s.owner_id = bank_transactions.owner_id
      and lower(s.email) = lower(auth.jwt() ->> 'email')
      and s.status = 'active'));

-- ============================================================
-- 4) Cổng nhận giao dịch từ webhook ngân hàng
--    Webhook KHÔNG đăng nhập được, nên hàm này chạy security definer
--    và tự kiểm tra mật khẩu dùng chung (secret) do chính bạn đặt.
--    Hàm CHỈ ghi vào bank_transactions — không đụng tới hóa đơn hay
--    phiếu thu. Việc ghi thu vẫn do app làm dưới danh nghĩa chủ trọ,
--    nên mọi khoản thu đều có dấu vết trong nhật ký.
-- ============================================================

-- Nơi cất secret (chỉ chủ trọ đọc/ghi được của chính mình)
create table if not exists public.bank_hooks (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  secret   text not null,
  created_at timestamptz default now()
);
alter table public.bank_hooks enable row level security;
drop policy if exists "bank_hooks_own" on public.bank_hooks;
create policy "bank_hooks_own" on public.bank_hooks
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.bank_ingest(
  p_secret  text,
  p_ref     text,
  p_amount  numeric,
  p_content text,
  p_date    timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_id text;
begin
  if p_secret is null or length(p_secret) < 16 then
    raise exception 'BAD_SECRET';
  end if;
  select owner_id into v_owner from public.bank_hooks where secret = p_secret;
  if v_owner is null then raise exception 'BAD_SECRET'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'BAD_AMOUNT'; end if;

  -- đã nhận giao dịch này rồi thì thôi
  select id into v_id from public.bank_transactions
   where owner_id = v_owner and ref = p_ref limit 1;
  if v_id is not null then return v_id; end if;

  v_id := 'bt_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.bank_transactions (owner_id, id, ref, amount, content, date, source)
  values (v_owner, v_id, p_ref, p_amount, p_content, coalesce(p_date, now()), 'webhook');
  return v_id;
end $$;

revoke all on function public.bank_ingest(text, text, numeric, text, timestamptz) from public;
grant execute on function public.bank_ingest(text, text, numeric, text, timestamptz) to anon, authenticated;

-- ============================================================
-- 5) Tạo secret cho chính mình (chạy khi đã đăng nhập bằng tài khoản chủ trọ)
--    Copy giá trị trả về, đặt vào biến BANK_WEBHOOK_SECRET của Edge Function.
-- ============================================================
create or replace function public.bank_hook_secret() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'NOT_SIGNED_IN'; end if;
  select secret into v from public.bank_hooks where owner_id = auth.uid();
  if v is not null then return v; end if;
  v := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.bank_hooks (owner_id, secret) values (auth.uid(), v);
  return v;
end $$;
grant execute on function public.bank_hook_secret() to authenticated;

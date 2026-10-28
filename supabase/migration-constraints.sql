-- ============================================================
-- Happy Home — Ràng buộc dữ liệu ở tầng DB (lưới an toàn cuối cùng)
--
-- App đã kiểm dữ liệu nhập ở trình duyệt (js/validate.js). Lớp này chặn nốt những gì lọt qua: lỗi mã, ghi trực tiếp qua API,
-- hay một ngày nào đó có app khác ghi vào cùng bảng. Số âm, hợp đồng kết thúc trước khi bắt đầu, CCCD 7 số... đều bị từ chối
-- với lời nhắn tiếng Việt (mã lỗi 23514 = check_violation) để app hiện cho người dùng.
--
-- KHÔNG ĐỤNG DỮ LIỆU CŨ. Không dùng CHECK vì CHECK (kể cả NOT VALID) kiểm cả dòng mỗi lần sửa dòng đó: một dòng cũ lỡ có số âm
-- sẽ không sửa được cả những thứ khác (đổi trạng thái phòng, ghi chú...) vì app luôn lưu nguyên dòng. Ở đây bằng trigger:
--   - THÊM dòng mới: kiểm đủ.
--   - SỬA dòng (kể cả upsert đè lên dòng đã có, là cách app lưu): chỉ kiểm những cột mà lần lưu này thật sự đổi giá trị.
-- Nên dòng cũ có sẵn lỗi vẫn sống yên cho tới khi chính cột lỗi được sửa.
--
-- Chạy được nhiều lần (create or replace, drop trigger if exists). Không xóa, không sửa dòng nào.
-- Muốn biết dữ liệu hiện có đang vi phạm những luật này ở đâu: chạy supabase/audit-du-lieu.sql (chỉ đọc, chỉ đếm).
-- ============================================================

-- Phòng
create or replace function public.hh_kiem_phong() returns trigger language plpgsql set search_path = public as $$
declare
  o public.rooms;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.rooms where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.price is distinct from o.price) and new.price < 0 then
    raise exception 'Giá thuê phòng không được âm' using errcode = '23514'; end if;
  if (moi or new.holding_deposit is distinct from o.holding_deposit) and new.holding_deposit < 0 then
    raise exception 'Tiền giữ chỗ không được âm' using errcode = '23514'; end if;
  if (moi or new.area is distinct from o.area) and new.area < 0 then
    raise exception 'Diện tích phòng không được âm' using errcode = '23514'; end if;
  return new;
end $$;

-- Khách thuê: CCCD 12 số hoặc CMND 9 số, số di động 10 số bắt đầu bằng 0 (cùng luật với js/validate.js)
create or replace function public.hh_kiem_khach() returns trigger language plpgsql set search_path = public as $$
declare
  o public.tenants;
  moi boolean;
  s text;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.tenants where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.id_number is distinct from o.id_number) and btrim(coalesce(new.id_number, '')) <> '' then
    if regexp_replace(new.id_number, '[\s.]', '', 'g') !~ '^(\d{9}|\d{12})$' then
      raise exception 'CCCD có 12 số, CMND cũ có 9 số' using errcode = '23514'; end if;
  end if;
  if (moi or new.phone is distinct from o.phone) and btrim(coalesce(new.phone, '')) <> '' then
    s := regexp_replace(new.phone, '[\s.\-()]', '', 'g');
    if s ~ '^\+84\d{9}$' then s := '0' || substr(s, 4);
    elsif s ~ '^84\d{9}$' then s := '0' || substr(s, 3); end if;
    if s !~ '^0\d{9}$' then
      raise exception 'Số di động 10 chữ số, bắt đầu bằng 0' using errcode = '23514'; end if;
  end if;
  if (moi or new.occupants is distinct from o.occupants) and new.occupants < 0 then
    raise exception 'Số người ở không được âm' using errcode = '23514'; end if;
  return new;
end $$;

-- Hợp đồng
create or replace function public.hh_kiem_hop_dong() returns trigger language plpgsql set search_path = public as $$
declare
  o public.contracts;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.contracts where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.rent is distinct from o.rent) and new.rent < 0 then
    raise exception 'Giá thuê không được âm' using errcode = '23514'; end if;
  if (moi or new.deposit is distinct from o.deposit) and new.deposit < 0 then
    raise exception 'Tiền cọc không được âm' using errcode = '23514'; end if;
  if (moi or new.start_date is distinct from o.start_date or new.end_date is distinct from o.end_date)
     and new.start_date is not null and new.end_date is not null and new.end_date < new.start_date then
    raise exception 'Ngày kết thúc hợp đồng không thể trước ngày bắt đầu' using errcode = '23514'; end if;
  if (moi or new.billing_day is distinct from o.billing_day) and new.billing_day is not null and (new.billing_day < 1 or new.billing_day > 31) then
    raise exception 'Ngày chốt hóa đơn phải từ 1 đến 31' using errcode = '23514'; end if;
  return new;
end $$;

-- Dịch vụ
create or replace function public.hh_kiem_dich_vu() returns trigger language plpgsql set search_path = public as $$
declare
  o public.services;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.services where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.unit is distinct from o.unit) and new.unit < 0 then
    raise exception 'Đơn giá dịch vụ không được âm' using errcode = '23514'; end if;
  return new;
end $$;

-- Chỉ số điện nước: không âm; kỳ phải dạng YYYY-MM (tháng 01..12)
create or replace function public.hh_kiem_chi_so() returns trigger language plpgsql set search_path = public as $$
declare
  o public.readings;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.readings where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.elec_prev is distinct from o.elec_prev) and new.elec_prev < 0 then
    raise exception 'Chỉ số điện kỳ trước không được âm' using errcode = '23514'; end if;
  if (moi or new.elec_curr is distinct from o.elec_curr) and new.elec_curr < 0 then
    raise exception 'Chỉ số điện không được âm' using errcode = '23514'; end if;
  if (moi or new.period is distinct from o.period) and new.period is not null and new.period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Kỳ chỉ số phải dạng năm-tháng, ví dụ 2026-10' using errcode = '23514'; end if;
  return new;
end $$;

-- Hóa đơn: đã thu không âm, cuối kỳ không trước đầu kỳ, kỳ dạng YYYY-MM
create or replace function public.hh_kiem_hoa_don() returns trigger language plpgsql set search_path = public as $$
declare
  o public.invoices;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.invoices where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.paid is distinct from o.paid) and new.paid < 0 then
    raise exception 'Số tiền đã thu không được âm' using errcode = '23514'; end if;
  if (moi or new.period_start is distinct from o.period_start or new.period_end is distinct from o.period_end)
     and new.period_start is not null and new.period_end is not null and new.period_end < new.period_start then
    raise exception 'Cuối kỳ hóa đơn không thể trước đầu kỳ' using errcode = '23514'; end if;
  if (moi or new.period is distinct from o.period) and new.period is not null and new.period !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Kỳ hóa đơn phải dạng năm-tháng, ví dụ 2026-10' using errcode = '23514'; end if;
  return new;
end $$;

-- Thanh toán
create or replace function public.hh_kiem_thanh_toan() returns trigger language plpgsql set search_path = public as $$
declare
  o public.payments;
  moi boolean;
begin
  -- App lưu bằng upsert (INSERT ... ON CONFLICT DO UPDATE): trigger BEFORE INSERT cũng chạy khi đè lên dòng đã có.
  -- Nên tra bản đang có, để dòng cũ chỉ bị kiểm ở những cột thật sự đổi.
  if tg_op = 'UPDATE' then o := old;
  else select * into o from public.payments where owner_id = new.owner_id and id = new.id; end if;
  moi := o.id is null;
  if (moi or new.amount is distinct from o.amount) and new.amount < 0 then
    raise exception 'Số tiền thanh toán không được âm' using errcode = '23514'; end if;
  return new;
end $$;

-- Gắn trigger (chạy lại nhiều lần được)
drop trigger if exists hh_kiem_phong on public.rooms;
create trigger hh_kiem_phong before insert or update on public.rooms for each row execute function public.hh_kiem_phong();
drop trigger if exists hh_kiem_khach on public.tenants;
create trigger hh_kiem_khach before insert or update on public.tenants for each row execute function public.hh_kiem_khach();
drop trigger if exists hh_kiem_hop_dong on public.contracts;
create trigger hh_kiem_hop_dong before insert or update on public.contracts for each row execute function public.hh_kiem_hop_dong();
drop trigger if exists hh_kiem_dich_vu on public.services;
create trigger hh_kiem_dich_vu before insert or update on public.services for each row execute function public.hh_kiem_dich_vu();
drop trigger if exists hh_kiem_chi_so on public.readings;
create trigger hh_kiem_chi_so before insert or update on public.readings for each row execute function public.hh_kiem_chi_so();
drop trigger if exists hh_kiem_hoa_don on public.invoices;
create trigger hh_kiem_hoa_don before insert or update on public.invoices for each row execute function public.hh_kiem_hoa_don();
drop trigger if exists hh_kiem_thanh_toan on public.payments;
create trigger hh_kiem_thanh_toan before insert or update on public.payments for each row execute function public.hh_kiem_thanh_toan();

-- Hàm trigger không để ai gọi trực tiếp (Supabase mặc định cho anon quyền chạy mọi hàm ở schema public)
revoke all on function public.hh_kiem_phong(), public.hh_kiem_khach(), public.hh_kiem_hop_dong(), public.hh_kiem_dich_vu(),
  public.hh_kiem_chi_so(), public.hh_kiem_hoa_don(), public.hh_kiem_thanh_toan() from public, anon, authenticated;

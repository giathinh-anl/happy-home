-- ============================================================
-- Happy Home — Tài khoản nhận tiền của từng tòa nhà (nhập ngay trong app, không sửa js/config.js)
-- Chạy trong Supabase → SQL Editor → New query → Run
-- Chạy lại nhiều lần vẫn an toàn. Chỉ THÊM một cột và hai hàm, không đụng dữ liệu có sẵn.
--
-- 1) buildings.bank_info: { name, bin, account, holder } do chủ trọ nhập ở Cấu hình tòa nhà.
-- 2) Trigger: CHỈ CHỦ DỮ LIỆU được đổi cột này. Nhân viên có quyền ghi bảng buildings (policy staff_access),
--    nên nếu không chặn ở đây thì một nhân viên gọi thẳng API là đổi được số tài khoản và hướng tiền thuê về túi mình.
--    Trigger cũng từ chối dữ liệu sai dạng (chặn chữ lạ lọt vào mã QR / màn hình khách).
-- 3) tenant_bank(token): khách đã đăng nhập lấy tài khoản của đúng tòa mình. Dữ liệu sai dạng thì coi như chưa nhập.
-- ============================================================

alter table public.buildings add column if not exists bank_info jsonb;

-- Dạng hợp lệ (phải khớp js/bank-info.js): bin 6 chữ số, số tài khoản 6 đến 19 chữ số,
-- tên chủ in hoa không dấu 3 đến 50 ký tự, tên ngân hàng chữ/số/khoảng trắng/dấu chấm/&/gạch.
create or replace function public._bank_info_hop_le(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object'
     and coalesce(v ->> 'bin', '')     ~ '^[0-9]{6}$'
     and coalesce(v ->> 'account', '') ~ '^[0-9]{6,19}$'
     and coalesce(v ->> 'holder', '')  ~ '^[A-Z ]{3,50}$'
     and coalesce(v ->> 'name', '')    ~ '^[A-Za-z0-9 .&-]{2,40}$'
$$;

create or replace function public._hh_chi_chu_doi_bank() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- JSON null được hiểu là xóa
  if new.bank_info is not null and jsonb_typeof(new.bank_info) = 'null' then new.bank_info := null; end if;

  -- Chỉ khi có thay đổi mới kiểm, để sửa các cột khác của tòa nhà không bị vướng
  if tg_op = 'INSERT' then
    if new.bank_info is null then return new; end if;
  elsif new.bank_info is not distinct from old.bank_info then
    return new;
  end if;

  -- auth.uid() rỗng = chạy từ SQL Editor hoặc tác vụ ban đêm của máy chủ: cho qua
  if auth.uid() is not null and auth.uid() <> new.owner_id then
    raise exception 'ONLY_OWNER_BANK' using hint = 'Chỉ chủ trọ được đổi tài khoản nhận tiền';
  end if;
  if new.bank_info is not null and not public._bank_info_hop_le(new.bank_info) then
    raise exception 'BAD_BANK_INFO' using hint = 'Tài khoản nhận tiền sai dạng';
  end if;
  return new;
end $$;

drop trigger if exists hh_chi_chu_doi_bank on public.buildings;
create trigger hh_chi_chu_doi_bank before insert or update on public.buildings
  for each row execute function public._hh_chi_chu_doi_bank();

revoke execute on function public._bank_info_hop_le(jsonb) from public, anon, authenticated;
revoke execute on function public._hh_chi_chu_doi_bank() from public, anon, authenticated;

-- Khách lấy tài khoản của tòa mình. Quy ước như các hàm tenant_* khác: token sai hoặc hết hạn trả null (app hiểu là phải đăng nhập lại);
-- tòa chưa nhập tài khoản thì trả { bank: null } (app khách rơi về js/config.js, và nếu cũng chưa có thì ẩn số tài khoản).
create or replace function public.tenant_bank(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_i jsonb;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  select b.bank_info into v_i from public.buildings b where b.owner_id = v_t.owner_id and b.id = v_t.building_id;
  if not public._bank_info_hop_le(v_i) then return jsonb_build_object('bank', null); end if;
  return jsonb_build_object('bank', jsonb_build_object(
    'name', v_i ->> 'name', 'bin', v_i ->> 'bin', 'account', v_i ->> 'account', 'holder', v_i ->> 'holder'));
end $$;

revoke all on function public.tenant_bank(text) from public;
grant execute on function public.tenant_bank(text) to anon, authenticated;

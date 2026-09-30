-- ============================================================
-- Happy Home — Dọn dữ liệu của các tài khoản dùng thử bị trùng
-- Chạy trong: Supabase → SQL Editor → New query → Run.
--
-- VÌ SAO CẦN?
--   Hàm tra khách thuê của app khách thuê tìm theo SỐ ĐIỆN THOẠI trên toàn
--   hệ thống, không phân biệt tài khoản. Nếu cùng một khách thuê tồn tại ở
--   hai tài khoản thì báo hỏng / gửi chỉ số có thể ghi vào NHẦM tài khoản,
--   và Row Level Security sẽ giấu nó khỏi tài khoản bạn đang đăng nhập.
--
-- SCRIPT NÀY LÀM GÌ?
--   1. Chép toàn bộ dữ liệu của các tài khoản cần dọn sang schema
--      backup_don_dep (vẫn nằm trong cùng cơ sở dữ liệu, lấy lại được).
--   2. Xóa dữ liệu đó khỏi các bảng chính.
--   KHÔNG xóa tài khoản đăng nhập, chỉ xóa dữ liệu thuộc tài khoản đó.
--
-- TRƯỚC KHI CHẠY
--   Mở trang chủ trọ, nhìn góc phải trên cùng xem bạn đang đăng nhập bằng
--   email nào. Email ĐÓ phải KHÔNG nằm trong danh sách bên dưới.
-- ============================================================

do $$
declare
  -- >>> SỬA DANH SÁCH NÀY: các tài khoản CẦN XÓA DỮ LIỆU <<<
  emails text[] := array[
    'hh.real.1786608066755@gmail.com',
    'hh.final.1786607940946@gmail.com'
  ];
  -- Xóa theo thứ tự này (bảng con trước, bảng cha sau)
  tabs text[] := array['payment_claims','bank_transactions','incidents','payments','invoices',
                       'readings','contracts','assets','transactions','audit_log',
                       'tenants','rooms','services','staff','buildings'];
  e text; t text; uid uuid; n bigint;
begin
  execute 'create schema if not exists backup_don_dep';

  foreach e in array emails loop
    select id into uid from auth.users where email = e;
    if uid is null then
      raise notice 'Bỏ qua: không có tài khoản %', e;
      continue;
    end if;
    raise notice '--- Dọn tài khoản % ---', e;

    foreach t in array tabs loop
      -- bảng chưa tạo, hoặc không có cột owner_id thì bỏ qua
      if to_regclass('public.' || t) is null then continue; end if;
      if not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = t and column_name = 'owner_id')
      then continue; end if;

      -- 1) sao lưu
      if to_regclass('backup_don_dep.' || t) is null then
        execute format('create table backup_don_dep.%I as select * from public.%I where owner_id = %L', t, t, uid);
      else
        execute format('insert into backup_don_dep.%I select * from public.%I where owner_id = %L', t, t, uid);
      end if;

      -- 2) xóa
      execute format('delete from public.%I where owner_id = %L', t, uid);
      get diagnostics n = row_count;
      if n > 0 then raise notice '  %: xóa % dòng (đã sao lưu)', t, n; end if;
    end loop;
  end loop;
end $$;

-- ============================================================
-- KIỂM TRA SAU KHI CHẠY: chỉ còn đúng MỘT tài khoản có dữ liệu
-- ============================================================
select u.email as "Tài khoản",
       (select count(*) from buildings b where b.owner_id = u.id) as "Tòa nhà",
       (select count(*) from tenants   t where t.owner_id = u.id) as "Khách thuê",
       (select count(*) from incidents i where i.owner_id = u.id) as "Sự cố"
from auth.users u
where (select count(*) from buildings b where b.owner_id = u.id)
    + (select count(*) from tenants t where t.owner_id = u.id) > 0
order by "Khách thuê" desc;

-- ============================================================
-- LỠ TAY XÓA NHẦM? Chép ngược lại từ bản sao lưu, ví dụ:
--   insert into public.buildings select * from backup_don_dep.buildings;
--   insert into public.rooms     select * from backup_don_dep.rooms;
--   insert into public.tenants   select * from backup_don_dep.tenants;
--   ... (làm tương tự cho các bảng khác)
--
-- Chắc chắn không cần nữa thì dọn luôn bản sao lưu:
--   drop schema backup_don_dep cascade;
-- ============================================================

-- ============================================================
-- Happy Home — Kiểm tra dữ liệu hiện có theo các luật của migration-constraints.sql
-- CHỈ ĐỌC, CHỈ ĐẾM: không sửa, không xóa, không in ra nội dung (CCCD, số điện thoại...). Chạy trong SQL editor của Supabase.
-- Dòng nào có so_dong > 0 là dữ liệu cũ đang vi phạm luật: migration-constraints.sql vẫn không đụng tới chúng,
-- chỉ chặn khi chính cột đó bị sửa thành giá trị sai (xem phần đầu migration-constraints.sql).
-- ============================================================
select * from (
  select 'tổng số dòng' as nhom, 'rooms' as bang, count(*) as so_dong from public.rooms
  union all select 'tổng số dòng', 'tenants', count(*) from public.tenants
  union all select 'tổng số dòng', 'contracts', count(*) from public.contracts
  union all select 'tổng số dòng', 'services', count(*) from public.services
  union all select 'tổng số dòng', 'readings', count(*) from public.readings
  union all select 'tổng số dòng', 'invoices', count(*) from public.invoices
  union all select 'tổng số dòng', 'payments', count(*) from public.payments

  union all select 'phòng: giá thuê âm', 'rooms', count(*) from public.rooms where price < 0
  union all select 'phòng: tiền giữ chỗ âm', 'rooms', count(*) from public.rooms where holding_deposit < 0
  union all select 'phòng: diện tích âm', 'rooms', count(*) from public.rooms where area < 0

  union all select 'khách: CCCD/CMND sai (không phải 9 hoặc 12 số)', 'tenants', count(*) from public.tenants
    where btrim(coalesce(id_number, '')) <> '' and regexp_replace(id_number, '[\s.]', '', 'g') !~ '^(\d{9}|\d{12})$'
  union all select 'khách: số điện thoại sai', 'tenants', count(*) from public.tenants
    where btrim(coalesce(phone, '')) <> '' and (case
        when regexp_replace(phone, '[\s.\-()]', '', 'g') ~ '^\+84\d{9}$' then '0' || substr(regexp_replace(phone, '[\s.\-()]', '', 'g'), 4)
        when regexp_replace(phone, '[\s.\-()]', '', 'g') ~ '^84\d{9}$' then '0' || substr(regexp_replace(phone, '[\s.\-()]', '', 'g'), 3)
        else regexp_replace(phone, '[\s.\-()]', '', 'g') end) !~ '^0\d{9}$'
  union all select 'khách: số người ở âm', 'tenants', count(*) from public.tenants where occupants < 0

  union all select 'hợp đồng: giá thuê âm', 'contracts', count(*) from public.contracts where rent < 0
  union all select 'hợp đồng: tiền cọc âm', 'contracts', count(*) from public.contracts where deposit < 0
  union all select 'hợp đồng: kết thúc trước bắt đầu', 'contracts', count(*) from public.contracts where end_date < start_date
  union all select 'hợp đồng: ngày chốt hóa đơn ngoài 1..31', 'contracts', count(*) from public.contracts where billing_day < 1 or billing_day > 31

  union all select 'dịch vụ: đơn giá âm', 'services', count(*) from public.services where unit < 0

  union all select 'chỉ số: điện kỳ trước âm', 'readings', count(*) from public.readings where elec_prev < 0
  union all select 'chỉ số: điện âm', 'readings', count(*) from public.readings where elec_curr < 0
  union all select 'chỉ số: kỳ sai dạng năm-tháng', 'readings', count(*) from public.readings where period is not null and period !~ '^\d{4}-(0[1-9]|1[0-2])$'

  union all select 'hóa đơn: đã thu âm', 'invoices', count(*) from public.invoices where paid < 0
  union all select 'hóa đơn: cuối kỳ trước đầu kỳ', 'invoices', count(*) from public.invoices where period_end < period_start
  union all select 'hóa đơn: kỳ sai dạng năm-tháng', 'invoices', count(*) from public.invoices where period is not null and period !~ '^\d{4}-(0[1-9]|1[0-2])$'

  union all select 'thanh toán: số tiền âm', 'payments', count(*) from public.payments where amount < 0
) t
order by (nhom = 'tổng số dòng') desc, bang, nhom;

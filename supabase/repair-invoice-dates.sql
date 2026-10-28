-- ============================================================
-- Happy Home — Sửa hóa đơn cũ bị lưu lệch MỘT NGÀY (hạn đóng tiền, đầu kỳ, cuối kỳ)
-- Chạy trong: Supabase → SQL Editor → New query → Run. Chạy lại nhiều lần vẫn an toàn.
--
-- Lỗi: bản web cũ ghi nửa đêm giờ Việt Nam thành chuỗi UTC ("2026-09-30T17:00:00Z") vào cột kiểu date, Postgres cắt
-- lấy 30/9. Hóa đơn kỳ 10/2026 hạn 5/11 lại lưu là 4/11, đầu kỳ 30/9 thay vì 1/10, cuối kỳ 30/10 thay vì 31/10.
-- Bản web mới (từ js/dates.js) đã ghi đúng. File này chỉ sửa dữ liệu CŨ.
--
-- Nhận diện hóa đơn bị lệch: ngày đầu kỳ + 1 ngày rơi đúng vào mồng 1 một tháng VÀ ngày cuối kỳ + 1 ngày là ngày cuối
-- tháng. Hóa đơn đã đúng (đầu kỳ là mồng 1) không thỏa nên không bị đụng. Sửa xong thì hết thỏa → chạy lại không dịch thêm.
-- ============================================================

-- B1. XEM TRƯỚC (chưa sửa gì): những hóa đơn sẽ được dịch thêm 1 ngày
select id, period, period_start, period_end, due_date,
       period_start + 1 as dau_ky_sau_sua, period_end + 1 as cuoi_ky_sau_sua, due_date + 1 as han_sau_sua
from public.invoices
where period_start is not null and period_end is not null
  and period_start + 1 = date_trunc('month', period_start + 1)::date
  and period_end + 1 = (date_trunc('month', period_end + 1) + interval '1 month - 1 day')::date
order by period, id
limit 50;

-- B2. SỬA
update public.invoices
set period_start = period_start + 1,
    period_end   = period_end + 1,
    due_date     = due_date + 1,
    updated_at   = now()
where period_start is not null and period_end is not null
  and period_start + 1 = date_trunc('month', period_start + 1)::date
  and period_end + 1 = (date_trunc('month', period_end + 1) + interval '1 month - 1 day')::date;

-- B3. KIỂM TRA: số hóa đơn còn lệch phải bằng 0
select count(*) as con_lech
from public.invoices
where period_start is not null and period_end is not null
  and period_start + 1 = date_trunc('month', period_start + 1)::date
  and period_end + 1 = (date_trunc('month', period_end + 1) + interval '1 month - 1 day')::date;

-- ============================================================
-- Happy Home — Giao dịch ngân hàng CHỈ chủ trọ xem (26/11/2026)
-- Chạy trong Supabase → SQL Editor → New query → Run. Chạy lại nhiều lần vẫn an toàn.
--
-- Vì sao: migration-bank-reconcile.sql có quy tắc "bank_tx_staff" cho MỌI nhân viên đang làm việc đọc và sửa
-- bảng bank_transactions của chủ trọ (không xét quyền gì). SePay gửi về MỌI khoản tiền vào tài khoản đã nối,
-- kể cả tiền riêng của chủ trọ (người nhà chuyển, lương...), kèm nội dung chuyển khoản. Nhân viên mở web là
-- tải về hết. Nay chỉ chủ trọ đọc được (quy tắc "bank_tx_own" giữ nguyên).
--
-- Nhân viên vẫn: duyệt phiếu "khách báo đã chuyển khoản" (payment_claims) và xem các khoản ĐÃ ghi thu
-- (payments) nếu có quyền Thanh toán. Việc tự khớp tiền về với hóa đơn chạy trên máy của chủ trọ.
-- Tệp này KHÔNG xóa dữ liệu nào: chỉ gỡ một quy tắc quyền.
-- ============================================================

drop policy if exists "bank_tx_staff" on public.bank_transactions;

-- Kiểm tra sau khi chạy (chỉ đọc): phải ra đúng 1 dòng "bank_tx_own".
-- select policyname from pg_policies where schemaname = 'public' and tablename = 'bank_transactions';

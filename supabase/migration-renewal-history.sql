-- ============================================================
-- Happy Home — Lịch sử gia hạn hợp đồng (để in lại phụ lục gia hạn)
-- Chạy trong: Supabase → SQL Editor → New query → Run (1 lần). Chạy lại nhiều lần được, không đụng dữ liệu có sẵn.
--
-- Mỗi lần gia hạn, app ghi một dòng vào cột này: [{ id, at, tuNgay, denNgay, soThang, giaCu, giaMoi, by }].
-- Chưa chạy tệp này thì app vẫn gia hạn được bình thường, chỉ là lịch sử (và việc in lại phụ lục) chỉ có trong phiên đang mở:
-- app tự báo như vậy ngay khi gia hạn xong.
-- ============================================================
alter table public.contracts add column if not exists renewal_history jsonb default '[]'::jsonb;

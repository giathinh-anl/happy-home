-- ============================================================
-- Happy Home — Nhân viên: chỉ vào được các tòa được giao + đọc và trả lời tin nhắn của khách (26/11/2026)
-- Chạy trong Supabase → SQL Editor → New query → Run. Chạy lại nhiều lần vẫn an toàn.
-- Tệp này KHÔNG xóa dòng dữ liệu nào: chỉ thay các quy tắc quyền (policy) và thêm hàm. Chạy sau migration-staff-vehicles.sql.
--
-- Trước đây (migration-staff-vehicles.sql...) quy tắc "staff_access" cho MỌI nhân viên đang làm đọc, sửa, XÓA mọi dòng của chủ trọ
-- ở mọi tòa (ô "Phạm vi tòa nhà" chỉ được web dùng để ẩn), nhân viên xóa được cả tòa nhà, và còn ghi được dữ liệu dưới tên chính
-- mình (bản sao chủ trọ không thấy). Tin nhắn của khách thì ngược lại: chỉ chủ trọ đọc được, nên khi trợ lý ảo không trả lời được
-- và khách nhắn cho người thật, nhân viên mở trang Hỏi đáp chỉ thấy trống.
--
-- Nay:
--   * Bảng có cột building_id: nhân viên chỉ đọc / ghi dòng của các tòa được giao (không giao tòa nào = mọi tòa).
--   * Tòa nhà: nhân viên xem và sửa tòa được giao, KHÔNG xóa được tòa nào.
--   * Tin nhắn khách (support_messages + ảnh): nhân viên có quyền "Khách thuê" đọc và trả lời, theo tòa được giao.
--   * Nhật ký: nhân viên ghi thêm được; chỉ nhân viên không giới hạn tòa mới đọc được (nhật ký ghi việc của mọi tòa).
--   * Hàm nv_ma_da_dung: trả các MÃ hóa đơn / số phiếu thu đã dùng (chỉ mã, không tiền, không tòa) để web của nhân viên
--     đánh số tiếp không trùng mã ở tòa họ không thấy.
--   * Không còn ghi được dữ liệu của chủ trọ dưới tên nhân viên (quy tắc cũ cho cả accessible_owners() gồm chính họ).
-- Quyền của CHỦ TRỌ không đổi (quy tắc own_all giữ nguyên).
-- ============================================================

-- 0) Phiếu thu thiếu cột trên máy chủ (đối chiếu 27/11/2026): web gửi số phiếu, phòng, tên khách, người thu, giờ thu nhưng bảng
--    payments không có các cột này nên web lặng lẽ bỏ khi lưu: tải lại trang là số phiếu thu (PT-2611-012...) mất, số đánh lại từ đầu
--    dễ trùng, phiếu in gộp nhiều hóa đơn không gom được. Chỉ THÊM cột; phiếu cũ để trống (số cũ chưa từng được lưu nên không lấy lại được).
alter table public.payments add column if not exists receipt_no text;
alter table public.payments add column if not exists room_code text;
alter table public.payments add column if not exists tenant_name text;
alter table public.payments add column if not exists created_by text;
alter table public.payments add column if not exists created_at timestamptz;

-- 1) Người đang đăng nhập có phải nhân viên ĐANG LÀM của chủ trọ này không (có quyền p_quyen nếu hỏi), bất kể tòa
create or replace function public.nv_cua(p_owner uuid, p_quyen text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.owner_id = p_owner
       and lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and s.status = 'active'
       and (p_quyen is null or coalesce(s.permissions, '[]'::jsonb) ? p_quyen));
$$;

-- 2) ... và được giao tòa p_toa (không giao tòa nào = mọi tòa). Dòng không có tòa (p_toa null) chỉ nhân viên không giới hạn tòa vào được.
create or replace function public.nv_duoc_vao(p_owner uuid, p_toa text, p_quyen text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s
     where s.owner_id = p_owner
       and lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       and s.status = 'active'
       and (p_quyen is null or coalesce(s.permissions, '[]'::jsonb) ? p_quyen)
       and (case when jsonb_typeof(s.building_ids) = 'array' and jsonb_array_length(s.building_ids) > 0
                 then p_toa is not null and s.building_ids ? p_toa
                 else true end));
$$;

revoke all on function public.nv_cua(uuid, text) from public, anon;
revoke all on function public.nv_duoc_vao(uuid, text, text) from public, anon;
grant execute on function public.nv_cua(uuid, text) to authenticated;
grant execute on function public.nv_duoc_vao(uuid, text, text) to authenticated;

-- 3) Các bảng có cột building_id: nhân viên chỉ vào dòng của tòa được giao
do $$
declare t text;
begin
  foreach t in array array[
    'rooms','tenants','contracts','services','readings','invoices','payments','assets','incidents','transactions',
    'payment_claims','renewal_requests','invoice_batches'
  ] loop
    begin
      execute format('drop policy if exists staff_access on public.%I;', t);
      execute format($f$create policy staff_access on public.%I for all to authenticated
        using (public.nv_duoc_vao(owner_id, building_id))
        with check (public.nv_duoc_vao(owner_id, building_id));$f$, t);
    exception when undefined_table then
      raise notice 'Bỏ qua bảng chưa tạo: %', t;
    end;
  end loop;
end $$;

-- 4) Tòa nhà: xem, thêm/sửa (web lưu bằng upsert) tòa được giao; KHÔNG có quyền xóa
drop policy if exists staff_access on public.buildings;
drop policy if exists staff_xem on public.buildings;
drop policy if exists staff_ghi on public.buildings;
drop policy if exists staff_sua on public.buildings;
create policy staff_xem on public.buildings for select to authenticated using (public.nv_duoc_vao(owner_id, id));
create policy staff_ghi on public.buildings for insert to authenticated with check (public.nv_duoc_vao(owner_id, id));
create policy staff_sua on public.buildings for update to authenticated
  using (public.nv_duoc_vao(owner_id, id)) with check (public.nv_duoc_vao(owner_id, id));

-- 5) Nhật ký: nhân viên ghi thêm được; chỉ nhân viên không giới hạn tòa đọc được; không ai ngoài chủ trọ sửa / xóa
drop policy if exists staff_access on public.audit_log;
drop policy if exists staff_ghi on public.audit_log;
drop policy if exists staff_xem on public.audit_log;
create policy staff_ghi on public.audit_log for insert to authenticated with check (public.nv_cua(owner_id));
create policy staff_xem on public.audit_log for select to authenticated using (public.nv_duoc_vao(owner_id, null));

-- 6) Tin nhắn của khách: nhân viên có quyền "Khách thuê" đọc, trả lời, đánh dấu đã xem, theo tòa được giao
do $$
begin
  execute 'drop policy if exists staff_chat on public.support_messages';
  execute $f$create policy staff_chat on public.support_messages for all to authenticated
    using (public.nv_duoc_vao(owner_id, building_id, 'tenants'))
    with check (public.nv_duoc_vao(owner_id, building_id, 'tenants'))$f$;
exception when undefined_table then raise notice 'Chưa có bảng support_messages (migration-support-chat.sql) — bỏ qua';
end $$;

-- 7) Ảnh trong tin nhắn: xem ảnh của tin mình được xem; gửi ảnh kèm câu trả lời
--    (ảnh có thể lên máy chủ trước dòng tin nên lúc GỬI chỉ kiểm "nhân viên có quyền Khách thuê của chủ trọ này")
do $$
begin
  execute 'drop policy if exists staff_chat on public.support_message_photos';
  execute 'drop policy if exists staff_chat_gui on public.support_message_photos';
  execute $f$create policy staff_chat on public.support_message_photos for select to authenticated
    using (exists (select 1 from public.support_messages m
                    where m.owner_id = support_message_photos.owner_id and m.id = support_message_photos.message_id
                      and public.nv_duoc_vao(m.owner_id, m.building_id, 'tenants')))$f$;
  execute $f$create policy staff_chat_gui on public.support_message_photos for insert to authenticated
    with check (public.nv_cua(owner_id, 'tenants'))$f$;
exception when undefined_table then raise notice 'Chưa có bảng support_message_photos (migration-chat-photos.sql) — bỏ qua';
end $$;

-- 8) Mã hóa đơn / số phiếu thu đã dùng của chủ trọ (chỉ mã: không tiền, không tòa, không khách).
--    Gọi được bởi chính chủ trọ hoặc nhân viên đang làm của chủ trọ đó; người khác nhận null.
create or replace function public.nv_ma_da_dung(p_owner uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_owner is null or not (p_owner = auth.uid() or public.nv_cua(p_owner)) then return null; end if;
  return jsonb_build_object(
    'hd', coalesce((select jsonb_agg(i.id) from public.invoices i where i.owner_id = p_owner and i.id like 'HD-%'), '[]'::jsonb),
    'pt', coalesce((select jsonb_agg(p.receipt_no) from public.payments p where p.owner_id = p_owner and p.receipt_no like 'PT-%'), '[]'::jsonb));
end $$;
revoke all on function public.nv_ma_da_dung(uuid) from public, anon;
grant execute on function public.nv_ma_da_dung(uuid) to authenticated;

-- Kiểm tra sau khi chạy (chỉ đọc):
-- select tablename, string_agg(policyname || '(' || cmd || ')', ', ') from pg_policies
--  where schemaname = 'public' and policyname like 'staff%' group by tablename order by 1;

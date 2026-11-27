-- ============================================================
-- Happy Home — Sửa: nhân viên trả lời mà khách không thấy (27/11/2026)
-- Chạy trong Supabase → SQL Editor → New query → Run. Chạy lại nhiều lần vẫn an toàn. Không xóa, không sửa dòng dữ liệu nào.
-- Chạy sau migration-chat-photos.sql (thay đúng hàm tenant_messages của tệp đó, giữ nguyên chữ ký hàm).
--
-- Lỗi thật trên máy chủ: khách hỏi lúc 11:23:18, nhân viên trả lời 11:23:33 và 11:23:47; hai tin có trên máy chủ, bị đánh dấu
-- "khách đã đọc", nhưng app khách không hề hiện. Vì app khách hỏi "tin mới hơn mốc lần hỏi trước" (p_after = giờ máy chủ lúc hỏi trước),
-- còn created_at của tin trả lời do MÁY người trả lời ghi lúc bấm Gửi; dòng tới máy chủ trễ vài giây (hoặc đồng hồ máy đó chậm)
-- thì lần hỏi xen giữa đã đẩy mốc qua mặt tin đó. Hàm cũ chỉ TRẢ tin sau mốc nhưng lại ĐÁNH DẤU ĐÃ ĐỌC mọi tin chưa đọc: tin mất hẳn.
-- Nay: luôn trả kèm mọi tin của nhân viên mà khách CHƯA đọc (app khách bỏ qua tin đã hiện theo mã tin), rồi mới đánh dấu đã đọc.
-- ============================================================

create or replace function public.tenant_messages(p_token text, p_after timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_t public.tenants; v_out jsonb; v_ph text;
begin
  v_t := public._tenant_from_token(p_token);
  if v_t.id is null then return null; end if;
  v_ph := public._norm_phone(v_t.phone);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'sender', m.sender, 'body', m.body,
           'staffName', m.staff_name, 'createdAt', m.created_at, 'photoCount', m.photo_count
         ) order by m.created_at), '[]'::jsonb)
    into v_out
    from public.support_messages m
   where m.owner_id = v_t.owner_id
     and public._norm_phone(m.tenant_phone) = v_ph
     and (p_after is null or m.created_at > p_after
          or (m.sender = 'staff' and m.read_by_tenant = false));      -- tin trả lời khách chưa đọc: luôn trả, dù giờ ghi trên tin cũ hơn mốc

  update public.support_messages
     set read_by_tenant = true, updated_at = now()
   where owner_id = v_t.owner_id and public._norm_phone(tenant_phone) = v_ph
     and sender = 'staff' and read_by_tenant = false;

  return jsonb_build_object('messages', v_out, 'now', now());
end $$;

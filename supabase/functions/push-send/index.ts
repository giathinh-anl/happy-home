/* ============================================================
   Happy Home — Gửi thông báo đẩy (Web Push) tới điện thoại khách thuê
   ------------------------------------------------------------
   Được CSDL gọi (qua pg_net) mỗi khi có nhắc hạn đóng tiền hoặc nhân viên trả lời khách (xem supabase/migration-push.sql).
   Nhận: { subs: [{endpoint, p256dh, auth}], title, body, url }  với header  x-push-secret: <chuỗi bí mật chung>.
   Làm: mã hóa nội dung theo chuẩn Web Push, ký bằng khóa VAPID rồi gửi tới dịch vụ đẩy của trình duyệt.
   Máy nào trả 404/410 (khách gỡ app hay thu hồi quyền) thì xóa khỏi bảng tenant_push_subs.

   TRIỂN KHAI (làm một lần):
     1. Chạy supabase/migration-push.sql trong SQL Editor, và bật Database → Extensions → pg_net.
     2. Tạo cặp khóa VAPID:   node tools/push/tao-khoa-vapid.js   (khóa BÍ MẬT chỉ in ra máy bạn, không lưu vào dự án)
     3. supabase secrets set VAPID_PUBLIC_KEY=<khóa công khai> VAPID_PRIVATE_KEY=<khóa bí mật> VAPID_SUBJECT=mailto:<email của bạn>
        supabase secrets set PUSH_SECRET=<một chuỗi ngẫu nhiên dài>
     4. supabase functions deploy push-send --no-verify-jwt
        (triển khai bằng CLI tự gói cả push.ts; dán tay trong trang Supabase thì phải tạo đủ HAI tệp index.ts và push.ts)
     5. Trong SQL Editor:  update public.push_config set url = 'https://<project-ref>.supabase.co/functions/v1/push-send',
                                                       secret = '<đúng chuỗi PUSH_SECRET ở bước 3>' where id = 1;
     6. Dán khóa CÔNG KHAI vào js/config.js: vapidPublicKey: '<khóa công khai>'  (khóa công khai thì commit được)
   Chưa làm đủ các bước thì app khách ẩn mục Thông báo trên điện thoại, mọi thứ khác vẫn chạy.
   ============================================================ */

import webpush from 'npm:web-push@3.6.7';
import { duocPhep, locMay, taoNoiDung, maBiXoa } from './push.ts';

const SECRET = Deno.env.get('PUSH_SECRET') ?? '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

if (VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

async function xoaMay(endpoint: string) {
  if (!SB_URL || !SB_SERVICE) return;
  try {
    await fetch(`${SB_URL}/rest/v1/tenant_push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}` } });
  } catch { /* lần sau sẽ xóa */ }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  // Kiểm chuỗi bí mật TRƯỚC khi đọc nội dung; chưa cấu hình PUSH_SECRET thì từ chối hết (không bao giờ mở cửa)
  if (!SECRET || !duocPhep(req, SECRET)) return json({ error: 'unauthorized' }, 401);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) return json({ error: 'vapid_not_configured' }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const noiDung = taoNoiDung(body);
  const may = locMay(body.subs);
  if (!noiDung || !may.length) return json({ sent: 0, gone: 0, skipped: true });

  let sent = 0, gone = 0, failed = 0;
  await Promise.all(may.map(async (m) => {
    try {
      await webpush.sendNotification({ endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } }, noiDung, { TTL: 86400, urgency: 'normal' });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (maBiXoa(status)) { gone++; await xoaMay(m.endpoint); } else failed++;
    }
  }));
  return json({ sent, gone, failed });
});

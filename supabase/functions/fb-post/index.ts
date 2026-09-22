/* ============================================================
   Happy Home — Edge Function: đăng tin cho thuê lên Trang Facebook
   ------------------------------------------------------------
   Vì sao phải đi qua máy chủ?
     Mã truy cập Trang (Page access token) cho phép đăng bài THAY Trang.
     Đặt trong trình duyệt thì ai mở trang web cũng lấy được mã đó.
     Hàm này giữ mã ở phía máy chủ; trình duyệt chỉ gửi nội dung + ảnh.

   Ai được đăng?
     Chỉ tài khoản đã đăng nhập VÀ có email nằm trong FB_ALLOWED_EMAILS
     (app cho phép tự đăng ký, nên không thể cho mọi tài khoản đăng lên Trang).

   Giới hạn của Facebook (không phải của app):
     - Chỉ đăng được lên TRANG (Fanpage) mà bạn quản trị.
     - Không đăng tự động được lên trang cá nhân hay vào NHÓM:
       Facebook đã tắt các API đó.

   TRIỂN KHAI: xem hướng dẫn từng bước trong FACEBOOK_SETUP.md
     supabase secrets set FB_PAGE_ID=... FB_PAGE_TOKEN=... FB_ALLOWED_EMAILS=ban@gmail.com
     supabase functions deploy fb-post
   ============================================================ */
import { createClient } from 'npm:@supabase/supabase-js@2';

const PAGE_ID = Deno.env.get('FB_PAGE_ID') ?? '';
const PAGE_TOKEN = Deno.env.get('FB_PAGE_TOKEN') ?? '';
const GRAPH = `https://graph.facebook.com/${Deno.env.get('FB_GRAPH_VERSION') ?? 'v23.0'}`;
const ALLOWED = (Deno.env.get('FB_ALLOWED_EMAILS') ?? '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
// Supabase tự cấp sẵn 2 biến này cho mọi Edge Function
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MAX_PHOTOS = 10;           // Facebook cho tối đa 10 ảnh đính kèm một bài
const MAX_PHOTO_BYTES = 4_000_000;
const MAX_TEXT = 5000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Chống bấm liên tục / bị lạm dụng: tối đa 20 bài mỗi giờ cho mỗi tài khoản
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(key: string) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now - cur.t > 3600_000) { hits.set(key, { n: 1, t: now }); return false; }
  cur.n++;
  return cur.n > 20;
}

// Lỗi Facebook -> câu tiếng Việt dễ hiểu
function fbError(j: any): Error {
  const e = (j && j.error) || {};
  const code = Number(e.code);
  let msg = 'Facebook từ chối: ' + (e.message || 'lỗi không rõ');
  if (code === 190) msg = 'Mã truy cập Trang đã hết hạn hoặc bị thu hồi. Tạo mã mới rồi đặt lại FB_PAGE_TOKEN.';
  else if (code === 200 || code === 10 || code === 3) msg = 'Mã truy cập thiếu quyền pages_manage_posts. Tạo lại mã với đủ quyền (xem FACEBOOK_SETUP.md).';
  else if (code === 368) msg = 'Facebook tạm chặn đăng bài vì nghi spam. Đợi một lúc rồi thử lại.';
  else if (code === 4 || code === 32 || code === 613) msg = 'Đăng quá nhanh, Facebook tạm giới hạn. Thử lại sau ít phút.';
  return new Error(msg);
}

// Ảnh phòng lưu dạng data URL (JPEG nén trong trình duyệt) -> tệp để tải lên
function dataUrlToBlob(src: string): Blob | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(src);
  if (!m) return null;
  const bin = atob(m[2]);
  if (bin.length > MAX_PHOTO_BYTES) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

// Bước 1: tải từng ảnh lên Trang ở chế độ ẩn (published=false), lấy mã ảnh
async function uploadPhoto(src: string, i: number): Promise<string> {
  const fd = new FormData();
  fd.append('published', 'false');
  fd.append('access_token', PAGE_TOKEN);
  if (/^https:\/\//.test(src)) fd.append('url', src);
  else {
    const blob = dataUrlToBlob(src);
    if (!blob) throw new Error(`Ảnh thứ ${i + 1} không hợp lệ hoặc quá lớn.`);
    fd.append('source', blob, `phong-${i + 1}.jpg`);
  }
  const r = await fetch(`${GRAPH}/${PAGE_ID}/photos`, { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw fbError(j);
  return j.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!PAGE_ID || !PAGE_TOKEN) return json({ error: 'Máy chủ chưa đặt FB_PAGE_ID / FB_PAGE_TOKEN (xem FACEBOOK_SETUP.md).' }, 500);
  if (!ALLOWED.length) return json({ error: 'Máy chủ chưa đặt FB_ALLOWED_EMAILS (email được phép đăng tin).' }, 500);

  // Ai đang gọi? Đọc từ phiên đăng nhập, không tin thông tin gửi kèm trong nội dung
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: u, error: ue } = await sb.auth.getUser();
  const email = (u?.user?.email ?? '').toLowerCase();
  if (ue || !email) return json({ error: 'Cần đăng nhập để đăng tin.' }, 401);
  if (!ALLOWED.includes(email)) return json({ error: `Tài khoản ${email} chưa được phép đăng lên Trang Facebook.` }, 403);
  if (rateLimited(email)) return json({ error: 'Đã đăng quá 20 bài trong một giờ. Thử lại sau.' }, 429);

  let body: { message?: string; photos?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400); }
  const message = String(body.message ?? '').trim().slice(0, MAX_TEXT);
  const photos = (Array.isArray(body.photos) ? body.photos : []).filter((p) => typeof p === 'string').slice(0, MAX_PHOTOS);
  if (!message) return json({ error: 'Nội dung tin đang trống.' }, 400);

  try {
    const ids: string[] = [];
    for (let i = 0; i < photos.length; i++) ids.push(await uploadPhoto(photos[i], i));

    // Bước 2: tạo bài đăng trên Trang, đính kèm các ảnh vừa tải
    const form = new URLSearchParams();
    form.set('message', message);
    ids.forEach((id, i) => form.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    form.set('access_token', PAGE_TOKEN);
    const r = await fetch(`${GRAPH}/${PAGE_ID}/feed`, { method: 'POST', body: form });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) throw fbError(j);

    return json({ ok: true, postId: j.id, url: `https://www.facebook.com/${j.id}`, photos: ids.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
});

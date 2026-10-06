/* ============================================================
   Happy Home — Chatbot trả lời tin nhắn trên Trang Facebook
   ------------------------------------------------------------
   Khách nhắn vào Trang hỏi "còn phòng trống không", "giá bao nhiêu",
   "ở đâu"... bot trả lời ngay bằng DỮ LIỆU PHÒNG THẬT trong Supabase.

   Facebook gọi hàm này theo 2 cách:
     GET  — một lần lúc cài webhook, để xác thực (trả lại hub.challenge)
     POST — mỗi khi có người nhắn tin cho Trang

   TRIỂN KHAI (xem FACEBOOK_SETUP.md, mục "Chatbot trên Trang"):
     supabase secrets set FB_PAGE_TOKEN=... FB_VERIFY_TOKEN=... FB_OWNER_EMAIL=...
     supabase functions deploy fb-bot --no-verify-jwt
   LƯU Ý: bắt buộc --no-verify-jwt, vì Facebook gọi tới chứ không phải
   người dùng đã đăng nhập.

   Mã truy cập Trang chỉ nằm trên máy chủ Supabase, không bao giờ lộ ra
   trình duyệt.
   ============================================================ */
import { createClient } from 'npm:@supabase/supabase-js@2';

const PAGE_TOKEN = Deno.env.get('FB_PAGE_TOKEN') ?? '';
const VERIFY_TOKEN = Deno.env.get('FB_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('FB_APP_SECRET') ?? '';        // tùy chọn, có thì kiểm chữ ký
const OWNER_EMAIL = (Deno.env.get('FB_OWNER_EMAIL') ?? '').trim().toLowerCase();
const HOTLINE = Deno.env.get('FB_HOTLINE') ?? '';
const GRAPH = `https://graph.facebook.com/${Deno.env.get('FB_GRAPH_VERSION') ?? 'v23.0'}`;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_MSG = 1900;            // Facebook giới hạn 2000 ký tự mỗi tin
const CACHE_MS = 60_000;         // nhớ dữ liệu phòng 1 phút cho đỡ truy vấn liên tục

/* ---------- tiện ích ---------- */
const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' đ';
const norm = (s: string) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
const has = (t: string, ...keys: string[]) => keys.some((k) => t.includes(k));
const cut = (s: string) => (s.length > MAX_MSG ? s.slice(0, MAX_MSG - 1) + '…' : s);

/* ---------- dữ liệu phòng (đọc bằng service role, chỉ ở máy chủ) ---------- */
type Room = {
  code: string; building_id: string; status: string; price: number;
  area: number; type_label: string; max_occupants: number; description?: string;
};
type Building = { id: string; name: string; address: string };
let cache: { at: number; rooms: Room[]; buildings: Building[] } | null = null;

async function loadData() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // BẮT BUỘC phải biết quảng cáo phòng của tài khoản nào. Dự án có thể có
  // nhiều tài khoản chủ trọ trong cùng cơ sở dữ liệu; không chốt tài khoản
  // thì bot sẽ trộn phòng của người khác vào câu trả lời.
  let ownerId: string | null = null;
  if (OWNER_EMAIL) {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = (data?.users ?? []).find((x) => (x.email ?? '').toLowerCase() === OWNER_EMAIL);
    ownerId = u?.id ?? null;
    if (!ownerId) console.error('[fb-bot] FB_OWNER_EMAIL không khớp tài khoản nào:', OWNER_EMAIL);
  } else {
    console.error('[fb-bot] Chưa đặt FB_OWNER_EMAIL — bot không trả lời số liệu phòng.');
  }
  if (!ownerId) { cache = { at: Date.now(), rooms: [], buildings: [] }; return cache; }

  const [{ data: rooms }, { data: buildings }] = await Promise.all([
    sb.from('rooms').select('code,building_id,status,price,area,type_label,max_occupants,description').eq('owner_id', ownerId),
    sb.from('buildings').select('id,name,address').eq('owner_id', ownerId),
  ]);
  cache = { at: Date.now(), rooms: (rooms ?? []) as Room[], buildings: (buildings ?? []) as Building[] };
  return cache;
}

/* ---------- soạn câu trả lời ---------- */
const MENU = 'Em trả lời được: phòng trống · giá thuê · địa chỉ · tiện ích · hẹn xem phòng.';

function noiTrong(rooms: Room[], buildings: Building[]) {
  const trong = rooms.filter((r) => r.status === 'vacant');
  if (!trong.length) return 'Hiện tất cả phòng đều đã có khách ạ. Anh/chị để lại số điện thoại, có phòng trống em báo ngay.';
  const ten = (id: string) => buildings.find((b) => b.id === id)?.name ?? '';
  const ds = trong.slice(0, 8)
    .map((r) => `• ${r.code} — ${r.type_label || 'Phòng'} ${r.area} m², tối đa ${r.max_occupants} người, ${vnd(r.price)}/tháng${ten(r.building_id) ? ' (' + ten(r.building_id) + ')' : ''}`)
    .join('\n');
  const them = trong.length > 8 ? `\n...và ${trong.length - 8} phòng nữa.` : '';
  return `Dạ còn ${trong.length} phòng trống ạ:\n${ds}${them}\n\nAnh/chị muốn xem phòng nào thì nhắn em mã phòng nhé.`;
}

function noiGia(rooms: Room[]) {
  const gia = rooms.map((r) => r.price).filter((n) => n > 0);
  if (!gia.length) return 'Dạ anh/chị để lại số điện thoại, em gửi bảng giá ngay ạ.';
  const min = Math.min(...gia), max = Math.max(...gia);
  const loai = [...new Set(rooms.map((r) => `${r.type_label} ${r.area} m² — ${vnd(r.price)}/tháng`))].slice(0, 5);
  return `Giá thuê từ ${vnd(min)} đến ${vnd(max)} mỗi tháng ạ:\n${loai.map((x) => '• ' + x).join('\n')}\n\n`
    + 'Tiền điện tính theo chỉ số thực tế, nước và rác thu theo quy định, không có phí ẩn ạ.';
}

function noiDiaChi(buildings: Building[]) {
  if (!buildings.length) return 'Dạ anh/chị để lại số điện thoại, em gửi địa chỉ ngay ạ.';
  return `Nhà trọ có ${buildings.length} cơ sở ạ:\n`
    + buildings.map((b) => `• ${b.name} — ${b.address}`).join('\n');
}

const TIEN_ICH = 'Phòng có sẵn máy lạnh, tủ lạnh, giường và tủ quần áo, dọn vào là ở được ạ.\n'
  + 'Tòa nhà có internet, nước sạch, thu gom rác mỗi ngày, khóa riêng từng phòng.\n'
  + 'Hỏng hóc báo qua app là có thợ tới tận phòng.';

function henXem() {
  return HOTLINE
    ? `Dạ anh/chị gọi ${HOTLINE} (8:00–20:00 mỗi ngày) để hẹn giờ, hoặc để lại số điện thoại ở đây em gọi lại ạ.`
    : 'Dạ anh/chị để lại số điện thoại ở đây, em gọi lại hẹn giờ xem phòng ngay ạ.';
}

async function traLoi(text: string): Promise<string> {
  const t = norm(text);
  if (!t) return `Dạ em nghe ạ. ${MENU}`;

  const { rooms, buildings } = await loadData();

  // hỏi đúng một mã phòng, ví dụ "P305"
  const ma = (text.match(/\b[Pp]\s?\d{3,4}\b/) || [])[0];
  if (ma) {
    const code = ma.replace(/\s/g, '').toUpperCase();
    const r = rooms.find((x) => x.code.toUpperCase() === code);
    if (r) {
      const b = buildings.find((x) => x.id === r.building_id);
      const trangThai = r.status === 'vacant' ? 'đang còn trống' : 'đang có khách thuê';
      return `Phòng ${r.code} ${trangThai} ạ.\n`
        + `• ${r.type_label || 'Phòng'} ${r.area} m², tối đa ${r.max_occupants} người\n`
        + `• ${vnd(r.price)}/tháng\n`
        + (b ? `• ${b.name} — ${b.address}\n` : '')
        + (r.description ? `• ${r.description}\n` : '')
        + (r.status === 'vacant' ? '\n' + henXem() : '\nAnh/chị muốn xem phòng trống khác thì nhắn "phòng trống" nhé ạ.');
    }
  }

  if (has(t, 'xin chao', 'chao shop', 'chao ad', 'hello', 'alo', 'hi ')) return `Dạ em chào anh/chị ạ. ${MENU}`;
  if (has(t, 'phong trong', 'con phong', 'con trong', 'thue phong', 'muon thue', 'can thue')) return noiTrong(rooms, buildings);
  if (has(t, 'gia', 'bao nhieu tien', 'bao nhieu 1 thang', 'bao nhieu mot thang', 'tien phong', 'cho thue bao nhieu')) return noiGia(rooms);
  if (has(t, 'dia chi', 'o dau', 'cho nao', 'duong nao', 'quan may', 'ban do')) return noiDiaChi(buildings);
  if (has(t, 'tien ich', 'tien nghi', 'co gi', 'noi that', 'may lanh', 'wifi', 'internet', 'giu xe', 'de xe')) return TIEN_ICH;
  if (has(t, 'xem phong', 'hen', 'ghe', 'den xem', 'so dien thoai', 'sdt', 'hotline', 'lien he')) return henXem();
  if (has(t, 'hop dong', 'coc', 'dat coc', 'thu tuc')) {
    return 'Thủ tục gọn ạ: xem phòng → ký hợp đồng và đặt cọc → nhận phòng có biên bản bàn giao tài sản.\n'
      + 'Mỗi tháng hóa đơn lên app của khách, tách riêng từng khoản.\n\n' + henXem();
  }

  return `Dạ em chưa rõ ý anh/chị ạ. ${MENU}\n\n${henXem()}`;
}

/* ---------- gửi tin về Messenger ---------- */
async function send(psid: string, text: string) {
  const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(PAGE_TOKEN)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: cut(text) } }),
  });
  if (!res.ok) console.error('[fb-bot gửi lỗi]', res.status, (await res.text()).slice(0, 300));
}

/* ---------- kiểm chữ ký của Facebook (nếu đã đặt FB_APP_SECRET) ---------- */
async function chuKyDung(raw: string, header: string | null) {
  if (!APP_SECRET) return true;                  // chưa đặt thì bỏ qua
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === header.slice(7);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1) Facebook xác thực webhook (chỉ chạy lúc cài)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') ?? '';
    if (!VERIFY_TOKEN) return new Response('Máy chủ chưa đặt FB_VERIFY_TOKEN', { status: 500 });
    if (mode === 'subscribe' && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
    return new Response('Sai verify token', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  if (!PAGE_TOKEN) { console.error('[fb-bot] chưa đặt FB_PAGE_TOKEN'); return new Response('EVENT_RECEIVED'); }

  const raw = await req.text();
  if (!(await chuKyDung(raw, req.headers.get('x-hub-signature-256')))) {
    return new Response('Chữ ký không hợp lệ', { status: 401 });
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response('EVENT_RECEIVED'); }
  if (body?.object !== 'page') return new Response('EVENT_RECEIVED');

  // Trả 200 ngay cho Facebook; xử lý xong mới thôi (Edge Function sống tới khi hàm kết thúc)
  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const psid = ev?.sender?.id;
      if (!psid || ev.message?.is_echo) continue;                  // bỏ qua tin do chính Trang gửi
      const text = ev.message?.text ?? ev.postback?.payload ?? '';
      if (!text) {
        await send(psid, `Dạ em mới nhận được tin của anh/chị ạ. ${MENU}`);
        continue;
      }
      try {
        await send(psid, await traLoi(text));
      } catch (e) {
        console.error('[fb-bot]', e);
        await send(psid, 'Dạ hệ thống đang bận, anh/chị nhắn lại giúp em một chút ạ.');
      }
    }
  }
  return new Response('EVENT_RECEIVED');
});

/* ============================================================
   Happy Home — Edge Function làm "cầu" tới Gemini
   ------------------------------------------------------------
   Vì sao cần?  Nếu đặt khóa Gemini thẳng trong js/config.js thì ai mở
   trình duyệt cũng đọc được khóa và dùng hết hạn mức của bạn.
   Hàm này giữ khóa ở PHÍA MÁY CHỦ; trình duyệt chỉ gọi tới đây.

   TRIỂN KHAI (một lần):
     1. Cài Supabase CLI:            npm i -g supabase
     2. Đăng nhập:                   supabase login
     3. Nối vào dự án:               supabase link --project-ref <project-ref>
     4. Đặt khóa Gemini (bí mật):    supabase secrets set GEMINI_API_KEY=AIza...
     5. Đưa hàm lên:                 supabase functions deploy ai --no-verify-jwt
     6. Trong js/config.js và tenant-app/js/config.js, thêm:
          aiProxyUrl: 'https://<project-ref>.supabase.co/functions/v1/ai'
        và XÓA dòng geminiApiKey đi.

   Lấy khóa Gemini miễn phí tại: https://aistudio.google.com/apikey
   ============================================================ */

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

// Chỉ cho phép các mô hình Flash (rẻ / miễn phí), tránh bị gọi sang mô hình đắt tiền
const ALLOWED = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

// Giới hạn thô theo IP để tránh bị lạm dụng (đặt lại mỗi giờ, bộ nhớ tạm của instance)
const hits = new Map<string, { n: number; t: number }>();
const PER_HOUR = 120;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function rateLimited(ip: string) {
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || now - cur.t > 3600_000) { hits.set(ip, { n: 1, t: now }); return false; }
  cur.n++;
  return cur.n > PER_HOUR;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!GEMINI_KEY) return json({ error: 'GEMINI_API_KEY chưa được đặt trên máy chủ' }, 500);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429);

  let payload: { model?: string; body?: unknown };
  try { payload = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const model = ALLOWED.includes(payload.model ?? '') ? payload.model! : 'gemini-2.0-flash';
  if (!payload.body || typeof payload.body !== 'object') return json({ error: 'bad_body' }, 400);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload.body) },
  );

  const text = await res.text();
  return new Response(text, { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } });
});

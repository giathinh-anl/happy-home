/* ============================================================
   Happy Home — Nhận giao dịch ngân hàng (SePay / Casso) và đẩy vào app
   ------------------------------------------------------------
   Vì sao cần?  Ngân hàng Việt Nam không mở API cho tài khoản cá nhân.
   Cách chạy thật: dùng một dịch vụ đọc biến động số dư (SePay hoặc Casso,
   đều có gói miễn phí), cấu hình nó bắn mỗi giao dịch TIỀN VÀO về đây.
   Hàm này chỉ ghi giao dịch thô vào bảng bank_transactions.
   Việc khớp hóa đơn và ghi thu do chính app làm dưới danh nghĩa chủ trọ,
   nên mọi khoản thu vẫn có dấu vết đầy đủ trong nhật ký.

   TRIỂN KHAI:
     1. Chạy supabase/migration-bank-reconcile.sql trong SQL Editor.
     2. Trong app: Khách chuyển khoản -> Đối soát ngân hàng -> "Nối ngân hàng"
        -> bấm "Tạo secret" rồi chép chuỗi đó ra.
     3. supabase secrets set BANK_WEBHOOK_SECRET=<chuỗi vừa chép>
        supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
        supabase secrets set SUPABASE_ANON_KEY=<anon public key>
     4. supabase functions deploy bank-webhook --no-verify-jwt
     5. Vào SePay/Casso → Webhook → dán:
          https://<project-ref>.supabase.co/functions/v1/bank-webhook
        Chọn "chỉ gửi giao dịch tiền vào".

   BẢO MẬT: secret nằm ở phía máy chủ, không lộ ra trình duyệt.
   Ai không có secret thì gọi vào đây cũng không ghi được gì.
   ============================================================ */

const SECRET = Deno.env.get('BANK_WEBHOOK_SECRET') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Mỗi dịch vụ đặt tên trường một kiểu — gom về một dạng chung. */
function normalize(p: Record<string, unknown>) {
  const num = (v: unknown) => Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0);
  const str = (v: unknown) => (v == null ? '' : String(v));

  // SePay: { id, transferAmount, content, transactionDate, transferType }
  // Casso: { id, amount, description, when }
  const amountIn = p.transferAmount ?? p.amount ?? p.credit ?? p.amount_in;
  const direction = str(p.transferType ?? p.type ?? '').toLowerCase();
  const amount = num(amountIn);

  return {
    ref: str(p.id ?? p.tid ?? p.reference ?? p.referenceCode ?? '') || null,
    amount,
    content: str(p.content ?? p.description ?? p.note ?? p.remark ?? ''),
    date: str(p.transactionDate ?? p.when ?? p.date ?? '') || new Date().toISOString(),
    // Bỏ qua giao dịch tiền ra (nếu dịch vụ có gửi cả hai chiều)
    isIncoming: amount > 0 && direction !== 'out' && direction !== 'debit' && direction !== 'withdrawal',
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SECRET || !SB_URL || !SB_KEY) return json({ error: 'chưa đặt đủ biến môi trường' }, 500);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  // SePay gửi kèm "Authorization: Apikey <key>" — nếu bạn đặt key trùng secret thì kiểm luôn ở đây.
  const auth = req.headers.get('authorization') ?? '';
  const headerKey = auth.replace(/^(Apikey|Bearer)\s+/i, '').trim();
  if (headerKey && headerKey !== SECRET) return json({ error: 'unauthorized' }, 401);

  // Có dịch vụ gửi 1 giao dịch, có dịch vụ gửi mảng trong "data"
  const items = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : [payload];

  const results: { ref: string | null; ok: boolean; note?: string }[] = [];
  for (const raw of items) {
    const t = normalize(raw);
    if (!t.isIncoming) { results.push({ ref: t.ref, ok: false, note: 'không phải tiền vào' }); continue; }

    const res = await fetch(`${SB_URL}/rest/v1/rpc/bank_ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      body: JSON.stringify({
        p_secret: SECRET, p_ref: t.ref, p_amount: t.amount,
        p_content: t.content, p_date: t.date,
      }),
    });
    if (res.ok) results.push({ ref: t.ref, ok: true });
    else results.push({ ref: t.ref, ok: false, note: (await res.text()).slice(0, 200) });
  }

  // SePay/Casso coi HTTP 200 là đã nhận thành công, không gửi lại nữa.
  return json({ success: true, results });
});

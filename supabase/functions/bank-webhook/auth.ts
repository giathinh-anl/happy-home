/* Kiểm mã bí mật của lời gọi webhook ngân hàng. Tách riêng, không đụng Deno, để chạy kiểm thử bằng node (tests/bank-webhook-auth.test.js).

   Vì sao quan trọng: hàm bank-webhook tự truyền mã bí mật của chính nó vào hàm ghi giao dịch trong CSDL. Nếu nó không bắt người gọi chứng minh mình
   biết mã, thì BẤT KỲ AI biết đường link cũng bơm được giao dịch "tiền vào" giả, và app sẽ tự khớp hóa đơn rồi xóa công nợ.
   Nên: KHÔNG có mã đúng thì từ chối, kể cả khi yêu cầu không kèm gì cả. */

type YeuCau = { headers: { get(ten: string): string | null }; url: string };

/** Lấy mã người gọi gửi kèm, theo thứ tự: header Authorization (SePay: "Apikey <mã>"), header secure-token (Casso bản V1), tham số ?key= trên link
    (dịch vụ nào cũng dùng được). Không có thì trả chuỗi rỗng. */
export function layMa(req: YeuCau): string {
  const a = (req.headers.get('authorization') ?? '').replace(/^(Apikey|Bearer)\s+/i, '').trim();
  if (a) return a;
  const t = (req.headers.get('secure-token') ?? '').trim();
  if (t) return t;
  try { return (new URL(req.url).searchParams.get('key') ?? '').trim(); } catch { return ''; }
}

/** So sánh hai chuỗi mà thời gian chạy không phụ thuộc vào việc khớp tới ký tự thứ mấy (chống dò mã từng ký tự). Chuỗi rỗng thì không bao giờ khớp. */
export function bangNhau(a: string, b: string): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let khac = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) khac |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return khac === 0;
}

/** Mã bí mật của hàm phải đủ dài (CSDL đòi tối thiểu 16 ký tự) và lời gọi phải mang đúng mã đó */
export function duocPhep(req: YeuCau, secret: string): boolean {
  return secret.length >= 16 && bangNhau(layMa(req), secret);
}

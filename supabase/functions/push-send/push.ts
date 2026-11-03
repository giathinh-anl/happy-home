/* Các phép kiểm của hàm push-send. Tách riêng, không đụng Deno, để chạy kiểm thử bằng node (tests/push-send.test.js).

   Hàm push-send nhận danh sách máy đã đăng ký + nội dung từ CSDL (qua pg_net) rồi gọi dịch vụ đẩy của trình duyệt.
   Vì nó tự gửi yêu cầu ra ngoài tới địa chỉ do dữ liệu quyết định, nên mọi thứ nhận vào đều bị kiểm lại ở đây (CSDL đã kiểm một lần, kiểm hai lần cho chắc):
     - người gọi phải mang đúng chuỗi bí mật chung (không thì 401, trước khi đọc nội dung),
     - địa chỉ đăng ký phải thuộc dịch vụ đẩy của Google, Mozilla, Apple hoặc Microsoft (chặn gửi tới địa chỉ nội bộ),
     - tiêu đề, nội dung, đường dẫn bị cắt và kiểm dạng. */

type YeuCau = { headers: { get(ten: string): string | null } };

const DICH_VU = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)\/\S*$/;
const MAX_MAY = 50;

/** So sánh hai chuỗi mà thời gian chạy không phụ thuộc vào việc khớp tới ký tự thứ mấy. Chuỗi rỗng thì không bao giờ khớp. */
export function bangNhau(a: string, b: string): boolean {
  if (!a || !b) return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let khac = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) khac |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return khac === 0;
}

export function duocPhep(req: YeuCau, bimat: string): boolean {
  return bangNhau((req.headers.get('x-push-secret') ?? '').trim(), bimat);
}

export function endpointOk(u: unknown): u is string {
  return typeof u === 'string' && u.length <= 1000 && DICH_VU.test(u);
}

export type May = { endpoint: string; p256dh: string; auth: string };

/** Giữ các máy hợp lệ, tối đa MAX_MAY, bỏ trùng địa chỉ. */
export function locMay(raw: unknown): May[] {
  if (!Array.isArray(raw)) return [];
  const thay = new Set<string>(), out: May[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const { endpoint, p256dh, auth } = s as Record<string, unknown>;
    if (!endpointOk(endpoint) || thay.has(endpoint)) continue;
    if (typeof p256dh !== 'string' || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh)) continue;
    if (typeof auth !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(auth)) continue;
    thay.add(endpoint); out.push({ endpoint, p256dh, auth });
    if (out.length >= MAX_MAY) break;
  }
  return out;
}

const cat = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');

/** Nội dung thông báo gửi tới máy khách (chuỗi JSON). Thiếu tiêu đề thì không gửi (trả null). Đường dẫn chỉ nhận dạng #/tên-màn. */
export function taoNoiDung(body: Record<string, unknown>): string | null {
  const title = cat(body.title, 80);
  if (!title) return null;
  const url = typeof body.url === 'string' && /^#\/[A-Za-z0-9/_-]{1,40}$/.test(body.url) ? body.url : '#/home';
  return JSON.stringify({ title, body: cat(body.body, 160), url });
}

/** Mã trạng thái cho biết máy đó không còn nhận được nữa (khách gỡ app, hủy quyền): nên xóa khỏi CSDL. */
export function maBiXoa(status: unknown): boolean {
  return status === 404 || status === 410;
}

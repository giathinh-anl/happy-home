/* ============================================================
   Happy Home — Báo chủ trọ khi có việc mới từ khách (không đụng DOM, có kiểm thử: tests/notify.test.js)

   Vì sao có tệp này: web quản trị chỉ nạp dữ liệu lúc đăng nhập, rồi 2 phút một lần khi tab đang mở. Khách nhắn tin, báo đã chuyển
   khoản, báo hỏng... thì chủ trọ đang để tab ở nền không hề biết. Nay web hỏi máy chủ SỐ việc đang chờ (truy vấn đếm, không tải dữ liệu)
   mỗi 30 giây (tab ở nền: 60 giây); số tăng thì hiện số trên tiêu đề tab, kêu "ting", hiện thông báo của máy tính (nếu chủ trọ bật)
   và tải dữ liệu mới về. Phần chạy trong trình duyệt ở js/notify-ui.js; tệp này chỉ có luật.
   ============================================================ */
(function (root) {
  // Thứ tự = thứ tự ưu tiên khi chọn trang để mở lúc bấm vào thông báo
  const LOAI = [
    { ma: 'tinNhan', quyen: 'tenants', chiChu: true, ten: 'tin nhắn mới từ khách', duong: (bid) => `/b/${bid}/support` },
    { ma: 'xinMa', quyen: 'tenants', chiChu: true, ten: 'khách quên mã, xin cấp lại mã vào app', duong: (bid) => `/b/${bid}/tenants` },
    { ma: 'chuyenKhoan', quyen: 'payments', ten: 'khách báo đã chuyển khoản', duong: () => '/transfers' },
    { ma: 'suCo', quyen: 'incidents', ten: 'sự cố mới', duong: (bid) => `/b/${bid}/incidents` },
    { ma: 'giaHan', quyen: 'contracts', ten: 'khách xin gia hạn', duong: (bid) => `/b/${bid}/contracts` },
    { ma: 'chiSo', quyen: 'readings', ten: 'chỉ số khách tự gửi chờ duyệt', duong: (bid) => `/b/${bid}/readings` },
  ];
  const MA = LOAI.map((l) => l.ma);
  const MAC_DINH = { tieuDe: true, tieng: true, manHinh: false };
  const HIEN = 30000, NEN = 60000, TRAN = 10 * 60000;

  /** Những loại việc người đang dùng được báo: chủ trọ thấy hết; nhân viên chỉ loại thuộc quyền được cấp. Tin nhắn chỉ chủ trọ (máy chủ chỉ cho chủ đọc). */
  function loaiTheoQuyen(o) {
    const chu = !!(o && o.chu), can = (o && typeof o.can === 'function') ? o.can : () => false;
    return LOAI.filter((l) => chu || (!l.chiChu && can(l.quyen))).map((l) => l.ma);
  }

  const soDem = (v) => { const n = Number(v); return v === null || v === undefined || v === '' || !isFinite(n) || n < 0 ? null : Math.floor(n); };
  /** Kết quả đếm từ máy chủ -> { tinNhan, chuyenKhoan, ... } là số nguyên không âm, hoặc null nếu loại đó đếm lỗi / không được xem. */
  function chuanHoa(dem) {
    const d = dem || {}, ra = {};
    MA.forEach((m) => { ra[m] = soDem(d[m]); });
    return ra;
  }
  const tong = (dem) => MA.reduce((s, m) => s + (dem && dem[m] > 0 ? dem[m] : 0), 0);

  /** So hai lần đếm. Chỉ số TĂNG mới là việc mới (giảm là đã xử lý). Lần đếm đầu (truoc = null) không báo gì: việc có sẵn lúc mở web không phải việc mới.
      Trả { moi: { loại: số tăng }, tongMoi, coMoi }. */
  function soSanh(truoc, sau) {
    const moi = {}; let tongMoi = 0;
    if (truoc && sau) MA.forEach((m) => {
      const a = truoc[m], b = sau[m];
      if (a == null || b == null || !(b > a)) return;
      moi[m] = b - a; tongMoi += b - a;
    });
    return { moi, tongMoi, coMoi: tongMoi > 0 };
  }

  /** Câu báo: "2 tin nhắn mới từ khách · 1 khách báo đã chuyển khoản". */
  function noiDung(moi) {
    return LOAI.filter((l) => moi && moi[l.ma] > 0).map((l) => moi[l.ma] + ' ' + l.ten).join(' · ');
  }
  /** Trang mở khi bấm vào thông báo: loại ưu tiên cao nhất có việc mới. bid = tòa đang xem (hoặc tòa đầu). */
  function duongDen(moi, bid) {
    const l = LOAI.find((x) => moi && moi[x.ma] > 0);
    if (!l) return '/dashboard';
    return bid ? l.duong(encodeURIComponent(bid)) : (l.ma === 'chuyenKhoan' ? '/transfers' : '/dashboard');
  }

  /** Tiêu đề tab: "(3) Happy Home — ..." ; 0 việc thì bỏ số. Gỡ số cũ nếu tiêu đề gốc đã có sẵn. */
  function tieuDe(goc, n) {
    const sach = String(goc || '').replace(/^\(\d+\+?\)\s*/, '');
    const k = Math.floor(Number(n) || 0);
    return k > 0 ? `(${k > 99 ? '99+' : k}) ${sach}` : sach;
  }

  /** Chờ bao lâu tới lần hỏi kế: tab đang xem 30 giây, tab ở nền 60 giây; lỗi liên tiếp thì giãn gấp đôi mỗi lần, tối đa 10 phút. */
  function khoangCho(dangXem, loiLienTiep) {
    const goc = dangXem ? HIEN : NEN, l = Math.max(0, Math.min(10, Math.floor(Number(loiLienTiep) || 0)));
    return Math.min(TRAN, goc * Math.pow(2, l));
  }

  /** Cài đặt đã lưu (có thể hỏng / thiếu) -> { tieuDe, tieng, manHinh } đều là true/false. */
  function caiDat(p) {
    const x = p && typeof p === 'object' ? p : {}, ra = {};
    Object.keys(MAC_DINH).forEach((k) => { ra[k] = typeof x[k] === 'boolean' ? x[k] : MAC_DINH[k]; });
    return ra;
  }

  /* ---------- Thông báo đẩy kể cả khi đã đóng web (supabase/migration-owner-push.sql, dùng chung hàm push-send của app khách) ----------
     Nên hiện gì ở Cài đặt chung. o = { chu, coMayChu, coKhoa, coSW, coPush, coThongBao, quyen, daBat, ios, daCai }.
     'an' = không hiện (không phải chủ trọ, chưa nối máy chủ, chưa có khóa VAPID), 'khong-ho-tro', 'can-cai' (iPhone phải thêm web vào
     màn hình chính trước, Apple chỉ cho trang đã cài nhận thông báo), 'bi-chan', 'dang-bat', 'chua-bat'. */
  function cheDoDay(o) {
    const x = o || {};
    if (!x.chu || !x.coMayChu || !x.coKhoa) return 'an';
    if (!(x.coSW && x.coPush && x.coThongBao)) return x.ios && !x.daCai ? 'can-cai' : 'khong-ho-tro';
    if (x.quyen === 'denied') return 'bi-chan';
    return x.daBat ? 'dang-bat' : 'chua-bat';
  }
  /** Khóa VAPID công khai (base64 an toàn cho URL) -> mảng byte cho pushManager.subscribe. */
  function khoaThanhByte(b64) {
    const s = String(b64 || '').replace(/-/g, '+').replace(/_/g, '/');
    const raw = (typeof atob === 'function' ? atob : (v) => Buffer.from(v, 'base64').toString('binary'))(s + '='.repeat((4 - (s.length % 4)) % 4));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  /** Đường dẫn trong thông báo ("#/b/b1/support") -> đường cho HH.router.go ("/b/b1/support"). Dạng lạ thì về Tổng quan. */
  function duongTuThongBao(h) {
    const s = String(h || '');
    return /^#\/[A-Za-z0-9/_-]{1,40}$/.test(s) ? s.slice(1) : '/dashboard';
  }

  const api = { LOAI, MA, MAC_DINH, loaiTheoQuyen, chuanHoa, tong, soSanh, noiDung, duongDen, tieuDe, khoangCho, caiDat, cheDoDay, khoaThanhByte, duongTuThongBao };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.baoViec = api; }
})(typeof window !== 'undefined' ? window : globalThis);

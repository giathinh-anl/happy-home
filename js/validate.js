/* ============================================================
   Happy Home — Luật kiểm tra dữ liệu nhập

   Thuần, không đụng DOM, nên chạy kiểm thử được bằng node (tests/validate.test.js).
   Mỗi luật trả về '' khi hợp lệ, hoặc một câu báo lỗi tiếng Việt nói rõ phải sửa gì.
   Biểu mẫu gắn luật vào ô nhập bằng HH.ui.formRules (js/components.js).

   Vì sao có tệp riêng: trước đây chỉ trang Khách thuê có kiểm tra, các biểu mẫu khác
   chỉ chặn "để trống". U.parseNum bỏ hết ký tự lạ nên "-5" thành 5 và "1,5" thành 15,
   sai tiền mà không báo gì; luật ở đây đọc chuỗi thô nên bắt được.
   ============================================================ */
(function (root) {
  const dem = (v) => String(v == null ? '' : v);

  /** Ngày dd/mm/yyyy có thật không (chặn 31/02, 45/13...). Trả Date hoặc null. */
  function ngayDMY(s) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dem(s).trim());
    if (!m) return null;
    const d = +m[1], th = +m[2], n = +m[3];
    const dt = new Date(n, th - 1, d);
    return (dt.getDate() === d && dt.getMonth() === th - 1 && dt.getFullYear() === n) ? dt : null;
  }

  /** Ngày yyyy-mm-dd (ô type=date) có thật không. Trả Date giờ địa phương hoặc null. */
  function ngayISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dem(s).trim());
    if (!m) return null;
    const n = +m[1], th = +m[2], d = +m[3];
    const dt = new Date(n, th - 1, d);
    return (dt.getDate() === d && dt.getMonth() === th - 1 && dt.getFullYear() === n) ? dt : null;
  }

  /** Cả hai dạng dd/mm/yyyy và yyyy-mm-dd */
  const ngay = (s) => ngayISO(s) || ngayDMY(s);
  const homNay0 = (homNay) => { const t = homNay ? new Date(homNay) : new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

  /** Số điện thoại về dạng 0xxxxxxxxx: bỏ khoảng trắng, dấu chấm, gạch; +84 / 84 đổi thành 0 */
  function chuanSdt(v) {
    let s = dem(v).replace(/[\s.\-()]/g, '');
    if (/^\+84\d{9}$/.test(s)) s = '0' + s.slice(3);
    else if (/^84\d{9}$/.test(s)) s = '0' + s.slice(2);
    return s;
  }

  /** Đọc tiền từ chuỗi người gõ. Chỉ nhận chữ số, dấu chấm/phẩy/khoảng trắng phân nhóm nghìn.
      Có chữ cái, dấu trừ, số thập phân... là KHÔNG hợp lệ. Trả số hoặc null. */
  function docTien(v) {
    const s = dem(v).trim().replace(/\s*₫\s*$|\s*đ\s*$|\s*vnd\s*$/i, '').trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s);
    if (/^\d{1,3}([.,\s]\d{3})+$/.test(s)) return Number(s.replace(/[.,\s]/g, ''));
    return null;
  }

  /** Đọc số thường (diện tích 20,5 hoặc 20.5, chỉ số điện...). Trả số hoặc null. Khác U.parseNum: không bỏ dấu thập phân. */
  function docSo(v) {
    const s = dem(v).trim().replace(/\s/g, '');
    return /^\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : null;
  }

  // Giá thuê hợp lý: chặn gõ nhầm thừa/thiếu số 0, cả hai kiểu đều làm sai hóa đơn nhiều tháng
  const GIA_MIN = 100000, GIA_MAX = 500000000, COC_MAX = 1000000000;

  const bat = (v, ten) => (dem(v).trim() ? '' : `Chưa nhập ${ten}`);

  function hoTen(v) {
    const s = dem(v).trim();
    if (s.split(/\s+/).length < 2) return 'Nhập đủ họ và tên';
    if (/\d/.test(s)) return 'Họ tên không có chữ số';
    return '';
  }
  function sdt(v) {
    return /^0\d{9}$/.test(chuanSdt(v)) ? '' : 'Số di động 10 chữ số, bắt đầu bằng 0';
  }
  function cccd(v) {
    const s = dem(v).replace(/[\s.]/g, '');
    return /^(\d{9}|\d{12})$/.test(s) ? '' : 'CCCD có 12 số, CMND cũ có 9 số';
  }
  function email(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dem(v).trim()) ? '' : 'Email chưa đúng dạng, ví dụ ten@gmail.com';
  }

  /** Biển số về dạng so sánh được: in hoa, bỏ khoảng trắng / dấu chấm / gạch */
  const chuanBienSo = (v) => dem(v).toUpperCase().replace(/[\s.\-]/g, '');

  /** Biển số xe máy / ô tô Việt Nam: 59X1-123.45, 51F-123.45, 29A-12345 (bỏ qua khoảng trắng, dấu chấm, gạch) */
  function bienSo(v) {
    const s = chuanBienSo(v);
    return /^\d{2}[A-ZĐ]{1,2}\d?\d{4,5}$/.test(s) ? '' : 'Biển số chưa đúng, ví dụ 59X1-123.45';
  }

  /** Số tiền (₫). opt: { ten, min = 0, max, batBuoc = true } */
  function tien(v, opt) {
    const o = opt || {}, ten = o.ten || 'Số tiền', min = o.min == null ? 0 : o.min;
    if (!dem(v).trim()) return o.batBuoc === false ? '' : `Chưa nhập ${ten}`;
    const n = docTien(v);
    if (n == null) return `${ten} chỉ gồm chữ số, ví dụ 1.500.000`;
    if (n < min) return min > 0 ? `${ten} tối thiểu ${new Intl.NumberFormat('vi-VN').format(min)} ₫` : `${ten} không được âm`;
    if (o.max != null && n > o.max) return `${ten} tối đa ${new Intl.NumberFormat('vi-VN').format(o.max)} ₫`;
    return '';
  }

  /** Số thường (kWh, diện tích, số người...). opt: { ten, min, max, nguyen, batBuoc = true } */
  function so(v, opt) {
    const o = opt || {}, ten = o.ten || 'Giá trị';
    const s = dem(v).trim().replace(/\s/g, '');
    if (!s) return o.batBuoc === false ? '' : `Chưa nhập ${ten}`;
    if (!/^\d+([.,]\d+)?$/.test(s)) return `${ten} phải là số không âm`;
    const n = Number(s.replace(',', '.'));
    if (o.nguyen && !Number.isInteger(n)) return `${ten} phải là số nguyên`;
    if (o.min != null && n < o.min) return `${ten} tối thiểu ${o.min}`;
    if (o.max != null && n > o.max) return `${ten} tối đa ${o.max}`;
    return '';
  }

  /** Ngày nhập tay hoặc từ ô type=date. opt: { ten, namMin (mặc định 2000; ngày sinh dùng 1900), khongTuongLai, khongTruoc (Date), khongSau (Date), homNay } */
  function ngayHopLe(v, opt) {
    const o = opt || {}, ten = o.ten || 'Ngày';
    if (!dem(v).trim()) return `Chưa nhập ${ten}`;
    const d = ngay(v);
    if (!d) return `${ten} nhập dạng dd/mm/yyyy, và phải là ngày có thật`;
    if (d.getFullYear() < (o.namMin || 2000)) return `${ten} không hợp lý`;
    if (o.khongTuongLai && d > homNay0(o.homNay)) return `${ten} không thể ở tương lai`;
    if (o.khongTruoc && d < o.khongTruoc) return `${ten} không thể trước ${dmy(o.khongTruoc)}`;
    if (o.khongSau && d > o.khongSau) return `${ten} không thể sau ${dmy(o.khongSau)}`;
    return '';
  }
  const dmy = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

  /** Khoảng ngày: ngày kết thúc phải sau ngày bắt đầu */
  function khoangNgay(tu, den, opt) {
    const a = ngay(tu), b = ngay(den), o = opt || {};
    if (!a || !b) return '';
    if (b <= a) return `${o.tenDen || 'Ngày kết thúc'} phải sau ${(o.tenTu || 'ngày bắt đầu').toLowerCase()}`;
    return '';
  }

  const api = { GIA_MIN, GIA_MAX, COC_MAX, ngayDMY, ngayISO, ngay, chuanSdt, chuanBienSo, docTien, docSo, bat, hoTen, sdt, cccd, email, bienSo, tien, so, ngayHopLe, khoangNgay, dmy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.validate = api; }
})(typeof window !== 'undefined' ? window : globalThis);

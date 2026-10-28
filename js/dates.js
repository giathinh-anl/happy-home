/* ============================================================
   Happy Home — Ngày theo LỊCH (không đụng DOM, có kiểm thử: tests/dates.test.js)

   Vì sao có tệp này: cột `date` của Postgres chỉ nhận "năm-tháng-ngày". Trình duyệt ở múi giờ + 7 đổi nửa đêm
   địa phương (1/10 00:00) thành chuỗi UTC "2026-09-30T17:00:00.000Z", Postgres cắt lấy "2026-09-30" → mọi hạn
   đóng tiền và đầu kỳ hóa đơn lưu sớm một ngày. Quy ước ở đây: ngày là một ngày LỊCH, không phải một thời điểm.

   - chuoiNgay(x)   -> 'YYYY-MM-DD' theo lịch địa phương (chuỗi đã là ngày thì giữ nguyên)
   - phanTich(x)    -> Date nửa đêm địa phương của ngày đó (đọc 'YYYY-MM-DD' đúng ngày, không lệch theo múi giờ)
   - soNgayLich(x)  -> số thứ tự ngày (trừ nhau ra số ngày chênh, không bị nửa ngày làm tròn sai)
   - chenhNgay(a,b) -> b - a tính theo ngày lịch
   ============================================================ */
(function (root) {
  const NGAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const LA_NGAY = /^\d{4}-\d{2}-\d{2}$/;

  function phanTich(x) {
    if (x == null) return null;                    // new Date(null) là năm 1970, không phải "không có ngày"
    let d;
    if (typeof x === 'string' && LA_NGAY.test(x)) {
      const [y, m, dd] = x.split('-').map(Number);
      d = new Date(y, m - 1, dd);
    } else d = (x instanceof Date) ? new Date(x.getTime()) : new Date(x);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function chuoiNgay(x) {
    const d = phanTich(x);
    return d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : null;
  }

  function soNgayLich(x) {
    const d = phanTich(x);
    return d ? Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / NGAY_MS) : null;
  }

  function chenhNgay(a, b) {
    const x = soNgayLich(a), y = soNgayLich(b);
    return (x == null || y == null) ? NaN : y - x;
  }

  const api = { chuoiNgay, phanTich, soNgayLich, chenhNgay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.dates = api; }
})(typeof window !== 'undefined' ? window : globalThis);

/* ============================================================
   Happy Home — Sinh nhật của khách thuê (cho giao diện sinh nhật ở app khách)

   Thuần, không đụng DOM (tests/birthday.test.js). Hình và hiệu ứng vẽ ở tenant-app/js/season-ui.js, luật chọn bộ giao diện ở js/seasons.js.

   - Ngày tính theo GIỜ VIỆT NAM (UTC+7), không theo múi giờ của máy: sang ngày mới là đổi đúng nửa đêm Việt Nam.
   - Ngày sinh trong hồ sơ có hai dạng: dd/mm/yyyy (nhập tay, đọc CCCD, khách tự khai) và yyyy-mm-dd (dữ liệu cũ).
     Cả hai đều đọc được; ngày không có thật (31/02) hay hỏng thì bỏ qua, không bao giờ làm sập trang.
   - Sinh ngày 29/2: năm không nhuận thì mừng ngày 28/2.
   - Chỉ dùng NGÀY và THÁNG sinh. Không bao giờ tính hay hiện tuổi.
   ============================================================ */
(function (root) {
  'use strict';
  const TZ = 7;
  const MS_NGAY = 86400000;

  const pad = (n) => String(n).padStart(2, '0');
  const laNamNhuan = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const ngayTrongThang = (m, y) => [31, laNamNhuan(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

  /** Hôm nay (hoặc thời điểm t: số mili-giây hoặc Date) theo giờ Việt Nam: { d, m, y } */
  function homNay(t) {
    const ms = t == null ? Date.now() : (t instanceof Date ? t.getTime() : Number(t));
    const x = new Date(ms + TZ * 3600000);
    return { d: x.getUTCDate(), m: x.getUTCMonth() + 1, y: x.getUTCFullYear() };
  }
  /** Khóa ngày dạng yyyy-mm-dd theo giờ Việt Nam */
  const khoaNgay = (t) => { const n = homNay(t); return n.y + '-' + pad(n.m) + '-' + pad(n.d); };

  /** Đọc ngày sinh: { d, m, y } hoặc null nếu không đọc được hoặc không phải ngày có thật */
  function phanTich(dob) {
    if (dob == null) return null;
    const s = String(dob).trim();
    let r, d, m, y;
    if ((r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) { d = +r[1]; m = +r[2]; y = +r[3]; }
    else if ((r = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(s))) { y = +r[1]; m = +r[2]; d = +r[3]; }
    else return null;
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > ngayTrongThang(m, y)) return null;
    return { d, m, y };
  }

  /** Ngày mừng sinh nhật trong năm y. Sinh ngày 29/2 mà năm y không nhuận thì mừng 28/2. */
  function ngayMung(dm, y) { return dm.d === 29 && dm.m === 2 && !laNamNhuan(y) ? { d: 28, m: 2, y } : { d: dm.d, m: dm.m, y }; }
  const soNgay = (n) => Math.round(Date.UTC(n.y, n.m - 1, n.d) / MS_NGAY);

  /** Sinh nhật kế tiếp (tính cả hôm nay): { soNgay (0 = hôm nay), mung: { d, m, y } } hoặc null nếu ngày sinh không đọc được */
  function tiepTheo(dob, t) {
    const dm = phanTich(dob);
    if (!dm) return null;
    const hn = homNay(t);
    let mung = ngayMung(dm, hn.y), n = soNgay(mung) - soNgay(hn);
    if (n < 0) { mung = ngayMung(dm, hn.y + 1); n = soNgay(mung) - soNgay(hn); }
    return { soNgay: n, mung };
  }
  /** Còn mấy ngày tới sinh nhật (0 = hôm nay); null nếu ngày sinh không đọc được */
  function soNgayDen(dob, t) { const x = tiepTheo(dob, t); return x ? x.soNgay : null; }
  /** Hôm nay có phải sinh nhật không */
  const laHomNay = (dob, t) => soNgayDen(dob, t) === 0;

  /** Tên để gọi: chữ cuối của họ tên ("Nguyễn Văn An" -> "An") */
  const tenGoi = (ten) => String(ten == null ? '' : ten).trim().split(/\s+/).slice(-1)[0] || '';

  /** Lời chúc hiện trong app khách: { tieuDe, noiDung } */
  function loiChucApp(ten) {
    const t = String(ten || '').trim() || 'bạn';
    return { tieuDe: 'Hôm nay là sinh nhật của bạn', noiDung: 'Happy Home chúc ' + t + ' một tuổi mới thật nhiều sức khỏe, bình an và niềm vui. Cảm ơn bạn đã ở cùng Happy Home.' };
  }

  const api = { TZ, laNamNhuan, homNay, khoaNgay, phanTich, ngayMung, tiepTheo, soNgayDen, laHomNay, tenGoi, loiChucApp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.birthday = api; }
})(typeof window !== 'undefined' ? window : globalThis);

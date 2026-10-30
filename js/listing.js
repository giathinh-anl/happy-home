/* ============================================================
   Happy Home — Trang công khai giới thiệu phòng trống (không đụng DOM, có kiểm thử: tests/listing.test.js)

   Chủ trọ bật "Link giới thiệu công khai" cho một phòng thì có một link dạng  .../phong/#<mã>  gửi cho người cần thuê (Zalo, Facebook, mã QR dán
   trước nhà). Mã là chuỗi ngẫu nhiên khó đoán. Trang chỉ hiện đúng những gì chủ trọ đã nhập để đăng tin: số phòng, giá, diện tích, mô tả, ảnh,
   địa chỉ và số liên hệ của tòa nhà. KHÔNG có tên khách, công nợ, hợp đồng (hàm máy chủ public_room chỉ trả đúng các trường đó).

   Tệp này dùng chung cho trang công khai (phong/) và phần của chủ trọ (hộp thoại phòng).
   ============================================================ */
(function (root) {
  const KY_TU = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const DO_DAI_MA = 16;
  const TOI_DA_ANH = 5;
  const TOI_DA_KY_TU_ANH = 700000;          // một ảnh nặng hơn thế (chuỗi base64) thì bỏ, để trang không nặng quá trên 4G

  const SLUG = /^[a-z0-9]{12,40}$/;
  const slugHopLe = (s) => typeof s === 'string' && SLUG.test(s);

  /** Mã ngẫu nhiên 16 ký tự a-z0-9. rngBytes(n) trả mảng n byte ngẫu nhiên (mặc định: crypto của trình duyệt / node). Bỏ byte lệch để mọi ký tự đều xác suất như nhau. */
  function taoMa(rngBytes) {
    const lay = rngBytes || ((n) => {
      const c = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : require('crypto').webcrypto;
      return c.getRandomValues(new Uint8Array(n));
    });
    const gioiHan = 256 - (256 % KY_TU.length);          // 252: byte từ 252 trở lên bị bỏ (không thì ký tự đầu bảng xuất hiện nhiều hơn)
    let ma = '';
    while (ma.length < DO_DAI_MA) {
      const bs = lay(DO_DAI_MA * 2);
      for (let i = 0; i < bs.length && ma.length < DO_DAI_MA; i++) if (bs[i] < gioiHan) ma += KY_TU[bs[i] % KY_TU.length];
    }
    return ma;
  }

  /** Link công khai của một phòng. goc: địa chỉ trang đang mở (location.href) — bỏ phần sau # / ? và tên tệp, thêm phong/#mã */
  function lienKet(goc, ma) {
    if (!slugHopLe(ma)) return '';
    let g = String(goc || '').split('#')[0].split('?')[0];
    g = g.replace(/\/(index\.html)?$/, '').replace(/\/[^/]*\.html$/, '');
    return g + '/phong/#' + ma;
  }

  /** Số di động Việt Nam về dạng 0xxxxxxxxx (nhận +84, 84, khoảng trắng, chấm, gạch, ngoặc); không hợp lệ thì null */
  function chuanSdt(v) {
    let s = String(v == null ? '' : v).replace(/[\s.\-()]/g, '');
    if (/^\+84\d{9}$/.test(s)) s = '0' + s.slice(3);
    else if (/^84\d{9}$/.test(s)) s = '0' + s.slice(2);
    return /^0\d{9}$/.test(s) ? s : null;
  }
  const linkGoi = (v) => { const s = chuanSdt(v); return s ? 'tel:' + s : null; };
  const linkZalo = (v) => { const s = chuanSdt(v); return s ? 'https://zalo.me/' + s : null; };
  /** Số hiển thị dễ đọc: 0901 234 567 */
  const sdtDep = (v) => { const s = chuanSdt(v); return s ? s.slice(0, 4) + ' ' + s.slice(4, 7) + ' ' + s.slice(7) : ''; };

  const linkBanDo = (diaChi) => String(diaChi || '').trim() ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(String(diaChi).trim()) : null;

  /** Chỉ giữ ảnh đúng là ảnh nhúng (data:image/jpeg|png|webp;base64) và không quá nặng, tối đa 5 ảnh. Chặn mọi địa chỉ khác (javascript:, http:...) */
  function anhHopLe(ds) {
    return (Array.isArray(ds) ? ds : []).filter((p) => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) && p.length <= TOI_DA_KY_TU_ANH).slice(0, TOI_DA_ANH);
  }

  /** Trạng thái phòng nói với người ngoài: chỉ 3 loại, không lộ chi tiết (đang ở, sắp trả phòng...) */
  function trangThai(status) {
    if (status === 'vacant') return { ma: 'trong', nhan: 'Còn trống', conTrong: true };
    if (status === 'reserved') return { ma: 'da-coc', nhan: 'Đã có người đặt cọc', conTrong: false };
    return { ma: 'da-thue', nhan: 'Đã có người thuê', conTrong: false };
  }

  /** Giá hiển thị: 3.500.000 ₫/tháng (giá 0 hoặc thiếu thì "Liên hệ để biết giá") */
  function giaChu(gia, dinhDang) {
    const n = Number(gia);
    if (!Number.isFinite(n) || n <= 0) return 'Liên hệ để biết giá';
    return (dinhDang ? dinhDang(n) : new Intl.NumberFormat('vi-VN').format(n) + ' ₫') + '/tháng';
  }

  /** Các dòng thông tin ngắn: diện tích, tầng, số người tối đa (bỏ dòng không có số liệu) */
  function dongThongTin(p) {
    const x = p || {}, ds = [];
    const dem = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
    const dt = dem(x.area), nguoi = dem(x.maxOccupants), tang = x.floor === 0 || x.floor === '0' ? 0 : dem(x.floor);
    if (dt) ds.push({ nhan: 'Diện tích', gia: String(dt).replace('.', ',') + ' m²' });
    if (tang !== null) ds.push({ nhan: 'Tầng', gia: tang === 0 ? 'Trệt' : String(tang) });
    if (nguoi) ds.push({ nhan: 'Tối đa', gia: nguoi + ' người' });
    return ds;
  }

  const tieuDe = (p, b) => `Phòng ${p && p.code ? p.code : ''}${b && b.name ? ' · ' + b.name : ''}`.trim();

  /** Tin chia sẻ nhanh (Zalo, Facebook) kèm link */
  function tinChiaSe(p, b, link, dinhDang) {
    const x = p || {}, tt = trangThai(x.status);
    const dong = [`${tieuDe(x, b)}${tt.conTrong ? ' đang cho thuê' : ''}`, giaChu(x.price, dinhDang)];
    const dt = dongThongTin(x).map((d) => `${d.nhan} ${d.gia}`).join(', ');
    if (dt) dong.push(dt);
    if (b && b.address) dong.push('Địa chỉ: ' + b.address);
    dong.push('Xem ảnh và liên hệ: ' + link);
    return dong.join('\n');
  }

  const api = { taoMa, slugHopLe, lienKet, chuanSdt, linkGoi, linkZalo, sdtDep, linkBanDo, anhHopLe, trangThai, giaChu, dongThongTin, tieuDe, tinChiaSe, DO_DAI_MA, TOI_DA_ANH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.listing = api; }
})(typeof window !== 'undefined' ? window : globalThis);

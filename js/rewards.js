/* ============================================================
   Happy Home — Điểm thưởng cho khách đóng tiền đúng hạn (không đụng DOM, có kiểm thử: tests/rewards.test.js)

   Khác với "điểm thanh toán" (js/scoring.js) là thước đo để CHỦ TRỌ biết ai hay trễ, đây là chương trình THƯỞNG cho khách:
     - mỗi hóa đơn đóng đủ đúng hạn (hoặc trước hạn) được `diemMoiHoaDon` điểm;
     - đóng đúng hạn `chuoi` tháng liền thì thưởng thêm `thuongChuoi` điểm (lặp lại ở mỗi bội số: 3, 6, 9... tháng);
     - đóng trễ hoặc quá hạn chưa trả đủ thì chuỗi về 0 (điểm đã có vẫn giữ);
     - đổi điểm thành tiền giảm vào MỘT hóa đơn chưa thu: `tiLeDoi` ₫ cho mỗi điểm, theo bậc `buocDoi` điểm, tối đa `tran` (tỉ lệ)
       của số còn phải thu của hóa đơn đó.
   Điểm KHÔNG lưu riêng: tính lại từ hóa đơn + phiếu thu mỗi lần (nên không bao giờ lệch), trừ đi điểm đã đổi. Điểm đã đổi nằm ngay trên
   hóa đơn được giảm (một dòng loại 'reward' mang số điểm), hủy hóa đơn đó thì điểm tự trả lại.
   Mặc định TẮT; chỉ tính từ các hóa đơn có hạn từ `tuNgay` trở đi (bật hôm nay thì không tặng ngược điểm cho quá khứ).
   ============================================================ */
(function (root) {
  const NGAY_MS = 86400000;
  const MAC_DINH = Object.freeze({ bat: false, diemMoiHoaDon: 10, chuoi: 3, thuongChuoi: 20, tiLeDoi: 1000, buocDoi: 100, tran: 0.5, tuNgay: null });

  const laNguyen = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v));
  const laNgay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime())
    && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const soNgay = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / NGAY_MS);
  const tuSoNgay = (n) => new Date(n * NGAY_MS).toISOString().slice(0, 10);

  /** Cấu hình đầy đủ: giá trị thiếu hoặc hỏng thì lấy mặc định (cấu hình lưu trong DB có thể thiếu trường hoặc bị sửa tay) */
  function chuanHoa(c) {
    const x = c && typeof c === 'object' ? c : {};
    const so = (k, tu, den, nguyen) => { const v = Number(x[k]); return Number.isFinite(v) && v >= tu && v <= den && (!nguyen || Number.isInteger(v)) && x[k] !== '' && x[k] !== null ? v : MAC_DINH[k]; };
    return { bat: x.bat === true, diemMoiHoaDon: so('diemMoiHoaDon', 1, 1000, true), chuoi: so('chuoi', 2, 12, true), thuongChuoi: so('thuongChuoi', 0, 1000, true),
      tiLeDoi: so('tiLeDoi', 100, 100000, true), buocDoi: so('buocDoi', 1, 10000, true), tran: so('tran', 0.1, 1, false), tuNgay: laNgay(x.tuNgay) ? x.tuNgay : null };
  }

  /** Kiểm cấu hình người nhập. Trả '' nếu ổn, hoặc câu báo lỗi đầu tiên */
  function kiemCauHinh(c) {
    const x = Object.assign({}, MAC_DINH, c || {});
    const khoang = (k, tu, den, nguyen) => { const v = Number(x[k]); return x[k] !== '' && x[k] !== null && Number.isFinite(v) && v >= tu && v <= den && (!nguyen || Number.isInteger(v)); };
    if (!khoang('diemMoiHoaDon', 1, 1000, true)) return 'Điểm mỗi hóa đơn là số nguyên từ 1 đến 1.000';
    if (!khoang('chuoi', 2, 12, true)) return 'Chuỗi thưởng từ 2 đến 12 tháng liền';
    if (!khoang('thuongChuoi', 0, 1000, true)) return 'Điểm thưởng chuỗi là số nguyên từ 0 đến 1.000';
    if (!khoang('tiLeDoi', 100, 100000, true)) return 'Mỗi điểm đổi được từ 100 đến 100.000 ₫';
    if (!khoang('buocDoi', 1, 10000, true)) return 'Bậc đổi điểm là số nguyên từ 1 đến 10.000';
    if (!khoang('tran', 0.1, 1, false)) return 'Mỗi hóa đơn đổi tối đa từ 10% đến 100% số còn phải thu';
    if (x.tuNgay !== null && x.tuNgay !== '' && x.tuNgay !== undefined && !laNgay(x.tuNgay)) return 'Ngày bắt đầu tính điểm không đúng';
    return '';
  }

  /**
   * Điểm của một hợp đồng. o: { chiTiet (HH.scoring.tinh(...).chiTiet), cauHinh, daDoi (tổng điểm đã đổi) }
   * Trả { tong, daDoi, soDu, soKyDungHan, chuoiHienTai, conThieu (còn mấy tháng đúng hạn nữa thì được thưởng chuỗi), soLanThuongChuoi, thieu, sach }
   * sach: từng khoản cộng điểm, cũ trước: { id, loai:'dung-han'|'chuoi', diem, ngay, soThang? }
   */
  function tinhDiem(o) {
    const x = o || {}, cfg = chuanHoa(x.cauHinh), tu = cfg.tuNgay ? soNgay(cfg.tuNgay) : null;
    // chỉ những hóa đơn đã biết kết quả: đúng hạn / trả trễ / quá hạn. Chưa tới hạn hoặc không rõ ngày trả thì chưa tính (không đoán)
    const ds = (x.chiTiet || []).filter((c) => c && (c.loai === 'dung-han' || c.loai === 'tra-tre' || c.loai === 'qua-han') && Number.isFinite(c.han) && (tu === null || c.han >= tu))
      .sort((a, b) => a.han - b.han);
    let chuoi = 0, tong = 0, soKy = 0, soThuong = 0;
    const sach = [];
    ds.forEach((c) => {
      if (c.loai !== 'dung-han') { chuoi = 0; return; }
      chuoi++; soKy++; tong += cfg.diemMoiHoaDon;
      sach.push({ id: c.id, loai: 'dung-han', diem: cfg.diemMoiHoaDon, ngay: tuSoNgay(c.han) });
      if (cfg.thuongChuoi > 0 && chuoi % cfg.chuoi === 0) {
        tong += cfg.thuongChuoi; soThuong++;
        sach.push({ id: c.id, loai: 'chuoi', diem: cfg.thuongChuoi, ngay: tuSoNgay(c.han), soThang: chuoi });
      }
    });
    const daDoi = Math.max(0, Number(x.daDoi) || 0);
    return { tong, daDoi, soDu: Math.max(0, tong - daDoi), thieu: Math.max(0, daDoi - tong), soKyDungHan: soKy, chuoiHienTai: chuoi,
      conThieu: cfg.chuoi - (chuoi % cfg.chuoi), soLanThuongChuoi: soThuong, sach };
  }

  /** Tổng điểm đã đổi trên các hóa đơn (dòng loại 'reward'); hóa đơn đã hủy thì điểm được trả lại */
  function diemDaDoi(hoaDon) {
    let t = 0;
    (hoaDon || []).forEach((i) => {
      if (!i || i.status === 'cancelled' || !Array.isArray(i.lines)) return;
      i.lines.forEach((l) => { if (l && l.type === 'reward') t += Math.max(0, Number(l.points) || 0); });
    });
    return t;
  }

  /** Nhiều nhất đổi được bao nhiêu điểm vào một hóa đơn còn phải thu `conPhaiThu` (đã làm tròn xuống theo bậc đổi) */
  function toiDaDoi(o) {
    const x = o || {}, cfg = chuanHoa(x.cauHinh);
    const tranTien = Math.floor(Math.max(0, Number(x.conPhaiThu) || 0) * cfg.tran);
    const diem = Math.min(Math.max(0, Number(x.soDu) || 0), Math.floor(tranTien / cfg.tiLeDoi));
    return Math.floor(diem / cfg.buocDoi) * cfg.buocDoi;
  }

  /**
   * Đổi điểm thành giảm giá. o: { soDu, diem, cauHinh, conPhaiThu, fmt: { tien(n) } }
   * Trả { ok:true, diem, tien, dong } (dong = dòng thêm vào hóa đơn) hoặc { ok:false, loi, toiDa? }
   */
  function doiDiem(o) {
    const x = o || {}, cfg = chuanHoa(x.cauHinh), f = x.fmt && x.fmt.tien ? x.fmt.tien : (n) => String(n);
    if (!cfg.bat) return { ok: false, loi: 'Chương trình điểm thưởng đang tắt' };
    if (!laNguyen(x.diem) || Number(x.diem) <= 0) return { ok: false, loi: 'Nhập số điểm muốn đổi' };
    const diem = Number(x.diem), soDu = Math.max(0, Number(x.soDu) || 0);
    if (diem % cfg.buocDoi !== 0) return { ok: false, loi: `Điểm đổi theo bậc ${cfg.buocDoi}` };
    if (diem > soDu) return { ok: false, loi: soDu > 0 ? `Chỉ còn ${soDu} điểm` : 'Chưa có điểm để đổi' };
    const toiDa = toiDaDoi({ soDu, conPhaiThu: x.conPhaiThu, cauHinh: cfg });
    if (toiDa < cfg.buocDoi) return { ok: false, loi: 'Hóa đơn này còn quá ít để đổi điểm', toiDa: 0 };
    if (diem > toiDa) return { ok: false, loi: `Hóa đơn này đổi tối đa ${toiDa} điểm (${Math.round(cfg.tran * 100)}% số còn phải thu)`, toiDa };
    const tien = diem * cfg.tiLeDoi;
    return { ok: true, diem, tien, dong: { label: `Thưởng đóng tiền đúng hạn (${diem} điểm)`, amount: -tien, type: 'reward', points: diem, meta: `Đổi ${diem} điểm × ${f(cfg.tiLeDoi)}` } };
  }

  /** Tin nhắn báo điểm cho khách (chủ trọ copy gửi Zalo / SMS) */
  function soanTin(o) {
    const x = o || {}, cfg = chuanHoa(x.cauHinh), f = x.fmt && x.fmt.tien ? x.fmt.tien : (n) => String(n);
    const ten = String(x.ten || '').trim().split(/\s+/).slice(-1)[0] || 'bạn';
    const nhip = cfg.chuoi;
    let t = `Chào ${ten}, cảm ơn bạn đã đóng tiền phòng${x.phong ? ' ' + x.phong : ''} đúng hạn. Hiện bạn có ${x.soDu || 0} điểm thưởng`;
    t += (x.soDu || 0) >= cfg.buocDoi ? `; mỗi ${cfg.buocDoi} điểm đổi được giảm ${f(cfg.buocDoi * cfg.tiLeDoi)} vào hóa đơn sắp tới, bạn nhắn lại để chủ trọ đổi giúp nhé.`
      : `; đủ ${cfg.buocDoi} điểm là đổi được giảm ${f(cfg.buocDoi * cfg.tiLeDoi)} vào hóa đơn.`;
    if (cfg.thuongChuoi > 0) t += ` Đóng đúng hạn ${nhip} tháng liền còn được thưởng thêm ${cfg.thuongChuoi} điểm.`;
    return t;
  }

  const api = { MAC_DINH, chuanHoa, kiemCauHinh, tinhDiem, diemDaDoi, toiDaDoi, doiDiem, soanTin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.rewards = api; }
})(typeof window !== 'undefined' ? window : globalThis);

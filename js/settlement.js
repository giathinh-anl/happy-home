/* ============================================================
   Happy Home — Tiền tháng lẻ và quyết toán khi trả phòng (không đụng DOM, có kiểm thử: tests/settlement.test.js)

   Vì sao có tệp này: hóa đơn trước đây luôn tính ĐỦ tiền phòng cả tháng (kể cả khách vào giữa tháng, dòng ghi cứng
   "Trọn kỳ, N/N ngày"), còn ở bước trả phòng thì ô "Chỉ số điện chốt" bỏ trống không dùng, tiền kỳ cuối không được tính và
   "phạt trả trước hạn" luôn bằng 0. Mọi phép tính tiền của hai việc đó nằm ở đây để thử được từng ca.

   Quy ước:
   - Ngày là NGÀY LỊCH dạng 'YYYY-MM-DD' (xem js/dates.js); kỳ là 'YYYY-MM'.
   - Ngày vào và ngày ra đều TÍNH vào số ngày ở (ở từ 15 đến 30 của tháng 30 ngày là 16 ngày).
   - Khoản tính theo THÁNG (tiền phòng, nước theo đầu người, dịch vụ cố định) được quy theo số ngày ở khi ở lẻ: tiền x ngày ở / ngày của tháng,
     làm tròn tới nghìn đồng, không bao giờ vượt cả tháng. Điện tính theo chỉ số nên không chia theo ngày.
   ============================================================ */
(function (root) {
  const D = (typeof require === 'function' && typeof module !== 'undefined') ? require('./dates.js') : root.HH.dates;
  const pad = (n) => String(n).padStart(2, '0');
  const LA_KY = /^(\d{4})-(\d{2})$/;

  /** Số ngày của tháng 'YYYY-MM' (28 đến 31), hoặc null nếu kỳ sai. */
  function soNgayThang(ky) {
    const m = LA_KY.exec(String(ky || '')); if (!m) return null;
    const mo = +m[2]; if (mo < 1 || mo > 12) return null;
    return new Date(+m[1], mo, 0).getDate();
  }
  /** Ngày đầu và ngày cuối của kỳ: { dau, cuoi } dạng 'YYYY-MM-DD', hoặc null. */
  function dauCuoiKy(ky) {
    const n = soNgayThang(ky); if (!n) return null;
    return { dau: ky + '-01', cuoi: ky + '-' + pad(n) };
  }
  const lamTronNghin = (x) => Math.round((Number(x) || 0) / 1000) * 1000;

  /** Khách ở những ngày nào trong kỳ.
      batDau = ngày bắt đầu hợp đồng (rỗng = từ đầu kỳ); ketThuc = ngày khách thực sự rời đi (rỗng = chưa rời, ở hết kỳ).
      Trả { tu, den, soNgayO, soNgayThang, tronKy, dauLe, cuoiLe } hoặc null nếu kỳ sai.
      Không ở ngày nào trong kỳ (vào sau kỳ hoặc rời trước kỳ) thì soNgayO = 0. */
  function phanNgayO(ky, batDau, ketThuc) {
    const dk = dauCuoiKy(ky); if (!dk) return null;
    const bd = D.chuoiNgay(batDau), kt = D.chuoiNgay(ketThuc);          // chuỗi 'YYYY-MM-DD' so sánh theo chữ cũng đúng thứ tự ngày
    const tu = bd && bd > dk.dau ? bd : dk.dau;
    const den = kt && kt < dk.cuoi ? kt : dk.cuoi;
    const n = tu > dk.cuoi || den < dk.dau ? 0 : Math.max(0, D.chenhNgay(tu, den) + 1);
    const tong = soNgayThang(ky);
    return { tu, den, soNgayO: Math.min(n, tong), soNgayThang: tong, tronKy: n >= tong && tu === dk.dau && den === dk.cuoi, dauLe: tu > dk.dau, cuoiLe: den < dk.cuoi };
  }

  /** Một khoản tính theo THÁNG, quy theo số ngày ở. Ở trọn kỳ thì giữ nguyên số tiền. */
  function tienTheoNgay(thang, soNgayO, soNgayTrongThang) {
    const t = Math.max(0, Number(thang) || 0);
    if (!soNgayTrongThang || soNgayO >= soNgayTrongThang) return t;
    if (!(soNgayO > 0)) return 0;
    return Math.min(t, lamTronNghin(t * soNgayO / soNgayTrongThang));
  }

  const ddmm = (s) => { const x = String(s || '').split('-'); return x.length === 3 ? (+x[2]) + '/' + (+x[1]) : ''; };
  /** Dòng ghi chú dưới tiền phòng: "Trọn kỳ, 30/30 ngày" hoặc "18/30 ngày (1/11 đến 18/11)". */
  function moTaNgayO(p) {
    if (!p) return '';
    if (p.tronKy) return 'Trọn kỳ, ' + p.soNgayThang + '/' + p.soNgayThang + ' ngày';
    return p.soNgayO + '/' + p.soNgayThang + ' ngày (' + ddmm(p.tu) + ' đến ' + ddmm(p.den) + ')';
  }

  /** Chia tiền cọc cho các khoản phải trừ, theo thứ tự: hóa đơn cũ nhất trước (để hóa đơn được ghi đã trả), rồi bồi thường tài sản, rồi phạt.
      hoaDon: [{ id, conNo }] đã sắp từ cũ tới mới; boiThuong, phat: số tiền.
      Trả { traHoaDon: [{ id, soTien, conLai }], boiThuongTru, phatTru, tongPhaiTru, hoan, conThieu }:
      hoan = cọc còn dư trả lại khách; conThieu = khách còn phải nộp thêm (cọc không đủ). Mọi số là số nguyên không âm. */
  function chiaCoc(coc, hoaDon, boiThuong, phat) {
    let con = Math.max(0, Math.round(Number(coc) || 0));
    const traHoaDon = (hoaDon || []).map((h) => {
      const no = Math.max(0, Math.round(Number(h.conNo) || 0));
      const tra = Math.min(con, no); con -= tra;
      return { id: h.id, soTien: tra, conLai: no - tra };
    });
    const bt = Math.max(0, Math.round(Number(boiThuong) || 0)), ph = Math.max(0, Math.round(Number(phat) || 0));
    const btTru = Math.min(con, bt); con -= btTru;
    const phTru = Math.min(con, ph); con -= phTru;
    const tongNoHoaDon = (hoaDon || []).reduce((s, h) => s + Math.max(0, Math.round(Number(h.conNo) || 0)), 0);
    const tongPhaiTru = tongNoHoaDon + bt + ph;
    const conThieu = traHoaDon.reduce((s, x) => s + x.conLai, 0) + (bt - btTru) + (ph - phTru);
    return { traHoaDon, boiThuongTru: btTru, phatTru: phTru, tongPhaiTru, hoan: con, conThieu };
  }

  /** Gợi ý khoản phạt khi trả trước hạn hợp đồng. Hợp đồng mẫu ghi "báo trước ít nhất 30 ngày; tự ý chấm dứt không báo trước thì Bên A
      có quyền khấu trừ tiền cọc theo thỏa thuận" nên mức phạt do chủ trọ chọn, ở đây chỉ gợi ý.
      Trả { truocHan, soNgayConLai, goiY: [{ ma, nhan, soTien }] }. truocHan = ngày trả sớm hơn ngày hết hạn hợp đồng. */
  function goiYPhat(o) {
    const ngayTra = D.chuoiNgay(o.ngayTra), het = D.chuoiNgay(o.ngayHetHan);
    const conLai = ngayTra && het ? D.chenhNgay(ngayTra, het) : 0;
    const coc = Math.max(0, Math.round(Number(o.tienCoc) || 0)), phong = Math.max(0, Math.round(Number(o.tienPhong) || 0));
    const truocHan = conLai > 0;
    const motThang = Math.min(phong, coc);
    // cọc bằng (hoặc ít hơn) một tháng tiền phòng thì hai mức trùng nhau: chỉ để một nút, khỏi bày hai nút cùng số tiền
    const goiY = truocHan ? [
      { ma: 'khong', nhan: 'Không phạt', soTien: 0 },
      { ma: 'mot-thang', nhan: coc > motThang ? 'Một tháng tiền phòng' : 'Một tháng tiền phòng (bằng cọc)', soTien: motThang },
    ].concat(coc > motThang ? [{ ma: 'mat-coc', nhan: 'Mất cả tiền cọc', soTien: coc }] : []) : [];
    return { truocHan, soNgayConLai: Math.max(0, conLai), goiY };
  }

  /** Kỳ liền trước kỳ cuối có bị bỏ sót hóa đơn không? Chỉ báo khi hợp đồng đã bắt đầu từ trước kỳ đó (hợp đồng nhập từ sổ cũ có thể thiếu hóa đơn xưa).
      hoaDonCuaHopDong: [{ period, status }]. Trả kỳ bị thiếu ('YYYY-MM') hoặc null. */
  function kyTruocChuaLap(kyCuoi, batDau, hoaDonCuaHopDong) {
    const m = LA_KY.exec(String(kyCuoi || '')); if (!m) return null;
    const d = new Date(+m[1], +m[2] - 2, 1), ky = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    const bd = D.chuoiNgay(batDau); if (!bd) return null;
    if (bd > dauCuoiKy(ky).cuoi) return null;                         // hợp đồng bắt đầu sau kỳ đó: không có gì để lập
    const co = (hoaDonCuaHopDong || []).some((i) => i.period === ky && i.status !== 'cancelled');
    return co ? null : ky;
  }

  const api = { soNgayThang, dauCuoiKy, lamTronNghin, phanNgayO, tienTheoNgay, moTaNgayO, chiaCoc, goiYPhat, kyTruocChuaLap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.settlement = api; }
})(typeof window !== 'undefined' ? window : globalThis);

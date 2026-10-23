/* ============================================================
   Happy Home — Nhắc nợ nhiều cấp + phí trễ hạn

   Phần TÍNH TOÁN, không đụng DOM nên chạy kiểm thử được bằng node
   (tests/reminders.test.js). Giao diện nằm ở js/pages/reminders.js.

   BỐN MỨC NHẮC, theo số ngày so với hạn thanh toán:
     sắp đến hạn   còn 0–3 ngày tới hạn
     nhắc nhẹ      quá hạn 1–3 ngày
     quá hạn có phí quá hạn 4–7 ngày
     khẩn          quá hạn từ 8 ngày
   Mỗi mức một giọng văn: từ lịch sự đến nghiêm. Hệ thống KHÔNG tự gửi, chỉ soạn sẵn.

   PHÍ TRỄ HẠN do chủ trọ bật, mặc định TẮT (0 ₫/ngày):
     - miễn phí N ngày đầu sau hạn (mặc định 3 ngày)
     - sau đó tính X ₫ mỗi ngày
     - tổng phí không quá 10% tiền gốc của hóa đơn
     - tính trên TIỀN GỐC, không tính phí chồng lên phí đã áp trước đó
   ============================================================ */
(function (root) {
  const SC = (typeof module !== 'undefined' && module.exports) ? require('./scoring.js') : root.HH.scoring;

  const TRAN_PHAN_TRAM = 0.10;       // phí tối đa = 10% tiền gốc của hóa đơn
  const MIEN_PHI_MAC_DINH = 3;       // ngày
  const NGAY_BAO_TRUOC = 3;          // báo "sắp đến hạn" khi còn từ ngần này ngày trở xuống

  const MUC = [
    { ma: 'sap-han',  ten: 'Sắp đến hạn',          nhan: 'Sắp hạn', bac: 0, tu: -NGAY_BAO_TRUOC, den: 0 },
    { ma: 'nhac-nhe', ten: 'Quá hạn 1–3 ngày',     nhan: 'Nhắc nhẹ', bac: 1, tu: 1, den: 3 },
    { ma: 'nhac-phi', ten: 'Quá hạn 4–7 ngày',     nhan: 'Có phí',   bac: 2, tu: 4, den: 7 },
    { ma: 'khan',     ten: 'Quá hạn trên 7 ngày',  nhan: 'Khẩn',     bac: 3, tu: 8, den: Infinity },
  ];

  const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' ₫';
  const nhanKy = (p) => { const a = String(p || '').split('-'); return a.length === 2 ? 'T' + Number(a[1]) + '/' + a[0] : String(p || ''); };
  const ngayDMY = (x) => {
    const n = SC.ngayLich(x); if (n == null) return '';
    const d = new Date(n * 86400000);
    return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
  };

  const conNo = (inv) => Math.max(0, (inv.total || 0) - (inv.paid || 0));
  const dongPhi = (inv) => (inv.lines || []).filter((l) => l.type === 'latefee');
  const phiDaAp = (inv) => dongPhi(inv).reduce((s, l) => s + (l.amount || 0), 0);
  /** Tiền gốc = tổng hóa đơn trừ các dòng phí trễ hạn đã áp. Phí tính trên số này. */
  const tienGoc = (inv) => (inv.lines && inv.lines.length)
    ? inv.lines.filter((l) => l.type !== 'latefee').reduce((s, l) => s + (l.amount || 0), 0)
    : (inv.total || 0);

  /** Số ngày trễ: dương = đã quá hạn bấy nhiêu ngày; 0 hoặc âm = chưa quá hạn. Theo ngày lịch. */
  function ngayTre(inv, homNay) {
    const han = SC.ngayLich(inv.dueDate), hn = SC.ngayLich(homNay || new Date());
    if (han == null || hn == null) return null;
    return hn - han;
  }

  function mucCua(n) {
    if (n == null) return null;
    return MUC.find((m) => n >= m.tu && n <= m.den) || null;
  }

  const coTheNhac = (inv) => inv && inv.status !== 'cancelled' && inv.status !== 'draft' && conNo(inv) > 0;

  /** Chính sách: { moiNgay: số ₫ mỗi ngày (0 = tắt), mienNgay: số ngày miễn phí } */
  function chinhSach(raw) {
    const so = (v) => (v == null || v === '' ? NaN : Number(v));      // Number(null) = 0 sẽ nuốt mất mặc định
    const moi = so(raw && raw.moiNgay), mien = so(raw && raw.mienNgay);
    return { moiNgay: moi > 0 ? Math.round(moi) : 0, mienNgay: Number.isFinite(mien) && mien >= 0 ? Math.floor(mien) : MIEN_PHI_MAC_DINH };
  }

  /** Phí trễ hạn tạm tính của MỘT hóa đơn tại ngày homNay */
  function tinhPhi(inv, cs, homNay) {
    const p = chinhSach(cs);
    const mo = { phi: 0, ngayTinhPhi: 0, bangTran: false, tran: 0 };
    if (!p.moiNgay || !coTheNhac(inv)) return mo;
    const tre = ngayTre(inv, homNay);
    if (tre == null) return mo;
    const ngayTinh = Math.max(0, tre - p.mienNgay);
    if (ngayTinh <= 0) return mo;
    const tran = Math.floor(tienGoc(inv) * TRAN_PHAN_TRAM);
    const thang = ngayTinh * p.moiNgay;
    return { phi: Math.min(thang, tran), ngayTinhPhi: ngayTinh, bangTran: thang > tran, tran };
  }

  /**
   * Gom các hóa đơn còn nợ theo phòng, mức của phòng = mức nặng nhất trong các hóa đơn.
   * Chỉ trả phòng nào có ít nhất một hóa đơn đã vào diện nhắc (sắp hạn hoặc quá hạn).
   */
  function gomTheoPhong(hoaDon, cs, homNay) {
    const nhom = {};
    (hoaDon || []).forEach((inv) => {
      if (!coTheNhac(inv)) return;
      const n = ngayTre(inv, homNay);
      if (mucCua(n) == null) return;                                 // còn xa hạn: chưa cần nhắc
      const k = inv.buildingId + '|' + inv.roomCode;
      (nhom[k] = nhom[k] || { key: k, buildingId: inv.buildingId, roomCode: inv.roomCode,
        tenantName: inv.tenantName, tenantId: inv.tenantId, hoaDon: [] }).hoaDon.push(inv);
    });
    return Object.values(nhom).map((g) => {
      g.hoaDon.sort((a, b) => String(a.period).localeCompare(String(b.period)));
      const tre = g.hoaDon.map((i) => ngayTre(i, homNay));
      g.ngayTreMax = Math.max(...tre);
      g.muc = mucCua(g.ngayTreMax);
      g.conNo = g.hoaDon.reduce((s, i) => s + conNo(i), 0);
      g.phiDaAp = g.hoaDon.reduce((s, i) => s + phiDaAp(i), 0);
      g.phi = g.hoaDon.reduce((s, i) => s + tinhPhi(i, cs, homNay).phi, 0);
      // nếu đã áp phí rồi thì tiền còn nợ đã chứa phí cũ: thay phí cũ bằng phí mới tính lại
      g.tongCanTra = g.conNo - g.phiDaAp + g.phi;
      return g;
    }).sort((a, b) => (b.muc.bac - a.muc.bac) || (b.conNo - a.conNo));
  }

  /**
   * So mức hiện tại với lần nhắc gần nhất của phòng.
   * lanCuoi = { at, ma } hoặc null.
   */
  function trangThaiNhac(lanCuoi, mucHienTai, homNay) {
    if (!lanCuoi) return { ma: 'chua-nhac', nhan: 'Chưa nhắc', nenNhac: true };
    const cu = MUC.find((m) => m.ma === lanCuoi.ma);
    const ngayNhac = SC.ngayLich(lanCuoi.at), hn = SC.ngayLich(homNay || new Date());
    const cach = ngayNhac == null || hn == null ? null : hn - ngayNhac;
    const khi = cach === 0 ? 'hôm nay' : cach === 1 ? 'hôm qua' : cach != null ? cach + ' ngày trước' : '';
    if (cu && mucHienTai && mucHienTai.bac > cu.bac)
      return { ma: 'len-bac', nhan: `Đã nhắc ${cu.nhan.toLowerCase()} ${khi}, nên nhắc mức cao hơn`, nenNhac: true };
    if (cach === 0) return { ma: 'da-nhac-nay', nhan: `Đã nhắc hôm nay (${cu ? cu.nhan.toLowerCase() : ''})`, nenNhac: false };
    return { ma: 'da-nhac', nhan: `Đã nhắc ${khi}${cu ? ' (' + cu.nhan.toLowerCase() + ')' : ''}`, nenNhac: cach != null && cach >= 2 };
  }

  /**
   * Soạn tin nhắc cho một nhóm phòng.
   * opt = { taiKhoan: { ten, so, chu }, noiDungCK: (inv) => string, chinhSach, homNay }
   */
  function soanTin(g, opt) {
    const o = opt || {};
    const p = chinhSach(o.chinhSach);
    const tk = o.taiKhoan || {};
    const n = g.ngayTreMax;
    const ten = g.tenantName ? ' ' + g.tenantName : '';
    const dong = g.hoaDon.map((i) =>
      `- Kỳ ${nhanKy(i.period)}: ${tien(conNo(i))}` + (o.noiDungCK ? ` (nội dung chuyển khoản: ${o.noiDungCK(i)})` : '')).join('\n');
    const han = ngayDMY(g.hoaDon[0].dueDate);
    const coPhi = p.moiNgay > 0 && g.phi > 0;

    let mo, giua = [];
    if (g.muc.ma === 'sap-han') {
      const con = -n;
      mo = `Chào anh/chị${ten}, Happy Home xin nhắc phòng ${g.roomCode}: khoản ${tien(g.conNo)} sẽ đến hạn thanh toán vào ngày ${han}`
        + (con > 0 ? ` (còn ${con} ngày).` : ' (hôm nay).');
    } else if (g.muc.ma === 'nhac-nhe') {
      mo = `Chào anh/chị${ten}, phòng ${g.roomCode} đang còn ${tien(g.conNo)} chưa thanh toán, đã quá hạn ${n} ngày (hạn ${han}).`;
      giua.push('Anh/chị sắp xếp chuyển khoản giúp em trong hôm nay hoặc ngày mai nhé.');
    } else if (g.muc.ma === 'nhac-phi') {
      mo = `Chào anh/chị${ten}, phòng ${g.roomCode} đã quá hạn thanh toán ${n} ngày, còn ${tien(g.conNo - g.phiDaAp)}.`;
      if (p.moiNgay > 0) {
        giua.push(`Theo quy định của tòa nhà, sau ${p.mienNgay} ngày kể từ hạn sẽ tính phí trễ hạn ${tien(p.moiNgay)}/ngày`
          + (coPhi ? `; hiện phí tạm tính là ${tien(g.phi)}, tổng cần thanh toán ${tien(g.tongCanTra)}.` : '.'));
        giua.push('Anh/chị vui lòng thanh toán trong hôm nay để không phát sinh thêm.');
      } else giua.push('Mong anh/chị thanh toán trong hôm nay.');
    } else {
      mo = `Chào anh/chị${ten}, phòng ${g.roomCode} đã quá hạn thanh toán ${n} ngày, tổng cần thanh toán ${tien(g.tongCanTra)}`
        + (coPhi ? ` (đã gồm phí trễ hạn ${tien(g.phi)}).` : '.');
      giua.push('Đề nghị anh/chị thanh toán ngay, hoặc liên hệ chủ nhà trong hôm nay để thống nhất lịch trả.');
      giua.push('Nếu tiếp tục chậm, chủ nhà sẽ xử lý theo điều khoản trong hợp đồng thuê.');
    }

    const cuoi = [];
    if (tk.so) cuoi.push(`Anh/chị chuyển khoản giúp em: ${tk.ten || ''} - STK ${tk.so}${tk.chu ? ' - ' + tk.chu : ''}.`);
    cuoi.push('Anh/chị ghi đúng nội dung ở trên giúp em để đối soát nhanh. Cảm ơn anh/chị!');
    return [mo, ...giua, dong, ...cuoi].join('\n');
  }

  const api = { MUC, TRAN_PHAN_TRAM, MIEN_PHI_MAC_DINH, tien, ngayTre, mucCua, coTheNhac, chinhSach,
    tinhPhi, gomTheoPhong, trangThaiNhac, soanTin, phiDaAp, tienGoc, conNo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.reminders = api; }
})(typeof window !== 'undefined' ? window : globalThis);

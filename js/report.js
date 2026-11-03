/* ============================================================
   Happy Home — Báo cáo tháng: dựng số liệu, bản in, bản Excel

   Thuần, không đụng DOM và không gọi store (tests/report.test.js). Trang Báo cáo đưa vào:
     a        kết quả S.dashboardAnalytics({ period, buildingId })
     no       các hóa đơn còn nợ (không tính nháp, không tính đã hủy): { buildingId, roomCode, tenantName, total, paid, dueDate }
     homNay   'YYYY-MM-DD'
     phamVi   'Toàn công ty' hoặc tên một tòa
     tenToa   { idTòa: tên } để ghi tên tòa vào bảng nợ
   Hàm lap() trả một bản số liệu; html() và csv() chỉ việc dựng từ bản đó, nên trang xem trước và bản in luôn giống nhau.

   Quy ước tuổi nợ: tính từ hạn thanh toán của từng hóa đơn đến hôm nay.
     Chưa đến hạn (hôm nay chưa qua hạn) / quá 1–30 ngày / quá 31–60 ngày / quá trên 60 ngày.
   ============================================================ */
(function (root) {
  const NGAY_MS = 86400000;
  const SO_NO_LON = 10;                       // bản in chỉ liệt kê chừng này phòng nợ nhiều nhất, bản Excel liệt kê hết

  const MOC_NO = [
    { ma: 'chua-den-han', nhan: 'Chưa đến hạn' },
    { ma: '1-30', nhan: 'Quá hạn 1–30 ngày' },
    { ma: '31-60', nhan: 'Quá hạn 31–60 ngày' },
    { ma: 'tren-60', nhan: 'Quá hạn trên 60 ngày' },
  ];

  const so = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };
  const khoaNgay = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };

  /** Số ngày đã quá hạn (dương = quá hạn, 0 hoặc âm = chưa tới/đúng hạn). Thiếu ngày thì coi như chưa đến hạn. */
  function quaHan(han, homNay) {
    const d = khoaNgay(han), t = khoaNgay(homNay);
    if (d === null || t === null) return 0;
    return Math.round((t - d) / NGAY_MS);
  }
  const mocCua = (ngayQua) => ngayQua <= 0 ? 'chua-den-han' : ngayQua <= 30 ? '1-30' : ngayQua <= 60 ? '31-60' : 'tren-60';

  function nhanKy(period) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
    return m ? 'Tháng ' + Number(m[2]) + '/' + m[1] : '';
  }

  /** So kỳ này với kỳ trước. kieu 'tien': đổi theo %; 'phantram': đổi theo điểm phần trăm. huong: tang / giam / dung / null (chưa có kỳ trước). */
  function soSanh(gt, truoc, kieu) {
    if (truoc === null || truoc === undefined) return { huong: null, doi: 0, nhan: '' };
    gt = so(gt); truoc = so(truoc);
    if (kieu === 'phantram') {
      const diem = Math.round(gt * 100) - Math.round(truoc * 100);
      return diem === 0 ? { huong: 'dung', doi: 0, nhan: 'bằng kỳ trước' }
        : { huong: diem > 0 ? 'tang' : 'giam', doi: diem, nhan: (diem > 0 ? 'tăng ' : 'giảm ') + Math.abs(diem) + ' điểm' };
    }
    if (gt === truoc) return { huong: 'dung', doi: 0, nhan: 'bằng kỳ trước' };
    if (truoc === 0) return { huong: 'tang', doi: 1, nhan: 'kỳ trước chưa có' };
    const tl = (gt - truoc) / Math.abs(truoc);
    const pt = Math.round(Math.abs(tl) * 100);
    if (pt === 0) return { huong: 'dung', doi: 0, nhan: 'gần bằng kỳ trước' };
    return { huong: tl > 0 ? 'tang' : 'giam', doi: tl, nhan: (tl > 0 ? 'tăng ' : 'giảm ') + pt + '%' };
  }

  /** Gộp các hóa đơn còn nợ vào 4 mốc tuổi nợ. Luôn đủ 4 mốc, kể cả mốc không có gì. */
  function tuoiNo(no, homNay) {
    const out = MOC_NO.map(m => ({ ma: m.ma, nhan: m.nhan, soHD: 0, tien: 0 }));
    (no || []).forEach(i => {
      const con = so(i.total) - so(i.paid);
      if (con <= 0) return;
      const m = out.find(x => x.ma === mocCua(quaHan(i.dueDate, homNay)));
      m.soHD++; m.tien += con;
    });
    return out;
  }

  /** Mỗi phòng một dòng: tổng nợ, số hóa đơn, hóa đơn quá hạn lâu nhất. Nợ nhiều xếp trước; bằng nhau thì quá hạn lâu hơn xếp trước. */
  function noTheoPhong(no, homNay, tenToa) {
    const map = {};
    (no || []).forEach(i => {
      const con = so(i.total) - so(i.paid);
      if (con <= 0) return;
      const k = i.buildingId + '|' + i.roomCode;
      if (!map[k]) map[k] = { buildingId: i.buildingId, toa: (tenToa && tenToa[i.buildingId]) || '', phong: i.roomCode, khach: i.tenantName || '', tien: 0, soHD: 0, ngayQua: 0 };
      map[k].tien += con; map[k].soHD++;
      map[k].ngayQua = Math.max(map[k].ngayQua, quaHan(i.dueDate, homNay));
    });
    return Object.keys(map).map(k => map[k]).sort((x, y) =>
      y.tien - x.tien || y.ngayQua - x.ngayQua || String(x.phong).localeCompare(String(y.phong)));
  }

  const tyLe = (v, tong) => tong > 0 ? v / tong : 0;

  /** Những điều nên để ý, viết bằng lời thường. Tối đa 5 ý, ý quan trọng trước. */
  function luuY(k, tuoi, tien, noPhong) {
    const out = [];
    if (!k.billed && !k.cost && !k.revenue) return ['Kỳ này chưa có hóa đơn hay khoản chi nào.'];
    if (!k.billed) out.push('Kỳ này chưa phát hành hóa đơn nào.');
    else if (k.collectRate < 0.7) out.push('Mới thu được ' + Math.round(k.collectRate * 100) + '% số đã phát hành, còn ' + tien(k.billed - k.revenue) + ' chưa thu.');
    else if (k.collectRate >= 0.95) out.push('Thu gần đủ: ' + Math.round(k.collectRate * 100) + '% số đã phát hành.');
    const lau = tuoi.filter(m => m.ma === '31-60' || m.ma === 'tren-60');
    const lauHD = lau.reduce((s, m) => s + m.soHD, 0), lauTien = lau.reduce((s, m) => s + m.tien, 0);
    if (lauHD) out.push(lauHD + ' hóa đơn quá hạn trên 30 ngày, tổng ' + tien(lauTien) + '. Nên nhắc hoặc xử lý sớm.');
    else if (noPhong.length) out.push('Công nợ còn phải thu ' + tien(noPhong.reduce((s, x) => s + x.tien, 0)) + ' ở ' + noPhong.length + ' phòng, chưa có khoản nào quá hạn trên 30 ngày.');
    if (k.profit < 0) out.push('Chi nhiều hơn thu: lỗ ' + tien(-k.profit) + ' trong kỳ.');
    if (k.totalRooms > 0 && k.occupancy < 0.8) out.push('Còn ' + (k.totalRooms - k.occupiedRooms) + ' phòng chưa có người ở trên ' + k.totalRooms + ' phòng (lấp đầy ' + Math.round(k.occupancy * 100) + '%).');
    if (k.revenuePrev > 0 && k.revenue < k.revenuePrev * 0.8) out.push('Tiền thu giảm ' + Math.round((1 - k.revenue / k.revenuePrev) * 100) + '% so với kỳ trước.');
    if (!out.length) out.push('Không có điều gì bất thường trong kỳ này.');
    return out.slice(0, 5);
  }

  /**
   * Dựng bản số liệu của báo cáo.
   * @returns {{ky, nhanKy, phamVi, homNay, coDuLieu, luuY, chiSo, chuoi, theoToa, coCauThu, coCauChi, tuoiNo, noLon, noTatCa, tongNo}}
   */
  function lap(o) {
    o = o || {};
    const a = o.a || {}, k = Object.assign({
      revenue: 0, revenuePrev: 0, billed: 0, billedPrev: 0, collectRate: 0, collectRatePrev: 0, cost: 0, costPrev: 0,
      profit: 0, profitPrev: 0, debt: 0, occupancy: 0, occupiedRooms: 0, totalRooms: 0,
    }, a.kpi || {});
    const homNay = o.homNay || '', tien = o.tien || ((n) => String(Math.round(n)) + ' ₫');
    const tuoi = tuoiNo(o.no, homNay);
    const noTatCa = noTheoPhong(o.no, homNay, o.tenToa);

    const dong = (ma, nhan, gt, truoc, kieu, extra) => Object.assign({ ma, nhan, gt, truoc, kieu, ss: soSanh(gt, truoc, kieu) }, extra || {});
    const chiSo = [
      dong('phat-hanh', 'Phát hành kỳ này', k.billed, k.billedPrev, 'tien'),
      dong('da-thu', 'Đã thu', k.revenue, k.revenuePrev, 'tien'),
      dong('ty-le-thu', 'Tỷ lệ đã thu', k.collectRate, k.billedPrev > 0 ? k.collectRatePrev : null, 'phantram'),   // kỳ trước chưa phát hành gì thì 0% không có nghĩa là "thu tệ", bỏ so
      dong('chi', 'Chi phí vận hành', k.cost, k.costPrev, 'tien', { nghich: true }),
      dong('loi-nhuan', 'Lợi nhuận', k.profit, k.profitPrev, 'tien', { ghiChu: 'đã gồm thu khác' }),
      dong('cong-no', 'Công nợ còn phải thu', k.debt, null, 'tien', { nghich: true, ghiChu: 'mọi kỳ' }),
      dong('lap-day', 'Lấp đầy', k.occupancy, null, 'phantram', { ghiChu: k.occupiedRooms + '/' + k.totalRooms + ' phòng' }),
    ];

    const mixThu = a.revenueMix || [], tongThu = mixThu.reduce((s, x) => s + so(x.value), 0);
    const mixChi = a.expenseMix || [], tongChi = mixChi.reduce((s, x) => s + so(x.value), 0);

    return {
      ky: a.period || '', nhanKy: nhanKy(a.period), phamVi: o.phamVi || 'Toàn công ty', homNay,
      coDuLieu: !!a.hasData,
      luuY: luuY(k, tuoi, tien, noTatCa),
      chiSo,
      chuoi: (a.series || []).map(s => ({ ky: s.period, nhan: s.label, phatHanh: so(s.billed), daThu: so(s.revenue), chi: so(s.cost), soHD: so(s.invoices) })),
      theoToa: (a.byBuilding || []).map(b => ({ id: b.id, ten: b.name, phatHanh: so(b.billed), daThu: so(b.collected),
        tyLeThu: tyLe(so(b.collected), so(b.billed)), soPhong: so(b.rooms), dangO: so(b.occupied), trong: so(b.vacant), layDay: so(b.occupancy) })),
      coCauThu: mixThu.map(x => ({ nhan: x.label, tien: so(x.value), tyLe: tyLe(so(x.value), tongThu) })),
      coCauChi: mixChi.map(x => ({ nhan: x.label, tien: so(x.value), tyLe: tyLe(so(x.value), tongChi) })),
      tuoiNo: tuoi,
      noLon: noTatCa.slice(0, SO_NO_LON),
      noTatCa,
      tongNo: noTatCa.reduce((s, x) => s + x.tien, 0),
    };
  }

  /* ---------------- Bản Excel (CSV): các phần cách nhau một dòng trống, số để nguyên cho Excel cộng được ---------------- */
  function csv(m) {
    const r = [['Báo cáo ' + m.nhanKy.toLowerCase(), m.phamVi], ['Lập ngày', ngayVN(m.homNay)], []];
    r.push(['TÓM TẮT'], ['Chỉ tiêu', 'Kỳ này', 'Kỳ trước', 'So với kỳ trước']);
    m.chiSo.forEach(c => {
      const g = (v) => v === null || v === undefined ? '' : c.kieu === 'phantram' ? Math.round(v * 100) + '%' : Math.round(v);
      r.push([c.nhan + (c.ghiChu ? ' (' + c.ghiChu + ')' : ''), g(c.gt), g(c.truoc), c.ss.nhan]);
    });
    r.push([], ['THEO TÒA NHÀ'], ['Tòa nhà', 'Phát hành', 'Đã thu', 'Tỷ lệ thu', 'Số phòng', 'Đang ở', 'Trống']);
    m.theoToa.forEach(b => r.push([b.ten, Math.round(b.phatHanh), Math.round(b.daThu), Math.round(b.tyLeThu * 100) + '%', b.soPhong, b.dangO, b.trong]));
    r.push([], ['THU VÀ CHI CÁC KỲ GẦN NHẤT'], ['Kỳ', 'Phát hành', 'Đã thu', 'Chi phí']);
    m.chuoi.forEach(s => r.push([s.nhan, Math.round(s.phatHanh), Math.round(s.daThu), Math.round(s.chi)]));
    r.push([], ['CƠ CẤU TIỀN PHÁT HÀNH'], ['Khoản', 'Số tiền', 'Tỷ trọng']);
    m.coCauThu.forEach(x => r.push([x.nhan, Math.round(x.tien), Math.round(x.tyLe * 100) + '%']));
    r.push([], ['CƠ CẤU CHI PHÍ'], ['Khoản', 'Số tiền', 'Tỷ trọng']);
    if (m.coCauChi.length) m.coCauChi.forEach(x => r.push([x.nhan, Math.round(x.tien), Math.round(x.tyLe * 100) + '%']));
    else r.push(['Kỳ này chưa ghi khoản chi nào']);
    r.push([], ['TUỔI NỢ'], ['Mốc', 'Số hóa đơn', 'Số tiền']);
    m.tuoiNo.forEach(x => r.push([x.nhan, x.soHD, Math.round(x.tien)]));
    r.push([], ['CÁC PHÒNG CÒN NỢ (đủ danh sách)'], ['Tòa nhà', 'Phòng', 'Khách', 'Số hóa đơn', 'Còn nợ', 'Quá hạn lâu nhất (ngày)']);
    if (m.noTatCa.length) m.noTatCa.forEach(x => r.push([x.toa, x.phong, x.khach, x.soHD, Math.round(x.tien), Math.max(0, x.ngayQua)]));
    else r.push(['Không còn khoản nợ nào']);
    return r;
  }

  /* ---------------- Bản xem và bản in ---------------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escDef = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const vnNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const tienDef = (n) => vnNum(n) + ' ₫';
  const ptDef = (n) => Math.round(n * 100) + '%';
  function ngayVN(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

  const CSS = `
.bct{font-family:'Be Vietnam Pro',Arial,sans-serif;color:#1c1917;font-size:13px;line-height:1.5;max-width:780px;margin:0 auto;background:#fff}
.bct *{box-sizing:border-box}
.bct-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #0F5C5B;padding-bottom:12px;margin-bottom:6px}
.bct-brand{display:flex;gap:10px;align-items:center}.bct-brand img{width:42px;height:auto}
.bct-brand b{display:block;color:#0F5C5B;letter-spacing:.03em;font-size:14px}.bct-brand span,.bct-title span{color:#57534e;font-size:12px}
.bct-title{text-align:right}.bct-title h1{font-size:19px;margin:0 0 2px;letter-spacing:.01em}
.bct h2{font-size:13px;margin:20px 0 6px;color:#0F5C5B;text-transform:uppercase;letter-spacing:.05em;break-after:avoid}
.bct-sum{margin:0;padding-left:18px}.bct-sum li{margin:3px 0}
.bct table{width:100%;border-collapse:collapse}
.bct th{background:#f1f5f4;text-align:left;font-weight:700;font-size:12px;padding:6px 8px;border-bottom:1px solid #cfd8d6}
.bct td{padding:6px 8px;border-bottom:1px solid #e7ecea;vertical-align:top}
.bct tr{break-inside:avoid}
.bct .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.bct td small,.bct .bct-note{color:#78716c;font-size:11.5px}
.bct .bct-note{margin:6px 0 0}
.bct .tot td{font-weight:700;border-top:1.5px solid #333;border-bottom:0}
.bct .tang-tot,.bct .giam-tot{color:#15803d}.bct .tang-xau,.bct .giam-xau{color:#b91c1c}
.bct-2{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}
.bct-ft{margin-top:22px;padding-top:8px;border-top:1px solid #e7ecea;color:#78716c;font-size:11.5px}
.bct-scroll{overflow-x:auto}
@media (max-width:640px){.bct-head{flex-direction:column}.bct-title{text-align:left}.bct-2{grid-template-columns:1fr}.bct th,.bct td{padding:6px 5px;font-size:12px}.bct th:first-child,.bct td:first-child{min-width:112px}}
@media print{.bct-2{grid-template-columns:1fr 1fr}.bct-scroll{overflow:visible}}
`;

  /**
   * Dựng khối <article class="bct"> của báo cáo. f có thể đưa vào: { esc, tien, phanTram, logo }.
   * Mọi chữ lấy từ dữ liệu (tên khách, tên tòa...) đều qua esc.
   */
  function html(m, f) {
    f = f || {};
    const esc = f.esc || escDef, tien = f.tien || tienDef, pt = f.phanTram || ptDef;
    const ss = (c) => {
      if (!c.ss.huong) return '<small>—</small>';
      if (c.ss.huong === 'dung') return '<small>' + esc(c.ss.nhan) + '</small>';
      const tot = (c.ss.huong === 'tang') !== !!c.nghich;
      return '<span class="' + c.ss.huong + '-' + (tot ? 'tot' : 'xau') + '">' + (c.ss.huong === 'tang' ? '▲ ' : '▼ ') + esc(c.ss.nhan) + '</span>';
    };
    const gt = (c, v) => v === null || v === undefined ? '<small>—</small>' : esc(c.kieu === 'phantram' ? pt(v) : tien(v));
    const bang = (dau, hang, cls) => '<div class="bct-scroll"><table' + (cls ? ' class="' + cls + '"' : '') + '><thead><tr>' + dau.map(d => '<th' + (d.n ? ' class="n"' : '') + '>' + esc(d.t) + '</th>').join('') + '</tr></thead><tbody>' + hang + '</tbody></table></div>';
    const td = (v, n) => '<td' + (n ? ' class="n"' : '') + '>' + v + '</td>';
    const mat = (nhan) => '<tr><td colspan="9"><small>' + esc(nhan) + '</small></td></tr>';

    const tomTat = bang([{ t: 'Chỉ tiêu' }, { t: 'Kỳ này', n: 1 }, { t: 'Kỳ trước', n: 1 }, { t: 'Thay đổi', n: 1 }],
      m.chiSo.map(c => '<tr>' + td(esc(c.nhan) + (c.ghiChu ? ' <small>(' + esc(c.ghiChu) + ')</small>' : '')) + td('<b>' + gt(c, c.gt) + '</b>', 1) + td(gt(c, c.truoc), 1) + td(ss(c), 1) + '</tr>').join(''));

    const theoToa = bang([{ t: 'Tòa nhà' }, { t: 'Phát hành', n: 1 }, { t: 'Đã thu', n: 1 }, { t: 'Tỷ lệ thu', n: 1 }, { t: 'Phòng ở / tổng', n: 1 }],
      m.theoToa.length ? m.theoToa.map(b => '<tr>' + td(esc(b.ten)) + td(esc(tien(b.phatHanh)), 1) + td(esc(tien(b.daThu)), 1) + td(esc(pt(b.tyLeThu)), 1) + td(b.dangO + ' / ' + b.soPhong, 1) + '</tr>').join('') : mat('Chưa có tòa nhà.'));

    const chuoi = bang([{ t: 'Kỳ' }, { t: 'Phát hành', n: 1 }, { t: 'Đã thu', n: 1 }, { t: 'Chi phí', n: 1 }],
      m.chuoi.map(s => '<tr' + (s.ky === m.ky ? ' class="tot"' : '') + '>' + td(esc(s.nhan)) + td(esc(tien(s.phatHanh)), 1) + td(esc(tien(s.daThu)), 1) + td(esc(tien(s.chi)), 1) + '</tr>').join(''));

    const mix = (ds, rong) => bang([{ t: 'Khoản' }, { t: 'Số tiền', n: 1 }, { t: 'Tỷ trọng', n: 1 }],
      ds.length ? ds.map(x => '<tr>' + td(esc(x.nhan)) + td(esc(tien(x.tien)), 1) + td(esc(pt(x.tyLe)), 1) + '</tr>').join('') : mat(rong));

    const tuoi = bang([{ t: 'Mốc' }, { t: 'Số hóa đơn', n: 1 }, { t: 'Số tiền', n: 1 }],
      m.tuoiNo.map(x => '<tr>' + td(esc(x.nhan)) + td(String(x.soHD), 1) + td(esc(tien(x.tien)), 1) + '</tr>').join('')
      + '<tr class="tot">' + td('Cộng') + td(String(m.tuoiNo.reduce((s, x) => s + x.soHD, 0)), 1) + td(esc(tien(m.tongNo)), 1) + '</tr>');

    const noLon = m.noLon.length
      ? bang([{ t: 'Phòng' }, { t: 'Khách' }, { t: 'Số HĐ', n: 1 }, { t: 'Quá hạn', n: 1 }, { t: 'Còn nợ', n: 1 }],
        m.noLon.map(x => '<tr>' + td('<b>' + esc(x.phong) + '</b>' + (m.theoToa.length > 1 && x.toa ? ' <small>' + esc(x.toa.replace(/^Happy Home\s*/i, '')) + '</small>' : '')) + td(esc(x.khach))
          + td(String(x.soHD), 1) + td(x.ngayQua > 0 ? x.ngayQua + ' ngày' : '<small>chưa tới hạn</small>', 1) + td(esc(tien(x.tien)), 1) + '</tr>').join(''))
      : '<p class="bct-note">Không còn khoản nợ nào.</p>';
    const noThem = m.noTatCa.length > m.noLon.length ? '<p class="bct-note">Còn ' + (m.noTatCa.length - m.noLon.length) + ' phòng nợ ít hơn, xem đủ trong bản Excel.</p>' : '';

    return '<article class="bct">'
      + '<header class="bct-head"><div class="bct-brand">' + (f.logo ? '<img src="' + esc(f.logo) + '" alt="">' : '') + '<div><b>HAPPY HOME</b><span>' + esc(m.phamVi) + '</span></div></div>'
      + '<div class="bct-title"><h1>BÁO CÁO ' + esc(m.nhanKy.toUpperCase()) + '</h1><span>Lập ngày ' + esc(ngayVN(m.homNay)) + '</span></div></header>'
      + '<h2>Điểm đáng chú ý</h2><ul class="bct-sum">' + m.luuY.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>'
      + '<h2>Tóm tắt</h2>' + tomTat + '<p class="bct-note">Lợi nhuận = tiền phòng, dịch vụ đã thu + thu khác − chi phí. Công nợ tính trên mọi kỳ, không riêng kỳ này.</p>'
      + '<h2>Theo tòa nhà</h2>' + theoToa
      + '<h2>Thu và chi các kỳ gần nhất</h2>' + chuoi
      + '<div class="bct-2"><div><h2>Cơ cấu tiền phát hành</h2>' + mix(m.coCauThu, 'Chưa có hóa đơn.') + '</div>'
      + '<div><h2>Cơ cấu chi phí</h2>' + mix(m.coCauChi, 'Kỳ này chưa ghi khoản chi nào.') + '</div></div>'
      + '<h2>Tuổi nợ</h2>' + tuoi
      + '<h2>Phòng nợ nhiều nhất</h2>' + noLon + noThem
      + '<footer class="bct-ft">Lập bởi Happy Home. Số liệu tại thời điểm lập báo cáo; thu sau ngày này sẽ không có trong bản này.</footer>'
      + '</article>';
  }

  const api = { lap, html, csv, css: CSS, soSanh, tuoiNo, noTheoPhong, quaHan, nhanKy, MOC_NO, SO_NO_LON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.report = api; }
})(typeof window !== 'undefined' ? window : globalThis);

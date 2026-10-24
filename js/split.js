/* ============================================================
   Happy Home — Chia hóa đơn phòng cho từng người ở

   Thuần, không đụng DOM (tests/split.test.js). Dùng chung cho web quản trị và app khách thuê.

   Cách chia:
     - Mỗi dòng của hóa đơn (tiền phòng, điện, nước, dịch vụ, phí trễ hạn) chia riêng theo
       tỉ lệ (mặc định mỗi người một phần), rồi cộng lại thành phần của từng người.
     - Số tiền là đồng nguyên nên có dư: dùng "phần dư lớn nhất", tổng các phần LUÔN
       bằng đúng tổng hóa đơn. Phần dư xoay vòng giữa mọi người theo từng dòng, đỡ dồn
       mãi cho một người.
   Hệ thống chỉ ghi nhận thanh toán theo CẢ PHÒNG (một hóa đơn); phần của từng người là
   cách chia để họ tự thỏa thuận, không phải sổ nợ riêng.
   ============================================================ */
(function (root) {
  const tien = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' ₫';

  /** Chia số nguyên `tong` theo trọng số, kết quả cộng lại đúng bằng `tong`.
      `xoay`: người nhận phần dư đầu tiên khi các phần dư bằng nhau. */
  function chiaSo(tong, trongSo, xoay) {
    const n = trongSo.length;
    if (!n) return [];
    const dau = tong < 0 ? -1 : 1, t = Math.abs(Math.round(tong || 0));
    let w = trongSo.map(x => (x > 0 ? x : 0));
    let W = w.reduce((s, x) => s + x, 0);
    if (!W) { w = w.map(() => 1); W = n; }
    const exact = w.map(x => t * x / W);
    const out = exact.map(Math.floor);
    let du = t - out.reduce((s, x) => s + x, 0);
    const start = ((xoay || 0) % n + n) % n;
    const order = exact.map((e, i) => ({ i, f: e - Math.floor(e), r: (i - start + n) % n }))
      .sort((a, b) => (b.f - a.f) || (a.r - b.r));
    for (let k = 0; du > 0; k++, du--) out[order[k % n].i] += 1;
    return out.map(x => x * dau);
  }

  /** nguoi = [{ id, ten, trongSo? }]  →  { tong, deu, nguoi: [{ id, ten, tong, dong: [{ label, amount, type }] }] } */
  function chia(lines, nguoi, opt) {
    const ds = (nguoi || []).filter(p => p && (p.trongSo == null || p.trongSo > 0));
    if (!ds.length) return null;
    const w = ds.map(p => (p.trongSo == null ? 1 : p.trongSo));
    const res = ds.map(p => ({ id: p.id, ten: p.ten, tong: 0, dong: [] }));
    (lines || []).forEach((l, k) => {
      chiaSo(l.amount || 0, w, k).forEach((a, i) => {
        res[i].dong.push({ label: l.label, amount: a, type: l.type });
        res[i].tong += a;
      });
    });
    return { tong: res.reduce((s, p) => s + p.tong, 0), deu: w.every(x => x === w[0]), nguoi: res };
  }

  /** Thêm vào mỗi người số đã đóng / còn lại, chia phần đã thanh toán của hóa đơn theo tỉ lệ phần của họ. */
  function theoDaTra(kq, daTra) {
    if (!kq) return null;
    const dt = chiaSo(Math.min(Math.max(daTra || 0, 0), kq.tong), kq.nguoi.map(p => p.tong), 0);
    return Object.assign({}, kq, { nguoi: kq.nguoi.map((p, i) => Object.assign({}, p, { daTra: dt[i], conNo: p.tong - dt[i] })) });
  }

  const nhanKy = (p) => { const a = String(p || '').split('-'); return a.length === 2 ? 'T' + Number(a[1]) + '/' + a[0] : String(p || ''); };

  /** Tin nhắn gửi MỘT người. ctx = { phong, ky, hoaDonId, noiDungCK, taiKhoan: { ten, so, chu }, nguoiGui } */
  function soanTin(p, ctx) {
    const c = ctx || {};
    const dong = p.dong.filter(d => d.amount).map(d => `- ${d.label}: ${tien(d.amount)}`).join('\n');
    const can = p.conNo != null ? p.conNo : p.tong;
    const tk = c.taiKhoan || {};
    return [
      `Chào ${p.ten || 'bạn'}, phần hóa đơn ${nhanKy(c.ky)} phòng ${c.phong} chia cho bạn là ${tien(p.tong)}`
        + (p.daTra ? `, còn lại ${tien(can)}.` : '.'),
      dong,
      tk.so ? `Chuyển khoản: ${tk.ten || ''} - STK ${tk.so}${tk.chu ? ' - ' + tk.chu : ''}.` : '',
      c.noiDungCK ? `Nội dung chuyển khoản: ${c.noiDungCK}` : '',
      c.nguoiGui ? `Cảm ơn bạn! (${c.nguoiGui})` : 'Cảm ơn bạn!',
    ].filter(Boolean).join('\n');
  }

  const api = { chiaSo, chia, theoDaTra, soanTin };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.split = api; }
})(typeof window !== 'undefined' ? window : globalThis);

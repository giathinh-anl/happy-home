/* ============================================================
   Happy Home — Điểm thanh toán của một hợp đồng / phòng

   Luật ĐƠN GIẢN, chủ trọ đọc là hiểu vì sao khách được số điểm đó. Không dùng
   AI, không dùng dữ liệu nào ngoài hóa đơn và phiếu thu đã có.

   Mỗi hóa đơn được chấm từ 0 đến 1:
     - Trả đủ, trong hoặc đúng hạn ............ 1,00
     - Trả đủ nhưng trễ d ngày ................. 1 - 0,7 × min(d, 30) / 30
                                                  (trễ 5 ngày ≈ 0,88; trễ 30 ngày trở lên = 0,30)
     - Quá hạn, đã trả một phần ................ 0,25
     - Quá hạn, chưa trả đồng nào .............. 0
     - Chưa tới hạn .......................... không tính (chưa biết)
     - Trả đủ nhưng KHÔNG có phiếu thu kèm ngày  không tính (không biết trả hôm nào,
                                                  không đoán là đúng hạn)
   Điểm = trung bình có trọng số × 100. Hóa đơn mới hơn nặng hơn: mỗi kỳ lùi về
   trước thì trọng số nhân 0,85, nên khách đã sửa thói quen thì điểm lên lại.

   Hạng:  ≥ 90 Xuất sắc · ≥ 75 Tốt · ≥ 50 Trung bình · còn lại Cần nhắc.
   Dưới 3 hóa đơn được chấm thì gắn cờ "tạm tính": ít dữ liệu, đừng coi là kết luận.

   Tệp này không đụng DOM nên chạy được bằng node: xem tests/scoring.test.js
   ============================================================ */
(function (root) {
  const NGAY_MS = 86400000;
  const TRE_TOI_DA = 30;        // trễ từ 30 ngày trở lên: hóa đơn trả đủ cũng chỉ còn 0,30
  const TRU_TOI_DA = 0.7;
  const HE_SO_CU = 0.85;        // mỗi kỳ lùi về trước nhân trọng số này
  const DIEM_MOT_PHAN = 0.25;   // quá hạn nhưng đã trả một phần
  const IT_DU_LIEU = 3;         // dưới số hóa đơn này thì "tạm tính"

  const HANG = [
    { tu: 90, ma: 'xuat-sac',   ten: 'Xuất sắc' },
    { tu: 75, ma: 'tot',        ten: 'Tốt' },
    { tu: 50, ma: 'trung-binh', ten: 'Trung bình' },
    { tu: 0,  ma: 'can-nhac',   ten: 'Cần nhắc' },
  ];

  /** Số thứ tự ngày theo LỊCH địa phương (bỏ giờ). So hai mốc bằng cách trừ nhau.
      Hạn thanh toán lưu là nửa đêm giờ địa phương, còn ngày trả có thể là chuỗi
      "2026-10-12" — phải về cùng một hệ lịch, không thì lệch một ngày tùy múi giờ. */
  function ngayLich(x) {
    if (x == null || x === '') return null;
    let d;
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) {
      const [y, m, dd] = x.split('-').map(Number);
      d = new Date(y, m - 1, dd);
    } else d = new Date(x);
    if (isNaN(d.getTime())) return null;
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / NGAY_MS);
  }

  function hangCua(diem) {
    return HANG.find((h) => diem >= h.tu);
  }

  /**
   * @param hoaDon     mảng hóa đơn { id, total, paid, status, dueDate }
   * @param layPhieu   (hoaDon) => mảng phiếu thu { date } của hóa đơn đó
   * @param homNay     ngày tính (mặc định hôm nay)
   */
  function tinh(hoaDon, layPhieu, homNay) {
    const hn = ngayLich(homNay || new Date());
    const chiTiet = [];

    (hoaDon || []).forEach((inv) => {
      if (!inv || inv.status === 'cancelled' || inv.status === 'draft' || !(inv.total > 0)) return;
      const han = ngayLich(inv.dueDate);
      if (han == null) return;

      if (inv.total - inv.paid <= 0) {                          // đã trả đủ
        const ngay = (layPhieu(inv) || []).map((p) => ngayLich(p.date)).filter((n) => n != null);
        if (!ngay.length) { chiTiet.push({ id: inv.id, han, loai: 'khong-ro-ngay', diem: null }); return; }
        const tre = Math.max(...ngay) - han;                    // phiếu cuối cùng = ngày trả đủ
        if (tre <= 0) chiTiet.push({ id: inv.id, han, loai: 'dung-han', tre: 0, diem: 1 });
        else chiTiet.push({ id: inv.id, han, loai: 'tra-tre', tre,
          diem: 1 - TRU_TOI_DA * Math.min(tre, TRE_TOI_DA) / TRE_TOI_DA });
      } else if (hn > han) {                                    // quá hạn còn nợ
        chiTiet.push({ id: inv.id, han, loai: 'qua-han', tre: hn - han, diem: inv.paid > 0 ? DIEM_MOT_PHAN : 0 });
      } else {
        chiTiet.push({ id: inv.id, han, loai: 'chua-den-han', diem: null });
      }
    });

    const duoc = chiTiet.filter((c) => c.diem != null).sort((a, b) => b.han - a.han);   // mới nhất trước
    const dem = (loai) => chiTiet.filter((c) => c.loai === loai).length;
    const tomTat = { dungHan: dem('dung-han'), traTre: dem('tra-tre'), quaHan: dem('qua-han'),
      khongRoNgay: dem('khong-ro-ngay'), chuaDenHan: dem('chua-den-han') };

    if (!duoc.length) return Object.assign({ diem: null, soHoaDon: 0, hang: 'chua-co', ten: 'Chưa có dữ liệu', tamTinh: true, chiTiet }, tomTat);

    let tu = 0, mau = 0;
    duoc.forEach((c, i) => { const w = Math.pow(HE_SO_CU, i); tu += w * c.diem; mau += w; });
    const diem = Math.round(100 * tu / mau);
    const h = hangCua(diem);
    return Object.assign({ diem, soHoaDon: duoc.length, hang: h.ma, ten: h.ten, tamTinh: duoc.length < IT_DU_LIEU, chiTiet }, tomTat);
  }

  /** Câu giải thích ngắn cho chú thích khi rê chuột */
  function giaiThich(s) {
    if (s.diem == null) return 'Chưa có hóa đơn nào đủ điều kiện để chấm điểm.';
    const phan = [];
    if (s.dungHan) phan.push(s.dungHan + ' đúng hạn');
    if (s.traTre) phan.push(s.traTre + ' trả trễ');
    if (s.quaHan) phan.push(s.quaHan + ' quá hạn chưa trả đủ');
    let t = `Dựa trên ${s.soHoaDon} hóa đơn: ${phan.join(', ')}.`;
    if (s.khongRoNgay) t += ` ${s.khongRoNgay} hóa đơn đã trả đủ nhưng không có phiếu thu ghi ngày nên không tính.`;
    if (s.tamTinh) t += ' Ít hơn 3 hóa đơn nên mới là điểm tạm tính.';
    return t;
  }

  const api = { tinh, giaiThich, ngayLich, hangCua, HANG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.scoring = api; }
})(typeof window !== 'undefined' ? window : globalThis);

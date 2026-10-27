/* ============================================================
   Happy Home — Chốt sổ cuối tháng: phân loại từng phòng trước khi sinh hóa đơn

   Thuần, không đụng DOM (tests/closing.test.js). Quyết định phòng nào CHỐT ĐƯỢC ngay,
   phòng nào phải xem lại, phòng nào bị chặn (thiếu chỉ số, chỉ số giảm...). Chủ trọ thấy
   danh sách này trước khi bấm tạo hóa đơn, không còn "sinh rồi mới biết thiếu".

   Trạng thái của một dòng:
     san-sang      đủ dữ liệu, tiêu thụ bình thường              → chọn sẵn
     bat-thuong    chốt được nhưng nên xem: điện vọt cao hoặc bằng 0 → chọn sẵn, có ghi chú
     thieu-chi-so  chưa ghi chỉ số điện kỳ này                   → chặn
     chi-so-giam   chỉ số nhỏ hơn kỳ trước mà chưa xử lý quay vòng / thay đồng hồ → chặn
     da-co         đã có hóa đơn kỳ này (chốt rồi)               → bỏ qua
     ngoai-ky      hợp đồng chưa bắt đầu hoặc đã hết trước kỳ     → bỏ qua
   ============================================================ */
(function (root) {
  const NGAY_MS = 86400000;
  const TREN_BINH_THUONG = 3;        // dùng điện gấp từng này lần mức trung bình của phòng thì nhắc xem lại

  const NHAN = {
    'san-sang': 'Sẵn sàng', 'bat-thuong': 'Nên xem lại', 'thieu-chi-so': 'Thiếu chỉ số',
    'chi-so-giam': 'Chỉ số giảm', 'da-co': 'Đã có hóa đơn', 'ngoai-ky': 'Ngoài kỳ',
  };
  const CHAN = { 'thieu-chi-so': true, 'chi-so-giam': true, 'da-co': true, 'ngoai-ky': true };

  const ngay = (x) => { const d = new Date(x); return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()); };

  /**
   * ds: [{ contractId, roomCode, tenantName, daCoHoaDon, start, end, chiSo }]
   *      chiSo = null | { elecPrev, elecCurr, elecExtra, elecAvg }
   * ky: { batDau: Date, ketThuc: Date }   (ngày đầu và ngày cuối của kỳ)
   */
  function phanLoai(ds, ky) {
    const bd = ngay(ky && ky.batDau), kt = ngay(ky && ky.ketThuc);
    return (ds || []).map((c) => {
      const out = { contractId: c.contractId, roomCode: c.roomCode, tenantName: c.tenantName,
        trangThai: 'san-sang', ghiChu: '', tieuThu: null, chan: false, chon: true };
      const xong = (tt, ghiChu) => { out.trangThai = tt; out.ghiChu = ghiChu || ''; out.chan = !!CHAN[tt]; out.chon = !out.chan; return out; };

      if (c.daCoHoaDon) return xong('da-co', 'Đã chốt kỳ này');
      const s = ngay(c.start), e = ngay(c.end);
      if (bd && kt && ((s && s > kt) || (e && e < bd))) return xong('ngoai-ky', s && s > kt ? 'Hợp đồng chưa bắt đầu' : 'Hợp đồng đã hết trước kỳ này');

      const r = c.chiSo;
      if (!r || r.elecCurr == null || r.elecCurr === '') return xong('thieu-chi-so', 'Chưa ghi chỉ số điện');
      const prev = Number(r.elecPrev) || 0, curr = Number(r.elecCurr), extra = Number(r.elecExtra) || 0;
      if (!Number.isFinite(curr)) return xong('thieu-chi-so', 'Chỉ số điện không hợp lệ');
      if (curr < prev && extra <= 0) return xong('chi-so-giam', `Chỉ số ${curr} nhỏ hơn kỳ trước (${prev}): xử lý quay vòng hoặc thay đồng hồ`);

      out.tieuThu = Math.max(0, curr - prev) + extra;
      const tb = Number(r.elecAvg) || 0;
      if (tb > 0 && out.tieuThu > tb * TREN_BINH_THUONG) return xong('bat-thuong', `Dùng ${out.tieuThu} kWh, cao gấp ${(out.tieuThu / tb).toFixed(1)} lần mức thường`);
      if (out.tieuThu === 0) return xong('bat-thuong', 'Không dùng điện kỳ này, kiểm tra lại số đồng hồ');
      return xong('san-sang', '');
    });
  }

  /** Đếm theo trạng thái + số dòng chọn được */
  function tom(ds) {
    const t = { tong: ds.length, chon: 0 };
    Object.keys(NHAN).forEach((k) => { t[k] = 0; });
    ds.forEach((d) => { t[d.trangThai]++; if (!d.chan) t.chon++; });
    t.chan = t['thieu-chi-so'] + t['chi-so-giam'];
    return t;
  }

  /** Ngày đầu / cuối của kỳ 'YYYY-MM' */
  function kyThang(period) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(period || ''));
    if (!m) return null;
    const y = +m[1], th = +m[2];
    return { batDau: new Date(y, th - 1, 1), ketThuc: new Date(y, th, 0) };
  }

  const api = { phanLoai, tom, kyThang, NHAN, CHAN, TREN_BINH_THUONG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.closing = api; }
})(typeof window !== 'undefined' ? window : globalThis);

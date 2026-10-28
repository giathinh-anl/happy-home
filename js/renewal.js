/* ============================================================
   Happy Home — Gia hạn hợp đồng: tính hạn mới, ghi lịch sử, dựng nội dung PHỤ LỤC để hai bên ký
   (không đụng DOM, có kiểm thử: tests/renewal.test.js)

   Trước đây gia hạn chỉ sửa thẳng hợp đồng (đổi ngày hết hạn, giá) nên không còn dấu vết: giá cũ là bao nhiêu, gia hạn lúc nào,
   từ ngày nào. Nay mỗi lần gia hạn ghi một dòng lịch sử và dựng được "Phụ lục hợp đồng" (in ra / lưu PDF) cho hai bên ký.
   ============================================================ */
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./dates.js') : root.HH.dates;
  const TOI_DA_THANG = 60;
  const pad = (n) => String(n).padStart(2, '0');

  const laSoNguyen = (v) => Number.isInteger(Number(v));          // '' và null thành 0: số tháng 0 bị chặn bởi kiểm < 1, giá rỗng được bỏ qua trước khi tới đây

  /**
   * Tính một lần gia hạn. o: { hetHan (hạn hiện tại), homNay, soThang, giaHienTai, giaMoi (bỏ trống = giữ giá) }
   * Hạn mới tính từ ngày hết hạn nếu hợp đồng còn hiệu lực; đã hết hạn (hoặc hết hạn đúng hôm nay) thì tính từ hôm nay.
   * Trả { ok:true, tuNgay, denNgay, soThang, giaCu, giaMoi, doiGia, daQuaHan } hoặc { ok:false, loi }.
   */
  function tinhGiaHan(o) {
    const x = o || {};
    if (!laSoNguyen(x.soThang) || Number(x.soThang) < 1 || Number(x.soThang) > TOI_DA_THANG) return { ok: false, loi: `Số tháng gia hạn từ 1 đến ${TOI_DA_THANG}` };
    if (!D.phanTich(x.homNay)) return { ok: false, loi: 'Thiếu ngày hôm nay' };
    const giaCu = Number(x.giaHienTai) || 0;
    let giaMoi = giaCu;
    if (x.giaMoi !== undefined && x.giaMoi !== null && x.giaMoi !== '') {
      if (!laSoNguyen(x.giaMoi) || Number(x.giaMoi) < 0) return { ok: false, loi: 'Giá thuê mới phải là số tiền không âm' };
      giaMoi = Number(x.giaMoi);
    }
    const conHieuLuc = D.chenhNgay(x.homNay, x.hetHan) > 0;      // chưa có hạn (hoặc hạn rác): chenhNgay là NaN, nên coi như đã hết
    const tu = conHieuLuc ? x.hetHan : x.homNay;
    const n = Number(x.soThang);
    return { ok: true, tuNgay: D.chuoiNgay(tu), denNgay: D.chuoiNgay(D.themThang(tu, n)), soThang: n, giaCu, giaMoi, doiGia: giaMoi !== giaCu, daQuaHan: !conHieuLuc };
  }

  /** Dòng lịch sử để lưu vào hợp đồng (cột renewal_history). at: thời điểm ISO; id: mã dòng */
  function banGhi(kq, o) {
    const x = o || {};
    return { id: x.id, at: x.at, tuNgay: kq.tuNgay, denNgay: kq.denNgay, soThang: kq.soThang, giaCu: kq.giaCu, giaMoi: kq.giaMoi, by: x.by || '' };
  }

  /** Lịch sử gia hạn của một hợp đồng, cũ trước mới sau. Hợp đồng gia hạn từ trước khi có lịch sử chi tiết: báo số lần còn thiếu. */
  function lichSu(hd) {
    const ds = Array.isArray(hd && hd.renewalHistory) ? hd.renewalHistory.filter((b) => b && b.denNgay) : [];
    ds.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
    return { muc: ds, thieuChiTiet: Math.max(0, (Number(hd && hd.renewCount) || 0) - ds.length) };
  }

  /** Số thứ tự phụ lục (1, 2, ...) của một dòng lịch sử trong hợp đồng; 0 nếu không thấy */
  function soThuTu(hd, idBan) {
    const i = lichSu(hd).muc.findIndex((b) => b.id === idBan);
    return i + 1;
  }

  /**
   * Nội dung phụ lục (văn bản thuần, để cửa sổ in dựng HTML). o: {
   *   hopDong: { id, start, rent, deposit, roomCode }, ban (dòng lịch sử), stt, benA: { ten, diaChi, dienThoai }, benB: { ten, cccd, dienThoai },
   *   fmt: { tien(n), ngay(s) } }
   */
  function phuLuc(o) {
    const hd = o.hopDong, b = o.ban, f = o.fmt, A = o.benA || {}, B = o.benB || {};
    const ngayKy = b.at ? D.chuoiNgay(b.at) : b.tuNgay;
    const dieu = [];
    dieu.push({ tieu: 'Gia hạn thời hạn thuê',
      noi: `Hai bên thống nhất gia hạn thời hạn thuê phòng ${hd.roomCode} thêm ${b.soThang} tháng, từ ngày ${f.ngay(b.tuNgay)} đến ngày ${f.ngay(b.denNgay)}.` });
    dieu.push({ tieu: 'Giá thuê',
      noi: b.giaCu !== b.giaMoi
        ? `Từ ngày ${f.ngay(b.tuNgay)}, giá thuê được điều chỉnh từ ${f.tien(b.giaCu)}/tháng thành ${f.tien(b.giaMoi)}/tháng.`
        : `Giá thuê giữ nguyên ${f.tien(b.giaMoi)}/tháng.` });
    dieu.push({ tieu: 'Tiền đặt cọc',
      noi: Number(hd.deposit) > 0
        ? `Khoản tiền đặt cọc ${f.tien(hd.deposit)} tiếp tục do Bên A giữ để bảo đảm thực hiện hợp đồng trong thời gian gia hạn.`
        : 'Hợp đồng không có tiền đặt cọc.' });
    dieu.push({ tieu: 'Các nội dung khác',
      noi: `Các điều khoản khác của Hợp đồng số ${hd.id} không thay đổi và tiếp tục có hiệu lực trong thời gian gia hạn.` });
    dieu.push({ tieu: 'Hiệu lực',
      noi: 'Phụ lục này có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.' });
    return {
      tieuDe: 'PHỤ LỤC HỢP ĐỒNG THUÊ PHÒNG TRỌ',
      phu: 'Gia hạn thời hạn thuê',
      so: `PL${pad(o.stt || 1)}/${hd.id}`,
      ngayKy,
      canCu: `Căn cứ Hợp đồng thuê phòng trọ số ${hd.id}${hd.start ? ' ký ngày ' + f.ngay(hd.start) : ''} giữa ${A.ten || 'Bên A'} và ${B.ten || 'Bên B'}.`,
      benA: A, benB: B, dieu,
    };
  }

  const api = { tinhGiaHan, banGhi, lichSu, soThuTu, phuLuc, TOI_DA_THANG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.renewal = api; }
})(typeof window !== 'undefined' ? window : globalThis);

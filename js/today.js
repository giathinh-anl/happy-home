/* ============================================================
   Happy Home — "Hôm nay cần làm gì": gom việc của chủ trọ thành một danh sách xếp theo mức gấp

   Thuần, không đụng DOM (tests/today.test.js). Việc thô do store.todayItems() dựng từ dữ liệu thật;
   ở đây chỉ xếp thứ tự, ẩn những việc đã hoãn, và nhớ lại việc nào nặng thêm.

   Mức: 1 = gấp (đỏ), 2 = nên làm hôm nay (vàng), 3 = sắp tới (xanh)
   Việc thô: { id, loai, muc, n, tien?, bid, tieuDe, phuDe?, href, nhanNut }
   Hoãn: { [id]: { den: 'YYYY-MM-DD', muc, n } } = ẩn cho tới (không gồm) ngày `den`; hiện lại sớm hơn nếu việc gấp hơn hoặc nhiều hơn lúc hoãn.
   ============================================================ */
(function (root) {
  const MUC = { 1: { nhan: 'Gấp', tone: 'bad' }, 2: { nhan: 'Hôm nay', tone: 'warn' }, 3: { nhan: 'Sắp tới', tone: 'info' } };

  const pad = (n) => String(n).padStart(2, '0');
  /** Khóa ngày theo giờ địa phương (không dùng toISOString: lệch ngày ở múi giờ + 7) */
  const ngayKey = (d) => { const x = d ? new Date(d) : new Date(); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };

  function sapXep(items) {
    return (items || []).slice().sort((a, b) => (a.muc - b.muc) || ((b.tien || 0) - (a.tien || 0)) || ((b.n || 0) - (a.n || 0)) || String(a.id).localeCompare(String(b.id)));
  }

  /** Ngày hết hoãn: mặc định sang ngày mai */
  function hoanDen(homNay, soNgay) {
    const d = homNay ? new Date(homNay) : new Date();
    return ngayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + (soNgay || 1)));
  }

  /** Một việc có đang bị ẩn không */
  function dangHoan(it, hoan, homNay) {
    const h = hoan && hoan[it.id];
    if (!h || !(h.den > ngayKey(homNay))) return false;
    if (it.muc < h.muc) return false;                    // gấp hơn lúc hoãn
    if ((it.n || 0) > (h.n || 0)) return false;          // nhiều hơn lúc hoãn
    return true;
  }

  function boLoc(items, hoan, homNay) {
    const hien = [], daHoan = [];
    (items || []).forEach((it) => (dangHoan(it, hoan, homNay) ? daHoan : hien).push(it));
    return { hien: sapXep(hien), daHoan: sapXep(daHoan) };
  }

  /** Ghi nhận hoãn (trả về bản mới, không sửa bản cũ) */
  function themHoan(hoan, it, homNay, soNgay) {
    return Object.assign({}, hoan, { [it.id]: { den: hoanDen(homNay, soNgay), muc: it.muc, n: it.n || 0 } });
  }
  function boHoan(hoan, id) { const o = Object.assign({}, hoan); delete o[id]; return o; }
  /** Dọn các mục hoãn đã hết hạn để khỏi phình mãi */
  function donHoan(hoan, homNay) {
    const hn = ngayKey(homNay), o = {};
    Object.keys(hoan || {}).forEach((k) => { if (hoan[k] && hoan[k].den > hn) o[k] = hoan[k]; });
    return o;
  }

  function tomTat(hien) {
    const t = { tong: (hien || []).length, gap: 0, homNay: 0, sapToi: 0 };
    (hien || []).forEach((i) => { if (i.muc === 1) t.gap++; else if (i.muc === 2) t.homNay++; else t.sapToi++; });
    return t;
  }

  const api = { MUC, ngayKey, sapXep, hoanDen, dangHoan, boLoc, themHoan, boHoan, donHoan, tomTat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.today = api; }
})(typeof window !== 'undefined' ? window : globalThis);

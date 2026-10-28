/* ============================================================
   Happy Home — Tiến độ xử lý sự cố (báo hỏng có theo dõi)

   Không đụng DOM nên chạy kiểm thử được bằng node (tests/progress.test.js).
   Dùng cho cả web chủ trọ và app khách thuê.

   Một sự cố có: status (open | processing | done), và `history` là danh sách sự kiện đã xảy ra:
     { at: ISO, loai, by, ghiChu?, congKhai, tho?, thoSdt?, ngayHen?, chiPhi? }
   loai: tiep-nhan | bat-dau | hen-tho | ghi-chu | hoan-tat | mo-lai
   congKhai = khách thấy sự kiện này trong app. Ghi chú nội bộ (congKhai = false) và chi phí KHÔNG bao giờ gửi cho khách
   (máy chủ lọc, xem supabase/migration-incident-tracking.sql).

   Sự cố cũ không có history vẫn hiển thị được: dựng lại các mốc từ ngày báo / trạng thái / ngày hoàn tất.
   ============================================================ */
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./dates.js') : root.HH.dates;

  const LOAI = {
    'tiep-nhan': { nhan: 'Đã tiếp nhận',        congKhai: true },
    'bat-dau':   { nhan: 'Bắt đầu xử lý',       congKhai: true },
    'hen-tho':   { nhan: 'Hẹn thợ',             congKhai: true },
    'ghi-chu':   { nhan: 'Ghi chú',             congKhai: false },
    'hoan-tat':  { nhan: 'Đã sửa xong',         congKhai: true },
    'mo-lai':    { nhan: 'Mở lại',              congKhai: true },
  };
  const NGAY_QUA_LAU = 7;           // mở quá số ngày này thì coi là chậm
  const TRAN_CHI_PHI = 1e9;

  const chuoi = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max || 500);

  /** Dựng một sự kiện. congKhai mặc định theo loại (ghi chú mặc định là nội bộ). */
  function suKien(loai, o) {
    const x = o || {};
    const e = { at: x.at || new Date().toISOString(), loai, by: x.by || 'Chủ trọ',
      congKhai: x.congKhai == null ? !!(LOAI[loai] && LOAI[loai].congKhai) : !!x.congKhai };
    if (x.ghiChu) e.ghiChu = chuoi(x.ghiChu);
    if (x.tho) e.tho = chuoi(x.tho, 80);
    if (x.thoSdt) e.thoSdt = chuoi(x.thoSdt, 20);
    if (x.ngayHen) e.ngayHen = x.ngayHen;
    if (x.chiPhi != null) e.chiPhi = x.chiPhi;
    return e;
  }

  const hopLe = (e) => e && LOAI[e.loai] && D.soNgayLich(e.at) != null;
  const thuTu = (a, b) => new Date(a.at) - new Date(b.at);

  /**
   * Dòng thời gian đầy đủ của một sự cố, cũ đến mới. Luôn bắt đầu bằng "Đã tiếp nhận". Sự cố cũ thiếu mốc thì
   * bù mốc không có giờ (at = null) để vẫn thấy đủ các bước.
   */
  function dongThoiGian(inc) {
    const i = inc || {};
    const ev = (Array.isArray(i.history) ? i.history : []).filter(hopLe).slice().sort(thuTu);
    const out = [];
    if (!ev.some((e) => e.loai === 'tiep-nhan')) out.push({ at: i.createdAt || null, loai: 'tiep-nhan', by: 'Hệ thống', congKhai: true, suy: true });
    if (i.status && i.status !== 'open' && !ev.some((e) => e.loai === 'bat-dau' || e.loai === 'hen-tho' || e.loai === 'hoan-tat'))
      out.push({ at: null, loai: 'bat-dau', by: 'Hệ thống', congKhai: true, suy: true });
    out.push(...ev);
    if (i.status === 'done' && !ev.some((e) => e.loai === 'hoan-tat'))
      out.push({ at: i.doneAt || null, loai: 'hoan-tat', by: 'Hệ thống', congKhai: true, suy: true });
    return out;
  }

  /** Ba bước tiến độ cho khách: tiếp nhận, đang xử lý, hoàn tất (kèm giờ của mốc đó nếu có) */
  function buocTienDo(inc) {
    const tl = dongThoiGian(inc);
    const mocLan = (loais) => { const l = tl.filter((e) => loais.indexOf(e.loai) >= 0); return l.length ? l[0].at : null; };
    const st = (inc && inc.status) || 'open';
    return [
      { ma: 'tiep-nhan', nhan: 'Đã tiếp nhận', xong: true, dangLam: false, at: mocLan(['tiep-nhan']) },
      { ma: 'xu-ly', nhan: 'Đang xử lý', xong: st === 'processing' || st === 'done', dangLam: st === 'processing', at: mocLan(['bat-dau', 'hen-tho']) },
      { ma: 'hoan-tat', nhan: 'Hoàn tất', xong: st === 'done', dangLam: false, at: st === 'done' ? mocLan(['hoan-tat']) : null },
    ];
  }

  /** Cập nhật tiến độ. Trả { ok, patch } (patch gộp vào sự cố) hoặc { ok:false, loi }. Không sửa sự cố gốc. */
  function capNhat(inc, act, homNay) {
    const a = act || {}, st = (inc && inc.status) || 'open';
    const hn = homNay || new Date();
    const lanh = chuoi(a.ghiChu);
    const by = a.by || 'Chủ trọ';
    let loai = a.loai, status = st;
    const patch = {};
    const ev = { at: a.at || new Date().toISOString(), by, ghiChu: lanh, congKhai: a.congKhai };

    if (loai === 'bat-dau') {
      if (st !== 'open') return { ok: false, loi: st === 'done' ? 'Sự cố đã xong, hãy mở lại trước.' : 'Sự cố đang được xử lý rồi.' };
      status = 'processing';
    } else if (loai === 'hen-tho') {
      if (st === 'done') return { ok: false, loi: 'Sự cố đã xong, hãy mở lại trước khi hẹn thợ.' };
      const n = D.chenhNgay(hn, a.ngayHen);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.ngayHen || '')) || isNaN(n)) return { ok: false, loi: 'Chọn ngày hẹn thợ.' };
      if (n < 0) return { ok: false, loi: 'Ngày hẹn đã qua, chọn từ hôm nay trở đi.' };
      if (n > 180) return { ok: false, loi: 'Ngày hẹn xa quá 6 tháng, kiểm tra lại.' };
      ev.ngayHen = a.ngayHen; patch.scheduledFor = a.ngayHen;
      const tho = chuoi(a.tho, 80), sdt = chuoi(a.thoSdt, 20);
      if (tho) { ev.tho = tho; patch.assignee = tho; }
      if (sdt) { ev.thoSdt = sdt; patch.assigneePhone = sdt; }
      status = 'processing';
    } else if (loai === 'ghi-chu') {
      if (lanh.length < 3) return { ok: false, loi: lanh ? 'Ghi chú quá ngắn.' : 'Nhập nội dung ghi chú.' };
    } else if (loai === 'hoan-tat') {
      if (st === 'done') return { ok: false, loi: 'Sự cố đã xong rồi.' };
      if (a.chiPhi != null && a.chiPhi !== '') {
        const c = Number(a.chiPhi);
        if (!Number.isFinite(c) || c < 0 || c > TRAN_CHI_PHI || Math.round(c) !== c) return { ok: false, loi: 'Chi phí phải là số tiền từ 0 đến 1 tỷ đồng.' };
        ev.chiPhi = c; patch.cost = c;
        patch.costPayer = a.nguoiChiu === 'khach' ? 'khach' : 'chu';
      }
      status = 'done'; patch.doneAt = ev.at;
    } else if (loai === 'mo-lai') {
      if (st !== 'done') return { ok: false, loi: 'Sự cố chưa xong nên không cần mở lại.' };
      status = 'open'; patch.doneAt = null;
    } else return { ok: false, loi: 'Việc không hợp lệ.' };

    const e = suKien(loai, ev);
    patch.status = status;
    patch.history = (Array.isArray(inc && inc.history) ? inc.history : []).concat([e]);
    return { ok: true, patch, suKien: e };
  }

  /** Lần hẹn thợ gần nhất của sự cố còn đang xử lý: { ngayHen, tho, thoSdt } hoặc null. Sự cố đã xong thì không còn lịch. */
  function lichHen(inc) {
    if (!inc || inc.status === 'done') return null;
    const l = dongThoiGian(inc).filter((e) => e.loai === 'hen-tho' && e.ngayHen);
    if (!l.length) return null;
    const e = l[l.length - 1];
    return { ngayHen: e.ngayHen, tho: e.tho || '', thoSdt: e.thoSdt || '' };
  }

  /** Thông tin để chủ trọ lọc / nhắc: số ngày mở, quá lâu, lịch hẹn (số ngày tới ngày hẹn) */
  function tinhTrang(inc, homNay) {
    const hn = homNay || new Date();
    const mo = inc.status === 'done' || !inc.createdAt ? 0 : Math.max(0, D.chenhNgay(inc.createdAt, hn));
    const hen = inc.status !== 'done' && inc.scheduledFor ? D.chenhNgay(hn, inc.scheduledFor) : null;
    return { soNgayMo: mo, quaLau: inc.status !== 'done' && mo > NGAY_QUA_LAU, ngayToiHen: hen };
  }

  /** Chi phí sửa chữa đã hoàn tất trong [tu, den] (theo ngày hoàn tất). nguoiChiu: 'chu' (mặc định) | 'khach' | 'tat-ca' */
  function tongChiPhi(ds, tu, den, nguoiChiu) {
    const t = D.soNgayLich(tu), d = D.soNgayLich(den), ai = nguoiChiu || 'chu';
    return (ds || []).reduce((s, x) => {
      if (x.status !== 'done' || !(x.cost > 0)) return s;
      const n = D.soNgayLich(x.doneAt);
      if (n == null || (t != null && n < t) || (d != null && n > d)) return s;
      const payer = x.costPayer === 'khach' ? 'khach' : 'chu';
      return (ai === 'tat-ca' || ai === payer) ? s + x.cost : s;
    }, 0);
  }

  const api = { LOAI, NGAY_QUA_LAU, suKien, dongThoiGian, buocTienDo, capNhat, lichHen, tinhTrang, tongChiPhi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.progress = api; }
})(typeof window !== 'undefined' ? window : globalThis);

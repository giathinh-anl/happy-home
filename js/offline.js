/* ============================================================
   Happy Home — Ghi chỉ số khi mất mạng (hoặc mạng yếu)

   Vấn đề: dữ liệu nằm trong bộ nhớ trang rồi đẩy lên Supabase sau mỗi thay đổi. Đang ghi chỉ số ở tầng hầm mà mất mạng thì
   lần đẩy lỗi, và chỉ cần trang bị tải lại (điện thoại tự đóng thẻ nền) là mất sạch những gì vừa ghi.

   Phần THUẦN ở đây (không đụng DOM, có kiểm thử: tests/offline.test.js):
   - HÀNG ĐỢI: chỉ số điện đã ghi mà máy chủ chưa nhận, lưu bền trong máy (localStorage). Khi có mạng thì đối chiếu với máy chủ:
     máy chủ chưa đổi kể từ lúc ghi thì áp dụng; đã có người đổi (khách tự gửi, nhân viên khác) thì báo XUNG ĐỘT cho chủ trọ quyết,
     KHÔNG bao giờ ghi đè âm thầm. Số nhỏ hơn kỳ trước (không có bù quay vòng / thay đồng hồ) cũng không tự áp dụng.
   - ẢNH CHỤP TỐI THIỂU để mở được trang ghi chỉ số khi cả web không có mạng: chỉ tòa nhà, phòng (mã, trạng thái, tên khách) và chỉ số
     vài kỳ gần nhất. KHÔNG có CCCD, số điện thoại, ngày sinh, địa chỉ, hóa đơn, ảnh đồng hồ. Xóa khi đăng xuất.
   ============================================================ */
(function (root) {
  const KHOA_ANH = 'hh_offline_anh_v1', KHOA_DOI = 'hh_offline_doi_v1';
  const SO_KY = 3;                       // giữ chỉ số của ngần này kỳ gần nhất (đủ để biết kỳ trước)

  const khoa = (r) => `${r.buildingId}|${r.roomCode}|${r.period}`;
  const soHopLe = (v) => v == null || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
  const chu = (v) => v == null ? '' : String(v);

  /** "Chữ ký" của một chỉ số: phần quyết định tiền điện (chỉ số mới + phần bù). null = chưa có bản ghi. Hai bản có cùng chữ ký là cùng số. */
  const chuKy = (r) => r ? chu(soHopLe(r.elecCurr)) + '|' + chu(soHopLe(r.elecExtra)) : null;
  const trong = (sig) => sig === '|';
  /** Phần số của bản ghi máy chủ để hiện cho chủ trọ và lưu trong máy (dòng gốc có thể kèm ảnh đồng hồ nặng vài trăm KB: không mang theo) */
  const gon = (r) => r ? { elecCurr: soHopLe(r.elecCurr), elecPrev: soHopLe(r.elecPrev), elecExtra: soHopLe(r.elecExtra), source: r.source || 'staff' } : null;     // bản ghi có nhưng chưa ghi số nào

  /** Ảnh chụp tối thiểu từ dữ liệu đã tải. Không có dữ liệu riêng tư của khách (xem đầu tệp). */
  function anhChup(data, o) {
    const x = o || {}, d = data || {};
    const ky = Array.from(new Set((d.readings || []).map((r) => r.period).filter(Boolean))).sort().reverse().slice(0, x.soKy || SO_KY);
    return {
      v: 1, at: x.at || new Date().toISOString(), owner: x.owner || null, role: x.role || 'owner', userName: x.userName || '',
      permissions: Array.isArray(x.permissions) ? x.permissions.slice() : null,
      buildings: (d.buildings || []).map((b) => ({ id: b.id, name: b.name })),
      rooms: (d.rooms || []).map((r) => ({ id: r.id, buildingId: r.buildingId, code: r.code, status: r.status, tenantName: r.tenantName || '', floor: r.floor == null ? null : r.floor })),
      readings: (d.readings || []).filter((r) => ky.indexOf(r.period) >= 0).map((r) => ({
        id: r.id, buildingId: r.buildingId, roomCode: r.roomCode, period: r.period, elecPrev: soHopLe(r.elecPrev), elecCurr: soHopLe(r.elecCurr),
        elecExtra: soHopLe(r.elecExtra), elecAvg: soHopLe(r.elecAvg), elecMeterChanged: !!r.elecMeterChanged, source: r.source || 'staff', approved: r.approved !== false })),
    };
  }

  /** Ảnh đọc từ bộ nhớ có đúng dạng không (bộ nhớ có thể hỏng hoặc bị sửa tay). Trả ảnh, hoặc null. */
  function anhHopLe(a) {
    if (!a || typeof a !== 'object' || a.v !== 1 || !Array.isArray(a.buildings) || !Array.isArray(a.rooms) || !Array.isArray(a.readings)) return null;
    const ok = (arr, f) => arr.every((x) => x && typeof x === 'object' && f(x));
    if (!ok(a.buildings, (b) => b.id) || !ok(a.rooms, (r) => r.id && r.buildingId && r.code) || !ok(a.readings, (r) => r.id && r.buildingId && r.roomCode && r.period)) return null;
    return a;
  }

  /** Ảnh cũ bao nhiêu ngày (làm tròn xuống); null nếu không biết */
  function tuoiAnh(a, homNay) {
    const t = a && a.at ? new Date(a.at).getTime() : NaN, h = (homNay ? new Date(homNay) : new Date()).getTime();
    return Number.isFinite(t) ? Math.max(0, Math.floor((h - t) / 86400000)) : null;
  }

  /**
   * Hàng đợi chỉ số chưa gửi. readings: chỉ số hiện có trong bộ nhớ; goc: { khóa: chữ ký máy chủ đã biết } (thiếu khóa = máy chủ chưa có);
   * doc: hàng đợi lưu trước đó ({ owner, items, xungDot }) để giữ mốc `base` ban đầu và các mục chưa quyết.
   * Mục nào khác máy chủ đã biết thì nằm trong hàng đợi; đã trùng (đã gửi xong, hoặc sửa về số cũ) thì bị bỏ. Dòng chỉ số đã biến mất
   * khỏi bộ nhớ (xóa tòa nhà) thì mục của nó cũng bỏ: gọi hàm này SAU khi đã đưa mục cũ vào bộ nhớ (store.js làm việc đó trước).
   */
  function tinhHangDoi(o) {
    const x = o || {}, cu = (x.doc && x.doc.items) || [], theoKhoa = {}, goc = x.goc || {};
    cu.forEach((it) => { theoKhoa[it.khoa] = it; });
    const items = [];
    (x.readings || []).forEach((r) => {
      const k = khoa(r);
      const hienTai = chuKy(r), daBiet = Object.prototype.hasOwnProperty.call(goc, k) ? goc[k] : null;
      if (hienTai === daBiet) return;                         // trùng máy chủ: không cần gửi
      if (daBiet === null && trong(hienTai)) return;          // dòng trống mới tạo, chưa ghi số nào: không có gì để gửi
      const truoc = theoKhoa[k];
      items.push({ khoa: k, buildingId: r.buildingId, roomCode: r.roomCode, period: r.period,
        elecCurr: soHopLe(r.elecCurr), elecPrev: soHopLe(r.elecPrev), elecExtra: soHopLe(r.elecExtra), elecMeterChanged: !!r.elecMeterChanged,
        elecAvg: soHopLe(r.elecAvg), sig: hienTai,
        base: truoc && truoc.base !== undefined ? truoc.base : daBiet,         // số máy chủ lúc bắt đầu sửa, giữ nguyên qua nhiều lần sửa
        at: truoc && truoc.sig === hienTai ? truoc.at : (x.at || new Date().toISOString()) });
    });
    return { owner: x.owner || (x.doc && x.doc.owner) || null, items, xungDot: (x.doc && x.doc.xungDot) || [] };
  }

  /** Số này có đáng ngờ (nhỏ hơn kỳ trước mà không khai quay vòng / thay đồng hồ)? Không tự áp dụng, để chủ trọ xem */
  function nhoHonKyTruoc(it) {
    return it.elecCurr != null && it.elecPrev != null && it.elecCurr < it.elecPrev && !(it.elecExtra > 0) && !it.elecMeterChanged;
  }

  /**
   * Đối chiếu hàng đợi với chỉ số hiện có trên máy chủ. server: { khóa: bản ghi chỉ số trên máy chủ } (thiếu khóa = chưa có).
   * Trả { apDung, daCo, canXem }; mỗi phần tử canXem: { item, server ({elecCurr, elecPrev, elecExtra, source} của máy chủ, hoặc null), lyDo: 'xung-dot' | 'nho-hon' }
   *  - máy chủ đã đúng bằng số đã ghi -> daCo (bỏ)
   *  - máy chủ chưa có số, hoặc vẫn là số lúc mình bắt đầu sửa -> apDung (nếu số không đáng ngờ)
   *  - máy chủ có số KHÁC cả hai (ai đó đã đổi) -> canXem 'xung-dot'
   *  - số nhỏ hơn kỳ trước -> canXem 'nho-hon'
   */
  function hopNhat(server, items) {
    const kq = { apDung: [], daCo: [], canXem: [] }, sv = server || {};
    (items || []).forEach((it) => {
      const bg = Object.prototype.hasOwnProperty.call(sv, it.khoa) ? sv[it.khoa] : null, s = chuKy(bg);
      if (s === it.sig) kq.daCo.push(it);
      else if (s !== null && !trong(s) && s !== it.base) kq.canXem.push({ item: it, server: gon(bg), lyDo: 'xung-dot' });
      else if (nhoHonKyTruoc(it)) kq.canXem.push({ item: it, server: gon(bg), lyDo: 'nho-hon' });
      else kq.apDung.push(it);
    });
    return kq;
  }

  /** Ghi số của một mục hàng đợi vào mảng chỉ số trong bộ nhớ: sửa dòng đã có, hoặc thêm dòng mới (uid() cấp mã). Trả dòng đó. */
  function apDungVao(readings, it, uid) {
    let rd = readings.find((r) => khoa(r) === it.khoa);
    const coBu = it.elecExtra != null || it.elecMeterChanged;
    if (!rd) {
      rd = { id: uid(), buildingId: it.buildingId, roomCode: it.roomCode, period: it.period, elecPrev: it.elecPrev == null ? 0 : it.elecPrev,
        elecCurr: null, elecPhoto: false, elecAvg: it.elecAvg == null ? 190 : it.elecAvg, source: 'staff', approved: true };
      readings.push(rd);
    }
    rd.elecCurr = it.elecCurr;
    if (coBu) { rd.elecPrev = it.elecPrev; rd.elecExtra = it.elecExtra; if (it.elecMeterChanged) rd.elecMeterChanged = true; }
    else if (rd.elecExtra != null) { delete rd.elecExtra; }    // chủ trọ đã bỏ phần bù
    return rd;
  }

  /* ---------- Lưu trong máy (localStorage); lỗi lưu (đầy, bị chặn) thì bỏ qua êm, chỉ mất tiện ích này ---------- */
  const kho = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
  const doc = (k) => { const s = kho(); if (!s) return null; try { return JSON.parse(s.getItem(k) || 'null'); } catch (e) { return null; } };
  const ghi = (k, v) => { const s = kho(); if (!s) return false; try { if (v == null) s.removeItem(k); else s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const hangDoiTrong = (d) => !d || (!(d.items && d.items.length) && !(d.xungDot && d.xungDot.length));

  const api = { khoa, chuKy, anhChup, anhHopLe, tuoiAnh, tinhHangDoi, hopNhat, apDungVao, nhoHonKyTruoc, SO_KY,
    docAnh: () => anhHopLe(doc(KHOA_ANH)), luuAnh: (a) => ghi(KHOA_ANH, a), xoaAnh: () => ghi(KHOA_ANH, null),
    docHangDoi: () => { const d = doc(KHOA_DOI); return d && Array.isArray(d.items) ? { owner: d.owner || null, items: d.items, xungDot: Array.isArray(d.xungDot) ? d.xungDot : [] } : null; },
    luuHangDoi: (d) => ghi(KHOA_DOI, hangDoiTrong(d) ? null : d),
    mode: false };      // true khi đang chạy ngoại tuyến từ ảnh chụp (app.js đặt)
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.offline = api; }
})(typeof window !== 'undefined' ? window : globalThis);

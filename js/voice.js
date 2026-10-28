/* ============================================================
   Happy Home — Nhập liệu bằng giọng nói tiếng Việt

   Trình duyệt chỉ đổi giọng thành CHỮ (Web Speech API). Việc hiểu chữ đó thành "phòng nào, chỉ số bao nhiêu" nằm ở đây,
   không đụng DOM nên chạy kiểm thử được bằng node (tests/voice.test.js).

   Nguyên tắc: giọng nói dễ nghe nhầm, nên KHÔNG BAO GIỜ ghi thẳng. Phần này chỉ đưa ra danh sách "nghe được thế này", kèm
   cảnh báo (nhỏ hơn kỳ trước, cao bất thường, ghi đè số đã có), người dùng xem và bấm xác nhận mới lưu.

   Hiểu được:  "phòng 101 điện 1250"  ·  "phòng một không một điện một nghìn hai trăm năm mươi"  ·  nhiều phòng một câu
               ·  số viết 1.250 / 1 250  ·  đọc từng chữ số (một không một = 101)  ·  đọc cả số (một trăm linh một = 101)
   ============================================================ */
(function (root) {
  /** Bỏ dấu tiếng Việt, chữ thường: "Phòng Một" -> "phong mot" */
  const bo = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

  const CHU_SO = { khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9 };
  const NHAN = { muoi: 'chuc', chuc: 'chuc', tram: 'tram', nghin: 'nghin', ngan: 'nghin', trieu: 'trieu' };
  const LINH = { linh: 1, le: 1 };          // "một trăm linh một": số 0 ở hàng chục
  // tiếng ậm ừ: bỏ qua, KHÔNG ngắt số đang đọc ("một nghìn ừm hai trăm" vẫn là 1200). Mọi từ khác (là, số, bằng...) ngắt cụm số.
  const AM_U = new Set(['um', 'uhm', 'u', 'o', 'a', 'e', 'hm']);
  const TU_PHONG = new Set(['phong', 'phog']);
  const TU_DIEN = new Set(['dien', 'chi', 'chiso']);   // "điện", "chỉ số"

  /** Tách chuỗi nói thành các từ. Số kiểu 1.250 / 1,250 được gộp thành 1250 trước (nhóm nghìn). */
  function tachTu(text) {
    let s = bo(text).replace(/(\d{1,3})([.,]\d{3})+(?!\d)/g, (m) => m.replace(/[.,]/g, ''));
    s = s.replace(/[^a-z0-9\s]/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');
    return s.split(/\s+/).filter(Boolean);
  }

  const laSo = (t) => /^\d+$/.test(t) || Object.prototype.hasOwnProperty.call(CHU_SO, t) || !!NHAN[t] || !!LINH[t];
  const laChuSoDon = (t) => /^\d$/.test(t) || Object.prototype.hasOwnProperty.call(CHU_SO, t);
  const giaTriChuSo = (t) => (/^\d$/.test(t) ? Number(t) : CHU_SO[t]);

  /**
   * Một cụm từ-số -> số. Trả { gia_tri, chuSo } (chuSo = dạng chuỗi các chữ số khi đọc TỪNG SỐ, để ghép mã phòng) hoặc null.
   * - Toàn chữ số đơn (không, một, 5...) từ 2 chữ số trở lên: đọc từng số, ghép lại ("một không một" = 101).
   * - Có từ chỉ cấp (mươi, trăm, nghìn, triệu): đọc cả số ("một trăm linh một" = 101, "hai nghìn không trăm linh năm" = 2005).
   * - Số viết bằng chữ số (1250): giữ nguyên.
   */
  function docCum(tokens) {
    if (!tokens.length) return null;
    if (tokens.length === 1 && /^\d+$/.test(tokens[0])) return { gia_tri: Number(tokens[0]), chuSo: tokens[0] };
    if (tokens.every((t) => /^\d+$/.test(t))) { const j = tokens.join(''); return { gia_tri: Number(j), chuSo: j }; }   // "1 2 5 0" hoặc "125 0"
    if (tokens.length >= 2 && tokens.every(laChuSoDon)) { const j = tokens.map(giaTriChuSo).join(''); return { gia_tri: Number(j), chuSo: j }; }
    if (tokens.length === 1 && laChuSoDon(tokens[0])) { const v = giaTriChuSo(tokens[0]); return { gia_tri: v, chuSo: String(v) }; }

    let tong = 0, nhom = 0, cho = null, coNghin = false, chuSoCuoiNhom = 0, thayDoi = false;
    const dongNhom = (heSo) => { nhom += cho == null ? 0 : cho; tong += nhom * heSo; nhom = 0; cho = null; };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (/^\d+$/.test(t)) { cho = Number(t); thayDoi = true; continue; }
      if (Object.prototype.hasOwnProperty.call(CHU_SO, t)) { cho = CHU_SO[t]; thayDoi = true; continue; }
      const n = NHAN[t];
      if (n === 'chuc') { nhom += (cho == null ? 1 : cho) * 10; cho = null; thayDoi = true; }
      else if (n === 'tram') { nhom += (cho == null ? 1 : cho) * 100; cho = null; thayDoi = true; }
      else if (n === 'nghin') { dongNhom(1000); coNghin = true; chuSoCuoiNhom = 0; }
      else if (n === 'trieu') { dongNhom(1000000); }
    }
    // "một nghìn hai" nói gọn là 1200: một chữ số lẻ ngay sau nghìn nghĩa là hàng trăm
    if (coNghin && cho != null && nhom === 0 && cho >= 1 && cho <= 9 && tokens.length >= 3 && NHAN[tokens[tokens.length - 2]] === 'nghin') { tong += cho * 100; cho = null; }
    nhom += cho == null ? 0 : cho; tong += nhom;
    return thayDoi || tong ? { gia_tri: tong, chuSo: String(tong) } : null;
  }

  /** Số từ chữ: "một nghìn hai trăm năm mươi" -> 1250. Không phải số thì null. */
  function docSo(text) {
    const tokens = tachTu(text).filter((t) => laSo(t));
    const r = docCum(tokens);
    return r ? r.gia_tri : null;
  }

  /**
   * Hiểu câu nói thành danh sách { phong, soPhong, chiSo, goc, loi }.
   * phongHopLe: mảng mã phòng của tòa (VD ['P101', 'P102']). Trả { muc, khongHieu }.
   * muc[i].loi: null | 'khong-co-phong' (số phòng nghe được không có trong tòa) | 'trung-phong' (hai phòng cùng số)
   *            | 'thieu-chi-so' | 'thieu-phong'.
   */
  function phanTichChiSo(text, phongHopLe) {
    const tokens = tachTu(text);
    const phong = phongHopLe || [];
    // Gom thành các cụm số. Từ khóa "phòng" / "điện, chỉ số" đặt vai trò cho cụm số ĐỨNG SAU nó; cụm không có từ khóa thì suy ra theo thứ tự.
    // Số nhiều chữ số (101, 1250) luôn đứng riêng một cụm.
    const cum = [];
    let cur = null, vaiCur = null, tuKhoa = null, ghi = [];
    // vai trò của cụm mới: theo từ khóa đứng trước, không có thì suy ra (sau phòng là chỉ số, còn lại là phòng)
    const suyRa = () => (tuKhoa || (cum.length && cum[cum.length - 1].vaiTro === 'phong' ? 'chiso' : 'phong'));
    const dong = () => { if (cur && cur.length) { cum.push({ tokens: cur, vaiTro: vaiCur, goc: ghi.join(' ') }); tuKhoa = null; } cur = null; ghi = []; };
    tokens.forEach((t) => {
      if (TU_PHONG.has(t)) { dong(); tuKhoa = 'phong'; ghi = [t]; return; }
      if (TU_DIEN.has(t)) { dong(); tuKhoa = 'chiso'; ghi = [t]; return; }
      if (laSo(t)) {
        const nhieu = /^\d{2,}$/.test(t);
        if (cur) {
          const truoc = cur[cur.length - 1];
          // "1 250" khi đang đọc chỉ số là 1250 (nhóm nghìn), không phải hai số
          if (nhieu && vaiCur === 'chiso' && cur.length === 1 && /^\d{1,3}$/.test(truoc) && /^\d{3}$/.test(t)) { cur[0] = truoc + t; ghi.push(t); return; }
          if (nhieu || /^\d{2,}$/.test(truoc)) dong();
        }
        if (!cur) { cur = []; vaiCur = suyRa(); }
        cur.push(t); ghi.push(t);
        return;
      }
      if (AM_U.has(t)) return;
      dong();                                          // từ khác giữa hai cụm số: ngắt cụm
    });
    dong();

    const muc = [], khongHieu = [];
    let dang = null;
    const chotDang = () => { if (dang) { dang.loi = dang.loi || (dang.chiSo == null ? 'thieu-chi-so' : null); muc.push(dang); dang = null; } };
    cum.forEach((c) => {
      const so = docCum(c.tokens);
      if (!so) { khongHieu.push(c.goc); return; }
      if (c.vaiTro === 'phong') {
        chotDang();
        const hop = phong.filter((m) => m.replace(/\D/g, '') === so.chuSo);
        dang = { phong: hop.length === 1 ? hop[0] : null, soPhong: so.chuSo, chiSo: null, goc: c.goc, loi: hop.length === 0 ? 'khong-co-phong' : hop.length > 1 ? 'trung-phong' : null };
      } else {
        if (!dang) { khongHieu.push(c.goc); return; }                       // chỉ số mà chưa biết của phòng nào
        if (dang.chiSo != null) { chotDang(); khongHieu.push(c.goc); return; }  // hai chỉ số liền nhau cho một phòng
        dang.chiSo = so.gia_tri; dang.goc += ' ' + c.goc;
      }
    });
    chotDang();
    return { muc, khongHieu };
  }

  /** Đánh giá một chỉ số vừa nghe được so với kỳ trước. Trả { loai: 'ok'|'canh-bao'|'sai', ghiChu, tieuThu } */
  function danhGia(o) {
    const x = o || {};
    if (x.chiSo == null || !Number.isFinite(x.chiSo)) return { loai: 'sai', ghiChu: 'Chưa có chỉ số', tieuThu: null };
    const truoc = x.truoc == null ? 0 : x.truoc, tb = x.trungBinh || 190;
    if (x.chiSo < truoc) return { loai: 'sai', ghiChu: `Nhỏ hơn kỳ trước (${truoc})`, tieuThu: null };
    const dung = x.chiSo - truoc;
    if (dung > tb * 3) return { loai: 'canh-bao', ghiChu: `Cao gấp ${(dung / tb).toFixed(1).replace('.', ',')} lần mức thường`, tieuThu: dung };
    if (x.hienCo != null && x.hienCo !== x.chiSo) return { loai: 'canh-bao', ghiChu: `Ghi đè số đang có (${x.hienCo})`, tieuThu: dung };
    return { loai: 'ok', ghiChu: dung === 0 ? 'Bằng kỳ trước, không dùng điện' : '', tieuThu: dung };
  }

  const LOI_NGHE = {
    'not-allowed': 'Trình duyệt chưa được cấp quyền dùng micro. Bấm biểu tượng ổ khóa cạnh địa chỉ rồi cho phép micro.',
    'service-not-allowed': 'Trình duyệt không cho dùng nhận dạng giọng nói trên trang này.',
    'no-speech': 'Không nghe thấy giọng nói. Thử nói gần micro hơn.',
    'audio-capture': 'Không tìm thấy micro. Kiểm tra micro đã cắm và bật chưa.',
    'network': 'Mất mạng khi nhận dạng giọng nói. Kiểm tra kết nối rồi thử lại.',
    'language-not-supported': 'Trình duyệt này chưa hỗ trợ nhận dạng tiếng Việt.',
  };

  /* ---------- Phần chạy trong trình duyệt: Web Speech API ---------- */
  const Nhan = () => (typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null);
  const hoTro = () => !!Nhan();

  /**
   * Bắt đầu nghe. o = { onChu(chuoi, daXong), onKetThuc(), onLoi(cau), lang, lienTuc (mặc định true; false = dừng sau một câu) }. Trả { dung() } hoặc null nếu trình duyệt không hỗ trợ.
   * onChu nhận TOÀN BỘ chuỗi từ đầu phiên (đã xong + đang nói), daXong = true khi mọi đoạn đã chốt.
   */
  function nghe(o) {
    const R = Nhan(); if (!R) return null;
    const x = o || {};
    const rec = new R();
    rec.lang = x.lang || 'vi-VN'; rec.continuous = x.lienTuc !== false; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let chuoi = '', xong = true;
      for (let i = 0; i < e.results.length; i++) { chuoi += (i ? ' ' : '') + e.results[i][0].transcript; if (!e.results[i].isFinal) xong = false; }
      if (x.onChu) x.onChu(chuoi.trim(), xong);
    };
    rec.onerror = (e) => { if (e.error !== 'aborted' && x.onLoi) x.onLoi(LOI_NGHE[e.error] || ('Không nhận dạng được giọng nói (' + e.error + ')')); };
    rec.onend = () => { if (x.onKetThuc) x.onKetThuc(); };
    try { rec.start(); } catch (e) { if (x.onLoi) x.onLoi('Không bật được micro, thử lại.'); return null; }
    return { dung() { try { rec.stop(); } catch (e) {} } };
  }

  const api = { bo, tachTu, docSo, docCum, phanTichChiSo, danhGia, hoTro, nghe, LOI_NGHE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.voice = api; }
})(typeof window !== 'undefined' ? window : globalThis);

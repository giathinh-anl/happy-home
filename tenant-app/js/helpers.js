/* ============================================================
   Happy Home, app khách thuê: các hàm thuần (không đụng DOM, không gọi mạng)
   Kiểm thử ở tests/tenant-helpers.test.js. Dùng cả trong trình duyệt (HH.tenantHelpers) lẫn node.
     - installMode   nên gợi ý cài app về màn hình chính kiểu nào
     - buildIcs      tệp lịch (.ics) nhắc hạn đóng tiền
     - shareText     nội dung chia sẻ hóa đơn qua Zalo / tin nhắn
     - cache*        bản lưu dữ liệu để xem khi mất mạng (đã bỏ số CCCD, ngày sinh)
     - codeProblem   luật chọn mã vào app mới
     - meterCheck    soát số điện khách nhập hoặc AI đọc
     - parseMeterAnswer  lấy số điện từ câu trả lời của AI
     - pushMode / urlBase64ToBytes  thông báo đẩy: nên hiện nút nào, đổi khóa VAPID sang byte
   ============================================================ */
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const vnd = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
  const ymd = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
  const vnDate = (s) => { const x = ymd(s); return x ? pad(x.d) + '/' + pad(x.m) + '/' + x.y : ''; };
  const vnPeriod = (p) => { const m = /^(\d{4})-(\d{2})$/.exec(String(p || '')); return m ? 'T' + Number(m[2]) + '/' + m[1] : String(p || ''); };

  /* ---------- Cài app về màn hình chính ----------
     env = { ua, standalone, maxTouch, promptReady }
     installed: đã mở từ màn hình chính. prompt: Chrome/Edge trên Android cho cài một chạm.
     ios: iPhone/iPad phải tự bấm Chia sẻ rồi Thêm vào MH chính. other: máy tính hoặc trình duyệt không hỗ trợ, đừng gợi ý. */
  function installMode(env) {
    env = env || {};
    if (env.standalone) return 'installed';
    if (env.promptReady) return 'prompt';
    const ua = String(env.ua || '');
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (env.maxTouch || 0) > 1);
    return ios ? 'ios' : 'other';
  }

  /* ---------- Tệp lịch .ics: nhắc hạn đóng tiền, báo trước 1 ngày ---------- */
  const icsEsc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function buildIcs(inv, opt) {
    opt = opt || {};
    const d = ymd(inv && inv.dueDate);
    if (!d) return null;
    const next = new Date(Date.UTC(d.y, d.m - 1, d.d + 1));
    const day = (y, m, dd) => String(y) + pad(m) + pad(dd);
    const now = opt.now instanceof Date ? opt.now : new Date();
    const stamp = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
    const remain = Math.max(0, (Number(inv.total) || 0) - (Number(inv.paid) || 0));
    const title = 'Đóng tiền phòng' + (opt.room ? ' ' + opt.room : '') + ', ' + vnPeriod(inv.period);
    const desc = 'Còn phải đóng ' + vnd(remain) + '. Hạn ' + vnDate(inv.dueDate) + '. Mở app Happy Home để quét mã chuyển khoản.';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Happy Home//Khach thue//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + icsEsc(inv.id) + '@happyhome',
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + day(d.y, d.m, d.d),
      'DTEND;VALUE=DATE:' + day(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
      'SUMMARY:' + icsEsc(title),
      'DESCRIPTION:' + icsEsc(desc),
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:-P1D', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n') + '\r\n';
  }

  /* ---------- Nội dung chia sẻ hóa đơn ---------- */
  function shareText(inv, o) {
    o = o || {};
    const remain = Math.max(0, (Number(inv.total) || 0) - (Number(inv.paid) || 0));
    const lines = ['Hóa đơn ' + vnPeriod(inv.period) + (o.room ? ', phòng ' + o.room : '') + (o.building ? ' (' + o.building + ')' : '')];
    lines.push(remain > 0 ? 'Còn phải đóng: ' + vnd(remain) : 'Đã thanh toán đủ: ' + vnd(inv.total));
    if (inv.dueDate && remain > 0) lines.push('Hạn: ' + vnDate(inv.dueDate));
    if (remain > 0 && o.bank && o.bank.account) {
      lines.push('Chuyển khoản: ' + (o.bank.name || '') + ' ' + o.bank.account + (o.bank.holder ? ', ' + o.bank.holder : ''));
      if (o.content) lines.push('Nội dung: ' + o.content);
    }
    return lines.join('\n');
  }

  /* ---------- Bản lưu để xem khi mất mạng ----------
     Không lưu số CCCD và ngày sinh (nằm lại trong máy là rủi ro không cần thiết). */
  const CACHE_VERSION = 1;
  function cacheEnvelope(data, phone, now) {
    const copy = JSON.parse(JSON.stringify(data || {}));
    if (copy.tenant) { delete copy.tenant.idNumber; delete copy.tenant.dob; }
    return { v: CACHE_VERSION, phone: String(phone || ''), savedAt: (now || new Date()).toISOString(), data: copy };
  }
  function readCache(raw, phone, now, maxDays) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch (e) { return null; } }
    if (!o || o.v !== CACHE_VERSION || !o.data || o.phone !== String(phone || '')) return null;
    const t = Date.parse(o.savedAt);
    if (!isFinite(t)) return null;
    const ageMs = (now || new Date()).getTime() - t;
    if (ageMs < 0 || ageMs > (maxDays || 30) * 86400000) return null;
    return { data: o.data, savedAt: o.savedAt, ageMin: Math.floor(ageMs / 60000) };
  }
  function ageLabel(ageMin) {
    if (ageMin < 2) return 'vừa xong';
    if (ageMin < 60) return ageMin + ' phút trước';
    const h = Math.floor(ageMin / 60);
    if (h < 24) return h + ' giờ trước';
    const d = Math.floor(h / 24);
    return d === 1 ? 'hôm qua' : d + ' ngày trước';
  }

  /* ---------- Mã vào app mới ---------- */
  function codeProblem(code, phone) {
    const c = String(code == null ? '' : code);
    if (!/^[0-9]{6}$/.test(c)) return 'Mã gồm đúng 6 chữ số.';
    if (/^(\d)\1{5}$/.test(c)) return 'Mã quá dễ đoán (6 số giống nhau).';
    const ds = c.split('').map(Number);
    const step = ds[1] - ds[0];
    if ((step === 1 || step === -1) && ds.every((x, i) => i === 0 || x - ds[i - 1] === step)) return 'Mã quá dễ đoán (dãy số liên tiếp).';
    const ph = String(phone || '').replace(/\D/g, '');
    if (ph.length >= 6 && ph.slice(-6) === c) return 'Đừng dùng 6 số cuối của số điện thoại.';
    return null;
  }

  /* ---------- Soát số điện ----------
     { value, prev, avg } -> { level: 'ok' | 'warn' | 'error', msg }. error là không gửi được, warn là hỏi lại cho chắc. */
  function meterCheck(o) {
    const v = o && o.value;
    if (v === null || v === undefined || v === '' || !isFinite(Number(v)) || Number(v) < 0 || Math.round(Number(v)) !== Number(v)) return { level: 'error', msg: 'Số điện phải là số nguyên, không âm.' };
    const prev = o.prev == null || o.prev === '' ? null : Number(o.prev);
    if (prev !== null && isFinite(prev)) {
      if (v < prev) return { level: 'warn', msg: 'Nhỏ hơn số kỳ trước (' + prev + '). Đồng hồ có quay vòng hay đọc nhầm không?' };
      const used = v - prev, avg = Number(o.avg) || 0;
      if (avg > 0 && used > avg * 3) return { level: 'warn', msg: 'Dùng ' + used + ' kWh, cao hơn nhiều so với mức thường (khoảng ' + Math.round(avg) + '). Kiểm tra lại giúp nhé.' };
    }
    return { level: 'ok', msg: '' };
  }

  /* AI hay trả JSON bọc trong ```; lấy ra số điện và độ chắc chắn. Không đọc được thì value = null. */
  function parseMeterAnswer(text) {
    const s = String(text == null ? '' : text);
    const m = /\{[\s\S]*\}/.exec(s);
    let o = null;
    if (m) { try { o = JSON.parse(m[0]); } catch (e) { o = null; } }
    if (!o) return { value: null, confidence: 'low' };
    const raw = o.value == null ? '' : String(o.value).replace(/[\s.,]/g, (c) => (c === ',' || c === '.') ? '.' : '');
    const num = /^\d{1,8}(\.\d+)?$/.test(raw) ? Math.floor(Number(raw)) : null;
    const conf = /^(high|medium|low)$/.test(o.confidence) ? o.confidence : 'low';
    return { value: num, confidence: num === null ? 'low' : conf };
  }

  /* ---------- Thông báo đẩy ----------
     env = { hasKey, hasSW, hasPush, hasNotification, permission, subscribed, ios, standalone }
     off-config: chưa có khóa VAPID trong cấu hình, ẩn hẳn mục này.
     need-install: iPhone chỉ nhận thông báo đẩy sau khi đã thêm app vào màn hình chính.
     unsupported: trình duyệt không hỗ trợ, ẩn. denied: khách đã chặn trong cài đặt. on / off: đang bật / tắt. */
  function pushMode(env) {
    env = env || {};
    if (!env.hasKey) return 'off-config';
    if (!(env.hasSW && env.hasPush && env.hasNotification)) return env.ios && !env.standalone ? 'need-install' : 'unsupported';
    if (env.permission === 'denied') return 'denied';
    return env.subscribed ? 'on' : 'off';
  }
  /* Khóa VAPID công khai (base64 an toàn cho URL) -> mảng byte cho pushManager.subscribe */
  function urlBase64ToBytes(b64) {
    const pad = '='.repeat((4 - (String(b64 || '').length % 4)) % 4);
    const raw = (typeof atob === 'function' ? atob : (x) => Buffer.from(x, 'base64').toString('binary'))(String(b64 || '').replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /* ---------- Dự báo điện tháng tới ----------
     list: các kỳ có chỉ số, MỚI NHẤT TRƯỚC: [{ period: 'YYYY-MM', label, elec (kWh hoặc null) }]. donGia: đơn giá điện (đ/kWh) hoặc null.
     Dự báo = trung bình của tối đa 3 kỳ gần nhất có số (cần ít nhất 2 kỳ), nhân đơn giá. Đây là ƯỚC TÍNH để khách chủ động tiền, không phải số chính thức:
     hóa đơn thật tính theo chỉ số chủ trọ chốt. Trả { ok:false } khi chưa đủ dữ liệu. */
  function usageForecast(list, donGia) {
    const co = (Array.isArray(list) ? list : []).filter((x) => x && typeof x.elec === 'number' && isFinite(x.elec) && x.elec >= 0 && /^\d{4}-\d{2}$/.test(String(x.period || '')));
    if (co.length < 2) return { ok: false, ly: 'chua-du', coSo: co.length };
    const dung = co.slice(0, 3);
    const kwh = Math.round(dung.reduce((s, x) => s + x.elec, 0) / dung.length);
    const gia = typeof donGia === 'number' && isFinite(donGia) && donGia > 0 ? donGia : null;
    const [y, m] = co[0].period.split('-').map(Number);
    const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
    const moi = co[0].elec, truoc = co[1].elec;
    const pct = truoc > 0 ? Math.round(((moi - truoc) / truoc) * 100) : null;
    return { ok: true, kwh, tien: gia == null ? null : Math.round(kwh * gia), coSo: dung.length, thang: ny + '-' + String(nm).padStart(2, '0'), nhan: 'T' + nm + '/' + ny,
      moi, truoc, moiNhan: co[0].label || '', truocNhan: co[1].label || '', pct, huong: pct == null || pct === 0 ? 'dung' : pct > 0 ? 'tang' : 'giam' };
  }

  /* ---------- Đọc số tiền thành chữ (tiếng Việt) ----------
     0 đến dưới 1.000 tỷ. Các chỗ hay sai: "mười" (không "một mươi"), "mốt" sau hàng chục từ hai trở lên, "lăm" sau hàng chục, "linh" khi hàng chục là 0
     mà còn hàng đơn vị, "không trăm" khi đứng sau một nhóm lớn hơn. Không kèm chữ "đồng"; số âm, không phải số, quá lớn thì trả chuỗi rỗng. */
  const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function nhomBaSo(n, coNhomTruoc) {
    const tram = Math.floor(n / 100), chuc = Math.floor(n / 10) % 10, dv = n % 10, out = [];
    if (tram > 0) out.push(CHU_SO[tram] + ' trăm'); else if (coNhomTruoc) out.push('không trăm');
    if (chuc > 1) out.push(CHU_SO[chuc] + ' mươi'); else if (chuc === 1) out.push('mười'); else if (dv > 0 && (tram > 0 || coNhomTruoc)) out.push('linh');
    if (dv > 0) out.push(chuc > 1 && dv === 1 ? 'mốt' : chuc > 0 && dv === 5 ? 'lăm' : CHU_SO[dv]);
    return out.join(' ');
  }
  function docSoThanhChu(so) {
    const x = Math.round(Number(so));
    if (!isFinite(x) || x < 0 || x >= 1e12) return '';
    if (x === 0) return 'không';
    const DV = ['', ' nghìn', ' triệu', ' tỷ'], nhom = [];
    let r = x;
    while (r > 0) { nhom.push(r % 1000); r = Math.floor(r / 1000); }
    const out = [];
    for (let i = nhom.length - 1; i >= 0; i--) {
      if (!nhom[i]) continue;
      out.push(nhomBaSo(nhom[i], out.length > 0) + DV[i]);
    }
    return out.join(' ');
  }

  /* ---------- Biên lai (xác nhận thanh toán) ----------
     p: một dòng lịch sử thanh toán { id, amount, method, date, invoiceId }; ctx: { khach, phong, toa, ky (nhãn kỳ của hóa đơn, nếu biết) }.
     Đây là bản xác nhận do app lập từ dữ liệu thanh toán chủ trọ đã ghi, KHÔNG phải phiếu thu có số của chủ trọ (số phiếu thu không gửi sang app khách).
     Số tiền không hợp lệ (không phải số, bằng 0, âm) thì trả null: không in biên lai cho khoản không có thật. */
  function bienLai(p, ctx) {
    const c = ctx || {};
    const tien = p && Number(p.amount);
    if (!p || !isFinite(tien) || tien <= 0) return null;
    const chu = docSoThanhChu(tien);
    return { ma: String(p.id == null ? '' : p.id), ngay: p.date || null, soTien: Math.round(tien),
      soTienChu: chu ? chu.charAt(0).toUpperCase() + chu.slice(1) + ' đồng' : '',
      hinhThuc: String(p.method || ''), hoaDon: String(p.invoiceId || ''), ky: String(c.ky || ''),
      khach: String(c.khach || ''), phong: String(c.phong || ''), toa: String(c.toa || '') };
  }

  /* ---------- Hỏi trợ lý bằng giọng nói ----------
     Trình duyệt chỉ đổi giọng thành chữ (js/voice.js). Ở đây quyết định làm gì với câu vừa nghe:
       - dọn gọn chữ: bỏ khoảng trắng thừa, viết hoa chữ đầu, bỏ dấu chấm cuối câu (giữ dấu hỏi);
       - đang hỏi TRỢ LÝ (chỉ tra cứu, việc quan trọng nào cũng có nút xác nhận): nói xong là gửi luôn;
       - đang nhắn cho NHÂN VIÊN (người thật): KHÔNG tự gửi, chỉ điền vào ô cho khách xem lại, vì nghe nhầm một chữ là gửi nhầm.
     Trả { chu, gui, loi }. */
  function sauKhiNghe(chu, choNhanVien) {
    const s = String(chu == null ? '' : chu).replace(/\s+/g, ' ').trim().replace(/[.。]+$/, '').trim();
    const dep = s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    return { chu: dep, gui: !!dep && !choNhanVien, loi: dep ? '' : 'Em chưa nghe rõ, anh/chị thử nói lại giúp em' };
  }

  const api = { pushMode, urlBase64ToBytes, installMode, buildIcs, shareText, cacheEnvelope, readCache, ageLabel, codeProblem, meterCheck, parseMeterAnswer, usageForecast, docSoThanhChu, bienLai, sauKhiNghe, CACHE_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.tenantHelpers = api; }
})(typeof window !== 'undefined' ? window : globalThis);

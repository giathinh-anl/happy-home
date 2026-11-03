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

  const api = { installMode, buildIcs, shareText, cacheEnvelope, readCache, ageLabel, codeProblem, meterCheck, parseMeterAnswer, CACHE_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.tenantHelpers = api; }
})(typeof window !== 'undefined' ? window : globalThis);

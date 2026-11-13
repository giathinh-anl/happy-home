/* ============================================================
   Happy Home — Giao diện theo mùa và theo lễ: hôm nay là mùa nào, lễ nào, màu gì

   Thuần, không đụng DOM (tests/seasons.test.js). App khách thuê vẽ nó bằng tenant-app/js/season-ui.js; web quản trị dùng lại được.

   - NGÀY tính theo giờ Việt Nam (UTC+7), không theo múi giờ của máy: khách đang ở nước ngoài vẫn thấy đúng ngày ở nhà,
     và sang ngày mới là đổi đúng lúc nửa đêm Việt Nam.
   - ÂM LỊCH Việt Nam (múi giờ 7) theo thuật toán Hồ Ngọc Đức (tính trăng mới và kinh độ Mặt Trời). Tết, Trung thu đổi ngày
     dương mỗi năm nên không ghi cứng được; tests/seasons.test.js đối chiếu với ngày Tết đã công bố và với lịch âm của Intl.
   - MÙA theo tháng dương lịch như dự báo thời tiết miền Bắc: xuân 2-4, hạ 5-7, thu 8-10, đông 11-1.
   - LỄ nào đang trong "cửa sổ" của nó thì thắng mùa. Hai lễ chồng nhau thì lễ đứng trước trong SU_KIEN thắng.
   - MÀU: mỗi bộ giao diện chỉ khai 2 màu cho sáng và 2 màu cho tối (màu nút, màu phụ); cả thang xanh/nền/đường kẻ sinh từ đó,
     và bài kiểm thử đo độ tương phản chữ (WCAG) cho từng bộ ở cả hai chế độ nên đổi màu không làm khó đọc.
   ============================================================ */
(function (root) {
  'use strict';
  const TZ = 7;                                   // Việt Nam UTC+7, không có giờ mùa hè
  const PI = Math.PI;

  /* ---------- Ngày theo giờ Việt Nam ---------- */
  /** t: số mili-giây (Date.now()) hoặc Date. Trả { d, m, y, gio } theo giờ Việt Nam. */
  function ngayVN(t) {
    const ms = t instanceof Date ? t.getTime() : Number(t);
    const x = new Date(ms + TZ * 3600000);
    return { d: x.getUTCDate(), m: x.getUTCMonth() + 1, y: x.getUTCFullYear(), gio: x.getUTCHours() };
  }
  /** Còn bao nhiêu mili-giây tới nửa đêm kế tiếp theo giờ Việt Nam (để hẹn đổi giao diện đúng lúc sang ngày). */
  function msDenNuaDem(t) {
    const ms = t instanceof Date ? t.getTime() : Number(t);
    const x = ms + TZ * 3600000;
    return 86400000 - (((x % 86400000) + 86400000) % 86400000);
  }

  /* ---------- Số ngày Julius <-> ngày dương ---------- */
  function jdTuNgay(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    return jd;
  }
  function ngayTuJd(jd) {
    let a, b, c;
    if (jd > 2299160) { a = jd + 32044; b = Math.floor((4 * a + 3) / 146097); c = a - Math.floor((b * 146097) / 4); }
    else { b = 0; c = jd + 32082; }
    const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor((1461 * d) / 4), m = Math.floor((5 * e + 2) / 153);
    return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: b * 100 + d - 4800 + Math.floor(m / 10) };
  }

  /* ---------- Âm lịch Việt Nam (Hồ Ngọc Đức) ---------- */
  /* Mọi hàm âm lịch nhận thêm múi giờ tz (mặc định TZ = 7, Việt Nam). Lịch Trung Quốc tính theo +8 nên có tháng bắt đầu lệch một ngày
     so với Việt Nam khi trăng mới rơi vào 16-17 giờ UTC; bài kiểm thử chạy tz = 8 để đối chiếu với Intl, chứng minh phần thiên văn đúng. */

  /** Ngày (số Julius, theo múi giờ tz) của lần trăng mới thứ k kể từ 1/1/1900 */
  function trangMoi(k, tz) {
    const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
    let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;          // gần điểm Mặt Trời
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;       // gần điểm Mặt Trăng
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;          // vĩ độ Mặt Trăng
    let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    c1 = c1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    const dt = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
      : -0.000278 + 0.000265 * T + 0.000262 * T2;
    return Math.floor(jd1 + c1 - dt + 0.5 + (tz == null ? TZ : tz) / 24);
  }
  /** Cung của Mặt Trời tại nửa đêm ngày jdn: 0..11, mỗi cung 30 độ (cung 9 là từ Đông chí) */
  function cungMatTroi(jdn, tz) {
    const T = (jdn - 2451545.5 - (tz == null ? TZ : tz) / 24) / 36525, T2 = T * T, dr = PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let dl = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    dl += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = (L0 + dl) * dr;
    L -= PI * 2 * Math.floor(L / (PI * 2));
    return Math.floor(L / PI * 6);
  }
  /** Ngày bắt đầu tháng 11 âm lịch (tháng có Đông chí) của năm dương yy */
  function thang11(yy, tz) {
    const off = jdTuNgay(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = trangMoi(k, tz);
    if (cungMatTroi(nm, tz) >= 9) nm = trangMoi(k - 1, tz);
    return nm;
  }
  /** Tháng nhuận nằm cách tháng 11 a11 bao nhiêu tháng */
  function viTriNhuan(a11, tz) {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let i = 1, last, arc = cungMatTroi(trangMoi(k + i, tz), tz);
    do { last = arc; i++; arc = cungMatTroi(trangMoi(k + i, tz), tz); } while (arc !== last && i < 14);
    return i - 1;
  }
  /** Ngày dương -> ngày âm Việt Nam: { d, m, y, nhuan } (nhuan = tháng nhuận). tz: múi giờ, mặc định 7. */
  function amLich(dd, mm, yy, tz) {
    const dayNumber = jdTuNgay(dd, mm, yy);
    let k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = trangMoi(k + 1, tz);
    if (monthStart > dayNumber) monthStart = trangMoi(k, tz);
    // k suy từ chu kỳ TRUNG BÌNH, trăng mới thật lệch tới nửa ngày: ngày sát trước trăng mới (vd 26/3/2009 ở múi giờ 8) từng ra "ngày 0"
    while (monthStart > dayNumber) { k--; monthStart = trangMoi(k, tz); }
    let a11 = thang11(yy, tz), b11 = a11, lunarYear;
    if (a11 >= monthStart) { lunarYear = yy; a11 = thang11(yy - 1, tz); }
    else { lunarYear = yy + 1; b11 = thang11(yy + 1, tz); }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let leap = false, lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
      const leapDiff = viTriNhuan(a11, tz);
      if (diff >= leapDiff) { lunarMonth = diff + 10; if (diff === leapDiff) leap = true; }
    }
    if (lunarMonth > 12) lunarMonth -= 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { d: lunarDay, m: lunarMonth, y: lunarYear, nhuan: leap };
  }

  /* Ngày dương (số Julius) của mùng 1 Tết và của rằm tháng 8 trong năm dương y. Tính một lần rồi nhớ. */
  const nho = {};
  function timNgayAm(y, key, jdTu, soNgay, amD, amM) {
    const k = key + y;
    if (k in nho) return nho[k];
    let kq = null;
    for (let jd = jdTu, h = jdTu + soNgay; jd <= h; jd++) {
      const x = ngayTuJd(jd), a = amLich(x.d, x.m, x.y);
      if (a.d === amD && a.m === amM && !a.nhuan) { kq = jd; break; }
    }
    nho[k] = kq;
    return kq;
  }
  /** Mùng 1 Tết Nguyên Đán (1/1 âm) rơi vào khoảng 21/1 tới 20/2 dương */
  const tetJd = (y) => timNgayAm(y, 'tet', jdTuNgay(10, 1, y), 60, 1, 1);
  /** Rằm tháng 8 âm (Tết Trung thu) rơi vào khoảng 6/9 tới 8/10 dương */
  const trungThuJd = (y) => timNgayAm(y, 'tt', jdTuNgay(20, 8, y), 60, 15, 8);

  /* ---------- Màu ---------- */
  const hexRgb = (h) => { const s = String(h).replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; };
  const rgbHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  /** Trộn hai màu: phần t của b, phần 1-t của a */
  const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v * (1 - t) + y[i] * t)); };
  /** Độ sáng tương đối theo WCAG (0 đen, 1 trắng) */
  function doSang(hex) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = hexRgb(hex);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  /** Độ tương phản chữ/nền theo WCAG: 1 (không khác) tới 21 (đen trên trắng). Chữ thường cần từ 4,5. */
  function tuongPhan(a, b) {
    const x = doSang(a), y = doSang(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /* ---------- Các bộ giao diện ----------
     sang / toi: c = màu nút (chữ trắng đè lên phải đọc được), phu = màu phụ cho nền lời chào.
     Màu nút tránh trùng nghĩa với màu trạng thái của app (xanh lá "đã thanh toán", đỏ gạch "quá hạn"). */
  const GIAO_DIEN = {
    xuan:      { ten: 'Mùa xuân',          ngan: 'Mùa xuân',   loai: 'mua', dongMau: 'Xuân về, vạn vật đâm chồi',
                 sang: { c: '#4A7C2C', phu: '#F4A6C6' }, toi: { c: '#4C9A34', phu: '#F4A6C6' } },
    ha:        { ten: 'Mùa hè',            ngan: 'Mùa hè',     loai: 'mua', dongMau: 'Hè rực nắng, nhớ uống đủ nước nhé',
                 sang: { c: '#1B6FB5', phu: '#FFD25A' }, toi: { c: '#3A93DB', phu: '#FFD25A' } },
    thu:       { ten: 'Mùa thu',           ngan: 'Mùa thu',    loai: 'mua', dongMau: 'Thu dịu mát, chúc một tuần thật êm',
                 sang: { c: '#B4530A', phu: '#F5B342' }, toi: { c: '#D9792A', phu: '#F5B342' } },
    dong:      { ten: 'Mùa đông',          ngan: 'Mùa đông',   loai: 'mua', dongMau: 'Trời se lạnh, nhớ giữ ấm nhé',
                 sang: { c: '#3D5A9E', phu: '#BFE3F5' }, toi: { c: '#6C8FE0', phu: '#BFE3F5' } },
    tet:       { ten: 'Tết Nguyên Đán',    ngan: 'Tết',        loai: 'le',  dongMau: 'Còn 9 ngày nữa là Tết',
                 sang: { c: '#A91E3A', phu: '#F5B72E' }, toi: { c: '#D2475B', phu: '#F5B72E' } },
    trungThu:  { ten: 'Tết Trung thu',     ngan: 'Trung thu',  loai: 'le',  dongMau: 'Còn 3 ngày nữa là Tết Trung thu',
                 sang: { c: '#A63D12', phu: '#FFD966' }, toi: { c: '#DC7236', phu: '#FFD966' } },
    noel:      { ten: 'Giáng sinh',        ngan: 'Giáng sinh', loai: 'le',  dongMau: 'Còn 5 ngày nữa là Giáng sinh',
                 sang: { c: '#1E6B3C', phu: '#D9534F' }, toi: { c: '#38A062', phu: '#D9534F' } },
    namMoi:    { ten: 'Năm mới',           ngan: 'Năm mới',    loai: 'le',  dongMau: 'Chúc mừng năm mới!',
                 sang: { c: '#27408B', phu: '#F2C14E' }, toi: { c: '#5C7FE0', phu: '#F2C14E' } },
    tinhYeu:   { ten: 'Valentine',         ngan: 'Valentine',  loai: 'le',  dongMau: 'Valentine · Chúc một ngày thật ngọt ngào',
                 sang: { c: '#C2185B', phu: '#FFB3CC' }, toi: { c: '#E0568F', phu: '#FFB3CC' } },
    hoa:       { ten: 'Ngày của phụ nữ',   ngan: '8/3 · 20/10', loai: 'le', dongMau: 'Chúc mừng ngày của phụ nữ!',
                 sang: { c: '#7B3FA0', phu: '#F4A6C8' }, toi: { c: '#B070DC', phu: '#F4A6C8' } },
    co:        { ten: 'Ngày lễ quốc gia',  ngan: '30/4 · 2/9', loai: 'le',  dongMau: 'Mừng ngày lễ lớn của đất nước',
                 sang: { c: '#C0282D', phu: '#FFD33D' }, toi: { c: '#E0494B', phu: '#FFD33D' } },
    halloween: { ten: 'Halloween',         ngan: 'Halloween',  loai: 'le',  dongMau: 'Halloween vui vẻ!',
                 sang: { c: '#B04A06', phu: '#8E5BC2' }, toi: { c: '#D96F22', phu: '#8E5BC2' } },
  };
  /** Thứ tự hiện ở nút "xem thử" */
  const DANH_SACH = ['xuan', 'ha', 'thu', 'dong', 'tet', 'trungThu', 'noel', 'namMoi', 'tinhYeu', 'hoa', 'co', 'halloween'];

  /* Màu chữ mờ (--ink-3) hiện tại của app và độ tương phản của nó trên nền hiện tại. Nền pha màu làm tương phản này tụt xuống,
     nên bangMau làm đậm (sáng) hoặc nhạt đi (tối) chữ mờ vừa đủ để KHÔNG tệ hơn hiện tại. */
  const INK3 = { sang: '#687876', toi: '#86A09C' }, NEN = { sang: '#F1F4F3', toi: '#0C1514' }, THE = { sang: '#FDFEFE', toi: '#142120' };
  const TP_NEN = { sang: tuongPhan(INK3.sang, NEN.sang), toi: tuongPhan(INK3.toi, NEN.toi) };
  const TP_THE = { sang: tuongPhan(INK3.sang, THE.sang), toi: tuongPhan(INK3.toi, THE.toi) };
  /** bg, the: màu nền app và màu thẻ đã pha; chữ mờ phải rõ ít nhất bằng hiện tại trên CẢ HAI */
  function chuMo(toi, bg, the) {
    const k = toi ? 'toi' : 'sang', goc = INK3[k], ve = toi ? '#FFFFFF' : '#000000', canBg = TP_NEN[k] - 0.02, canThe = TP_THE[k] - 0.02;
    let c = goc;
    for (let t = 0.02; (tuongPhan(c, bg) < canBg || tuongPhan(c, the) < canThe) && t <= 0.6; t += 0.02) c = mix(goc, ve, t);
    return c;
  }

  /** Bảng màu cho một bộ giao diện ở chế độ sáng hoặc tối:
      { vars: { '--tên-biến-css': 'giá trị' }, themeColor } — nơi dùng đặt thẳng lên :root. */
  function bangMau(id, toi) {
    const g = GIAO_DIEN[id];
    if (!g) return null;
    const t = toi ? g.toi : g.sang, c = t.c, W = '#FFFFFF', K = '#000000';
    const v = {};
    let bar;
    if (!toi) {
      v['--teal-50'] = mix(c, W, 0.92); v['--teal-100'] = mix(c, W, 0.84); v['--teal-200'] = mix(c, W, 0.66);
      v['--teal-300'] = mix(c, W, 0.46); v['--teal-400'] = mix(c, W, 0.2); v['--teal-500'] = c;
      v['--teal-600'] = mix(c, K, 0.15); v['--teal-700'] = mix(c, K, 0.36); v['--teal-800'] = mix(c, K, 0.52); v['--teal-900'] = mix(c, K, 0.66);
      v['--bg'] = mix(NEN.sang, c, 0.05); v['--surface'] = mix('#FDFEFE', c, 0.015); v['--surface-2'] = mix('#F6F8F7', c, 0.04);
      v['--line'] = mix('#DEE5E3', c, 0.08); v['--line-2'] = mix('#C8D2CF', c, 0.1); v['--neutral-100'] = mix('#EAEFED', c, 0.06);
      v['--ink-3'] = chuMo(false, v['--bg'], v['--surface']);
      bar = mix('#FDFEFE', c, 0.04);
      v['--sz-h1'] = mix(c, W, 0.9); v['--sz-h2'] = mix(t.phu, W, 0.76);
      v['--sz-rb'] = 'rgba(255, 255, 255, 0.74)'; v['--sz-rl'] = mix(c, W, 0.75);
    } else {
      const N = NEN.toi;
      v['--teal-50'] = mix(c, N, 0.82); v['--teal-100'] = mix(c, N, 0.7); v['--teal-200'] = mix(c, N, 0.5);
      v['--teal-300'] = mix(c, N, 0.3); v['--teal-400'] = mix(c, N, 0.12); v['--teal-500'] = c;
      v['--teal-600'] = mix(c, K, 0.14); v['--teal-700'] = mix(c, W, 0.5); v['--teal-800'] = mix(c, W, 0.75); v['--teal-900'] = mix(c, W, 0.88);
      v['--bg'] = mix(N, c, 0.06); v['--surface'] = mix('#142120', c, 0.07); v['--surface-2'] = mix('#1B2B2A', c, 0.08);
      v['--line'] = mix('#243735', c, 0.09); v['--line-2'] = mix('#31484A', c, 0.09); v['--neutral-100'] = mix('#1B2B2A', c, 0.08);
      v['--ink-3'] = chuMo(true, v['--bg'], v['--surface']);
      bar = mix('#142120', c, 0.07);
      v['--sz-h1'] = mix(c, N, 0.8); v['--sz-h2'] = mix(t.phu, N, 0.87);
      v['--sz-rb'] = 'rgba(12, 21, 20, 0.5)'; v['--sz-rl'] = mix(c, N, 0.55);
    }
    const [r, gg, b] = hexRgb(bar);
    v['--bar-bg'] = 'rgba(' + r + ', ' + gg + ', ' + b + ', ' + (toi ? '0.9' : '0.92') + ')';
    return { vars: v, themeColor: bar };
  }
  /** Mọi tên biến CSS mà bangMau đặt: để nơi dùng xóa sạch khi tắt giao diện */
  const TEN_BIEN = Object.keys(bangMau('xuan', false).vars);

  /* ---------- Lễ và mùa ---------- */
  /** (tháng, ngày) của ngày c có nằm trong [m1/d1, m2/d2] không; khoảng vắt qua hết năm (28/12 tới 2/1) cũng được */
  function trongKhoang(c, m1, d1, m2, d2) {
    const k = c.m * 100 + c.d, a = m1 * 100 + d1, b = m2 * 100 + d2;
    return a <= b ? (k >= a && k <= b) : (k >= a || k <= b);
  }
  /** Còn mấy ngày tới ngày m/d (0 là hôm nay); đã qua trong năm thì tính sang năm sau */
  function conNgay(c, m, d) {
    let jd = jdTuNgay(d, m, c.y);
    if (jd < c.jd) jd = jdTuNgay(d, m, c.y + 1);
    return jd - c.jd;
  }
  /** Dòng đếm ngược: "Còn 5 ngày nữa là X" / "Ngày mai là X" */
  const demNgay = (n, ten) => n === 1 ? 'Ngày mai là ' + ten : 'Còn ' + n + ' ngày nữa là ' + ten;

  /* Thứ tự = ưu tiên. xet(c) trả null (không phải lúc này) hoặc { dong, conLai }. */
  const SU_KIEN = [
    { id: 'tet', giaoDien: 'tet', ten: 'Tết Nguyên Đán', xet(c) {
      const t = tetJd(c.y); if (t == null) return null;
      const dt = c.jd - t;                                // âm: còn mấy ngày tới mùng 1; dương: mùng mấy
      if (dt < -15 || dt > 14) return null;               // từ khoảng 16 tháng Chạp tới rằm tháng Giêng
      let dong;
      if (dt <= -2) dong = 'Còn ' + (-dt) + ' ngày nữa là Tết';
      else if (dt === -1) dong = 'Hôm nay là Giao thừa';
      else if (dt === 0) dong = 'Mùng 1 Tết · Chúc mừng năm mới!';
      else if (dt <= 9) dong = 'Mùng ' + (dt + 1) + ' Tết · Chúc cả nhà năm mới an khang';
      else if (dt <= 13) dong = 'Năm mới an khang, vạn sự như ý';
      else dong = 'Rằm tháng Giêng · Chúc cả nhà an lành';
      return { dong, conLai: dt <= 0 ? 0 - dt : null };            // 0 - dt chứ không phải -dt: ngày mùng 1 không được ra -0
    } },
    { id: 'trungThu', giaoDien: 'trungThu', ten: 'Tết Trung thu', xet(c) {
      const t = trungThuJd(c.y); if (t == null) return null;
      const dt = c.jd - t;
      if (dt < -7 || dt > 0) return null;                 // từ mùng 8 tới rằm tháng 8
      return { dong: dt === 0 ? 'Tết Trung thu · Chúc các bé một đêm rằm thật vui' : demNgay(-dt, 'Tết Trung thu'), conLai: 0 - dt };
    } },
    { id: 'noel', giaoDien: 'noel', ten: 'Giáng sinh', xet(c) {
      if (!trongKhoang(c, 12, 14, 12, 26)) return null;
      if (c.d === 26) return { dong: 'Chúc một mùa Giáng sinh ấm áp', conLai: null };
      const n = conNgay(c, 12, 25);
      return { dong: n === 0 ? 'Giáng sinh an lành!' : n === 1 ? 'Đêm Noel · Chúc một đêm an lành' : demNgay(n, 'Giáng sinh'), conLai: n };
    } },
    { id: 'namMoi', giaoDien: 'namMoi', ten: 'Năm mới', xet(c) {
      if (!trongKhoang(c, 12, 28, 1, 2)) return null;
      if (c.m === 12) { const n = conNgay(c, 1, 1); return { dong: demNgay(n, 'năm mới ' + (c.y + 1)), conLai: n }; }
      return { dong: c.d === 1 ? 'Chúc mừng năm mới ' + c.y + '!' : 'Chúc một năm ' + c.y + ' thật nhiều niềm vui', conLai: c.d === 1 ? 0 : null };
    } },
    { id: 'thongNhat', giaoDien: 'co', ten: '30/4 và 1/5', xet(c) {
      if (!trongKhoang(c, 4, 27, 5, 1)) return null;
      if (c.m === 5) return { dong: 'Mừng 1/5 · Ngày Quốc tế Lao động', conLai: null };
      const n = 30 - c.d;
      return { dong: n === 0 ? 'Mừng 30/4 · Ngày Giải phóng miền Nam' : demNgay(n, '30/4'), conLai: n };
    } },
    { id: 'quocKhanh', giaoDien: 'co', ten: 'Quốc khánh 2/9', xet(c) {
      if (!trongKhoang(c, 8, 28, 9, 2)) return null;
      const n = conNgay(c, 9, 2);
      return { dong: n === 0 ? 'Mừng Quốc khánh 2/9!' : demNgay(n, 'Quốc khánh 2/9'), conLai: n };
    } },
    { id: 'quocTePhuNu', giaoDien: 'hoa', ten: 'Quốc tế Phụ nữ 8/3', xet(c) {
      if (!trongKhoang(c, 3, 6, 3, 8)) return null;
      const n = 8 - c.d;
      return { dong: n === 0 ? '8/3 · Chúc mừng Quốc tế Phụ nữ!' : demNgay(n, '8/3'), conLai: n };
    } },
    { id: 'phuNuVN', giaoDien: 'hoa', ten: 'Phụ nữ Việt Nam 20/10', xet(c) {
      if (!trongKhoang(c, 10, 18, 10, 20)) return null;
      const n = 20 - c.d;
      return { dong: n === 0 ? '20/10 · Chúc mừng ngày Phụ nữ Việt Nam!' : demNgay(n, '20/10'), conLai: n };
    } },
    { id: 'tinhYeu', giaoDien: 'tinhYeu', ten: 'Valentine', xet(c) {
      if (!trongKhoang(c, 2, 12, 2, 14)) return null;
      const n = 14 - c.d;
      return { dong: n === 0 ? 'Valentine · Chúc một ngày thật ngọt ngào' : demNgay(n, 'Valentine'), conLai: n };
    } },
    { id: 'halloween', giaoDien: 'halloween', ten: 'Halloween', xet(c) {
      if (!trongKhoang(c, 10, 27, 10, 31)) return null;
      const n = 31 - c.d;
      return { dong: n === 0 ? 'Halloween vui vẻ!' : demNgay(n, 'Halloween'), conLai: n };
    } },
  ];

  const MUA = [
    { id: 'dong', ten: 'Mùa đông', dong: 'Trời se lạnh, nhớ giữ ấm nhé' },          // tháng 1
    { id: 'xuan', ten: 'Mùa xuân', dong: 'Xuân về, vạn vật đâm chồi' },             // 2-4
    { id: 'ha', ten: 'Mùa hè', dong: 'Hè rực nắng, nhớ uống đủ nước nhé' },         // 5-7
    { id: 'thu', ten: 'Mùa thu', dong: 'Thu dịu mát, chúc một tuần thật êm' },      // 8-10
  ];
  const muaCuaThang = (m) => m >= 2 && m <= 4 ? MUA[1] : m >= 5 && m <= 7 ? MUA[2] : m >= 8 && m <= 10 ? MUA[3] : MUA[0];

  /** Hôm nay (hoặc thời điểm t) là lễ nào, mùa nào.
      { id, giaoDien, loai: 'le'|'mua', ten, dong, conLai (số ngày tới ngày chính, hoặc null) } */
  function chon(t) {
    const n = ngayVN(t == null ? Date.now() : t);
    const c = { d: n.d, m: n.m, y: n.y, jd: jdTuNgay(n.d, n.m, n.y) };
    for (const sk of SU_KIEN) {
      const r = sk.xet(c);
      if (r) return { id: sk.id, giaoDien: sk.giaoDien, loai: 'le', ten: sk.ten, dong: r.dong, conLai: r.conLai };
    }
    const m = muaCuaThang(c.m);
    return { id: m.id, giaoDien: m.id, loai: 'mua', ten: m.ten, dong: m.dong, conLai: null };
  }
  /** Kết quả giả để xem thử một bộ giao diện bất kỳ (không theo ngày) */
  function xemThu(id) {
    const g = GIAO_DIEN[id];
    if (!g) return null;
    return { id, giaoDien: id, loai: g.loai, ten: g.ten, dong: g.dongMau, conLai: null };
  }

  const api = {
    TZ, ngayVN, msDenNuaDem, jdTuNgay, ngayTuJd, amLich, tetJd, trungThuJd, trangMoi, cungMatTroi,
    mix, doSang, tuongPhan, GIAO_DIEN, DANH_SACH, bangMau, TEN_BIEN, SU_KIEN, chon, xemThu,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.seasons = api; }
})(typeof window !== 'undefined' ? window : globalThis);

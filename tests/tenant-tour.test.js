/* Kiểm thử hướng dẫn làm quen từng bước của app khách thuê (tenant-app/js/tour.js).
   Phần thuần: danh sách bước, đi tới/lui, đặt thẻ, ô sáng. Ngoài ra đối chiếu với mã nguồn: bộ chọn của từng bước phải có thật trong tenant.js,
   tệp được nạp trong index.html và lưu trong service worker, CSS có đủ luật (kể cả tắt chuyển động).
   Chạy:  node tests/tenant-tour.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../tenant-app/js/tour.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};

/* ============================================================
   Danh sách bước
   ============================================================ */
test('có 9 bước, mã duy nhất, chữ không rỗng, bước đầu và bước cuối không chỉ vào đâu (thẻ nằm giữa)', () => {
  assert.strictEqual(T.BUOC.length, 9);
  assert.strictEqual(new Set(T.BUOC.map((s) => s.id)).size, T.BUOC.length);
  T.BUOC.forEach((s) => {
    assert.ok(typeof s.tieuDe === 'string' && s.tieuDe.length >= 3 && s.tieuDe.length <= 40, s.id + ': tiêu đề');
    assert.ok(typeof s.noiDung === 'string' && s.noiDung.length >= 10 && s.noiDung.length <= 200, s.id + ': nội dung phải ngắn gọn (<= 200 ký tự)');
    assert.ok(Array.isArray(s.mucTieu) && s.mucTieu.every((x) => typeof x === 'string' && x.length), s.id + ': mucTieu');
  });
  assert.deepStrictEqual(T.BUOC[0].mucTieu, []); assert.deepStrictEqual(T.BUOC[T.BUOC.length - 1].mucTieu, []);
  assert.ok(T.BUOC.slice(1, -1).every((s) => s.mucTieu.length > 0), 'các bước giữa đều phải chỉ vào một nút');
});
test('chữ hướng dẫn không có biểu tượng cảm xúc, không có dấu gạch dài, không có thẻ HTML', () => {
  T.BUOC.forEach((s) => {
    const x = s.tieuDe + ' ' + s.noiDung;
    assert.ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(x), s.id + ': biểu tượng');
    assert.ok(!/[–—]/.test(x), s.id + ': gạch dài');
    assert.ok(!/[<>]/.test(x), s.id + ': thẻ HTML');
  });
});
test('mỗi tính năng chính của app khách đều được nhắc: thanh toán VietQR, chỉ số điện, báo hỏng, trợ lý ảo, nhắn nhân viên, ảnh, giọng nói, mùa và lễ', () => {
  const tat = T.BUOC.map((s) => s.noiDung).join(' ');
  ['VietQR', 'chỉ số điện', 'báo hỏng', 'trợ lý ảo', 'nhân viên', 'ảnh', 'giọng nói', 'mùa và lễ', 'biên lai', 'Hướng dẫn sử dụng'].forEach((k) => assert.ok(tat.includes(k), 'thiếu: ' + k));
});
test('lapBuoc: bỏ bước mà không phần tử nào đang hiện, luôn giữ bước không cần chỉ đâu', () => {
  const het = T.lapBuoc(() => true); assert.strictEqual(het.length, 9);
  const khong = T.lapBuoc(() => false); assert.deepStrictEqual(khong.map((s) => s.id), ['chao', 'xong']);
  const thieuNut = T.lapBuoc((ds) => !ds.includes('#payNow'));          // hết nợ: không còn nút Thanh toán ngay
  assert.strictEqual(thieuNut.length, 8); assert.ok(!thieuNut.some((s) => s.id === 'thanh-toan'));
  assert.strictEqual(T.lapBuoc().length, 9);                              // không truyền hàm: coi như đều hiện
});

/* ============================================================
   Đi tới / lui
   ============================================================ */
test('dich: tiến, lùi, kẹp ở hai đầu, tiến ở bước cuối thì báo xong', () => {
  assert.deepStrictEqual(T.dich(0, 1, 9), { i: 1, xong: false });
  assert.deepStrictEqual(T.dich(5, -1, 9), { i: 4, xong: false });
  assert.deepStrictEqual(T.dich(0, -1, 9), { i: 0, xong: false });
  assert.deepStrictEqual(T.dich(8, 1, 9), { i: 8, xong: true });
  assert.deepStrictEqual(T.dich(7, 1, 9), { i: 8, xong: false });
});
test('dich: số lạ không làm hỏng (âm, quá lớn, NaN, một bước, không bước)', () => {
  assert.deepStrictEqual(T.dich(-5, 1, 9), { i: 1, xong: false });
  assert.deepStrictEqual(T.dich(99, -1, 9), { i: 7, xong: false });
  assert.deepStrictEqual(T.dich(NaN, 1, 9), { i: 1, xong: false });
  assert.deepStrictEqual(T.dich(0, 1, 1), { i: 0, xong: true });
  assert.deepStrictEqual(T.dich(0, 1, 0), { i: 0, xong: true });
  assert.deepStrictEqual(T.dich(0, -1, 0), { i: 0, xong: false });
});
test('đi hết hướng dẫn từ đầu: đúng 9 lần bấm Tiếp, bước nào cũng đúng thứ tự', () => {
  let i = 0, buoc = 1;
  while (true) { const r = T.dich(i, 1, 9); if (r.xong) break; i = r.i; buoc++; assert.strictEqual(i, buoc - 1); }
  assert.strictEqual(buoc, 9);
});
test('tiLe: bước đầu đã có một đoạn, bước cuối đầy 100%, không vượt', () => {
  assert.strictEqual(T.tiLe(0, 9), 11); assert.strictEqual(T.tiLe(8, 9), 100); assert.strictEqual(T.tiLe(4, 9), 56);
  assert.strictEqual(T.tiLe(99, 9), 100); assert.strictEqual(T.tiLe(-3, 9), 11); assert.strictEqual(T.tiLe(0, 0), 100);
});

/* ============================================================
   Đặt thẻ và ô sáng
   ============================================================ */
const kn = { w: 390, h: 844 }, the = { w: 340, h: 200 };
test('datThe: phần tử ở trên thì thẻ nằm dưới, cách một khoảng', () => {
  const p = T.datThe({ x: 20, y: 100, w: 350, h: 160 }, the, kn);
  assert.strictEqual(p.cho, 'duoi'); assert.strictEqual(p.y, 100 + 160 + 12); assert.ok(p.y + the.h <= kn.h - 12);
});
test('datThe: phần tử ở dưới (thanh tab) thì thẻ nằm trên', () => {
  const p = T.datThe({ x: 150, y: 780, w: 90, h: 56 }, the, kn);
  assert.strictEqual(p.cho, 'tren'); assert.strictEqual(p.y, 780 - 12 - the.h);
});
test('datThe: không chỉ vào đâu thì thẻ nằm giữa màn hình', () => {
  const p = T.datThe(null, the, kn);
  assert.strictEqual(p.cho, 'giua'); assert.strictEqual(p.x, Math.round((390 - 340) / 2)); assert.strictEqual(p.y, Math.round((844 - 200) / 2));
});
test('datThe: phần tử cao gần kín màn hình (không đủ chỗ trên lẫn dưới) thì thẻ vào giữa, vẫn trong màn hình', () => {
  const p = T.datThe({ x: 10, y: 20, w: 370, h: 780 }, the, kn);
  assert.strictEqual(p.cho, 'giua'); assert.ok(p.y >= 12 && p.y + the.h <= kn.h);
});
test('datThe: luôn nằm trọn theo chiều ngang kể cả khi phần tử sát mép, thẻ không rộng hơn màn hình', () => {
  [{ x: -30, y: 100, w: 90, h: 50 }, { x: 350, y: 100, w: 90, h: 50 }, { x: 0, y: 100, w: 390, h: 50 }].forEach((r) => {
    const p = T.datThe(r, the, kn); assert.ok(p.x >= 12 && p.x + the.w <= kn.w - 12, JSON.stringify(r));
  });
  const nho = T.datThe({ x: 10, y: 100, w: 50, h: 50 }, { w: 340, h: 200 }, { w: 300, h: 600 });
  assert.ok(nho.w <= 300 - 24 && nho.x >= 12 && nho.x + nho.w <= 300 - 12);
});
test('datThe: màn hình thấp (360x640) phần tử ở giữa thì thẻ vẫn nằm trọn, không chồng lên phần tử', () => {
  const k2 = { w: 360, h: 640 };
  [[100, 60], [250, 100], [350, 120], [470, 80], [560, 56]].forEach(([y, h]) => {
    const p = T.datThe({ x: 20, y, w: 320, h }, { w: 336, h: 190 }, k2);
    assert.ok(p.y >= 12 && p.y + 190 <= k2.h - 12 + (p.cho === 'giua' ? 12 : 0), 'y=' + y + ' cho=' + p.cho);
    if (p.cho !== 'giua') assert.ok(p.y + 190 <= y || p.y >= y + h, 'chồng lên phần tử, y=' + y);
  });
});
test('oSang: nới ô sáng ra mỗi phía; nhinThay: kiểm phần tử có nằm trọn trong vùng nhìn thấy (trừ chỗ thanh tab che)', () => {
  assert.deepStrictEqual(T.oSang({ left: 10, top: 20, width: 100, height: 40 }, 6), { x: 4, y: 14, w: 112, h: 52 });
  assert.deepStrictEqual(T.oSang({ left: 10, top: 20, width: 100, height: 40 }), { x: 4, y: 14, w: 112, h: 52 });
  assert.strictEqual(T.nhinThay({ top: 100, bottom: 300 }, kn, 12, 90), true);
  assert.strictEqual(T.nhinThay({ top: 700, bottom: 780 }, kn, 12, 90), false);        // bị thanh tab che
  assert.strictEqual(T.nhinThay({ top: -5, bottom: 100 }, kn, 12, 0), false);          // tràn lên trên
  assert.strictEqual(T.nhinThay({ top: 0, bottom: 844 }, kn), true);
});

/* ============================================================
   Đối chiếu với mã nguồn
   ============================================================ */
const nguon = doc('tenant-app/js/tenant.js');
test('bộ chọn của mọi bước có thật trong tenant.js (id, lớp, tab theo đường dẫn)', () => {
  const thieu = [];
  T.BUOC.forEach((s) => s.mucTieu.forEach((sel) => {
    (sel.match(/#[A-Za-z][\w-]*/g) || []).filter((x) => !/^#\//.test(x)).forEach((id) => { if (!nguon.includes('id="' + id.slice(1) + '"')) thieu.push(s.id + ' ' + id); });
    (sel.replace(/\[[^\]]*\]/g, '').match(/\.[A-Za-z][\w-]*/g) || []).forEach((cl) => { if (!new RegExp('class="[^"]*\\b' + cl.slice(1) + '\\b').test(nguon)) thieu.push(s.id + ' ' + cl); });
    (sel.match(/\[data-tab="([^"]+)"\]/g) || []).forEach((t) => { const h = t.match(/"([^"]+)"/)[1]; if (!nguon.includes("hash: '" + h + "'")) thieu.push(s.id + ' tab ' + h); });
  }));
  assert.deepStrictEqual(thieu, []);
});
test('mỗi bước chỉ vào thanh tab hay nút nổi đều có cả cách chỉ trên điện thoại lẫn máy tính', () => {
  T.BUOC.filter((s) => s.id === 'hoa-don' || s.id === 'phong' || s.id === 'tai-khoan').forEach((s) => {
    assert.ok(s.mucTieu.some((x) => x.startsWith('.t-tab')) && s.mucTieu.some((x) => x.startsWith('.t-nav')), s.id);
    assert.strictEqual(s.codinh, true, s.id + ': phần tử cố định thì khỏi cuộn tới');
  });
  const tl = T.BUOC.find((s) => s.id === 'tro-ly'); assert.ok(tl.mucTieu.includes('#chatFab') && tl.mucTieu.some((x) => x.startsWith('.t-nav')));
});
test('tenant.js gọi hướng dẫn mới khi bấm Hướng dẫn sử dụng, còn hộp thoại chữ chỉ để dự phòng khi lỗi', () => {
  const i = nguon.indexOf("el('helpBtn').onclick");
  assert.ok(i > 0); const khoi = nguon.slice(i, i + 900);
  assert.ok(/HH\.tenantTour\.start\(/.test(khoi), 'phải gọi HH.tenantTour.start');
  assert.ok(khoi.indexOf('HH.tenantTour.start(') < khoi.indexOf('alert('), 'alert chỉ sau lời gọi hướng dẫn (dự phòng)');
  assert.ok(/vaoTrangChu/.test(khoi) && /go\('#\/home'\)/.test(khoi), 'phải đưa về Trang chủ trước');
  assert.ok(/catch \(e\)/.test(khoi), 'lỗi hướng dẫn không được làm hỏng nút');
});
test('index.html nạp tour.js trước tenant.js (có số phiên bản), service worker lưu tour.js', () => {
  const h = doc('tenant-app/index.html');
  const a = h.indexOf('js/tour.js?v='), b = h.indexOf('js/tenant.js?v=');
  assert.ok(a > 0 && b > a, 'tour.js phải đứng trước tenant.js');
  assert.ok(/'\.\/js\/tour\.js'/.test(doc('tenant-app/sw.js')), 'sw.js phải lưu ./js/tour.js');
});
test('tour.js gắn chữ vào thẻ bằng textContent (không chèn chữ bước vào HTML), có tắt chuyển động khi máy bật giảm chuyển động', () => {
  const m = doc('tenant-app/js/tour.js');
  assert.ok(/#ttT'\)\.textContent = step\.tieuDe/.test(m) && /#ttD'\)\.textContent = step\.noiDung/.test(m));
  assert.ok(!/innerHTML[^;]*step\./.test(m), 'không được đưa dữ liệu bước vào innerHTML');
  assert.ok(/prefers-reduced-motion/.test(m), 'phải biết máy bật giảm chuyển động (cuộn không mượt)');
  assert.ok(/Escape/.test(m) && /ArrowRight/.test(m) && /ArrowLeft/.test(m) && /aria-modal/.test(m), 'phím tắt và khai báo cho người dùng đọc màn hình');
});
test('CSS có ô sáng, thẻ, chuyển động mượt, chấm bước, và tắt hết khi máy bật giảm chuyển động', () => {
  const c = doc('tenant-app/css/tenant.css');
  ['.tt-hole', '.tt-card', '.tt-dots', '.tt-bar', '@keyframes ttPing', '@keyframes ttPop', '@keyframes ttText'].forEach((k) => assert.ok(c.includes(k), 'thiếu ' + k));
  assert.ok(/\.tt-hole\s*\{[^}]*transition:[^}]*left[^}]*top[^}]*width[^}]*height/.test(c), 'ô sáng phải trượt (left, top, width, height)');
  const i = c.indexOf('@media (prefers-reduced-motion: reduce) { .tt,'); assert.ok(i > 0, 'thiếu khối giảm chuyển động của hướng dẫn');
  const khoi = c.slice(i, i + 300); assert.ok(/\.tt-hole/.test(khoi) && /\.tt-card/.test(khoi) && /animation: none/.test(khoi) && /transition: none/.test(khoi));
  const z = c.match(/\.tt\s*\{[^}]*z-index:\s*(\d+)/); assert.ok(z && +z[1] >= 1000, 'lớp hướng dẫn phải nằm trên mọi thứ (hộp thoại, nút nổi, thanh tab)');
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

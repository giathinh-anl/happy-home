/* Kiểm thử phần vẽ giao diện theo mùa và lễ (tenant-app/js/season-ui.js): bộ hình, hạt, tranh, và việc nối vào app khách.
   Phần đụng DOM (đặt màu lên :root, vẽ lớp hạt) được thử bằng trình duyệt thật; ở đây thử mọi thứ sinh ra được mà không cần DOM.
   Chạy:  node tests/season-ui.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const U = require('../tenant-app/js/season-ui.js');
const S = require('../js/seasons.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const doc = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const MAU = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Kiểm tra XML cân thẻ (đủ cho các hình SVG tự viết): trả danh sách lỗi */
function loiXml(xml, choChu) {
  const loi = [], ngan = [];
  const re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z:-]+="[^"]*")*)\s*(\/?)>/g;
  let m, het = 0;
  while ((m = re.exec(xml))) {
    if (!choChu && xml.slice(het, m.index).trim() !== '') loi.push('chữ lạ giữa các thẻ: ' + xml.slice(het, m.index).slice(0, 30));
    het = re.lastIndex;
    const [, dong, ten, , tuDong] = m;
    if (tuDong) continue;
    if (dong) { const t = ngan.pop(); if (t !== ten) loi.push('đóng ' + ten + ' nhưng đang mở ' + t); }
    else ngan.push(ten);
  }
  if (!choChu && xml.slice(het).trim() !== '') loi.push('thừa cuối: ' + xml.slice(het).slice(0, 30));
  if (ngan.length) loi.push('chưa đóng: ' + ngan.join(','));
  return loi;
}

/* ============================================================
   Bộ hình
   ============================================================ */
test('mỗi hình là SVG cân thẻ, có id sz-..., mỗi hình dùng --c1, không có chữ lạ', () => {
  assert.ok(U.SPRITE_IDS.length >= 18);
  assert.strictEqual(new Set(U.SPRITE_IDS).size, U.SPRITE_IDS.length);
  for (const id of U.SPRITE_IDS) {
    assert.ok(/^sz-[a-z]+$/.test(id), id);
    const x = U.SPRITE[id];
    assert.deepStrictEqual(loiXml(x), [], id);
    assert.ok(x.includes('var(--c1'), id + ' phải đổi được màu bằng --c1');
    assert.ok(!/undefined|NaN/.test(x), id);
  }
});
test('soDoSprite: một svg ẩn, mỗi hình một symbol viewBox 64, cân thẻ', () => {
  const x = U.soDoSprite();
  assert.deepStrictEqual(loiXml(x), []);
  for (const id of U.SPRITE_IDS) assert.ok(x.includes('<symbol id="' + id + '" viewBox="0 0 64 64">'), id);
  assert.strictEqual((x.match(/<symbol /g) || []).length, U.SPRITE_IDS.length);
  assert.ok(/aria-hidden="true"/.test(x) && /width="0" height="0"/.test(x));
});
test('hình vẽ không dùng thuộc tính nguy hiểm (script, onload, href ra ngoài)', () => {
  const x = U.soDoSprite();
  assert.ok(!/<script|onload|onclick|javascript:|<image|<foreignObject|xlink:href|href="http/i.test(x));
});

/* ============================================================
   Hiệu ứng từng bộ
   ============================================================ */
test('mỗi bộ giao diện đều có hiệu ứng: icon, hạt, và tranh đủ hình; mọi hình nhắc tới đều có thật; màu hợp lệ', () => {
  assert.deepStrictEqual(Object.keys(U.HIEU_UNG).sort(), S.DANH_SACH.slice().sort());
  for (const id of S.DANH_SACH) {
    const c = U.HIEU_UNG[id];
    assert.ok(U.SPRITE_IDS.includes(c.icon.sp) && MAU.test(c.icon.c1) && MAU.test(c.icon.c2), id + ' icon');
    assert.ok(['roi', 'bay', 'lap'].includes(c.hat.kieu), id);
    assert.ok(c.hat.n >= 6 && c.hat.n <= 18, id + ' số hạt ' + c.hat.n);
    assert.ok(c.hat.t[0] > 0 && c.hat.t[1] > c.hat.t[0] && c.hat.o[0] > 0 && c.hat.o[1] <= 1 && c.hat.o[1] >= c.hat.o[0], id);
    assert.ok(c.hat.loai.length >= 1);
    for (const l of c.hat.loai) {
      assert.ok(U.SPRITE_IDS.includes(l.sp) && l.w > 0 && l.s[0] >= 8 && l.s[1] >= l.s[0] && l.s[1] <= 30, id + ' hạt ' + l.sp);
      assert.ok(l.c1.length >= 1 && l.c1.every((m) => MAU.test(m)) && MAU.test(l.c2), id);
    }
    assert.ok(c.tranh.length >= 4 && c.tranh.length <= 9, id + ' tranh ' + c.tranh.length);
    for (const a of c.tranh) {
      assert.ok(U.SPRITE_IDS.includes(a.sp) && MAU.test(a.c1) && (a.c2 == null || MAU.test(a.c2)), id + ' tranh ' + a.sp);
      assert.ok(a.w >= 10 && a.w <= 120 && a.rt >= -20 && a.rt <= 130, id + ' cỡ/vị trí ' + a.sp);
      assert.ok(a.bt != null || a.tp != null, id + ' thiếu vị trí dọc');
      assert.ok(a.a == null || ['treo', 'bong', 'quay', 'luon', 'nhip'].includes(a.a), id + ' chuyển động ' + a.a);
    }
  }
});
test('hạt: cùng hạt giống cho cùng kết quả, khác hạt giống thì khác; số hạt, cỡ, thời gian, độ đậm đúng khoảng của bộ', () => {
  for (const id of S.DANH_SACH) {
    const c = U.HIEU_UNG[id].hat, a = U.taoHat(id, U.mulberry32(7)), b = U.taoHat(id, U.mulberry32(7)), d = U.taoHat(id, U.mulberry32(8));
    assert.deepStrictEqual(a, b, id + ' không lặp lại được');
    assert.notDeepStrictEqual(a, d, id + ' hạt giống không có tác dụng');
    assert.strictEqual(a.length, c.n);
    assert.strictEqual(U.taoHat(id, U.mulberry32(7), 0.5).length, Math.round(c.n * 0.5));
    assert.strictEqual(U.taoHat(id, U.mulberry32(7), 0).length, 0);
    const sps = c.loai.map((l) => l.sp);
    for (const p of a) {
      assert.strictEqual(p.kieu, c.kieu); assert.ok(sps.includes(p.sp));
      const l = c.loai.find((x) => x.sp === p.sp);
      assert.ok(l.c1.includes(p.c1) && p.c2 === l.c2, id);
      assert.ok(p.x >= 2 && p.x <= 96 && p.y >= 6 && p.y <= 86, id + ' vị trí');
      assert.ok(p.s >= Math.floor(l.s[0]) && p.s <= Math.ceil(l.s[1]), id + ' cỡ ' + p.s);
      assert.ok(p.t >= c.t[0] - 0.05 && p.t <= c.t[1] + 0.05, id + ' thời gian ' + p.t);
      assert.ok(p.dl <= 0 && p.dl >= -p.t - 0.05, id + ' độ trễ ' + p.dl);
      assert.ok(Math.abs(p.sw) <= c.sw, id + ' lắc ' + p.sw);
      assert.ok(p.o >= c.o[0] - 0.01 && p.o <= c.o[1] + 0.01, id + ' độ đậm ' + p.o);
    }
  }
  assert.deepStrictEqual(U.taoHat('khongco', U.mulberry32(1)), []);
});
test('bộ số ngẫu nhiên có hạt giống nằm trong [0,1) và trải đều; hatGiong ổn định', () => {
  const r = U.mulberry32(12345); let tong = 0; const o = [];
  for (let i = 0; i < 5000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); tong += v; o.push(v); }
  assert.ok(Math.abs(tong / 5000 - 0.5) < 0.03, 'trung bình ' + tong / 5000);
  assert.strictEqual(U.hatGiong('tet12/2'), U.hatGiong('tet12/2')); assert.notStrictEqual(U.hatGiong('tet12/2'), U.hatGiong('tet13/2'));
});
test('mỗi bộ có đủ loại hạt được tỉ trọng chọn tới (không loại nào chết)', () => {
  for (const id of S.DANH_SACH) {
    const c = U.HIEU_UNG[id].hat, thay = new Set();
    for (let seed = 1; seed <= 60; seed++) for (const p of U.taoHat(id, U.mulberry32(seed))) thay.add(p.sp);
    assert.deepStrictEqual([...thay].sort(), [...new Set(c.loai.map((l) => l.sp))].sort(), id);
  }
});

/* ============================================================
   Mã HTML sinh ra
   ============================================================ */
test('veHat, veTranh, veRuyBang: HTML cân thẻ, trỏ đúng hình, không lọt undefined hay NaN, biến CSS đủ', () => {
  for (const id of S.DANH_SACH) {
    for (const p of U.taoHat(id, U.mulberry32(3))) {
      const h = U.veHat(p);
      assert.deepStrictEqual(loiXml(h.replace(/<\/?i[^>]*>/g, '')), [], id);
      assert.ok(h.startsWith('<i class="sz-p ' + p.kieu + '"') && h.includes('<use href="#' + p.sp + '"/>') && !/undefined|NaN/.test(h), id);
      for (const v of ['--x', '--y', '--s', '--t', '--dl', '--sw', '--o', '--c1', '--c2']) assert.ok(h.includes(v + ':'), id + ' thiếu ' + v);
    }
    const t = U.veTranh(id);
    assert.ok(t.startsWith('<div class="sz-art" aria-hidden="true">') && t.endsWith('</div>') && !/undefined|NaN/.test(t), id);
    assert.deepStrictEqual(loiXml(t), [], id);
    assert.strictEqual((t.match(/<svg /g) || []).length, U.HIEU_UNG[id].tranh.length, id);
    const r = U.veRuyBang(S.xemThu(id));
    assert.ok(r.startsWith('<div class="sz-ribbon">') && r.includes(S.GIAO_DIEN[id].dongMau.replace(/&/g, '&amp;')) && !/undefined|NaN/.test(r), id);
    assert.deepStrictEqual(loiXml(r, true), [], id);
  }
  assert.strictEqual(U.veTranh('khongco'), ''); assert.strictEqual(U.veRuyBang({ giaoDien: 'khongco', dong: 'x' }), '');
});
test('ruy băng thoát ký tự đặc biệt (dòng chữ không bao giờ chèn được thẻ)', () => {
  const r = U.veRuyBang({ giaoDien: 'tet', dong: '<img src=x onerror=alert(1)> & "q"' });
  assert.ok(!r.includes('<img') && r.includes('&lt;img') && r.includes('&amp;') && r.includes('&quot;q&quot;'));
  assert.strictEqual(U.esc("a'b"), 'a&#39;b');
});
test('mọi dòng chữ sinh ra từ lịch (cả năm 2026) đi qua ruy băng không hỏng', () => {
  for (let jd = S.jdTuNgay(1, 1, 2026); jd < S.jdTuNgay(1, 1, 2027); jd++) {
    const x = S.ngayTuJd(jd), kq = S.chon(Date.UTC(x.y, x.m - 1, x.d, 5));
    const r = U.veRuyBang(kq);
    assert.ok(r.length > 60 && loiXml(r, true).length === 0, x.d + '/' + x.m);
    assert.ok(U.HIEU_UNG[kq.giaoDien], kq.giaoDien);
  }
});

/* ============================================================
   Khớp với CSS và việc nối vào app
   ============================================================ */
test('mọi lớp chuyển động và kiểu hạt dùng trong mã đều có luật CSS và keyframes tương ứng', () => {
  const css = doc('tenant-app/css/tenant.css');
  for (const a of ['treo', 'bong', 'quay', 'luon', 'nhip']) {
    assert.ok(new RegExp('\\.sz-' + a + '\\s*\\{').test(css), '.sz-' + a);
    assert.ok(new RegExp('@keyframes sz' + a[0].toUpperCase() + a.slice(1) + '\\b').test(css), 'keyframes ' + a);
  }
  for (const k of ['Roi', 'Bay', 'Lap']) assert.ok(new RegExp('@keyframes sz' + k + '\\b').test(css), 'keyframes hạt ' + k);
  assert.ok(/\.sz-p\.bay\s*\{/.test(css) && /\.sz-p\.lap\s*\{/.test(css));
  // lớp phủ nằm dưới thanh tab (40), nút trợ lý (45), thông báo (90), hộp thoại (100) và không bắt chạm
  const lop = /\.sz-layer\s*\{([^}]*)\}/.exec(css)[1];
  assert.ok(/pointer-events:\s*none/.test(lop) && /position:\s*fixed/.test(lop));
  assert.ok(+/z-index:\s*(\d+)/.exec(lop)[1] < 40, 'lớp hạt phải nằm dưới thanh tab');
  // chỉ dùng transform và opacity để chạy hạt
  for (const kf of ['szRoi', 'szBay', 'szLap']) {
    const body = new RegExp('@keyframes ' + kf + '\\s*\\{([\\s\\S]*?)\\n\\}').exec(css)[1];
    assert.ok(!/\b(top|left|width|height|margin|box-shadow|filter)\s*:/.test(body), kf + ' dùng thuộc tính tốn kém');
  }
  assert.ok(/\.sz-tinh \.sz-art > svg\s*\{\s*animation:\s*none/.test(css), 'bản tĩnh phải dừng tranh');
});
test('app khách tải seasons.js trước season-ui.js trước tenant.js, khởi động bằng init, và service worker lưu cả hai tệp', () => {
  const h = doc('tenant-app/index.html');
  const i1 = h.indexOf('../js/seasons.js'), i2 = h.indexOf('js/season-ui.js'), i3 = h.indexOf('HH.seasonUI.init()'), i4 = h.indexOf('js/tenant.js');
  assert.ok(i1 > 0 && i1 < i2 && i2 < i3 && i3 < i4, 'thứ tự nạp: ' + [i1, i2, i3, i4]);
  const sw = doc('tenant-app/sw.js');
  assert.ok(sw.includes("'../js/seasons.js'") && sw.includes("'./js/season-ui.js'"));
  const t = doc('tenant-app/js/tenant.js');
  assert.ok(t.includes('HH.seasonUI.afterRender()') && t.includes('HH.seasonUI.settingsHtml()') && t.includes('HH.seasonUI.wireSettings()'));
  assert.ok(/shell\(title, body, opts\)[\s\S]*?HH\.seasonUI\.afterRender\(\)/.test(t), 'afterRender phải được gọi trong shell()');
});
test('phiên bản tệp trong index.html và tên bộ nhớ đệm của service worker đã được nâng', () => {
  const sw = doc('tenant-app/sw.js'), h = doc('tenant-app/index.html');
  assert.ok(+/hh-tenant-v(\d+)/.exec(sw)[1] >= 27);
  assert.ok(+/tenant\.css\?v=(\d+)/.exec(h)[1] >= 48 && +/js\/tenant\.js\?v=(\d+)/.exec(h)[1] >= 48);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

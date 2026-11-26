/* App khách: lớp phủ toàn màn hình (position: fixed; inset: 0) không được trùng tên lớp với phần tử thường.
   Lỗi thật (26/11): tiêu đề điều khoản hợp đồng dùng lớp .tt, trùng lớp phủ của phần hướng dẫn (tour.js),
   nên mỗi điều khoản thành một lớp phủ vô hình che cả trang: vào xem hợp đồng xong không bấm, không cuộn được nữa.
   Chạy:  node tests/tenant-class-collision.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const goc = path.join(__dirname, '..');
const doc = (p) => fs.readFileSync(path.join(goc, p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};

const css = doc('tenant-app/css/tenant.css').replace(/\/\*[\s\S]*?\*\//g, '');
// Tệp JS app khách nạp (đọc từ index.html), bỏ chú thích
const html = doc('tenant-app/index.html');
const tepJs = [...html.matchAll(/<script[^>]+src="([^"?]+)/g)].map(m => path.normalize(path.join('tenant-app', m[1]))).filter(p => fs.existsSync(path.join(goc, p)));
const ma = Object.fromEntries(tepJs.map(p => [p, doc(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')]));

/** Các lớp mà quy tắc CSS của riêng nó là lớp phủ cả màn hình */
function lopPhu() {
  const ra = new Set();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const than = m[2];
    if (!/position:\s*fixed/.test(than) || !/inset:\s*0\b/.test(than)) continue;
    m[1].split(',').map(s => s.trim()).forEach(s => { const k = /^\.([A-Za-z][\w-]*)$/.exec(s); if (k) ra.add(k[1]); });
  }
  return [...ra];
}
/** Tệp nào gắn lớp này cho phần tử (class="...", className = '...', classList.add('...')) */
function tepDung(lop) {
  const re = new RegExp('(^|[\\s"\'`])' + lop.replace(/-/g, '\\-') + '(?=[\\s"\'`]|$)');
  return Object.keys(ma).filter(p => {
    const s = ma[p];
    const chuoi = [...s.matchAll(/class(?:Name)?\s*=\s*(["'`])([\s\S]*?)\1/g)].map(x => x[2])
      .concat([...s.matchAll(/classList\.(?:add|toggle)\(\s*(["'`])([^"'`]+)\1/g)].map(x => x[2]))
      .concat([...s.matchAll(/className\s*=\s*(["'`])([^"'`]+)\1/g)].map(x => x[2]));
    return chuoi.some(c => re.test(' ' + c + ' '));
  });
}

test('tìm được các lớp phủ cả màn hình (có .tt của phần hướng dẫn)', () => {
  assert.ok(tepJs.length >= 5, 'không đọc được danh sách tệp JS');
  assert.ok(lopPhu().includes('tt'), 'không thấy .tt: ' + lopPhu().join(', '));
});
test('mỗi lớp phủ cả màn hình chỉ do MỘT tệp dùng (tệp sở hữu nó)', () => {
  const sai = lopPhu().map(l => [l, tepDung(l)]).filter(([, ds]) => ds.length > 1);
  assert.deepStrictEqual(sai.map(([l, ds]) => l + ': ' + ds.join(', ')), []);
});
test('.tt chỉ dùng trong tour.js (phần hướng dẫn)', () => {
  assert.deepStrictEqual(tepDung('tt').map(p => path.basename(p)), ['tour.js']);
});
test('điều khoản hợp đồng dùng lớp riêng term-t / term-b', () => {
  const t = doc('tenant-app/js/tenant.js');
  assert.match(t, /<div class="term-item"><div class="term-t">Điều \$\{i \+ 1\}/);
  assert.match(t, /<div class="term-b">\$\{esc\(t\.body\)\}<\/div>/);
  assert.match(css, /\.term-item \.term-t \{/);
});
test('trang hợp đồng không có nút dẫn về chính nó; nút trên thẻ hợp đồng không còn chữ trắng nền trắng', () => {
  const t = doc('tenant-app/js/tenant.js');
  assert.match(t, /shell\('Hợp đồng & điều khoản', `\s*\$\{contractCard\(c, \{ khongNut: true \}\)\}/);
  assert.ok(!/rgba\(255,255,255,\.22\)/.test(t), 'còn nền trắng mờ trên nút');
});
test('đã nâng phiên bản tệp app khách và bộ nhớ đệm', () => {
  assert.ok(+/tenant\.js\?v=(\d+)/.exec(html)[1] >= 54 && +/tenant\.css\?v=(\d+)/.exec(html)[1] >= 53);
  assert.ok(+/hh-tenant-v(\d+)/.exec(doc('tenant-app/sw.js'))[1] >= 33);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

/* Kiểm thử các chỗ dọn cho dễ dùng (người đọc màn hình, điện thoại): không còn hộp confirm() của trình duyệt ở những chỗ đã thay,
   nút chỉ có biểu tượng có tên, ô nhập có nhãn, phóng to được, vùng chạm đủ lớn trên màn hình cảm ứng, ô nhập chữ không nhỏ hơn 16px.
   Phần chạy thật đã thử bằng trình duyệt. Chạy:  node tests/a11y.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const boChuThich = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');      // ghi chú nhắc tới confirm() thì không tính
const t = doc('tenant-app/js/tenant.js'), css = doc('tenant-app/css/tenant.css'), th = doc('tenant-app/index.html');
const ta = doc('js/pages/tenant-access.js'), comp = doc('js/components.js'), more = doc('js/pages/more.js'), app = doc('js/app.js');

test('app khách: đăng xuất hỏi bằng tờ trượt của app (confirmSheet), không còn confirm() của trình duyệt', () => {
  assert.ok(!/\bconfirm\(/.test(boChuThich(t).replace(/confirmSheet\(/g, '')), 'còn confirm()');
  assert.match(t, /async function hoiDangXuat\(\) \{\s*const ok = await confirmSheet\('Đăng xuất\?'/);
  assert.match(t, /if \(slo\) slo\.onclick = hoiDangXuat;/);
  assert.match(t, /el\('logoutBtn'\)\.onclick = hoiDangXuat;/);
  assert.match(t, /'Đăng xuất', 'Ở lại'\)/, 'nút chính (to) phải là "Ở lại"');
});
test('web chủ trọ: cấp lại mã cho TẤT CẢ khách xác nhận hai bước trong hộp thoại, không còn confirm()', () => {
  assert.ok(!/\bconfirm\(/.test(boChuThich(ta)));
  const i = ta.indexOf('go.onclick = async'), k = ta.slice(i, ta.indexOf("goi('owner_issue_tenant_codes'", i) + 40);
  assert.ok(i > 0 && k.length > 100, 'không thấy đoạn bấm nút cấp mã cả tòa');
  assert.match(k, /if \(mode === 'all' && !daCanh\) \{/);
  assert.match(k, /go\.className = 'btn btn-danger'/);
  assert.match(k, /return;\s*\}/, 'bấm lần đầu phải dừng, chưa gọi máy chủ');
  const kAll = k.slice(k.indexOf("if (mode === 'all' && !daCanh)"));
  assert.ok(kAll.indexOf('return;') > 0 && kAll.indexOf('return;') < kAll.indexOf("goi('owner_issue_tenant_codes'"), 'cảnh báo phải đứng trước lệnh gọi máy chủ');
  assert.match(ta, /r\.onchange = boCanh/);
});
test('nút sao chép (chỉ có biểu tượng) ở app khách đều có tên đọc được', () => {
  const nut = t.match(/<button class="copybtn"[^>]*>/g) || [];
  assert.ok(nut.length >= 4, 'tìm được ' + nut.length);
  nut.forEach((b) => { assert.match(b, /aria-label="Sao chép [^"]+"/, b); assert.match(b, /type="button"/, b); });
});
test('bảng chọn nhiều dòng (hóa đơn...) có tên cho ô chọn tất cả và ô chọn từng dòng', () => {
  assert.match(comp, /data-check-all aria-label="Chọn tất cả các dòng"/);
  assert.match(comp, /data-row-check="\$\{esc\(rid\)\}" aria-label="Chọn \$\{esc\(rid\)\}"/);
});
test('ô nhập của thông tin tòa nhà và thêm tòa nhà có nhãn gắn đúng ô', () => {
  ['bName', 'bAddr', 'bFloors'].forEach((id) => assert.match(more, new RegExp(`<label for="${id}">`), id));
  ['nbName', 'nbAddr'].forEach((id) => assert.match(app, new RegExp(`<label for="${id}">`), id));
});
test('app khách cho phóng to (không còn maximum-scale / user-scalable=no)', () => {
  const vp = (th.match(/<meta name="viewport" content="([^"]+)"/) || [])[1] || '';
  assert.ok(vp.includes('width=device-width'));
  assert.ok(!/maximum-scale|user-scalable\s*=\s*no/i.test(vp), vp);
});
test('ô nhập chữ của app khách không nhỏ hơn 16px (iPhone tự phóng to khi chạm vào ô nhỏ hơn)', () => {
  const luat = css.match(/[^{}]*(input|textarea|select|\.t-input|\.t-textarea)[^{}]*\{[^}]*font-size:\s*[\d.]+px[^}]*\}/g) || [];
  assert.ok(luat.length >= 3);
  luat.forEach((r) => {
    const sel = r.slice(0, r.indexOf('{'));
    if (/::|:focus|checkbox|radio|range/.test(sel)) return;
    const px = +(/font-size:\s*([\d.]+)px/.exec(r)[1]);
    assert.ok(px >= 16, sel.trim() + ' = ' + px + 'px');
  });
  assert.match(css, /\.chat-input textarea \{[^}]*font-size: 16px/);
});
test('màn hình cảm ứng: nút quay lại, tải lại, sao chép, chọn giao diện, gợi ý chat, "Xem biên lai" đủ vùng chạm', () => {
  const i = css.indexOf('@media (pointer: coarse)'); assert.ok(i > 0, 'thiếu khối @media (pointer: coarse)');
  const k = css.slice(i, css.indexOf('\n}', i));
  assert.match(k, /\.t-header \.iconbtn, \.t-header \.back \{ width: 44px; height: 44px;/);
  assert.match(k, /\.copybtn \{ min-width: 44px; min-height: 40px; \}/);
  ['.t-pill', '.chat-new', '.chat-sugg button', '.sz-chip'].forEach((s) => assert.ok(k.includes(s), s));
  assert.match(k, /\.t-seg button \{ min-height: 40px;/);
  // nút chữ trong dòng nới vùng chạm bằng lề âm: lề âm không lớn hơn phần đệm thêm (chữ đứng yên)
  const lb = /\.link-btn \{ padding: (\d+)px (\d+)px; margin: -(\d+)px -(\d+)px -(\d+)px; \}/.exec(k);
  assert.ok(lb, 'link-btn'); assert.ok(+lb[1] * 2 + 18 >= 40, 'vùng chạm link-btn');
  assert.ok(+lb[3] + +lb[5] <= +lb[1] * 2 && +lb[4] === +lb[2]);
});
test('web chủ trọ trên màn hình cảm ứng: ô nhập 16px (kể cả ô trợ lý), nút trợ lý, ảnh đại diện, chọn tháng, phân trang, thẻ, liên kết nhỏ đủ vùng chạm', () => {
  const mc = doc('css/mobile.css'), i = mc.indexOf('@media (pointer: coarse)'), k = mc.slice(i, mc.indexOf('\n}', i));
  assert.match(k, /\.input, \.select, \.textarea, select\.input, #asIn \{ font-size: 16px; \}/);
  assert.match(k, /\.btn \{ min-height: 44px; \}/);
  [/\.as-x \{ width: 40px; height: 40px;/, /\.as-send \{ width: 44px; height: 44px;/, /\.mt \.av \{ width: 40px; height: 40px; flex-basis: 40px; \}/,
    /\.period \.yr, \.period \.mo \{ min-height: 40px; min-width: 40px; \}/, /\.view-toggle button, \.pager button \{ min-height: 40px; min-width: 40px; \}/,
    /\.tabs \.tab \{ min-height: 44px; \}/, /\.link-sm \{ display: inline-block; padding: 12px 6px; margin: -12px -6px; \}/].forEach((re) => assert.match(k, re, String(re)));
  assert.ok(!/maximum-scale/.test(doc('index.html')), 'web chủ trọ cũng phải phóng to được');
});
test('đã nâng số phiên bản tệp đổi (khỏi dính bộ nhớ đệm cũ)', () => {
  assert.ok(+/mobile\.css\?v=(\d+)/.exec(doc('index.html'))[1] >= 103);
  assert.ok(+/tenant\.css\?v=(\d+)/.exec(th)[1] >= 52);
  assert.ok(+/js\/tenant\.js\?v=(\d+)/.exec(th)[1] >= 53);
  assert.ok(+/hh-tenant-v(\d+)/.exec(doc('tenant-app/sw.js'))[1] >= 32);
  const oh = doc('index.html');
  assert.ok(+/components\.js\?v=(\d+)/.exec(oh)[1] >= 103 && +/tenant-access\.js\?v=(\d+)/.exec(oh)[1] >= 103);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

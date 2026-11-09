/* Kiểm thử Trung tâm trợ giúp và hướng dẫn làm quen (js/help.js).
   Chạy:  node tests/help.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('../js/help.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};
const doc = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const router = doc('js/router.js'), store = doc('js/store.js'), appjs = doc('js/app.js');
const ROUTES = new Set([...router.matchAll(/pat: '([^']+)'/g)].map((m) => m[1]));
const PERMS = new Set([...store.slice(store.indexOf('const PERMISSIONS = ['), store.indexOf('const DEFAULT_STAFF_PERMS')).matchAll(/key: '([a-z]+)'/g)].map((m) => m[1]));

/* ---------- Dữ liệu bài viết ---------- */
test('đọc được danh sách route và quyền từ mã nguồn (nền cho các ca đối chiếu bên dưới)', () => {
  assert.ok(ROUTES.size >= 25, 'route: ' + ROUTES.size); assert.ok(PERMS.size >= 10, 'quyền: ' + PERMS.size);
  assert.ok(ROUTES.has('/b/:bid/units') && PERMS.has('invoices'));
});
test('mã bài không trùng, đủ trường, mỗi bài có từ hai bước trở lên', () => {
  assert.strictEqual(new Set(H.BAI.map((b) => b.id)).size, H.BAI.length);
  H.BAI.forEach((b) => {
    assert.ok(b.id && b.tieuDe && b.tuKhoa, b.id);
    assert.ok(Array.isArray(b.buoc) && b.buoc.length >= 2, b.id);
    b.buoc.forEach((s) => assert.ok(typeof s === 'string' && s.length > 10, b.id + ': bước rỗng'));
  });
});
test('mọi bài thuộc một nhóm có thật; nhóm nào cũng có bài', () => {
  const ma = new Set(H.NHOM.map((g) => g.ma));
  H.BAI.forEach((b) => assert.ok(ma.has(b.nhom), b.id + ' nhóm ' + b.nhom));
  H.NHOM.forEach((g) => assert.ok(H.BAI.some((b) => b.nhom === g.ma), 'nhóm trống: ' + g.ma));
});
test('mọi đường dẫn trong bài là một route CÓ THẬT trong router.js (đổi tên route mà quên sửa bài thì hỏng ở đây)', () => {
  H.BAI.forEach((b) => { if (b.lienKet) { assert.ok(ROUTES.has(b.lienKet.duong), b.id + ' → ' + b.lienKet.duong); assert.ok(b.lienKet.nhan, b.id); } });
});
test('mọi quyền ghi trong bài có trong danh sách quyền của store.js', () => {
  H.BAI.forEach((b) => { if (b.quyen) assert.ok(PERMS.has(b.quyen), b.id + ' quyền ' + b.quyen); });
});
test('không bài nào chứa ký tự < hoặc > (nội dung được hiện như chữ, nhưng giữ sạch để khỏi nhầm khi sửa)', () => {
  H.BAI.forEach((b) => [b.tieuDe].concat(b.buoc).forEach((s) => assert.ok(!/[<>]/.test(s), b.id)));
});
test('các bài về tiền nói đúng điều quan trọng: nhắc nợ chỉ soạn không tự gửi; xóa dữ liệu không hoàn tác; kiểm QR không chuyển tiền', () => {
  const noi = (id) => H.BAI.find((b) => b.id === id).buoc.join(' ');
  assert.ok(/không tự gửi/.test(noi('nhac-no')));
  assert.ok(/KHÔNG hoàn tác/.test(noi('xoa-du-lieu-mau')));
  assert.ok(/đừng bấm chuyển tiền/.test(noi('tai-khoan-nhan-tien')));
});

/* ---------- Tìm kiếm ---------- */
const CHU = { isOwner: true, can: () => true };
test('tìm rỗng hoặc toàn khoảng trắng trả hết bài theo thứ tự soạn', () => {
  assert.strictEqual(H.tim('', CHU).length, H.BAI.length); assert.strictEqual(H.tim('   ', CHU).length, H.BAI.length);
  assert.deepStrictEqual(H.tim(null, CHU).map((b) => b.id), H.BAI.map((b) => b.id));
});
test('tìm bỏ dấu, không phân biệt hoa thường: "hoa don" và "HÓA ĐƠN" ra cùng kết quả', () => {
  const a = H.tim('hoa don', CHU).map((b) => b.id), b = H.tim('HÓA ĐƠN', CHU).map((x) => x.id);
  assert.deepStrictEqual(a, b); assert.ok(a.indexOf('chot-so-phat-hanh') >= 0);
});
test('gõ không dấu vẫn ra bài có chữ đ có dấu: "doi soat", "duong dan", "dang nhap"', () => {
  assert.ok(H.tim('doi soat', CHU).some((b) => b.id === 'nhan-tien-tu-dong'));
  assert.ok(H.tim('doi soat', CHU).length === H.tim('đối soát', CHU).length);
  assert.ok(H.tim('dang nhap', CHU).some((b) => b.id === 'ma-vao-app'));
  assert.ok(H.tim('dien thoai', CHU).some((b) => b.id === 'ma-vao-app'));      // "điện thoại" có đ viết thường
  assert.strictEqual(H.gon('điện đường'), 'dien duong');
  assert.strictEqual(H.gon('Đỗ Thị Đào'), 'do thi dao');
});
test('từ khóa chỉ có trong phần từ khóa ẩn vẫn tìm được ("ocr", "pwa")', () => {
  assert.strictEqual(H.tim('ocr', CHU)[0].id, 'them-khach');
  assert.ok(H.tim('pwa', CHU).some((b) => b.id === 'app-khach'));
});
test('tìm theo nội dung bước: "phân bổ" ra bài ghi nhận thanh toán', () => assert.ok(H.tim('phan bo', CHU).some((b) => b.id === 'ghi-thanh-toan')));
test('mọi từ phải xuất hiện (và): thêm từ lạ thì không ra gì', () => {
  assert.ok(H.tim('hoa don', CHU).length > 0); assert.strictEqual(H.tim('hoa don zzzkhongco', CHU).length, 0);
});
test('xếp hạng: khớp tiêu đề đứng trước khớp chỉ trong nội dung', () => {
  const r = H.tim('nhac no', CHU); assert.strictEqual(r[0].id, 'nhac-no');
});
test('ký tự đặc biệt trong ô tìm không làm hỏng (regex, dấu ngoặc, chuỗi dài)', () => {
  ['(', '[a-', '.*', '\\', '$^', '<script>', 'a'.repeat(5000)].forEach((q) => assert.ok(Array.isArray(H.tim(q, CHU))));
});
test('không có quyền thì ẩn bài: nhân viên chỉ có quyền rooms không thấy bài hóa đơn, thanh toán', () => {
  const nv = { isOwner: false, can: (p) => p === 'rooms' };
  const ids = H.tim('', nv).map((b) => b.id);
  assert.ok(ids.indexOf('tao-phong') >= 0); assert.strictEqual(ids.indexOf('chot-so-phat-hanh'), -1); assert.strictEqual(ids.indexOf('ghi-thanh-toan'), -1);
});
test('bài chỉ dành cho chủ trọ ẩn với nhân viên dù nhân viên có đủ quyền', () => {
  const nv = { isOwner: false, can: () => true }, ids = H.tim('', nv).map((b) => b.id);
  ['khach-tu-khai', 'ma-vao-app', 'nhan-vien', 'xoa-du-lieu-mau', 'tai-khoan-nhan-tien'].forEach((id) => assert.strictEqual(ids.indexOf(id), -1, id));
  assert.ok(ids.indexOf('doi-mat-khau') >= 0);
});
test('không truyền người dùng thì không ẩn gì (để thử)', () => assert.strictEqual(H.tim('').length, H.BAI.length));
test('duongDan: thay :bid, route chung giữ nguyên, thiếu tòa nhà thì null; mã tòa có ký tự lạ được mã hóa', () => {
  assert.strictEqual(H.duongDan({ duong: '/b/:bid/units' }, 'b1'), '#/b/b1/units');
  assert.strictEqual(H.duongDan({ duong: '/config' }, null), '#/config');
  assert.strictEqual(H.duongDan({ duong: '/b/:bid/units' }, null), null);
  assert.strictEqual(H.duongDan({ duong: '/b/:bid/units' }, 'a/b'), '#/b/a%2Fb/units');
  assert.strictEqual(H.duongDan(null, 'b1'), null); assert.strictEqual(H.duongDan({}, 'b1'), null);
});

/* ---------- Hướng dẫn làm quen ---------- */
test('mã bước không trùng; bước đầu và bước cuối không chỉ vào phần tử nào (thẻ giữa màn hình)', () => {
  assert.strictEqual(new Set(H.BUOC_TOUR.map((s) => s.id)).size, H.BUOC_TOUR.length);
  assert.deepStrictEqual(H.BUOC_TOUR[0].mucTieu, []); assert.deepStrictEqual(H.BUOC_TOUR[H.BUOC_TOUR.length - 1].mucTieu, []);
  H.BUOC_TOUR.forEach((s) => assert.ok(s.tieuDe && s.noiDung && Array.isArray(s.mucTieu), s.id));
});
test('quyền của bước có thật', () => H.BUOC_TOUR.forEach((s) => { if (s.quyen) assert.ok(PERMS.has(s.quyen), s.id); }));
test('mọi bộ chọn của bước chỉ vào thứ có thật: route có trong router.js, mã phần tử có trong app.js', () => {
  H.BUOC_TOUR.forEach((s) => s.mucTieu.forEach((sel) => {
    const h1 = sel.match(/href\$="([^"]+)"/), h2 = sel.match(/href="#([^"]+)"/), id = sel.match(/^#([A-Za-z]+)$/), da = sel.match(/data-act="([a-z]+)"/);
    if (h1) assert.ok(ROUTES.has('/b/:bid' + h1[1]), s.id + ' ' + sel);
    else if (h2) assert.ok(ROUTES.has(h2[1]), s.id + ' ' + sel);
    else if (id) assert.ok(appjs.indexOf('id="' + id[1] + '"') >= 0, s.id + ' ' + sel);
    else if (da) assert.ok(appjs.indexOf('data-act="' + da[1] + '"') >= 0, s.id + ' ' + sel);
    else assert.fail('bộ chọn lạ: ' + sel);
  }));
});
test('lapTour: chủ trọ có đủ bước; nhân viên thiếu quyền mất đúng các bước đó, vẫn còn bước đầu và cuối', () => {
  assert.strictEqual(H.lapTour({ can: () => true }).length, H.BUOC_TOUR.length);
  assert.strictEqual(H.lapTour().length, H.BUOC_TOUR.length);
  const nv = H.lapTour({ can: (p) => p === 'rooms' }).map((s) => s.id);
  assert.strictEqual(nv[0], 'chao'); assert.strictEqual(nv[nv.length - 1], 'xong');
  assert.ok(nv.indexOf('phong') >= 0); ['hoa-don', 'khach', 'chuyen-khoan', 'tong-bao-cao'].forEach((id) => assert.strictEqual(nv.indexOf(id), -1, id));
  assert.strictEqual(H.lapTour({ can: () => false }).every((s) => !s.quyen), true);
});
test('dich: đi tới, lùi, kẹp ở hai đầu, bấm Tiếp ở bước cuối là xong', () => {
  assert.deepStrictEqual(H.dich(0, 1, 5), { i: 1, xong: false });
  assert.deepStrictEqual(H.dich(3, 1, 5), { i: 4, xong: false });
  assert.deepStrictEqual(H.dich(4, 1, 5), { i: 4, xong: true });
  assert.deepStrictEqual(H.dich(0, -1, 5), { i: 0, xong: false });
  assert.deepStrictEqual(H.dich(3, -1, 5), { i: 2, xong: false });
});
test('dich: đầu vào lạ (âm, quá lớn, không có bước nào) không ra chỉ số ngoài khoảng', () => {
  assert.deepStrictEqual(H.dich(-3, 1, 5), { i: 1, xong: false });
  assert.deepStrictEqual(H.dich(99, -1, 5), { i: 3, xong: false });
  assert.deepStrictEqual(H.dich(0, 1, 0), { i: 0, xong: true });
  assert.deepStrictEqual(H.dich(NaN, 1, 3), { i: 1, xong: false });
});
const KN = { w: 1000, h: 700 }, THE = { w: 320, h: 160 };
test('datThe: ưu tiên bên dưới phần tử, căn giữa theo phần tử', () => {
  const r = H.datThe({ x: 400, y: 100, w: 100, h: 40 }, THE, KN);
  assert.strictEqual(r.cho, 'duoi'); assert.strictEqual(r.y, 152); assert.strictEqual(r.x, 450 - 160);
});
test('datThe: không đủ chỗ bên dưới thì lên trên; không đủ cả hai thì giữa màn hình', () => {
  assert.strictEqual(H.datThe({ x: 400, y: 600, w: 100, h: 40 }, THE, KN).cho, 'tren');
  assert.strictEqual(H.datThe({ x: 400, y: 300, w: 100, h: 40 }, { w: 320, h: 650 }, KN).cho, 'giua');
});
test('datThe: luôn nằm trọn trong khung nhìn (sát mép trái, mép phải, màn hình hẹp)', () => {
  const l = H.datThe({ x: 0, y: 100, w: 40, h: 40 }, THE, KN), p = H.datThe({ x: 980, y: 100, w: 40, h: 40 }, THE, KN);
  assert.ok(l.x >= 12 && p.x + p.w <= KN.w - 12);
  const hep = H.datThe({ x: 50, y: 100, w: 40, h: 40 }, { w: 320, h: 160 }, { w: 300, h: 600 });
  assert.ok(hep.x >= 12 && hep.x + hep.w <= 300 - 12, JSON.stringify(hep));
});
test('datThe: không có phần tử thì giữa màn hình', () => {
  const r = H.datThe(null, THE, KN); assert.strictEqual(r.cho, 'giua'); assert.strictEqual(r.x, 340); assert.strictEqual(r.y, 270);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

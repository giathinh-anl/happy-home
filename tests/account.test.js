/* Kiểm thử hồ sơ và cài đặt cá nhân (js/account.js).
   Chạy:  node tests/account.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const A = require('../js/account.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

/* ---------- Đổi mật khẩu ---------- */
const chk = (o) => A.kiemMatKhau(Object.assign({ cu: 'MatKhauCu1', moi: 'Mk-moi-an-toan-77', nhapLai: 'Mk-moi-an-toan-77', email: 'chu@happyhome.vn' }, o));

test('mật khẩu mới tốt: không lỗi', () => { const r = chk(); assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.loi, {}); });
test('thiếu mật khẩu hiện tại', () => assert.strictEqual(chk({ cu: '' }).loi.cu, 'Nhập mật khẩu hiện tại'));
test('thiếu mật khẩu mới và nhập lại: báo từng ô', () => {
  const r = chk({ moi: '', nhapLai: '' }); assert.strictEqual(r.ok, false);
  assert.strictEqual(r.loi.moi, 'Nhập mật khẩu mới'); assert.strictEqual(r.loi.nhapLai, 'Nhập lại mật khẩu mới');
});
test('ngắn dưới 8 ký tự', () => assert.ok(/tối thiểu 8/.test(chk({ moi: 'Ab1', nhapLai: 'Ab1' }).loi.moi)));
test('đúng 8 ký tự có chữ và số thì được', () => assert.strictEqual(chk({ moi: 'Zk9xq2wv', nhapLai: 'Zk9xq2wv' }).ok, true));
test('quá 72 ký tự bị từ chối (bcrypt cắt âm thầm), đúng 72 thì được', () => {
  assert.ok(/tối đa 72/.test(chk({ moi: 'a1'.repeat(37), nhapLai: 'a1'.repeat(37) }).loi.moi));
  const m72 = 'Ab1' + 'x'.repeat(69); assert.strictEqual(m72.length, 72);
  assert.strictEqual(chk({ moi: m72, nhapLai: m72 }).ok, true);
});
test('chỉ chữ hoặc chỉ số: cần cả hai', () => {
  assert.strictEqual(chk({ moi: 'chiCoChuCaiThoi', nhapLai: 'chiCoChuCaiThoi' }).loi.moi, 'Mật khẩu mới cần có cả chữ và số');
  assert.strictEqual(chk({ moi: '73920184653', nhapLai: '73920184653' }).loi.moi, 'Mật khẩu mới cần có cả chữ và số');
});
test('giống mật khẩu hiện tại bị từ chối', () => assert.strictEqual(chk({ cu: 'Zk9xq2wv', moi: 'Zk9xq2wv', nhapLai: 'Zk9xq2wv' }).loi.moi, 'Mật khẩu mới phải khác mật khẩu hiện tại'));
test('mật khẩu dễ đoán bị từ chối, kể cả viết hoa hoặc có khoảng trắng; demo1234 (nằm trong mã nguồn công khai) luôn bị chặn', () => {
  ['demo1234', 'Demo1234', 'DEMO 1234', 'password1', 'happyhome123', 'abc12345', 'Qwerty123'].forEach((m) =>
    assert.ok(/dễ đoán/.test(chk({ moi: m, nhapLai: m }).loi.moi || ''), m));
});
test('chứa tên đăng nhập (trước @) bị từ chối; tên quá ngắn thì không xét', () => {
  assert.ok(/tên đăng nhập/.test(chk({ email: 'nguyenvana@gmail.com', moi: 'nguyenvana2026', nhapLai: 'nguyenvana2026' }).loi.moi));
  assert.ok(/tên đăng nhập/.test(chk({ email: 'Nguyễn.Văn.A@gmail.com', moi: 'NGUYEN.VAN.A-77', nhapLai: 'NGUYEN.VAN.A-77' }).loi.moi || ''));
  assert.strictEqual(chk({ email: 'ab@x.vn', moi: 'xab9kqzw1', nhapLai: 'xab9kqzw1' }).ok, true);
});
test('nhập lại không khớp', () => assert.strictEqual(chk({ nhapLai: 'Khac-hoan-toan-12' }).loi.nhapLai, 'Hai lần nhập mật khẩu mới chưa giống nhau'));
test('mật khẩu mới đã sai thì không báo thêm lỗi nhập lại không khớp (một lỗi mỗi lần là đủ)', () => {
  const r = chk({ moi: 'Ab1', nhapLai: 'khac' }); assert.ok(r.loi.moi); assert.strictEqual(r.loi.nhapLai, undefined);
});
test('đầu vào hỏng (null, undefined, số) không làm hàm ném lỗi', () => {
  assert.strictEqual(A.kiemMatKhau(null).ok, false); assert.strictEqual(A.kiemMatKhau(undefined).ok, false);
  assert.strictEqual(A.kiemMatKhau({ cu: 5, moi: 12345678, nhapLai: 12345678 }).ok, false);
});
test('danh sách mật khẩu yếu: toàn chữ thường, không trùng', () => {
  A.MAT_KHAU_YEU.forEach((m) => assert.strictEqual(m, m.toLowerCase()));
  assert.strictEqual(new Set(A.MAT_KHAU_YEU).size, A.MAT_KHAU_YEU.length);
  assert.ok(A.MAT_KHAU_YEU.indexOf('demo1234') >= 0);
});

/* ---------- Độ mạnh ---------- */
test('độ mạnh: rỗng, rất yếu, dài và đủ loại thì mạnh', () => {
  assert.deepStrictEqual(A.doManh(''), { diem: 0, nhan: '' });
  assert.strictEqual(A.doManh('demo1234').diem, 0);
  assert.strictEqual(A.doManh('abc').diem <= 1, true);
  assert.strictEqual(A.doManh('Mk-moi-an-toan-77!').diem, 4);
});
test('độ mạnh tăng theo độ dài và độ đa dạng, không giảm', () => {
  const a = A.doManh('Zk9xq2wv').diem, b = A.doManh('Zk9xq2wvMN').diem, c = A.doManh('Zk9xq2wvMN-45pl').diem;
  assert.ok(a <= b && b <= c, [a, b, c].join());
});
test('ngắn hơn 8 ký tự thì không quá 1 điểm dù có đủ loại ký tự', () => assert.ok(A.doManh('Ab1!x').diem <= 1));

/* ---------- Nhóm việc ---------- */
test('mọi mã loại việc trong store.js đều thuộc một nhóm (không để việc mới bị lọt khỏi bảng chọn)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/store.js'), 'utf8');
  const loai = [...new Set([...src.matchAll(/loai: '([a-z-]+)'/g)].map((m) => m[1]))];
  assert.ok(loai.length >= 15, 'tìm được ' + loai.length);
  const thieu = loai.filter((l) => !A.nhomCua(l));
  assert.deepStrictEqual(thieu, [], 'mã chưa có nhóm: ' + thieu.join(', '));
});
test('mỗi mã loại chỉ thuộc đúng một nhóm; mã nhóm không trùng', () => {
  const all = [].concat(...A.NHOM_VIEC.map((g) => g.loai));
  assert.strictEqual(new Set(all).size, all.length);
  assert.strictEqual(new Set(A.NHOM_VIEC.map((g) => g.ma)).size, A.NHOM_VIEC.length);
});
const VIEC = [{ id: 'a', loai: 'nhacno' }, { id: 'b', loai: 'hdhet' }, { id: 'c', loai: 'suco' }, { id: 'd', loai: 'hoidap' }, { id: 'e', loai: 'loai-la-moi' }, { id: 'f' }];
test('lọc: không tắt nhóm nào thì giữ nguyên, và trả bản sao', () => {
  const r = A.loc(VIEC, []); assert.deepStrictEqual(r, VIEC); assert.notStrictEqual(r, VIEC);
});
test('lọc: tắt một nhóm thì chỉ bỏ việc của nhóm đó', () => assert.deepStrictEqual(A.loc(VIEC, ['tien']).map((x) => x.id), ['b', 'c', 'd', 'e', 'f']));
test('lọc: tắt nhiều nhóm; việc có mã lạ hoặc không có mã luôn được giữ', () => assert.deepStrictEqual(A.loc(VIEC, ['tien', 'hopdong', 'suco', 'hoidap']).map((x) => x.id), ['e', 'f']));
test('lọc: mã nhóm lạ hoặc đầu vào hỏng thì bỏ qua, không mất việc, không ném lỗi', () => {
  assert.strictEqual(A.loc(VIEC, ['khong-co']).length, VIEC.length);
  assert.strictEqual(A.loc(VIEC, 'tien').length, VIEC.length);
  assert.strictEqual(A.loc(VIEC, null).length, VIEC.length);
  assert.deepStrictEqual(A.loc(null, ['tien']), []);
  assert.strictEqual(A.loc([null, undefined, { loai: 'nhacno' }], ['tien']).length, 2);
});
test('chuanHoaAn: bỏ mã lạ và mã trùng, giữ thứ tự', () => {
  assert.deepStrictEqual(A.chuanHoaAn(['suco', 'x', 'suco', 'tien']), ['suco', 'tien']);
  assert.deepStrictEqual(A.chuanHoaAn('tien'), []);
  assert.deepStrictEqual(A.chuanHoaAn(undefined), []);
});

/* ---------- Ảnh đại diện ---------- */
test('kiemTepAnh: loại tệp, cỡ, tệp trống', () => {
  assert.strictEqual(A.kiemTepAnh({ type: 'image/jpeg', size: 2e6 }), '');
  assert.strictEqual(A.kiemTepAnh({ type: 'image/png', size: 1 }), '');
  assert.strictEqual(A.kiemTepAnh({ type: 'image/webp', size: 5000 }), '');
  assert.ok(A.kiemTepAnh({ type: 'image/gif', size: 100 }));
  assert.ok(A.kiemTepAnh({ type: 'application/pdf', size: 100 }));
  assert.ok(A.kiemTepAnh({ type: 'image/svg+xml', size: 100 }));      // svg có thể chứa mã chạy được
  assert.ok(A.kiemTepAnh({ type: 'image/jpeg', size: 0 }));
  assert.ok(A.kiemTepAnh({ type: 'image/jpeg', size: 9 * 1024 * 1024 }));
  assert.strictEqual(A.kiemTepAnh({ type: 'image/jpeg', size: 8 * 1024 * 1024 }), '');
  assert.ok(A.kiemTepAnh(null));
});
test('avatarHopLe: nhận data URL ảnh base64 nhỏ, từ chối mọi thứ khác', () => {
  const tot = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
  assert.strictEqual(A.avatarHopLe(tot), true);
  assert.strictEqual(A.avatarHopLe('data:image/png;base64,iVBORw0KGgo='), true);
  ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==', 'javascript:alert(1)', 'https://x.vn/a.jpg', '', null, undefined, 5, {},
    'data:image/jpeg;base64,', 'data:image/jpeg;base64,abc"onerror="alert(1)', 'data:image/jpeg;base64,a b', 'data:image/jpeg;utf8,<svg>']
    .forEach((s) => assert.strictEqual(A.avatarHopLe(s), false, String(s)));
});
test('avatarHopLe: đúng giới hạn độ dài', () => {
  const pre = 'data:image/jpeg;base64,';
  assert.strictEqual(A.avatarHopLe(pre + 'A'.repeat(A.AVATAR_TOI_DA_KY_TU - pre.length)), true);
  assert.strictEqual(A.avatarHopLe(pre + 'A'.repeat(A.AVATAR_TOI_DA_KY_TU - pre.length + 1)), false);
});
test('cat: cắt vuông giữa ảnh, thu về 160, không phóng to ảnh nhỏ', () => {
  assert.deepStrictEqual(A.cat(1600, 1200), { sx: 200, sy: 0, sw: 1200, sh: 1200, dw: 160, dh: 160 });
  assert.deepStrictEqual(A.cat(1200, 1600), { sx: 0, sy: 200, sw: 1200, sh: 1200, dw: 160, dh: 160 });
  assert.deepStrictEqual(A.cat(1000, 1000), { sx: 0, sy: 0, sw: 1000, sh: 1000, dw: 160, dh: 160 });
  assert.deepStrictEqual(A.cat(100, 80), { sx: 10, sy: 0, sw: 80, sh: 80, dw: 80, dh: 80 });
});
test('cat: cỡ ảnh bằng 0, âm, thiếu thì trả null', () => {
  assert.strictEqual(A.cat(0, 100), null); assert.strictEqual(A.cat(100, -1), null); assert.strictEqual(A.cat(), null); assert.strictEqual(A.cat('a', 'b'), null);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

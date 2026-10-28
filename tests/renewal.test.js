/* Kiểm thử gia hạn hợp đồng (js/renewal.js): tính hạn mới, lịch sử, nội dung phụ lục.
   Chạy:  node tests/renewal.test.js */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const R = require('../js/renewal.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const NAY = '2026-10-28';
const tinh = (o) => R.tinhGiaHan(Object.assign({ hetHan: '2026-11-30', homNay: NAY, soThang: 12, giaHienTai: 3000000 }, o));

console.log('Tính hạn mới');
test('còn hiệu lực: tính từ ngày hết hạn, không từ hôm nay', () => {
  const k = tinh({}); assert.ok(k.ok);
  assert.deepStrictEqual([k.tuNgay, k.denNgay, k.soThang, k.daQuaHan], ['2026-11-30', '2027-11-30', 12, false]);
});
test('đã hết hạn: tính từ hôm nay', () => {
  const k = tinh({ hetHan: '2026-09-30', soThang: 6 });
  assert.deepStrictEqual([k.tuNgay, k.denNgay, k.daQuaHan], ['2026-10-28', '2027-04-28', true]);
});
test('hết hạn đúng hôm nay: coi như đã hết, tính từ hôm nay', () => {
  const k = tinh({ hetHan: NAY, soThang: 3 }); assert.deepStrictEqual([k.tuNgay, k.daQuaHan], [NAY, true]);
});
test('hết hạn ngày mai: vẫn còn hiệu lực, tính từ ngày mai', () => {
  const k = tinh({ hetHan: '2026-10-29', soThang: 3 }); assert.deepStrictEqual([k.tuNgay, k.denNgay, k.daQuaHan], ['2026-10-29', '2027-01-29', false]);
});
test('hôm nay là 23:59 cùng ngày hết hạn: đã hết (tính theo ngày lịch, không theo giờ)', () => {
  const k = tinh({ hetHan: NAY, homNay: new Date(2026, 9, 28, 23, 59), soThang: 3 }); assert.strictEqual(k.daQuaHan, true);
});
test('lỗi thật: hết hạn 31/8, gia hạn 6 tháng ra 28/2 chứ không phải 3/3', () => {
  const k = tinh({ hetHan: '2026-08-31', homNay: '2026-08-01', soThang: 6 }); assert.strictEqual(k.denNgay, '2027-02-28');
});
test('hết hạn 31/1 gia hạn 1 tháng: 28/2', () => assert.strictEqual(tinh({ hetHan: '2027-01-31', homNay: '2027-01-01', soThang: 1 }).denNgay, '2027-02-28'));
test('chưa có ngày hết hạn: tính từ hôm nay', () => {
  [null, undefined, '', 'rác'].forEach((h) => { const k = tinh({ hetHan: h, soThang: 12 }); assert.deepStrictEqual([k.tuNgay, k.denNgay, k.daQuaHan], [NAY, '2027-10-28', true]); });
});
test('nhận hạn dạng ISO hoặc Date', () => {
  assert.strictEqual(tinh({ hetHan: new Date(2026, 10, 30).toISOString() }).tuNgay, '2026-11-30');
  assert.strictEqual(tinh({ hetHan: new Date(2026, 10, 30) }).tuNgay, '2026-11-30');
});
test('số tháng là chuỗi số vẫn được; 1 và 60 là hai đầu hợp lệ', () => {
  assert.strictEqual(tinh({ soThang: '12' }).soThang, 12); assert.ok(tinh({ soThang: 1 }).ok); assert.ok(tinh({ soThang: 60 }).ok);
});
test('số tháng sai bị từ chối: 0, âm, 61, lẻ, chữ, rỗng, null', () => {
  [0, -1, 61, 1.5, 'abc', '', null, undefined, NaN].forEach((n) => { const k = tinh({ soThang: n }); assert.strictEqual(k.ok, false, 'nhận nhầm: ' + n); assert.ok(k.loi); });
});
test('thiếu hoặc rác ngày hôm nay bị từ chối', () => { assert.strictEqual(tinh({ homNay: null }).ok, false); assert.strictEqual(tinh({ homNay: 'rác' }).ok, false); });
test('không có tham số vẫn trả lỗi, không văng', () => assert.strictEqual(R.tinhGiaHan().ok, false));

console.log('\nGiá thuê');
test('bỏ trống giá mới thì giữ giá cũ', () => {
  [undefined, null, ''].forEach((g) => { const k = tinh({ giaMoi: g }); assert.deepStrictEqual([k.giaCu, k.giaMoi, k.doiGia], [3000000, 3000000, false]); });
});
test('giá mới khác giá cũ: đánh dấu đổi giá', () => { const k = tinh({ giaMoi: 3300000 }); assert.deepStrictEqual([k.giaCu, k.giaMoi, k.doiGia], [3000000, 3300000, true]); });
test('giá mới bằng giá cũ: không coi là đổi giá', () => assert.strictEqual(tinh({ giaMoi: 3000000 }).doiGia, false));
test('giá mới là chuỗi số vẫn được', () => assert.strictEqual(tinh({ giaMoi: '3300000' }).giaMoi, 3300000));
test('giá mới 0 là hợp lệ (miễn tiền thuê tạm thời), âm / chữ / số lẻ thì từ chối', () => {
  assert.ok(tinh({ giaMoi: 0 }).ok);
  [-1, 'abc', 1.5, NaN].forEach((g) => assert.strictEqual(tinh({ giaMoi: g }).ok, false, 'nhận nhầm: ' + g));
});
test('giá hiện tại thiếu coi là 0', () => assert.strictEqual(tinh({ giaHienTai: undefined }).giaCu, 0));

console.log('\nLịch sử');
const kq = tinh({ giaMoi: 3300000 });
test('dòng lịch sử mang đủ thông tin cần để dựng lại phụ lục', () => {
  const b = R.banGhi(kq, { id: 'gh1', at: '2026-10-28T03:00:00.000Z', by: 'Hoa' });
  assert.deepStrictEqual(b, { id: 'gh1', at: '2026-10-28T03:00:00.000Z', tuNgay: '2026-11-30', denNgay: '2027-11-30', soThang: 12, giaCu: 3000000, giaMoi: 3300000, by: 'Hoa' });
});
test('không ghi ai làm thì để rỗng', () => assert.strictEqual(R.banGhi(kq, { id: 'g', at: 'x' }).by, ''));
const dong = (id, at, den) => ({ id, at, tuNgay: '2026-01-01', denNgay: den || '2027-01-01', soThang: 12, giaCu: 1, giaMoi: 1 });
test('xếp cũ trước mới sau, không phụ thuộc thứ tự lưu', () => {
  const l = R.lichSu({ renewalHistory: [dong('b', '2027-01-01T00:00:00Z'), dong('a', '2026-01-01T00:00:00Z')] });
  assert.deepStrictEqual(l.muc.map((m) => m.id), ['a', 'b']);
});
test('bỏ dòng hỏng (thiếu hạn mới, null)', () => {
  const l = R.lichSu({ renewalHistory: [dong('a', '2026-01-01T00:00:00Z'), null, { id: 'x' }, 5] }); assert.deepStrictEqual(l.muc.map((m) => m.id), ['a']);
});
test('hợp đồng gia hạn trước khi có lịch sử: báo số lần còn thiếu chi tiết', () => {
  assert.strictEqual(R.lichSu({ renewCount: 3, renewalHistory: [dong('a', '2026-01-01T00:00:00Z')] }).thieuChiTiet, 2);
  assert.strictEqual(R.lichSu({ renewCount: 2 }).thieuChiTiet, 2);
});
test('lịch sử nhiều hơn số lần đếm thì không bao giờ âm', () => assert.strictEqual(R.lichSu({ renewCount: 0, renewalHistory: [dong('a', 'x')] }).thieuChiTiet, 0));
test('hợp đồng chưa từng gia hạn, hoặc dữ liệu rỗng / hỏng', () => {
  [{}, null, undefined, { renewalHistory: 'x' }, { renewalHistory: null }].forEach((h) => { const l = R.lichSu(h); assert.deepStrictEqual([l.muc.length, l.thieuChiTiet], [0, 0]); });
});
test('số thứ tự phụ lục theo thời gian', () => {
  const h = { renewalHistory: [dong('b', '2027-01-01T00:00:00Z'), dong('a', '2026-01-01T00:00:00Z')] };
  assert.deepStrictEqual([R.soThuTu(h, 'a'), R.soThuTu(h, 'b'), R.soThuTu(h, 'zz')], [1, 2, 0]);
});

console.log('\nNội dung phụ lục');
const fmt = { tien: (n) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫', ngay: (s) => s.split('-').reverse().join('/') };
const hd = { id: 'HD-101', start: '2025-12-01', rent: 3300000, deposit: 6000000, roomCode: '101' };
const ban = (o) => Object.assign({ id: 'gh1', at: '2026-10-28T03:00:00.000Z', tuNgay: '2026-11-30', denNgay: '2027-11-30', soThang: 12, giaCu: 3000000, giaMoi: 3300000 }, o || {});
const pl = (o) => R.phuLuc(Object.assign({ hopDong: hd, ban: ban(), stt: 1, benA: { ten: 'Nguyễn Văn A' }, benB: { ten: 'Trần Thị B' }, fmt }, o || {}));
test('tiêu đề, số phụ lục và ngày ký', () => {
  const p = pl(); assert.deepStrictEqual([p.tieuDe, p.so, p.ngayKy], ['PHỤ LỤC HỢP ĐỒNG THUÊ PHÒNG TRỌ', 'PL01/HD-101', '2026-10-28']);
});
test('số phụ lục có đệm số 0 và tăng theo thứ tự', () => { assert.strictEqual(pl({ stt: 2 }).so, 'PL02/HD-101'); assert.strictEqual(pl({ stt: 12 }).so, 'PL12/HD-101'); });
test('căn cứ nêu số, ngày ký hợp đồng gốc và hai bên', () => {
  const c = pl().canCu; ['HD-101', '01/12/2025', 'Nguyễn Văn A', 'Trần Thị B'].forEach((x) => assert.ok(c.indexOf(x) >= 0, 'thiếu: ' + x));
});
test('hợp đồng gốc không có ngày ký thì bỏ phần "ký ngày"', () => assert.ok(pl({ hopDong: Object.assign({}, hd, { start: null }) }).canCu.indexOf('ký ngày') < 0));
test('thiếu tên hai bên thì dùng Bên A / Bên B', () => assert.ok(pl({ benA: {}, benB: undefined }).canCu.indexOf('giữa Bên A và Bên B') >= 0));
test('Điều 1 nêu số tháng, phòng, từ ngày, đến ngày', () => {
  const d = pl().dieu[0]; assert.strictEqual(d.tieu, 'Gia hạn thời hạn thuê');
  ['12 tháng', 'phòng 101', '30/11/2026', '30/11/2027'].forEach((x) => assert.ok(d.noi.indexOf(x) >= 0, 'thiếu: ' + x));
});
test('đổi giá: Điều 2 nêu giá cũ, giá mới, ngày áp dụng', () => {
  const n = pl().dieu[1].noi; ['điều chỉnh', fmt.tien(3000000), fmt.tien(3300000), '30/11/2026'].forEach((x) => assert.ok(n.indexOf(x) >= 0, 'thiếu: ' + x));
});
test('giữ giá: Điều 2 nói giữ nguyên và không nhắc giá cũ', () => {
  const n = pl({ ban: ban({ giaCu: 3300000, giaMoi: 3300000 }) }).dieu[1].noi; assert.ok(n.indexOf('giữ nguyên') >= 0); assert.ok(n.indexOf('điều chỉnh') < 0);
});
test('Điều 3 nêu tiền cọc; hợp đồng không có cọc thì nói rõ', () => {
  assert.ok(pl().dieu[2].noi.indexOf(fmt.tien(6000000)) >= 0);
  assert.ok(pl({ hopDong: Object.assign({}, hd, { deposit: 0 }) }).dieu[2].noi.indexOf('không có tiền đặt cọc') >= 0);
});
test('Điều 4 giữ hiệu lực các điều khoản khác của hợp đồng gốc', () => assert.ok(pl().dieu[3].noi.indexOf('Hợp đồng số HD-101') >= 0));
test('đủ năm điều, điều cuối là hiệu lực và số bản', () => {
  const p = pl(); assert.strictEqual(p.dieu.length, 5); assert.ok(p.dieu[4].noi.indexOf('02 bản') >= 0);
});
test('dùng đúng hàm định dạng được truyền vào', () => {
  const p = R.phuLuc({ hopDong: hd, ban: ban(), stt: 1, fmt: { tien: (n) => 'T' + n, ngay: (s) => 'N' + s } });
  assert.ok(p.dieu[0].noi.indexOf('N2026-11-30') >= 0); assert.ok(p.dieu[1].noi.indexOf('T3300000') >= 0);
});
test('thiếu thời điểm lập thì lấy ngày bắt đầu gia hạn làm ngày ký', () => assert.strictEqual(pl({ ban: ban({ at: null }) }).ngayKy, '2026-11-30'));
test('ghi lại và dựng phụ lục ra đúng điều khoản (vòng đi vòng lại)', () => {
  const k = R.tinhGiaHan({ hetHan: '2026-11-30', homNay: NAY, soThang: 6, giaHienTai: 3000000, giaMoi: 3500000 });
  const b = R.banGhi(k, { id: 'g9', at: '2026-10-28T03:00:00.000Z' });
  const p = R.phuLuc({ hopDong: hd, ban: b, stt: 1, fmt });
  assert.ok(p.dieu[0].noi.indexOf('6 tháng') >= 0 && p.dieu[0].noi.indexOf('30/05/2027') >= 0); assert.ok(p.dieu[1].noi.indexOf(fmt.tien(3500000)) >= 0);
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

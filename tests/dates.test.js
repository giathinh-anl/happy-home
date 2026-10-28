/* Kiểm thử ngày theo lịch (js/dates.js).
   Chạy:  node tests/dates.test.js           (mặc định giờ Việt Nam, nơi lỗi lệch ngày xảy ra)
          TZ=America/New_York node tests/dates.test.js   (thử múi giờ âm) */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const D = require('../js/dates.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

console.log('Chuỗi ngày (cái được ghi vào cột date)');
test('nửa đêm địa phương 1/10 ra đúng "2026-10-01", không lùi về 30/9', () => assert.strictEqual(D.chuoiNgay(new Date(2026, 9, 1)), '2026-10-01'));
test('cuối tháng: nửa đêm địa phương 31/10', () => assert.strictEqual(D.chuoiNgay(new Date(2026, 9, 31)), '2026-10-31'));
test('chuỗi ISO của nửa đêm địa phương (đúng thứ app đang lưu) vẫn ra ngày địa phương', () => assert.strictEqual(D.chuoiNgay(new Date(2026, 9, 5).toISOString()), '2026-10-05'));
test('chuỗi đã là ngày thì giữ nguyên', () => assert.strictEqual(D.chuoiNgay('2026-02-28'), '2026-02-28'));
test('23:59 địa phương vẫn là ngày đó', () => assert.strictEqual(D.chuoiNgay(new Date(2026, 9, 5, 23, 59, 59)), '2026-10-05'));
test('00:01 địa phương vẫn là ngày đó (không lấy ngày UTC)', () => assert.strictEqual(D.chuoiNgay(new Date(2026, 9, 5, 0, 1)), '2026-10-05'));
test('qua năm mới', () => assert.strictEqual(D.chuoiNgay(new Date(2027, 0, 1)), '2027-01-01'));
test('rỗng, null, rác -> null', () => { assert.strictEqual(D.chuoiNgay(null), null); assert.strictEqual(D.chuoiNgay(''), null); assert.strictEqual(D.chuoiNgay('abc'), null); });

console.log('Đọc ngày từ DB');
test('"2026-10-05" đọc ra đúng ngày 5/10 địa phương', () => { const d = D.phanTich('2026-10-05'); assert.deepStrictEqual([d.getFullYear(), d.getMonth(), d.getDate()], [2026, 9, 5]); });
test('đọc ra là nửa đêm địa phương (không phải nửa đêm UTC)', () => { const d = D.phanTich('2026-10-05'); assert.deepStrictEqual([d.getHours(), d.getMinutes()], [0, 0]); });
test('đọc ra rồi ghi lại không đổi (vòng đi vòng lại)', () => assert.strictEqual(D.chuoiNgay(D.phanTich('2026-03-01')), '2026-03-01'));
test('năm nhuận 29/2', () => assert.strictEqual(D.chuoiNgay(D.phanTich('2028-02-29')), '2028-02-29'));
test('ngày không tồn tại không bị coi là hợp lệ giả', () => assert.notStrictEqual(D.chuoiNgay(D.phanTich('2026-02-30')), '2026-02-30'));

console.log('Số ngày chênh');
test('hạn 5/10, hôm nay 5/10 lúc 20:00: chưa quá hạn (chênh 0, không phải -1)', () => assert.strictEqual(D.chenhNgay(new Date(2026, 9, 5, 20, 0), '2026-10-05'), 0));
test('hạn 5/10, hôm nay 6/10 lúc 00:05: quá hạn 1 ngày', () => assert.strictEqual(D.chenhNgay(new Date(2026, 9, 6, 0, 5), '2026-10-05'), -1));
test('hạn 5/10, hôm nay 2/10 lúc 23:59: còn 3 ngày', () => assert.strictEqual(D.chenhNgay(new Date(2026, 9, 2, 23, 59), '2026-10-05'), 3));
test('hai kiểu lưu cùng một hạn ra cùng kết quả', () => assert.strictEqual(D.chenhNgay(new Date(2026, 9, 1, 12), '2026-10-05'), D.chenhNgay(new Date(2026, 9, 1, 12), new Date(2026, 9, 5).toISOString())));
test('qua tháng 2 năm không nhuận', () => assert.strictEqual(D.chenhNgay('2027-02-27', '2027-03-02'), 3));
test('đầu vào hỏng -> NaN', () => { assert.ok(isNaN(D.chenhNgay('abc', '2026-10-05'))); assert.ok(isNaN(D.chenhNgay(null, '2026-10-05'))); });
test('soNgayLich liên tiếp hơn kém đúng 1', () => assert.strictEqual(D.soNgayLich('2026-10-06') - D.soNgayLich('2026-10-05'), 1));

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

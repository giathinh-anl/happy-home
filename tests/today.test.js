/* Kiểm thử "Hôm nay cần làm gì" (js/today.js).
   Chạy:  node tests/today.test.js */
const assert = require('assert');
const T = require('../js/today.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};
const HN = new Date(2026, 9, 27, 21, 30);                       // 27/10/2026, buổi tối
const v = (id, muc, n, tien) => ({ id, muc, n, tien, tieuDe: id });

console.log('Xếp thứ tự');
test('gấp lên trước, rồi nên làm hôm nay, rồi sắp tới', () => assert.deepStrictEqual(T.sapXep([v('c', 3, 1), v('a', 1, 1), v('b', 2, 1)]).map(x => x.id), ['a', 'b', 'c']));
test('cùng mức: nhiều tiền hơn lên trước', () => assert.deepStrictEqual(T.sapXep([v('a', 1, 5, 1000), v('b', 1, 1, 9000)]).map(x => x.id), ['b', 'a']));
test('cùng mức, cùng tiền: nhiều việc hơn lên trước', () => assert.deepStrictEqual(T.sapXep([v('a', 2, 2), v('b', 2, 7)]).map(x => x.id), ['b', 'a']));
test('hoàn toàn bằng nhau thì xếp theo mã, kết quả ổn định', () => assert.deepStrictEqual(T.sapXep([v('b', 2, 1), v('a', 2, 1)]).map(x => x.id), ['a', 'b']));
test('không sửa mảng gốc', () => { const g = [v('b', 3, 1), v('a', 1, 1)]; T.sapXep(g); assert.strictEqual(g[0].id, 'b'); });
test('mảng rỗng hoặc null không lỗi', () => { assert.deepStrictEqual(T.sapXep([]), []); assert.deepStrictEqual(T.sapXep(null), []); });

console.log('Ngày');
test('khóa ngày theo giờ địa phương, không lệch ở buổi tối', () => assert.strictEqual(T.ngayKey(HN), '2026-10-27'));
test('hết hoãn mặc định là ngày mai', () => assert.strictEqual(T.hoanDen(HN), '2026-10-28'));
test('hoãn 3 ngày qua cuối tháng', () => assert.strictEqual(T.hoanDen(HN, 5), '2026-11-01'));
test('qua cuối năm', () => assert.strictEqual(T.hoanDen(new Date(2026, 11, 31, 23, 0)), '2027-01-01'));

console.log('Hoãn việc');
const it = v('nhacno:b1', 2, 4, 5000000);
test('hoãn rồi thì bị ẩn trong hôm nay', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([it], h, HN).hien.length, 0); assert.strictEqual(T.boLoc([it], h, HN).daHoan.length, 1); });
test('sang ngày mai thì hiện lại', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([it], h, new Date(2026, 9, 28, 7, 0)).hien.length, 1); });
test('việc trở nên gấp hơn lúc hoãn thì hiện lại ngay', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([Object.assign({}, it, { muc: 1 })], h, HN).hien.length, 1); });
test('việc nhẹ đi hoặc giữ nguyên thì vẫn ẩn', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([Object.assign({}, it, { muc: 3 })], h, HN).hien.length, 0); });
test('thêm việc (nhiều phòng nợ hơn lúc hoãn) thì hiện lại', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([Object.assign({}, it, { n: 5 })], h, HN).hien.length, 1); });
test('ít việc hơn lúc hoãn thì vẫn ẩn', () => { const h = T.themHoan({}, it, HN); assert.strictEqual(T.boLoc([Object.assign({}, it, { n: 2 })], h, HN).hien.length, 0); });
test('hoãn việc này không ảnh hưởng việc khác', () => { const h = T.themHoan({}, it, HN); const r = T.boLoc([it, v('khac', 2, 1)], h, HN); assert.deepStrictEqual(r.hien.map(x => x.id), ['khac']); });
test('bỏ hoãn thì hiện lại', () => { const h = T.boHoan(T.themHoan({}, it, HN), it.id); assert.strictEqual(T.boLoc([it], h, HN).hien.length, 1); });
test('themHoan không sửa bản cũ', () => { const h0 = {}; T.themHoan(h0, it, HN); assert.deepStrictEqual(h0, {}); });
test('dọn mục hết hạn', () => {
  const h = { a: { den: '2026-10-26', muc: 2, n: 1 }, b: { den: '2026-10-27', muc: 2, n: 1 }, c: { den: '2026-10-28', muc: 2, n: 1 } };
  assert.deepStrictEqual(Object.keys(T.donHoan(h, HN)), ['c']);
});
test('dữ liệu hoãn rỗng hoặc hỏng không làm sập', () => { assert.strictEqual(T.boLoc([it], null, HN).hien.length, 1); assert.strictEqual(T.boLoc([it], { [it.id]: null }, HN).hien.length, 1); assert.deepStrictEqual(T.donHoan(null, HN), {}); });

console.log('Tóm tắt');
test('đếm theo mức', () => assert.deepStrictEqual(T.tomTat([v('a', 1, 1), v('b', 1, 1), v('c', 2, 1), v('d', 3, 1)]), { tong: 4, gap: 2, homNay: 1, sapToi: 1 }));
test('không có việc nào', () => assert.deepStrictEqual(T.tomTat([]), { tong: 0, gap: 0, homNay: 0, sapToi: 0 }));

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

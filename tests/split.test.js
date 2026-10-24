/* Kiểm thử chia hóa đơn cho người ở (js/split.js).
   Chạy:  node tests/split.test.js */
const assert = require('assert');
const S = require('../js/split.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};
const tong = (a) => a.reduce((s, x) => s + x, 0);

console.log('Chia một số tiền');
test('chia đều hết thì đều nhau', () => assert.deepStrictEqual(S.chiaSo(3000000, [1, 1, 1]), [1000000, 1000000, 1000000]));
test('có dư thì cộng lại vẫn đúng tổng (100 đồng chia 3)', () => {
  const r = S.chiaSo(100, [1, 1, 1]); assert.strictEqual(tong(r), 100); assert.deepStrictEqual(r.slice().sort(), [33, 33, 34]);
});
test('mọi số dư nhỏ đều bảo toàn tổng', () => {
  for (let t = 0; t < 200; t++) for (const w of [[1, 1], [1, 1, 1], [1, 2], [3, 5, 7], [1, 1, 1, 1]]) assert.strictEqual(tong(S.chiaSo(t, w)), t, `${t} / ${w}`);
});
test('tổng lớn (số tiền thật) bảo toàn', () => assert.strictEqual(tong(S.chiaSo(4563900, [1, 1, 1])), 4563900));
test('theo tỉ lệ 1:3', () => assert.deepStrictEqual(S.chiaSo(4000000, [1, 3]), [1000000, 3000000]));
test('phần dư xoay vòng theo tham số xoay', () => {
  assert.deepStrictEqual(S.chiaSo(100, [1, 1, 1], 0), [34, 33, 33]);
  assert.deepStrictEqual(S.chiaSo(100, [1, 1, 1], 1), [33, 34, 33]);
  assert.deepStrictEqual(S.chiaSo(100, [1, 1, 1], 5), [33, 33, 34]);
});
test('trọng số lớn hơn nhận phần dư khi phần lẻ lớn hơn', () => assert.deepStrictEqual(S.chiaSo(10, [1, 2]), [3, 7]));
test('một người nhận hết, tổng 0 thì ai cũng 0', () => { assert.deepStrictEqual(S.chiaSo(777, [1]), [777]); assert.deepStrictEqual(S.chiaSo(0, [1, 1]), [0, 0]); });
test('toàn trọng số 0 coi như chia đều, không chia cho 0', () => assert.deepStrictEqual(S.chiaSo(10, [0, 0]), [5, 5]));
test('trọng số âm bị coi là 0', () => assert.deepStrictEqual(S.chiaSo(10, [-5, 1]), [0, 10]));
test('số âm (giảm trừ) vẫn đúng tổng', () => assert.strictEqual(tong(S.chiaSo(-100, [1, 1, 1])), -100));

console.log('Chia hóa đơn');
const LINES = [{ label: 'Tiền phòng', amount: 3500000 }, { label: 'Tiền điện', amount: 504000, type: 'elec' },
  { label: 'Tiền nước', amount: 150000 }, { label: 'Phí rác', amount: 30000 }, { label: 'Phí internet', amount: 40000 }];
const GOC = tong(LINES.map(l => l.amount));
const AI = [{ id: 'a', ten: 'An' }, { id: 'b', ten: 'Bình' }, { id: 'c', ten: 'Chi' }];
test('tổng các phần bằng đúng tổng hóa đơn', () => {
  const r = S.chia(LINES, AI); assert.strictEqual(r.tong, GOC); assert.strictEqual(tong(r.nguoi.map(p => p.tong)), GOC);
});
test('mỗi người có đủ các dòng, tổng dòng bằng phần của họ', () => {
  S.chia(LINES, AI).nguoi.forEach(p => { assert.strictEqual(p.dong.length, LINES.length); assert.strictEqual(tong(p.dong.map(d => d.amount)), p.tong); });
});
test('từng dòng cộng qua mọi người đúng bằng dòng gốc', () => {
  const r = S.chia(LINES, AI);
  LINES.forEach((l, k) => assert.strictEqual(tong(r.nguoi.map(p => p.dong[k].amount)), l.amount, l.label));
});
test('phần dư không dồn mãi cho một người (xoay theo dòng)', () => {
  const r = S.chia([{ label: 'a', amount: 100 }, { label: 'b', amount: 100 }, { label: 'c', amount: 100 }], AI);
  assert.deepStrictEqual(r.nguoi.map(p => p.tong), [100, 100, 100]);
});
test('giữ nguyên loại dòng (điện)', () => assert.strictEqual(S.chia(LINES, AI).nguoi[0].dong[1].type, 'elec'));
test('cờ chia đều', () => {
  assert.strictEqual(S.chia(LINES, AI).deu, true);
  assert.strictEqual(S.chia(LINES, [{ id: 'a', ten: 'An', trongSo: 2 }, { id: 'b', ten: 'Bình' }]).deu, false);
});
test('người trọng số 0 bị loại khỏi phần chia', () => assert.strictEqual(S.chia(LINES, [{ id: 'a', ten: 'An' }, { id: 'b', ten: 'B', trongSo: 0 }]).nguoi.length, 1));
test('không có ai thì trả null', () => { assert.strictEqual(S.chia(LINES, []), null); assert.strictEqual(S.chia(LINES, null), null); });
test('hóa đơn có phí trễ hạn: phí cũng chia và tổng vẫn đúng', () => {
  const r = S.chia(LINES.concat([{ label: 'Phí trễ hạn', amount: 414900, type: 'latefee' }]), AI);
  assert.strictEqual(r.tong, GOC + 414900);
});

console.log('Phần đã đóng và tin nhắn');
test('đã đóng chia theo tỉ lệ phần của từng người, cộng lại đúng số đã đóng', () => {
  const r = S.theoDaTra(S.chia(LINES, AI), 2000001);
  assert.strictEqual(tong(r.nguoi.map(p => p.daTra)), 2000001);
  r.nguoi.forEach(p => assert.strictEqual(p.conNo, p.tong - p.daTra));
});
test('đóng đủ thì ai cũng hết nợ, chưa đóng thì nợ nguyên phần', () => {
  S.theoDaTra(S.chia(LINES, AI), GOC).nguoi.forEach(p => assert.strictEqual(p.conNo, 0));
  S.theoDaTra(S.chia(LINES, AI), 0).nguoi.forEach(p => assert.strictEqual(p.conNo, p.tong));
});
test('số đã đóng vượt tổng bị chặn ở tổng, không ai nợ âm', () => S.theoDaTra(S.chia(LINES, AI), 99999999).nguoi.forEach(p => assert.strictEqual(p.conNo, 0)));
const TIN = (p, c) => S.soanTin(p, Object.assign({ phong: 'P101', ky: '2026-10', noiDungCK: 'HD2610001', taiKhoan: { ten: 'MB Bank', so: '0123', chu: 'CHU TRO' } }, c));
test('tin có tên, phòng, kỳ, phần của người đó, tài khoản và nội dung chuyển khoản', () => {
  const p = S.chia(LINES, AI).nguoi[0]; const t = TIN(p);
  assert.ok(t.includes('An') && t.includes('P101') && t.includes('T10/2026'));
  assert.ok(t.includes('0123') && t.includes('HD2610001'));
  assert.ok(t.includes(new Intl.NumberFormat('vi-VN').format(p.tong)));
});
test('thiếu số tài khoản thì không có dòng STK, không in "undefined"', () => {
  const t = TIN(S.chia(LINES, AI).nguoi[0], { taiKhoan: null }); assert.ok(!/STK|undefined|null/.test(t));
});
test('tin chỉ liệt kê dòng có tiền, bỏ dòng 0 ₫', () => {
  const t = TIN(S.chia([{ label: 'Tiền phòng', amount: 3000000 }, { label: 'Phí rác', amount: 0 }], AI).nguoi[0]);
  assert.ok(t.includes('Tiền phòng') && !t.includes('Phí rác'));
});
test('đã đóng một phần thì tin nói "còn lại"', () => assert.ok(/còn lại/.test(TIN(S.theoDaTra(S.chia(LINES, AI), 1000000).nguoi[0]))));

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

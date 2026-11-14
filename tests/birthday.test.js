/* Kiểm thử sinh nhật của khách thuê (js/birthday.js).
   Chạy:  node tests/birthday.test.js */
const assert = require('assert');
const B = require('../js/birthday.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
/** Thời điểm h giờ ngày d/m/y theo GIỜ VIỆT NAM, dạng mili-giây */
const vn = (y, m, d, h) => Date.UTC(y, m - 1, d, (h == null ? 12 : h) - 7, 0, 0);

/* ============================================================
   Đọc ngày sinh
   ============================================================ */
test('đọc dd/mm/yyyy, d/m/yyyy, có khoảng trắng, dùng - hoặc . thay /', () => {
  const x = { d: 5, m: 3, y: 1998 };
  for (const s of ['05/03/1998', '5/3/1998', ' 05/03/1998 ', '05-03-1998', '05.03.1998']) assert.deepStrictEqual(B.phanTich(s), x, s);
});
test('đọc yyyy-mm-dd của dữ liệu cũ, kể cả có giờ phía sau', () => {
  const x = { d: 12, m: 5, y: 1998 };
  for (const s of ['1998-05-12', '1998-05-12T00:00:00.000Z', '1998-05-12 00:00:00']) assert.deepStrictEqual(B.phanTich(s), x, s);
});
test('ngày không có thật hoặc hỏng thì null, không ném lỗi', () => {
  for (const s of ['31/02/1998', '29/02/2001', '29/02/1900', '00/01/1990', '15/13/1990', '15/00/1990', '1990', 'abc', '', '   ', '1998-13-01', '1998-02-30',
    '01/01/1800', '01/01/2999', '12/05/98', '5/3', '12345', '1/1/19999', '05/03/1998 abc']) assert.strictEqual(B.phanTich(s), null, JSON.stringify(s));
  for (const v of [null, undefined, NaN, {}, [], 0, 19980512]) assert.strictEqual(B.phanTich(v), null, String(v));
});
test('năm nhuận: 29/02/2000 và 29/02/2024 có thật, 29/02/1900 và 29/02/2100 thì không', () => {
  assert.deepStrictEqual(B.phanTich('29/02/2000'), { d: 29, m: 2, y: 2000 }); assert.ok(B.phanTich('29/02/2024'));
  assert.strictEqual(B.phanTich('29/02/1900'), null); assert.strictEqual(B.phanTich('29/02/2100'), null);
  assert.deepStrictEqual([1900, 2000, 2023, 2024, 2026, 2028, 2100].map(B.laNamNhuan), [false, true, false, true, false, true, false]);
});
test('tên để gọi là chữ cuối của họ tên', () => {
  assert.strictEqual(B.tenGoi('Nguyễn Văn An'), 'An'); assert.strictEqual(B.tenGoi('  Lê  Thị   Hoa '), 'Hoa'); assert.strictEqual(B.tenGoi('An'), 'An');
  assert.strictEqual(B.tenGoi(''), ''); assert.strictEqual(B.tenGoi(null), ''); assert.strictEqual(B.tenGoi(undefined), '');
});

/* ============================================================
   Ngày theo giờ Việt Nam và đếm ngược
   ============================================================ */
test('hôm nay theo giờ Việt Nam, đổi ngày đúng nửa đêm giờ Việt Nam', () => {
  assert.deepStrictEqual(B.homNay(Date.UTC(2026, 1, 16, 16, 59, 59)), { d: 16, m: 2, y: 2026 });
  assert.deepStrictEqual(B.homNay(Date.UTC(2026, 1, 16, 17, 0, 0)), { d: 17, m: 2, y: 2026 });
  assert.deepStrictEqual(B.homNay(new Date(Date.UTC(2026, 11, 31, 17, 0, 0))), { d: 1, m: 1, y: 2027 });
  assert.strictEqual(B.khoaNgay(vn(2026, 2, 17)), '2026-02-17'); assert.strictEqual(B.khoaNgay(vn(2026, 12, 5, 23)), '2026-12-05');
  assert.ok(B.homNay().y >= 2026, 'không đối số thì dùng bây giờ');
});
test('đếm ngày tới sinh nhật: hôm nay 0, hôm qua gần một năm', () => {
  assert.strictEqual(B.soNgayDen('12/11/1998', vn(2026, 11, 12)), 0);
  assert.strictEqual(B.soNgayDen('12/11/1998', vn(2026, 11, 11)), 1);
  assert.strictEqual(B.soNgayDen('12/11/1998', vn(2026, 11, 13)), 364);
  assert.strictEqual(B.soNgayDen('12/11/1998', vn(2027, 11, 13)), 365, 'từ 13/11/2027 tới 12/11/2028 qua 29/2/2028 nên dài 365 ngày');
});
test('qua năm mới: 28/12 tới 5/1 là 8 ngày', () => {
  assert.strictEqual(B.soNgayDen('05/01/1990', vn(2026, 12, 28)), 8);
  assert.strictEqual(B.soNgayDen('1990-01-05', vn(2026, 12, 28)), 8);
});
test('ranh giới nửa đêm giờ Việt Nam, không theo UTC', () => {
  assert.strictEqual(B.soNgayDen('01/01/1990', Date.UTC(2026, 11, 31, 16, 59, 59)), 1);    // 23:59:59 ngày 31/12 giờ VN
  assert.strictEqual(B.soNgayDen('01/01/1990', Date.UTC(2026, 11, 31, 17, 0, 0)), 0);      // 00:00:00 ngày 1/1 giờ VN
  assert.strictEqual(B.laHomNay('17/02/2000', Date.UTC(2026, 1, 16, 17, 0, 0)), true);
  assert.strictEqual(B.laHomNay('17/02/2000', Date.UTC(2026, 1, 16, 16, 59, 59)), false);
});
test('sinh ngày 29/2: năm không nhuận mừng 28/2, năm nhuận mừng 29/2', () => {
  const d = '29/02/2000';
  assert.strictEqual(B.soNgayDen(d, vn(2027, 2, 27)), 1); assert.strictEqual(B.soNgayDen(d, vn(2027, 2, 28)), 0);
  assert.strictEqual(B.soNgayDen(d, vn(2027, 3, 1)), 365, 'tới 29/2/2028');
  assert.strictEqual(B.soNgayDen(d, vn(2028, 2, 28)), 1); assert.strictEqual(B.soNgayDen(d, vn(2028, 2, 29)), 0);
  assert.strictEqual(B.soNgayDen(d, vn(2028, 3, 1)), 364, 'tới 28/2/2029');
  assert.deepStrictEqual(B.ngayMung({ d: 29, m: 2, y: 2000 }, 2027), { d: 28, m: 2, y: 2027 });
  assert.deepStrictEqual(B.ngayMung({ d: 29, m: 2, y: 2000 }, 2028), { d: 29, m: 2, y: 2028 });
  assert.deepStrictEqual(B.ngayMung({ d: 28, m: 2, y: 2001 }, 2027), { d: 28, m: 2, y: 2027 });
  assert.deepStrictEqual(B.tiepTheo(d, vn(2027, 2, 20)), { soNgay: 8, mung: { d: 28, m: 2, y: 2027 } });
});
test('ngày sinh hỏng thì null và không phải sinh nhật; nhận cả Date; luôn ra số nguyên từ 0 tới 365', () => {
  assert.strictEqual(B.soNgayDen('hỏng', vn(2026, 1, 1)), null); assert.strictEqual(B.soNgayDen(null, vn(2026, 1, 1)), null);
  assert.strictEqual(B.tiepTheo('hỏng', vn(2026, 1, 1)), null); assert.strictEqual(B.laHomNay('hỏng'), false); assert.strictEqual(B.laHomNay(null), false);
  assert.strictEqual(B.soNgayDen('12/11/1998', new Date(vn(2026, 11, 12))), 0);
  for (let i = 0; i < 800; i++) {
    const t = vn(2026, 1, 1) + i * 86400000;
    for (const s of ['01/01/1990', '29/02/2000', '31/12/1985', '28/02/1999']) { const n = B.soNgayDen(s, t); assert.ok(Number.isInteger(n) && n >= 0 && n <= 365, s + ' ' + i + ' ' + n); }
  }
});
test('mỗi ngày của một năm đều có đúng một ngày sinh trùng hôm đó (365 ngày năm 2027)', () => {
  for (let i = 0; i < 365; i++) {
    const t = vn(2027, 1, 1) + i * 86400000, hn = B.homNay(t), s = String(hn.d).padStart(2, '0') + '/' + String(hn.m).padStart(2, '0') + '/1990';
    assert.strictEqual(B.laHomNay(s, t), true, s);
    const mai = B.homNay(t + 86400000), sMai = String(mai.d).padStart(2, '0') + '/' + String(mai.m).padStart(2, '0') + '/1990';
    assert.strictEqual(B.soNgayDen(sMai, t), 1, 'ngày mai ' + sMai);
  }
});

/* ============================================================
   Lời chúc
   ============================================================ */
test('lời chúc trong app khách: có tên, không biểu tượng cảm xúc, không bao giờ nói số tuổi', () => {
  const x = B.loiChucApp('Mẫu');
  assert.strictEqual(x.tieuDe, 'Hôm nay là sinh nhật của bạn'); assert.ok(x.noiDung.includes('Mẫu') && x.noiDung.includes('sức khỏe') && x.noiDung.includes('Happy Home'));
  assert.ok(B.loiChucApp('').noiDung.includes('chúc bạn') && B.loiChucApp(null).noiDung.includes('chúc bạn') && B.loiChucApp('   ').noiDung.includes('chúc bạn'));
  assert.ok(!/tuổi \d|\d+ tuổi/.test(x.noiDung));
  assert.ok(!/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(x.noiDung) && x.noiDung.length < 200);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

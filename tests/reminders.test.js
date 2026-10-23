/* Kiểm thử nhắc nợ nhiều cấp + phí trễ hạn (js/reminders.js).
   Chạy:  node tests/reminders.test.js */
const assert = require('assert');
const R = require('../js/reminders.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const ngay = (y, m, d) => new Date(y, m - 1, d);
const HOM_NAY = ngay(2026, 10, 20);
// hóa đơn có hạn cách hôm nay `tre` ngày (tre > 0: đã quá hạn; tre < 0: chưa tới hạn)
const hd = (tre, o) => Object.assign({
  id: 'x' + tre, buildingId: 'b1', roomCode: 'P101', tenantName: 'Nguyễn Văn A', period: '2026-10',
  dueDate: ngay(2026, 10, 20 - tre).toISOString(), total: 1000000, paid: 0, status: 'issued',
  lines: [{ type: 'rent', amount: 1000000 }],
}, o || {});
const CS = { moiNgay: 20000, mienNgay: 3 };      // 3 ngày miễn phí, sau đó 20.000 ₫/ngày (trần 10% = 100.000 với hóa đơn 1 triệu)

console.log('Phân mức theo số ngày');
test('còn 3 ngày tới hạn là "sắp hạn"', () => assert.strictEqual(R.mucCua(-3).ma, 'sap-han'));
test('còn 4 ngày thì chưa cần nhắc', () => assert.strictEqual(R.mucCua(-4), null));
test('đúng ngày hạn vẫn là "sắp hạn", chưa quá hạn', () => assert.strictEqual(R.mucCua(0).ma, 'sap-han'));
test('quá 1 và 3 ngày là nhắc nhẹ', () => { assert.strictEqual(R.mucCua(1).ma, 'nhac-nhe'); assert.strictEqual(R.mucCua(3).ma, 'nhac-nhe'); });
test('quá 4 và 7 ngày là mức có phí', () => { assert.strictEqual(R.mucCua(4).ma, 'nhac-phi'); assert.strictEqual(R.mucCua(7).ma, 'nhac-phi'); });
test('quá 8 ngày trở lên là khẩn, kể cả rất lâu', () => { assert.strictEqual(R.mucCua(8).ma, 'khan'); assert.strictEqual(R.mucCua(400).ma, 'khan'); });
test('thiếu ngày hạn thì không có mức', () => assert.strictEqual(R.mucCua(null), null));
test('ngày trễ đếm theo ngày lịch, không theo giờ', () => {
  const inv = hd(0, { dueDate: new Date(2026, 9, 19, 0, 0).toISOString() });
  assert.strictEqual(R.ngayTre(inv, new Date(2026, 9, 20, 23, 59)), 1);
});

console.log('Phí trễ hạn');
test('mặc định tắt: không phí dù trễ lâu', () => assert.strictEqual(R.tinhPhi(hd(30), { moiNgay: 0 }, HOM_NAY).phi, 0));
test('không truyền chính sách cũng không phí', () => assert.strictEqual(R.tinhPhi(hd(30), undefined, HOM_NAY).phi, 0));
test('trong 3 ngày miễn phí thì chưa tính', () => assert.strictEqual(R.tinhPhi(hd(3), CS, HOM_NAY).phi, 0));
test('trễ 4 ngày: tính 1 ngày', () => { const r = R.tinhPhi(hd(4), CS, HOM_NAY); assert.strictEqual(r.phi, 20000); assert.strictEqual(r.ngayTinhPhi, 1); });
test('trễ 7 ngày: tính 4 ngày = 80.000', () => assert.strictEqual(R.tinhPhi(hd(7), CS, HOM_NAY).phi, 80000));
test('chưa quá hạn thì không phí', () => assert.strictEqual(R.tinhPhi(hd(-2), CS, HOM_NAY).phi, 0));
test('phí không vượt 10% tiền gốc (100.000 với 1 triệu)', () => {
  const r = R.tinhPhi(hd(60), CS, HOM_NAY);
  assert.strictEqual(r.phi, 100000); assert.strictEqual(r.bangTran, true);
});
test('đúng bằng trần thì không đánh dấu chạm trần', () => {
  const r = R.tinhPhi(hd(5), { moiNgay: 50000, mienNgay: 3 }, HOM_NAY);   // 2 ngày × 50k = 100k = trần
  assert.strictEqual(r.phi, 100000); assert.strictEqual(r.bangTran, false);
});
test('hóa đơn đã trả đủ thì không phí', () => assert.strictEqual(R.tinhPhi(hd(20, { paid: 1000000 }), CS, HOM_NAY).phi, 0));
test('hóa đơn đã hủy hoặc nháp thì không phí', () => {
  assert.strictEqual(R.tinhPhi(hd(20, { status: 'cancelled' }), CS, HOM_NAY).phi, 0);
  assert.strictEqual(R.tinhPhi(hd(20, { status: 'draft' }), CS, HOM_NAY).phi, 0);
});
test('phí tính trên tiền gốc, không tính chồng lên phí đã áp', () => {
  const inv = hd(60, { total: 1100000, lines: [{ type: 'rent', amount: 1000000 }, { type: 'latefee', amount: 100000 }] });
  assert.strictEqual(R.tienGoc(inv), 1000000);
  assert.strictEqual(R.tinhPhi(inv, CS, HOM_NAY).phi, 100000);            // trần vẫn theo 1 triệu, không phải 1,1 triệu
});
test('số ngày miễn phí 0 thì tính từ ngày đầu', () => assert.strictEqual(R.tinhPhi(hd(2), { moiNgay: 10000, mienNgay: 0 }, HOM_NAY).phi, 20000));
test('chính sách rác không làm hỏng', () => {
  assert.deepStrictEqual(R.chinhSach({ moiNgay: -5, mienNgay: 'abc' }), { moiNgay: 0, mienNgay: 3 });
  assert.deepStrictEqual(R.chinhSach(null), { moiNgay: 0, mienNgay: 3 });
});

console.log('Gom theo phòng');
test('chỉ lấy hóa đơn còn nợ và đã vào diện nhắc', () => {
  const ds = [hd(5), hd(-10, { roomCode: 'P102' }), hd(5, { roomCode: 'P103', paid: 1000000 })];
  const g = R.gomTheoPhong(ds, CS, HOM_NAY);
  assert.strictEqual(g.length, 1); assert.strictEqual(g[0].roomCode, 'P101');
});
test('mức của phòng là mức nặng nhất trong các hóa đơn', () => {
  const g = R.gomTheoPhong([hd(2, { id: 'a', period: '2026-10' }), hd(40, { id: 'b', period: '2026-09' })], CS, HOM_NAY);
  assert.strictEqual(g.length, 1); assert.strictEqual(g[0].muc.ma, 'khan'); assert.strictEqual(g[0].hoaDon.length, 2);
  assert.strictEqual(g[0].hoaDon[0].period, '2026-09');                   // kỳ cũ xếp trước
});
test('sắp xếp: mức nặng lên trước, cùng mức thì nợ nhiều lên trước', () => {
  const ds = [hd(2, { roomCode: 'A', total: 5000000, lines: [{ type: 'rent', amount: 5000000 }] }), hd(9, { roomCode: 'B' }),
    hd(2, { roomCode: 'C', total: 9000000, lines: [{ type: 'rent', amount: 9000000 }] })];
  assert.deepStrictEqual(R.gomTheoPhong(ds, CS, HOM_NAY).map((x) => x.roomCode), ['B', 'C', 'A']);
});
test('nợ một phần: còn nợ = tổng trừ đã trả', () => {
  const g = R.gomTheoPhong([hd(2, { paid: 400000 })], CS, HOM_NAY);
  assert.strictEqual(g[0].conNo, 600000);
});
test('tổng cần trả = còn nợ + phí tạm tính', () => {
  const g = R.gomTheoPhong([hd(7)], CS, HOM_NAY)[0];
  assert.strictEqual(g.phi, 80000); assert.strictEqual(g.tongCanTra, 1080000);
});
test('đã áp phí rồi thì tính lại, không cộng dồn hai lần', () => {
  // đã ghi nợ phí 100.000 vào hóa đơn khi trễ 60 ngày; hôm nay vẫn tính ra 100.000 → tổng giữ nguyên 1,1 triệu
  const inv = hd(60, { total: 1100000, lines: [{ type: 'rent', amount: 1000000 }, { type: 'latefee', amount: 100000 }] });
  const g = R.gomTheoPhong([inv], CS, HOM_NAY)[0];
  assert.strictEqual(g.conNo, 1100000); assert.strictEqual(g.phiDaAp, 100000); assert.strictEqual(g.tongCanTra, 1100000);
});

console.log('Trạng thái nhắc');
const muc = (ma) => R.MUC.find((m) => m.ma === ma);
test('chưa từng nhắc thì nên nhắc', () => { const t = R.trangThaiNhac(null, muc('nhac-nhe'), HOM_NAY); assert.strictEqual(t.ma, 'chua-nhac'); assert.strictEqual(t.nenNhac, true); });
test('đã nhắc hôm nay thì thôi', () => {
  const t = R.trangThaiNhac({ at: new Date(2026, 9, 20, 8).toISOString(), ma: 'nhac-nhe' }, muc('nhac-nhe'), HOM_NAY);
  assert.strictEqual(t.ma, 'da-nhac-nay'); assert.strictEqual(t.nenNhac, false);
});
test('đã nhắc mức thấp mà nay lên mức cao hơn thì nhắc lại ngay', () => {
  const t = R.trangThaiNhac({ at: new Date(2026, 9, 20, 8).toISOString(), ma: 'nhac-nhe' }, muc('khan'), HOM_NAY);
  assert.strictEqual(t.ma, 'len-bac'); assert.strictEqual(t.nenNhac, true);
});
test('đã nhắc hôm qua cùng mức: chưa cần nhắc lại', () => {
  const t = R.trangThaiNhac({ at: new Date(2026, 9, 19, 8).toISOString(), ma: 'nhac-nhe' }, muc('nhac-nhe'), HOM_NAY);
  assert.strictEqual(t.nenNhac, false);
});
test('đã nhắc từ 2 ngày trước cùng mức thì nên nhắc lại', () => {
  const t = R.trangThaiNhac({ at: new Date(2026, 9, 18, 8).toISOString(), ma: 'nhac-nhe' }, muc('nhac-nhe'), HOM_NAY);
  assert.strictEqual(t.nenNhac, true);
});

console.log('Soạn tin');
const TK = { ten: 'Vietcombank', so: '0123456789', chu: 'NGUYEN VAN B' };
const tin = (tre, cs, o) => R.soanTin(R.gomTheoPhong([hd(tre, o)], cs, HOM_NAY)[0], { taiKhoan: TK, chinhSach: cs, noiDungCK: (i) => 'HH ' + i.roomCode });
test('mọi mức đều có số tiền, tên phòng, tài khoản và nội dung chuyển khoản', () => {
  [-2, 2, 5, 12].forEach((t) => {
    const s = tin(t, CS);
    assert.ok(s.includes('P101'), 'tên phòng ở mức ' + t);
    assert.ok(s.includes('1.000.000'), 'số tiền ở mức ' + t);
    assert.ok(s.includes('0123456789'), 'số tài khoản ở mức ' + t);
    assert.ok(s.includes('HH P101'), 'nội dung chuyển khoản ở mức ' + t);
  });
});
test('sắp hạn nói "còn N ngày", không dọa phạt', () => {
  const s = tin(-2, CS);
  assert.ok(/còn 2 ngày/.test(s)); assert.ok(!/phí trễ|quá hạn/.test(s));
});
test('nhắc nhẹ nêu số ngày quá hạn, chưa nhắc phí', () => {
  const s = tin(2, CS);
  assert.ok(/quá hạn 2 ngày/.test(s)); assert.ok(!/phí trễ hạn/.test(s));
});
test('mức có phí và phí đang bật: nêu mức phí và số tạm tính', () => {
  const s = tin(6, CS);
  assert.ok(/20\.000 ₫\/ngày/.test(s)); assert.ok(/60\.000/.test(s)); assert.ok(/1\.060\.000/.test(s));
});
test('mức có phí nhưng phí đang tắt: không nhắc đến phí', () => {
  const s = tin(6, { moiNgay: 0 });
  assert.ok(!/phí/.test(s)); assert.ok(/1\.000\.000/.test(s));
});
test('mức khẩn có cảnh báo hợp đồng và tổng đã gồm phí', () => {
  const s = tin(12, CS);
  assert.ok(/hợp đồng/.test(s)); assert.ok(/1\.100\.000/.test(s)); assert.ok(/phí trễ hạn 100\.000/.test(s));
});
test('mức khẩn khi phí tắt vẫn đúng số tiền gốc, không nhắc phí', () => {
  const s = tin(12, { moiNgay: 0 });
  assert.ok(/1\.000\.000/.test(s)); assert.ok(!/phí/.test(s));
});
test('nhiều hóa đơn: liệt kê từng kỳ', () => {
  const g = R.gomTheoPhong([hd(40, { id: 'a', period: '2026-09' }), hd(5, { id: 'b', period: '2026-10' })], CS, HOM_NAY)[0];
  const s = R.soanTin(g, { taiKhoan: TK, chinhSach: CS });
  assert.ok(/T9\/2026/.test(s)); assert.ok(/T10\/2026/.test(s));
});
test('thiếu tài khoản ngân hàng thì không in dòng chuyển khoản trống', () => {
  const s = R.soanTin(R.gomTheoPhong([hd(2)], CS, HOM_NAY)[0], { chinhSach: CS });
  assert.ok(!/STK/.test(s));
});
test('không có tên khách thì không in "undefined"', () => {
  const s = tin(2, CS, { tenantName: undefined });
  assert.ok(!/undefined|null/.test(s));
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

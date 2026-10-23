/* Kiểm thử luật chấm điểm thanh toán (js/scoring.js).
   Chạy:  node tests/scoring.test.js
   Không cần cài gì thêm; thất bại thì thoát với mã khác 0 (dùng được trong CI). */
const assert = require('assert');
const S = require('../js/scoring.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

// Ngày dựng theo giờ địa phương, đúng cách ứng dụng lưu hạn thanh toán
const ngay = (y, m, d) => new Date(y, m - 1, d);
const HOM_NAY = ngay(2026, 10, 20);
const hd = (id, han, total, paid, status) => ({ id, dueDate: ngay(...han).toISOString(), total, paid, status: status || (paid >= total ? 'paid' : 'issued') });
const phieu = (map) => (inv) => (map[inv.id] || []).map((d) => ({ date: d }));

console.log('Điểm từng hóa đơn');
test('trả đúng ngày hạn = 100', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000)], phieu({ a: [ngay(2026, 10, 5)] }), HOM_NAY);
  assert.strictEqual(r.diem, 100); assert.strictEqual(r.hang, 'xuat-sac');
  // phải được xếp là ĐÚNG HẠN, không phải "trả trễ 0 ngày": điểm cùng là 100 nhưng thống kê khác
  assert.strictEqual(r.dungHan, 1); assert.strictEqual(r.traTre, 0);
});
test('trả sớm vẫn là 100, không vượt quá', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000)], phieu({ a: [ngay(2026, 10, 1)] }), HOM_NAY);
  assert.strictEqual(r.diem, 100);
});
test('trả trễ 5 ngày = 88', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000)], phieu({ a: [ngay(2026, 10, 10)] }), HOM_NAY);
  assert.strictEqual(r.diem, 88); assert.strictEqual(r.traTre, 1);
});
test('trả trễ 30 ngày và hơn nữa = 30, không âm', () => {
  const r30 = S.tinh([hd('a', [2026, 9, 1], 1000, 1000)], phieu({ a: [ngay(2026, 10, 1)] }), HOM_NAY);
  const r90 = S.tinh([hd('a', [2026, 7, 1], 1000, 1000)], phieu({ a: [ngay(2026, 10, 1)] }), HOM_NAY);
  assert.strictEqual(r30.diem, 30); assert.strictEqual(r90.diem, 30);
});
test('quá hạn chưa trả đồng nào = 0', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 0)], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, 0); assert.strictEqual(r.hang, 'can-nhac'); assert.strictEqual(r.quaHan, 1);
});
test('quá hạn đã trả một phần = 25', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 400, 'partial')], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, 25);
});

console.log('Hóa đơn không được tính');
test('chưa tới hạn thì không tính (chưa biết)', () => {
  const r = S.tinh([hd('a', [2026, 10, 25], 1000, 0)], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, null); assert.strictEqual(r.hang, 'chua-co'); assert.strictEqual(r.chuaDenHan, 1);
});
test('trả đủ mà không có phiếu thu ghi ngày: KHÔNG đoán là đúng hạn', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000)], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, null); assert.strictEqual(r.khongRoNgay, 1);
});
test('hóa đơn đã hủy và bản nháp bị bỏ qua', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 0, 'cancelled'), hd('b', [2026, 10, 5], 1000, 0, 'draft')], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, null); assert.strictEqual(r.soHoaDon, 0);
});
test('danh sách rỗng / không phải mảng không làm hỏng', () => {
  assert.strictEqual(S.tinh([], phieu({}), HOM_NAY).diem, null);
  assert.strictEqual(S.tinh(null, phieu({}), HOM_NAY).diem, null);
});
test('hóa đơn không có hạn thanh toán bị bỏ qua', () => {
  const r = S.tinh([{ id: 'a', total: 1000, paid: 0, status: 'issued', dueDate: null }], phieu({}), HOM_NAY);
  assert.strictEqual(r.diem, null);
});

console.log('Gộp nhiều hóa đơn');
test('hóa đơn MỚI nặng hơn: sửa được thói quen thì điểm lên', () => {
  const cuTre = hd('cu', [2026, 8, 5], 1000, 1000), moiDung = hd('moi', [2026, 9, 5], 1000, 1000);
  const lenLai = S.tinh([cuTre, moiDung], phieu({ cu: [ngay(2026, 9, 20)], moi: [ngay(2026, 9, 5)] }), HOM_NAY);
  const xauDi = S.tinh([cuTre, moiDung], phieu({ cu: [ngay(2026, 8, 5)], moi: [ngay(2026, 10, 15)] }), HOM_NAY);
  assert.ok(lenLai.diem > xauDi.diem, `lên lại ${lenLai.diem} phải cao hơn xấu đi ${xauDi.diem}`);
});
test('trộn đúng hạn và quá hạn ra điểm ở giữa', () => {
  const r = S.tinh([hd('a', [2026, 9, 5], 1000, 1000), hd('b', [2026, 10, 5], 1000, 0)],
    phieu({ a: [ngay(2026, 9, 5)] }), HOM_NAY);
  assert.ok(r.diem > 0 && r.diem < 100, 'điểm = ' + r.diem);
  assert.strictEqual(r.soHoaDon, 2);
});
test('phiếu thu cuối cùng quyết định ngày trả đủ (trả làm hai đợt)', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000)], phieu({ a: [ngay(2026, 10, 2), ngay(2026, 10, 12)] }), HOM_NAY);
  assert.strictEqual(r.diem, 84);   // trễ 7 ngày: 1 - 0,7 × 7/30 = 0,8367
});

console.log('Hạng và cờ tạm tính');
test('ranh giới các hạng', () => {
  const h = (d) => S.hangCua(d).ma;
  assert.strictEqual(h(100), 'xuat-sac'); assert.strictEqual(h(90), 'xuat-sac');
  assert.strictEqual(h(89), 'tot');       assert.strictEqual(h(75), 'tot');
  assert.strictEqual(h(74), 'trung-binh'); assert.strictEqual(h(50), 'trung-binh');
  assert.strictEqual(h(49), 'can-nhac');  assert.strictEqual(h(0), 'can-nhac');
});
test('dưới 3 hóa đơn thì tạm tính, từ 3 hóa đơn thì không', () => {
  const mot = hd('a', [2026, 7, 5], 1000, 1000), hai = hd('b', [2026, 8, 5], 1000, 1000), ba = hd('c', [2026, 9, 5], 1000, 1000);
  const p = phieu({ a: [ngay(2026, 7, 5)], b: [ngay(2026, 8, 5)], c: [ngay(2026, 9, 5)] });
  assert.strictEqual(S.tinh([mot, hai], p, HOM_NAY).tamTinh, true);
  assert.strictEqual(S.tinh([mot, hai, ba], p, HOM_NAY).tamTinh, false);
});

console.log('Ngày tháng');
test('so theo ngày lịch, bỏ giờ: 20h30 cùng ngày hạn vẫn là đúng hạn', () => {
  assert.strictEqual(S.ngayLich(new Date(2026, 9, 12, 20, 30)), S.ngayLich(new Date(2026, 9, 12, 0, 0)));
  const r = S.tinh([hd('a', [2026, 10, 12], 1000, 1000)], phieu({ a: [new Date(2026, 9, 12, 20, 30)] }), HOM_NAY);
  assert.strictEqual(r.diem, 100);
});
test('chuỗi "YYYY-MM-DD" và ISO của nửa đêm địa phương cùng một ngày', () => {
  assert.strictEqual(S.ngayLich('2026-10-12'), S.ngayLich(ngay(2026, 10, 12).toISOString()));
});
test('giá trị rác trả về null chứ không văng lỗi', () => {
  assert.strictEqual(S.ngayLich('khong-phai-ngay'), null);
  assert.strictEqual(S.ngayLich(''), null); assert.strictEqual(S.ngayLich(null), null);
});

console.log('Lời giải thích');
test('nêu đủ số liệu và cảnh báo khi thiếu dữ liệu', () => {
  const r = S.tinh([hd('a', [2026, 10, 5], 1000, 1000), hd('b', [2026, 9, 5], 1000, 1000)], phieu({ a: [ngay(2026, 10, 5)] }), HOM_NAY);
  const t = S.giaiThich(r);
  assert.ok(/1 đúng hạn/.test(t), t); assert.ok(/không có phiếu thu/.test(t), t); assert.ok(/tạm tính/.test(t), t);
  assert.ok(/Chưa có hóa đơn/.test(S.giaiThich(S.tinh([], phieu({}), HOM_NAY))));
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

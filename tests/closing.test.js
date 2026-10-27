/* Kiểm thử phân loại chốt sổ (js/closing.js).
   Chạy:  node tests/closing.test.js */
const assert = require('assert');
const C = require('../js/closing.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const KY = C.kyThang('2026-10');
const hd = (o) => Object.assign({ contractId: 'c1', roomCode: 'P101', tenantName: 'An', daCoHoaDon: false,
  start: new Date(2026, 0, 1), end: new Date(2027, 0, 1),
  chiSo: { elecPrev: 100, elecCurr: 250, elecExtra: 0, elecAvg: 190 } }, o || {});
const mot = (o) => C.phanLoai([hd(o)], KY)[0];

console.log('Kỳ');
test('kỳ 2026-10 từ 1/10 đến 31/10', () => { assert.strictEqual(KY.batDau.getDate(), 1); assert.strictEqual(KY.ketThuc.getDate(), 31); assert.strictEqual(KY.ketThuc.getMonth(), 9); });
test('tháng 2 năm nhuận có 29 ngày', () => assert.strictEqual(C.kyThang('2028-02').ketThuc.getDate(), 29));
test('kỳ sai dạng trả null', () => assert.strictEqual(C.kyThang('10/2026'), null));

console.log('Từng trạng thái');
test('đủ chỉ số, dùng bình thường: sẵn sàng và được chọn sẵn', () => { const r = mot(); assert.strictEqual(r.trangThai, 'san-sang'); assert.strictEqual(r.chon, true); assert.strictEqual(r.chan, false); assert.strictEqual(r.tieuThu, 150); });
test('chưa ghi chỉ số: thiếu, bị chặn, không chọn', () => { const r = mot({ chiSo: null }); assert.strictEqual(r.trangThai, 'thieu-chi-so'); assert.strictEqual(r.chan, true); assert.strictEqual(r.chon, false); });
test('có bản ghi nhưng elecCurr trống cũng là thiếu', () => assert.strictEqual(mot({ chiSo: { elecPrev: 100, elecCurr: null } }).trangThai, 'thieu-chi-so'));
test('chỉ số không phải số là thiếu', () => assert.strictEqual(mot({ chiSo: { elecPrev: 100, elecCurr: 'abc' } }).trangThai, 'thieu-chi-so'));
test('chỉ số nhỏ hơn kỳ trước: bị chặn', () => { const r = mot({ chiSo: { elecPrev: 500, elecCurr: 120 } }); assert.strictEqual(r.trangThai, 'chi-so-giam'); assert.strictEqual(r.chan, true); });
test('nhỏ hơn kỳ trước nhưng đã xử lý quay vòng (có phần bù): chốt được', () => assert.strictEqual(mot({ chiSo: { elecPrev: 0, elecCurr: 40, elecExtra: 350, elecAvg: 190 } }).trangThai, 'san-sang'));
test('chỉ số nhỏ hơn kỳ trước nhưng có phần bù (đồng hồ quay vòng / thay mới): chốt được, tiêu thụ = phần bù', () => {
  const r = mot({ chiSo: { elecPrev: 500, elecCurr: 40, elecExtra: 100, elecAvg: 190 } });
  assert.strictEqual(r.trangThai, 'san-sang'); assert.strictEqual(r.tieuThu, 100);
});
test('điện cao gấp hơn 3 lần mức thường: nên xem lại nhưng vẫn chọn sẵn', () => {
  const r = mot({ chiSo: { elecPrev: 100, elecCurr: 800, elecAvg: 190 } });   // 700 kWh = 3,7 lần
  assert.strictEqual(r.trangThai, 'bat-thuong'); assert.strictEqual(r.chon, true); assert.strictEqual(r.chan, false); assert.ok(/3,7|3\.7/.test(r.ghiChu), r.ghiChu);
});
test('đúng 3 lần mức thường thì chưa bị gắn cờ', () => assert.strictEqual(mot({ chiSo: { elecPrev: 0, elecCurr: 570, elecAvg: 190 } }).trangThai, 'san-sang'));
test('không dùng điện (tiêu thụ 0): nên xem lại', () => assert.strictEqual(mot({ chiSo: { elecPrev: 300, elecCurr: 300, elecAvg: 190 } }).trangThai, 'bat-thuong'));
test('không có mức trung bình thì không gắn cờ "vọt cao"', () => assert.strictEqual(mot({ chiSo: { elecPrev: 0, elecCurr: 9999, elecAvg: 0 } }).trangThai, 'san-sang'));
test('đã có hóa đơn kỳ này: bỏ qua và không chọn', () => { const r = mot({ daCoHoaDon: true }); assert.strictEqual(r.trangThai, 'da-co'); assert.strictEqual(r.chon, false); });
test('đã có hóa đơn thắng mọi thứ khác, kể cả khi thiếu chỉ số', () => assert.strictEqual(mot({ daCoHoaDon: true, chiSo: null }).trangThai, 'da-co'));
test('hợp đồng bắt đầu sau kỳ: ngoài kỳ', () => assert.strictEqual(mot({ start: new Date(2026, 10, 1) }).trangThai, 'ngoai-ky'));
test('hợp đồng đã hết trước kỳ: ngoài kỳ', () => assert.strictEqual(mot({ end: new Date(2026, 8, 30) }).trangThai, 'ngoai-ky'));
test('hợp đồng bắt đầu đúng ngày cuối kỳ vẫn thuộc kỳ', () => assert.strictEqual(mot({ start: new Date(2026, 9, 31) }).trangThai, 'san-sang'));
test('hợp đồng hết đúng ngày đầu kỳ vẫn thuộc kỳ', () => assert.strictEqual(mot({ end: new Date(2026, 9, 1) }).trangThai, 'san-sang'));

console.log('Tổng hợp');
test('đếm đúng từng loại và số chọn được', () => {
  const ds = C.phanLoai([hd({ contractId: 'a' }), hd({ contractId: 'b', chiSo: null }), hd({ contractId: 'c', daCoHoaDon: true }),
    hd({ contractId: 'd', chiSo: { elecPrev: 0, elecCurr: 900, elecAvg: 190 } }), hd({ contractId: 'e', chiSo: { elecPrev: 500, elecCurr: 100 } })], KY);
  const t = C.tom(ds);
  assert.strictEqual(t.tong, 5); assert.strictEqual(t['san-sang'], 1); assert.strictEqual(t['bat-thuong'], 1);
  assert.strictEqual(t['thieu-chi-so'], 1); assert.strictEqual(t['chi-so-giam'], 1); assert.strictEqual(t['da-co'], 1);
  assert.strictEqual(t.chon, 2); assert.strictEqual(t.chan, 2);
});
test('danh sách rỗng hoặc null không lỗi', () => { assert.deepStrictEqual(C.phanLoai([], KY), []); assert.deepStrictEqual(C.phanLoai(null, KY), []); assert.strictEqual(C.tom([]).tong, 0); });
test('giữ nguyên mã hợp đồng, phòng, tên khách', () => { const r = mot({ contractId: 'hd-9', roomCode: 'P309', tenantName: 'Bình' }); assert.deepStrictEqual([r.contractId, r.roomCode, r.tenantName], ['hd-9', 'P309', 'Bình']); });

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

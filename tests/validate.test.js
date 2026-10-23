/* Kiểm thử luật kiểm tra dữ liệu nhập (js/validate.js).
   Chạy:  node tests/validate.test.js */
const assert = require('assert');
const V = require('../js/validate.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};
const sach = (loi) => assert.strictEqual(loi, '', 'đáng lẽ hợp lệ nhưng báo: ' + loi);
const sai = (loi) => assert.ok(loi && loi.length > 0, 'đáng lẽ phải báo lỗi');

console.log('Ngày');
test('dd/mm/yyyy có thật', () => assert.ok(V.ngayDMY('29/02/2024')));
test('29/02 năm không nhuận bị loại', () => assert.strictEqual(V.ngayDMY('29/02/2025'), null));
test('31/04 và tháng 13 bị loại', () => { assert.strictEqual(V.ngayDMY('31/04/2026'), null); assert.strictEqual(V.ngayDMY('10/13/2026'), null); });
test('yyyy-mm-dd có thật, 2026-02-30 thì không', () => { assert.ok(V.ngayISO('2026-10-23')); assert.strictEqual(V.ngayISO('2026-02-30'), null); });
test('ngày ISO đọc theo giờ địa phương, không lệch múi giờ', () => {
  const d = V.ngayISO('2026-10-23'); assert.strictEqual(d.getDate(), 23); assert.strictEqual(d.getHours(), 0);
});
test('chuỗi rỗng và chữ không phải ngày', () => { assert.strictEqual(V.ngay(''), null); assert.strictEqual(V.ngay('hôm qua'), null); });
const HN = new Date(2026, 9, 23, 15, 30);
test('không tương lai: đúng hôm nay vẫn được (dù giờ nào)', () => sach(V.ngayHopLe('2026-10-23', { khongTuongLai: true, homNay: HN })));
test('không tương lai: ngày mai bị chặn', () => sai(V.ngayHopLe('2026-10-24', { khongTuongLai: true, homNay: HN })));
test('ngày trống báo "Chưa nhập"', () => assert.ok(/Chưa nhập Ngày thu/.test(V.ngayHopLe('', { ten: 'Ngày thu' }))));
test('năm quá cũ (1999) bị chặn với ngày thường, nhưng ngày sinh cho phép tới namMin', () => {
  sai(V.ngayHopLe('01/01/1999'));
  sach(V.ngayHopLe('01/01/1999', { namMin: 1900, khongTuongLai: true, homNay: HN }));
  sai(V.ngayHopLe('01/01/1899', { namMin: 1900 }));
});
test('chặn trước mốc và sau mốc', () => {
  sai(V.ngayHopLe('2026-01-01', { khongTruoc: new Date(2026, 5, 1) }));
  sai(V.ngayHopLe('2026-12-01', { khongSau: new Date(2026, 5, 1) }));
  sach(V.ngayHopLe('2026-06-01', { khongTruoc: new Date(2026, 5, 1), khongSau: new Date(2026, 5, 1) }));
});
test('khoảng ngày: kết thúc không được trước hoặc trùng bắt đầu', () => {
  sai(V.khoangNgay('01/10/2026', '01/10/2026')); sai(V.khoangNgay('01/10/2026', '30/09/2026'));
  sach(V.khoangNgay('01/10/2026', '01/10/2027')); sach(V.khoangNgay('', '01/10/2027'));
});

console.log('Số điện thoại, CCCD, email, tên, biển số');
test('sđt 10 số bắt đầu 0', () => sach(V.sdt('0912345678')));
test('sđt có khoảng trắng / dấu chấm vẫn đúng', () => { sach(V.sdt('091 234 5678')); sach(V.sdt('091.234.5678')); });
test('sđt +84 và 84 được đổi về 0', () => { sach(V.sdt('+84912345678')); assert.strictEqual(V.chuanSdt('+84 912 345 678'), '0912345678'); assert.strictEqual(V.chuanSdt('84912345678'), '0912345678'); });
test('sđt thiếu số, thừa số, có chữ bị chặn', () => { sai(V.sdt('091234567')); sai(V.sdt('09123456789')); sai(V.sdt('09123abc78')); sai(V.sdt('912345678')); });
test('CCCD 12 số hoặc CMND 9 số', () => { sach(V.cccd('079201012345')); sach(V.cccd('123456789')); sai(V.cccd('0792010123')); sai(V.cccd('07920101234a')); });
test('email', () => { sach(V.email('ten@gmail.com')); sai(V.email('ten@gmail')); sai(V.email('ten gmail.com')); sai(V.email('@gmail.com')); });
test('họ tên cần từ hai chữ, không có số', () => { sach(V.hoTen('Nguyễn Văn A')); sai(V.hoTen('Nam')); sai(V.hoTen('Nguyễn Văn 2')); sai(V.hoTen('   ')); });
test('biển số hợp lệ nhiều dạng', () => ['59X1-123.45', '51F-123.45', '29A-12345', '30E 123.45', '59-X1 123.45', '29MĐ1-123.45'].forEach(b => sach(V.bienSo(b))));
test('biển số sai', () => ['', 'abc', '5912345', 'ABCDE12345', '59X1-12'].forEach(b => sai(V.bienSo(b))));

console.log('Tiền và số');
test('đọc tiền: số trơn và có dấu nhóm nghìn', () => {
  assert.strictEqual(V.docTien('1500000'), 1500000); assert.strictEqual(V.docTien('1.500.000'), 1500000);
  assert.strictEqual(V.docTien('1,500,000'), 1500000); assert.strictEqual(V.docTien('1 500 000'), 1500000);
  assert.strictEqual(V.docTien('1.500.000 ₫'), 1500000);
});
test('đọc tiền: dấu trừ, chữ, thập phân, nhóm sai đều là null', () => {
  ['-5', '12abc', '1,5', '1.5', '1..000', '1.50', '12.3456', 'abc', '--'].forEach(x => assert.strictEqual(V.docTien(x), null, x));
});
test('tiền trống báo chưa nhập, trừ khi không bắt buộc', () => { sai(V.tien('')); sach(V.tien('', { batBuoc: false })); });
test('tiền âm bị chặn dù U.parseNum sẽ bỏ dấu trừ', () => sai(V.tien('-500000')));
test('tiền 0 hợp lệ khi min = 0, bị chặn khi min = 1', () => { sach(V.tien('0')); sai(V.tien('0', { min: 1 })); });
test('tiền vượt tối đa bị chặn, đúng bằng tối đa thì được', () => { sai(V.tien('1.000.001', { max: 1000000 })); sach(V.tien('1.000.000', { max: 1000000 })); });
test('lời báo chứa tên ô để người dùng biết ô nào', () => assert.ok(/Giá thuê/.test(V.tien('abc', { ten: 'Giá thuê' }))));
test('số thường: nguyên, khoảng, thập phân', () => {
  sach(V.so('12.5', { ten: 'Diện tích', min: 1 })); sach(V.so('12,5')); sai(V.so('-3')); sai(V.so('12a'));
  sai(V.so('2.5', { nguyen: true })); sach(V.so('3', { nguyen: true })); sai(V.so('0', { min: 1 })); sai(V.so('99', { max: 50 }));
  sai(V.so('')); sach(V.so('', { batBuoc: false }));
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

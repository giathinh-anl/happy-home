/* Kiểm thử tài khoản nhận tiền của tòa nhà (js/bank-info.js).
   Chạy:  node tests/bank-info.test.js */
const assert = require('assert');
const B = require('../js/bank-info.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const MB = { bin: '970422', account: '0123456789', holder: 'Nguyễn Văn Đạt' };

/* ---------- Danh sách ngân hàng ---------- */
test('mọi mã ngân hàng đủ 6 chữ số, không trùng mã, không trùng tên', () => {
  assert.ok(B.NGAN_HANG.length >= 30);
  B.NGAN_HANG.forEach((b) => assert.ok(/^[0-9]{6}$/.test(b.bin), 'bin sai: ' + b.ten + ' ' + b.bin));
  assert.strictEqual(new Set(B.NGAN_HANG.map((b) => b.bin)).size, B.NGAN_HANG.length);
  assert.strictEqual(new Set(B.NGAN_HANG.map((b) => b.ten)).size, B.NGAN_HANG.length);
});
test('các ngân hàng lớn đúng mã (khớp ghi chú trong app khách: MB 970422, Vietcombank 970436, Techcombank 970407, ACB 970416, BIDV 970418, VietinBank 970415)', () => {
  const m = { 'MB Bank': '970422', Vietcombank: '970436', Techcombank: '970407', ACB: '970416', BIDV: '970418', VietinBank: '970415' };
  Object.keys(m).forEach((t) => assert.strictEqual(B.theoTen(t).bin, m[t], t));
});
test('ngân hàng phổ biến xếp đầu danh sách, MB Bank đứng đầu', () => {
  assert.strictEqual(B.NGAN_HANG[0].ten, 'MB Bank');
  assert.deepStrictEqual(B.NGAN_HANG.slice(0, 5).map((b) => b.ten), ['MB Bank', 'Vietcombank', 'Techcombank', 'BIDV', 'VietinBank']);
});
test('ví điện tử không nằm trong danh sách (đây là tài khoản ngân hàng)', () => {
  ['MoMo', 'ZaloPay'].forEach((t) => assert.strictEqual(B.theoTen(t), null));
});
test('theoTen: bỏ dấu, khoảng trắng, hoa thường; tên lạ hoặc rỗng thì null', () => {
  assert.strictEqual(B.theoTen('MBBank').bin, '970422');
  assert.strictEqual(B.theoTen(' mb  bank ').bin, '970422');
  assert.strictEqual(B.theoTen('vietcombank').bin, '970436');
  assert.strictEqual(B.theoTen('Ngân hàng Bịa'), null);
  assert.strictEqual(B.theoTen(''), null);
  assert.strictEqual(B.theoTen(null), null);
});
test('theoBin: tìm đúng, mã lạ hoặc rỗng thì null', () => {
  assert.strictEqual(B.theoBin('970436').ten, 'Vietcombank');
  assert.strictEqual(B.theoBin('123456'), null);
  assert.strictEqual(B.theoBin(''), null);
  assert.strictEqual(B.theoBin(undefined), null);
});

/* ---------- Chuẩn hóa ---------- */
test('chuanHoaTen: bỏ dấu, in hoa, gộp khoảng trắng, đ thành D', () => {
  assert.strictEqual(B.chuanHoaTen('  Nguyễn  Văn   Đạt '), 'NGUYEN VAN DAT');
  assert.strictEqual(B.chuanHoaTen('đỗ thị hồng'), 'DO THI HONG');
  assert.strictEqual(B.chuanHoaTen(null), '');
});
test('chuanHoaSo: bỏ khoảng trắng, dấu chấm, dấu gạch', () => {
  assert.strictEqual(B.chuanHoaSo('0123 456 789'), '0123456789');
  assert.strictEqual(B.chuanHoaSo('0123-456.789'), '0123456789');
  assert.strictEqual(B.chuanHoaSo(undefined), '');
});

/* ---------- Kiểm tra dữ liệu nhập ---------- */
test('dữ liệu đúng thì không báo lỗi (tên có dấu vẫn được, sẽ tự đổi)', () => {
  assert.strictEqual(B.kiemTra(MB), '');
});
test('thiếu hoặc sai ngân hàng', () => {
  assert.strictEqual(B.kiemTra({ account: '0123456789', holder: 'A B C' }), 'Chọn ngân hàng trong danh sách');
  assert.strictEqual(B.kiemTra({ bin: '111111', account: '0123456789', holder: 'A B C' }), 'Chọn ngân hàng trong danh sách');
  assert.strictEqual(B.kiemTra(null), 'Chọn ngân hàng trong danh sách');
  assert.strictEqual(B.kiemTra(undefined), 'Chọn ngân hàng trong danh sách');
});
test('số tài khoản: rỗng, có chữ, quá ngắn (5), quá dài (20)', () => {
  const f = (account) => B.kiemTra(Object.assign({}, MB, { account }));
  assert.strictEqual(f(''), 'Nhập số tài khoản');
  assert.strictEqual(f('   '), 'Nhập số tài khoản');
  assert.ok(f('01234abcde'));
  assert.ok(f('12345'));
  assert.ok(f('12345678901234567890'));
});
test('số tài khoản: đúng 6 và đúng 19 chữ số được; có khoảng trắng và gạch được', () => {
  const f = (account) => B.kiemTra(Object.assign({}, MB, { account }));
  assert.strictEqual(f('123456'), '');
  assert.strictEqual(f('1234567890123456789'), '');
  assert.strictEqual(f('0123 456 789'), '');
  assert.strictEqual(f('0123-456-789'), '');
});
test('tên chủ tài khoản: rỗng, có số, có ký tự lạ, quá ngắn, quá dài', () => {
  const f = (holder) => B.kiemTra(Object.assign({}, MB, { holder }));
  assert.strictEqual(f(''), 'Nhập tên chủ tài khoản');
  assert.ok(f('NGUYEN VAN A 2'));
  assert.ok(f('NGUYEN <b>VAN</b>'));
  assert.ok(f('NGUYEN & CO'));
  assert.ok(f('AB'));
  assert.ok(f('A'.repeat(51)));
  assert.strictEqual(f('A'.repeat(50)), '');
  assert.strictEqual(f('ABC'), '');
});
test('mã độc trong ô nhập bị từ chối ở cả ba ô', () => {
  assert.ok(B.kiemTra({ bin: '970422', account: '<script>', holder: 'ABC' }));
  assert.ok(B.kiemTra({ bin: '970422', account: '0123456789', holder: '"><img src=x onerror=alert(1)>' }));
  assert.ok(B.kiemTra({ bin: '"><svg onload=1>', account: '0123456789', holder: 'ABC' }));
});

/* ---------- Dạng lưu ---------- */
test('chuanHoa: ra đúng bốn trường đã chuẩn hóa, tên ngân hàng lấy từ danh sách', () => {
  assert.deepStrictEqual(B.chuanHoa(MB), { name: 'MB Bank', bin: '970422', account: '0123456789', holder: 'NGUYEN VAN DAT' });
});
test('chuanHoa: tên ngân hàng KHÔNG lấy từ ô nhập (không ai nhét chữ lạ vào được)', () => {
  const r = B.chuanHoa(Object.assign({}, MB, { name: '<script>alert(1)</script>' }));
  assert.strictEqual(r.name, 'MB Bank');
});
test('chuanHoa: không hợp lệ hoặc để trống thì null; không sửa đối tượng truyền vào', () => {
  assert.strictEqual(B.chuanHoa(null), null);
  assert.strictEqual(B.chuanHoa({}), null);
  assert.strictEqual(B.chuanHoa(Object.assign({}, MB, { account: '12' })), null);
  const goc = Object.assign({}, MB); B.chuanHoa(goc);
  assert.deepStrictEqual(goc, MB);
});

/* ---------- Chọn tài khoản cho một tòa ---------- */
const TOA = { name: 'Vietcombank', bin: '970436', account: '9999888877', holder: 'TRAN THI B' };
const TEP = { bank: { name: 'MB Bank', account: '0912 345 678', holder: 'Công ty Happy Home' } };
test('tòa có tài khoản hợp lệ thì dùng của tòa, kể cả khi tệp cấu hình cũng có', () => {
  const r = B.uuTien(TOA, TEP);
  assert.strictEqual(r.nguon, 'toa');
  assert.strictEqual(r.account, '9999888877');
  assert.strictEqual(r.name, 'Vietcombank');
});
test('tòa chưa nhập thì dùng tệp cấu hình cũ, tự tìm mã ngân hàng theo tên', () => {
  const r = B.uuTien(null, TEP);
  assert.deepStrictEqual(r, { nguon: 'tep', name: 'MB Bank', bin: '970422', account: '0912345678', holder: 'CONG TY HAPPY HOME' });
});
test('tài khoản của tòa hỏng (sai mã ngân hàng, số có chữ) thì bỏ qua và dùng tệp cấu hình', () => {
  assert.strictEqual(B.uuTien({ name: 'X', bin: '000000', account: '123456', holder: 'ABC' }, TEP).nguon, 'tep');
  assert.strictEqual(B.uuTien(Object.assign({}, TOA, { account: 'abc' }), TEP).nguon, 'tep');
});
test('không có gì cả thì null, không bao giờ bịa số mẫu', () => {
  assert.strictEqual(B.uuTien(null, null), null);
  assert.strictEqual(B.uuTien(undefined, {}), null);
  assert.strictEqual(B.uuTien(null, { bank: {} }), null);
  assert.strictEqual(B.uuTien(null, { bank: { name: 'MB Bank', holder: 'A' } }), null);
  assert.strictEqual(B.uuTien({}, { bank: { account: '' } }), null);
});
test('tệp cấu hình tên ngân hàng lạ: giữ tên, không có mã (mã QR sẽ trống thay vì trỏ nhầm)', () => {
  const r = B.uuTien(null, { bank: { name: 'Ngân hàng Bịa', account: '123456', holder: 'ABC' } });
  assert.strictEqual(r.bin, '');
  assert.strictEqual(B.vietQrUrl(r, 1000, 'X'), '');
});
test('tệp cấu hình đã có bin thì dùng bin đó', () => {
  const r = B.uuTien(null, { bank: { name: 'Gì đó', bin: '970436', account: '123456', holder: 'ABC' } });
  assert.strictEqual(r.bin, '970436');
  assert.strictEqual(r.name, 'Vietcombank');
});

/* ---------- Mã VietQR ---------- */
test('vietQrUrl: đúng định dạng, làm tròn tiền, mã hóa nội dung', () => {
  const tk = B.chuanHoa(MB);
  assert.strictEqual(B.vietQrUrl(tk, 1234567.6, 'HD2608013'),
    'https://img.vietqr.io/image/970422-0123456789-compact2.png?amount=1234568&addInfo=HD2608013&accountName=NGUYEN%20VAN%20DAT');
  assert.ok(B.vietQrUrl(tk, 0, 'a b&c=d').includes('addInfo=a%20b%26c%3Dd'));
});
test('vietQrUrl: thiếu tài khoản, mã ngân hàng hoặc số tài khoản thì trả rỗng', () => {
  assert.strictEqual(B.vietQrUrl(null, 1, 'x'), '');
  assert.strictEqual(B.vietQrUrl({ bin: '', account: '123456' }, 1, 'x'), '');
  assert.strictEqual(B.vietQrUrl({ bin: '970422', account: '' }, 1, 'x'), '');
});
test('vietQrUrl: số tiền thiếu hoặc lạ thì thành 0, không ra NaN', () => {
  const tk = B.chuanHoa(MB);
  assert.ok(B.vietQrUrl(tk, undefined, '').includes('amount=0'));
  assert.ok(B.vietQrUrl(tk, 'abc', '').includes('amount=0'));
  assert.ok(B.vietQrUrl(tk, -5000, '').includes('amount=0'));
  assert.ok(B.vietQrUrl(tk, NaN, '').includes('amount=0'));
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

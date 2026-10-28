/* Kiểm thử khách tự khai thông tin qua link (js/onboarding.js).
   Chạy:  node tests/onboarding.test.js
   Các ca kiểm hồ sơ khớp với tests/db/onboarding.test.py: luật JS (báo lỗi tức thì cho khách) và luật SQL (chặn thật ở máy chủ) phải cùng kết luận. */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const O = require('../js/onboarding.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const HN = new Date(2026, 9, 28, 14, 0);
const GOOD = { fullName: '  Nguyễn   Văn An ', phone: '+84 911 222 333', idNumber: '079.201.012.345', dob: '05/03/1998', gender: 'nu',
  hometown: 'Bình Định', address: '12/3 Lê Lợi, Quận 1, TP.HCM', cccdIssueDate: '20/04/2021', occupation: 'Kỹ sư', vehiclePlate: '59x1-123.45', consent: true };
const kiem = (o) => O.kiemHoSo(Object.assign({}, GOOD, o), HN);
const sai = (truong, gia) => { const r = kiem({ [truong]: gia }); assert.ok(!r.ok && r.loi[truong], `${truong}=${JSON.stringify(gia)} lẽ ra phải bị từ chối`); };

console.log('Hồ sơ hợp lệ được chuẩn hóa');
test('hồ sơ đầy đủ hợp lệ', () => assert.ok(kiem({}).ok, JSON.stringify(kiem({}).loi)));
test('tên gọn khoảng trắng, số điện thoại về 0xxxxxxxxx, CCCD chỉ chữ số', () => { const s = kiem({}).sach; assert.strictEqual(s.fullName, 'Nguyễn Văn An'); assert.strictEqual(s.phone, '0911222333'); assert.strictEqual(s.idNumber, '079201012345'); });
test('giới tính "nu" thành "Nữ", "NAM" thành "Nam"', () => { assert.strictEqual(kiem({}).sach.gender, 'Nữ'); assert.strictEqual(kiem({ gender: 'NAM' }).sach.gender, 'Nam'); });
test('biển số về dạng chuẩn không dấu cách và gạch', () => assert.strictEqual(kiem({}).sach.vehiclePlate, '59X112345'));
test('ngày cấp, nghề nghiệp, biển số là không bắt buộc', () => assert.ok(kiem({ cccdIssueDate: '', occupation: '', vehiclePlate: '' }).ok));
test('CMND cũ 9 số được nhận', () => assert.ok(kiem({ idNumber: '123456789' }).ok));
test('tên viết hoa toàn bộ và "NỮ" được nhận', () => assert.ok(kiem({ fullName: 'NGUYỄN THỊ HOA', gender: 'NỮ' }).ok));

console.log('Từ chối (khớp với máy chủ)');
[['fullName', 'An'], ['fullName', 'An 2 Nguyen'], ['fullName', ''], ['fullName', 'Nguyen <script> An'], ['fullName', 'An '.repeat(40)],
 ['phone', '091122233'], ['phone', '5911222333'], ['phone', '09112223ab'], ['idNumber', '07920101234'], ['idNumber', '07920101234a'],
 ['dob', '01/01/2999'], ['dob', '31/02/1998'], ['dob', '1998-03-05'], ['dob', '01/01/1800'], ['gender', 'khac'], ['hometown', ''], ['address', ' '],
 ['address', '<img src=x onerror=alert(1)>'], ['cccdIssueDate', '01/01/2999'], ['cccdIssueDate', '30/02/2020'], ['cccdIssueDate', '2021-04-20'], ['vehiclePlate', 'abc'],
 ['occupation', 'x'.repeat(81)], ['consent', false], ['consent', undefined]
].forEach(([t, g]) => test(`${t} = ${String(JSON.stringify(g)).slice(0, 30)}`, () => sai(t, g)));
test('nhiều lỗi cùng lúc thì báo hết một lượt', () => assert.ok(Object.keys(O.kiemHoSo({ fullName: 'An', phone: '1' }, HN).loi).length >= 6));
test('dữ liệu rỗng hoặc null không làm hỏng', () => { assert.ok(!O.kiemHoSo(null).ok); assert.ok(!O.kiemHoSo({}).ok); });
test('ngày sinh hôm nay hợp lệ, ngày mai thì không', () => { assert.ok(kiem({ dob: '28/10/2026' }).ok); assert.ok(!kiem({ dob: '29/10/2026' }).ok); });
test('câu báo ngày sinh bỏ trống không nói "Chưa nhập ngày sinh" lủng củng', () => assert.ok(/dd\/mm\/yyyy/.test(kiem({ dob: '' }).loi.dob)));

console.log('Trạng thái lời mời');
const inv = (o) => Object.assign({ status: 'pending', expiresAt: new Date(2026, 9, 30).toISOString() }, o);
test('chưa dùng còn hạn là "chờ khách khai"', () => assert.strictEqual(O.trangThai(inv(), HN).ma, 'cho-khai'));
test('chưa dùng mà quá hạn là "hết hạn"', () => assert.strictEqual(O.trangThai(inv({ expiresAt: new Date(2026, 9, 28, 13, 0).toISOString() }), HN).ma, 'het-han'));
test('đúng thời điểm hết hạn là hết hạn', () => assert.strictEqual(O.trangThai(inv({ expiresAt: HN.toISOString() }), HN).ma, 'het-han'));
test('đã gửi là "chờ duyệt" dù quá hạn (khách đã gửi kịp)', () => assert.strictEqual(O.trangThai(inv({ status: 'submitted', expiresAt: new Date(2026, 9, 1).toISOString() }), HN).ma, 'cho-duyet'));
test('duyệt, từ chối, thu hồi', () => { assert.strictEqual(O.trangThai(inv({ status: 'approved' }), HN).ma, 'da-duyet'); assert.strictEqual(O.trangThai(inv({ status: 'rejected' }), HN).ma, 'tu-choi'); assert.strictEqual(O.trangThai(inv({ status: 'revoked' }), HN).ma, 'thu-hoi'); });
test('mỗi trạng thái có nhãn và màu', () => ['cho-khai', 'het-han', 'cho-duyet', 'da-duyet', 'tu-choi', 'thu-hoi'].forEach((m) => assert.ok(Object.values({ a: O.trangThai(inv({ status: { 'cho-khai': 'pending', 'het-han': 'pending', 'cho-duyet': 'submitted', 'da-duyet': 'approved', 'tu-choi': 'rejected', 'thu-hoi': 'revoked' }[m], expiresAt: m === 'het-han' ? new Date(2026, 0, 1).toISOString() : inv().expiresAt }), HN) }).every((t) => t.nhan && t.tone))));

console.log('Thời gian còn lại');
const sau = (ms) => new Date(HN.getTime() + ms).toISOString();
test('dưới 1 giờ nói số phút', () => assert.strictEqual(O.conLai(sau(25 * 60000), HN), 'còn 25 phút'));
test('dưới 2 ngày nói giờ và phút', () => assert.strictEqual(O.conLai(sau(135 * 60000), HN), 'còn 2 giờ 15 phút'));
test('dưới 1 phút vẫn nói "còn 1 phút", không nói "còn 0 phút"', () => assert.strictEqual(O.conLai(sau(30000), HN), 'còn 1 phút'));
test('30 giờ vẫn nói giờ, chưa sang ngày', () => assert.strictEqual(O.conLai(sau(30 * 3600000), HN), 'còn 30 giờ'));
test('đúng giờ tròn không thừa "0 phút"', () => assert.strictEqual(O.conLai(sau(180 * 60000), HN), 'còn 3 giờ'));
test('từ 2 ngày trở lên nói số ngày', () => assert.strictEqual(O.conLai(sau(72 * 3600000), HN), 'còn 3 ngày'));
test('quá hạn hoặc đúng lúc hết hạn', () => { assert.strictEqual(O.conLai(sau(-1000), HN), 'đã hết hạn'); assert.strictEqual(O.conLai(sau(0), HN), 'đã hết hạn'); });
test('ngày rác trả chuỗi rỗng', () => assert.strictEqual(O.conLai('abc', HN), ''));

console.log('Link và token');
const TK = 'AbCdEfGhIjKlMnOpQrStUvWx';
test('token nằm sau dấu # (không bao giờ gửi lên máy chủ web)', () => { assert.strictEqual(O.layToken('#t=' + TK), TK); assert.strictEqual(O.layToken('t=' + TK), TK); });
test('token đặt trong ?query (sẽ lọt vào nhật ký máy chủ web) bị từ chối', () => { assert.strictEqual(O.layToken('?t=' + TK), ''); assert.strictEqual(O.layToken('?a=1&t=' + TK), ''); });
test('token sai dạng bị bỏ: quá ngắn, ký tự lạ, thiếu', () => { ['#t=abc', '#t=' + TK + '"><script>', '#x=' + TK, '', null, '#t='].forEach((h) => assert.strictEqual(O.layToken(h), '', String(h))); });
test('token có gạch ngang và gạch dưới (an toàn cho đường link)', () => assert.strictEqual(O.layToken('#t=abcd-efgh_ijkl-mnop_qrst'), 'abcd-efgh_ijkl-mnop_qrst'));
test('link mời từ địa chỉ web quản trị', () => assert.strictEqual(O.linkMoi('https://giathinh-anl.github.io/happy-home/index.html', TK), 'https://giathinh-anl.github.io/happy-home/join/#t=' + TK));
test('link mời khi địa chỉ kết thúc bằng /', () => assert.strictEqual(O.linkMoi('https://x.vn/app/', TK), 'https://x.vn/app/join/#t=' + TK));

console.log('Tin nhắn mời');
const tn = O.tinNhan({ ten: 'anh Nam', phong: 'P101', tenToa: 'Happy Home Quận 7', link: 'https://x.vn/join/#t=' + TK, hetHan: new Date(2026, 9, 31, 9, 5).toISOString() });
test('tin nhắn có tên, phòng, link và hạn dùng', () => { assert.ok(tn.includes('anh Nam') && tn.includes('phòng P101') && tn.includes('Happy Home Quận 7')); assert.ok(tn.includes('https://x.vn/join/#t=' + TK)); assert.ok(tn.includes('09:05 ngày 31/10/2026')); });
test('nói rõ link chỉ dùng một lần', () => assert.ok(/một lần/.test(tn)));
test('thiếu tên và phòng vẫn đọc được', () => { const t = O.tinNhan({ link: 'L', hetHan: HN.toISOString() }); assert.ok(t.startsWith('Chào anh/chị, chủ nhà nhờ') && !/undefined|null/.test(t)); });

console.log('Dữ liệu sang biểu mẫu duyệt và tìm trùng');
const sd = { fullName: 'Nguyễn Văn An', idNumber: '079201012345', dob: '05/03/1998', gender: 'Nam', hometown: 'Bình Định', address: 'TP.HCM', phone: '0911222333' };
test('điền sẵn các ô của biểu mẫu thêm khách', () => { const b = O.choBieuMau(sd); assert.strictEqual(b.fullName.value, 'Nguyễn Văn An'); assert.strictEqual(b.dateOfBirth.value, '05/03/1998'); assert.strictEqual(b.idNumber.confidence, 1); });
test('thiếu trường không ra "undefined"', () => assert.strictEqual(O.choBieuMau({}).hometown.value, ''));
test('trùng CCCD với khách đã có', () => assert.strictEqual(O.trungNguoi(sd, [{ id: 't1', idNumber: '079 201 012 345', phone: '0900000000' }]).theoCccd.id, 't1'));
test('trùng số điện thoại với người KHÁC', () => assert.strictEqual(O.trungNguoi(sd, [{ id: 't2', idNumber: '111111111111', phone: '+84 911 222 333' }]).theoSdt.id, 't2'));
test('cùng số điện thoại nhưng cùng CCCD là cùng một người, không báo trùng số', () => assert.strictEqual(O.trungNguoi(sd, [{ id: 't1', idNumber: '079201012345', phone: '0911222333' }]).theoSdt, null));
test('không trùng ai', () => { const r = O.trungNguoi(sd, [{ id: 't3', idNumber: '222222222222', phone: '0988888888' }]); assert.strictEqual(r.theoCccd, null); assert.strictEqual(r.theoSdt, null); });
test('danh sách rỗng hoặc null không lỗi', () => { assert.strictEqual(O.trungNguoi(sd, null).theoCccd, null); assert.strictEqual(O.trungNguoi({}, [{ idNumber: '', phone: '' }]).theoCccd, null); });

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

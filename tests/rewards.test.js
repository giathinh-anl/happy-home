/* Kiểm thử điểm thưởng đóng tiền đúng hạn (js/rewards.js).
   Chạy:  node tests/rewards.test.js */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const R = require('../js/rewards.js');
const SC = require('../js/scoring.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const ngay = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);
const ct = (loai, han, id) => ({ id: id || 'hd-' + han, loai, han: ngay(han) });
const BAT = { bat: true };
const tinh = (chiTiet, cauHinh, daDoi) => R.tinhDiem({ chiTiet, cauHinh: Object.assign({}, BAT, cauHinh), daDoi });
const dung = (...hans) => hans.map((h) => ct('dung-han', h));
const fmt = { tien: (n) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫' };

console.log('Cấu hình');
test('mặc định: tắt, 10 điểm, chuỗi 3 tháng thưởng 20, 1.000 ₫ mỗi điểm, bậc 100, tối đa 50%', () => {
  const c = R.chuanHoa(null); assert.deepStrictEqual(c, { bat: false, diemMoiHoaDon: 10, chuoi: 3, thuongChuoi: 20, tiLeDoi: 1000, buocDoi: 100, tran: 0.5, tuNgay: null });
});
test('hằng số mặc định đúng như tài liệu và đóng băng', () => { assert.deepStrictEqual(Object.assign({}, R.MAC_DINH), { bat: false, diemMoiHoaDon: 10, chuoi: 3, thuongChuoi: 20, tiLeDoi: 1000, buocDoi: 100, tran: 0.5, tuNgay: null }); assert.ok(Object.isFrozen(R.MAC_DINH)); });
test('số lẻ ở trường phải nguyên thì rơi về mặc định, số lẻ ở trần thì giữ', () => { assert.strictEqual(R.chuanHoa({ diemMoiHoaDon: 12.5 }).diemMoiHoaDon, 10); assert.strictEqual(R.chuanHoa({ chuoi: 3.5 }).chuoi, 3); assert.strictEqual(R.chuanHoa({ tran: 0.75 }).tran, 0.75); });
test('chỉ bật khi bat === true đúng nghĩa (chuỗi "true", 1 không tính)', () => { assert.strictEqual(R.chuanHoa({ bat: true }).bat, true); assert.strictEqual(R.chuanHoa({ bat: 'true' }).bat, false); assert.strictEqual(R.chuanHoa({ bat: 1 }).bat, false); });
test('giá trị hỏng hoặc thiếu rơi về mặc định, giá trị đúng được giữ', () => {
  const c = R.chuanHoa({ diemMoiHoaDon: 25, chuoi: 'abc', thuongChuoi: -5, tiLeDoi: 500, buocDoi: 0, tran: 2, tuNgay: '2026-13-45' });
  assert.deepStrictEqual([c.diemMoiHoaDon, c.chuoi, c.thuongChuoi, c.tiLeDoi, c.buocDoi, c.tran, c.tuNgay], [25, 3, 20, 500, 100, 0.5, null]);
});
test('thưởng chuỗi 0 là hợp lệ (tắt thưởng chuỗi), rỗng / null thì lấy mặc định', () => {
  assert.strictEqual(R.chuanHoa({ thuongChuoi: 0 }).thuongChuoi, 0); assert.strictEqual(R.chuanHoa({ thuongChuoi: '' }).thuongChuoi, 20); assert.strictEqual(R.chuanHoa({ thuongChuoi: null }).thuongChuoi, 20);
});
test('ngày bắt đầu đúng được giữ, ngày không có thật (30/2) bị bỏ', () => { assert.strictEqual(R.chuanHoa({ tuNgay: '2026-10-01' }).tuNgay, '2026-10-01'); assert.strictEqual(R.chuanHoa({ tuNgay: '2026-02-30' }).tuNgay, null); });
test('không sửa đối tượng truyền vào', () => { const c = { bat: true }; R.chuanHoa(c); assert.deepStrictEqual(c, { bat: true }); });
test('kiểm cấu hình: mặc định hợp lệ', () => assert.strictEqual(R.kiemCauHinh({}), ''));
[['diemMoiHoaDon', [0, 1001, 1.5, 'abc', '', null], [1, 1000]], ['chuoi', [1, 13, 2.5, ''], [2, 12]], ['thuongChuoi', [-1, 1001, 1.5, ''], [0, 1000]],
 ['tiLeDoi', [99, 100001, 500.5, ''], [100, 100000]], ['buocDoi', [0, 10001, 1.5, ''], [1, 10000]], ['tran', [0.09, 1.01, 'abc', ''], [0.1, 1]]].forEach(([k, xau, tot]) => {
  test(`kiểm cấu hình ${k}: từ chối ${JSON.stringify(xau)}, nhận hai đầu ${JSON.stringify(tot)}`, () => {
    xau.forEach((v) => assert.notStrictEqual(R.kiemCauHinh({ [k]: v }), '', 'nhận nhầm: ' + JSON.stringify(v)));
    tot.forEach((v) => assert.strictEqual(R.kiemCauHinh({ [k]: v }), '', 'từ chối nhầm: ' + v));
  });
});
test('kiểm cấu hình ngày: bỏ trống được, sai thì từ chối', () => {
  [null, '', undefined, '2026-10-01'].forEach((v) => assert.strictEqual(R.kiemCauHinh({ tuNgay: v }), ''));
  ['2026-02-30', 'abc', '01/10/2026', 5].forEach((v) => assert.notStrictEqual(R.kiemCauHinh({ tuNgay: v }), ''));
});

console.log('\nTính điểm');
test('mỗi hóa đơn đúng hạn được 10 điểm', () => { const t = tinh(dung('2026-08-05', '2026-09-05')); assert.deepStrictEqual([t.tong, t.soDu, t.soKyDungHan], [20, 20, 2]); });
test('đủ 3 tháng liền thưởng thêm 20 điểm', () => { const t = tinh(dung('2026-07-05', '2026-08-05', '2026-09-05')); assert.deepStrictEqual([t.tong, t.soLanThuongChuoi, t.chuoiHienTai], [50, 1, 3]); });
test('6 tháng liền thưởng chuỗi hai lần (mỗi bội số của 3)', () => {
  const t = tinh(dung('2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05')); assert.deepStrictEqual([t.tong, t.soLanThuongChuoi], [100, 2]);
});
test('trả trễ làm chuỗi về 0, điểm đã có vẫn giữ', () => {
  const t = tinh([ct('dung-han', '2026-06-05'), ct('dung-han', '2026-07-05'), ct('tra-tre', '2026-08-05'), ct('dung-han', '2026-09-05')]);
  assert.deepStrictEqual([t.tong, t.chuoiHienTai, t.soLanThuongChuoi], [30, 1, 0]);
});
test('quá hạn chưa trả đủ cũng cắt chuỗi, và hóa đơn trễ không được điểm', () => {
  const t = tinh([ct('dung-han', '2026-07-05'), ct('dung-han', '2026-08-05'), ct('qua-han', '2026-09-05')]); assert.deepStrictEqual([t.tong, t.chuoiHienTai, t.soLanThuongChuoi], [20, 0, 0]);
});
test('hai tháng đúng hạn, trễ, rồi ba tháng đúng hạn: chuỗi đếm lại từ 0, chỉ thưởng khi đủ 3 mới', () => {
  const t = tinh([ct('dung-han', '2026-01-05'), ct('dung-han', '2026-02-05'), ct('tra-tre', '2026-03-05'), ct('dung-han', '2026-04-05'), ct('dung-han', '2026-05-05'), ct('dung-han', '2026-06-05')]);
  assert.deepStrictEqual([t.tong, t.soLanThuongChuoi, t.chuoiHienTai], [20 + 30 + 20, 1, 3]);
});
test('thứ tự đầu vào không quan trọng: luôn tính theo hạn cũ trước mới sau', () => {
  const xuoi = [ct('tra-tre', '2026-06-05'), ct('dung-han', '2026-07-05'), ct('dung-han', '2026-08-05'), ct('dung-han', '2026-09-05')];
  const a = tinh(xuoi.slice().reverse()), b = tinh(xuoi);
  assert.deepStrictEqual([a.tong, a.chuoiHienTai, a.soLanThuongChuoi], [50, 3, 1]); assert.deepStrictEqual([b.tong, b.chuoiHienTai], [a.tong, a.chuoiHienTai]);
  assert.deepStrictEqual(a.sach.map((s) => s.ngay), b.sach.map((s) => s.ngay));
});
test('chưa tới hạn và không rõ ngày trả: không được điểm và KHÔNG cắt chuỗi', () => {
  const t = tinh([ct('dung-han', '2026-06-05'), ct('khong-ro-ngay', '2026-07-05'), ct('chua-den-han', '2026-12-05'), ct('dung-han', '2026-08-05'), ct('dung-han', '2026-09-05')]);
  assert.deepStrictEqual([t.tong, t.chuoiHienTai, t.soLanThuongChuoi], [50, 3, 1]);
});
test('thưởng chuỗi đặt 0 thì chỉ có điểm mỗi hóa đơn, sổ cái không có khoản chuỗi', () => {
  const t = tinh(dung('2026-07-05', '2026-08-05', '2026-09-05'), { thuongChuoi: 0 });
  assert.deepStrictEqual([t.tong, t.soLanThuongChuoi, t.sach.filter((s) => s.loai === 'chuoi').length], [30, 0, 0]);
});
test('đổi cấu hình: 25 điểm mỗi hóa đơn, chuỗi 2 tháng thưởng 5', () => assert.strictEqual(tinh(dung('2026-08-05', '2026-09-05'), { diemMoiHoaDon: 25, chuoi: 2, thuongChuoi: 5 }).tong, 55));
test('chỉ tính hóa đơn có hạn từ ngày bắt đầu chương trình (hai đầu: đúng ngày bắt đầu tính, hôm trước không tính)', () => {
  const t = tinh(dung('2026-08-31', '2026-09-01', '2026-10-01'), { tuNgay: '2026-09-01' }); assert.deepStrictEqual([t.tong, t.soKyDungHan], [20, 2]);
});
test('chưa đặt ngày bắt đầu thì tính mọi hóa đơn', () => assert.strictEqual(tinh(dung('2020-01-05', '2026-09-05')).soKyDungHan, 2));
test('điểm đã đổi được trừ; số dư không bao giờ âm', () => {
  const t = tinh(dung('2026-07-05', '2026-08-05', '2026-09-05'), {}, 30); assert.deepStrictEqual([t.tong, t.daDoi, t.soDu, t.thieu], [50, 30, 20, 0]);
  const q = tinh(dung('2026-09-05'), {}, 100); assert.deepStrictEqual([q.soDu, q.thieu], [0, 90]);
});
test('số điểm đã đổi hỏng (chữ, âm) coi như 0', () => { assert.strictEqual(tinh(dung('2026-09-05'), {}, 'abc').soDu, 10); assert.strictEqual(tinh(dung('2026-09-05'), {}, -50).soDu, 10); });
test('còn mấy tháng đúng hạn nữa thì được thưởng chuỗi', () => {
  assert.strictEqual(tinh([]).conThieu, 3); assert.strictEqual(tinh(dung('2026-08-05')).conThieu, 2); assert.strictEqual(tinh(dung('2026-07-05', '2026-08-05')).conThieu, 1);
  assert.strictEqual(tinh(dung('2026-07-05', '2026-08-05', '2026-09-05')).conThieu, 3);
});
test('sổ cái: từng khoản cộng điểm, cũ trước, có ngày và loại', () => {
  const t = tinh(dung('2026-07-05', '2026-08-05', '2026-09-05'));
  assert.deepStrictEqual(t.sach.map((s) => [s.loai, s.diem, s.ngay]), [['dung-han', 10, '2026-07-05'], ['dung-han', 10, '2026-08-05'], ['dung-han', 10, '2026-09-05'], ['chuoi', 20, '2026-09-05']]);
  assert.strictEqual(t.sach[3].soThang, 3);
});
test('tổng điểm bằng tổng sổ cái', () => { const t = tinh(dung('2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05')); assert.strictEqual(t.sach.reduce((s, x) => s + x.diem, 0), t.tong); });
test('không có hóa đơn nào, hoặc dữ liệu hỏng: 0 điểm, không văng', () => {
  [undefined, null, [], [null, undefined, {}, { loai: 'dung-han' }]].forEach((c) => { const t = R.tinhDiem({ chiTiet: c, cauHinh: BAT }); assert.strictEqual(t.tong, 0); });
  assert.strictEqual(R.tinhDiem().tong, 0);
});
test('hóa đơn thiếu hạn (han không phải số) không được tính, dù có hay không có ngày bắt đầu', () => {
  assert.strictEqual(tinh([{ id: 'x', loai: 'dung-han', han: undefined }], { tuNgay: '2026-01-01' }).tong, 0);
  assert.strictEqual(tinh([{ id: 'x', loai: 'dung-han', han: NaN }, { id: 'y', loai: 'dung-han', han: null }]).tong, 0);
});

console.log('\nTích hợp với điểm thanh toán thật (js/scoring.js)');
const hd = (id, han, total, paid) => ({ id, total, paid, status: paid >= total ? 'paid' : 'issued', dueDate: han });
const phieu = (m) => (i) => (m[i.id] || []).map((d) => ({ date: d }));
const chiTietThat = (ds, p, homNay) => SC.tinh(ds, phieu(p), homNay).chiTiet;
test('hóa đơn trả đủ đúng hạn / trễ / quá hạn từ scoring ra đúng điểm', () => {
  const ds = [hd('a', '2026-07-05', 100, 100), hd('b', '2026-08-05', 100, 100), hd('c', '2026-09-05', 100, 0)];
  const ctt = chiTietThat(ds, { a: ['2026-07-04'], b: ['2026-08-09'] }, '2026-10-20');
  const t = R.tinhDiem({ chiTiet: ctt, cauHinh: BAT }); assert.deepStrictEqual([t.tong, t.soKyDungHan, t.chuoiHienTai], [10, 1, 0]);
});
test('trả đúng ngày hạn tính là đúng hạn', () => {
  const t = R.tinhDiem({ chiTiet: chiTietThat([hd('a', '2026-07-05', 100, 100)], { a: ['2026-07-05'] }, '2026-10-20'), cauHinh: BAT }); assert.strictEqual(t.tong, 10);
});
test('đã trả đủ nhưng không có phiếu thu ghi ngày: không đoán là đúng hạn', () => {
  assert.strictEqual(R.tinhDiem({ chiTiet: chiTietThat([hd('a', '2026-07-05', 100, 100)], {}, '2026-10-20'), cauHinh: BAT }).tong, 0);
});

console.log('\nĐã đổi bao nhiêu điểm');
const hdon = (st, ...lines) => ({ status: st, lines });
const rw = (p) => ({ type: 'reward', points: p, amount: -p * 1000 });
test('cộng điểm của các dòng thưởng trên mọi hóa đơn', () => assert.strictEqual(R.diemDaDoi([hdon('issued', { type: 'elec', amount: 5 }, rw(100)), hdon('paid', rw(50))]), 150));
test('hóa đơn đã hủy thì điểm được trả lại (không tính)', () => assert.strictEqual(R.diemDaDoi([hdon('cancelled', rw(100)), hdon('issued', rw(30))]), 30));
test('dòng không phải thưởng, dòng hỏng, hóa đơn thiếu lines: bỏ qua', () => {
  assert.strictEqual(R.diemDaDoi([hdon('issued', { type: 'latefee', points: 99 }, null, undefined, { type: 'reward' }, { type: 'reward', points: 'x' }), { status: 'issued' }, null, undefined]), 0);
});
test('điểm âm trên dòng hỏng không làm giảm tổng', () => assert.strictEqual(R.diemDaDoi([hdon('issued', { type: 'reward', points: -500 }, rw(100))]), 100));
test('rỗng: 0', () => { assert.strictEqual(R.diemDaDoi([]), 0); assert.strictEqual(R.diemDaDoi(), 0); });

console.log('\nĐổi điểm thành giảm giá');
const doi = (o) => R.doiDiem(Object.assign({ soDu: 250, diem: 100, cauHinh: BAT, conPhaiThu: 3000000, fmt }, o));
test('đổi 100 điểm = giảm 100.000 ₫, ra dòng giảm giá mang số điểm', () => {
  const r = doi({}); assert.strictEqual(r.ok, true);
  assert.deepStrictEqual([r.diem, r.tien, r.dong.amount, r.dong.type, r.dong.points], [100, 100000, -100000, 'reward', 100]);
  assert.ok(r.dong.label.indexOf('100 điểm') >= 0); assert.ok(r.dong.meta.indexOf('1.000') >= 0);
});
test('tỉ lệ đổi theo cấu hình', () => assert.strictEqual(doi({ cauHinh: { bat: true, tiLeDoi: 2000 } }).tien, 200000));
test('chương trình tắt thì không đổi được', () => { const r = doi({ cauHinh: { bat: false } }); assert.strictEqual(r.ok, false); assert.ok(r.loi.indexOf('tắt') >= 0); });
test('số điểm không hợp lệ bị từ chối: 0, âm, lẻ, chữ, rỗng', () => {
  [0, -100, 150.5, 'abc', '', null, undefined].forEach((d) => assert.strictEqual(doi({ diem: d }).ok, false, 'nhận nhầm: ' + d));
  ['abc', '', null, undefined, 0, -5].forEach((d) => assert.ok(doi({ diem: d }).loi.indexOf('Nhập số điểm') >= 0, 'lời nhắn sai cho: ' + d));
  assert.ok(doi({ diem: 150.5 }).loi.indexOf('Nhập số điểm') >= 0 || doi({ diem: 150.5 }).loi.indexOf('bậc') >= 0);
  assert.ok(doi({ diem: 0.5, cauHinh: { bat: true, buocDoi: 1 } }).ok === false);
});
test('phải đổi theo bậc 100: 150 bị từ chối, 200 được', () => { assert.strictEqual(doi({ diem: 150 }).ok, false); assert.strictEqual(doi({ diem: 200 }).ok, true); });
test('bậc đổi theo cấu hình', () => { assert.strictEqual(doi({ diem: 50, cauHinh: { bat: true, buocDoi: 50 } }).ok, true); assert.strictEqual(doi({ diem: 75, cauHinh: { bat: true, buocDoi: 50 } }).ok, false); });
test('đổi nhiều hơn số dư bị từ chối kèm số còn lại; hết sạch thì nói chưa có điểm', () => {
  const r = doi({ diem: 300 }); assert.strictEqual(r.ok, false); assert.ok(r.loi.indexOf('250') >= 0);
  assert.ok(doi({ soDu: 0 }).loi.indexOf('Chưa có điểm') >= 0);
});
test('đổi đúng bằng số dư là được', () => assert.strictEqual(doi({ soDu: 200, diem: 200 }).ok, true));
test('tối đa 50% số còn phải thu: hóa đơn 300.000 chỉ đổi tối đa 100 điểm (150.000 ÷ 1.000 = 150, làm tròn bậc 100)', () => {
  assert.strictEqual(doi({ conPhaiThu: 300000, diem: 100 }).ok, true);
  const r = doi({ conPhaiThu: 300000, diem: 200, soDu: 500 }); assert.strictEqual(r.ok, false); assert.strictEqual(r.toiDa, 100); assert.ok(r.loi.indexOf('50%') >= 0);
});
test('hóa đơn còn quá ít để đổi một bậc thì từ chối rõ ràng', () => { const r = doi({ conPhaiThu: 150000 }); assert.strictEqual(r.ok, false); assert.strictEqual(r.toiDa, 0); assert.ok(r.loi.indexOf('quá ít') >= 0, r.loi); });
test('trần theo cấu hình (100% cho phép giảm hết)', () => assert.strictEqual(doi({ conPhaiThu: 100000, diem: 100, cauHinh: { bat: true, tran: 1 } }).ok, true));
test('hóa đơn đã trả đủ (còn phải thu 0) không đổi được', () => assert.strictEqual(doi({ conPhaiThu: 0 }).ok, false));
test('tối đa đổi được: theo số dư, theo trần, làm tròn xuống bậc', () => {
  const m = (o) => R.toiDaDoi(Object.assign({ soDu: 250, conPhaiThu: 3000000, cauHinh: BAT }, o));
  assert.strictEqual(m({}), 200); assert.strictEqual(m({ soDu: 1000 }), 1000); assert.strictEqual(m({ conPhaiThu: 300000 }), 100); assert.strictEqual(m({ conPhaiThu: 0 }), 0); assert.strictEqual(m({ soDu: 99 }), 0);
});
test('đã đổi rồi đổi tiếp: số dư mới nhỏ đi nên giới hạn đi theo', () => {
  const t = tinh(dung('2026-07-05', '2026-08-05', '2026-09-05'));            // 50 điểm
  const cauHinh = { bat: true, buocDoi: 10 };
  assert.strictEqual(R.doiDiem({ soDu: t.soDu, diem: 50, cauHinh, conPhaiThu: 3000000 }).ok, true);
  assert.strictEqual(R.doiDiem({ soDu: t.soDu - 50, diem: 10, cauHinh, conPhaiThu: 3000000 }).ok, false);
});

console.log('\nTin nhắn báo điểm');
test('tin nhắn gọi tên, nêu phòng, số điểm, mức đổi và thưởng chuỗi', () => {
  const t = R.soanTin({ ten: 'Nguyễn Văn An', phong: '101', soDu: 230, cauHinh: BAT, fmt });
  ['An', '101', '230 điểm', '100 điểm', '100.000', '3 tháng', '20 điểm'].forEach((x) => assert.ok(t.indexOf(x) >= 0, 'thiếu: ' + x));
});
test('chưa đủ điểm đổi thì nói cần bao nhiêu', () => { const t = R.soanTin({ ten: 'An', soDu: 40, cauHinh: BAT, fmt }); assert.ok(t.indexOf('đủ 100 điểm') >= 0); assert.ok(t.indexOf('bạn nhắn lại') < 0); });
test('thưởng chuỗi tắt thì không nhắc chuỗi', () => assert.ok(R.soanTin({ ten: 'An', soDu: 40, cauHinh: { bat: true, thuongChuoi: 0 }, fmt }).indexOf('liền') < 0));
test('thiếu tên thì gọi "bạn"; tên một chữ; thiếu phòng thì bỏ phần phòng', () => {
  assert.ok(R.soanTin({ soDu: 10, cauHinh: BAT }).indexOf('Chào bạn') === 0); assert.ok(R.soanTin({ ten: 'Hoa', soDu: 10, cauHinh: BAT }).indexOf('Chào Hoa') === 0);
  assert.ok(R.soanTin({ ten: 'Hoa', soDu: 10, cauHinh: BAT }).indexOf('phòng  ') < 0);
});
test('không có tham số vẫn ra được câu', () => assert.ok(R.soanTin().length > 20));

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

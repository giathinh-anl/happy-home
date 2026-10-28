/* Kiểm thử tiến độ xử lý sự cố (js/progress.js).
   Chạy:  node tests/progress.test.js */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const P = require('../js/progress.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const HN = new Date(2026, 9, 20, 14, 0);                            // 20/10/2026 14:00
const at = (d, h) => new Date(2026, 9, d, h || 9, 0).toISOString();
const sc = (o) => Object.assign({ id: 'sc1', status: 'open', createdAt: at(10), history: [] }, o || {});
const dung = (r) => { assert.ok(r.ok, r.loi); return r.patch; };

console.log('Dòng thời gian');
test('sự cố mới không có history vẫn bắt đầu bằng "Đã tiếp nhận" đúng ngày báo', () => {
  const tl = P.dongThoiGian(sc());
  assert.deepStrictEqual(tl.map(e => e.loai), ['tiep-nhan']); assert.strictEqual(tl[0].at, at(10));
});
test('sự cố cũ đang xử lý (không history): bù mốc bắt đầu không có giờ', () => {
  const tl = P.dongThoiGian(sc({ status: 'processing' }));
  assert.deepStrictEqual(tl.map(e => e.loai), ['tiep-nhan', 'bat-dau']); assert.strictEqual(tl[1].at, null);
});
test('sự cố cũ đã xong: đủ ba mốc, mốc hoàn tất lấy ngày xong nếu có', () => {
  const tl = P.dongThoiGian(sc({ status: 'done', doneAt: at(15) }));
  assert.deepStrictEqual(tl.map(e => e.loai), ['tiep-nhan', 'bat-dau', 'hoan-tat']); assert.strictEqual(tl[2].at, at(15));
});
test('sự kiện xếp theo thời gian dù lưu lộn xộn', () => {
  const h = [P.suKien('hoan-tat', { at: at(15) }), P.suKien('bat-dau', { at: at(12) }), P.suKien('ghi-chu', { at: at(13), ghiChu: 'đã gọi thợ' })];
  assert.deepStrictEqual(P.dongThoiGian(sc({ status: 'done', history: h })).map(e => e.loai), ['tiep-nhan', 'bat-dau', 'ghi-chu', 'hoan-tat']);
});
test('không bù mốc trùng khi history đã có đủ', () => {
  const h = [P.suKien('tiep-nhan', { at: at(10) }), P.suKien('bat-dau', { at: at(11) })];
  assert.deepStrictEqual(P.dongThoiGian(sc({ status: 'processing', history: h })).map(e => e.loai), ['tiep-nhan', 'bat-dau']);
});
test('hẹn thợ cũng là mốc bắt đầu xử lý: không bù thêm mốc "bắt đầu" không có giờ', () => {
  const h = [P.suKien('hen-tho', { at: at(12), ngayHen: '2026-10-22' })];
  assert.deepStrictEqual(P.dongThoiGian(sc({ status: 'processing', history: h })).map(e => e.loai), ['tiep-nhan', 'hen-tho']);
});
test('sự kiện hỏng (thiếu loại, ngày rác) bị bỏ qua, không làm vỡ', () => {
  const tl = P.dongThoiGian(sc({ history: [null, { loai: 'abc', at: at(11) }, { loai: 'ghi-chu', at: 'rác' }, P.suKien('ghi-chu', { at: at(12), ghiChu: 'ok' })] }));
  assert.deepStrictEqual(tl.map(e => e.loai), ['tiep-nhan', 'ghi-chu']);
});
test('history không phải mảng cũng không vỡ', () => assert.strictEqual(P.dongThoiGian(sc({ history: 'x' })).length, 1));

console.log('Công khai / nội bộ');
test('ghi chú mặc định là nội bộ, sự kiện trạng thái mặc định công khai', () => {
  assert.strictEqual(P.suKien('ghi-chu', { ghiChu: 'a' }).congKhai, false);
  ['tiep-nhan', 'bat-dau', 'hen-tho', 'hoan-tat', 'mo-lai'].forEach(l => assert.strictEqual(P.suKien(l).congKhai, true, l));
});
test('chọn cho khách thấy ghi chú thì công khai', () => assert.strictEqual(P.suKien('ghi-chu', { ghiChu: 'a', congKhai: true }).congKhai, true));
test('ghi chú quá dài bị cắt 500 ký tự', () => assert.strictEqual(P.suKien('ghi-chu', { ghiChu: 'x'.repeat(900) }).ghiChu.length, 500));

console.log('Cập nhật tiến độ');
test('bắt đầu xử lý: chuyển sang processing và ghi sự kiện', () => {
  const p = dung(P.capNhat(sc(), { loai: 'bat-dau', at: at(11) }, HN));
  assert.strictEqual(p.status, 'processing'); assert.strictEqual(p.history.length, 1); assert.strictEqual(p.history[0].loai, 'bat-dau');
});
test('không sửa sự cố gốc', () => { const g = sc(); P.capNhat(g, { loai: 'bat-dau' }, HN); assert.strictEqual(g.status, 'open'); assert.strictEqual(g.history.length, 0); });
test('đang xử lý rồi thì không bắt đầu lại', () => assert.strictEqual(P.capNhat(sc({ status: 'processing' }), { loai: 'bat-dau' }, HN).ok, false));
test('hẹn thợ: lưu ngày hẹn, tên và số điện thoại thợ, tự sang đang xử lý', () => {
  const p = dung(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: '2026-10-22', tho: 'Anh Hùng', thoSdt: '0911222333' }, HN));
  assert.strictEqual(p.scheduledFor, '2026-10-22'); assert.strictEqual(p.assignee, 'Anh Hùng'); assert.strictEqual(p.assigneePhone, '0911222333'); assert.strictEqual(p.status, 'processing');
});
test('hẹn thợ hôm nay được, hôm qua thì không', () => {
  assert.ok(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: '2026-10-20' }, HN).ok);
  assert.strictEqual(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: '2026-10-19' }, HN).ok, false);
});
test('hẹn thợ: ngày rác hoặc xa quá 6 tháng bị từ chối', () => {
  assert.strictEqual(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: 'mai' }, HN).ok, false);
  assert.strictEqual(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: '2027-12-01' }, HN).ok, false);
  assert.strictEqual(P.capNhat(sc(), { loai: 'hen-tho' }, HN).ok, false);
});
test('hẹn lại không xóa tên thợ cũ nếu lần này không nhập', () => {
  const a = dung(P.capNhat(sc(), { loai: 'hen-tho', ngayHen: '2026-10-22', tho: 'Anh Hùng' }, HN));
  const p = dung(P.capNhat(sc(a), { loai: 'hen-tho', ngayHen: '2026-10-24' }, HN));
  assert.strictEqual(p.assignee, undefined); assert.strictEqual(p.scheduledFor, '2026-10-24');   // patch chỉ chứa thứ đổi; gộp vào sự cố thì tên cũ còn
});
test('không hẹn thợ cho sự cố đã xong', () => assert.strictEqual(P.capNhat(sc({ status: 'done' }), { loai: 'hen-tho', ngayHen: '2026-10-22' }, HN).ok, false));
test('ghi chú rỗng hoặc quá ngắn bị từ chối, ghi chú hợp lệ không đổi trạng thái', () => {
  assert.strictEqual(P.capNhat(sc(), { loai: 'ghi-chu', ghiChu: '  ' }, HN).ok, false);
  assert.strictEqual(P.capNhat(sc(), { loai: 'ghi-chu', ghiChu: 'ab' }, HN).ok, false);
  assert.strictEqual(dung(P.capNhat(sc(), { loai: 'ghi-chu', ghiChu: 'chờ vật tư' }, HN)).status, 'open');
});
test('hoàn tất: ghi ngày xong, chi phí và người chịu', () => {
  const p = dung(P.capNhat(sc({ status: 'processing' }), { loai: 'hoan-tat', at: at(18), chiPhi: 350000, nguoiChiu: 'khach' }, HN));
  assert.strictEqual(p.status, 'done'); assert.strictEqual(p.doneAt, at(18)); assert.strictEqual(p.cost, 350000); assert.strictEqual(p.costPayer, 'khach');
});
test('hoàn tất không nhập chi phí thì không ghi chi phí', () => { const p = dung(P.capNhat(sc(), { loai: 'hoan-tat' }, HN)); assert.strictEqual(p.cost, undefined); });
test('chi phí âm, có số lẻ, hoặc quá 1 tỷ bị từ chối', () => {
  [-1, 1.5, 2e9, 'abc'].forEach(c => assert.strictEqual(P.capNhat(sc(), { loai: 'hoan-tat', chiPhi: c }, HN).ok, false, String(c)));
});
test('chi phí 0 hợp lệ (sửa miễn phí)', () => assert.strictEqual(dung(P.capNhat(sc(), { loai: 'hoan-tat', chiPhi: 0 }, HN)).cost, 0));
test('mặc định chủ trọ chịu chi phí', () => assert.strictEqual(dung(P.capNhat(sc(), { loai: 'hoan-tat', chiPhi: 100000 }, HN)).costPayer, 'chu'));
test('đã xong thì không hoàn tất lần nữa', () => assert.strictEqual(P.capNhat(sc({ status: 'done' }), { loai: 'hoan-tat' }, HN).ok, false));
test('mở lại: về open, xóa ngày xong; chỉ mở lại sự cố đã xong', () => {
  const p = dung(P.capNhat(sc({ status: 'done', doneAt: at(15) }), { loai: 'mo-lai', ghiChu: 'vẫn rò nước' }, HN));
  assert.strictEqual(p.status, 'open'); assert.strictEqual(p.doneAt, null);
  assert.strictEqual(P.capNhat(sc(), { loai: 'mo-lai' }, HN).ok, false);
});
test('việc lạ bị từ chối', () => assert.strictEqual(P.capNhat(sc(), { loai: 'xoa-het' }, HN).ok, false));
test('chuỗi sự kiện cộng dồn vào history theo thứ tự', () => {
  let g = sc();
  g = Object.assign({}, g, dung(P.capNhat(g, { loai: 'bat-dau', at: at(11) }, HN)));
  g = Object.assign({}, g, dung(P.capNhat(g, { loai: 'hen-tho', ngayHen: '2026-10-22', at: at(12) }, HN)));
  g = Object.assign({}, g, dung(P.capNhat(g, { loai: 'hoan-tat', at: at(14), chiPhi: 200000 }, HN)));
  assert.deepStrictEqual(g.history.map(e => e.loai), ['bat-dau', 'hen-tho', 'hoan-tat']); assert.strictEqual(g.status, 'done');
});

console.log('Ba bước cho khách');
test('mới báo: chỉ bước 1 xong', () => assert.deepStrictEqual(P.buocTienDo(sc()).map(b => [b.xong, b.dangLam]), [[true, false], [false, false], [false, false]]));
test('đang xử lý: bước 2 đang làm', () => assert.deepStrictEqual(P.buocTienDo(sc({ status: 'processing' })).map(b => [b.xong, b.dangLam]), [[true, false], [true, true], [false, false]]));
test('đã xong: cả ba xong, bước cuối có giờ hoàn tất, không còn đang làm', () => {
  const b = P.buocTienDo(sc({ status: 'done', doneAt: at(15) }));
  assert.deepStrictEqual(b.map(x => [x.xong, x.dangLam]), [[true, false], [true, false], [true, false]]); assert.strictEqual(b[2].at, at(15));
});
test('mở lại sau khi đã xong: bước hoàn tất trống, không còn giờ cũ', () => {
  const h = [P.suKien('bat-dau', { at: at(12) }), P.suKien('hoan-tat', { at: at(14) }), P.suKien('mo-lai', { at: at(16) })];
  const b = P.buocTienDo(sc({ status: 'open', history: h }));
  assert.strictEqual(b[2].xong, false); assert.strictEqual(b[2].at, null);
});
test('mỗi bước mang giờ của chính mốc đó, không lấy giờ báo cho cả ba', () => {
  const h = [P.suKien('bat-dau', { at: at(12) }), P.suKien('hoan-tat', { at: at(14) })];
  const b = P.buocTienDo(sc({ status: 'done', history: h }));
  assert.deepStrictEqual(b.map(x => x.at), [at(10), at(12), at(14)]);
});

console.log('Lịch hẹn thợ');
test('lấy lần hẹn gần nhất, kèm thợ và số điện thoại', () => {
  const h = [P.suKien('hen-tho', { at: at(11), ngayHen: '2026-10-21', tho: 'Anh A' }), P.suKien('hen-tho', { at: at(12), ngayHen: '2026-10-25', tho: 'Anh Hùng', thoSdt: '0911222333' })];
  assert.deepStrictEqual(P.lichHen(sc({ status: 'processing', history: h })), { ngayHen: '2026-10-25', tho: 'Anh Hùng', thoSdt: '0911222333' });
});
test('chưa từng hẹn thì không có lịch', () => assert.strictEqual(P.lichHen(sc({ status: 'processing' })), null));
test('sự cố đã xong thì không còn lịch hẹn', () => assert.strictEqual(P.lichHen(sc({ status: 'done', history: [P.suKien('hen-tho', { at: at(12), ngayHen: '2026-10-25' })] })), null));
test('thiếu tên thợ vẫn trả lịch, tên rỗng', () => assert.deepStrictEqual(P.lichHen(sc({ status: 'processing', history: [P.suKien('hen-tho', { at: at(12), ngayHen: '2026-10-25' })] })), { ngayHen: '2026-10-25', tho: '', thoSdt: '' }));

console.log('Tình trạng và chi phí');
test('số ngày mở tính theo ngày lịch', () => assert.strictEqual(P.tinhTrang(sc(), HN).soNgayMo, 10));
test('mở quá 7 ngày là quá lâu, đúng 7 ngày thì chưa', () => {
  assert.strictEqual(P.tinhTrang(sc({ createdAt: at(13) }), HN).quaLau, false);
  assert.strictEqual(P.tinhTrang(sc({ createdAt: at(12) }), HN).quaLau, true);
});
test('đã xong thì không còn quá lâu, không tính ngày mở', () => { const t = P.tinhTrang(sc({ status: 'done' }), HN); assert.strictEqual(t.quaLau, false); assert.strictEqual(t.soNgayMo, 0); });
test('ngày tới lịch hẹn: hôm nay 0, ngày mai 1, quá hạn âm', () => {
  assert.strictEqual(P.tinhTrang(sc({ scheduledFor: '2026-10-20' }), HN).ngayToiHen, 0);
  assert.strictEqual(P.tinhTrang(sc({ scheduledFor: '2026-10-21' }), HN).ngayToiHen, 1);
  assert.strictEqual(P.tinhTrang(sc({ scheduledFor: '2026-10-19' }), HN).ngayToiHen, -1);
  assert.strictEqual(P.tinhTrang(sc(), HN).ngayToiHen, null);
});
const xong = (cost, d, payer, st) => ({ status: st || 'done', cost, doneAt: at(d), costPayer: payer });
test('tổng chi phí chủ trọ chịu trong khoảng, bỏ khoản khách chịu', () => {
  const ds = [xong(100000, 5), xong(200000, 12, 'chu'), xong(300000, 12, 'khach')];
  assert.strictEqual(P.tongChiPhi(ds, new Date(2026, 9, 1), new Date(2026, 9, 31)), 300000);
  assert.strictEqual(P.tongChiPhi(ds, new Date(2026, 9, 1), new Date(2026, 9, 31), 'khach'), 300000);
  assert.strictEqual(P.tongChiPhi(ds, new Date(2026, 9, 1), new Date(2026, 9, 31), 'tat-ca'), 600000);
});
test('chỉ tính sự cố đã xong và đúng khoảng ngày (biên hai đầu tính)', () => {
  const ds = [xong(100000, 1), xong(100000, 31), xong(100000, 5, null, 'processing'), { status: 'done', cost: 50000, doneAt: new Date(2026, 8, 30, 23, 0).toISOString() }];
  assert.strictEqual(P.tongChiPhi(ds, new Date(2026, 9, 1), new Date(2026, 9, 31)), 200000);
});
test('không có chi phí hoặc ngày xong thì không tính', () => assert.strictEqual(P.tongChiPhi([{ status: 'done', doneAt: at(5) }, { status: 'done', cost: 9, doneAt: null }], null, null), 0));

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

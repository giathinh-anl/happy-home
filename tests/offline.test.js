/* Kiểm thử ghi chỉ số khi mất mạng (js/offline.js): hàng đợi, đối chiếu máy chủ, ảnh chụp tối thiểu.
   Chạy:  node tests/offline.test.js */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const O = require('../js/offline.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const rd = (code, period, curr, o) => Object.assign({ id: 'rd-' + code + period, buildingId: 'b1', roomCode: code, period, elecPrev: 1000, elecCurr: curr, elecAvg: 190, source: 'staff', approved: true }, o || {});
const K = (code, period) => `b1|${code}|${period}`;
const P = '2026-10';

console.log('Chữ ký chỉ số');
test('chưa có bản ghi thì null, có bản ghi rỗng thì "|"', () => { assert.strictEqual(O.chuKy(null), null); assert.strictEqual(O.chuKy(rd('101', P, null)), '|'); });
test('ghép chỉ số mới và phần bù', () => { assert.strictEqual(O.chuKy(rd('101', P, 1250)), '1250|'); assert.strictEqual(O.chuKy(rd('101', P, 1250, { elecExtra: 300 })), '1250|300'); });
test('số dạng chữ và dạng số cho cùng chữ ký; giá trị không phải số coi như trống', () => {
  assert.strictEqual(O.chuKy(rd('101', P, '1250')), O.chuKy(rd('101', P, 1250)));
  assert.strictEqual(O.chuKy(rd('101', P, 'abc')), '|'); assert.strictEqual(O.chuKy(rd('101', P, '')), '|');
});
test('chỉ số 0 khác trống', () => assert.notStrictEqual(O.chuKy(rd('101', P, 0)), O.chuKy(rd('101', P, null))));
test('đổi chỉ số mới hoặc phần bù thì chữ ký đổi', () => {
  assert.notStrictEqual(O.chuKy(rd('101', P, 1250)), O.chuKy(rd('101', P, 1251)));
  assert.notStrictEqual(O.chuKy(rd('101', P, 1250)), O.chuKy(rd('101', P, 1250, { elecExtra: 5 })));
});
test('khóa dòng ghép tòa|phòng|kỳ', () => assert.strictEqual(O.khoa(rd('101', P, 1)), 'b1|101|2026-10'));

console.log('\nẢnh chụp tối thiểu');
const du = () => ({
  buildings: [{ id: 'b1', name: 'Happy Home 1', address: '12 Lê Lợi', ownerPhone: '0900000000' }],
  rooms: [{ id: 'r1', buildingId: 'b1', code: '101', status: 'occupied', tenantName: 'Nguyễn Văn A', floor: 1, photos: ['data:image/jpeg;base64,AAAA'], description: 'mô tả', price: 3000000 }],
  tenants: [{ id: 't1', fullName: 'Nguyễn Văn A', cccd: '079012345678', phone: '0911222333', dob: '1990-01-01', address: 'Bến Tre' }],
  invoices: [{ id: 'HD-2610-001', total: 4000000 }], contracts: [{ id: 'c1', rent: 3000000 }],
  readings: [rd('101', '2026-10', 1250, { photos: ['data:image/jpeg;base64,BBBB'] }), rd('101', '2026-09', 1100), rd('101', '2026-08', 950), rd('101', '2026-07', 800), rd('101', '2026-06', 650)],
});
test('chỉ giữ ba kỳ gần nhất', () => {
  const a = O.anhChup(du(), {});
  assert.deepStrictEqual(a.readings.map((r) => r.period).sort(), ['2026-08', '2026-09', '2026-10']);
});
test('không chứa CCCD, số điện thoại, ngày sinh, địa chỉ, ảnh, hóa đơn, tiền thuê', () => {
  const s = JSON.stringify(O.anhChup(du(), { owner: 'u1' }));
  ['079012345678', '0911222333', '1990-01-01', 'Bến Tre', 'Lê Lợi', '0900000000', 'base64', 'HD-2610', 'mô tả', '3000000', 'tenants', 'invoices'].forEach((x) => assert.ok(s.indexOf(x) < 0, 'lộ: ' + x));
});
test('vẫn giữ những gì trang ghi chỉ số cần: phòng, trạng thái, tên khách, chỉ số', () => {
  const a = O.anhChup(du(), { owner: 'u1', role: 'staff', permissions: ['readings'], userName: 'Hoa' });
  assert.deepStrictEqual(a.rooms[0], { id: 'r1', buildingId: 'b1', code: '101', status: 'occupied', tenantName: 'Nguyễn Văn A', floor: 1 });
  assert.strictEqual(a.buildings[0].name, 'Happy Home 1');
  assert.deepStrictEqual([a.owner, a.role, a.userName, a.permissions], ['u1', 'staff', 'Hoa', ['readings']]);
  const r = a.readings.find((x) => x.period === '2026-10'); assert.strictEqual(r.elecCurr, 1250); assert.strictEqual(r.elecPrev, 1000);
});
test('quyền được sao chép, sửa nguồn không làm đổi ảnh', () => {
  const q = ['readings']; const a = O.anhChup(du(), { permissions: q }); q.push('expenses'); assert.deepStrictEqual(a.permissions, ['readings']);
});
test('chỉ số khách tự gửi chưa duyệt vẫn giữ nguyên trạng thái chưa duyệt', () => {
  const d = du(); d.readings[0] = rd('101', '2026-10', 1250, { source: 'tenant', approved: false });
  const r = O.anhChup(d, {}).readings.find((x) => x.period === '2026-10'); assert.deepStrictEqual([r.source, r.approved], ['tenant', false]);
});
test('dữ liệu rỗng hoặc thiếu vẫn dựng được ảnh hợp lệ', () => { assert.ok(O.anhHopLe(O.anhChup({}, {}))); assert.ok(O.anhHopLe(O.anhChup(null))); });
test('ảnh dựng ra đọc lại được qua JSON', () => assert.ok(O.anhHopLe(JSON.parse(JSON.stringify(O.anhChup(du(), { owner: 'u1' }))))));

console.log('\nKiểm ảnh đọc từ bộ nhớ');
const tot = () => O.anhChup(du(), {});
test('ảnh hợp lệ được nhận', () => assert.ok(O.anhHopLe(tot())));
test('sai phiên bản, thiếu mảng, không phải đối tượng đều bị loại', () => {
  assert.strictEqual(O.anhHopLe(Object.assign(tot(), { v: 2 })), null);
  assert.strictEqual(O.anhHopLe(Object.assign(tot(), { rooms: null })), null);
  assert.strictEqual(O.anhHopLe(Object.assign(tot(), { readings: 'x' })), null);
  assert.strictEqual(O.anhHopLe(Object.assign(tot(), { buildings: {} })), null);
  [null, undefined, 5, 'x', []].forEach((x) => assert.strictEqual(O.anhHopLe(x), null));
});
test('phần tử hỏng bên trong bị loại cả ảnh', () => {
  let a = tot(); a.rooms.push(null); assert.strictEqual(O.anhHopLe(a), null);
  a = tot(); a.rooms.push({ id: 'r9', buildingId: 'b1' }); assert.strictEqual(O.anhHopLe(a), null);        // thiếu mã phòng
  a = tot(); a.readings.push({ id: 'x', buildingId: 'b1', roomCode: '1' }); assert.strictEqual(O.anhHopLe(a), null);   // thiếu kỳ
  a = tot(); a.buildings.push({ name: 'x' }); assert.strictEqual(O.anhHopLe(a), null);                      // thiếu id
});

console.log('\nTuổi của ảnh');
test('cùng ngày là 0, hai ngày là 2, làm tròn xuống', () => {
  const a = { at: '2026-10-20T08:00:00.000Z' };
  assert.strictEqual(O.tuoiAnh(a, '2026-10-20T20:00:00.000Z'), 0);
  assert.strictEqual(O.tuoiAnh(a, '2026-10-22T07:59:00.000Z'), 1);
  assert.strictEqual(O.tuoiAnh(a, '2026-10-22T08:00:00.000Z'), 2);
});
test('không biết thì null, không bao giờ âm', () => {
  assert.strictEqual(O.tuoiAnh({}, '2026-10-20'), null); assert.strictEqual(O.tuoiAnh({ at: 'rác' }, '2026-10-20'), null); assert.strictEqual(O.tuoiAnh(null), null);
  assert.strictEqual(O.tuoiAnh({ at: '2026-10-25T00:00:00Z' }, '2026-10-20T00:00:00Z'), 0);
});

console.log('\nHàng đợi chỉ số chưa gửi');
const goc = (...ds) => { const g = {}; ds.forEach(([c, p, v]) => { g[K(c, p)] = O.chuKy(rd(c, p, v)); }); return g; };
const AT = '2026-10-28T09:00:00.000Z';
test('trùng máy chủ thì không vào hàng đợi', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1250]), at: AT });
  assert.deepStrictEqual(h.items, []);
});
test('khác máy chủ thì vào hàng đợi, mốc base là số máy chủ lúc đó', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1180]), at: AT });
  assert.strictEqual(h.items.length, 1);
  const it = h.items[0]; assert.strictEqual(it.khoa, K('101', P)); assert.strictEqual(it.elecCurr, 1250); assert.strictEqual(it.sig, '1250|'); assert.strictEqual(it.base, '1180|'); assert.strictEqual(it.at, AT);
});
test('máy chủ chưa có dòng này thì base là null', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: {}, at: AT });
  assert.strictEqual(h.items[0].base, null);
});
test('dòng trống mới tạo, máy chủ chưa có: không có gì để gửi', () => {
  assert.deepStrictEqual(O.tinhHangDoi({ readings: [rd('101', P, null)], goc: {}, at: AT }).items, []);
});
test('xóa số đã có trên máy chủ thì vẫn là một thay đổi cần gửi', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, null)], goc: goc(['101', P, 1180]), at: AT });
  assert.strictEqual(h.items.length, 1); assert.strictEqual(h.items[0].elecCurr, null); assert.strictEqual(h.items[0].sig, '|');
});
test('sửa nhiều lần vẫn giữ mốc base lúc bắt đầu sửa', () => {
  const g = goc(['101', P, 1180]);
  const h1 = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: g, at: AT });
  const h2 = O.tinhHangDoi({ readings: [rd('101', P, 1260)], goc: g, doc: h1, at: '2026-10-28T10:00:00.000Z' });
  assert.strictEqual(h2.items[0].base, '1180|'); assert.strictEqual(h2.items[0].elecCurr, 1260);
});
test('máy chủ đổi giữa hai lần sửa: base vẫn là số lúc bắt đầu sửa, để còn phát hiện xung đột', () => {
  const h1 = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1180]), at: AT });
  const h2 = O.tinhHangDoi({ readings: [rd('101', P, 1260)], goc: goc(['101', P, 1200]), doc: h1, at: AT });
  assert.strictEqual(h2.items[0].base, '1180|');
});
test('thời điểm ghi chỉ đổi khi số đổi', () => {
  const g = goc(['101', P, 1180]);
  const h1 = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: g, at: AT });
  const cungSo = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: g, doc: h1, at: '2026-10-28T10:00:00.000Z' });
  assert.strictEqual(cungSo.items[0].at, AT);
  const soMoi = O.tinhHangDoi({ readings: [rd('101', P, 1255)], goc: g, doc: h1, at: '2026-10-28T10:00:00.000Z' });
  assert.strictEqual(soMoi.items[0].at, '2026-10-28T10:00:00.000Z');
});
test('sửa về đúng số của máy chủ thì mục bị bỏ', () => {
  const g = goc(['101', P, 1180]);
  const h1 = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: g, at: AT });
  assert.deepStrictEqual(O.tinhHangDoi({ readings: [rd('101', P, 1180)], goc: g, doc: h1, at: AT }).items, []);
});
test('đã gửi xong (máy chủ nay bằng số của mình) thì mục bị bỏ', () => {
  const h1 = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1180]), at: AT });
  assert.deepStrictEqual(O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1250]), doc: h1, at: AT }).items, []);
});
test('dòng chỉ số đã biến mất khỏi bộ nhớ (xóa tòa nhà) thì mục của nó cũng bỏ, không làm sống lại', () => {
  const cu = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: goc(['101', P, 1180]), at: AT });
  assert.deepStrictEqual(O.tinhHangDoi({ readings: [], goc: {}, doc: cu, at: AT }).items, []);
});
test('nhiều phòng, chỉ phòng đổi mới vào hàng đợi', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, 1250), rd('102', P, 900), rd('103', P, 700)], goc: goc(['101', P, 1250], ['102', P, 880], ['103', P, 700]), at: AT });
  assert.deepStrictEqual(h.items.map((i) => i.roomCode), ['102']);
});
test('phần bù quay vòng được mang theo', () => {
  const h = O.tinhHangDoi({ readings: [rd('101', P, 20, { elecPrev: 0, elecExtra: 99000 })], goc: goc(['101', P, null]), at: AT });
  assert.strictEqual(h.items[0].elecExtra, 99000); assert.strictEqual(h.items[0].elecPrev, 0);
});
test('giữ chủ sở hữu và danh sách chưa quyết đã có; không bị mất khi tính lại', () => {
  const xd = [{ item: { khoa: 'k' }, server: null, lyDo: 'xung-dot' }];
  const h = O.tinhHangDoi({ readings: [], goc: {}, doc: { owner: 'u1', items: [], xungDot: xd }, at: AT });
  assert.strictEqual(h.owner, 'u1'); assert.deepStrictEqual(h.xungDot, xd);
  assert.strictEqual(O.tinhHangDoi({ readings: [], goc: {}, owner: 'u2', doc: { owner: 'u1', items: [], xungDot: [] }, at: AT }).owner, 'u2');
});
test('không có tham số vẫn trả hàng đợi rỗng', () => { const h = O.tinhHangDoi(); assert.deepStrictEqual([h.items, h.xungDot, h.owner], [[], [], null]); });

console.log('\nĐối chiếu với máy chủ');
const mucGhi = (curr, base, o) => Object.assign({ khoa: K('101', P), buildingId: 'b1', roomCode: '101', period: P, elecCurr: curr, elecPrev: 1000, elecExtra: null, elecMeterChanged: false, sig: curr == null ? '|' : curr + '|', base, at: AT }, o || {});
const sv = (curr, o) => ({ [K('101', P)]: rd('101', P, curr, o) });
test('máy chủ đã đúng bằng số mình ghi thì bỏ', () => {
  const k = O.hopNhat(sv(1250), [mucGhi(1250, '1180|')]); assert.deepStrictEqual([k.daCo.length, k.apDung.length, k.canXem.length], [1, 0, 0]);
});
test('máy chủ chưa có dòng này thì áp dụng', () => {
  const k = O.hopNhat({}, [mucGhi(1250, null)]); assert.deepStrictEqual([k.apDung.length, k.canXem.length], [1, 0]);
});
test('máy chủ vẫn là số lúc mình bắt đầu sửa thì áp dụng', () => {
  const k = O.hopNhat(sv(1180), [mucGhi(1250, '1180|')]); assert.deepStrictEqual([k.apDung.length, k.canXem.length], [1, 0]);
});
test('máy chủ đã bị người khác đổi sang số khác thì báo xung đột, kèm bản ghi máy chủ', () => {
  const k = O.hopNhat(sv(1200), [mucGhi(1250, '1180|')]);
  assert.strictEqual(k.apDung.length, 0); assert.strictEqual(k.canXem.length, 1);
  assert.strictEqual(k.canXem[0].lyDo, 'xung-dot'); assert.strictEqual(k.canXem[0].server.elecCurr, 1200);
});
test('bản máy chủ kèm theo chỉ có phần số, không mang ảnh đồng hồ', () => {
  const k = O.hopNhat(sv(1200, { photos: ['data:image/jpeg;base64,ZZZ'], source: 'tenant' }), [mucGhi(1250, '1180|')]);
  assert.deepStrictEqual(k.canXem[0].server, { elecCurr: 1200, elecPrev: 1000, elecExtra: null, source: 'tenant' });
  assert.ok(JSON.stringify(k.canXem).indexOf('base64') < 0);
});
test('lúc mình ghi máy chủ chưa có, giờ có người (khách) đã gửi số: xung đột', () => {
  const k = O.hopNhat(sv(1200), [mucGhi(1250, null)]); assert.strictEqual(k.canXem[0].lyDo, 'xung-dot');
});
test('máy chủ có dòng nhưng chưa có số thì cứ áp dụng', () => {
  const k = O.hopNhat(sv(null), [mucGhi(1250, null)]); assert.deepStrictEqual([k.apDung.length, k.canXem.length], [1, 0]);
});
test('đổi phần bù ở máy chủ cũng tính là có người đã đổi', () => {
  const k = O.hopNhat(sv(1180, { elecExtra: 500 }), [mucGhi(1250, '1180|')]); assert.strictEqual(k.canXem.length, 1);
});
test('số nhỏ hơn kỳ trước, không khai quay vòng: không tự áp dụng', () => {
  const k = O.hopNhat({}, [mucGhi(12, null)]); assert.strictEqual(k.apDung.length, 0); assert.strictEqual(k.canXem[0].lyDo, 'nho-hon'); assert.strictEqual(k.canXem[0].server, null);
});
test('bằng kỳ trước thì hợp lệ; có phần bù hoặc báo thay đồng hồ thì hợp lệ', () => {
  assert.strictEqual(O.hopNhat({}, [mucGhi(1000, null)]).apDung.length, 1);
  assert.strictEqual(O.hopNhat({}, [mucGhi(20, null, { elecPrev: 0, elecExtra: 99000 })]).apDung.length, 1);
  assert.strictEqual(O.hopNhat({}, [mucGhi(20, null, { elecMeterChanged: true })]).apDung.length, 1);
});
test('có phần bù thì không bị coi là nhỏ hơn kỳ trước dù chỉ số trước còn cao', () => {
  assert.strictEqual(O.hopNhat({}, [mucGhi(20, null, { elecPrev: 1000, elecExtra: 99000 })]).apDung.length, 1);
});
test('xóa số (null) không bị coi là nhỏ hơn kỳ trước', () => {
  const k = O.hopNhat(sv(1180), [mucGhi(null, '1180|')]); assert.strictEqual(k.apDung.length, 1);
});
test('xung đột được báo trước lý do số nhỏ hơn', () => {
  assert.strictEqual(O.hopNhat(sv(1200), [mucGhi(12, '1180|')]).canXem[0].lyDo, 'xung-dot');
});
test('nhiều mục: mỗi mục xếp đúng nhóm', () => {
  const mk = (c, b, code) => mucGhi(c, b, { khoa: K(code, P), roomCode: code, elecPrev: 0 });
  const server = { [K('101', P)]: rd('101', P, 1250), [K('102', P)]: rd('102', P, 800), [K('103', P)]: rd('103', P, 700) };
  const k = O.hopNhat(server, [mk(1250, '1180|', '101'), mk(850, '800|', '102'), mk(760, '650|', '103'), mk(900, null, '104')]);
  assert.deepStrictEqual([k.daCo.length, k.apDung.map((i) => i.roomCode), k.canXem.map((c) => c.item.roomCode)], [1, ['102', '104'], ['103']]);
});
test('không có tham số vẫn chạy', () => { const k = O.hopNhat(); assert.deepStrictEqual([k.apDung, k.daCo, k.canXem], [[], [], []]); });

console.log('\nGhi mục hàng đợi vào bộ nhớ');
let n = 0; const uid = () => 'moi' + (++n);
test('dòng đã có thì chỉ đổi chỉ số mới, giữ nguyên các trường khác', () => {
  const ds = [rd('101', P, 1180, { photos: ['p'], elecAvg: 222 })];
  const r = O.apDungVao(ds, mucGhi(1250, '1180|'), uid);
  assert.strictEqual(ds.length, 1); assert.strictEqual(r.elecCurr, 1250); assert.deepStrictEqual(r.photos, ['p']); assert.strictEqual(r.elecAvg, 222); assert.strictEqual(r.elecPrev, 1000);
});
test('chưa có dòng thì tạo mới với mã do uid() cấp, chỉ số trước lấy từ mục', () => {
  const ds = []; const r = O.apDungVao(ds, mucGhi(1250, null, { elecPrev: 1180, elecAvg: 250 }), uid);
  assert.strictEqual(ds.length, 1); assert.strictEqual(ds[0], r);
  assert.deepStrictEqual([r.id.slice(0, 3), r.buildingId, r.roomCode, r.period, r.elecPrev, r.elecCurr, r.elecAvg, r.source, r.approved], ['moi', 'b1', '101', P, 1180, 1250, 250, 'staff', true]);
});
test('dòng mới thiếu chỉ số trước hoặc mức trung bình thì dùng 0 và 190', () => {
  const r = O.apDungVao([], mucGhi(5, null, { elecPrev: null, elecAvg: null }), uid); assert.strictEqual(r.elecPrev, 0); assert.strictEqual(r.elecAvg, 190);
});
test('mục có phần bù quay vòng thì áp luôn chỉ số trước và phần bù', () => {
  const ds = [rd('101', P, 1180)]; const r = O.apDungVao(ds, mucGhi(20, '1180|', { elecPrev: 0, elecExtra: 99000 }), uid);
  assert.deepStrictEqual([r.elecCurr, r.elecPrev, r.elecExtra], [20, 0, 99000]);
});
test('thay đồng hồ thì đánh dấu đã thay', () => {
  const ds = [rd('101', P, 1180)]; assert.strictEqual(O.apDungVao(ds, mucGhi(20, '1180|', { elecPrev: 5, elecExtra: 100, elecMeterChanged: true }), uid).elecMeterChanged, true);
});
test('mục không còn phần bù thì bỏ phần bù cũ trên dòng', () => {
  const ds = [rd('101', P, 1180, { elecExtra: 500 })]; const r = O.apDungVao(ds, mucGhi(1250, '1180|500'), uid);
  assert.strictEqual(r.elecExtra, undefined); assert.strictEqual(r.elecCurr, 1250);
});
test('chỉ đụng đúng dòng cùng khóa', () => {
  const ds = [rd('102', P, 800), rd('101', '2026-09', 1000), rd('101', P, 1180)];
  O.apDungVao(ds, mucGhi(1250, '1180|'), uid); assert.deepStrictEqual(ds.map((d) => d.elecCurr), [800, 1000, 1250]);
});
test('ghi rồi tính lại hàng đợi: không còn gì khác với bản vừa áp dụng', () => {
  const it = mucGhi(1250, '1180|'), ds = [rd('101', P, 1180)]; O.apDungVao(ds, it, uid);
  assert.strictEqual(O.chuKy(ds[0]), it.sig);
});

console.log('\nLưu trong máy');
const kho = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; };
test('lưu rồi đọc lại hàng đợi và ảnh', () => {
  global.localStorage = kho();
  const h = O.tinhHangDoi({ readings: [rd('101', P, 1250)], goc: {}, owner: 'u1', at: AT });
  assert.strictEqual(O.luuHangDoi(h), true); assert.deepStrictEqual(O.docHangDoi(), h);
  assert.strictEqual(O.luuAnh(tot()), true); assert.ok(O.docAnh());
});
test('hàng đợi rỗng thì xóa khỏi máy; còn mục chưa quyết thì vẫn giữ', () => {
  global.localStorage = kho();
  O.luuHangDoi({ owner: 'u1', items: [mucGhi(1, null)], xungDot: [] }); assert.ok(O.docHangDoi());
  O.luuHangDoi({ owner: 'u1', items: [], xungDot: [] }); assert.strictEqual(O.docHangDoi(), null);
  O.luuHangDoi({ owner: 'u1', items: [], xungDot: [{ item: mucGhi(1, null), server: null, lyDo: 'xung-dot' }] }); assert.strictEqual(O.docHangDoi().xungDot.length, 1);
});
test('dữ liệu trong máy bị hỏng thì coi như không có, không văng lỗi', () => {
  global.localStorage = kho(); localStorage.setItem('hh_offline_doi_v1', '{rác'); localStorage.setItem('hh_offline_anh_v1', '{rác');
  assert.strictEqual(O.docHangDoi(), null); assert.strictEqual(O.docAnh(), null);
  localStorage.setItem('hh_offline_doi_v1', JSON.stringify({ items: 'x' })); assert.strictEqual(O.docHangDoi(), null);
  localStorage.setItem('hh_offline_anh_v1', JSON.stringify({ v: 1, buildings: [], rooms: 5, readings: [] })); assert.strictEqual(O.docAnh(), null);
});
test('hàng đợi thiếu danh sách chưa quyết vẫn đọc được', () => {
  global.localStorage = kho(); localStorage.setItem('hh_offline_doi_v1', JSON.stringify({ items: [mucGhi(1, null)] }));
  assert.deepStrictEqual(O.docHangDoi().xungDot, []);
});
test('bộ nhớ đầy hoặc bị chặn thì báo false, không văng lỗi', () => {
  global.localStorage = { getItem: () => null, setItem: () => { throw new Error('đầy'); }, removeItem: () => { throw new Error('chặn'); } };
  assert.strictEqual(O.luuAnh(tot()), false); assert.strictEqual(O.luuHangDoi({ owner: 'u', items: [mucGhi(1, null)], xungDot: [] }), false); assert.strictEqual(O.xoaAnh(), false);
});
test('không có bộ nhớ trình duyệt thì mọi thứ trả rỗng', () => {
  delete global.localStorage; assert.strictEqual(O.docAnh(), null); assert.strictEqual(O.docHangDoi(), null); assert.strictEqual(O.luuAnh(tot()), false);
});
test('xóa ảnh khi đăng xuất không đụng tới hàng đợi', () => {
  global.localStorage = kho(); O.luuAnh(tot()); O.luuHangDoi({ owner: 'u1', items: [mucGhi(1, null)], xungDot: [] });
  O.xoaAnh(); assert.strictEqual(O.docAnh(), null); assert.ok(O.docHangDoi());
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

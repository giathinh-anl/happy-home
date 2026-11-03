/* Kiểm thử báo cáo tháng (js/report.js).
   Chạy:  node tests/report.test.js */
const assert = require('assert');
const R = require('../js/report.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const HOM_NAY = '2026-10-31';
const tien = (n) => Math.round(n).toLocaleString('en-US') + 'đ';

// Số liệu giống kết quả S.dashboardAnalytics
const kpi = (o) => Object.assign({ revenue: 80e6, revenuePrev: 75e6, billed: 100e6, billedPrev: 90e6, collectRate: 0.8, collectRatePrev: 0.83,
  cost: 20e6, costPrev: 25e6, profit: 62e6, profitPrev: 50e6, debt: 30e6, occupancy: 0.9, occupiedRooms: 18, totalRooms: 20 }, o || {});
const A = (o) => Object.assign({
  period: '2026-10', hasData: true, kpi: kpi(),
  series: [{ period: '2026-09', label: 'T9', revenue: 75e6, cost: 25e6, billed: 90e6, invoices: 18 }, { period: '2026-10', label: 'T10', revenue: 80e6, cost: 20e6, billed: 100e6, invoices: 20 }],
  revenueMix: [{ label: 'Tiền phòng', value: 70e6 }, { label: 'Tiền điện', value: 20e6 }, { label: 'Tiền nước', value: 5e6 }, { label: 'Dịch vụ khác', value: 5e6 }],
  expenseMix: [{ label: 'Sửa chữa', value: 12e6 }, { label: 'Lương', value: 8e6 }],
  byBuilding: [{ id: 'b1', name: 'Tòa A', billed: 60e6, collected: 50e6, rooms: 12, occupied: 11, vacant: 1, occupancy: 11 / 12 },
               { id: 'b2', name: 'Tòa B', billed: 40e6, collected: 30e6, rooms: 8, occupied: 7, vacant: 1, occupancy: 7 / 8 }],
}, o || {});
const hd = (o) => Object.assign({ buildingId: 'b1', roomCode: 'P101', tenantName: 'An', total: 3e6, paid: 0, dueDate: '2026-10-05' }, o || {});
const lap = (o) => R.lap(Object.assign({ a: A(), no: [], homNay: HOM_NAY, phamVi: 'Toàn công ty', tenToa: { b1: 'Tòa A', b2: 'Tòa B' }, tien }, o || {}));

console.log('Kỳ và so sánh');
test('nhãn kỳ', () => { assert.strictEqual(R.nhanKy('2026-10'), 'Tháng 10/2026'); assert.strictEqual(R.nhanKy('2026-01'), 'Tháng 1/2026'); assert.strictEqual(R.nhanKy('sai'), ''); });
test('tiền tăng 10%', () => { const s = R.soSanh(110, 100, 'tien'); assert.strictEqual(s.huong, 'tang'); assert.strictEqual(s.nhan, 'tăng 10%'); });
test('tiền giảm 25%', () => { const s = R.soSanh(75, 100, 'tien'); assert.strictEqual(s.huong, 'giam'); assert.strictEqual(s.nhan, 'giảm 25%'); });
test('bằng nhau là "bằng kỳ trước"', () => assert.strictEqual(R.soSanh(100, 100, 'tien').huong, 'dung'));
test('kỳ trước bằng 0 mà kỳ này có: không chia cho 0', () => { const s = R.soSanh(500, 0, 'tien'); assert.strictEqual(s.huong, 'tang'); assert.strictEqual(s.nhan, 'kỳ trước chưa có'); });
test('cả hai bằng 0: bằng kỳ trước', () => assert.strictEqual(R.soSanh(0, 0, 'tien').huong, 'dung'));
test('không có kỳ trước (null): không so', () => { const s = R.soSanh(100, null, 'tien'); assert.strictEqual(s.huong, null); assert.strictEqual(s.nhan, ''); });
test('lợi nhuận từ âm lên bớt âm tính là tăng', () => { const s = R.soSanh(-50, -100, 'tien'); assert.strictEqual(s.huong, 'tang'); assert.strictEqual(s.nhan, 'tăng 50%'); });
test('chênh dưới nửa phần trăm coi là gần bằng', () => assert.strictEqual(R.soSanh(100.2, 100, 'tien').huong, 'dung'));
test('phần trăm so theo điểm, không theo tỷ lệ', () => { const s = R.soSanh(0.8, 0.83, 'phantram'); assert.strictEqual(s.huong, 'giam'); assert.strictEqual(s.nhan, 'giảm 3 điểm'); });
test('phần trăm bằng nhau', () => assert.strictEqual(R.soSanh(0.5, 0.5, 'phantram').huong, 'dung'));

console.log('Tuổi nợ');
test('quá hạn tính đúng số ngày', () => { assert.strictEqual(R.quaHan('2026-10-05', '2026-10-31'), 26); assert.strictEqual(R.quaHan('2026-11-05', '2026-10-31'), -5); assert.strictEqual(R.quaHan('2026-10-31', '2026-10-31'), 0); });
test('qua ranh tháng và năm nhuận không lệch ngày', () => { assert.strictEqual(R.quaHan('2028-02-28', '2028-03-01'), 2); assert.strictEqual(R.quaHan('2026-12-31', '2027-01-01'), 1); });
test('thiếu hạn hoặc sai dạng coi như chưa đến hạn', () => { assert.strictEqual(R.quaHan('', HOM_NAY), 0); assert.strictEqual(R.quaHan('abc', HOM_NAY), 0); });
const mocCua = (han) => R.tuoiNo([hd({ dueDate: han })], HOM_NAY).filter(m => m.soHD).map(m => m.ma)[0];
test('đúng hạn hôm nay: chưa đến hạn', () => assert.strictEqual(mocCua('2026-10-31'), 'chua-den-han'));
test('hạn ngày mai: chưa đến hạn', () => assert.strictEqual(mocCua('2026-11-01'), 'chua-den-han'));
test('quá 1 ngày: mốc 1–30', () => assert.strictEqual(mocCua('2026-10-30'), '1-30'));
test('quá đúng 30 ngày: còn mốc 1–30', () => assert.strictEqual(mocCua('2026-10-01'), '1-30'));
test('quá 31 ngày: mốc 31–60', () => assert.strictEqual(mocCua('2026-09-30'), '31-60'));
test('quá đúng 60 ngày: còn mốc 31–60', () => assert.strictEqual(mocCua('2026-09-01'), '31-60'));
test('quá 61 ngày: mốc trên 60', () => assert.strictEqual(mocCua('2026-08-31'), 'tren-60'));
test('luôn đủ 4 mốc, kể cả khi không nợ', () => { const t = R.tuoiNo([], HOM_NAY); assert.strictEqual(t.length, 4); assert.ok(t.every(m => m.soHD === 0 && m.tien === 0)); });
test('chỉ tính phần còn nợ, hóa đơn đã trả đủ bị bỏ', () => {
  const t = R.tuoiNo([hd({ total: 3e6, paid: 1e6 }), hd({ total: 2e6, paid: 2e6 }), hd({ total: 2e6, paid: 9e6 })], HOM_NAY);
  assert.strictEqual(t.reduce((s, m) => s + m.soHD, 0), 1); assert.strictEqual(t.reduce((s, m) => s + m.tien, 0), 2e6);
});
test('tiền ghi bằng chữ số dạng chuỗi vẫn cộng đúng', () => assert.strictEqual(R.tuoiNo([hd({ total: '3000000', paid: '1000000' })], HOM_NAY)[1].tien, 2e6));

console.log('Nợ theo phòng');
test('một phòng hai hóa đơn gộp thành một dòng, lấy hạn quá lâu nhất', () => {
  const n = R.noTheoPhong([hd({ total: 3e6, dueDate: '2026-10-05' }), hd({ total: 2e6, dueDate: '2026-08-05' })], HOM_NAY, { b1: 'Tòa A' });
  assert.strictEqual(n.length, 1); assert.strictEqual(n[0].tien, 5e6); assert.strictEqual(n[0].soHD, 2); assert.strictEqual(n[0].ngayQua, 87); assert.strictEqual(n[0].toa, 'Tòa A');
});
test('hai tòa trùng mã phòng không bị gộp nhầm', () => assert.strictEqual(R.noTheoPhong([hd({ buildingId: 'b1' }), hd({ buildingId: 'b2' })], HOM_NAY, {}).length, 2));
test('nợ nhiều xếp trước', () => {
  const n = R.noTheoPhong([hd({ roomCode: 'P1', total: 1e6 }), hd({ roomCode: 'P2', total: 9e6 }), hd({ roomCode: 'P3', total: 4e6 })], HOM_NAY, {});
  assert.deepStrictEqual(n.map(x => x.phong), ['P2', 'P3', 'P1']);
});
test('nợ bằng nhau thì quá hạn lâu hơn xếp trước', () => {
  const n = R.noTheoPhong([hd({ roomCode: 'P1', dueDate: '2026-10-20' }), hd({ roomCode: 'P2', dueDate: '2026-08-20' })], HOM_NAY, {});
  assert.strictEqual(n[0].phong, 'P2');
});
test('không có nợ thì danh sách rỗng', () => assert.deepStrictEqual(R.noTheoPhong([], HOM_NAY, {}), []));

console.log('Lập bản số liệu');
test('bảy chỉ tiêu theo thứ tự', () => assert.deepStrictEqual(lap().chiSo.map(c => c.ma), ['phat-hanh', 'da-thu', 'ty-le-thu', 'chi', 'loi-nhuan', 'cong-no', 'lap-day']));
test('chi phí và công nợ là chỉ tiêu "càng thấp càng tốt"', () => { const c = lap().chiSo; assert.ok(c.find(x => x.ma === 'chi').nghich); assert.ok(c.find(x => x.ma === 'cong-no').nghich); assert.ok(!c.find(x => x.ma === 'da-thu').nghich); });
test('công nợ và lấp đầy không có kỳ trước nên không so', () => { const c = lap().chiSo; assert.strictEqual(c.find(x => x.ma === 'cong-no').ss.huong, null); assert.strictEqual(c.find(x => x.ma === 'lap-day').ss.huong, null); });
test('kỳ trước chưa phát hành gì: không so tỷ lệ thu (0% không phải "thu tệ")', () => { const c = lap({ a: A({ kpi: kpi({ billedPrev: 0, collectRatePrev: 0 }) }) }).chiSo.find(x => x.ma === 'ty-le-thu'); assert.strictEqual(c.ss.huong, null); assert.strictEqual(c.truoc, null); });
test('đã thu so với kỳ trước', () => assert.strictEqual(lap().chiSo.find(x => x.ma === 'da-thu').ss.nhan, 'tăng 7%'));
test('tên kỳ, phạm vi, ngày lập đi theo', () => { const m = lap({ phamVi: 'Tòa A' }); assert.strictEqual(m.nhanKy, 'Tháng 10/2026'); assert.strictEqual(m.phamVi, 'Tòa A'); assert.strictEqual(m.homNay, HOM_NAY); });
test('tỷ trọng cơ cấu cộng lại đủ 100%', () => { const m = lap(); assert.ok(Math.abs(m.coCauThu.reduce((s, x) => s + x.tyLe, 0) - 1) < 1e-9); assert.ok(Math.abs(m.coCauChi.reduce((s, x) => s + x.tyLe, 0) - 1) < 1e-9); });
test('chia cho 0 khi chưa có khoản nào: tỷ trọng 0, không NaN', () => { const m = lap({ a: A({ expenseMix: [{ label: 'Lương', value: 0 }] }) }); assert.strictEqual(m.coCauChi[0].tyLe, 0); });
test('tỷ lệ thu theo tòa', () => assert.strictEqual(lap().theoToa[0].tyLeThu, 50 / 60));
test('tòa chưa phát hành gì: tỷ lệ thu 0, không NaN', () => assert.strictEqual(lap({ a: A({ byBuilding: [{ id: 'b3', name: 'C', billed: 0, collected: 0, rooms: 5, occupied: 0, vacant: 5, occupancy: 0 }] }) }).theoToa[0].tyLeThu, 0));
test('thiếu hẳn số liệu vẫn lập được (không ném lỗi)', () => { const m = R.lap({}); assert.strictEqual(m.chiSo.length, 7); assert.deepStrictEqual(m.noLon, []); });
test('chỉ liệt kê 10 phòng nợ nhiều nhất, danh sách đủ vẫn còn nguyên', () => {
  const no = []; for (let i = 1; i <= 14; i++) no.push(hd({ roomCode: 'P' + i, total: i * 1e5 }));
  const m = lap({ no }); assert.strictEqual(m.noLon.length, 10); assert.strictEqual(m.noTatCa.length, 14); assert.strictEqual(m.noLon[0].phong, 'P14');
});
test('tổng nợ khớp tổng các mốc tuổi nợ', () => {
  const m = lap({ no: [hd({ total: 3e6 }), hd({ roomCode: 'P2', total: 2e6, dueDate: '2026-08-01' })] });
  assert.strictEqual(m.tongNo, 5e6); assert.strictEqual(m.tuoiNo.reduce((s, x) => s + x.tien, 0), 5e6);
});

console.log('Điểm đáng chú ý');
const luuY = (k, no) => lap({ a: A({ kpi: kpi(k) }), no: no || [] }).luuY.join(' | ');
test('thu dưới 70%: nói còn bao nhiêu chưa thu', () => { const s = luuY({ collectRate: 0.5, revenue: 50e6 }); assert.ok(/Mới thu được 50%/.test(s) && /50\,000\,000đ chưa thu/.test(s), s); });
test('thu 69% vẫn bị nhắc, đúng 70% thì không', () => { assert.ok(/Mới thu được 69%/.test(luuY({ collectRate: 0.69, revenue: 69e6 }))); assert.ok(!/Mới thu được/.test(luuY({ collectRate: 0.7, revenue: 70e6 }))); });
test('thu từ 95% trở lên: ghi nhận là thu gần đủ', () => assert.ok(/Thu gần đủ: 96%/.test(luuY({ collectRate: 0.96, revenue: 96e6 }))));
test('thu 70% đến dưới 95%: không nói gì về tỷ lệ thu', () => assert.ok(!/thu được|Thu gần đủ/.test(luuY({ collectRate: 0.8 }))));
test('có hóa đơn quá 30 ngày: nhắc xử lý', () => assert.ok(/1 hóa đơn quá hạn trên 30 ngày, tổng 3,000,000đ/.test(luuY({}, [hd({ dueDate: '2026-09-20' })]))));
test('quá 30 ngày nhưng gộp cả mốc 31–60 và trên 60', () => assert.ok(/2 hóa đơn quá hạn trên 30 ngày/.test(luuY({}, [hd({ dueDate: '2026-09-20' }), hd({ roomCode: 'P2', dueDate: '2026-07-01' })]))));
test('nợ mới quá vài ngày thì chưa nhắc xử lý, chỉ nêu tổng nợ', () => { const s = luuY({}, [hd({ dueDate: '2026-10-20' })]); assert.ok(!/Nên nhắc/.test(s), s); assert.ok(/Công nợ còn phải thu 3,000,000đ ở 1 phòng, chưa có khoản nào quá hạn trên 30 ngày/.test(s), s); });
test('đã có câu nhắc nợ lâu thì không nêu thêm câu tổng nợ', () => assert.ok(!/Công nợ còn phải thu/.test(luuY({}, [hd({ dueDate: '2026-08-20' })]))));
test('lỗ thì báo lỗ bao nhiêu', () => assert.ok(/lỗ 5,000,000đ/.test(luuY({ profit: -5e6 }))));
test('lấp đầy dưới 80%: báo số phòng chưa có người', () => assert.ok(/Còn 7 phòng chưa có người ở trên 20 phòng \(lấp đầy 65%\)/.test(luuY({ occupancy: 0.65, occupiedRooms: 13 }))));
test('lấp đầy 79% vẫn bị nhắc, đúng 80% thì không', () => { assert.ok(/lấp đầy 79%/.test(luuY({ occupancy: 0.79, occupiedRooms: 16 }))); assert.ok(!/chưa có người ở/.test(luuY({ occupancy: 0.8, occupiedRooms: 16 }))); });
test('tiền thu tụt quá 20%: báo phần trăm', () => assert.ok(/Tiền thu giảm 40% so với kỳ trước/.test(luuY({ revenue: 45e6, revenuePrev: 75e6 }))));
test('tụt đúng 20% thì chưa báo', () => assert.ok(!/Tiền thu giảm/.test(luuY({ revenue: 60e6, revenuePrev: 75e6 }))));
test('kỳ trước chưa thu gì thì không báo tụt', () => assert.ok(!/Tiền thu giảm/.test(luuY({ revenue: 0, revenuePrev: 0 }))));
test('kỳ trống trơn: một câu duy nhất', () => assert.deepStrictEqual(lap({ a: A({ kpi: kpi({ billed: 0, revenue: 0, cost: 0, profit: 0, collectRate: 0 }) }) }).luuY, ['Kỳ này chưa có hóa đơn hay khoản chi nào.']));
test('chưa phát hành nhưng đã có chi: báo chưa phát hành hóa đơn, không nói tỷ lệ thu 0%', () => { const s = luuY({ billed: 0, revenue: 0, collectRate: 0, cost: 5e6, profit: -5e6 }); assert.ok(/chưa phát hành hóa đơn nào/.test(s) && !/Mới thu được/.test(s), s); });
test('không có gì đáng nói thì vẫn có một câu, không để mục trống', () => assert.deepStrictEqual(lap().luuY, ['Không có điều gì bất thường trong kỳ này.']));
test('tối đa 5 ý', () => { const s = lap({ a: A({ kpi: kpi({ collectRate: 0.3, revenue: 30e6, revenuePrev: 90e6, profit: -1e6, occupancy: 0.5, occupiedRooms: 10 }) }), no: [hd({ dueDate: '2026-06-01' })] }); assert.ok(s.luuY.length <= 5 && s.luuY.length >= 5, s.luuY.length); });

console.log('Bản xem và bản in');
const F = { tien, phanTram: (n) => Math.round(n * 100) + '%' };
test('có đủ các phần chính', () => {
  const h = R.html(lap({ no: [hd({ dueDate: '2026-09-01' })] }), F);
  ['BÁO CÁO THÁNG 10/2026', 'Điểm đáng chú ý', 'Tóm tắt', 'Theo tòa nhà', 'Thu và chi các kỳ gần nhất', 'Cơ cấu tiền phát hành', 'Cơ cấu chi phí', 'Tuổi nợ', 'Phòng nợ nhiều nhất', 'Lập ngày 31/10/2026'].forEach(t => assert.ok(h.includes(t), t));
});
test('tên khách, tên tòa, phạm vi có ký tự HTML thì bị thoát', () => {
  const h = R.html(lap({ phamVi: '<img src=x onerror=alert(1)>', no: [hd({ tenantName: '<script>alert(1)</script>' })], tenToa: { b1: 'Tòa <i>XX</i>' } }), F);
  assert.ok(!/<script>alert/.test(h) && !/<img src=x/.test(h) && !h.includes('<i>XX</i>'), h.slice(0, 200));
  assert.ok(h.includes('Tòa &lt;i&gt;XX&lt;/i&gt;'));
  assert.ok(h.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});
test('đường dẫn logo cũng bị thoát', () => assert.ok(!/src="x" onerror/.test(R.html(lap(), { logo: 'x" onerror="alert(1)' }))));
test('chi phí tăng tô đỏ, chi phí giảm tô xanh', () => {
  assert.ok(/giam-tot">▼ giảm 20%/.test(R.html(lap(), F)));
  assert.ok(/tang-xau">▲ tăng 40%/.test(R.html(lap({ a: A({ kpi: kpi({ cost: 35e6, costPrev: 25e6 }) }) }), F)));
});
test('đã thu tăng tô xanh, đã thu giảm tô đỏ', () => {
  assert.ok(/tang-tot">▲ tăng 7%/.test(R.html(lap(), F)));
  assert.ok(/giam-xau">▼ giảm 20%/.test(R.html(lap({ a: A({ kpi: kpi({ revenue: 60e6, revenuePrev: 75e6 }) }) }), F)));
});
test('không có nợ: ghi rõ, không vẽ bảng trống', () => assert.ok(R.html(lap(), F).includes('Không còn khoản nợ nào.')));
test('chưa có khoản chi: ghi rõ', () => assert.ok(R.html(lap({ a: A({ expenseMix: [] }) }), F).includes('Kỳ này chưa ghi khoản chi nào.')));
test('hơn 10 phòng nợ: nói còn bao nhiêu phòng nữa trong bản Excel', () => {
  const no = []; for (let i = 1; i <= 13; i++) no.push(hd({ roomCode: 'P' + i }));
  assert.ok(R.html(lap({ no }), F).includes('Còn 3 phòng nợ ít hơn'));
});
test('công ty một tòa thì không in tên tòa bên cạnh số phòng', () => {
  const m = lap({ a: A({ byBuilding: [A().byBuilding[0]] }), no: [hd()] });
  assert.ok(!/<small>Tòa A<\/small>/.test(R.html(m, F)));
});
test('công ty nhiều tòa thì in tên tòa bên cạnh số phòng nợ', () => assert.ok(/<small>Tòa A<\/small>/.test(R.html(lap({ no: [hd()] }), F))));
test('tên tòa bỏ tiền tố "Happy Home" cho gọn, bản Excel thì giữ nguyên', () => {
  const m = lap({ no: [hd()], tenToa: { b1: 'Happy Home Gò Vấp' } });
  assert.ok(/<small>Gò Vấp<\/small>/.test(R.html(m, F)));
  assert.ok(R.csv(m).some(r => r[0] === 'Happy Home Gò Vấp' && r[1] === 'P101'));
});
test('chạy không cần truyền hàm định dạng', () => { const h = R.html(lap()); assert.ok(h.includes('80.000.000 ₫') && h.includes('80%')); });
test('kỳ hiện tại được in đậm trong bảng các kỳ', () => assert.ok(/<tr class="tot"><td>T10<\/td>/.test(R.html(lap(), F))));
test('có CSS đi kèm để dán vào trang in', () => assert.ok(/@media print/.test(R.css) && /\.bct\b/.test(R.css)));

console.log('Bản Excel');
const rows = (o) => R.csv(lap(o));
const tim = (r, nhan) => r.find(x => x[0] === nhan);
test('dòng đầu ghi tên báo cáo và phạm vi', () => { const r = rows(); assert.strictEqual(r[0][0], 'Báo cáo tháng 10/2026'); assert.strictEqual(r[0][1], 'Toàn công ty'); });
test('tiền để số nguyên, Excel cộng được', () => { const r = rows(); assert.strictEqual(tim(r, 'Đã thu')[1], 80e6); assert.strictEqual(typeof tim(r, 'Đã thu')[1], 'number'); });
test('tỷ lệ ghi dạng phần trăm', () => assert.strictEqual(tim(rows(), 'Tỷ lệ đã thu')[1], '80%'));
test('chỉ tiêu không có kỳ trước để ô trống', () => assert.strictEqual(tim(rows(), 'Công nợ còn phải thu (mọi kỳ)')[2], ''));
test('đủ các phần', () => {
  const dau = rows().filter(r => r.length === 1).map(r => r[0]);
  ['TÓM TẮT', 'THEO TÒA NHÀ', 'THU VÀ CHI CÁC KỲ GẦN NHẤT', 'CƠ CẤU TIỀN PHÁT HÀNH', 'CƠ CẤU CHI PHÍ', 'TUỔI NỢ', 'CÁC PHÒNG CÒN NỢ (đủ danh sách)'].forEach(t => assert.ok(dau.includes(t), t));
});
test('danh sách nợ trong Excel đủ cả những phòng bản in cắt bớt', () => {
  const no = []; for (let i = 1; i <= 13; i++) no.push(hd({ roomCode: 'P' + i }));
  const r = rows({ no }); const i = r.findIndex(x => x[0] === 'CÁC PHÒNG CÒN NỢ (đủ danh sách)');
  assert.strictEqual(r.slice(i + 2).filter(x => x.length === 6).length, 13);
});
test('quá hạn lâu nhất không bao giờ âm', () => { const r = rows({ no: [hd({ dueDate: '2026-12-01' })] }); const i = r.findIndex(x => x[0] === 'CÁC PHÒNG CÒN NỢ (đủ danh sách)'); assert.strictEqual(r[i + 2][5], 0); });
test('không nợ: ghi rõ một dòng', () => assert.ok(rows().some(x => x[0] === 'Không còn khoản nợ nào')));
test('không chi: ghi rõ một dòng', () => assert.ok(rows({ a: A({ expenseMix: [] }) }).some(x => x[0] === 'Kỳ này chưa ghi khoản chi nào')));

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

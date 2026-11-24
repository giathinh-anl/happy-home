/* Kiểm thử tiền tháng lẻ và quyết toán trả phòng (js/settlement.js), và việc nối vào hóa đơn / màn hình trả phòng.
   Chạy:  node tests/settlement.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../js/settlement.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};

/* ============================================================
   Ngày của kỳ
   ============================================================ */
test('soNgayThang: tháng 30, 31 ngày; tháng 2 thường 28, nhuận 29; kỳ sai thì null', () => {
  assert.strictEqual(T.soNgayThang('2026-11'), 30); assert.strictEqual(T.soNgayThang('2026-12'), 31); assert.strictEqual(T.soNgayThang('2026-01'), 31);
  assert.strictEqual(T.soNgayThang('2026-02'), 28); assert.strictEqual(T.soNgayThang('2028-02'), 29); assert.strictEqual(T.soNgayThang('2100-02'), 28); assert.strictEqual(T.soNgayThang('2000-02'), 29);
  ['2026-13', '2026-00', '2026-1', 'abc', '', null, undefined, 202611, '2026/11'].forEach((k) => assert.strictEqual(T.soNgayThang(k), null, String(k)));
});
test('dauCuoiKy: ngày đầu và cuối của kỳ', () => {
  assert.deepStrictEqual(T.dauCuoiKy('2026-11'), { dau: '2026-11-01', cuoi: '2026-11-30' });
  assert.deepStrictEqual(T.dauCuoiKy('2028-02'), { dau: '2028-02-01', cuoi: '2028-02-29' });
  assert.strictEqual(T.dauCuoiKy('x'), null);
});

/* ============================================================
   Khách ở bao nhiêu ngày trong kỳ
   ============================================================ */
const ky = '2026-11';
test('phanNgayO: ở trọn kỳ (vào từ trước, chưa rời) thì tronKy, đủ 30/30 ngày', () => {
  const p = T.phanNgayO(ky, '2026-05-10', null);
  assert.deepStrictEqual(p, { tu: '2026-11-01', den: '2026-11-30', soNgayO: 30, soNgayThang: 30, tronKy: true, dauLe: false, cuoiLe: false });
  assert.strictEqual(T.phanNgayO(ky, null, null).tronKy, true);                 // không có ngày bắt đầu: coi là từ đầu kỳ
  assert.strictEqual(T.phanNgayO(ky, '2026-11-01', null).tronKy, true);         // vào đúng mùng 1 vẫn là trọn kỳ
});
test('phanNgayO: vào giữa tháng thì tính cả ngày vào (15 tới 30 là 16 ngày); vào ngày cuối là 1 ngày', () => {
  const a = T.phanNgayO(ky, '2026-11-15', null); assert.strictEqual(a.soNgayO, 16); assert.strictEqual(a.tronKy, false); assert.strictEqual(a.dauLe, true); assert.strictEqual(a.tu, '2026-11-15');
  assert.strictEqual(T.phanNgayO(ky, '2026-11-30', null).soNgayO, 1);
  assert.strictEqual(T.phanNgayO(ky, '2026-11-02', null).soNgayO, 29);
});
test('phanNgayO: rời giữa tháng thì tính cả ngày rời; rời đúng cuối tháng là trọn kỳ', () => {
  const a = T.phanNgayO(ky, '2026-01-01', '2026-11-18'); assert.strictEqual(a.soNgayO, 18); assert.strictEqual(a.cuoiLe, true); assert.strictEqual(a.den, '2026-11-18');
  assert.strictEqual(T.phanNgayO(ky, '2026-01-01', '2026-11-30').tronKy, true);
  assert.strictEqual(T.phanNgayO(ky, '2026-01-01', '2026-11-01').soNgayO, 1);
  assert.strictEqual(T.phanNgayO(ky, '2026-01-01', '2026-12-20').tronKy, true);  // rời sau kỳ này: kỳ này vẫn trọn
});
test('phanNgayO: vào và rời trong cùng một tháng; ngoài kỳ thì 0 ngày; ngày ngược thì 0', () => {
  assert.strictEqual(T.phanNgayO(ky, '2026-11-10', '2026-11-20').soNgayO, 11);
  assert.strictEqual(T.phanNgayO(ky, '2026-11-10', '2026-11-10').soNgayO, 1);
  assert.strictEqual(T.phanNgayO(ky, '2026-12-05', null).soNgayO, 0);            // vào sau kỳ
  assert.strictEqual(T.phanNgayO(ky, '2026-01-01', '2026-10-31').soNgayO, 0);    // rời trước kỳ
  assert.strictEqual(T.phanNgayO(ky, '2026-11-20', '2026-11-10').soNgayO, 0);    // rời trước khi vào
});
test('phanNgayO: tháng 2 nhuận và không nhuận; nhận Date và chuỗi có giờ; kỳ sai thì null', () => {
  assert.strictEqual(T.phanNgayO('2028-02', '2028-02-10', null).soNgayO, 20);   // 10..29
  assert.strictEqual(T.phanNgayO('2026-02', '2026-02-10', null).soNgayO, 19);   // 10..28
  assert.strictEqual(T.phanNgayO(ky, new Date(2026, 10, 15), null).soNgayO, 16);
  assert.strictEqual(T.phanNgayO(ky, '2026-11-15T00:00:00.000Z', null).soNgayO, 16);
  assert.strictEqual(T.phanNgayO('2026-13', '2026-01-01', null), null);
});

/* ============================================================
   Tiền theo ngày
   ============================================================ */
test('tienTheoNgay: ở trọn kỳ giữ nguyên; ở lẻ chia theo ngày của tháng, làm tròn nghìn đồng', () => {
  assert.strictEqual(T.tienTheoNgay(3500000, 30, 30), 3500000);
  assert.strictEqual(T.tienTheoNgay(3500000, 16, 30), 1867000);                  // 1.866.667 làm tròn
  assert.strictEqual(T.tienTheoNgay(3500000, 1, 30), 117000);
  assert.strictEqual(T.tienTheoNgay(3000000, 15, 30), 1500000);
  assert.strictEqual(T.tienTheoNgay(3000000, 10, 31), 968000);                   // 967.742 làm tròn
  assert.strictEqual(T.tienTheoNgay(100000, 10, 30), 33000);
});
test('tienTheoNgay: 0 ngày là 0 đồng, không bao giờ vượt cả tháng, số lạ không làm hỏng', () => {
  assert.strictEqual(T.tienTheoNgay(3500000, 0, 30), 0);
  assert.strictEqual(T.tienTheoNgay(3500000, 31, 30), 3500000);
  assert.strictEqual(T.tienTheoNgay(3500000, 29, 30), 3383000);
  [-5, NaN, null, undefined, 'abc'].forEach((x) => assert.strictEqual(T.tienTheoNgay(x, 10, 30), 0, String(x)));
  assert.strictEqual(T.tienTheoNgay(1000, 29, 30), 1000);                        // làm tròn lên cũng không vượt cả tháng
  for (let n = 0; n <= 31; n++) { const v = T.tienTheoNgay(3500000, n, 31); assert.ok(v >= 0 && v <= 3500000 && v % 1000 === 0, 'n=' + n); }
});
test('tienTheoNgay: ở càng nhiều ngày thì tiền không giảm', () => {
  let truoc = -1; for (let n = 0; n <= 30; n++) { const v = T.tienTheoNgay(3500000, n, 30); assert.ok(v >= truoc, 'n=' + n); truoc = v; }
});
test('moTaNgayO: trọn kỳ ghi "Trọn kỳ, 30/30 ngày"; lẻ ghi số ngày và khoảng ngày', () => {
  assert.strictEqual(T.moTaNgayO(T.phanNgayO(ky, '2026-05-10', null)), 'Trọn kỳ, 30/30 ngày');
  assert.strictEqual(T.moTaNgayO(T.phanNgayO(ky, '2026-11-15', null)), '16/30 ngày (15/11 đến 30/11)');
  assert.strictEqual(T.moTaNgayO(T.phanNgayO(ky, '2026-01-01', '2026-11-18')), '18/30 ngày (1/11 đến 18/11)');
  assert.strictEqual(T.moTaNgayO(null), '');
});

/* ============================================================
   Chia tiền cọc khi quyết toán
   ============================================================ */
test('chiaCoc: cọc đủ trả hết công nợ, bồi thường, phạt, còn dư thì hoàn khách', () => {
  const r = T.chiaCoc(3500000, [{ id: 'A', conNo: 1000000 }, { id: 'B', conNo: 500000 }], 200000, 100000);
  assert.deepStrictEqual(r.traHoaDon, [{ id: 'A', soTien: 1000000, conLai: 0 }, { id: 'B', soTien: 500000, conLai: 0 }]);
  assert.strictEqual(r.boiThuongTru, 200000); assert.strictEqual(r.phatTru, 100000);
  assert.strictEqual(r.tongPhaiTru, 1800000); assert.strictEqual(r.hoan, 1700000); assert.strictEqual(r.conThieu, 0);
});
test('chiaCoc: cọc không đủ thì trả hóa đơn cũ nhất trước, phần còn lại là khách phải nộp thêm', () => {
  const r = T.chiaCoc(1000000, [{ id: 'A', conNo: 800000 }, { id: 'B', conNo: 600000 }], 300000, 500000);
  assert.deepStrictEqual(r.traHoaDon, [{ id: 'A', soTien: 800000, conLai: 0 }, { id: 'B', soTien: 200000, conLai: 400000 }]);
  assert.strictEqual(r.boiThuongTru, 0); assert.strictEqual(r.phatTru, 0);
  assert.strictEqual(r.tongPhaiTru, 2200000); assert.strictEqual(r.hoan, 0); assert.strictEqual(r.conThieu, 1200000);
});
test('chiaCoc: không có khoản nào thì hoàn cả cọc; cọc 0 thì không trừ gì và còn thiếu đủ số nợ', () => {
  assert.deepStrictEqual(T.chiaCoc(2000000, [], 0, 0), { traHoaDon: [], boiThuongTru: 0, phatTru: 0, tongPhaiTru: 0, hoan: 2000000, conThieu: 0 });
  const r = T.chiaCoc(0, [{ id: 'A', conNo: 500000 }], 0, 0);
  assert.strictEqual(r.hoan, 0); assert.strictEqual(r.conThieu, 500000); assert.strictEqual(r.traHoaDon[0].soTien, 0);
});
test('chiaCoc: số âm, NaN, thiếu thì coi như 0 (không ai được hoàn nhiều hơn cọc)', () => {
  const r = T.chiaCoc(-100, [{ id: 'A', conNo: -50 }, { id: 'B' }], NaN, undefined);
  assert.strictEqual(r.hoan, 0); assert.strictEqual(r.conThieu, 0); assert.strictEqual(r.tongPhaiTru, 0);
  const r2 = T.chiaCoc('1000000', [{ id: 'A', conNo: '400000' }], null, '100000'); assert.strictEqual(r2.hoan, 500000);
  assert.deepStrictEqual(T.chiaCoc(1000, null, 0, 0).traHoaDon, []);
});
test('chiaCoc: bất biến với 3000 bộ số ngẫu nhiên (tiền không mất, không sinh ra, hoàn và thiếu không cùng dương)', () => {
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const so = () => Math.round(rnd() * 40) * 100000;
  for (let i = 0; i < 3000; i++) {
    const coc = so(), hd = Array.from({ length: Math.floor(rnd() * 5) }, (_, k) => ({ id: 'H' + k, conNo: so() })), bt = so(), ph = so();
    const r = T.chiaCoc(coc, hd, bt, ph);
    const daTru = r.traHoaDon.reduce((x, y) => x + y.soTien, 0) + r.boiThuongTru + r.phatTru;
    assert.strictEqual(daTru + r.hoan, coc, 'tiền cọc phải được chia hết: ' + JSON.stringify({ coc, hd, bt, ph }));
    assert.ok(r.hoan >= 0 && r.conThieu >= 0 && r.traHoaDon.every((x) => x.soTien >= 0 && x.conLai >= 0), 'không âm');
    assert.ok(!(r.hoan > 0 && r.conThieu > 0), 'còn hoàn thì không thể còn thiếu');
    assert.strictEqual(r.tongPhaiTru, coc - r.hoan + r.conThieu, 'tổng phải trừ = đã trừ + còn thiếu');
    r.traHoaDon.forEach((x, k) => assert.strictEqual(x.soTien + x.conLai, hd[k].conNo));
  }
});

/* ============================================================
   Phạt trả trước hạn
   ============================================================ */
test('goiYPhat: trả trước ngày hết hạn thì có 3 mức gợi ý khi cọc lớn hơn một tháng tiền phòng', () => {
  const r = T.goiYPhat({ ngayTra: '2026-11-18', ngayHetHan: '2027-03-18', tienPhong: 3500000, tienCoc: 7000000 });
  assert.strictEqual(r.truocHan, true); assert.strictEqual(r.soNgayConLai, 120);
  assert.deepStrictEqual(r.goiY.map((x) => [x.ma, x.soTien]), [['khong', 0], ['mot-thang', 3500000], ['mat-coc', 7000000]]);
  assert.strictEqual(r.goiY[1].nhan, 'Một tháng tiền phòng');
});
test('goiYPhat: cọc bằng hoặc ít hơn một tháng tiền phòng thì chỉ một nút phạt, không có hai nút trùng số tiền', () => {
  [[3500000, 3500000, 3500000], [5000000, 3000000, 3000000]].forEach(([phong, coc, muc]) => {
    const r = T.goiYPhat({ ngayTra: '2026-11-18', ngayHetHan: '2027-03-18', tienPhong: phong, tienCoc: coc });
    assert.deepStrictEqual(r.goiY.map((x) => [x.ma, x.soTien]), [['khong', 0], ['mot-thang', muc]]);
    assert.match(r.goiY[1].nhan, /bằng cọc/);
    assert.strictEqual(new Set(r.goiY.map((x) => x.soTien)).size, r.goiY.length);
  });
});
test('goiYPhat: trả đúng hoặc sau ngày hết hạn, ngày hỏng hoặc thiếu thì không phạt và không gợi ý', () => {
  [['2027-03-18', '2027-03-18'], ['2027-04-01', '2027-03-18'], [null, '2027-03-18'], ['2026-11-18', null], ['abc', 'xyz']].forEach(([a, b]) => {
    const r = T.goiYPhat({ ngayTra: a, ngayHetHan: b, tienPhong: 3500000, tienCoc: 3500000 });
    assert.strictEqual(r.truocHan, false, a + ' ' + b); assert.deepStrictEqual(r.goiY, []); assert.strictEqual(r.soNgayConLai, 0);
  });
  assert.strictEqual(T.goiYPhat({ ngayTra: new Date(2026, 10, 18), ngayHetHan: new Date(2026, 10, 19), tienPhong: 1, tienCoc: 1 }).truocHan, true);
});

/* ============================================================
   Kỳ trước chưa lập hóa đơn
   ============================================================ */
test('kyTruocChuaLap: báo kỳ liền trước nếu hợp đồng đã bắt đầu mà chưa có hóa đơn (hóa đơn đã hủy không tính)', () => {
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-01-10', [{ period: '2026-09', status: 'paid' }]), '2026-10');
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-01-10', [{ period: '2026-10', status: 'cancelled' }]), '2026-10');
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-01-10', [{ period: '2026-10', status: 'draft' }]), null);
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-01-10', [{ period: '2026-10', status: 'paid' }]), null);
});
test('kyTruocChuaLap: hợp đồng bắt đầu sau kỳ trước thì không báo; qua năm; đầu vào hỏng thì null', () => {
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-11-05', []), null);
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-10-31', []), '2026-10');
  assert.strictEqual(T.kyTruocChuaLap('2027-01', '2026-01-10', []), '2026-12');
  assert.strictEqual(T.kyTruocChuaLap('abc', '2026-01-10', []), null); assert.strictEqual(T.kyTruocChuaLap('2026-11', null, []), null);
  assert.strictEqual(T.kyTruocChuaLap('2026-11', '2026-01-10', null), '2026-10');
});

/* ============================================================
   Nối vào app: đối chiếu mã nguồn (phần chạy thật đã thử bằng trình duyệt)
   ============================================================ */
const html = doc('index.html'), store = doc('js/store.js'), hd = doc('js/pages/contracts.js'), bill = doc('js/pages/billing.js');
test('index.html nạp settlement.js sau dates.js và trước store.js, contracts.js', () => {
  const vt = (f) => html.indexOf('src="js/' + f);
  assert.ok(vt('settlement.js') > 0, 'chưa nạp settlement.js');
  assert.ok(vt('dates.js') < vt('settlement.js') && vt('settlement.js') < vt('store.js') && vt('settlement.js') < vt('pages/contracts.js'));
});
test('hóa đơn tháng tính tiền phòng, nước, dịch vụ cố định theo số ngày ở (không còn ghi cứng trọn kỳ)', () => {
  const ham = store.slice(store.indexOf('function runtimeInvoice'), store.indexOf('/* ---------- Truy vấn'));
  assert.match(ham, /St\.phanNgayO\(period, contract\.start, ketThuc\)/);
  assert.match(ham, /amount: theoNgay\(contract\.rent\)/);
  assert.match(ham, /amount: theoNgay\(occ \* water\.unit\)/);
  assert.match(ham, /amount: theoNgay\(f\.unit\)/);
  assert.ok(!/amount: use \* elec\.unit[^,]*theoNgay/.test(ham), 'tiền điện tính theo chỉ số, không chia theo ngày');
});
test('màn hình trả phòng: chia cọc bằng HH.settlement, ghi sổ bằng S.thanhLyHopDong, không còn ô điện bỏ không và phạt luôn bằng 0', () => {
  assert.ok(!/\?\s*0\s*:\s*0/.test(hd), 'còn biểu thức ? 0 : 0');
  assert.ok(!/<label[^>]*>[^<]*Chỉ số điện chốt/.test(hd), 'còn ô "Chỉ số điện chốt" không dùng tới');
  assert.match(hd, /<label for="tElecEnd">/);
  assert.match(hd, /St\.chiaCoc\(c\.deposit, ds, 0, 0\)/);
  assert.match(hd, /S\.thanhLyHopDong\(c\.id, \{[^}]*hoaDonCuoi: q\.hoaDon/);
  assert.match(hd, /S\.hoaDonKyCuoi\(c\.id, ngay, t\.chiSoCuoi\)/);
  assert.match(hd, /St\.goiYPhat\(/);
});
test('bồi thường và phạt nằm trong hóa đơn thanh lý; trang Công nợ có cả hợp đồng đã thanh lý', () => {
  assert.match(hd, /label: 'Bồi thường: ' \+ a\.name/);
  assert.match(hd, /label: 'Phạt trả phòng trước hạn'/);
  assert.match(bill, /c\.status === 'terminated'\);\s*\n\s*const rows = contracts\.map/);
  assert.match(store, /recordPayment\(x\.id, x\.soTien, 'Trừ vào tiền cọc'/);
  assert.match(store, /c\.status = 'terminated'; c\.end = ngay;/);
});
test('biên bản in: mọi chữ lấy từ dữ liệu đều qua U.esc', () => {
  const ham = hd.slice(hd.indexOf('function printSettlement'));
  const boEsc = ham.replace(/U\.esc\((?:[^()]|\([^()]*\))*\)/g, 'ESC');        // bỏ hết các chỗ đã thoát, còn lại là chữ thô
  const tho = boEsc.match(/[^\[\w.](a|b|c|t|l|i)\.(name|tenantName|roomCode|address|contactName|reason|label|meta|id)\b/g) || [];
  assert.deepStrictEqual(tho, [], 'chưa thoát HTML: ' + tho.join(', '));
  assert.ok(boEsc.length < ham.length, 'không thấy U.esc nào');
});
test('tienTheoNgay: làm tròn nghìn cũng không vượt cả tháng; số ngày âm thì 0 đồng', () => {
  assert.strictEqual(T.tienTheoNgay(10900, 30, 31), 10900);               // 10900 x 30/31 = 10548, làm tròn lên 11000 thì vượt
  assert.strictEqual(T.tienTheoNgay(3000000, -5, 30), 0);
  assert.strictEqual(T.tienTheoNgay(3000000, -0.5, 30), 0);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

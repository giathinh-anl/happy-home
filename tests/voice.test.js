/* Kiểm thử nhập liệu bằng giọng nói (js/voice.js): hiểu câu nói thành "phòng nào, chỉ số bao nhiêu".
   Chạy:  node tests/voice.test.js
   Sai một chữ số là sai tiền điện của khách, nên phần này thử rất kỹ và phần giao diện luôn bắt người dùng xác nhận trước khi lưu. */
const assert = require('assert');
const V = require('../js/voice.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};
const R = ['P101', 'P102', 'P201', 'P305'];
const pt = (x, rooms) => V.phanTichChiSo(x, rooms || R);
const tom = (x, rooms) => pt(x, rooms).muc.map(m => `${m.phong || '?' + m.soPhong}=${m.chiSo}${m.loi ? '!' + m.loi : ''}`).join(' ');

console.log('Đọc số bằng chữ');
[['một', 1], ['không', 0], ['mười', 10], ['mười lăm', 15], ['hai mươi', 20], ['hai mươi mốt', 21], ['hai mươi lăm', 25], ['hai mươi tư', 24],
 ['một trăm', 100], ['một trăm linh một', 101], ['một trăm lẻ năm', 105], ['một trăm hai mươi', 120], ['một trăm hai mươi ba', 123],
 ['một nghìn', 1000], ['một ngàn', 1000], ['một nghìn hai trăm', 1200], ['một nghìn hai', 1200], ['một nghìn hai trăm năm mươi', 1250],
 ['một nghìn hai trăm năm mươi lăm', 1255], ['hai nghìn không trăm linh năm', 2005], ['mười nghìn', 10000], ['mười hai nghìn ba trăm', 12300],
 ['một triệu', 1000000], ['chín trăm chín mươi chín', 999]].forEach(([t, v]) => test(`"${t}" = ${v}`, () => assert.strictEqual(V.docSo(t), v)));
console.log('Đọc từng chữ số');
[['một không một', 101], ['hai không ba', 203], ['một hai năm không', 1250], ['hai năm', 25], ['chín chín chín', 999], ['không một', 1], ['1 0 1', 101]]
  .forEach(([t, v]) => test(`"${t}" = ${v}`, () => assert.strictEqual(V.docSo(t), v)));
console.log('Số viết bằng chữ số');
[['1250', 1250], ['1.250', 1250], ['1,250', 1250], ['12.345', 12345], ['  98 ', 98], ['0', 0]].forEach(([t, v]) => test(`"${t}" = ${v}`, () => assert.strictEqual(V.docSo(t), v)));
test('không phải số thì null', () => { assert.strictEqual(V.docSo('xin chào'), null); assert.strictEqual(V.docSo(''), null); assert.strictEqual(V.docSo(null), null); });
test('không phân biệt hoa thường và dấu', () => assert.strictEqual(V.docSo('MỘT NGHÌN HAI TRĂM'), V.docSo('mot nghin hai tram')));

console.log('Hiểu câu nói thành phòng và chỉ số');
test('câu chuẩn', () => assert.strictEqual(tom('phòng 101 điện 1250'), 'P101=1250'));
test('đọc bằng chữ cả phòng và chỉ số', () => assert.strictEqual(tom('phòng một không một điện một nghìn hai trăm năm mươi'), 'P101=1250'));
test('phòng đọc cả số, chỉ số đọc số', () => assert.strictEqual(tom('phòng một trăm linh một điện 1250'), 'P101=1250'));
test('nhiều phòng một câu', () => assert.strictEqual(tom('phòng 101 điện 1250 phòng 102 điện 980 phòng 201 điện 2005'), 'P101=1250 P102=980 P201=2005'));
test('không có chữ "phòng" và "điện": xen kẽ phòng, chỉ số', () => assert.strictEqual(tom('101 1250 102 980'), 'P101=1250 P102=980'));
test('chỉ số đọc bằng "chỉ số" thay vì "điện"', () => assert.strictEqual(tom('phòng 101 chỉ số 1250'), 'P101=1250'));
test('"P" đọc trước số phòng', () => assert.strictEqual(tom('p 101 điện 1250'), 'P101=1250'));
test('từ đệm "là", "số", "ki lô oát" bị bỏ qua', () => assert.strictEqual(tom('phòng số 101 điện là 1250 ki lô oát'), 'P101=1250'));
test('tiếng ừm giữa lúc đọc số không cắt số: một nghìn ừm hai trăm = 1200', () => assert.strictEqual(tom('phòng 101 điện một nghìn ừm hai trăm'), 'P101=1200'));
test('từ nối "là" giữa hai cụm số bằng chữ NGẮT cụm, không ghép thành một số', () => assert.strictEqual(tom('phòng một không một là một nghìn hai trăm'), 'P101=1200'));
test('từ lạ giữa số cũng ngắt: một nghìn xyz hai trăm', () => assert.strictEqual(tom('phòng 101 điện một nghìn xyz hai trăm').split(' ')[0], 'P101=1000'));
test('chỉ số nói trước rồi mới nói phòng: nhờ từ khóa "điện" không bị hiểu thành phòng', () => { const r = pt('điện 1250 phòng 101 điện 980'); assert.strictEqual(tom('điện 1250 phòng 101 điện 980'), 'P101=980'); assert.strictEqual(r.khongHieu.length, 1); });
test('tương tự với từ khóa "chỉ số"', () => assert.strictEqual(tom('chỉ số 1250 phòng 101 chỉ số 980'), 'P101=980'));
test('chỉ gộp nhóm nghìn đúng 3 chữ số: "5 12" là hai số, không phải 512', () => assert.strictEqual(tom('phòng 101 điện 5 12'), 'P101=5 ?12=null!khong-co-phong'));
test('tiếng ừm xen giữa không làm hỏng', () => assert.strictEqual(tom('phòng ừm 101 điện ờ 1250'), 'P101=1250'));
test('số có dấu chấm nghìn', () => assert.strictEqual(tom('phòng 101 điện 1.250'), 'P101=1250'));
test('số bị tách "1 250" sau chữ điện gộp thành 1250', () => assert.strictEqual(tom('phòng 101 điện 1 250'), 'P101=1250'));
test('"1 250" không có chữ điện cũng gộp (sau phòng là chỉ số)', () => assert.strictEqual(tom('phòng 101 1 250'), 'P101=1250'));
test('hai số nhiều chữ số liền nhau KHÔNG bị dính: 101 rồi 250', () => assert.strictEqual(tom('phòng 101 250'), 'P101=250'));
test('đọc từng chữ số bằng chữ số rời "1 0 1" và "1 2 5 0"', () => assert.strictEqual(tom('phòng 1 0 1 điện 1 2 5 0'), 'P101=1250'));
test('viết hoa, không dấu', () => assert.strictEqual(tom('PHONG 101 DIEN 1250'), 'P101=1250'));
test('phòng không có trong tòa được báo lỗi, không đoán', () => assert.strictEqual(tom('phòng 999 điện 100'), '?999=100!khong-co-phong'));
test('hai phòng cùng số (A101, B101) báo trùng, không chọn bừa', () => assert.strictEqual(tom('phòng 101 điện 100', ['A101', 'B101']), '?101=100!trung-phong'));
test('mã phòng có chữ và gạch (A1-01 ứng với số 101)', () => assert.strictEqual(tom('phòng 101 điện 100', ['A1-01', 'A1-02']), 'A1-01=100'));
test('nói phòng mà quên chỉ số: báo thiếu', () => assert.strictEqual(tom('phòng 101'), 'P101=null!thieu-chi-so'));
test('quên chỉ số của phòng giữa chừng không làm lệch phòng sau', () => assert.strictEqual(tom('phòng 101 phòng 102 điện 980'), 'P101=null!thieu-chi-so P102=980'));
test('chỉ số mà chưa nói phòng nào: để ở phần không hiểu', () => { const r = pt('điện 1250'); assert.strictEqual(r.muc.length, 0); assert.strictEqual(r.khongHieu.length, 1); });
test('hai chỉ số cho một phòng: giữ số đầu, số sau thành không hiểu', () => { const r = pt('phòng 101 điện 1250 điện 1300'); assert.strictEqual(tom('phòng 101 điện 1250 điện 1300'), 'P101=1250'); assert.strictEqual(r.khongHieu.length, 1); });
test('câu không có số: rỗng, không lỗi', () => { const r = pt('xin chào các bạn'); assert.deepStrictEqual([r.muc.length, r.khongHieu.length], [0, 0]); });
test('rỗng hoặc null không lỗi', () => { assert.deepStrictEqual(pt('').muc, []); assert.deepStrictEqual(V.phanTichChiSo(null, R).muc, []); });
test('danh sách phòng rỗng: mọi phòng báo không có', () => assert.strictEqual(tom('phòng 101 điện 100', []), '?101=100!khong-co-phong'));
test('chỉ số 0 (đồng hồ mới) được nhận, không bị coi là thiếu', () => assert.strictEqual(tom('phòng 101 điện không'), 'P101=0'));
test('ghi lại câu gốc từng mục để hiện cho người dùng', () => assert.ok(/101/.test(pt('phòng 101 điện 1250').muc[0].goc) && /1250/.test(pt('phòng 101 điện 1250').muc[0].goc)));
test('dấu phẩy thập phân không sinh ra phòng ma có thật (chỉ báo phòng không tồn tại)', () => { const m = pt('phòng 101 điện 1250,5').muc; assert.strictEqual(m[0].chiSo, 1250); assert.ok(m.slice(1).every(x => x.phong === null)); });

console.log('Đánh giá chỉ số vừa nghe');
test('bình thường là ok', () => { const d = V.danhGia({ chiSo: 1250, truoc: 1100, trungBinh: 190 }); assert.deepStrictEqual([d.loai, d.tieuThu], ['ok', 150]); });
test('nhỏ hơn kỳ trước là sai (hay nghe nhầm bớt số)', () => { const d = V.danhGia({ chiSo: 125, truoc: 1100 }); assert.strictEqual(d.loai, 'sai'); assert.ok(/1100/.test(d.ghiChu)); });
test('cao gấp hơn 3 lần mức thường là cảnh báo', () => { const d = V.danhGia({ chiSo: 1800, truoc: 1100, trungBinh: 190 }); assert.strictEqual(d.loai, 'canh-bao'); assert.ok(/3,7/.test(d.ghiChu)); });
test('đúng 3 lần thì chưa cảnh báo', () => assert.strictEqual(V.danhGia({ chiSo: 1100 + 570, truoc: 1100, trungBinh: 190 }).loai, 'ok'));
test('ghi đè số đang có thì cảnh báo, ghi lại đúng số cũ thì không', () => { assert.strictEqual(V.danhGia({ chiSo: 1250, truoc: 1100, hienCo: 1200 }).loai, 'canh-bao'); assert.strictEqual(V.danhGia({ chiSo: 1250, truoc: 1100, hienCo: 1250 }).loai, 'ok'); });
test('bằng kỳ trước: ok nhưng nói rõ không dùng điện', () => { const d = V.danhGia({ chiSo: 1100, truoc: 1100 }); assert.strictEqual(d.loai, 'ok'); assert.ok(/không dùng điện/.test(d.ghiChu)); });
test('chưa có kỳ trước coi như 0; không có mức thường dùng 190 (ngưỡng 570)', () => { assert.strictEqual(V.danhGia({ chiSo: 500 }).loai, 'ok'); assert.strictEqual(V.danhGia({ chiSo: 600 }).loai, 'canh-bao'); });
test('thiếu chỉ số là sai', () => { assert.strictEqual(V.danhGia({ chiSo: null }).loai, 'sai'); assert.strictEqual(V.danhGia(null).loai, 'sai'); assert.strictEqual(V.danhGia({ chiSo: NaN }).loai, 'sai'); });

console.log('Nghe bằng micro (trình duyệt giả)');
class MayNghe {
  constructor() { MayNghe.cuoi = this; }
  start() { if (MayNghe.hong) throw new Error('đang chạy'); this.bat = true; }
  stop() { this.bat = false; if (this.onend) this.onend(); }
}
const ketQua = (...doan) => ({ results: doan.map(([t, xong]) => Object.assign([{ transcript: t }], { isFinal: xong })) });
test('không có API thì hoTro=false và nghe trả null', () => { delete global.window; assert.strictEqual(V.hoTro(), false); assert.strictEqual(V.nghe({}), null); });
test('có API: cấu hình tiếng Việt, nghe liên tục, có chữ tạm', () => {
  global.window = { SpeechRecognition: MayNghe }; MayNghe.hong = false;
  assert.strictEqual(V.hoTro(), true); const h = V.nghe({}); const m = MayNghe.cuoi;
  assert.ok(h && m.bat); assert.strictEqual(m.lang, 'vi-VN'); assert.strictEqual(m.continuous, true); assert.strictEqual(m.interimResults, true);
});
test('chữ từ các đoạn được nối lại từ đầu phiên, báo đã xong khi mọi đoạn đã chốt', () => {
  global.window = { webkitSpeechRecognition: MayNghe }; const nhan = []; V.nghe({ onChu: (t, x) => nhan.push([t, x]) });
  const m = MayNghe.cuoi; m.onresult(ketQua(['phòng 101', true], ['điện 12', false])); m.onresult(ketQua(['phòng 101', true], ['điện 1250', true]));
  assert.deepStrictEqual(nhan, [['phòng 101 điện 12', false], ['phòng 101 điện 1250', true]]);
});
test('lỗi được dịch sang tiếng Việt; "aborted" (tự dừng) không báo lỗi', () => {
  global.window = { SpeechRecognition: MayNghe }; const loi = []; V.nghe({ onLoi: (c) => loi.push(c) }); const m = MayNghe.cuoi;
  m.onerror({ error: 'not-allowed' }); m.onerror({ error: 'aborted' }); m.onerror({ error: 'no-speech' }); m.onerror({ error: 'la-hoai' });
  assert.strictEqual(loi.length, 3); assert.ok(/micro/.test(loi[0])); assert.ok(/Không nghe thấy/.test(loi[1])); assert.ok(/la-hoai/.test(loi[2]));
});
test('dung() dừng micro và báo kết thúc', () => { global.window = { SpeechRecognition: MayNghe }; let kt = 0; const h = V.nghe({ onKetThuc: () => kt++ }); h.dung(); assert.strictEqual(MayNghe.cuoi.bat, false); assert.strictEqual(kt, 1); });
test('không bật được micro thì báo lỗi và trả null', () => { global.window = { SpeechRecognition: MayNghe }; MayNghe.hong = true; const loi = []; const h = V.nghe({ onLoi: (c) => loi.push(c) }); MayNghe.hong = false; assert.strictEqual(h, null); assert.strictEqual(loi.length, 1); });
delete global.window;

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

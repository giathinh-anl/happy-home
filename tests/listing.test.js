/* Kiểm thử trang công khai giới thiệu phòng (js/listing.js).
   Chạy:  node tests/listing.test.js */
if (!process.env.TZ) process.env.TZ = 'Asia/Ho_Chi_Minh';
const assert = require('assert');
const L = require('../js/listing.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

console.log('Mã công khai');
test('mã dài 16 ký tự, chỉ gồm a-z và 0-9', () => { for (let i = 0; i < 200; i++) assert.ok(/^[a-z0-9]{16}$/.test(L.taoMa()), 'mã sai: ' + L.taoMa()); });
test('mã sinh ra luôn hợp lệ theo luật kiểm', () => { for (let i = 0; i < 100; i++) assert.ok(L.slugHopLe(L.taoMa())); });
test('2000 mã không trùng nhau', () => { const s = new Set(); for (let i = 0; i < 2000; i++) s.add(L.taoMa()); assert.strictEqual(s.size, 2000); });
test('byte từ 252 trở lên bị bỏ (không thiên vị ký tự đầu bảng): chỉ toàn byte 252..255 thì chờ byte tốt', () => {
  let lan = 0; const rng = (n) => { lan++; return new Uint8Array(n).fill(lan === 1 ? 255 : 5); };
  assert.strictEqual(L.taoMa(rng), 'f'.repeat(16));          // byte 5 -> KY_TU[5] = 'f'
  assert.ok(lan >= 2);
});
test('byte 251 còn nhận, 252 bị bỏ', () => {
  assert.strictEqual(L.taoMa(() => new Uint8Array(32).fill(251)), '9'.repeat(16));          // 251 % 36 = 35 -> '9'
  let lan = 0; const r252 = (n) => { lan++; return new Uint8Array(n).fill(lan === 1 ? 252 : 0); };
  assert.strictEqual(L.taoMa(r252), 'a'.repeat(16)); assert.ok(lan >= 2);
});
test('đúng phép chia: byte b ra ký tự bảng[b % 36]', () => {
  const rng = () => Uint8Array.from({ length: 32 }, (_, i) => i);
  assert.strictEqual(L.taoMa(rng), 'abcdefghijklmnop');
});
test('luật kiểm mã: nhận 12..40 ký tự a-z0-9, từ chối còn lại', () => {
  ['a'.repeat(12), 'a1'.repeat(20), 'abc123def456'].forEach((s) => assert.ok(L.slugHopLe(s), s));
  ['a'.repeat(11), 'a'.repeat(41), 'ABCDEFGHIJKLMNOP', 'abc-def-ghi-jkl', 'abc def ghi jkl', '', null, undefined, 5, 'abcdefghijkl/../x', "a'; drop table x;--"].forEach((s) => assert.ok(!L.slugHopLe(s), 'nhận nhầm: ' + s));
});
test('luật kiểm mã không bị lừa bởi xuống dòng ở cuối', () => assert.ok(!L.slugHopLe('abcdefghijklmnop\n')));

console.log('\nLink công khai');
test('thêm phong/#mã vào gốc trang, bỏ tên tệp, phần sau # và sau ?', () => {
  const m = 'abcdefghijklmnop';
  assert.strictEqual(L.lienKet('https://giathinh-anl.github.io/happy-home/index.html#/b/b1/units', m), 'https://giathinh-anl.github.io/happy-home/phong/#' + m);
  assert.strictEqual(L.lienKet('https://giathinh-anl.github.io/happy-home/?x=1#/a', m), 'https://giathinh-anl.github.io/happy-home/phong/#' + m);
  assert.strictEqual(L.lienKet('http://127.0.0.1:8777/', m), 'http://127.0.0.1:8777/phong/#' + m);
  assert.strictEqual(L.lienKet('https://x.vn', m), 'https://x.vn/phong/#' + m);
});
test('trang mở từ tệp .html khác (bản demo, bản sao) cũng bỏ tên tệp', () => {
  assert.strictEqual(L.lienKet('https://x.vn/app/happy-home-demo.html#/b/b1', 'abcdefghijklmnop'), 'https://x.vn/app/phong/#abcdefghijklmnop');
});
test('mã sai thì không ra link', () => { assert.strictEqual(L.lienKet('https://x.vn/', 'ngan'), ''); assert.strictEqual(L.lienKet('https://x.vn/', null), ''); });
test('không có gốc thì vẫn ra đường dẫn tương đối', () => assert.strictEqual(L.lienKet('', 'abcdefghijklmnop'), '/phong/#abcdefghijklmnop'));

console.log('\nSố điện thoại liên hệ');
test('chuẩn hóa các cách viết', () => {
  ['0901234567', '+84901234567', '84901234567', '090 123 4567', '090.123.4567', '(090) 123-4567', ' 0901234567 '].forEach((v) => assert.strictEqual(L.chuanSdt(v), '0901234567', v));
});
test('từ chối số sai, rỗng, rác', () => {
  ['901234567', '09012345678', '090123456', 'abc', '', null, undefined, '+8490123456', '0901234567a', '0901 234 56'].forEach((v) => assert.strictEqual(L.chuanSdt(v), null, 'nhận nhầm: ' + v));
});
test('link gọi và link Zalo dùng số đã chuẩn hóa', () => {
  assert.strictEqual(L.linkGoi('+84 901 234 567'), 'tel:0901234567'); assert.strictEqual(L.linkZalo('090-123-4567'), 'https://zalo.me/0901234567');
});
test('số sai thì không có link (tránh tạo tel:/zalo.me giả)', () => { assert.strictEqual(L.linkGoi('abc'), null); assert.strictEqual(L.linkZalo('javascript:alert(1)'), null); });
test('số hiển thị dễ đọc 0901 234 567; sai thì rỗng', () => { assert.strictEqual(L.sdtDep('0901234567'), '0901 234 567'); assert.strictEqual(L.sdtDep('xyz'), ''); });
test('link bản đồ mã hóa địa chỉ; địa chỉ rỗng thì không có link', () => {
  assert.strictEqual(L.linkBanDo('25 Lê Văn Việt, Thủ Đức'), 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('25 Lê Văn Việt, Thủ Đức'));
  assert.ok(L.linkBanDo('a&b=c#d').indexOf('a%26b%3Dc%23d') >= 0);
  [null, undefined, '', '   '].forEach((v) => assert.strictEqual(L.linkBanDo(v), null));
});

console.log('\nẢnh');
const anh = (t, n) => 'data:image/' + t + ';base64,' + 'A'.repeat(n || 20);
test('nhận ảnh nhúng jpeg, png, webp', () => assert.strictEqual(L.anhHopLe([anh('jpeg'), anh('png'), anh('webp')]).length, 3));
test('chặn chuỗi có tiền tố lạ đứng trước data: (lách bộ lọc bằng cách nối thêm)', () => {
  assert.deepStrictEqual(L.anhHopLe(['javascript:alert(1)//data:image/jpeg;base64,AAAA', 'http://x.vn/data:image/png;base64,AAAA', ' data:image/jpeg;base64,AAAA']), []);
});
test('chặn mọi nguồn khác: http, javascript, svg (chạy được mã), gif, ảnh thiếu base64', () => {
  const xau = ['http://x.vn/a.jpg', 'https://x.vn/a.jpg', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/gif;base64,AAAA', 'data:text/html;base64,AAAA', 'data:image/jpeg;base64,', 'data:image/jpeg,AAAA', '', null, 5, {}];
  assert.deepStrictEqual(L.anhHopLe(xau), []);
});
test('chặn chuỗi base64 chứa ký tự lạ (chèn mã vào thuộc tính)', () => assert.deepStrictEqual(L.anhHopLe(['data:image/jpeg;base64,AAA" onerror="alert(1)']), []));
test('tối đa 5 ảnh, giữ thứ tự', () => {
  const ds = Array.from({ length: 8 }, (_, i) => anh('jpeg', 10 + i)); const r = L.anhHopLe(ds); assert.strictEqual(r.length, 5); assert.deepStrictEqual(r, ds.slice(0, 5));
});
test('ảnh nặng quá 700.000 ký tự bị bỏ, đúng 700.000 còn nhận', () => {
  const dau = 'data:image/jpeg;base64,';
  assert.strictEqual(L.anhHopLe([dau + 'A'.repeat(700000 - dau.length)]).length, 1); assert.strictEqual(L.anhHopLe([dau + 'A'.repeat(700001 - dau.length)]).length, 0);
});
test('ảnh xấu xen giữa ảnh tốt: bỏ ảnh xấu, ảnh tốt vẫn vào', () => assert.strictEqual(L.anhHopLe([anh('png'), 'http://x', anh('jpeg')]).length, 2));
test('không phải mảng thì ra mảng rỗng', () => { [null, undefined, 'x', 5, {}].forEach((v) => assert.deepStrictEqual(L.anhHopLe(v), [])); });

console.log('\nTrạng thái nói với người ngoài');
test('trống / đã đặt cọc / đã thuê', () => {
  assert.deepStrictEqual(L.trangThai('vacant'), { ma: 'trong', nhan: 'Còn trống', conTrong: true });
  assert.deepStrictEqual(L.trangThai('reserved'), { ma: 'da-coc', nhan: 'Đã có người đặt cọc', conTrong: false });
  assert.strictEqual(L.trangThai('occupied').ma, 'da-thue');
});
test('mọi trạng thái khác (sắp trả phòng, đang dọn, ngưng) không lộ chi tiết: coi như đã thuê', () => {
  ['notice', 'cleaning', 'inactive', '', null, undefined, 'bat-ky'].forEach((s) => { const t = L.trangThai(s); assert.deepStrictEqual([t.ma, t.conTrong], ['da-thue', false], String(s)); });
});

console.log('\nGiá, thông tin, tiêu đề');
test('giá hiển thị theo tháng', () => assert.strictEqual(L.giaChu(3500000), '3.500.000 ₫/tháng'));
test('giá 0, âm, thiếu, chữ: mời liên hệ', () => [0, -5, null, undefined, 'abc', NaN].forEach((g) => assert.strictEqual(L.giaChu(g), 'Liên hệ để biết giá')));
test('giá chuỗi số vẫn đọc được; dùng hàm định dạng truyền vào', () => { assert.strictEqual(L.giaChu('2000000'), '2.000.000 ₫/tháng'); assert.strictEqual(L.giaChu(1000, (n) => 'T' + n), 'T1000/tháng'); });
test('thông tin: diện tích (dấu phẩy), tầng, số người', () => {
  assert.deepStrictEqual(L.dongThongTin({ area: 20.5, floor: 3, maxOccupants: 2 }), [{ nhan: 'Diện tích', gia: '20,5 m²' }, { nhan: 'Tầng', gia: '3' }, { nhan: 'Tối đa', gia: '2 người' }]);
});
test('tầng 0 là trệt; thiếu số liệu thì bỏ dòng đó', () => {
  assert.deepStrictEqual(L.dongThongTin({ floor: 0 }), [{ nhan: 'Tầng', gia: 'Trệt' }]);
  assert.deepStrictEqual(L.dongThongTin({ area: 0, floor: null, maxOccupants: -1 }), []);
  assert.deepStrictEqual(L.dongThongTin(), []);
});
test('tiêu đề: phòng + tòa nhà; thiếu tòa thì chỉ có phòng', () => {
  assert.strictEqual(L.tieuDe({ code: '301' }, { name: 'Nhà trọ Hoa Hồng' }), 'Phòng 301 · Nhà trọ Hoa Hồng'); assert.strictEqual(L.tieuDe({ code: '301' }, null), 'Phòng 301');
});
test('tin chia sẻ: tiêu đề, giá, thông tin, địa chỉ, link', () => {
  const t = L.tinChiaSe({ code: '301', price: 3000000, area: 20, floor: 3, maxOccupants: 2, status: 'vacant' }, { name: 'Nhà trọ A', address: '1 Lê Lợi' }, 'https://x.vn/phong/#abc');
  ['Phòng 301 · Nhà trọ A đang cho thuê', '3.000.000 ₫/tháng', 'Diện tích 20 m²', 'Địa chỉ: 1 Lê Lợi', 'https://x.vn/phong/#abc'].forEach((x) => assert.ok(t.indexOf(x) >= 0, 'thiếu: ' + x));
});
test('tin chia sẻ: phòng đã có người thì không nói "đang cho thuê"; thiếu địa chỉ thì bỏ dòng', () => {
  const t = L.tinChiaSe({ code: '301', status: 'occupied' }, { name: 'A' }, 'L'); assert.ok(t.indexOf('đang cho thuê') < 0); assert.ok(t.indexOf('Địa chỉ') < 0);
});

console.log(`\n${ok} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);

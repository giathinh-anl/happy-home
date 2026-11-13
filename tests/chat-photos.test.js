/* Kiểm thử ảnh trong chat (js/chat-photos.js).
   Chạy:  node tests/chat-photos.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../js/chat-photos.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const img = (n, kind) => 'data:image/' + (kind || 'jpeg') + ';base64,' + ('QUJD'.repeat(Math.ceil(n / 4) + 1)).slice(0, n);
const doc = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

/* ---------- Khớp với SQL ---------- */
test('giới hạn khớp supabase/migration-chat-photos.sql (3 ảnh, 300.000 mỗi ảnh, 700.000 tổng, dạng ảnh)', () => {
  const sql = doc('supabase/migration-chat-photos.sql');
  assert.ok(sql.includes('jsonb_array_length(p) > ' + C.MAX_ANH), 'số ảnh');
  assert.ok(sql.includes('length(s) > ' + C.MAX_MOI_ANH), 'cỡ mỗi ảnh');
  assert.ok(sql.includes('tong <= ' + C.MAX_TONG), 'tổng cỡ');
  assert.ok(sql.includes('length(data) <= ' + C.MAX_MOI_ANH), 'ràng buộc bảng');
  assert.ok(sql.includes('photo_count between 0 and ' + C.MAX_ANH), 'ràng buộc số ảnh');
  const re = "'^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'";
  assert.strictEqual(sql.split(re).length - 1, 2, 'biểu thức dạng ảnh phải có đúng ở hàm và ở ràng buộc bảng');
});

/* ---------- hopLe ---------- */
test('hopLe: nhận JPG, PNG, WebP; từ chối SVG, GIF, http, javascript, chuỗi hỏng, không phải chuỗi', () => {
  ['jpeg', 'png', 'webp'].forEach((k) => assert.strictEqual(C.hopLe(img(60, k)), true, k));
  ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/gif;base64,R0lGODlh', 'data:text/html;base64,PGgxPg==', 'https://x.vn/a.jpg', 'javascript:alert(1)',
    'data:image/jpeg;base64,', 'data:image/jpeg;base64,ab"onerror="x', 'data:image/jpeg;base64,QUJD QUJD', '', null, undefined, 5, {}, []].forEach((v) => assert.strictEqual(C.hopLe(v), false, String(v)));
});
test('hopLe: đúng giới hạn độ dài (300.000 được, 300.001 không)', () => {
  const pre = 'data:image/jpeg;base64,';
  assert.strictEqual(C.hopLe(img(C.MAX_MOI_ANH - pre.length)), true);
  assert.strictEqual(C.hopLe(img(C.MAX_MOI_ANH + 1 - pre.length)), false);
});

/* ---------- kiem ---------- */
test('kiem: rỗng hoặc không có là hợp lệ, trả bản sao', () => {
  assert.deepStrictEqual(C.kiem([]), { ok: true, anh: [], loi: '' }); assert.deepStrictEqual(C.kiem(null), { ok: true, anh: [], loi: '' }); assert.deepStrictEqual(C.kiem(undefined), { ok: true, anh: [], loi: '' });
  const a = [img(40)], r = C.kiem(a); assert.notStrictEqual(r.anh, a); assert.deepStrictEqual(r.anh, a);
});
test('kiem: 1 đến 3 ảnh tốt thì ok; 4 ảnh bị từ chối kèm câu nói rõ giới hạn', () => {
  [1, 2, 3].forEach((n) => assert.strictEqual(C.kiem(Array(n).fill(img(40))).ok, true, String(n)));
  const r = C.kiem(Array(4).fill(img(40))); assert.strictEqual(r.ok, false); assert.ok(/tối đa 3 ảnh/.test(r.loi)); assert.deepStrictEqual(r.anh, []);
});
test('kiem: một ảnh hỏng làm cả tin không hợp lệ (không gửi một phần)', () => {
  const r = C.kiem([img(40), 'data:image/svg+xml;base64,PHN2Zz4=']); assert.strictEqual(r.ok, false); assert.deepStrictEqual(r.anh, []); assert.ok(r.loi);
  assert.strictEqual(C.kiem([img(40), 5]).ok, false); assert.strictEqual(C.kiem([null]).ok, false);
});
test('kiem: không phải mảng (chuỗi, object, số) không hợp lệ', () => ['x', {}, 5].forEach((v) => assert.strictEqual(C.kiem(v).ok, false, String(v))));
test('kiem: tổng cỡ: 2 ảnh 300.000 (600.000) được; 3 ảnh 250.000 (750.000) bị từ chối', () => {
  const pre = 23;
  assert.strictEqual(C.kiem([img(C.MAX_MOI_ANH - pre), img(C.MAX_MOI_ANH - pre)]).ok, true);
  const r = C.kiem(Array(3).fill(img(250000 - pre))); assert.strictEqual(r.ok, false); assert.ok(/nặng/.test(r.loi));
});
test('kiem: ảnh quá 300.000 bị từ chối', () => assert.strictEqual(C.kiem([img(C.MAX_MOI_ANH + 1 - 23)]).ok, false));

/* ---------- them, bo ---------- */
test('them: cộng dồn tới 3 ảnh, báo số ảnh bị bỏ vì quá giới hạn', () => {
  assert.deepStrictEqual(C.them([], [img(40)]), { anh: [img(40)], thua: 0 });
  const r = C.them([img(40), img(44)], [img(48), img(52), img(56)]); assert.strictEqual(r.anh.length, 3); assert.strictEqual(r.thua, 2); assert.strictEqual(r.anh[2], img(48));
  assert.deepStrictEqual(C.them(Array(3).fill(img(40)), [img(48)]).thua, 1);
});
test('them: bỏ chuỗi không hợp lệ cả ở danh sách cũ và mới; đầu vào lạ không ném lỗi', () => {
  assert.deepStrictEqual(C.them([img(40), 'rac'], ['rac2', img(44)]), { anh: [img(40), img(44)], thua: 0 });
  assert.deepStrictEqual(C.them(null, undefined), { anh: [], thua: 0 }); assert.deepStrictEqual(C.them('x', 5), { anh: [], thua: 0 });
});
test('bo: bỏ đúng vị trí, ngoài khoảng hoặc vị trí lạ thì giữ nguyên, không sửa mảng gốc', () => {
  const a = ['a', 'b', 'c'];
  assert.deepStrictEqual(C.bo(a, 1), ['a', 'c']); assert.deepStrictEqual(C.bo(a, 0), ['b', 'c']); assert.deepStrictEqual(C.bo(a, 2), ['a', 'b']);
  [-1, 3, 99, 1.5, NaN, 'x', null, undefined].forEach((i) => assert.deepStrictEqual(C.bo(a, i), a, String(i)));
  assert.deepStrictEqual(a, ['a', 'b', 'c']); assert.deepStrictEqual(C.bo(null, 0), []);
});

/* ---------- bậc nén ---------- */
test('bậc nén: nhỏ dần cả cạnh lẫn chất lượng, có bậc đầu 1000 px, không bậc nào ngoài khoảng hợp lý', () => {
  assert.strictEqual(C.BAC_NEN[0].canh, 1000);
  for (let i = 1; i < C.BAC_NEN.length; i++) { assert.ok(C.BAC_NEN[i].canh < C.BAC_NEN[i - 1].canh); assert.ok(C.BAC_NEN[i].chatLuong < C.BAC_NEN[i - 1].chatLuong); }
  C.BAC_NEN.forEach((b) => { assert.ok(b.canh >= 320 && b.canh <= 1600); assert.ok(b.chatLuong > 0 && b.chatLuong <= 0.9); });
});

/* ---------- tomTat, coNoiDung, nhanAnh ---------- */
test('tomTat: chữ; chữ kèm ảnh; chỉ ảnh; không có gì', () => {
  assert.strictEqual(C.tomTat({ body: 'Xin chào' }), 'Xin chào');
  assert.strictEqual(C.tomTat({ body: 'Xin chào', photoCount: 2 }), 'Xin chào [2 ảnh]');
  assert.strictEqual(C.tomTat({ body: '', photoCount: 1 }), '[1 ảnh]');
  assert.strictEqual(C.tomTat({ body: '   ', photoCount: 3 }), '[3 ảnh]');
  assert.strictEqual(C.tomTat({}), ''); assert.strictEqual(C.tomTat(null), '');
});
test('tomTat: cắt dài có dấu …, ngắn hơn hoặc bằng giới hạn thì giữ nguyên; đầu vào lạ không ném lỗi', () => {
  const dai = 'a'.repeat(100); const t = C.tomTat({ body: dai }, 20); assert.strictEqual(t.length, 20); assert.ok(t.endsWith('…'));
  assert.strictEqual(C.tomTat({ body: 'a'.repeat(20) }, 20), 'a'.repeat(20));
  assert.ok(C.tomTat({ body: dai }).length <= 70);
  [-5, 0, NaN, 'x'].forEach((v) => assert.ok(C.tomTat({ body: dai }, v).length <= 70));
  assert.strictEqual(C.tomTat({ body: 'x', photoCount: 'abc' }), 'x'); assert.strictEqual(C.tomTat({ body: 'x', photoCount: -4 }), 'x');
});
test('coNoiDung: có chữ hoặc có ảnh mới vẽ bong bóng', () => {
  assert.strictEqual(C.coNoiDung({ body: 'a' }), true); assert.strictEqual(C.coNoiDung({ body: '', photoCount: 1 }), true);
  assert.strictEqual(C.coNoiDung({ body: '  ', photoCount: 0 }), false); assert.strictEqual(C.coNoiDung({}), false); assert.strictEqual(C.coNoiDung(null), false);
});
test('nhanAnh: số ảnh viết gọn, số lạ thành 0', () => {
  assert.strictEqual(C.nhanAnh(1), '1 ảnh'); assert.strictEqual(C.nhanAnh(3), '3 ảnh'); assert.strictEqual(C.nhanAnh(-2), '0 ảnh'); assert.strictEqual(C.nhanAnh(NaN), '0 ảnh'); assert.strictEqual(C.nhanAnh(undefined), '0 ảnh');
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

/* Kiểm thử các phép kiểm của hàm Edge push-send (supabase/functions/push-send/push.ts).
   Chạy:  node tests/push-send.test.js     (cần node 22.18 trở lên: chạy thẳng tệp .ts) */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let ok = 0, hong = 0;
const test = (ten, fn) => Promise.resolve().then(fn).then(() => { ok++; console.log('  ok   ' + ten); }, (e) => { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n')[0]); });

const BI_MAT = 'mot-chuoi-bi-mat-dai-hon-16-ky-tu';
const yc = (headers) => ({ headers: { get: (k) => { const kk = Object.keys(headers || {}).find((x) => x.toLowerCase() === k.toLowerCase()); return kk ? headers[kk] : null; } } });
const K = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', AU = 'tBHItJI5svbpez7KI4CCXg';
const may = (endpoint, o) => Object.assign({ endpoint, p256dh: K, auth: AU }, o || {});

(async () => {
  const P = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'push-send', 'push.ts')).href);

  console.log('Chuỗi bí mật');
  await test('đúng chuỗi thì được phép', () => assert.strictEqual(P.duocPhep(yc({ 'x-push-secret': BI_MAT }), BI_MAT), true));
  await test('cắt khoảng trắng thừa và không phân biệt hoa thường tên header', () => assert.strictEqual(P.duocPhep(yc({ 'X-Push-Secret': '  ' + BI_MAT + ' ' }), BI_MAT), true));
  await test('sai chuỗi, thiếu header, rỗng: từ chối', () => { [yc({ 'x-push-secret': 'sai' }), yc({}), yc({ 'x-push-secret': '' })].forEach(r => assert.strictEqual(P.duocPhep(r, BI_MAT), false)); });
  await test('chưa cấu hình bí mật (rỗng) thì KHÔNG bao giờ mở cửa, kể cả khi người gọi cũng gửi rỗng', () => { assert.strictEqual(P.duocPhep(yc({ 'x-push-secret': '' }), ''), false); assert.strictEqual(P.duocPhep(yc({}), ''), false); });
  await test('chuỗi chỉ khác một ký tự, hoặc là tiền tố của bí mật: từ chối', () => { assert.strictEqual(P.duocPhep(yc({ 'x-push-secret': BI_MAT.slice(0, -1) + 'x' }), BI_MAT), false); assert.strictEqual(P.duocPhep(yc({ 'x-push-secret': BI_MAT.slice(0, 10) }), BI_MAT), false); assert.strictEqual(P.duocPhep(yc({ 'x-push-secret': BI_MAT + 'x' }), BI_MAT), false); });
  await test('mã gửi qua ?key= hay Authorization không được chấp nhận (chỉ header riêng)', () => assert.strictEqual(P.duocPhep(yc({ authorization: 'Bearer ' + BI_MAT }), BI_MAT), false));

  console.log('Địa chỉ đăng ký');
  const tot = ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/xyz', 'https://web.push.apple.com/Qabc', 'https://wns2-par02p.notify.windows.com/w/?token=1'];
  await test('bốn dịch vụ đẩy thật được nhận', () => tot.forEach(u => assert.strictEqual(P.endpointOk(u), true, u)));
  await test('http thường, địa chỉ nội bộ, tên giả mạo, kiểu lạ: từ chối', () => ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest', 'https://fcm.googleapis.com.evil.com/x', 'https://evil.com/fcm.googleapis.com/', 'https://evilpush.apple.com/x', 'https://fcm.googleapis.com', 'ftp://web.push.apple.com/x', '', 'https://fcm.googleapis.com/a b'].forEach(u => assert.strictEqual(P.endpointOk(u), false, u)));
  await test('không phải chuỗi, quá dài: từ chối', () => { [null, undefined, 123, {}, []].forEach(u => assert.strictEqual(P.endpointOk(u), false)); assert.strictEqual(P.endpointOk('https://fcm.googleapis.com/' + 'a'.repeat(1100)), false); });

  console.log('Lọc danh sách máy');
  await test('giữ máy hợp lệ, bỏ máy sai địa chỉ hoặc sai khóa', () => {
    const r = P.locMay([may(tot[0]), may('https://evil.com/x'), may(tot[1], { p256dh: 'ngan' }), may(tot[2], { auth: 'x' }), may(tot[3]), null, 'x', 5]);
    assert.deepStrictEqual(r.map(m => m.endpoint), [tot[0], tot[3]]);
  });
  await test('bỏ trùng địa chỉ', () => assert.strictEqual(P.locMay([may(tot[0]), may(tot[0]), may(tot[0])]).length, 1));
  await test('tối đa 50 máy', () => assert.strictEqual(P.locMay(Array.from({ length: 80 }, (_, i) => may('https://fcm.googleapis.com/fcm/send/d' + i))).length, 50));
  await test('không phải mảng: trả mảng rỗng', () => { [null, undefined, 'x', {}, 5].forEach(x => assert.deepStrictEqual(P.locMay(x), [])); });
  await test('chỉ giữ ba trường, không mang theo trường lạ', () => assert.deepStrictEqual(Object.keys(P.locMay([may(tot[0], { evil: 1 })])[0]).sort(), ['auth', 'endpoint', 'p256dh']));

  console.log('Nội dung thông báo');
  const nd = (b) => { const s = P.taoNoiDung(b); return s && JSON.parse(s); };
  await test('đủ tiêu đề, nội dung, đường dẫn', () => assert.deepStrictEqual(nd({ title: 'Sắp đến hạn', body: 'Hạn 5/11', url: '#/invoices' }), { title: 'Sắp đến hạn', body: 'Hạn 5/11', url: '#/invoices' }));
  await test('thiếu tiêu đề: không gửi (null)', () => { [{}, { title: '' }, { title: '   ' }, { title: 5 }, { body: 'x' }].forEach(b => assert.strictEqual(P.taoNoiDung(b), null)); });
  await test('tiêu đề cắt 80, nội dung cắt 160', () => { const r = nd({ title: 'T'.repeat(200), body: 'B'.repeat(500), url: '#/chat' }); assert.strictEqual(r.title.length, 80); assert.strictEqual(r.body.length, 160); });
  await test('ký tự điều khiển bị đổi thành khoảng trắng', () => assert.strictEqual(nd({ title: 'a\u0000b\nc', url: '#/home' }).title, 'a b c'));
  await test('đường dẫn lạ (javascript:, http, có ký tự đặc biệt, quá dài) về #/home', () => ['javascript:alert(1)', 'https://evil.com', '#/a?b=c', '#/', '#/' + 'a'.repeat(50), '/invoices', null, 5].forEach(u => assert.strictEqual(nd({ title: 't', url: u }).url, '#/home', String(u))));
  await test('đường dẫn đúng dạng được giữ: #/invoices, #/chat, #/invoice/HD2610001', () => ['#/invoices', '#/chat', '#/invoice/HD2610001'].forEach(u => assert.strictEqual(nd({ title: 't', url: u }).url, u)));
  await test('nội dung thiếu thì để rỗng, không ném lỗi', () => assert.strictEqual(nd({ title: 't' }).body, ''));

  console.log('Máy không còn nhận được');
  await test('404 và 410 thì xóa; lỗi khác (429, 500, 413, không có mã) thì giữ', () => { [404, 410].forEach(c => assert.strictEqual(P.maBiXoa(c), true)); [200, 201, 400, 401, 413, 429, 500, 503, undefined, null, '410'].forEach(c => assert.strictEqual(P.maBiXoa(c), false, String(c))); });

  console.log('Công cụ tạo khóa VAPID');
  const { taoKhoa } = require('../tools/push/tao-khoa-vapid.js');
  const H = require('../tenant-app/js/helpers.js');
  await test('khóa công khai 65 byte bắt đầu 0x04, khóa bí mật 32 byte, đều là base64 URL không có dấu = + /', () => {
    const k = taoKhoa();
    assert.ok(/^[A-Za-z0-9_-]+$/.test(k.congKhai) && /^[A-Za-z0-9_-]+$/.test(k.biMat));
    const pub = H.urlBase64ToBytes(k.congKhai), prv = H.urlBase64ToBytes(k.biMat);
    assert.strictEqual(pub.length, 65); assert.strictEqual(pub[0], 4); assert.strictEqual(prv.length, 32);
  });
  await test('mỗi lần tạo ra một cặp khác nhau', () => { const a = taoKhoa(), b = taoKhoa(); assert.notStrictEqual(a.congKhai, b.congKhai); assert.notStrictEqual(a.biMat, b.biMat); });
  await test('khóa công khai ghép đúng với khóa bí mật (ký bằng bí mật, kiểm bằng công khai)', () => {
    const crypto = require('crypto'), k = taoKhoa();
    const pubBytes = Buffer.from(k.congKhai, 'base64url');
    const pubKey = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pubBytes.subarray(1, 33).toString('base64url'), y: pubBytes.subarray(33, 65).toString('base64url') }, format: 'jwk' });
    const prvKey = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', x: pubBytes.subarray(1, 33).toString('base64url'), y: pubBytes.subarray(33, 65).toString('base64url'), d: k.biMat }, format: 'jwk' });
    const sig = crypto.sign('sha256', Buffer.from('thong bao'), prvKey);
    assert.strictEqual(crypto.verify('sha256', Buffer.from('thong bao'), pubKey, sig), true);
  });

  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

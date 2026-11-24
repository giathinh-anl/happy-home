/* Kiểm thử thông báo đẩy cho CHỦ TRỌ phía trình duyệt: luật chọn trạng thái (js/notify.js), service worker của web chủ trọ (sw.js)
   chạy trong "self" giả, và việc nối vào trang Cài đặt chung. Phần máy chủ: tests/db/owner-push.test.py.
   Chạy:  node tests/owner-push.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const N = require('../js/notify.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

/* ============================================================
   Luật
   ============================================================ */
const du = (o) => Object.assign({ chu: true, coMayChu: true, coKhoa: true, coSW: true, coPush: true, coThongBao: true, quyen: 'default', daBat: false, ios: false, daCai: false }, o);
test('cheDoDay: không phải chủ trọ, bản demo, chưa có khóa VAPID thì ẩn hẳn', () => {
  assert.strictEqual(N.cheDoDay(du({ chu: false })), 'an');
  assert.strictEqual(N.cheDoDay(du({ coMayChu: false })), 'an');
  assert.strictEqual(N.cheDoDay(du({ coKhoa: false })), 'an');
  assert.strictEqual(N.cheDoDay(null), 'an');
});
test('cheDoDay: iPhone chưa thêm vào màn hình chính thì hướng dẫn cài; trình duyệt khác thiếu tính năng thì báo không hỗ trợ', () => {
  assert.strictEqual(N.cheDoDay(du({ coPush: false, ios: true })), 'can-cai');
  assert.strictEqual(N.cheDoDay(du({ coThongBao: false, ios: true, daCai: false })), 'can-cai');
  assert.strictEqual(N.cheDoDay(du({ coPush: false, ios: true, daCai: true })), 'khong-ho-tro');
  assert.strictEqual(N.cheDoDay(du({ coSW: false })), 'khong-ho-tro');
});
test('cheDoDay: bị chặn, đang bật, chưa bật', () => {
  assert.strictEqual(N.cheDoDay(du({ quyen: 'denied', daBat: true })), 'bi-chan');
  assert.strictEqual(N.cheDoDay(du({ quyen: 'granted', daBat: true })), 'dang-bat');
  assert.strictEqual(N.cheDoDay(du({ quyen: 'granted' })), 'chua-bat');
});
test('khoaThanhByte: đổi khóa VAPID base64 an toàn cho URL ra 65 byte, byte đầu 0x04', () => {
  const k = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
  const b = N.khoaThanhByte(k);
  assert.strictEqual(b.length, 65); assert.strictEqual(b[0], 4);
  assert.strictEqual(Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), k);
  assert.strictEqual(N.khoaThanhByte('').length, 0);
});
test('duongTuThongBao: "#/b/b1/support" -> "/b/b1/support"; dạng lạ về Tổng quan', () => {
  assert.strictEqual(N.duongTuThongBao('#/b/b1/support'), '/b/b1/support');
  assert.strictEqual(N.duongTuThongBao('#/transfers'), '/transfers');
  ['javascript:alert(1)', 'https://evil.com', '#/a?x=1', '#/../x y', '', null, 5].forEach((x) => assert.strictEqual(N.duongTuThongBao(x), '/dashboard', String(x)));
});

/* ============================================================
   Service worker của web chủ trọ (sw.js) trong "self" giả
   ============================================================ */
const GOC = 'https://giathinh-anl.github.io/happy-home/';
function dung(dangMo) {
  const h = {}, log = { notes: [], opened: [], posts: [], focused: 0 };
  const clients = dangMo.map((url) => ({ url, postMessage: (m) => log.posts.push({ url, m }), focus: async () => { log.focused++; return null; } }));
  const self = {
    addEventListener: (t, fn) => { h[t] = fn; },
    registration: { scope: GOC, showNotification: async (title, opt) => { log.notes.push({ title, opt }); } },
    clients: { matchAll: async () => clients, openWindow: async (u) => { log.opened.push(u); return null; }, claim: async () => {} },
    skipWaiting: async () => {},
  };
  vm.runInNewContext(doc('sw.js'), { self, URL, Request: function () {}, setTimeout, caches: { open: async () => ({ put: async () => {}, keys: async () => [], delete: async () => {} }), keys: async () => [], delete: async () => {}, match: async () => null },
    fetch: async () => ({ ok: true, clone: () => ({}), text: async () => '' }), Promise, Set, console });
  const chay = async (ten, ev) => { let p; ev.waitUntil = (x) => { p = x; }; h[ten](ev); await p; return log; };
  return { h, log, push: (data) => chay('push', { data: data === undefined ? null : { json: () => { if (typeof data === 'string') throw new Error('x'); return data; }, text: () => String(data) } }),
    click: (hash) => { const n = { close() { n.dong = true; }, data: hash === undefined ? undefined : { hash } }; return chay('notificationclick', { notification: n }).then(() => n); } };
}
test('sw.js: vẫn đủ các sự kiện cũ (install, activate, fetch) và thêm push, notificationclick', () => {
  const s = dung([]); ['install', 'activate', 'fetch', 'push', 'notificationclick'].forEach((t) => assert.ok(s.h[t], t));
  assert.ok(+/const PHIEN_BAN = (\d+)/.exec(doc('sw.js'))[1] >= 3, 'phải nâng PHIEN_BAN để máy cài lại service worker');
});
test('nhận thông báo: tiêu đề, nội dung, biểu tượng, giữ đường dẫn tới đúng trang', async () => {
  const s = dung([]); await s.push({ title: 'Tin nhắn mới · P101', body: 'An: vòi nước rỉ', url: '#/b/b1/support' });
  const n = s.log.notes[0];
  assert.strictEqual(n.title, 'Tin nhắn mới · P101'); assert.strictEqual(n.opt.body, 'An: vòi nước rỉ');
  assert.strictEqual(n.opt.data.hash, '#/b/b1/support'); assert.strictEqual(n.opt.icon, GOC + 'assets/icon-192.png');
  assert.strictEqual(n.opt.tag, 'hh-chu#/b/b1/support'); assert.strictEqual(n.opt.renotify, true);
});
test('đường dẫn lạ thì về #/dashboard; thiếu tiêu đề dùng "Happy Home"; chữ dài bị cắt; nội dung không phải JSON vẫn hiện', async () => {
  for (const u of ['javascript:alert(1)', 'https://evil.com', '#/a?b=1', undefined]) { const s = dung([]); await s.push({ title: 't', url: u }); assert.strictEqual(s.log.notes[0].opt.data.hash, '#/dashboard', String(u)); }
  const s = dung([]); await s.push({ body: 'x' }); assert.strictEqual(s.log.notes[0].title, 'Happy Home');
  const t = dung([]); await t.push({ title: 'T'.repeat(200), body: 'B'.repeat(500) }); assert.strictEqual(t.log.notes[0].title.length, 80); assert.strictEqual(t.log.notes[0].opt.body.length, 160);
  const u = dung([]); await u.push('chuỗi trơn'); assert.strictEqual(u.log.notes[0].opt.body, 'chuỗi trơn');
});
test('bấm thông báo khi web chủ trọ đang mở: gửi lệnh đi tới trang cho tab đó, đưa lên trước, không mở cửa sổ mới', async () => {
  const s = dung([GOC + 'index.html#/dashboard']); const n = await s.click('#/transfers');
  assert.strictEqual(n.dong, true); assert.strictEqual(JSON.stringify(s.log.posts[0].m), JSON.stringify({ type: 'go', hash: '#/transfers' }));
  assert.strictEqual(s.log.focused, 1); assert.strictEqual(s.log.opened.length, 0);
});
test('chỉ có tab app khách thuê / trang khác đang mở: KHÔNG dùng tab đó, mở web chủ trọ mới đúng trang', async () => {
  const s = dung([GOC + 'tenant-app/index.html#/home', GOC + 'join/?x', GOC + 'phong/abc', GOC + 'gioi-thieu/']);
  await s.click('#/b/b1/incidents');
  assert.strictEqual(s.log.posts.length, 0); assert.deepStrictEqual(s.log.opened, [GOC + 'index.html#/b/b1/incidents']);
});
test('bấm thông báo có đường dẫn lạ: mở Tổng quan', async () => { const s = dung([]); await s.click('javascript:x'); assert.deepStrictEqual(s.log.opened, [GOC + 'index.html#/dashboard']); });

/* ============================================================
   Nối vào app: đối chiếu mã nguồn
   ============================================================ */
const ui = doc('js/notify-ui.js'), more = doc('js/pages/more.js'), html = doc('index.html');
test('notify-ui.js: bật thì xin quyền, đăng ký với khóa VAPID rồi báo máy chủ; máy chủ không nhận thì gỡ đăng ký vừa tạo', () => {
  assert.match(ui, /if \(\(await xinQuyen\(\)\) !== 'granted'\) throw/);
  assert.match(ui, /pushManager\.subscribe\(\{ userVisibleOnly: true, applicationServerKey: N\.khoaThanhByte\(VAPID\(\)\) \}\)/);
  assert.match(ui, /goiMayChu\('owner_push_subscribe'/);
  assert.match(ui, /catch \(e\) \{ if \(moi\) \{ try \{ await sub\.unsubscribe\(\); \}/);
  assert.match(ui, /goiMayChu\('owner_push_unsubscribe'/); assert.match(ui, /goiMayChu\('owner_push_test'\)/);
});
test('notify-ui.js: nhận lệnh "go" từ service worker thì chuyển trang bằng router (qua duongTuThongBao)', () => {
  assert.match(ui, /e\.data\.type === 'go'\) \{ try \{ HH\.router\.go\(N\.duongTuThongBao\(e\.data\.hash\)\)/);
});
test('notify-ui.js: máy chủ chưa chạy migration (PGRST202) thì báo rõ, không báo lỗi khó hiểu', () => {
  assert.match(ui, /loi\.code === 'PGRST202'/); assert.match(ui, /chưa chạy migration-owner-push\.sql/);
});
test('Cài đặt chung: có chỗ cho mục "Báo cả khi đã đóng web", hiện theo trạng thái máy, chữ đều qua U.esc', () => {
  assert.match(more, /<div id="bvDay"><\/div>/);
  ['chua-bat', 'dang-bat', 'bi-chan', 'can-cai', 'khong-ho-tro'].forEach((k) => assert.ok(more.includes(`'${k}': [`), k));
  assert.match(more, /\$\{U\.esc\(moTa\)\}/); assert.match(more, /\$\{U\.esc\(nhan\)\}/);
  assert.match(more, /await UIb\.batDay\(\)/); assert.match(more, /await UIb\.tatDay\(\)/); assert.match(more, /await UIb\.thuDay\(\)/);
});
test('đã nâng số phiên bản các tệp đổi', () => {
  assert.ok(+/js\/notify\.js\?v=(\d+)/.exec(html)[1] >= 2 && +/js\/notify-ui\.js\?v=(\d+)/.exec(html)[1] >= 2 && +/pages\/more\.js\?v=(\d+)/.exec(html)[1] >= 116);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

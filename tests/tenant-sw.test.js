/* Kiểm thử phần thông báo đẩy của service worker app khách (tenant-app/sw.js): nhận thông báo, bấm vào thì mở đúng màn.
   Chạy:  node tests/tenant-sw.test.js
   Chạy sw.js trong một "self" giả (không có trình duyệt): ghi lại lời gọi showNotification, matchAll, openWindow, postMessage. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let ok = 0, hong = 0;
const test = (ten, fn) => Promise.resolve().then(fn).then(() => { ok++; console.log('  ok   ' + ten); }, (e) => { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n')[0]); });

const SCOPE = 'https://giathinh-anl.github.io/happy-home/tenant-app/';
function dung(clientsDangMo) {
  const h = {}, log = { notes: [], opened: [], posts: [], focused: 0 };
  const clients = clientsDangMo.map(url => ({ url, postMessage: (m) => log.posts.push({ url, m }), focus: async () => { log.focused++; return null; } }));
  const self = {
    addEventListener: (t, fn) => { h[t] = fn; },
    registration: { scope: SCOPE, showNotification: async (title, opt) => { log.notes.push({ title, opt }); } },
    clients: { matchAll: async () => clients, openWindow: async (u) => { log.opened.push(u); return null; }, claim: async () => {} },
    skipWaiting: () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'tenant-app', 'sw.js'), 'utf8'), { self, URL, caches: { open: async () => ({ addAll: async () => {}, put: async () => {} }), keys: async () => [], delete: async () => {}, match: async () => null }, fetch: async () => ({ clone: () => ({}) }), Promise, Set, console });
  const chay = async (ten, ev) => { let p; ev.waitUntil = (x) => { p = x; }; h[ten](ev); await p; return log; };
  return { h, log, push: (data) => chay('push', { data: data === undefined ? null : { json: () => { if (typeof data === 'string') throw new Error('không phải JSON'); return data; }, text: () => String(data) } }),
    click: (hash) => { const n = { close() { n.dong = true; }, data: hash === undefined ? undefined : { hash } }; return chay('notificationclick', { notification: n }).then(() => n); } };
}

(async () => {
  console.log('Nhận thông báo');
  await test('đăng ký đủ ba sự kiện: push, notificationclick (và các sự kiện cũ vẫn còn)', () => { const s = dung([]); assert.ok(s.h.push && s.h.notificationclick && s.h.install && s.h.fetch); });
  await test('hiện thông báo với tiêu đề, nội dung, biểu tượng, mở đúng màn khi bấm', async () => {
    const s = dung([]); await s.push({ title: 'Sắp đến hạn đóng tiền', body: 'Hạn 5/11', url: '#/invoices' });
    assert.strictEqual(s.log.notes.length, 1); const n = s.log.notes[0];
    assert.strictEqual(n.title, 'Sắp đến hạn đóng tiền'); assert.strictEqual(n.opt.body, 'Hạn 5/11'); assert.strictEqual(n.opt.data.hash, '#/invoices');
    assert.ok(/icon-192\.png$/.test(n.opt.icon));
  });
  await test('cùng một màn thì gộp (tag giống nhau), có báo lại', async () => { const s = dung([]); await s.push({ title: 'a', url: '#/chat' }); await s.push({ title: 'b', url: '#/chat' }); assert.strictEqual(s.log.notes[0].opt.tag, 'hh#/chat'); assert.strictEqual(s.log.notes[1].opt.tag, 'hh#/chat'); assert.strictEqual(s.log.notes[0].opt.renotify, true); });
  await test('đường dẫn lạ (javascript:, http, thiếu) thì về #/home', async () => { for (const u of ['javascript:alert(1)', 'https://evil.com', '#/a?b=1', undefined, 5]) { const s = dung([]); await s.push({ title: 't', url: u }); assert.strictEqual(s.log.notes[0].opt.data.hash, '#/home', String(u)); } });
  await test('thiếu tiêu đề thì dùng "Happy Home"; tiêu đề và nội dung dài bị cắt', async () => {
    const s = dung([]); await s.push({ body: 'x' }); assert.strictEqual(s.log.notes[0].title, 'Happy Home');
    const t = dung([]); await t.push({ title: 'T'.repeat(200), body: 'B'.repeat(500) }); assert.strictEqual(t.log.notes[0].title.length, 80); assert.strictEqual(t.log.notes[0].opt.body.length, 160);
  });
  await test('nội dung không phải JSON (chuỗi trơn) vẫn hiện được, không ném lỗi', async () => { const s = dung([]); await s.push('chào anh chị'); assert.strictEqual(s.log.notes[0].title, 'Happy Home'); assert.strictEqual(s.log.notes[0].opt.body, 'chào anh chị'); });
  await test('thông báo không kèm dữ liệu cũng hiện', async () => { const s = dung([]); await s.push(undefined); assert.strictEqual(s.log.notes.length, 1); });

  console.log('Bấm vào thông báo');
  await test('app đang mở: gửi lệnh đi tới màn đó cho tab, đưa tab lên trước, KHÔNG mở cửa sổ mới', async () => {
    const s = dung([SCOPE + 'index.html#/home']); const n = await s.click('#/invoices');
    assert.strictEqual(n.dong, true); assert.strictEqual(JSON.stringify(s.log.posts[0].m), JSON.stringify({ type: 'go', hash: '#/invoices' })); assert.strictEqual(s.log.focused, 1); assert.strictEqual(s.log.opened.length, 0);
  });
  await test('app chưa mở: mở cửa sổ mới đúng màn', async () => { const s = dung([]); await s.click('#/chat'); assert.deepStrictEqual(s.log.opened, [SCOPE + 'index.html#/chat']); assert.strictEqual(s.log.posts.length, 0); });
  await test('tab của trang khác (không thuộc app khách) thì không dùng', async () => { const s = dung(['https://giathinh-anl.github.io/happy-home/index.html#/dashboard']); await s.click('#/invoices'); assert.strictEqual(s.log.posts.length, 0); assert.strictEqual(s.log.opened.length, 1); });
  await test('thông báo không kèm đường dẫn: về #/home', async () => { const s = dung([]); await s.click(undefined); assert.deepStrictEqual(s.log.opened, [SCOPE + 'index.html#/home']); });
  await test('nhiều tab đang mở: chỉ gọi một tab', async () => { const s = dung([SCOPE + 'index.html#/a', SCOPE + 'index.html#/b']); await s.click('#/chat'); assert.strictEqual(s.log.posts.length, 1); assert.strictEqual(s.log.focused, 1); });

  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

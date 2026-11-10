/* Happy Home — Service worker cho app khách thuê (PWA)
   Chiến lược: mạng trước, có lỗi thì lấy bản đã lưu (để mở được khi mạng chập chờn).
   KHÔNG lưu cache lệnh gọi API Supabase — dữ liệu phải luôn mới. */
const CACHE = 'hh-tenant-v24';
const SHELL = ['./', './index.html', '../css/tokens.css', './css/tenant.css', './js/tenant.js', './manifest.webmanifest',
  '../js/icons.js', '../js/motion.js', '../js/nlu.js', '../js/gemini.js', '../js/split.js', '../js/dates.js', '../js/bank-info.js', '../js/progress.js', './js/helpers.js', '../assets/logo-mark.svg', '../assets/logo-icon.svg', '../assets/icon-192.png', '../assets/icon-512.png', '../assets/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Không đụng vào API/CDN — luôn lấy từ mạng
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});

/* Thông báo đẩy (hàm Edge push-send gửi tới). Nội dung: { title, body, url } với url dạng "#/invoices". */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Happy Home', body: e.data ? e.data.text() : '' }; }
  const hash = /^#\/[A-Za-z0-9/_-]{1,40}$/.test(d.url || '') ? d.url : '#/home';
  e.waitUntil(self.registration.showNotification(String(d.title || 'Happy Home').slice(0, 80), {
    body: String(d.body || '').slice(0, 160), icon: '../assets/icon-192.png', badge: '../assets/icon-192.png',
    tag: 'hh' + hash, renotify: true, data: { hash } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.hash) || '#/home';
  const base = new URL('./', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((x) => x.url.startsWith(base));
    if (c) { c.postMessage({ type: 'go', hash }); return c.focus(); }
    return self.clients.openWindow(base + 'index.html' + hash);
  }));
});

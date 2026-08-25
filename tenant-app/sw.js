/* Happy Home — Service worker cho app khách thuê (PWA)
   Chiến lược: mạng trước, có lỗi thì lấy bản đã lưu (để mở được khi mạng chập chờn).
   KHÔNG lưu cache lệnh gọi API Supabase — dữ liệu phải luôn mới. */
const CACHE = 'hh-tenant-v1';
const SHELL = ['./', './index.html', './css/tokens.css', './css/tenant.css', './js/tenant.js', './manifest.webmanifest'];

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

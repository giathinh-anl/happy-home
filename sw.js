/* Happy Home — Service worker của bản quản trị (chủ trọ / nhân viên)
   Mục đích: mở được app khi không có mạng (để ghi chỉ số ở nơi mất sóng, xem js/offline.js) và cài được như một ứng dụng.

   Chiến lược: MẠNG TRƯỚC, có lỗi hoặc quá chậm (mạng yếu) thì lấy bản đã lưu. Nên khi có mạng luôn là bản mới nhất,
   không cần nhớ đổi số phiên bản mỗi lần cập nhật.
   Chỉ lưu: tệp của chính trang này (HTML, CSS, JS, hình) và SDK Supabase. KHÔNG đụng tới:
   - lệnh gọi API Supabase (dữ liệu phải luôn mới, và không để dữ liệu khách nằm trong bộ nhớ đệm của service worker),
   - app khách thuê (tenant-app/) và trang khách tự khai (join/): hai nơi đó tự có cách riêng. */
const PHIEN_BAN = 1;                       // đổi số này khi sửa tệp này, để trình duyệt cài lại
const CACHE = 'hh-admin-v1';
const GOC = new URL(self.registration.scope);              // thư mục chứa sw.js (gốc của trang)
const VAO = new URL('index.html', GOC).href;
const BO_QUA = ['tenant-app/', 'join/'].map(p => new URL(p, GOC).pathname);
const CDN_CAN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js';
const CHO_MANG_MS = 5000;                  // mạng chậm hơn thế thì dùng bản đã lưu (nếu có)

const laCuaMinh = (u) => u.origin === GOC.origin;
const nenBoQua = (u) => (laCuaMinh(u) ? BO_QUA.some(p => u.pathname.startsWith(p)) : u.href.indexOf(CDN_CAN) !== 0);

// Cài đặt: tải sẵn trang chính và mọi tệp mà nó nhắc tới (đọc từ index.html nên không phải giữ danh sách tay)
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch(VAO, { cache: 'reload' });
    if (!res.ok) throw new Error('Không tải được index.html');
    await cache.put(VAO, res.clone());
    const html = await res.text();
    const urls = new Set(['assets/logo-mark.svg', 'assets/logo-icon.svg', 'assets/icon-192.png']);
    for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) urls.add(m[1]);
    await Promise.all(Array.from(urls).map(async (u) => {
      try {
        const abs = new URL(u, GOC);
        if (abs.href === VAO || nenBoQua(abs) || /^(data|mailto):/.test(u)) return;
        const r = await fetch(abs.href);
        if (r.ok) await cache.put(abs.href, r);
      } catch (err) { /* một tệp lỗi không làm hỏng cả lần cài */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('hh-admin-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Lưu bản mới của một tệp, bỏ các bản cũ cùng đường dẫn khác ?v=N (mỗi lần cập nhật đổi số v, không để chất đống)
async function luu(cache, key, res) {
  await cache.put(key, res);
  const u = new URL(key.url || key);
  if (!laCuaMinh(u) || !u.search) return;
  for (const k of await cache.keys()) {
    const ku = new URL(k.url);
    if (ku.origin === u.origin && ku.pathname === u.pathname && ku.href !== u.href) await cache.delete(k);
  }
}

async function mangTruoc(req) {
  const cache = await caches.open(CACHE);
  const dieuHuong = req.mode === 'navigate';
  const key = dieuHuong ? VAO : req;                       // mọi lần mở trang đều dùng chung một bản index.html
  const mang = fetch(req).then((res) => {
    if (res && res.ok && res.type !== 'opaque') luu(cache, dieuHuong ? new Request(VAO) : req, res.clone()).catch(() => {});
    return res;
  });
  mang.catch(() => {});                                    // tránh báo lỗi chưa xử lý khi đã chuyển sang bản lưu
  try {
    const kq = await Promise.race([mang, new Promise((xong) => setTimeout(xong, CHO_MANG_MS, null))]);
    if (kq) return kq;                                     // có phản hồi kịp lúc (kể cả lỗi 404 của máy chủ)
  } catch (err) { /* mất mạng hẳn */ }
  const hit = await cache.match(key);
  return hit || mang;                                      // chưa từng lưu thì đành đợi mạng
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (nenBoQua(u)) return;                                 // để trình duyệt tự xử lý
  // Chỉ trang chính mới thay bản index.html đã lưu; điều hướng tới tệp khác trong thư mục (tài liệu, .sql...) thì để trình duyệt tự xử lý
  if (req.mode === 'navigate' && u.pathname !== GOC.pathname && u.href !== VAO) return;
  e.respondWith(mangTruoc(req));
});

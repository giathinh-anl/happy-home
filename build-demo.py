# -*- coding: utf-8 -*-
"""
Gộp toàn bộ web quản trị thành MỘT tệp HTML để chia sẻ (bản demo).

    python build-demo.py            -> demo/happy-home-demo.html

Bản gộp KHÔNG kèm js/config.js nên chạy ở chế độ demo: dữ liệu mẫu nằm trong
trình duyệt của từng người xem (localStorage), không đụng tới Supabase thật.
"""
import io, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, 'demo')
OUT = os.path.join(OUT_DIR, 'happy-home-demo.html')

CSS = ['tokens.css', 'base.css', 'layout.css', 'components.css', 'pages.css']
JS = [
    'js/utils.js', 'js/icons.js', 'js/charts.js',
    'js/backend.js', 'js/store.js', 'js/components.js',
    'js/pages/auth-dashboard.js', 'js/pages/rooms.js', 'js/pages/tenants.js',
    'js/pages/contracts.js', 'js/pages/billing.js', 'js/pages/misc.js', 'js/pages/more.js',
    'js/nlu.js', 'js/gemini.js', 'js/ai.js', 'js/assistant.js',
    'js/router.js', 'js/app.js',
]


def read(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def data_uri(rel, mime):
    """Nhúng tệp ảnh vào thẳng trang (bản gộp chỉ có 1 tệp, không kèm thư mục assets)."""
    import base64
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode('ascii'))


ASSETS = [
    ('assets/logo-mark.svg', 'image/svg+xml'),
    ('assets/logo-icon.svg', 'image/svg+xml'),
    ('assets/logo-3d.webp', 'image/webp'),
]


def main():
    css = '\n\n'.join('/* ===== %s ===== */\n%s' % (n, read('css/' + n)) for n in CSS)

    js_parts = []
    for rel in JS:
        src = read(rel)
        if rel.endswith('auth-dashboard.js'):
            # Bản gộp không có app khách thuê đi kèm -> đổi thành ghi chú
            src = src.replace(
                '<a href="tenant-app/index.html" style="text-align:center;display:block;margin-top:4px">'
                'Bạn là khách thuê? Đăng nhập tại đây →</a>',
                '<p class="muted text-xs" style="text-align:center;margin-top:4px">'
                'Bản demo này chỉ có trang quản trị. App khách thuê nằm trong thư mục '
                '<span class="mono">tenant-app</span> của mã nguồn.</p>')
        js_parts.append('/* ===== %s ===== */\n%s' % (rel, src))
    js = '\n\n'.join(js_parts)
    for rel, mime in ASSETS:
        js = js.replace(rel, data_uri(rel, mime))

    banner = (
        '<div class="demo-strip">'
        '<b>Bản demo</b>'
        '<span>Dữ liệu mẫu, lưu trong trình duyệt của bạn — thoải mái bấm thử, '
        'không ảnh hưởng ai. Đăng nhập bằng email bất kỳ.</span>'
        '</div>'
    )

    html = u'''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Happy Home</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&text=happyome%%20&display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="%s">
<style>
%s

/* ===== Dải giới thiệu riêng cho bản demo (dùng đúng biến màu của app) ===== */
.demo-strip {
  display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  padding: 9px 20px; font-size: 12.5px; line-height: 1.5;
  background: var(--brand-700); color: #fff;
}
.demo-strip b { font-weight: 700; letter-spacing: .01em; }
.demo-strip span { opacity: .82; }
@media (max-width: 640px) { .demo-strip { padding: 8px 14px; font-size: 12px; } }
</style>

%s
<div id="app"></div>

<script>
window.HH = {};
%s

// Bản gộp không có config.js -> chạy chế độ demo (dữ liệu mẫu trong localStorage).
(function () {
  function boot() {
    try { HH.app.boot(); }
    catch (err) {
      document.getElementById('app').innerHTML =
        '<div style="padding:40px;font-family:sans-serif;color:#dc2626">Lỗi khởi động: ' + (err && err.message) + '</div>';
      console.error(err);
    }
  }
  window.addEventListener('error', function (e) { console.error(e.error || e.message); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
</script>
''' % (data_uri('assets/logo-icon.svg', 'image/svg+xml'), css, banner, js)

    if not os.path.isdir(OUT_DIR):
        os.makedirs(OUT_DIR)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    # in bằng ASCII cho chắc — Windows console hay lỗi mã tiếng Việt
    print('Done -> %s  (%.0f KB)' % (OUT, os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    main()

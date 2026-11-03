"""Sinh gioi-thieu/index.html: khu nhà trọ 3 tòa (tầng, cửa sổ, cây, xe, người lặp lại nhiều lần nên sinh bằng script).

    python tools/gioi-thieu/build_css.py     -> gioi-thieu/gioi-thieu.css (bảng màu ngày chiều đêm, mốc cuộn)
    python tools/gioi-thieu/gen_html.py      -> gioi-thieu/index.html
Đổi số CSS_VER (biến môi trường CSS_VER=n) mỗi lần sửa CSS để trình duyệt tải lại."""
import os

OUT = os.environ.get('OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'gioi-thieu', 'index.html'))
CSS_VER = int(os.environ.get('CSS_VER', 1))
_g = [0]


def win(j, fl=False):
    """Một cửa sổ. Khoảng 40% cửa sổ có bóng người, mèo hoặc chậu cây bên trong."""
    _g[0] += 1
    g = _g[0]
    sil = ''
    if g % 3 == 0:
        sil = ' sil-a'
    elif g % 7 == 2:
        sil = ' sil-b'
    elif g % 11 == 4:
        sil = ' sil-c'
    elif g % 13 == 6:
        sil = ' sil-d'
    lc = ''                                       # màu đèn trong phòng: phần lớn vàng ấm, còn lại hồng, xanh ti vi, tím
    if g % 5 == 1:
        lc = ' lc-p'
    elif g % 7 == 3:
        lc = ' lc-c'
    elif g % 9 == 5:
        lc = ' lc-v'
    if fl:
        return f'<i class="win fl" style="--j:{j}"><u></u></i>'
    return f'<i class="win{sil}{lc}" style="--j:{j}"></i>'


def row(n, j0, fl_at=None):
    return ''.join(win(j0 + k, fl=(k == fl_at)) for k in range(n))


def mb(l, w, h, x, y, z, c, cls=''):
    """Hộp nhỏ l (theo x) x w (theo y) x h (cao), đáy ở độ cao z, màu cơ bản c."""
    faces = ''.join(f'<i class="{k}"></i>' for k in ('m-f', 'm-b', 'm-r', 'm-l', 'm-t'))
    return f'<b class="mb {cls}" style="--l:{l}px;--w:{w}px;--h:{h}px;--x:{x}px;--y:{y}px;--z:{z}px;--c:{c}">{faces}</b>'


def head(x, y, z, s, c):
    st = f'--x:{x}px;--y:{y}px;--z:{z}px;--s:{s}px;--c:{c}'
    return f'<i class="dk dk1" style="{st}"></i><i class="dk dk2" style="{st}"></i>'


def cat():
    return ('<div class="cat" style="--x:34px;--y:58px">'
            + mb(14, 6, 7, 0, 0, 0, '#E8A34B') + mb(6, 6, 6, 9, 0, 3, '#E8A34B')
            + mb(2, 2, 3, 10, -2, 9, '#C9822B') + mb(2, 2, 3, 10, 2, 9, '#C9822B')
            + mb(10, 2, 2, -11, 0, 4, '#C9822B') + '</div>')


def floor(z, a, b, t0, wn, dn, door=False, flicker=False, extra=''):
    j = 0
    if door:                                   # tầng trệt: cửa chính ở giữa mặt trước
        front = win(j) + '<b class="door"></b>' + win(j + 1)
        j += 2
    else:
        front = row(wn, j, fl_at=1 if flicker else None)
        j += wn
    right = row(dn, j); j += dn
    back = row(wn, j); j += wn
    left = row(dn, j)
    return (f'<div class="floor" style="--z:{z}px;--a:{a};--b:{b};--t0:{t0}">'
            f'<div class="face f-front">{front}</div><div class="face f-right">{right}</div>'
            f'<div class="face f-back">{back}</div><div class="face f-left">{left}</div>'
            f'<div class="face f-top"></div>{extra}</div>')


def building(cls, w, d, x, y, n_floors, a0, t0, wn, dn, door=False, flicker_floor=None, roof_extra=''):
    h = 84
    out = [f'<div class="bld {cls}" style="--w:{w}px;--d:{d}px;--h:{h}px;--x:{x}px;--y:{y}px">']
    out.append(f'<i class="plane shadow" style="--a:{a0};--b:{a0 + 12 * (n_floors - 1) + 14}"></i>')   # bóng dưới chân nhà, đậm ban ngày, hết ban đêm
    for f in range(n_floors):
        a, b = a0 + 12 * f, a0 + 12 * f + 14
        extra = roof_extra if f == n_floors - 1 else ''
        out.append(floor(f * h, a, b, t0 + 12 * f, wn, dn, door=(door and f == 0), flicker=(f == flicker_floor), extra=extra))
    for f in range(n_floors):
        out.append(f'<i class="ring" style="--z:{f * h}px;--r:{a0 + 12 * f + 11}"></i>')
    out.append('</div>')
    return ''.join(out)


def bulb(cls, x, y, z, s, extra=''):
    return (f'<div class="bulb {cls}" style="--x:{x}px;--y:{y}px;--z:{z}px;--s:{s}px;{extra}">'
            '<i class="core c1"></i><i class="core c2"></i><i class="halo h1"></i><i class="halo h2"></i></div>')


def lamp(i, x, y):
    return (f'<div class="lamp" style="--x:{x}px;--y:{y}px;--i:{i}">'
            '<i class="pole p1"></i><i class="pole p2"></i><i class="pool"></i><i class="cone cn1"></i><i class="cone cn2"></i>'
            + bulb('lampb', 0, 0, 140, 22) + '</div>')


def roof_tower():
    """Trên mái tòa chính: bồn nước xanh quen thuộc của nhà trọ, hai máy lạnh, cột ăng ten. z = 84 là mặt mái của tầng trên cùng."""
    return (mb(30, 30, 24, -68, -42, 84, '#2E8BE0') + mb(34, 34, 3, -68, -42, 108, '#1F6DB8')
            + mb(8, 8, 8, -80, -54, 84, '#6E77C2') + mb(8, 8, 8, -56, -54, 84, '#6E77C2')
            + mb(26, 16, 15, 56, 52, 84, '#D6DCFF') + mb(26, 16, 15, 86, 52, 84, '#D6DCFF')
            + mb(3, 3, 60, 40, -60, 84, '#9AA3E6'))


def roof_left():
    return mb(34, 26, 22, -34, -30, 84, '#9C8FEA') + cat()


def festoon():
    out = []
    n = 9
    for i in range(n):
        x = -110 + i * 27.5
        t = (i - (n - 1) / 2) / ((n - 1) / 2)
        z = 346 - 13 * (1 - t * t)               # dây võng xuống ở giữa
        out.append(bulb('fest ' + ('bc-a', 'bc-p', 'bc-c', 'bc-v', 'bc-l')[i % 5], round(x, 1), 91, round(z, 1), 12, f'--j:{i}'))
    return ''.join(out)


TREES = {   # tán lá: xanh ngọc, hoa anh đào hồng, tím, xanh lam
    'ngoc': ('#5FD6A0', '#1F8F6B'), 'hong': ('#FF9BC2', '#C2437F'), 'tim': ('#B79BFF', '#6B47D6'), 'lam': ('#7FE3F0', '#1C8FB0'),
}


def tree(x, y, s=1.0, kind='ngoc'):
    a, b = TREES[kind]
    return (f'<div class="tree" style="--x:{x}px;--y:{y}px;--s:{s};--lfa:{a};--lfb:{b}">'
            '<i class="trunk tr1"></i><i class="trunk tr2"></i>'
            '<i class="crown k1"></i><i class="crown k2"></i><i class="crown k3"></i></div>')


def scooter(y, rot, x0, x1, xs, a, b, bike, shirt, helmet):
    """Xe máy chạy dọc đường khi cuộn (từ x0 đến x1, trong khoảng a..b đơn vị); xs là chỗ đứng khi không có hiệu ứng."""
    parts = [
        '<i class="wheel" style="--x:15px"></i><i class="wheel" style="--x:-15px"></i>',
        mb(36, 9, 7, 0, 0, 8, bike),                     # thân xe
        mb(14, 9, 10, -9, 0, 14, '#34505A'),              # đùi và yên
        mb(8, 11, 15, -8, 0, 24, shirt),                  # thân người lái
        head(-7, 0, 44, 10, helmet),                      # mũ bảo hiểm
        mb(3, 14, 3, 14, 0, 24, '#2D3B3A'),               # tay lái
        '<i class="hl"></i><i class="beam"></i>',
    ]
    return (f'<div class="scoot" style="--y:{y}px;--rot:{rot}deg;--x0:{x0}px;--x1:{x1}px;--xs:{xs}px;--a:{a};--b:{b}">'
            + ''.join(parts) + '</div>')


def person(x, y, rot, shirt, pants, skin='#E5B48F', luggage=False, extra_cls='', style=''):
    parts = [mb(8, 9, 17, 0, 0, 0, pants), mb(9, 12, 16, 0, 0, 17, shirt), head(0, 0, 38, 9, skin)]
    if luggage:
        parts.append(mb(11, 5, 15, 9, 9, 0, '#F2B84B'))
    return (f'<div class="ppl {extra_cls}" style="--x:{x}px;--y:{y}px;--rot:{rot}deg;{style}">'
            + ''.join(parts) + '<i class="plane psh"></i></div>')


clouds = ''.join(f'<i class="cloud" style="--x:{x}%;--y:{y}%;--w:{w}px"></i>' for x, y, w in ((6, 16, 300), (44, 8, 260), (66, 26, 320), (20, 34, 240)))
sky = f'<div class="sky" aria-hidden="true"><i class="sun"></i><i class="moon"></i><i class="stars"></i>{clouds}</div>'

world = ''.join([
    '<i class="plane ground"></i><i class="plane plot"></i><i class="plane walk"></i><i class="plane road"></i><i class="plane zebra"></i>',
    ''.join(tree(x, y, s, k) for x, y, s, k in ((-340, -118, 1.0, 'hong'), (-185, -132, 0.9, 'ngoc'), (170, -128, 1.0, 'tim'), (335, -112, 0.95, 'hong'),
                                                 (-385, 128, 0.85, 'lam'), (395, 140, 0.9, 'ngoc'))),
    ''.join(lamp(i, x, 225) for i, x in enumerate((-330, -110, 110, 330))),
    '<i class="plane spill"></i>',
    building('tower', 240, 190, 0, -10, 4, 22, 84, 3, 3, door=True, flicker_floor=1, roof_extra=roof_tower()),
    building('left', 150, 170, -250, 15, 2, 84, 132, 2, 2, roof_extra=roof_left()),
    building('right', 170, 150, 255, 5, 3, 92, 140, 2, 2),
    festoon(),
    '<div class="sign" style="--y:-10px;--z:362px">HAPPY HOME</div>',
    scooter(282, 0, -820, 820, 160, 104, 190, '#FF5A6A', '#7B5BE0', '#FFE27A'),
    scooter(318, 180, 820, -820, -180, 144, 244, '#2EC4D6', '#FF8FB8', '#FFFFFF'),
    scooter(282, 0, -820, 820, -330, 196, 292, '#FFC83D', '#2E8BE0', '#FF5A6A'),
    person(96, 240, 180, '#FF8FB8', '#34406E'),
    person(124, 240, 0, '#6EE0C0', '#2D3358', skin='#C98B62'),
    person(6, 112, -90, '#7B5BE0', '#34406E', luggage=True, extra_cls='tenant',
           style='--x0:-110px;--y0:268px;--x1:6px;--y1:112px'),
])

html = f'''<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Happy Home: quản lý nhà trọ gọn gàng, tiền về đúng hạn</title>
  <meta name="description" content="Ghi điện nước, thu tiền, nhắc nợ và báo hỏng trong một ứng dụng trên điện thoại, dành cho chủ nhà trọ.">
  <meta name="theme-color" content="#080B1E">
  <meta name="color-scheme" content="dark">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Happy Home: quản lý nhà trọ gọn gàng, tiền về đúng hạn">
  <meta property="og:description" content="Ghi điện nước, thu tiền, nhắc nợ và báo hỏng trong một ứng dụng trên điện thoại.">
  <meta property="og:image" content="https://giathinh-anl.github.io/happy-home/assets/icon-512.png">
  <link rel="icon" type="image/svg+xml" href="../assets/logo-icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400..800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="gioi-thieu.css?v={CSS_VER}">
</head>
<body>
  <header class="nav">
    <a class="brand" href="./" aria-label="Happy Home">
      <img src="../assets/logo-icon.svg" alt="" width="34" height="34">
      <span>Happy Home</span>
    </a>
    <div class="nav-r">
      <a class="btn ghost" href="../tenant-app/">Dành cho khách thuê</a>
      <a class="btn primary" href="../">Đăng nhập</a>
    </div>
  </header>

  <main>
    <section class="scene" id="scene" aria-label="Giới thiệu Happy Home">
      <p class="sr-only">Happy Home giúp chủ nhà trọ ghi điện nước, thu tiền đúng hạn, nhắc nợ, chốt sổ cả tòa nhà trong một lần. Khách thuê vào bằng mã riêng để xem hóa đơn, báo hỏng và theo dõi tiến độ sửa.</p>

      <div class="stage">
        <div class="copy">
          <div class="cap cap-0">
            <h1>Nhà trọ gọn gàng, tiền về đúng hạn</h1>
            <p>Ghi điện nước, thu tiền, nhắc nợ và báo hỏng. Tất cả trong một ứng dụng trên điện thoại.</p>
            <div class="actions">
              <a class="btn primary" href="../">Đăng nhập</a>
              <a class="btn outline" href="../tenant-app/">Dành cho khách thuê</a>
            </div>
          </div>

          <div class="cap cap-1">
            <h2>Ghi điện nước trong vài giây</h2>
            <p>Gõ số hoặc nói “phòng 101 điện 1250”. Mất mạng vẫn ghi được, có mạng lại tự gửi.</p>
          </div>

          <div class="cap cap-2">
            <h2>Tiền về đúng hạn</h2>
            <p>Hóa đơn tự tính, nhắc nợ theo từng mức trễ, chốt sổ cả tòa nhà trong một lần.</p>
          </div>

          <div class="cap cap-3">
            <h2>Khách thuê tự lo phần của mình</h2>
            <p>Khách vào app bằng mã riêng, xem hóa đơn, báo hỏng và theo dõi tiến độ sửa.</p>
          </div>

          <div class="cap cap-4">
            <h2>Vào quản lý nhà trọ của bạn</h2>
            <p>Dùng ngay trên điện thoại hoặc máy tính.</p>
            <div class="actions">
              <a class="btn primary" href="../">Đăng nhập</a>
              <a class="btn outline" href="../tenant-app/">Dành cho khách thuê</a>
            </div>
          </div>
        </div>

        <div class="scene3d" role="img" aria-label="Khu nhà trọ về đêm: các tầng của tòa nhà lần lượt hạ xuống, đèn đường và cửa sổ sáng dần, xe máy chạy qua, khách thuê kéo vali vào cửa, khi bạn cuộn trang">
          {sky}
          <div class="fit"><div class="world">{world}</div></div>
        </div>

        <div class="rail" aria-hidden="true"><i></i></div>
      </div>
    </section>
  </main>

  <footer class="foot">
    <span>© 2026 Happy Home, phần mềm quản lý nhà trọ</span>
    <nav aria-label="Liên kết">
      <a href="../">Đăng nhập</a>
      <a href="../tenant-app/">Dành cho khách thuê</a>
    </nav>
  </footer>
</body>
</html>
'''
open(OUT, 'w', encoding='utf-8').write(html)
print('ghi', OUT, len(html), 'ký tự;', html.count('class="win'), 'cửa sổ;', html.count('<i class'), 'phần tử <i>')

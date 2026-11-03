"""Sinh gioi-thieu/gioi-thieu.css: khu nhà trọ nhiều màu, trời đi từ sáng qua chiều tới tối. Mọi màu của cảnh pha theo MỘT số --n (0 là ban ngày, 1 là ban đêm)."""


def hex_mix(a, b, t):
    """Pha hai màu hex theo tỷ lệ t của b (trong sRGB), trả về hex."""
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(x * (1 - t) + y * t):02X}' for x, y in zip(pa, pb))


def tri(day, night, dusk=None):
    """Màu đi từ ngày (--n 0) qua chiều (0,5) tới đêm (1). Chiều mặc định: màu ngày ngả cam ấm rồi tím nhẹ."""
    if dusk is None:
        dusk = hex_mix(hex_mix(day, '#FF8F6B', .3), '#3A2468', .2)
    return f'color-mix(in oklab, {night} var(--m3), color-mix(in oklab, {dusk} var(--m2), {day}))'


PAL = {  # tên: (ngày, đêm, chiều hoặc None)
    'sk1': ('#2B6FD6', '#050718', '#3E2A86'), 'sk2': ('#5FA8F0', '#0A0F33', '#C94A84'), 'sk3': ('#BFE2FF', '#1A1650', '#FFB06B'),
    'c-ground': ('#BFE4EC', '#0A0F2C', '#B58FC8'),
    'c-grid': ('rgba(60, 110, 170, .26)', 'rgba(120, 120, 245, .22)', 'rgba(130, 80, 170, .3)'),
    'c-plot': ('#7FD08F', '#0E2A3F', '#8BA878'), 'c-plot-e': ('#4FB36A', '#20608A', '#6F8D6A'),
    'c-walk': ('#DAD6EC', '#1A2152', '#AB9CC4'), 'c-walk-e': ('#B9B3D6', '#2A3A7A', '#8070A4'),
    'c-road': ('#5B6585', '#0C1030', '#4D4770'), 'c-road-e': ('#454E70', '#232B63', '#383254'),
    'c-dash': ('#FFE27A', '#C9A63C', '#F5C86A'), 'c-zebra': ('#F6F8FF', '#9BA4E8', '#EAD9F2'),
    'c-trunk': ('#8A6A5A', '#3A2A3F', '#6D4F5E'),
    'gw-a': ('#9FD2FF', '#18265C', None), 'gw-b': ('#6FB4F0', '#111B44', None), 'gw-e': ('#E6F2FF', '#2B3B80', None), 'gw-s': ('#F5FAFF', '#33478F', None),
    'c-door': ('#7A6BB8', '#0E1438', None),
    'sunA': ('#FFFBE0', '#FFE0B0', '#FFD29A'), 'sunB': ('#FFE585', '#FFB070', '#FF8A4C'),
    'cl-c': ('#FFFFFF', '#FFFFFF', '#FFC9DD'),
}

# màu từng tòa nhà: (ngày, đêm) cho mặt trước trên/dưới, mặt phải trên/dưới, mặt trái trên/dưới, mặt sau, mái trên/dưới, viền mái
FACES = ('f1', 'f2', 'r1', 'r2', 'l1', 'l2', 'b0', 't1', 't2', 'te')
BLD = {
    'tower': ('#62D7DB #41B8C0 #2FA0A9 #24848E #52C8CE #38A8B0 #24848E #A8F2F3 #7EDDE0 #2FA0A9',
              '#1F7A80 #165C64 #135058 #0E3C44 #1A666D #124C54 #0E3C44 #2E9AA0 #207C84 #14525A'),
    'left': ('#A58CF0 #8668DC #6C4FC4 #543BA3 #957AE6 #7658CE #543BA3 #CDBBFF #B39CF7 #6C4FC4',
             '#5E42AE #45308C #3A2A70 #2B1F55 #4D3796 #392973 #2B1F55 #7D5FD6 #6247B8 #3A2A70'),
    'right': ('#FF8FA3 #F0667F #D14B65 #B03850 #F57A90 #DC5870 #B03850 #FFC2CE #FFA3B3 #D14B65',
              '#B4425F #8F3049 #7A2740 #5E1D32 #9D3852 #7C2B42 #5E1D32 #D9607F #B9466A #7A2740'),
}

palette = '\n'.join(f'  --{k}: {tri(*v)};' for k, v in PAL.items())
buildings = '\n'.join(
    f'.bld.{name} {{ ' + ' '.join(f'--{f}: {tri(d, n)};' for f, d, n in zip(FACES, day.split(), night.split())) + ' }'
    for name, (day, night) in BLD.items())

CSS = r'''/* Trang giới thiệu có hiệu ứng cuộn (gioi-thieu/): khu nhà trọ nhiều màu, trời đi từ sáng qua chiều tới tối, dựng bằng CSS 3D.
   Không dùng thư viện, không JavaScript, không ảnh: cảnh dựng bằng CSS (transform-style: preserve-3d), hiệu ứng chạy bằng
   CSS scroll-driven animations (animation-timeline: scroll()). index.html và các dòng màu của từng tòa do script sinh ra.
   Mọi màu của cảnh pha theo MỘT số --n (0 là ban ngày, 0,5 là hoàng hôn, 1 là ban đêm), khai báo bằng @property và chạy theo cuộn.
   Trình duyệt chưa hỗ trợ, hoặc người dùng bật "giảm chuyển động", sẽ thấy cảnh ban đêm đã dựng xong (--n bằng 1) và chữ xếp dọc.
   Mỗi tòa một màu (xanh ngọc, tím, san hô); đèn trong phòng phần lớn vàng ấm, số khác hồng, xanh ti vi, tím; nút đăng nhập vẫn là vàng đèn (--accent).
   Bo góc: nút 14px, khối nhỏ 4 đến 8px.
   Lưu ý: không đặt opacity lên phần tử đang có preserve-3d (sẽ làm phẳng cảnh 3D), nên các tầng dùng visibility. */
@property --n { syntax: '<number>'; inherits: true; initial-value: 0; }

* { box-sizing: border-box; }
:root {
  color-scheme: dark;
  --bg: #080B1E; --line: #2A3366; --ink: #EEF0FF; --ink-2: #C6CCEE;
  --accent: #F2B84B; --accent-ink: #1B1304; --r-btn: 14px;
  --sv: 1.7svh; /* 1 đơn vị cuộn của cảnh: đổi số này để kéo dài hoặc rút ngắn cả trang */
}
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.55;
}
a { color: inherit; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 6px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Thanh trên cùng, một dòng, cao 64px */
.nav {
  position: fixed; inset: 0 0 auto 0; z-index: 20; height: 64px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 clamp(16px, 4vw, 48px); background: rgba(8, 11, 30, .78); border-bottom: 1px solid rgba(60, 72, 150, .6);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.brand { display: flex; align-items: center; gap: 10px; font-weight: 800; letter-spacing: -.01em; text-decoration: none; }
.brand img { width: 34px; height: 34px; border-radius: 10px; background: #fff; padding: 4px; }
.nav-r { display: flex; align-items: center; gap: 8px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: var(--r-btn);
  font: inherit; font-weight: 700; text-decoration: none; white-space: nowrap; border: 1px solid transparent;
  transition: transform .15s ease, filter .15s ease, background-color .15s ease;
}
.btn:active { transform: translateY(1px) scale(.98); }
.btn.primary { background: var(--accent); color: var(--accent-ink); }
.btn.primary:hover { filter: brightness(1.06); }
.btn.outline, .btn.ghost { border-color: rgba(190, 200, 255, .4); color: var(--ink); }
.btn.outline:hover, .btn.ghost:hover { background: rgba(190, 200, 255, .12); }
.btn.ghost { border-color: transparent; }
.nav .btn { min-height: 44px; padding: 0 18px; }
@media (max-width: 639px) { .nav .ghost { display: none; } }

/* ===== Bản tĩnh (mặc định): cảnh ban đêm đã dựng xong, hai cột trên máy tính, một cột trên điện thoại ===== */
.stage {
  --n: 1;
  --n2: clamp(0, calc(var(--n) * 2), 1);                    /* nửa đầu: ngày sang chiều */
  --n3: clamp(0, calc(var(--n) * 2 - 1), 1);                /* nửa sau: chiều sang đêm */
  --m2: calc(var(--n2) * 100%);
  --m3: calc(var(--n3) * 100%);
  --ng: clamp(0, calc((var(--n) - .35) * 2.2), 1);          /* độ sáng của đèn: tắt khi trời sáng, bật dần từ chiều */
  --sc: color-mix(in oklab, #3A2A06 calc(var(--ng) * 100%), transparent);   /* song cửa và bóng người trong ô sáng */
  --sign-bg: color-mix(in oklab, rgba(8, 11, 30, .92) calc(var(--ng) * 100%), #FFFFFF);   /* bảng hiệu: tối ban đêm, trắng ban ngày */
  --sign-ink: color-mix(in oklab, #FFE3EE calc(var(--ng) * 100%), #C2305F);
  --sign-line: color-mix(in oklab, #FF8FB8 calc(var(--ng) * 100%), #E0527F);
@@PALETTE@@
  --scrim: linear-gradient(180deg, rgba(8, 14, 44, calc(.55 * (1 - var(--n3)))), transparent 55%);
  display: grid; gap: 24px; align-items: center; margin: 0; padding: 100px 20px 48px;
  background: var(--scrim), linear-gradient(180deg, var(--sk1), var(--sk2) 55%, var(--sk3));
}
@media (min-width: 900px) {
  .stage { --scrim: linear-gradient(90deg, rgba(8, 14, 44, calc(.55 * (1 - var(--n3)))), transparent 52%);
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); padding: 112px max(48px, calc((100% - 1200px) / 2 + 48px)) 72px; min-height: 100svh; }
}
.copy { display: grid; gap: 48px; }
.cap h1, .cap h2 { margin: 0 0 14px; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; text-wrap: balance; text-shadow: 0 2px 22px rgba(8, 14, 44, .5); }
.cap h1 { font-size: clamp(2.1rem, 5vw, 3.6rem); }
.cap h2 { font-size: clamp(1.8rem, 4.2vw, 3rem); }
.cap p { margin: 0 0 22px; max-width: 46ch; color: var(--ink-2); font-size: clamp(1rem, 1.5vw, 1.15rem); text-shadow: 0 1px 14px rgba(8, 14, 44, .55); }
.cap > :last-child { margin-bottom: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; }
.cap-4 { display: none; }
.rail { display: none; }

.scene3d { position: relative; width: 100%; height: min(540px, 72svh); perspective: 1800px; perspective-origin: 50% 38%; --fit: .52; }
@media (max-width: 899px) { .fit { top: 50% !important; } }
@media (max-width: 899px) and (max-height: 640px) { .scene3d { --fit: .4; } .fit { top: 62% !important; } }
@media (min-width: 640px) { .scene3d { --fit: .7; } }
@media (min-width: 900px) { .scene3d { --fit: .78; height: min(80svh, 700px); } .cap p { max-width: 34ch; } }
@media (min-width: 1200px) { .scene3d { --fit: .92; } }
.fit { position: absolute; left: 50%; top: 58%; width: 0; height: 0; transform-style: preserve-3d; transform: scale(var(--fit)); }
.world { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-style: preserve-3d; transform: rotateX(54deg) rotateZ(-36deg) scale(.82); }
.world i, .world b, .world u { display: block; }

/* Bầu trời (phẳng, nằm sau cảnh 3D): quầng tím ban đêm, mặt trời lặn, trăng lên, sao hiện ra, mây ban ngày */
.sky { position: absolute; inset: -25% -15%; pointer-events: none; container-type: inline-size;
  background: radial-gradient(closest-side at 54% 40%, rgba(160, 90, 235, calc(.5 * var(--n3))), rgba(70, 50, 160, calc(.26 * var(--n3))) 56%, transparent); }
.sky i { display: block; position: absolute; }
.sun {
  right: 10%; top: 20%; width: 118px; height: 118px; border-radius: 50%; background: radial-gradient(circle, var(--sunA) 0 30%, var(--sunB) 55%, transparent 72%);
  transform: translate(calc(var(--n) * -70px), calc(var(--n) * 260px)); opacity: clamp(0, calc(1.7 - var(--n) * 1.9), 1);
}
.moon {
  left: 28%; top: 24%; width: 52px; height: 52px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #FFFBEA, #D5E2DD 70%);
  box-shadow: 0 0 40px rgba(220, 235, 230, .3); transform: translateY(calc((1 - var(--n)) * 150px)); opacity: clamp(0, calc(var(--n) * 2.4 - 1.1), 1);
}
.stars {
  inset: 0; opacity: clamp(0, calc(var(--n) * 2.6 - 1.5), 1);
  background:
    radial-gradient(1.6px 1.6px at 12% 20%, #fff, transparent), radial-gradient(1.2px 1.2px at 22% 8%, #fff, transparent),
    radial-gradient(1.6px 1.6px at 37% 14%, #FFD1E6, transparent), radial-gradient(1.2px 1.2px at 48% 6%, #fff, transparent),
    radial-gradient(1.6px 1.6px at 61% 18%, #fff, transparent), radial-gradient(1.2px 1.2px at 73% 9%, #BFE9FF, transparent),
    radial-gradient(1.6px 1.6px at 84% 22%, #FFF2B8, transparent), radial-gradient(1.2px 1.2px at 91% 12%, #fff, transparent),
    radial-gradient(1.2px 1.2px at 17% 33%, #fff, transparent), radial-gradient(1.2px 1.2px at 55% 30%, #CDBBFF, transparent),
    radial-gradient(1.2px 1.2px at 80% 36%, #fff, transparent), radial-gradient(1.6px 1.6px at 6% 44%, #fff, transparent);
}
.cloud { left: var(--x); top: var(--y); width: var(--w); height: 90px; filter: blur(7px); background: radial-gradient(closest-side, color-mix(in oklab, var(--cl-c) calc((1 - var(--n3)) * 78%), transparent), transparent); }
.cloud::after { content: ''; position: absolute; left: 30%; top: -32%; width: 56%; height: 124%; background: radial-gradient(closest-side, color-mix(in oklab, var(--cl-c) calc((1 - var(--n3)) * 68%), transparent), transparent); }

/* Mặt phẳng nằm trên mặt đất */
.plane { position: absolute; }
.ground {
  left: -1100px; top: -800px; width: 2200px; height: 1600px; transform: translateZ(-3px); background-color: var(--c-ground);
  background-image: linear-gradient(var(--c-grid) 1px, transparent 1px), linear-gradient(90deg, var(--c-grid) 1px, transparent 1px);
  background-size: 70px 70px; -webkit-mask-image: radial-gradient(closest-side, #000 30%, transparent 100%); mask-image: radial-gradient(closest-side, #000 30%, transparent 100%);
}
.plot { left: -410px; top: -150px; width: 820px; height: 320px; transform: translateZ(-2px); background: var(--c-plot); border: 2px solid var(--c-plot-e); border-radius: 14px; }
.walk {
  left: -1100px; top: 170px; width: 2200px; height: 76px; transform: translateZ(-1.8px); border-block: 2px solid var(--c-walk-e); background: var(--c-walk);
  background-image: repeating-linear-gradient(90deg, rgba(0, 0, 0, .18) 0 2px, transparent 2px 46px);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent); mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent);
}
.road {
  left: -1100px; top: 245px; width: 2200px; height: 110px; transform: translateZ(-2px); background: var(--c-road);
  border-block: 2px solid var(--c-road-e); -webkit-mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent); mask-image: linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent);
}
.road::after { content: ''; position: absolute; left: 0; right: 0; top: calc(50% - 1.5px); height: 3px; background: repeating-linear-gradient(90deg, var(--c-dash) 0 26px, transparent 26px 56px); }
.zebra { left: -30px; top: 247px; width: 74px; height: 106px; transform: translateZ(-1.7px); background: repeating-linear-gradient(180deg, var(--c-zebra) 0 9px, transparent 9px 20px); opacity: .9; }
.spill { left: -300px; top: 70px; width: 600px; height: 300px; transform: translateZ(.3px); background: radial-gradient(closest-side, rgba(244, 194, 101, calc(.3 * var(--ng))), transparent); }

/* Cây: thân là hai tấm đứng cắt chéo, tán là hai đĩa đứng cắt chéo cộng một đĩa nằm; tán tối đi ban đêm */
.tree { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), 0); }
.trunk { position: absolute; width: calc(var(--s) * 7px); height: calc(var(--s) * 40px); left: calc(var(--s) * -3.5px); top: calc(var(--s) * -20px); background: var(--c-trunk); }
.tr1 { transform: translateZ(calc(var(--s) * 20px)) rotateX(-90deg); }
.tr2 { transform: translateZ(calc(var(--s) * 20px)) rotateZ(90deg) rotateX(-90deg); }
.crown { position: absolute; width: calc(var(--s) * 62px); height: calc(var(--s) * 62px); left: calc(var(--s) * -31px); top: calc(var(--s) * -31px); border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, color-mix(in oklab, #0A0C26 calc(var(--n) * 40%), var(--lfa, #5FD6A0)), color-mix(in oklab, #0A0C26 calc(var(--n) * 40%), var(--lfb, #1F8F6B)) 72%); }
.k1 { transform: translateZ(calc(var(--s) * 62px)) rotateX(-90deg); }
.k2 { transform: translateZ(calc(var(--s) * 62px)) rotateZ(90deg) rotateX(-90deg); }
.k3 { transform: translateZ(calc(var(--s) * 64px)); }

/* Tòa nhà: mỗi tầng là một khối hộp w x d x h, dựng từ 4 mặt đứng và mặt mái. Mỗi mặt hơi tối ở chân và dưới sàn tầng trên để có chiều sâu */
.bld { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), 0); }
.floor { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translateZ(var(--z)); }
.shadow { left: calc(var(--w) * -.75); top: calc(var(--d) * -.62); width: calc(var(--w) * 1.5); height: calc(var(--d) * 1.5); border-radius: 50%; transform: translate3d(34px, 28px, -1.2px);
  background: radial-gradient(closest-side, rgba(10, 12, 40, calc((1 - var(--n3)) * .45)), transparent); }
.face {
  --ao: linear-gradient(0deg, rgba(0, 0, 0, .26), transparent 20%), linear-gradient(180deg, rgba(0, 0, 0, .3), transparent 15%);
  position: absolute; left: calc(var(--w) / -2); top: calc(var(--h) / -2); width: var(--w); height: var(--h); backface-visibility: hidden;
  display: flex; align-items: center; justify-content: space-evenly; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .16);
}
.f-front { background: var(--ao), linear-gradient(180deg, var(--f1), var(--f2)); transform: translate3d(0, calc(var(--d) / 2), calc(var(--h) / 2)) rotateX(-90deg); }
.f-back { background: var(--ao), var(--b0); transform: translate3d(0, calc(var(--d) / -2), calc(var(--h) / 2)) rotateZ(180deg) rotateX(-90deg); }
.f-right { width: var(--d); left: calc(var(--d) / -2); background: var(--ao), linear-gradient(180deg, var(--r1), var(--r2)); transform: translate3d(calc(var(--w) / 2), 0, calc(var(--h) / 2)) rotateZ(-90deg) rotateX(-90deg); }
.f-left { width: var(--d); left: calc(var(--d) / -2); background: var(--ao), linear-gradient(180deg, var(--l1), var(--l2)); transform: translate3d(calc(var(--w) / -2), 0, calc(var(--h) / 2)) rotateZ(90deg) rotateX(-90deg); }
.f-top { top: calc(var(--d) / -2); height: var(--d); background: linear-gradient(135deg, var(--t1), var(--t2)); transform: translateZ(var(--h)); box-shadow: inset 0 0 0 3px var(--te); }
@@BUILDINGS@@
.floor:first-of-type .face::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(0deg, rgba(0, 0, 0, .38), transparent 36%); }
.ring { position: absolute; left: calc(var(--w) * -.85); top: calc(var(--d) * -.85); width: calc(var(--w) * 1.7); height: calc(var(--d) * 1.7); border-radius: 50%;
  border: 2px solid rgba(244, 194, 101, .55); opacity: 0; transform: translateZ(calc(var(--z) + 1px)); }

/* Cửa sổ và cửa chính: kính phản chiếu trời ban ngày, tối ban đêm; sáng lên bằng hai lớp (ánh tràn ra ngoài và ô kính màu); vài ô có bóng người, mèo, chậu cây */
.win {
  --pa0: #FBD887; --pb0: #EBA537; --gl: 244, 194, 101;
  position: relative; width: 44px; height: 52px; border-radius: 5px;
  background: linear-gradient(118deg, rgba(255, 255, 255, calc(.42 * (1 - var(--n3)))) 0 20%, transparent 20% 100%), linear-gradient(135deg, var(--gw-a) 0 45%, var(--gw-b) 45% 100%);
  box-shadow: inset 0 0 0 2px var(--gw-e), inset 0 7px 8px -2px rgba(0, 0, 0, .38), 0 4px 0 -1px var(--gw-s), 0 8px 5px -3px rgba(0, 0, 0, .42);
}
.lc-p { --pa0: #FFB3CC; --pb0: #E8567F; --gl: 255, 120, 170; }
.lc-c { --pa0: #9FE3FF; --pb0: #3AA7E0; --gl: 90, 190, 245; }
.lc-v { --pa0: #D5BEFF; --pb0: #8E63E8; --gl: 170, 120, 250; }
.win::before { content: ''; position: absolute; inset: -16px; border-radius: 50%; background: radial-gradient(closest-side, rgba(var(--gl), calc(.5 * var(--ng))), transparent); }
.win::after {
  content: ''; position: absolute; inset: 3px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgba(255, 236, 190, calc(.35 * var(--ng)));
  background: linear-gradient(var(--sc), var(--sc)) center / 2px 100% no-repeat, linear-gradient(var(--sc), var(--sc)) center / 100% 2px no-repeat, var(--sil, none),
    linear-gradient(180deg, color-mix(in oklab, var(--pa0) calc(var(--ng) * 100%), transparent), color-mix(in oklab, var(--pb0) calc(var(--ng) * 100%), transparent));
}
.sil-a { --sil: radial-gradient(circle at 50% 38%, var(--sc) 0 4.4px, transparent 5px), radial-gradient(ellipse 9px 12px at 50% 90%, var(--sc) 0 94%, transparent 100%); }
.sil-b { --sil: radial-gradient(circle at 30% 44%, var(--sc) 0 3.6px, transparent 4.2px), radial-gradient(ellipse 7px 11px at 30% 94%, var(--sc) 0 94%, transparent 100%),
  radial-gradient(circle at 70% 38%, var(--sc) 0 4px, transparent 4.6px), radial-gradient(ellipse 8px 12px at 70% 92%, var(--sc) 0 94%, transparent 100%); }
.sil-c { --sil: radial-gradient(ellipse 9px 5px at 34% 94%, var(--sc) 0 94%, transparent 100%), radial-gradient(circle at 50% 82%, var(--sc) 0 3.2px, transparent 3.8px); }
.sil-d { --sil: radial-gradient(circle at 50% 66%, var(--sc) 0 6.5px, transparent 7.2px), linear-gradient(var(--sc), var(--sc)) 50% 100% / 11px 9px no-repeat; }
.win u { position: absolute; inset: 0; z-index: 2; border-radius: 5px; background: var(--gw-b); opacity: 0; }
.door { position: relative; width: 46px; height: 66px; align-self: flex-end; border-radius: 6px 6px 0 0; background: var(--c-door); box-shadow: inset 0 0 0 2px var(--gw-e), inset 0 8px 8px -3px rgba(0, 0, 0, .4); }
.door::after { content: ''; position: absolute; inset: 4px 4px 0; border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, color-mix(in oklab, #FBD887 calc(var(--ng) * 100%), transparent), color-mix(in oklab, #EBA537 calc(var(--ng) * 100%), transparent)); }

/* Bóng đèn: hai đĩa đứng cắt chéo nhau (nhìn từ mọi hướng đều thấy), kèm quầng sáng; đèn dây nhiều màu */
.bulb { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), var(--z)); }
.core { position: absolute; width: var(--s); height: var(--s); left: calc(var(--s) / -2); top: calc(var(--s) / -2); border-radius: 50%; background: #D3D6F5; }
.fest .core { background: transparent; }
.core::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, color-mix(in oklab, var(--bk1, #FFEBB5) calc(var(--ng) * 100%), transparent), color-mix(in oklab, var(--bk2, #F2B84B) calc(var(--ng) * 100%), transparent) 62%, color-mix(in oklab, var(--bk3, #C98416) calc(var(--ng) * 100%), transparent)); }
.halo { position: absolute; width: calc(var(--s) * 6); height: calc(var(--s) * 6); left: calc(var(--s) * -3); top: calc(var(--s) * -3); border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(var(--gl, 244, 194, 101), calc(.55 * var(--ng))), rgba(var(--gl, 244, 194, 101), calc(.12 * var(--ng))) 55%, transparent); }
.bc-p { --bk1: #FFD3E3; --bk2: #FF6FA3; --bk3: #C2306B; --gl: 255, 111, 163; }
.bc-c { --bk1: #D2F4FF; --bk2: #43C6F0; --bk3: #1A86B5; --gl: 67, 198, 240; }
.bc-v { --bk1: #E6D8FF; --bk2: #9C74F0; --bk3: #5B37B8; --gl: 156, 116, 240; }
.bc-l { --bk1: #E9FFC9; --bk2: #9BE05A; --bk3: #4F9A24; --gl: 155, 224, 90; }
.c1 { transform: rotateX(-90deg); }
.c2 { transform: rotateZ(90deg) rotateX(-90deg); }
.h1 { transform: rotateX(-90deg) translateZ(-1px); }
.h2 { transform: rotateZ(90deg) rotateX(-90deg) translateZ(-1px); }

/* Cột đèn đường: cột, vệt sáng trên mặt đất và chùm sáng hình nón (chỉ thấy khi trời tối) */
.lamp { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), 0); }
.pole { position: absolute; width: 5px; height: 132px; left: -2.5px; top: -66px; background: linear-gradient(90deg, #6E77C2, #A3ABF0); }
.p1 { transform: translateZ(66px) rotateX(-90deg); }
.p2 { transform: translateZ(66px) rotateZ(90deg) rotateX(-90deg); }
.pool { position: absolute; width: 300px; height: 300px; left: -150px; top: -150px; border-radius: 50%; transform: translateZ(.6px); background: radial-gradient(closest-side, rgba(244, 194, 101, calc(.34 * var(--ng))), transparent); }
.cone { position: absolute; width: 150px; height: 140px; left: -75px; top: -70px; pointer-events: none; clip-path: polygon(41% 0, 59% 0, 100% 100%, 0 100%);
  background: linear-gradient(180deg, rgba(255, 214, 140, calc(.42 * var(--ng))), rgba(255, 214, 140, calc(.02 * var(--ng)))); }
.cn1 { transform: translateZ(70px) rotateX(-90deg); }
.cn2 { transform: translateZ(70px) rotateZ(90deg) rotateX(-90deg); }

/* Bảng hiệu trên mái: bảng trắng chữ hồng ban ngày, bảng tối chữ neon hồng ban đêm */
.sign {
  position: absolute; width: 230px; height: 40px; left: -115px; top: -20px; display: grid; place-items: center; border: 2px solid var(--sign-line); border-radius: 8px; background: var(--sign-bg);
  box-shadow: 0 0 20px rgba(255, 120, 170, calc(.35 * var(--ng)));
  font: 800 24px 'Plus Jakarta Sans', system-ui, sans-serif; letter-spacing: .2em; color: var(--sign-ink); text-shadow: 0 0 14px rgba(255, 120, 170, calc(.75 * var(--ng)));
  transform: translate3d(0, var(--y), var(--z)) rotateX(-90deg);
}

/* Đồ vật nhỏ: hộp l x w x h (mb), đĩa đứng cắt chéo (dk), bánh xe, xe máy, người, mèo. Màu tối đi khi trời tối */
.mb { --cn: color-mix(in oklab, #0A0C26 calc(var(--n) * 52%), var(--c)); position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), var(--z)); }
.mb i { position: absolute; }
.m-f { width: var(--l); height: var(--h); left: calc(var(--l) / -2); top: calc(var(--h) / -2); background: var(--cn); transform: translate3d(0, calc(var(--w) / 2), calc(var(--h) / 2)) rotateX(-90deg); }
.m-b { width: var(--l); height: var(--h); left: calc(var(--l) / -2); top: calc(var(--h) / -2); background: color-mix(in oklab, #000 22%, var(--cn)); transform: translate3d(0, calc(var(--w) / -2), calc(var(--h) / 2)) rotateZ(180deg) rotateX(-90deg); }
.m-r { width: var(--w); height: var(--h); left: calc(var(--w) / -2); top: calc(var(--h) / -2); background: color-mix(in oklab, #000 14%, var(--cn)); transform: translate3d(calc(var(--l) / 2), 0, calc(var(--h) / 2)) rotateZ(-90deg) rotateX(-90deg); }
.m-l { width: var(--w); height: var(--h); left: calc(var(--w) / -2); top: calc(var(--h) / -2); background: color-mix(in oklab, #000 10%, var(--cn)); transform: translate3d(calc(var(--l) / -2), 0, calc(var(--h) / 2)) rotateZ(90deg) rotateX(-90deg); }
.m-t { width: var(--l); height: var(--w); left: calc(var(--l) / -2); top: calc(var(--w) / -2); background: color-mix(in oklab, #fff 14%, var(--cn)); transform: translateZ(var(--h)); }
.dk { --cn: color-mix(in oklab, #0A0C26 calc(var(--n) * 52%), var(--c)); position: absolute; width: var(--s); height: var(--s); left: calc(var(--s) / -2); top: calc(var(--s) / -2); border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, color-mix(in oklab, #fff 26%, var(--cn)), var(--cn) 66%); }
.dk1 { transform: translate3d(var(--x), var(--y), var(--z)) rotateX(-90deg); }
.dk2 { transform: translate3d(var(--x), var(--y), var(--z)) rotateZ(90deg) rotateX(-90deg); }
.wheel { position: absolute; width: 14px; height: 14px; left: -7px; top: -7px; border-radius: 50%; background: radial-gradient(circle, #A9BBB7 0 2.2px, #1B2A2A 2.8px); transform: translate3d(var(--x), 0, 7px) rotateX(-90deg); }

.scoot { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--xs), var(--y), 0) rotateZ(var(--rot)); }
.scoot::after { content: ''; position: absolute; width: 56px; height: 18px; left: -28px; top: -9px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0, 0, 0, .38), transparent); transform: translateZ(.5px); }
.hl { position: absolute; width: 7px; height: 7px; left: -3.5px; top: -3.5px; border-radius: 50%; background: #FFF1C4; transform: translate3d(19px, 0, 17px) rotateZ(90deg) rotateX(-90deg); opacity: var(--ng); }
.beam { position: absolute; left: 20px; top: -24px; width: 120px; height: 48px; transform: translateZ(.7px); background: linear-gradient(90deg, rgba(255, 232, 170, .6), transparent); clip-path: polygon(0 38%, 100% 0, 100% 100%, 0 62%); opacity: var(--ng); }
.ppl { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), 0) rotateZ(var(--rot)); }
.tenant { transform: translate3d(var(--x1), var(--y1), 0) rotateZ(var(--rot)); }
.psh { left: -14px; top: -9px; width: 28px; height: 18px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0, 0, 0, .38), transparent); transform: translateZ(.5px); }
.cat { position: absolute; left: 0; top: 0; transform-style: preserve-3d; transform: translate3d(var(--x), var(--y), var(--h)) rotateZ(-30deg); }

/* ===== Bản động: chỉ khi trình duyệt hỗ trợ và người dùng không tắt chuyển động.
   Khung hình dính ở đỉnh trong 300 đơn vị cuộn, mỗi đơn vị là --sv (xem :root). Mốc tính theo đơn vị:
     0 đến 55      buổi sáng: trời xanh, mặt trời cao, mây; 22 đến 72 bốn tầng tòa chính lần lượt rơi xuống
     55 đến 190    trời chuyển chiều (cam hồng tím) rồi tối (--n từ 0 đến 1): mặt trời lặn, trăng và sao lên
     84 đến 130    hai tòa bên cạnh dựng lên
     100 đến 130   bốn đèn đường lần lượt bật; 84 đến 190 cửa sổ sáng đèn (có bóng người bên trong)
     104 đến 292   ba chiếc xe máy chạy qua, đèn pha sáng khi tối
     150 đến 181   chuỗi đèn dây ở mép mái sáng dần
     196 đến 240   khách thuê kéo vali đi vào cửa
     200 đến 232   một cửa sổ chập chờn rồi sáng lại (báo hỏng, sửa xong)
     232 đến 262   bảng hiệu nhô lên khỏi mái
     0 đến 300     máy quay xoay quanh khu nhà rồi lùi ra xa; trang kết ở khung đêm có bảng hiệu và lời mời đăng nhập
   Chữ: 0-34, 34-128, 128-192, 192-252, 252-300, nối tiếp nhau, không gối lên nhau. ===== */
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: scroll()) {
    .scene { height: calc(100svh + 300 * var(--sv)); }
    .stage {
      position: sticky; top: 0; height: 100svh; min-height: 0; overflow: hidden; align-content: stretch; gap: 0;
      grid-template-columns: none; grid-template-rows: auto minmax(0, 1fr); padding: 84px 20px 12px;
    }
    @media (min-width: 900px) {
      .stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); grid-template-rows: none; align-content: center; gap: 24px; padding: 72px max(48px, calc((100% - 1200px) / 2 + 48px)) 24px; }
    }
    .copy { display: grid; gap: 0; align-self: start; z-index: 2; }
    @media (min-width: 900px) { .copy { align-self: center; } }
    .cap { grid-area: 1 / 1; }
    .cap-4 { display: block; }
    .scene3d { height: 100%; min-height: 0; }
    @media (min-width: 900px) { .scene3d { height: min(86svh, 760px); } }

    .stage, .world, .cap, .floor, .ring, .spill, .shadow, .sign, .win::before, .win::after, .win u, .door::after, .core::after, .halo, .pool, .cone, .scoot, .tenant, .rail, .rail i {
      animation-timing-function: linear; animation-fill-mode: both; animation-timeline: scroll(root);
    }

    .stage { animation-name: night; animation-range: calc(55 * var(--sv)) calc(190 * var(--sv)); }
    .cap-0 { animation-name: cap-first; animation-range: calc(0 * var(--sv)) calc(34 * var(--sv)); }
    .cap-1 { animation-name: cap-mid; animation-range: calc(34 * var(--sv)) calc(128 * var(--sv)); }
    .cap-2 { animation-name: cap-mid; animation-range: calc(128 * var(--sv)) calc(192 * var(--sv)); }
    .cap-3 { animation-name: cap-mid; animation-range: calc(192 * var(--sv)) calc(252 * var(--sv)); }
    .cap-4 { animation-name: cap-last; animation-range: calc(252 * var(--sv)) calc(300 * var(--sv)); }

    .world { animation-name: orbit; animation-range: calc(0 * var(--sv)) calc(300 * var(--sv)); }
    .floor { animation-name: drop; animation-range: calc(var(--a) * var(--sv)) calc(var(--b) * var(--sv)); }
    .shadow { animation-name: lit; animation-range: calc(var(--a) * var(--sv)) calc(var(--b) * var(--sv)); }
    .ring { animation-name: ring; animation-range: calc(var(--r) * var(--sv)) calc((var(--r) + 14) * var(--sv)); }
    .win::before, .win::after, .door::after { animation-name: lit; animation-range: calc((var(--t0) + var(--j, 0) * 1.6) * var(--sv)) calc((var(--t0) + var(--j, 0) * 1.6 + 6) * var(--sv)); }
    .win.fl u { animation-name: flick; animation-range: calc(200 * var(--sv)) calc(232 * var(--sv)); }
    .spill { animation-name: lit; animation-range: calc(100 * var(--sv)) calc(190 * var(--sv)); }
    .lamp .core::after, .lamp .halo, .lamp .pool, .lamp .cone { animation-name: lit; animation-range: calc((100 + var(--i) * 7) * var(--sv)) calc((108 + var(--i) * 7) * var(--sv)); }
    .fest .core::after, .fest .halo { animation-name: lit; animation-range: calc((150 + var(--j) * 3) * var(--sv)) calc((157 + var(--j) * 3) * var(--sv)); }
    .sign { animation-name: sign-up; animation-range: calc(232 * var(--sv)) calc(262 * var(--sv)); }
    .scoot { animation-name: ride; animation-range: calc(var(--a) * var(--sv)) calc(var(--b) * var(--sv)); }
    .tenant { animation-name: walk; animation-range: calc(196 * var(--sv)) calc(240 * var(--sv)); }

    .rail {
      display: block; position: fixed; z-index: 10; right: 14px; top: 50%; width: 3px; height: 120px; margin-top: -60px;
      border-radius: 2px; background: rgba(190, 200, 255, .3); overflow: hidden; animation-name: rail-out; animation-range: calc(300 * var(--sv)) calc(330 * var(--sv));
    }
    .rail i { display: block; height: 100%; background: var(--accent); transform-origin: top; animation-name: grow; animation-range: calc(0 * var(--sv)) calc(300 * var(--sv)); }

    @keyframes night { from { --n: 0; } to { --n: 1; } }
    @keyframes cap-first { 0%, 55% { opacity: 1; visibility: visible; transform: none; } 100% { opacity: 0; visibility: hidden; transform: translateY(-24px); } }
    @keyframes cap-mid {
      0% { opacity: 0; visibility: hidden; transform: translateY(24px); }
      14%, 86% { opacity: 1; visibility: visible; transform: none; }
      100% { opacity: 0; visibility: hidden; transform: translateY(-24px); }
    }
    @keyframes cap-last { 0% { opacity: 0; visibility: hidden; transform: translateY(24px); } 40%, 100% { opacity: 1; visibility: visible; transform: none; } }
    @keyframes orbit {
      0% { transform: rotateX(66deg) rotateZ(-74deg) scale(.86); }
      35% { transform: rotateX(60deg) rotateZ(-50deg) scale(.98); }
      70% { transform: rotateX(57deg) rotateZ(-24deg) scale(1.04); }
      100% { transform: rotateX(54deg) rotateZ(-38deg) scale(.8); }
    }
    @keyframes drop {
      0% { visibility: hidden; transform: translateZ(calc(var(--z) + 520px)); }
      8% { visibility: visible; }
      72% { visibility: visible; transform: translateZ(var(--z)); }
      84% { visibility: visible; transform: translateZ(calc(var(--z) + 14px)); }
      100% { visibility: visible; transform: translateZ(var(--z)); }
    }
    @keyframes ring {
      0% { opacity: 0; transform: translateZ(calc(var(--z) + 1px)) scale(.7); }
      6% { opacity: .85; }
      100% { opacity: 0; transform: translateZ(calc(var(--z) + 1px)) scale(1.3); }
    }
    @keyframes lit { from { opacity: 0; } to { opacity: 1; } }
    @keyframes flick { 0% { opacity: 0; } 14% { opacity: 1; } 30% { opacity: 0; } 46% { opacity: .9; } 62% { opacity: .2; } 78% { opacity: .95; } 100% { opacity: 0; } }
    @keyframes sign-up {
      from { opacity: 0; transform: translate3d(0, var(--y), calc(var(--z) - 60px)) rotateX(-90deg); }
      to { opacity: 1; transform: translate3d(0, var(--y), var(--z)) rotateX(-90deg); }
    }
    @keyframes ride {
      0% { visibility: hidden; transform: translate3d(var(--x0), var(--y), 0) rotateZ(var(--rot)); }
      1%, 99% { visibility: visible; }
      100% { visibility: hidden; transform: translate3d(var(--x1), var(--y), 0) rotateZ(var(--rot)); }
    }
    @keyframes walk {
      0% { visibility: hidden; transform: translate3d(var(--x0), var(--y0), 0) rotateZ(var(--rot)); }
      2%, 100% { visibility: visible; }
      100% { transform: translate3d(var(--x1), var(--y1), 0) rotateZ(var(--rot)); }
    }
    @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    @keyframes rail-out { from { opacity: 1; } to { opacity: 0; } }
  }
}

/* Chân trang */
.foot {
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 28px; border-top: 1px solid var(--line); color: var(--ink-2); font-size: 15px;
  padding: 36px clamp(16px, 4vw, 48px) calc(36px + env(safe-area-inset-bottom, 0px));
}
.foot nav { display: flex; flex-wrap: wrap; gap: 4px 22px; }
.foot a { display: inline-flex; align-items: center; min-height: 44px; }
'''

css = CSS.replace('@@PALETTE@@', palette).replace('@@BUILDINGS@@', buildings)
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'gioi-thieu', 'gioi-thieu.css')
open(OUT, 'w', encoding='utf-8').write(css)
print('ghi gioi-thieu.css', len(css), 'ký tự;', palette.count('\n') + 1, 'màu ngày-chiều-đêm;', buildings.count('\n') + 1, 'tòa nhà')

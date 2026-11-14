/* ============================================================
   Happy Home — Giao diện theo mùa và lễ: hình vẽ, hạt rơi, màu (app khách thuê)

   Luật "hôm nay là mùa/lễ nào" và bảng màu nằm ở ../../js/seasons.js (thuần, có kiểm thử). Tệp này chỉ VẼ:
     - đặt bảng màu lên :root (thắng mọi bảng màu trong tenant.css, cả chế độ tối),
     - lớp hạt rơi/bay phủ toàn màn hình (không bắt chạm, nằm dưới thanh tab, nút trợ lý và hộp thoại),
     - tranh và ruy băng trong lời chào ở Trang chủ,
     - công tắc ở Tài khoản: Tự động / Tĩnh (không chuyển động) / Tắt, và nút xem thử từng mùa, từng lễ.
   Máy bật "giảm chuyển động" thì tự dùng bản tĩnh. Máy yếu thì giảm nửa số hạt. Tab bị ẩn thì tạm dừng hạt.
   Phần sinh hình (SPRITES, taoHat, veTranh) không đụng DOM nên chạy được trong node: tests/season-ui.test.js.
   ============================================================ */
(function (root) {
  'use strict';
  const S = (root.HH && root.HH.seasons) || (typeof require === 'function' ? require('../../js/seasons.js') : null);
  const B = (root.HH && root.HH.birthday) || (typeof require === 'function' ? require('../../js/birthday.js') : null);

  /* ---------- Bộ hình (mỗi hình trong khung 64 x 64, đổi màu bằng --c1 / --c2 đặt ở thẻ svg ngoài) ---------- */
  const F1 = 'style="fill:var(--c1)"', F2 = 'style="fill:var(--c2)"';
  const N1 = (w) => 'style="fill:none;stroke:var(--c1);stroke-width:' + w + ';stroke-linecap:round;stroke-linejoin:round"';
  const SAO = '32,6 38.76,24.7 58.63,25.35 42.94,37.55 48.46,56.65 32,45.5 15.54,56.65 21.06,37.55 5.37,25.35 25.24,24.7';
  const SPRITE = {
    // hoa năm cánh: hoa mai (vàng), hoa đào (hồng), hoa nói chung
    'sz-hoa': '<g ' + F1 + '><circle cx="32" cy="15" r="11"/><circle cx="48.2" cy="26.8" r="11"/><circle cx="42" cy="45.8" r="11"/><circle cx="22" cy="45.8" r="11"/><circle cx="15.8" cy="26.8" r="11"/></g><circle cx="32" cy="32" r="6.5" ' + F2 + '/>',
    'sz-la': '<path d="M32 4C52 16 56 42 32 60C8 42 12 16 32 4Z" ' + F1 + '/><path d="M32 14V56M32 30L41 22M32 40L43 32M32 30L23 22M32 40L21 32" style="fill:none;stroke:var(--c2);stroke-width:2.2;stroke-linecap:round;opacity:.65"/>',
    'sz-maple': '<path d="M32 5L38 19L51 14L47 28L59 30L47 41L51 47L36 44L34 59L30 59L28 44L13 47L17 41L5 30L17 28L13 14L26 19Z" style="fill:var(--c1);stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/><path d="M32 54V26M32 38L42 30M32 38L22 30" style="fill:none;stroke:var(--c2);stroke-width:2;stroke-linecap:round;opacity:.7"/>',
    'sz-tuyet': '<g ' + N1(4) + '><path d="M32 6V58M9.5 19L54.5 45M9.5 45L54.5 19"/><path d="M37.7 10.3L32 16L26.3 10.3M53.6 26.1L45.9 24L47.9 16.3M53.6 37.9L45.9 40L47.9 47.7M37.7 53.7L32 48L26.3 53.7M16.1 47.7L18.1 40L10.4 37.9M10.4 26.1L18.1 24L16.1 16.3"/></g>',
    'sz-tim': '<path d="M32 57C9 40 6 22 17 14C24 9 30 13 32 19C34 13 40 9 47 14C58 22 55 40 32 57Z" ' + F1 + '/><ellipse cx="21" cy="22" rx="5" ry="3" transform="rotate(-35 21 22)" style="fill:#fff;opacity:.35"/>',
    'sz-sao': '<polygon points="' + SAO + '" style="fill:var(--c1);stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/>',
    'sz-lap': '<path d="M32 3C34 22 42 30 61 32C42 34 34 42 32 61C30 42 22 34 3 32C22 30 30 22 32 3Z" ' + F1 + '/>',
    // Tết
    'sz-denlong': '<path d="M32 2V12" ' + N1(2.4).replace('var(--c1)', 'var(--c2)') + '/><rect x="23" y="11" width="18" height="5" rx="2" ' + F2 + '/><ellipse cx="32" cy="32" rx="21" ry="17" ' + F1 + '/><path d="M32 15C22 21 22 43 32 49M32 15C42 21 42 43 32 49M32 15V49" style="fill:none;stroke:var(--c2);stroke-opacity:.42;stroke-width:2"/><rect x="24" y="47" width="16" height="5" rx="2" ' + F2 + '/><path d="M32 52V61M28 52L27 60M36 52L37 60" style="fill:none;stroke:var(--c2);stroke-width:2;stroke-linecap:round"/>',
    'sz-lixi': '<rect x="14" y="6" width="36" height="52" rx="5" ' + F1 + '/><path d="M14 12Q32 36 50 12" style="fill:none;stroke:var(--c2);stroke-width:2.5;stroke-linecap:round"/><circle cx="32" cy="35" r="8.5" ' + F2 + '/><path d="M32 29l4.5 6-4.5 6-4.5-6z" ' + F1 + '/>',
    // mùa xuân và hè
    'sz-en': '<path d="M3 28C14 14 27 18 32 33C37 18 50 14 61 28C50 26 40 30 32 44C24 30 14 26 3 28Z" ' + F1 + '/><path d="M32 30C35 34 35 40 32 47C29 40 29 34 32 30Z" ' + F1 + '/><path d="M32 44L25 60L32 54L39 60Z" ' + F1 + '/>',
    'sz-nang': '<g ' + N1(4) + '><path d="M32 4V12M32 52V60M4 32H12M52 32H60M12.2 12.2L17.9 17.9M46.1 46.1L51.8 51.8M12.2 51.8L17.9 46.1M46.1 17.9L51.8 12.2"/></g><circle cx="32" cy="32" r="14" ' + F1 + '/><circle cx="32" cy="32" r="9" ' + F2 + '/>',
    'sz-bot': '<circle cx="32" cy="32" r="26" style="fill:var(--c1);fill-opacity:.2;stroke:var(--c1);stroke-opacity:.75;stroke-width:2.5"/><path d="M17 27A16 16 0 0 1 28 16" style="fill:none;stroke:#fff;stroke-opacity:.9;stroke-width:3.2;stroke-linecap:round"/>',
    'sz-song': '<path d="M0 36Q8 26 16 36T32 36T48 36T64 36V64H0Z" ' + F1 + '/><path d="M0 46Q8 38 16 46T32 46T48 46T64 46V64H0Z" style="fill:var(--c2);opacity:.85"/>',
    // Trung thu, Halloween, Giáng sinh, quốc khánh, 8/3
    'sz-trang': '<path d="M32.82 6.02A26 26 0 1 0 55.32 43.5A22 22 0 1 1 32.82 6.02Z" ' + F1 + '/>',
    'sz-densao': '<polygon points="' + SAO + '" style="fill:var(--c1);stroke:var(--c1);stroke-width:3;stroke-linejoin:round"/><polygon points="32,20 35.38,29.35 45.3,29.68 37.47,35.78 40.23,45.33 32,39.75 23.77,45.33 26.53,35.78 18.69,29.68 28.62,29.35" ' + F2 + '/><path d="M32 58C30 61 34 62 32 64" style="fill:none;stroke:var(--c2);stroke-width:2;stroke-linecap:round"/>',
    'sz-bido': '<path d="M31 14C31 9 34 6 38 5" style="fill:none;stroke:#5B8C2A;stroke-width:4;stroke-linecap:round"/><ellipse cx="19" cy="38" rx="13" ry="19" ' + F1 + '/><ellipse cx="45" cy="38" rx="13" ry="19" ' + F1 + '/><ellipse cx="32" cy="38" rx="13" ry="21" ' + F1 + '/><path d="M32 17C26 27 26 49 32 59M32 17C38 27 38 49 32 59" style="fill:none;stroke:var(--c2);stroke-opacity:.3;stroke-width:2"/><path d="M21 34l5-7 5 7zM33 34l5-7 5 7z" ' + F2 + '/><path d="M22 45L27 50L32 45L37 50L42 45V51L37 56L32 51L27 56L22 51Z" ' + F2 + '/>',
    'sz-cay': '<path d="M32 3L47 24H39L53 42H43L58 58H6L21 42H11L25 24H17Z" style="fill:var(--c1);stroke:var(--c1);stroke-width:2;stroke-linejoin:round"/><rect x="28" y="57" width="8" height="6" rx="1" style="fill:#8B5A2B"/><circle cx="26" cy="38" r="2.6" ' + F2 + '/><circle cx="38" cy="31" r="2.6" style="fill:#FFD54F"/><circle cx="34" cy="48" r="2.6" ' + F2 + '/><circle cx="20" cy="52" r="2.4" style="fill:#FFD54F"/><circle cx="46" cy="52" r="2.4" ' + F2 + '/><polygon points="32,4.5 33.29,8.22 37.23,8.3 34.09,10.68 35.2,14.45 32,12.2 28.8,14.45 29.91,10.68 26.77,8.3 30.71,8.22" style="fill:#FFD54F"/>',
    'sz-co': '<rect x="5" y="6" width="3.2" height="55" rx="1.6" style="fill:#B58A4A"/><path d="M8 12C18 6 26 18 36 12C46 6 52 12 58 10V42C52 44 46 38 36 44C26 50 18 38 8 44Z" ' + F1 + '/><polygon points="33,18 35.59,25.44 43.46,25.6 37.18,30.36 39.47,37.9 33,33.4 26.53,37.9 28.82,30.36 22.54,25.6 30.41,25.44" ' + F2 + '/>',
    'sz-tulip': '<path d="M32 60V34" style="fill:none;stroke:var(--c3,#4C9A4A);stroke-width:3.5;stroke-linecap:round"/><path d="M32 52C26 50 22 46 20 41C26 41 30 45 32 52Z" style="fill:var(--c3,#4C9A4A)"/><path d="M32 52C38 50 42 46 44 41C38 41 34 45 32 52Z" style="fill:var(--c3,#4C9A4A)"/><path d="M18 14C18 30 24 38 32 38C40 38 46 30 46 14L39 21L32 10L25 21Z" ' + F1 + '/>',
    // sinh nhật: mảnh giấy màu, bóng bay, bánh kem (ba nến), hộp quà
    'sz-giay': '<rect x="23" y="6" width="18" height="52" rx="4" ' + F1 + '/>',
    'sz-bongbay': '<path d="M32 4C46 4 54 15 54 27C54 41 43 50 32 52C21 50 10 41 10 27C10 15 18 4 32 4Z" ' + F1 + '/><path d="M32 52L27 58H37Z" ' + F1 + '/><path d="M32 58C28 60 36 62 32 64" style="fill:none;stroke:var(--c1);stroke-width:1.6;stroke-linecap:round;opacity:.7"/><ellipse cx="22" cy="19" rx="4.5" ry="8" transform="rotate(25 22 19)" style="fill:#fff;opacity:.38"/>',
    'sz-banh': '<rect x="22" y="14" width="4" height="12" rx="1.5" style="fill:#4CC9F0"/><rect x="30" y="14" width="4" height="12" rx="1.5" style="fill:#7C4DFF"/><rect x="38" y="14" width="4" height="12" rx="1.5" style="fill:#06D6A0"/><path d="M24 4C27 8 27 11 24 11C21 11 21 8 24 4ZM32 4C35 8 35 11 32 11C29 11 29 8 32 4ZM40 4C43 8 43 11 40 11C37 11 37 8 40 4Z" style="fill:#FFB300"/><rect x="14" y="26" width="36" height="14" rx="4" ' + F2 + '/><path d="M14 31C14 28 16 26 19 26H45C48 26 50 28 50 31V32C48 37 46 32 43 36C40 32 37 38 34 34C31 38 28 32 25 36C22 32 18 37 14 33Z" style="fill:#fff;opacity:.9"/><rect x="8" y="38" width="48" height="18" rx="5" ' + F1 + '/><path d="M8 47H56" style="fill:none;stroke:#fff;stroke-opacity:.6;stroke-width:2.4;stroke-dasharray:1 6;stroke-linecap:round"/>',
    'sz-qua': '<rect x="10" y="26" width="44" height="30" rx="3" ' + F1 + '/><rect x="6" y="19" width="52" height="11" rx="3" ' + F1 + '/><rect x="28" y="19" width="8" height="37" ' + F2 + '/><path d="M32 19C27 6 14 8 20 19Z" ' + F2 + '/><path d="M32 19C37 6 50 8 44 19Z" ' + F2 + '/>',
  };
  const SPRITE_IDS = Object.keys(SPRITE);
  const soDoSprite = () => '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
    SPRITE_IDS.map((id) => '<symbol id="' + id + '" viewBox="0 0 64 64">' + SPRITE[id] + '</symbol>').join('') + '</defs></svg>';

  /* ---------- Hiệu ứng từng bộ ----------
     hat: kiểu 'roi' (rơi từ trên xuống), 'bay' (bay lên), 'lap' (lấp lánh tại chỗ); n = số hạt; t = thời gian một vòng (giây);
          sw = biên độ lắc ngang (px); o = độ đậm; loai = các loại hạt (w = tỉ trọng, s = cỡ px, c1 = các màu chọn ngẫu nhiên).
     tranh: hình lớn trong lời chào. rt/tp/bt = cách mép phải / mép trên / mép dưới (px), w = cỡ (px), r = xoay (độ),
            a = chuyển động: treo (đung đưa), bong (nhấp nhô), quay (xoay chậm), luon (lượn), nhip (nhấp nháy), dl = trễ (giây).
     icon: hình nhỏ ở đầu ruy băng. */
  const HIEU_UNG = {
    xuan: {
      icon: { sp: 'sz-la', c1: '#5E9B34', c2: '#3E7A1E' },
      hat: { kieu: 'roi', n: 12, t: [11, 18], sw: 36, o: [0.65, 0.9], loai: [
        { sp: 'sz-hoa', c1: ['#F8B7D0', '#F59BBB', '#FBD0E0'], c2: '#E0457B', w: 5, s: [14, 22] },
        { sp: 'sz-la', c1: ['#8CC152', '#6FB03E', '#A5D06A'], c2: '#4C8A2B', w: 4, s: [14, 20] }] },
      tranh: [
        { sp: 'sz-la', rt: 4, bt: 0, w: 50, r: -35, c1: '#7CB342', c2: '#4C8A2B', a: 'bong' },
        { sp: 'sz-la', rt: 46, bt: -6, w: 40, r: 20, c1: '#9CCC65', c2: '#558B2F' },
        { sp: 'sz-hoa', rt: 30, tp: 50, w: 34, r: 10, c1: '#F8B7D0', c2: '#E0457B', a: 'bong' },
        { sp: 'sz-hoa', rt: 74, tp: 72, w: 24, r: -8, c1: '#F59BBB', c2: '#D81B60', a: 'bong', dl: -1.5 },
        { sp: 'sz-hoa', rt: 6, tp: 64, w: 20, r: 25, c1: '#FBD0E0', c2: '#E0457B' },
        { sp: 'sz-en', rt: 80, tp: 8, w: 34, r: -10, c1: '#33506B', a: 'luon' },
        { sp: 'sz-en', rt: 38, tp: 2, w: 26, r: 6, c1: '#33506B', a: 'luon', dl: -2 },
        { sp: 'sz-en', rt: 12, tp: 20, w: 20, r: 12, c1: '#33506B', a: 'luon', dl: -3.5 }] },
    ha: {
      icon: { sp: 'sz-nang', c1: '#F59E0B', c2: '#FFE082' },
      hat: { kieu: 'bay', n: 10, t: [9, 15], sw: 24, o: [0.6, 0.9], loai: [
        { sp: 'sz-bot', c1: ['#4FC3F7', '#81D4FA', '#29B6F6'], c2: '#fff', w: 6, s: [12, 26] },
        { sp: 'sz-lap', c1: ['#FFC107', '#FFD54F'], c2: '#fff', w: 2, s: [10, 14] }] },
      tranh: [
        { sp: 'sz-nang', rt: 12, tp: 4, w: 60, c1: '#FFB300', c2: '#FFE082', a: 'quay' },
        { sp: 'sz-bot', rt: 82, tp: 26, w: 22, c1: '#29B6F6', a: 'bong' },
        { sp: 'sz-bot', rt: 58, tp: 62, w: 16, c1: '#29B6F6', a: 'bong', dl: -1 },
        { sp: 'sz-bot', rt: 100, tp: 66, w: 12, c1: '#4FC3F7', a: 'bong', dl: -2 },
        { sp: 'sz-song', rt: -8, bt: -18, w: 112, c1: '#4FC3F7', c2: '#0288D1' }] },
    thu: {
      icon: { sp: 'sz-maple', c1: '#D84315', c2: '#8E2A0C' },
      hat: { kieu: 'roi', n: 12, t: [10, 17], sw: 40, o: [0.7, 0.92], loai: [
        { sp: 'sz-maple', c1: ['#D84315', '#F57C00', '#B5481F', '#E65100'], c2: '#7A2A0A', w: 6, s: [16, 24] },
        { sp: 'sz-la', c1: ['#F9A825', '#C9892B'], c2: '#8A5A12', w: 3, s: [14, 18] }] },
      tranh: [
        { sp: 'sz-maple', rt: 10, tp: 6, w: 50, r: 20, c1: '#D84315', c2: '#8E2A0C', a: 'bong' },
        { sp: 'sz-maple', rt: 58, tp: 50, w: 38, r: -25, c1: '#F57C00', c2: '#A24E00', a: 'bong', dl: -2 },
        { sp: 'sz-la', rt: 18, bt: 2, w: 36, r: 60, c1: '#F9A825', c2: '#B8741A' },
        { sp: 'sz-maple', rt: 98, tp: 18, w: 24, r: 10, c1: '#A1522B', c2: '#6B3414' }] },
    dong: {
      icon: { sp: 'sz-tuyet', c1: '#3D7BC4', c2: '#3D7BC4' },
      hat: { kieu: 'roi', n: 16, t: [12, 20], sw: 26, o: [0.6, 0.95], loai: [
        { sp: 'sz-tuyet', c1: ['#9CC4EE', '#B5D3F2', '#7FB2E5'], c2: '#fff', w: 1, s: [10, 20] }] },
      tranh: [
        { sp: 'sz-tuyet', rt: 14, tp: 4, w: 48, c1: '#7FB2E5', a: 'quay' },
        { sp: 'sz-tuyet', rt: 72, tp: 52, w: 30, c1: '#9CC4EE', a: 'quay', dl: -8 },
        { sp: 'sz-tuyet', rt: 38, bt: 2, w: 20, c1: '#B5D3F2' },
        { sp: 'sz-tuyet', rt: 104, tp: 10, w: 18, c1: '#B5D3F2' }] },
    tet: {
      icon: { sp: 'sz-lixi', c1: '#C62828', c2: '#FFC107' },
      hat: { kieu: 'roi', n: 12, t: [11, 17], sw: 34, o: [0.7, 0.95], loai: [
        { sp: 'sz-hoa', c1: ['#FFD23F', '#FFE066', '#FFC107'], c2: '#E8832A', w: 7, s: [14, 20] },
        { sp: 'sz-lixi', c1: ['#D32F2F'], c2: '#FFC107', w: 2, s: [16, 22] },
        { sp: 'sz-lap', c1: ['#FFC107', '#FFD54F'], c2: '#fff', w: 3, s: [10, 14] }] },
      tranh: [
        { sp: 'sz-denlong', rt: 14, tp: -8, w: 58, c1: '#D32F2F', c2: '#FFC107', a: 'treo' },
        { sp: 'sz-denlong', rt: 70, tp: -10, w: 44, c1: '#E53935', c2: '#FFC107', a: 'treo', dl: -1.8 },
        { sp: 'sz-hoa', rt: 8, bt: 6, w: 34, r: 10, c1: '#FFD23F', c2: '#E8832A', a: 'bong' },
        { sp: 'sz-hoa', rt: 44, bt: 2, w: 26, r: -12, c1: '#FFE066', c2: '#F57C00', a: 'bong', dl: -1 },
        { sp: 'sz-hoa', rt: 72, bt: 20, w: 18, c1: '#FFD23F', c2: '#E8832A' },
        { sp: 'sz-lixi', rt: 96, bt: 6, w: 34, r: -14, c1: '#D32F2F', c2: '#FFC107', a: 'bong', dl: -2 }] },
    namMoi: {
      icon: { sp: 'sz-lap', c1: '#F2A900', c2: '#F2A900' },
      hat: { kieu: 'lap', n: 14, t: [2.4, 4.6], sw: 0, o: [0.7, 1], loai: [
        { sp: 'sz-lap', c1: ['#FFC107', '#FFD54F', '#F2C14E', '#FFFFFF'], c2: '#fff', w: 1, s: [10, 22] }] },
      tranh: [
        { sp: 'sz-lap', rt: 14, tp: 8, w: 48, c1: '#FFC107', a: 'nhip' },
        { sp: 'sz-lap', rt: 72, tp: 42, w: 30, c1: '#F2A900', a: 'nhip', dl: -1 },
        { sp: 'sz-sao', rt: 52, tp: 2, w: 22, c1: '#FFC107', a: 'nhip', dl: -1.6 },
        { sp: 'sz-lap', rt: 106, tp: 14, w: 18, c1: '#FFB300', a: 'nhip', dl: -2 },
        { sp: 'sz-lap', rt: 30, bt: 8, w: 24, c1: '#F2C14E', a: 'nhip', dl: -0.6 }] },
    noel: {
      icon: { sp: 'sz-cay', c1: '#2E7D32', c2: '#D32F2F' },
      hat: { kieu: 'roi', n: 16, t: [12, 20], sw: 26, o: [0.6, 0.95], loai: [
        { sp: 'sz-tuyet', c1: ['#9CC4EE', '#B5D3F2', '#FFFFFF'], c2: '#fff', w: 1, s: [10, 20] }] },
      tranh: [
        { sp: 'sz-cay', rt: 16, bt: 0, w: 66, c1: '#2E7D32', c2: '#D32F2F' },
        { sp: 'sz-cay', rt: 82, bt: 0, w: 38, c1: '#43A047', c2: '#FFC107' },
        { sp: 'sz-tuyet', rt: 100, tp: 8, w: 26, c1: '#7FB2E5', a: 'quay' },
        { sp: 'sz-lap', rt: 64, tp: 12, w: 16, c1: '#FFC107', a: 'nhip' }] },
    tinhYeu: {
      icon: { sp: 'sz-tim', c1: '#E91E63', c2: '#E91E63' },
      hat: { kieu: 'bay', n: 10, t: [8, 14], sw: 26, o: [0.65, 0.92], loai: [
        { sp: 'sz-tim', c1: ['#EC407A', '#F06292', '#E91E63', '#F48FB1'], c2: '#fff', w: 1, s: [12, 22] }] },
      tranh: [
        { sp: 'sz-tim', rt: 14, tp: 8, w: 48, c1: '#E91E63', a: 'nhip' },
        { sp: 'sz-tim', rt: 66, tp: 46, w: 30, c1: '#F06292', a: 'bong', dl: -1 },
        { sp: 'sz-tim', rt: 98, tp: 6, w: 22, c1: '#EC407A', a: 'bong', dl: -2 },
        { sp: 'sz-tim', rt: 36, bt: 6, w: 20, c1: '#C2185B', a: 'nhip', dl: -0.8 }] },
    hoa: {
      icon: { sp: 'sz-tulip', c1: '#AB47BC', c2: '#AB47BC' },
      hat: { kieu: 'roi', n: 10, t: [11, 17], sw: 34, o: [0.65, 0.9], loai: [
        { sp: 'sz-hoa', c1: ['#F4A6C8', '#CE93D8', '#F8BBD0', '#BA68C8'], c2: '#C2185B', w: 1, s: [14, 20] }] },
      tranh: [
        { sp: 'sz-tulip', rt: 10, bt: -2, w: 66, c1: '#AB47BC' },
        { sp: 'sz-tulip', rt: 60, bt: -4, w: 52, c1: '#F06292' },
        { sp: 'sz-hoa', rt: 88, tp: 12, w: 30, c1: '#F4A6C8', c2: '#C2185B', a: 'bong' },
        { sp: 'sz-hoa', rt: 20, tp: 8, w: 26, c1: '#CE93D8', c2: '#7B1FA2', a: 'bong', dl: -1.5 }] },
    co: {
      icon: { sp: 'sz-sao', c1: '#E8A800', c2: '#E8A800' },
      hat: { kieu: 'roi', n: 10, t: [12, 19], sw: 24, o: [0.7, 0.95], loai: [
        { sp: 'sz-sao', c1: ['#FFC400', '#FFD740'], c2: '#fff', w: 1, s: [10, 16] }] },
      tranh: [
        { sp: 'sz-co', rt: 12, tp: 6, w: 58, r: 4, c1: '#DA251D', c2: '#FFDD00', a: 'luon' },
        { sp: 'sz-co', rt: 66, tp: 42, w: 40, r: -4, c1: '#DA251D', c2: '#FFDD00', a: 'luon', dl: -1.5 },
        { sp: 'sz-sao', rt: 104, tp: 10, w: 18, c1: '#FFC400', a: 'nhip' },
        { sp: 'sz-sao', rt: 34, bt: 6, w: 16, c1: '#FFC400', a: 'nhip', dl: -1 }] },
    trungThu: {
      icon: { sp: 'sz-densao', c1: '#E53935', c2: '#FFC107' },
      hat: { kieu: 'bay', n: 7, t: [14, 22], sw: 22, o: [0.75, 0.95], loai: [
        { sp: 'sz-densao', c1: ['#E53935', '#FB8C00', '#FFB300'], c2: '#FFE082', w: 1, s: [18, 28] }] },
      tranh: [
        { sp: 'sz-trang', rt: 10, tp: 6, w: 54, c1: '#FFCA28', a: 'bong' },
        { sp: 'sz-densao', rt: 72, tp: -4, w: 48, c1: '#E53935', c2: '#FFC107', a: 'treo' },
        { sp: 'sz-densao', rt: 106, tp: 24, w: 32, c1: '#FB8C00', c2: '#FFE082', a: 'treo', dl: -1.4 },
        { sp: 'sz-lap', rt: 38, bt: 8, w: 16, c1: '#FFC107', a: 'nhip' }] },
    halloween: {
      icon: { sp: 'sz-bido', c1: '#F57C00', c2: '#3E1F5C' },
      hat: { kieu: 'lap', n: 12, t: [2.4, 4.6], sw: 0, o: [0.7, 1], loai: [
        { sp: 'sz-lap', c1: ['#8E5BC2', '#FB8C00', '#B388FF'], c2: '#fff', w: 1, s: [10, 20] }] },
      tranh: [
        { sp: 'sz-bido', rt: 12, bt: 0, w: 56, c1: '#FB8C00', c2: '#3E1F5C', a: 'bong' },
        { sp: 'sz-bido', rt: 68, bt: -2, w: 38, c1: '#F57C00', c2: '#3E1F5C', a: 'bong', dl: -1.2 },
        { sp: 'sz-lap', rt: 22, tp: 8, w: 26, c1: '#8E5BC2', a: 'nhip' },
        { sp: 'sz-lap', rt: 80, tp: 22, w: 18, c1: '#FB8C00', a: 'nhip', dl: -1 }] },
    sinhNhat: {
      icon: { sp: 'sz-banh', c1: '#E0489B', c2: '#FFD166' },
      hat: { kieu: 'roi', n: 18, t: [8, 14], sw: 30, o: [0.8, 1], loai: [
        { sp: 'sz-giay', c1: ['#FF5C8A', '#FFD166', '#06D6A0', '#4CC9F0', '#B388FF', '#FF9F1C'], c2: '#fff', w: 8, s: [9, 15] },
        { sp: 'sz-lap', c1: ['#FFC107', '#FF5C8A'], c2: '#fff', w: 2, s: [10, 16] },
        { sp: 'sz-tim', c1: ['#FF5C8A', '#F48FB1'], c2: '#fff', w: 1, s: [10, 16] }] },
      tranh: [
        { sp: 'sz-bongbay', rt: 14, tp: -6, w: 46, r: 8, c1: '#FF5C8A', a: 'bong' },
        { sp: 'sz-bongbay', rt: 60, tp: -2, w: 40, r: -6, c1: '#4CC9F0', a: 'bong', dl: -1.2 },
        { sp: 'sz-bongbay', rt: 96, tp: 4, w: 32, r: 10, c1: '#FFC107', a: 'bong', dl: -2.4 },
        { sp: 'sz-banh', rt: 10, bt: -2, w: 56, c1: '#E0489B', c2: '#FFD166' },
        { sp: 'sz-qua', rt: 76, bt: 0, w: 34, r: -8, c1: '#7C4DFF', c2: '#FFD166' },
        { sp: 'sz-lap', rt: 106, tp: 58, w: 16, c1: '#FFC107', a: 'nhip' }] },
  };

  /* ---------- Sinh hạt và hình (thuần) ---------- */
  /** Bộ số ngẫu nhiên có hạt giống: cùng hạt giống thì cùng dãy số (để hạt không đổi chỗ mỗi lần vẽ lại, và để kiểm thử được) */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hatGiong = (chu) => { let h = 2166136261; for (let i = 0; i < chu.length; i++) { h ^= chu.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lamTron = (v, n) => +v.toFixed(n);

  /** Danh sách hạt cho bộ giao diện id. heSo < 1: ít hạt hơn (máy yếu). */
  function taoHat(id, rng, heSo) {
    const cfg = HIEU_UNG[id];
    if (!cfg || !cfg.hat) return [];
    const h = cfg.hat, n = Math.round(h.n * (heSo == null ? 1 : heSo)), tong = h.loai.reduce((a, l) => a + l.w, 0), out = [];
    for (let i = 0; i < n; i++) {
      let r = rng() * tong, l = h.loai[h.loai.length - 1];
      for (const x of h.loai) { if (r < x.w) { l = x; break; } r -= x.w; }
      const t = h.t[0] + rng() * (h.t[1] - h.t[0]);
      out.push({
        kieu: h.kieu, sp: l.sp, c1: l.c1[Math.floor(rng() * l.c1.length)], c2: l.c2,
        x: lamTron(2 + rng() * 94, 1), y: lamTron(6 + rng() * 80, 1),
        s: Math.round(l.s[0] + rng() * (l.s[1] - l.s[0])), t: lamTron(t, 1), dl: lamTron(-rng() * t, 1),
        sw: Math.round((rng() * 2 - 1) * h.sw), o: lamTron(h.o[0] + rng() * (h.o[1] - h.o[0]), 2),
      });
    }
    return out;
  }
  const veHat = (p) => '<i class="sz-p ' + p.kieu + '" style="--x:' + p.x + '%;--y:' + p.y + '%;--s:' + p.s + 'px;--t:' + p.t + 's;--dl:' + p.dl + 's;--sw:' + p.sw + 'px;--o:' + p.o +
    ';--c1:' + p.c1 + ';--c2:' + p.c2 + '"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#' + p.sp + '"/></svg></i>';

  /** Tranh trang trí trong lời chào */
  function veTranh(id) {
    const cfg = HIEU_UNG[id];
    if (!cfg) return '';
    return '<div class="sz-art" aria-hidden="true">' + cfg.tranh.map((a) => {
      const doc = a.bt != null ? 'bottom:' + a.bt + 'px' : 'top:' + (a.tp || 0) + 'px';
      return '<svg class="' + (a.a ? 'sz-' + a.a : '') + '" viewBox="0 0 64 64" width="' + a.w + '" height="' + a.w + '" style="right:' + (a.rt || 0) + 'px;' + doc +
        ';--r:' + (a.r || 0) + 'deg;--c1:' + a.c1 + ';--c2:' + (a.c2 || a.c1) + (a.dl ? ';animation-delay:' + a.dl + 's' : '') + '"><use href="#' + a.sp + '"/></svg>';
    }).join('') + '</div>';
  }
  /** Ruy băng nói hôm nay là mùa/lễ gì */
  function veRuyBang(kq) {
    const cfg = HIEU_UNG[kq.giaoDien];
    if (!cfg) return '';
    return '<div class="sz-ribbon"><svg viewBox="0 0 64 64" aria-hidden="true" style="--c1:' + cfg.icon.c1 + ';--c2:' + cfg.icon.c2 + '"><use href="#' + cfg.icon.sp + '"/></svg><span>' + esc(kq.dong) + '</span></div>';
  }

  /* ---------- Sinh nhật: banner lời chúc, banner chúc mừng nổi lên, giấy màu bắn ra (thuần) ---------- */
  /** Banner lời chúc nằm dưới băng chào ở Trang chủ. ten: tên gọi của khách. */
  function veTheSinhNhat(ten) {
    const x = B.loiChucApp(ten);
    return '<section class="sz-bday" aria-label="Chúc mừng sinh nhật"><svg viewBox="0 0 64 64" aria-hidden="true" style="--c1:#E0489B;--c2:#FFD166"><use href="#sz-banh"/></svg>' +
      '<div><b>' + esc(x.tieuDe) + '</b><p>' + esc(x.noiDung) + '</p></div></section>';
  }
  /** Các mảnh giấy màu bắn ra khi banner chúc mừng mở. Cùng hạt giống cho cùng kết quả. */
  function taoNo(rng, n) {
    const mau = ['#FF5C8A', '#FFD166', '#06D6A0', '#4CC9F0', '#B388FF', '#FF9F1C'], out = [];
    for (let i = 0; i < n; i++) {
      const goc = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 1.15, luc = 90 + rng() * 170;      // chủ yếu bắn lên, tỏa hai bên
      out.push({ dx: Math.round(Math.cos(goc) * luc * 1.2), dy: Math.round(Math.sin(goc) * luc), roi: Math.round(240 + rng() * 180),
        quay: Math.round((rng() * 2 - 1) * 720), t: lamTron(1.6 + rng() * 1.2, 1), s: Math.round(10 + rng() * 8), c1: mau[i % mau.length] });
    }
    return out;
  }
  const veNo = (p) => '<i class="sz-nd" style="--dx:' + p.dx + 'px;--dy:' + p.dy + 'px;--fall:' + p.roi + 'px;--rot:' + p.quay + 'deg;--d:' + p.t + 's;--s:' + p.s +
    'px;--c1:' + p.c1 + '"><svg viewBox="0 0 64 64" aria-hidden="true"><use href="#sz-giay"/></svg></i>';
  /** Banner chúc mừng nổi lên giữa màn hình một lần trong ngày sinh nhật. no: các mảnh giấy (bản tĩnh thì để rỗng). */
  function veHopChuc(ten, no) {
    const x = B.loiChucApp(ten), t = String(ten == null ? '' : ten).trim() || 'bạn';
    const hinh = (sp, cls, c1, c2) => '<svg class="' + cls + '" viewBox="0 0 64 64" aria-hidden="true" style="--c1:' + c1 + ';--c2:' + c2 + '"><use href="#' + sp + '"/></svg>';
    return '<div class="sz-pop-bg" data-dong></div><div class="sz-pop-box" role="dialog" aria-modal="true" aria-labelledby="szPopT">' + (no || []).map(veNo).join('') +
      '<div class="sz-pop-art" aria-hidden="true">' + hinh('sz-bongbay', 'sz-bong pa1', '#FF5C8A', '#fff') + hinh('sz-banh', 'pa2', '#E0489B', '#FFD166') + hinh('sz-bongbay', 'sz-bong pa3', '#4CC9F0', '#fff') + '</div>' +
      '<h3 id="szPopT">Chúc mừng sinh nhật, ' + esc(t) + '!</h3><p>' + esc(x.noiDung) + '</p>' +
      '<button type="button" class="t-btn" id="szPopOk" data-dong>Cảm ơn Happy Home</button></div>';
  }

  /* ---------- Lựa chọn của người dùng (lưu ở máy này) ---------- */
  const KHO = 'hh_season', KHO_XEM = 'hh_season_xem', KHO_POP = 'hh_bday_pop';
  const doc = (k, ss) => { try { return (ss ? root.sessionStorage : root.localStorage).getItem(k); } catch (e) { return null; } };
  const ghi = (k, v, ss) => { try { const st = ss ? root.sessionStorage : root.localStorage; if (v == null) st.removeItem(k); else st.setItem(k, v); } catch (e) { /* trình duyệt chặn lưu thì thôi */ } };
  const cheDo = () => { const v = doc(KHO); return v === 'tinh' || v === 'tat' ? v : 'auto'; };
  const xemThu = () => { const v = doc(KHO_XEM, true); return v && S.GIAO_DIEN[v] ? v : null; };
  const giamChuyenDong = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /** 'dong' (đầy đủ), 'tinh' (màu và hình, không chuyển động), 'tat' */
  const hieuLuc = () => { const m = cheDo(); return m === 'auto' ? (giamChuyenDong() ? 'tinh' : 'dong') : m === 'tinh' ? 'tinh' : 'tat'; };
  const mayYeu = () => { const n = root.navigator || {}; return (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2); };
  function laToi() {
    const el = root.document.documentElement, t = el.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches));
  }

  /* ---------- Vẽ lên trang (chỉ chạy trong trình duyệt) ---------- */
  let cur = { kq: null, mode: 'tat', toi: false }, daVe = '', hen = null, daDatSprite = false;
  let ca = null, caKhoa = '';           // khách đang đăng nhập: { id, ten (tên gọi), dob }; null khi chưa đăng nhập hoặc chưa có ngày sinh
  let popKhoa = '', lanXem = 0;         // banner chúc mừng đã nổi lên cho "lần" nào; lanXem đếm số lần bấm xem thử

  /** Gọi mỗi khi vẽ màn hình với hồ sơ khách ({ id, fullName, dob }), hoặc null khi chưa đăng nhập. Hồ sơ đổi thì tự tính lại. */
  function datCaNhan(khach) {
    const moi = khach && khach.dob && B ? { id: String(khach.id || ''), ten: B.tenGoi(khach.fullName), dob: String(khach.dob) } : null;
    const k = moi ? moi.id + '|' + moi.dob + '|' + moi.ten : '';
    if (k === caKhoa) return;
    caKhoa = k; ca = moi; apDung(false);
  }
  /** Hôm nay là mùa/lễ nào đối với người đang dùng; đúng ngày sinh của họ thì bộ Sinh nhật thắng tất cả */
  function chonHomNay() {
    const now = Date.now();
    return S.chon(now, ca && B.laHomNay(ca.dob, now) ? { sinhNhat: { ten: ca.ten } } : null);
  }

  /** Banner chúc mừng nổi giữa màn hình (một lần trong ngày sinh nhật, hoặc mỗi lần bấm xem thử) */
  function dongHop() { const h = root.document.getElementById('szPop'); if (h) h.remove(); root.document.removeEventListener('keydown', phimHop); }
  function phimHop(e) { if (e.key === 'Escape') dongHop(); }
  function moHop() {
    const d = root.document;
    dongHop(); datSprite();
    const el = d.createElement('div'); el.id = 'szPop'; el.className = 'sz-pop';
    el.innerHTML = veHopChuc(ca ? ca.ten : '', cur.mode === 'dong' ? taoNo(mulberry32((Date.now() >>> 0) ^ 0x9E3779B9), 32) : []);
    d.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-dong]')) dongHop(); });
    d.addEventListener('keydown', phimHop);
    if (root.requestAnimationFrame) root.requestAnimationFrame(() => el.classList.add('on')); else el.classList.add('on');
    const ok = d.getElementById('szPopOk'); if (ok && ok.focus) ok.focus();
  }

  function datSprite() {
    if (daDatSprite || root.document.getElementById('szSprite')) { daDatSprite = true; return; }
    const w = root.document.createElement('div'); w.id = 'szSprite'; w.innerHTML = soDoSprite();
    root.document.body.insertBefore(w, root.document.body.firstChild); daDatSprite = true;
  }
  /** Thanh trạng thái của điện thoại ăn theo màu thanh trên của app */
  function datMauThanh(sang, toi) {
    root.document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (!m.hasAttribute('data-goc')) m.setAttribute('data-goc', m.getAttribute('content') || '');
      if (sang) m.setAttribute('content', /dark/.test(m.getAttribute('media') || '') ? toi : sang);
      else m.setAttribute('content', m.getAttribute('data-goc'));
    });
  }
  function veLop(kq, mode) {
    const lop = root.document.getElementById('szLop'), cfg = kq && HIEU_UNG[kq.giaoDien];
    if (!kq || mode !== 'dong' || !cfg || !cfg.hat) { if (lop) lop.remove(); return; }
    datSprite();
    const el = lop || root.document.createElement('div');
    if (!lop) { el.id = 'szLop'; el.className = 'sz-layer'; el.setAttribute('aria-hidden', 'true'); root.document.body.appendChild(el); }
    const hom = S.ngayVN(Date.now());
    el.innerHTML = taoHat(kq.giaoDien, mulberry32(hatGiong(kq.giaoDien + hom.d + '/' + hom.m)), mayYeu() ? 0.5 : 1).map(veHat).join('');
    el.classList.toggle('sz-pause', !!root.document.hidden);
  }
  /** Gắn tranh, ruy băng (và banner lời chúc sinh nhật) vào lời chào ở Trang chủ; nổi banner chúc mừng. Gọi sau mỗi lần vẽ màn hình. */
  function sauKhiVe() {
    if (!root.document) return;
    const kq = cur.kq;
    // Banner chúc mừng nổi lên MỘT lần trong ngày sinh nhật (nhớ ở máy này); bấm xem thử thì nổi lên mỗi lần bấm
    if (kq && kq.giaoDien === 'sinhNhat' && root.document.querySelector('.t-main')) {
      const thu = xemThu(), khoaHop = thu ? 'xem:' + lanXem : B.khoaNgay(Date.now()) + '|' + (ca ? ca.id : '');
      if (khoaHop !== popKhoa && (thu || doc(KHO_POP) !== khoaHop)) { popKhoa = khoaHop; if (!thu) ghi(KHO_POP, khoaHop); moHop(); }
    }
    const hello = root.document.querySelector('.t-hello');
    if (!hello) return;
    const khoa = kq ? kq.giaoDien + '|' + kq.dong : '';
    if ((hello.getAttribute('data-sz') || '') === khoa) return;
    hello.querySelectorAll('.sz-art, .sz-ribbon').forEach((n) => n.remove());
    const cu = hello.nextElementSibling; if (cu && cu.classList.contains('sz-bday')) cu.remove();
    hello.removeAttribute('data-sz');
    if (!kq || !HIEU_UNG[kq.giaoDien]) return;
    datSprite();
    hello.insertAdjacentHTML('afterbegin', veTranh(kq.giaoDien));
    hello.insertAdjacentHTML('beforeend', veRuyBang(kq));
    if (kq.giaoDien === 'sinhNhat') hello.insertAdjacentHTML('afterend', veTheSinhNhat(ca ? ca.ten : ''));
    hello.setAttribute('data-sz', khoa);
  }
  /** Tính lại hôm nay là mùa/lễ gì và vẽ lại nếu có gì đổi. ep = vẽ lại dù không đổi. */
  function apDung(ep) {
    if (!root.document || !S) return;
    const mode = hieuLuc(), x = xemThu();
    const kq = mode === 'tat' ? null : (x ? S.xemThu(x, ca && ca.ten) : chonHomNay());
    const toi = laToi();
    const khoa = [kq ? kq.giaoDien : '-', kq ? kq.dong : '', mode, toi ? 'd' : 'l'].join('|');
    if (!ep && khoa === daVe) return;
    daVe = khoa; cur = { kq, mode, toi };
    const el = root.document.documentElement;
    if (kq) {
      const b = S.bangMau(kq.giaoDien, toi);
      S.TEN_BIEN.forEach((k) => el.style.setProperty(k, b.vars[k]));
      el.setAttribute('data-sz', kq.giaoDien); el.classList.add('sz-on'); el.classList.toggle('sz-tinh', mode === 'tinh');
      datMauThanh(S.bangMau(kq.giaoDien, false).themeColor, S.bangMau(kq.giaoDien, true).themeColor);
    } else {
      S.TEN_BIEN.forEach((k) => el.style.removeProperty(k));
      el.removeAttribute('data-sz'); el.classList.remove('sz-on', 'sz-tinh'); datMauThanh(null, null);
    }
    veLop(kq, mode);
    sauKhiVe();
    if (root.document.getElementById('szInfo')) capNhatCaiDat();      // đang mở trang Tài khoản thì dòng chú thích cũng đổi theo
  }
  /** Hẹn tính lại đúng lúc sang ngày mới giờ Việt Nam (app có thể mở nhiều ngày liền) */
  function henGio() {
    root.clearTimeout(hen);
    hen = root.setTimeout(() => { apDung(false); henGio(); }, Math.max(1000, S.msDenNuaDem(Date.now()) + 1500));
  }
  function khoiDong() {
    if (!root.document || !S) return;
    apDung(true); henGio();
    root.document.addEventListener('visibilitychange', () => {
      const lop = root.document.getElementById('szLop'); if (lop) lop.classList.toggle('sz-pause', !!root.document.hidden);
      if (!root.document.hidden) { apDung(false); henGio(); }
    });
    root.addEventListener('focus', () => apDung(false));
    if (root.matchMedia) {
      const doi = () => apDung(false);
      ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].forEach((q) => {
        const mq = root.matchMedia(q);
        if (mq.addEventListener) mq.addEventListener('change', doi); else if (mq.addListener) mq.addListener(doi);
      });
    }
    if (root.MutationObserver) new root.MutationObserver(() => apDung(false)).observe(root.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ---------- Công tắc ở Tài khoản ---------- */
  function moTaCaiDat() {
    const m = cheDo(), x = xemThu();
    if (m === 'tat') return 'Đã tắt: app dùng giao diện mặc định.';
    if (x) return 'Đang xem thử: <b>' + esc(S.GIAO_DIEN[x].ten) + '</b>. Chọn "Theo ngày" để quay lại.';
    const kq = chonHomNay();
    return 'Hôm nay: <b>' + esc(kq.ten) + '</b> · ' + esc(kq.dong) + (hieuLuc() === 'tinh' ? '. Không chuyển động.' : '.');
  }
  function caiDatHtml() {
    if (!S) return '';
    const m = cheDo(), x = xemThu();
    const seg = [['auto', 'Tự động'], ['tinh', 'Tĩnh'], ['tat', 'Tắt']].map(([k, l]) =>
      '<button type="button" class="' + (m === k ? 'on' : '') + '" data-sz-mode="' + k + '" aria-pressed="' + (m === k) + '">' + l + '</button>').join('');
    const chips = '<button type="button" class="sz-chip' + (!x ? ' on' : '') + '" data-sz-xem="" aria-pressed="' + (!x) + '">Theo ngày</button>' +
      S.DANH_SACH.map((id) => '<button type="button" class="sz-chip' + (x === id ? ' on' : '') + '" data-sz-xem="' + id + '" aria-pressed="' + (x === id) + '">' + esc(S.GIAO_DIEN[id].ngan) + '</button>').join('');
    return '<div class="t-action t-season" role="group" aria-label="Giao diện theo mùa và lễ"><span class="aic"><svg width="20" height="20" viewBox="0 0 64 64" aria-hidden="true" style="--c1:currentColor;--c2:#fff"><use href="#sz-la"/></svg></span>' +
      '<span style="flex:1">Mùa và lễ</span><span class="t-seg">' + seg + '</span></div>' +
      '<div class="sz-info" id="szInfo" aria-live="polite">' + moTaCaiDat() + '</div>' +
      '<details class="sz-try"><summary>Xem thử các mùa và lễ</summary><div class="sz-chips">' + chips + '</div></details>';
  }
  function capNhatCaiDat() {
    const m = cheDo(), x = xemThu(), d = root.document;
    d.querySelectorAll('[data-sz-mode]').forEach((b) => { const on = b.dataset.szMode === m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    d.querySelectorAll('[data-sz-xem]').forEach((b) => { const on = (b.dataset.szXem || null) === x; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const info = d.getElementById('szInfo'); if (info) info.innerHTML = moTaCaiDat();
  }
  function noiCaiDat() {
    if (!root.document) return;
    datSprite();
    root.document.querySelectorAll('[data-sz-mode]').forEach((b) => {
      b.onclick = () => { ghi(KHO, b.dataset.szMode === 'auto' ? null : b.dataset.szMode); apDung(true); capNhatCaiDat(); };
    });
    root.document.querySelectorAll('[data-sz-xem]').forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.szXem || null;
        ghi(KHO_XEM, id, true); lanXem++;
        if (id && cheDo() === 'tat') ghi(KHO, null);               // chọn xem thử mà đang tắt thì bật lại
        apDung(true); capNhatCaiDat();
      };
    });
  }

  /* Đây chỉ là trang trí: có lỗi gì thì ghi nhật ký rồi bỏ qua, KHÔNG bao giờ để làm hỏng màn hình thanh toán, hóa đơn hay chat của khách.
     Mọi hàm app khách gọi tới đều đi qua đây. */
  const antoan = (f, macDinh) => function () {
    try { return f.apply(this, arguments); } catch (e) { if (root.console && root.console.info) root.console.info('Giao diện theo mùa gặp lỗi, bỏ qua:', e && e.message); return macDinh; }
  };
  const api = {
    SPRITE, SPRITE_IDS, HIEU_UNG, soDoSprite, mulberry32, hatGiong, taoHat, veHat, veTranh, veRuyBang, esc, veTheSinhNhat, veHopChuc, taoNo, veNo, antoan,
    init: antoan(khoiDong), refresh: antoan(apDung), afterRender: antoan(sauKhiVe), settingsHtml: antoan(caiDatHtml, ''), wireSettings: antoan(noiCaiDat),
    datCaNhan: antoan(datCaNhan),
    current: () => cur,
    xem: antoan((id) => { ghi(KHO_XEM, id || null, true); lanXem++; apDung(true); }),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.seasonUI = api; }
})(typeof window !== 'undefined' ? window : globalThis);

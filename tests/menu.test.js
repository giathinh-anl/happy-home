/* Menu nổi (nút "Thêm" của tòa, các nút ⋯): mở/đóng nhiều lần không được để lại bộ nghe treo trên trang.
   Lỗi thật (26/11, chủ trọ quay video): bộ nghe "bấm chỗ khác thì đóng" { once: true } còn treo sau khi menu đóng bằng
   đường khác, nên lần bấm kế tiếp menu vừa mở đã đóng ngay ("lúc được lúc không").
   Chạy thật đoạn mã openMenu/closeMenus của js/components.js trên một trang giả tối giản (vm).  Chạy:  node tests/menu.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'components.js'), 'utf8');
const dau = src.indexOf('  let menuGo = null;'), cuoi = src.indexOf('\n  }', src.indexOf('  function closeMenus() {')) + 4;
const doan = src.slice(dau, cuoi);

/* ---- trang giả: chỉ đủ cho openMenu/closeMenus ---- */
function moTrang() {
  const nghe = (o) => { o.ls = []; o.addEventListener = (t, f, opt) => o.ls.push({ t, f, cap: !!(opt === true || (opt && opt.capture)), once: !!(opt && opt.once) });
    o.removeEventListener = (t, f, opt) => { const cap = !!(opt === true || (opt && opt.capture)); const i = o.ls.findIndex(x => x.t === t && x.f === f && x.cap === cap); if (i >= 0) o.ls.splice(i, 1); };
    o.phat = (t, e) => o.ls.filter(x => x.t === t).slice().forEach(x => { if (x.once) o.removeEventListener(t, x.f, x.cap); x.f(e); }); return o; };
  const menus = [];
  const nut = (ten) => ({ ten, children: [], contains(t) { return t === this; }, getBoundingClientRect: () => ({ left: 100, right: 160, top: 10, bottom: 40 }) });
  const document = nghe({
    body: { appendChild(m) { menus.push(m); m.parent = true; } },
    createElement() {
      const m = { className: '', dataset: {}, style: {}, offsetWidth: 220, offsetHeight: 200, btns: [], parent: false,
        set innerHTML(s) { this.btns = (s.match(/<button/g) || []).map((_, i) => nghe({ ten: 'muc' + i, click() { this.phat('click', { target: this }); } })); },
        querySelectorAll() { return this.btns; }, contains(t) { return t === this || this.btns.includes(t); },
        remove() { const i = menus.indexOf(this); if (i >= 0) menus.splice(i, 1); this.parent = false; } };
      return m;
    },
    querySelectorAll: (sel) => sel === '.menu[data-floating]' ? menus.slice() : [],
    querySelector: (sel) => sel === '.menu[data-floating]' ? (menus[0] || null) : null,
  });
  const window = nghe({ innerWidth: 1366, innerHeight: 800, scrollX: 0, scrollY: 0 });
  const ctx = { document, window, setTimeout: (f) => f(), esc: (s) => String(s) };
  vm.createContext(ctx);
  vm.runInContext(doan + '\nthis.openMenu = openMenu; this.closeMenus = closeMenus;', ctx);
  // "bấm" như trình duyệt: pointerdown rồi click, cả hai qua document (pha bắt) rồi tới phần tử
  const bam = (el, khiBam) => { const e = { target: el }; document.phat('pointerdown', e); document.phat('click', e); if (el.phat) el.phat('click', e); if (khiBam) khiBam(); };
  return { ctx, document, window, menus, nut, bam, soNghe: () => document.ls.length + window.ls.length };
}
const MUC = [{ label: 'Chỉ số điện', onClick() {} }, { label: 'Thu chi', onClick() {} }];

test('lấy được đúng đoạn openMenu/closeMenus trong js/components.js', () => {
  assert.ok(dau > 0 && /function openMenu\(anchor, items\)/.test(doan) && /function closeMenus\(\)/.test(doan), 'không thấy đoạn mã menu');
});
test('bấm nút "Thêm" liên tục: mở, đóng, mở, đóng... đúng luân phiên (không còn lúc được lúc không)', () => {
  const T = moTrang(), them = T.nut('Thêm');
  const ketQua = [];
  for (let i = 0; i < 8; i++) { T.bam(them, () => T.ctx.openMenu(them, MUC)); ketQua.push(T.menus.length); }
  assert.deepStrictEqual(ketQua, [1, 0, 1, 0, 1, 0, 1, 0]);
});
test('menu đóng (bằng bất cứ đường nào) thì không còn bộ nghe nào treo trên trang', () => {
  const T = moTrang(), them = T.nut('Thêm'), ngoai = T.nut('tiêu đề trang');
  const goc = T.soNghe();
  T.bam(them, () => T.ctx.openMenu(them, MUC)); assert.ok(T.soNghe() > goc, 'mở menu phải gắn bộ nghe');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); assert.strictEqual(T.soNghe(), goc, 'bấm lại nút');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); T.bam(ngoai); assert.strictEqual(T.menus.length, 0); assert.strictEqual(T.soNghe(), goc, 'bấm ra ngoài');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); T.bam(T.menus[0].btns[1]); assert.strictEqual(T.menus.length, 0); assert.strictEqual(T.soNghe(), goc, 'chọn một mục');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); T.window.scrollY = 200; T.window.phat('scroll', {}); assert.strictEqual(T.menus.length, 0); assert.strictEqual(T.soNghe(), goc, 'cuộn trang');
  T.window.scrollY = 0;
  T.bam(them, () => T.ctx.openMenu(them, MUC)); T.ctx.closeMenus(); assert.strictEqual(T.soNghe(), goc, 'phím Esc (closeMenus)');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); T.window.phat('resize', {}); assert.strictEqual(T.soNghe(), goc, 'đổi cỡ cửa sổ');
  T.bam(them, () => T.ctx.openMenu(them, MUC)); assert.strictEqual(T.menus.length, 1, 'sau tất cả, bấm nút vẫn mở được ngay');
});
test('chọn mục trong menu thì chạy đúng mục đó và menu đóng', () => {
  const T = moTrang(), them = T.nut('Thêm'); let chon = '';
  T.bam(them, () => T.ctx.openMenu(them, [{ label: 'A', onClick() { chon = 'A'; } }, { label: 'B', onClick() { chon = 'B'; } }]));
  T.bam(T.menus[0].btns[1]);
  assert.strictEqual(chon, 'B'); assert.strictEqual(T.menus.length, 0);
});
test('cuộn nhẹ (bàn rê chuột) không đóng menu, cuộn hẳn thì đóng', () => {
  const T = moTrang(), them = T.nut('Thêm');
  T.bam(them, () => T.ctx.openMenu(them, MUC));
  T.window.scrollY = 6; T.window.phat('scroll', {}); assert.strictEqual(T.menus.length, 1, 'cuộn 6px đã đóng');
  T.window.scrollY = 120; T.window.phat('scroll', {}); assert.strictEqual(T.menus.length, 0, 'cuộn 120px chưa đóng');
});
test('đang mở menu nút ⋯ dòng 1, bấm nút ⋯ dòng 2 thì menu dòng 2 mở (chỉ một menu)', () => {
  const T = moTrang(), k1 = T.nut('⋯1'), k2 = T.nut('⋯2');
  T.bam(k1, () => T.ctx.openMenu(k1, MUC)); T.bam(k2, () => T.ctx.openMenu(k2, MUC));
  assert.strictEqual(T.menus.length, 1);
  T.bam(k2, () => T.ctx.openMenu(k2, MUC)); assert.strictEqual(T.menus.length, 0, 'bấm lại ⋯2 phải đóng');
});
test('đã nâng phiên bản components.js', () => {
  assert.ok(+/js\/components\.js\?v=(\d+)/.exec(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'))[1] >= 104);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

/* ============================================================
   Hướng dẫn làm quen từng bước cho app khách thuê.
   Thay cho hộp thoại chữ (alert) cũ ở Tài khoản → Hướng dẫn sử dụng. Giống phần hướng dẫn của web chủ trọ (js/pages/help.js):
   màn hình tối đi, một ô sáng chỉ vào nút đang nói tới, thẻ chữ nằm gần đó. Thêm: ô sáng và thẻ trượt mượt giữa các bước,
   thanh tiến độ và chấm bước, viền nhấp nháy nhẹ. Máy bật "giảm chuyển động" thì tắt hết chuyển động.

   Phần thuần (danh sách bước, đi tới/lui, đặt thẻ) có kiểm thử: tests/tenant-tour.test.js. Phần vẽ: HH.tenantTour.start().
   Hướng dẫn chỉ là phụ: lỗi gì cũng không được làm hỏng màn hình thanh toán, hóa đơn hay chat (xem chỗ gọi trong tenant.js).
   ============================================================ */
(function (root) {
  'use strict';

  /* mucTieu: danh sách bộ chọn CSS, lấy phần tử ĐẦU TIÊN đang hiện (điện thoại có thanh tab ở dưới, máy tính có thanh bên).
     Bước có mucTieu mà không phần tử nào đang hiện thì bị bỏ qua (ví dụ hết nợ thì không còn nút Thanh toán ngay).
     mucTieu rỗng = thẻ nằm giữa màn hình, không làm sáng chỗ nào. codinh: phần tử dính cố định ở màn hình (thanh tab, nút nổi), khỏi cuộn tới. */
  const BUOC = [
    { id: 'chao', tieuDe: 'Chào mừng đến Happy Home', noiDung: 'Xem nhanh các nút chính trong chưa tới một phút. Bấm Tiếp để xem, hoặc Bỏ qua bất cứ lúc nào.', mucTieu: [] },
    { id: 'tien', tieuDe: 'Tiền cần đóng', noiDung: 'Số tiền và hạn đóng của tháng này nằm ở đây. Quá hạn thì hiện nhãn đỏ để nhắc.', mucTieu: ['.due-card'] },
    { id: 'thanh-toan', tieuDe: 'Thanh toán bằng mã QR', noiDung: 'Bấm Thanh toán ngay để hiện mã VietQR. Quét bằng app ngân hàng bất kỳ, số tiền và nội dung tự điền sẵn, chuyển xong hệ thống tự trừ công nợ.', mucTieu: ['#payNow'] },
    { id: 'nhanh', tieuDe: 'Truy cập nhanh', noiDung: 'Mở hóa đơn, gửi chỉ số điện kèm ảnh đồng hồ, báo hỏng hoặc hỏi trợ lý ảo chỉ với một chạm.', mucTieu: ['.quick-grid'] },
    { id: 'hoa-don', tieuDe: 'Hóa đơn', noiDung: 'Xem chi tiết từng khoản và các tháng trước.', mucTieu: ['.t-tab[data-tab="#/invoices"]', '.t-nav[data-tab="#/invoices"]'], codinh: true },
    { id: 'phong', tieuDe: 'Phòng của tôi', noiDung: 'Hợp đồng, điều khoản, tài sản trong phòng và bảng giá dịch vụ.', mucTieu: ['.t-tab[data-tab="#/room"]', '.t-nav[data-tab="#/room"]'], codinh: true },
    { id: 'tai-khoan', tieuDe: 'Tài khoản', noiDung: 'Lịch sử thanh toán và biên lai, đổi giao diện sáng tối hoặc theo mùa và lễ, đổi mã vào app.', mucTieu: ['.t-tab[data-tab="#/account"]', '.t-nav[data-tab="#/account"]'], codinh: true },
    { id: 'tro-ly', tieuDe: 'Trợ lý ảo', noiDung: 'Hỏi tiền phòng, điện nước, hợp đồng bằng chữ hoặc giọng nói. Cần người thật thì nhắn nhân viên, gửi được cả ảnh.', mucTieu: ['#chatFab', '.t-nav[data-tab="#/chat"]'], codinh: true },
    { id: 'xong', tieuDe: 'Xong rồi', noiDung: 'Muốn xem lại thì vào Tài khoản, bấm Hướng dẫn sử dụng.', mucTieu: [] },
  ];

  /** Chọn các bước dùng được. coHien(mucTieu) trả true nếu có phần tử đang hiện; do phần vẽ truyền vào để phần này thuần. */
  function lapBuoc(coHien) {
    return BUOC.filter((s) => !s.mucTieu.length || (typeof coHien === 'function' ? !!coHien(s.mucTieu) : true));
  }
  /** Bước kế tiếp / trước, kẹp trong [0, tong-1]. Trả { i, xong }; xong = true khi bấm Tiếp ở bước cuối. */
  function dich(i, huong, tong) {
    const n = Math.max(0, (tong | 0) - 1), cur = Math.min(Math.max(i | 0, 0), n);
    if (huong > 0) return cur >= n ? { i: n, xong: true } : { i: cur + 1, xong: false };
    return { i: Math.max(cur - 1, 0), xong: false };
  }
  /** Đặt thẻ gần phần tử được chỉ: ưu tiên bên dưới, không đủ chỗ thì bên trên, không đủ cả hai thì giữa màn hình;
      luôn nằm trọn trong khung nhìn (cách mép lề px). rect = { x, y, w, h } của phần tử hoặc null; the = { w, h }; kn = { w, h }. */
  function datThe(rect, the, kn, le, khoang) {
    const L = le == null ? 12 : le, G = khoang == null ? 12 : khoang;
    const rongThe = Math.min(the.w, Math.max(kn.w - 2 * L, 120));
    const kep = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    if (!rect) return { x: Math.round((kn.w - rongThe) / 2), y: Math.max(L, Math.round((kn.h - the.h) / 2)), w: rongThe, cho: 'giua' };
    const x = kep(Math.round(rect.x + rect.w / 2 - rongThe / 2), L, Math.max(L, kn.w - rongThe - L));
    const duoi = rect.y + rect.h + G, tren = rect.y - G - the.h;
    if (duoi + the.h + L <= kn.h) return { x, y: duoi, w: rongThe, cho: 'duoi' };
    if (tren >= L) return { x, y: tren, w: rongThe, cho: 'tren' };
    return { x, y: Math.max(L, Math.round((kn.h - the.h) / 2)), w: rongThe, cho: 'giua' };
  }
  /** Ô sáng quanh một phần tử (r có left, top, width, height): nới ra P điểm mỗi phía. */
  function oSang(r, P) {
    const p = P == null ? 6 : P;
    return { x: r.left - p, y: r.top - p, w: r.width + 2 * p, h: r.height + 2 * p };
  }
  /** Phần tử (r có top, bottom) có nằm trọn trong vùng nhìn thấy không? tren, duoi = chỗ bị che ở mép trên và mép dưới (thanh tab). */
  function nhinThay(r, kn, tren, duoi) {
    return r.top >= (tren || 0) && r.bottom <= kn.h - (duoi || 0);
  }
  /** Phần trăm thanh tiến độ ở bước i trong tong bước (bước đầu đã có một đoạn, bước cuối đầy). */
  function tiLe(i, tong) {
    const n = Math.max(1, tong | 0);
    return Math.round((Math.min(Math.max(i | 0, 0), n - 1) + 1) / n * 100);
  }

  const api = { BUOC, lapBuoc, dich, datThe, oSang, nhinThay, tiLe };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  if (!root.document) return;

  /* ============================ PHẦN VẼ ============================ */
  const d = root.document;
  let ov = null, st = null, cho = false;                 // lớp phủ đang mở, trạng thái của nó, đang chờ về Trang chủ

  const giamChuyenDong = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hien = (el) => !!(el && el.offsetWidth > 0 && el.offsetHeight > 0 && root.getComputedStyle(el).visibility !== 'hidden');
  function timMucTieu(step) {
    for (const sel of step.mucTieu) {
      let ds = []; try { ds = Array.from(d.querySelectorAll(sel)); } catch (e) { /* bộ chọn hỏng thì bỏ qua */ }
      const el = ds.find(hien); if (el) return el;
    }
    return null;
  }
  const veTrangChu = () => { const h = root.location.hash || ''; return h === '' || h === '#' || h === '#/' || h === '#/home'; };
  // Thanh tab ở dưới (điện thoại) che mất một phần màn hình: nội dung cuộn tới phải nằm trên nó
  function chieuCaoThanhTab() { const t = d.getElementById('tTabs'); return hien(t) ? t.getBoundingClientRect().height : 0; }

  function dongBo() {
    if (!ov) return;
    const step = st.buoc[st.i], el = timMucTieu(step);
    const the = ov.querySelector('.tt-card'), lo = ov.querySelector('.tt-hole');
    const kn = { w: root.innerWidth, h: root.innerHeight };
    let rect = null;
    if (el) {
      const r = el.getBoundingClientRect();
      rect = oSang(r, 6);
      // bo góc ô sáng theo phần tử được chỉ (nút tròn thì ô sáng cũng tròn)
      const cs = root.getComputedStyle(el).borderTopLeftRadius;
      let bk = parseFloat(cs) || 0; if (/%$/.test(cs)) bk = Math.min(r.width, r.height) * bk / 100;
      const bo = Math.min(Math.max(bk + 6, 10), Math.min(rect.w, rect.h) / 2);
      lo.style.cssText = 'display:block;left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.w + 'px;height:' + rect.h + 'px;border-radius:' + bo + 'px';
      ov.classList.remove('tt-nohole');
    } else {
      // không chỉ vào đâu: ô sáng thu về một điểm giữa màn hình (vẫn tối đều); sang bước sau thì nở ra đúng chỗ, về bước này thì thu lại
      lo.style.cssText = 'display:block;left:' + Math.round(kn.w / 2) + 'px;top:' + Math.round(kn.h / 2) + 'px;width:0;height:0;border-radius:50%';
      ov.classList.add('tt-nohole');
    }
    the.style.width = Math.min(340, kn.w - 24) + 'px';
    const p = datThe(rect, { w: the.offsetWidth, h: the.offsetHeight }, kn);
    the.style.left = p.x + 'px'; the.style.top = p.y + 'px';
  }
  const veLai = () => { if (ov) { root.cancelAnimationFrame(st.raf); st.raf = root.requestAnimationFrame(dongBo); } };

  function capNhatChu() {
    const step = st.buoc[st.i], n = st.buoc.length;
    ov.querySelector('.tt-so').textContent = 'Bước ' + (st.i + 1) + '/' + n;
    ov.querySelector('#ttT').textContent = step.tieuDe;
    ov.querySelector('#ttD').textContent = step.noiDung;
    ov.querySelector('#ttBack').disabled = st.i === 0;
    ov.querySelector('#ttNext').textContent = st.i === n - 1 ? 'Xong' : 'Tiếp';
    ov.querySelector('.tt-bar i').style.width = tiLe(st.i, n) + '%';
    ov.querySelectorAll('.tt-dots i').forEach((x, k) => { x.classList.toggle('on', k === st.i); x.classList.toggle('xong', k < st.i); });
    const b = ov.querySelector('.tt-body');                  // chữ mới hiện dần lên mỗi bước
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }

  /* Đang cuộn mượt tới phần tử: ô sáng và thẻ bám theo từng khung hình (tắt trượt), yên rồi mới thôi */
  function theoDoi() {
    ov.classList.add('tt-theo');
    const han = root.performance.now() + 900; let truoc = null, yen = 0;
    const buoc = () => {
      if (!ov) return;
      dongBo();
      const el = timMucTieu(st.buoc[st.i]), k = el ? Math.round(el.getBoundingClientRect().top) : null;
      yen = k === truoc ? yen + 1 : 0; truoc = k;
      if (yen >= 4 || root.performance.now() > han) { ov.classList.remove('tt-theo'); return; }
      st.rafTheo = root.requestAnimationFrame(buoc);
    };
    root.cancelAnimationFrame(st.rafTheo);
    st.rafTheo = root.requestAnimationFrame(buoc);
  }

  function toi(i) {
    st.i = i;
    capNhatChu();
    const step = st.buoc[i], el = timMucTieu(step);
    if (el && !step.codinh) {
      const kn = { w: root.innerWidth, h: root.innerHeight };
      if (!nhinThay(el.getBoundingClientRect(), kn, 12, chieuCaoThanhTab() + 12)) {
        el.scrollIntoView({ block: 'center', behavior: giamChuyenDong() ? 'auto' : 'smooth' });
        dongBo(); theoDoi();
        ov.querySelector('#ttNext').focus({ preventScroll: true });
        return;
      }
    }
    dongBo();
    ov.querySelector('#ttNext').focus({ preventScroll: true });
  }
  function buocKe(huong) {
    const r = dich(st.i, huong, st.buoc.length);
    if (r.xong) { dong(); return; }
    toi(r.i);
  }
  function onKey(e) {
    if (!ov) return;
    if (e.key === 'Escape') { e.preventDefault(); dong(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); buocKe(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); buocKe(-1); }
    else if (e.key === 'Tab') {                                  // giữ phím Tab trong thẻ hướng dẫn
      const ds = Array.from(ov.querySelectorAll('button:not([disabled])'));
      if (!ds.length) return;
      const i = ds.indexOf(d.activeElement);
      e.preventDefault(); ds[(i + (e.shiftKey ? ds.length - 1 : 1)) % ds.length].focus();
    }
  }
  const chanCuon = (e) => e.preventDefault();                   // không cho trang phía sau cuộn khi đang hướng dẫn

  function dong() {
    if (!ov) return;
    const o = ov, truoc = st.truoc;
    root.cancelAnimationFrame(st.raf); root.cancelAnimationFrame(st.rafTheo);
    root.removeEventListener('resize', veLai); root.removeEventListener('scroll', veLai, true);
    root.removeEventListener('hashchange', dong); d.removeEventListener('keydown', onKey, true);
    ov = null; st = null;
    o.classList.add('tt-dong');
    setTimeout(() => o.remove(), giamChuyenDong() ? 0 : 220);
    if (truoc && truoc.focus && d.contains(truoc)) truoc.focus({ preventScroll: true });
  }

  function chay() {
    cho = false;
    if (ov || !d.body) return;
    const buoc = lapBuoc((ds) => ds.some((sel) => { let l = []; try { l = Array.from(d.querySelectorAll(sel)); } catch (e) { /* bỏ qua */ } return l.some(hien); }));
    if (buoc.length < 2) return;
    st = { buoc, i: 0, raf: 0, rafTheo: 0, truoc: d.activeElement };
    ov = d.createElement('div');
    ov.className = 'tt tt-ngay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'ttT'); ov.setAttribute('aria-describedby', 'ttD');
    ov.innerHTML = '<div class="tt-hole" aria-hidden="true"></div>' +
      '<div class="tt-card"><div class="tt-bar" aria-hidden="true"><i></i></div><div class="tt-in">' +
      '<div class="tt-body" aria-live="polite"><div class="tt-so"></div><h3 id="ttT"></h3><p id="ttD"></p></div>' +
      '<div class="tt-dots" aria-hidden="true">' + buoc.map(() => '<i></i>').join('') + '</div>' +
      '<div class="tt-acts"><button type="button" class="t-btn ghost" id="ttSkip">Bỏ qua</button><span class="tt-sp"></span>' +
      '<button type="button" class="t-btn outline sm" id="ttBack">Quay lại</button><button type="button" class="t-btn sm" id="ttNext">Tiếp</button></div></div></div>';
    d.body.appendChild(ov);
    ov.querySelector('#ttSkip').onclick = dong;
    ov.querySelector('#ttBack').onclick = () => buocKe(-1);
    ov.querySelector('#ttNext').onclick = () => buocKe(1);
    ov.addEventListener('wheel', chanCuon, { passive: false });
    ov.addEventListener('touchmove', chanCuon, { passive: false });
    root.addEventListener('resize', veLai); root.addEventListener('scroll', veLai, true);
    root.addEventListener('hashchange', dong); d.addEventListener('keydown', onKey, true);
    toi(0);
    root.requestAnimationFrame(() => root.requestAnimationFrame(() => { if (ov) ov.classList.remove('tt-ngay'); }));   // khung đầu đặt ngay chỗ, từ bước sau mới trượt
  }

  /** Bắt đầu hướng dẫn. opt.vaoTrangChu: hàm đưa app về Trang chủ (các bước chỉ vào nút của Trang chủ); chạy xong mới hiện hướng dẫn.
      Trả true nếu đã bắt đầu hoặc đang chờ bắt đầu. */
  function start(opt) {
    if (ov || cho) return true;
    if (veTrangChu() || !opt || typeof opt.vaoTrangChu !== 'function') { chay(); return true; }
    cho = true;
    opt.vaoTrangChu();
    const han = Date.now() + 2500;
    const doi = () => {
      if (d.querySelector('.t-hello, .due-card') && veTrangChu()) { setTimeout(chay, 700); return; }   // chờ hiệu ứng chuyển trang xong rồi mới hiện
      if (Date.now() > han) { chay(); return; }
      setTimeout(doi, 60);
    };
    doi();
    return true;
  }

  root.HH = root.HH || {};
  root.HH.tenantTour = Object.assign({}, api, { start, dong });
})(typeof window !== 'undefined' ? window : globalThis);

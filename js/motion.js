/* ============================================================
   Happy Home — Chuyển động dùng chung
   Mỗi chuyển động có lý do: vào trang (cho biết nội dung mới),
   số chạy (nhấn mạnh con số chính), thanh chỉ báo trượt (cho biết
   vừa chuyển từ mục nào sang mục nào). Máy bật "giảm chuyển động"
   thì mọi thứ hiện ngay, không chạy.
   ============================================================ */
HH.fx = (function () {
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---- Vào trang: các khối trồi lên lần lượt; khối nằm dưới màn hình
     chỉ hiện khi cuộn tới (không chạy phí khi chưa ai nhìn thấy) ---- */
  let io = null;
  function enter(root) {
    if (io) { io.disconnect(); io = null; }
    if (!root || reduce()) return;
    const vh = window.innerHeight || 800;
    let i = 0;
    Array.prototype.forEach.call(root.children, (k) => {
      if (k.offsetParent === null && getComputedStyle(k).position !== 'fixed') return;   // đang ẩn
      const top = k.getBoundingClientRect().top;
      if (top < vh) { k.style.setProperty('--i', Math.min(i++, 8)); k.classList.add('fx-in'); }
      else reveal(k);
    });
  }
  function reveal(el) {
    if (!('IntersectionObserver' in window)) return;
    io = io || new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.style.setProperty('--i', 0);
      e.target.classList.remove('fx-wait');
      e.target.classList.add('fx-in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -6% 0px' });
    el.classList.add('fx-wait');
    io.observe(el);
  }

  /* ---- Số chạy từ 0 lên giá trị thật: <b data-count="1250000" data-fmt="money"> ---- */
  function countUp(root, fmts) {
    fmts = fmts || {};
    (root || document).querySelectorAll('[data-count]').forEach((el) => {
      const to = Number(el.dataset.count) || 0;
      const f = fmts[el.dataset.fmt] || ((v) => String(Math.round(v)));
      if (reduce() || !to) { el.textContent = f(to); return; }
      el.textContent = f(0);
      const t0 = performance.now(), dur = 950;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = f(p >= 1 ? to : to * (1 - Math.pow(1 - p, 4)));   // chậm dần về cuối
        if (p < 1 && el.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* ---- Thanh chỉ báo trượt dưới mục đang chọn ----
     Cả khung được vẽ lại mỗi lần chuyển trang, nên nhớ vị trí cũ theo key
     rồi trượt từ đó sang vị trí mới. Chỉ dùng transform (mượt, không giật). */
  const last = {};
  /* data-mode="box"   : nền viên thuốc ôm đúng mục (đổi cả bề rộng)
     data-mode="fixed" : viên cỡ cố định, căn giữa mục (thanh tab điện thoại) */
  function slide(container, key, animate) {
    if (!container) return;
    const ind = container.querySelector('.slide-ind');
    if (!ind) return;
    const act = container.querySelector('.active');
    if (!act || act.offsetParent === null) { ind.style.opacity = '0'; delete last[key]; return; }
    const cr = container.getBoundingClientRect(), ar = act.getBoundingClientRect();
    const fixed = ind.dataset.mode === 'fixed';
    const w = fixed ? ind.offsetWidth : ar.width;
    const x = ar.left - cr.left + container.scrollLeft + (fixed ? (ar.width - w) / 2 : 0);
    const put = (p) => { ind.style.transform = `translateX(${p.x}px)`; if (!fixed) ind.style.width = p.w + 'px'; };
    const prev = last[key];
    last[key] = { x, w };
    ind.style.opacity = '1';
    if (!prev || reduce() || animate === false) { ind.style.transition = 'none'; put(last[key]); return; }
    ind.style.transition = 'none';
    put(prev);
    ind.getBoundingClientRect();                            // vẽ vị trí cũ trước đã
    ind.style.transition = '';
    put(last[key]);
  }
  // Font tải xong hoặc đổi cỡ cửa sổ -> đặt lại chỉ báo cho đúng chỗ (không trượt)
  const slides = {};   // key -> khung đang hiện (mỗi key chỉ giữ khung mới nhất)
  function track(container, key) {
    if (!container) { delete slides[key]; return; }
    slides[key] = container;
    slide(container, key);
  }
  function resync() {
    Object.keys(slides).forEach((k) => {
      if (!slides[k].isConnected) { delete slides[k]; return; }
      slide(slides[k], k, false);
    });
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resync, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resync);

  return { enter, countUp, slide: track, resync, reduce };
})();

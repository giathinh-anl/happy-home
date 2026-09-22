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

  /* ---- Chuyển trang: trang cũ trượt ra, trang mới trượt vào theo hướng đi ----
     dir: 'fwd' (đi tới, trượt sang trái) | 'back' (quay lại) | 'fade' (đăng nhập/đăng xuất).
     Dùng View Transitions của trình duyệt (Chrome, Edge, Safari, Firefox bản mới).
     Trình duyệt chưa hỗ trợ: đổi trang như thường, vẫn có hiệu ứng trồi lên. */
  let vtSeq = 0;
  function transition(update, dir) {
    const root = document.documentElement;
    // Tab đang ẩn thì trình duyệt bỏ qua hiệu ứng -> đổi trang thẳng, khỏi chờ
    if (!document.startViewTransition || reduce() || document.visibilityState !== 'visible') { update(false); return; }
    const tok = ++vtSeq;
    let ran = false;
    const run = (vt) => { if (!ran) { ran = true; update(vt); } };   // chỉ vẽ lại một lần
    root.dataset.vt = dir || 'fade';
    const done = () => { if (tok === vtSeq) delete root.dataset.vt; };
    try {
      const t = document.startViewTransition(() => run(true));
      t.ready.catch(() => {});             // bị bỏ qua cũng không sao
      t.updateCallbackDone.catch(() => {});
      t.finished.then(done, done);
      // Phòng khi trình duyệt bỏ ngang mà chưa gọi hàm cập nhật: vẫn phải đổi trang
      setTimeout(() => { run(false); done(); }, 300);
    } catch (e) { done(); run(false); }
  }

  /* ---- Gợn sóng dưới ngón tay/chuột khi bấm: xác nhận đã bấm trúng ---- */
  const RIPPLE = '.btn, .hd-item, .mb-item, .mtab-i, .sheet-tile, .dh-q, .lz-chip, .view-toggle button,'
    + ' .t-btn, .t-tab, .t-nav, .quick-item, .t-action, .cat-item, .radio-chip';
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || reduce() || !e.target.closest) return;
    const el = e.target.closest(RIPPLE);
    if (!el || el.disabled) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    let wrap = el.querySelector(':scope > .fx-rip');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'fx-rip';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.style.cssText = 'position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none';
      el.appendChild(wrap);
    }
    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('i');
    dot.style.cssText = `position:absolute;border-radius:50%;background:currentColor;opacity:.18;width:${d}px;height:${d}px;`
      + `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;transform:scale(0)`;
    wrap.appendChild(dot);
    const a = dot.animate([{ transform: 'scale(0)', opacity: .2 }, { transform: 'scale(1)', opacity: 0 }],
      { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    a.onfinish = () => dot.remove();
  }, { passive: true });

  /* ---- Vệt sáng đi theo con trỏ trên thẻ (chỉ máy có chuột) ---- */
  const SPOT = '.dh-kpi, .bl-card, .lz-sum, .room-cell, .quick-item, .dh-banner';
  let spotRaf = 0, spotEv = null;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    spotEv = e;
    if (spotRaf) return;
    spotRaf = requestAnimationFrame(() => {
      spotRaf = 0;
      const el = spotEv.target.closest && spotEv.target.closest(SPOT);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (spotEv.clientX - r.left) + 'px');
      el.style.setProperty('--my', (spotEv.clientY - r.top) + 'px');
    });
  }, { passive: true });

  /* ---- Pháo giấy: mừng khi thu đủ tiền / gửi xác nhận thanh toán ---- */
  function confetti(x, y) {
    if (reduce()) return;
    x = x == null ? innerWidth / 2 : x;
    y = y == null ? innerHeight * .35 : y;
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2000;overflow:hidden';
    const colors = ['#FFD970', '#FF8A65', '#3CC6B8', '#84CFFF', '#C4A9FF', '#92E2A5', '#F3C48F'];
    for (let i = 0; i < 34; i++) {
      const p = document.createElement('i');
      const w = 6 + Math.random() * 6;
      p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${w * 1.5}px;margin:${-w}px 0 0 ${-w / 2}px;`
        + `background:${colors[i % colors.length]};border-radius:${i % 3 ? 2 : 50}%`;
      box.appendChild(p);
      const ang = -Math.PI / 2 + (Math.random() - .5) * Math.PI * 1.2;
      const v = 140 + Math.random() * 200;
      const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
      p.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .5 },
        { transform: `translate(${dx * 1.25}px,${dy + 260}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ], { duration: 1200 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.35,1)', fill: 'forwards' });
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2000);
  }

  /* ---- Rời đi mềm: gỡ phần tử ngay (để mã khác không còn thấy nó) nhưng để lại
     một bản sao trơ mờ dần trong 0,2 giây ---- */
  function leave(el, cls) {
    if (!el || !el.parentNode) return;
    if (reduce()) { el.remove(); return; }
    const ghost = el.cloneNode(true);
    ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    ghost.removeAttribute('id');
    const src = el.querySelectorAll('input, textarea, select'), dst = ghost.querySelectorAll('input, textarea, select');
    src.forEach((n, i) => { if (dst[i]) dst[i].value = n.value; });
    ghost.style.pointerEvents = 'none';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add(cls || 'fx-leave');
    el.parentNode.insertBefore(ghost, el);
    el.remove();
    setTimeout(() => ghost.remove(), 220);
  }

  return { enter, countUp, slide: track, resync, reduce, transition, confetti, leave };
})();

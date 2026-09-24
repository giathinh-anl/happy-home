/* ============================================================
   Băng-rôn giới thiệu ở màn đăng nhập (trang quản trị + app khách thuê)

   Dùng chung cho cả hai app:
       el.innerHTML = HH.promo.html(HH.promo.OWNER);
       HH.promo.mount(el);

   Tự chạy từng tấm một, vuốt qua lại được, dừng khi rê chuột vào hoặc khi
   người dùng chuyển sang tab khác. Máy nào bật "giảm chuyển động" thì đứng yên.
   ============================================================ */
(function (root) {
  const DUR = 5200;                       // mỗi tấm dừng bao lâu (ms)
  const SWIPE = 45;                       // vuốt bao nhiêu px thì đổi tấm

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* Nội dung băng-rôn — sửa chữ ở đây là đổi được cả hai app */
  const OWNER = [
    { tone: 'sun',   pic: 'receipt',   tag: 'Hóa đơn',      title: 'Chốt điện một lần,<br>hóa đơn cả dãy tự ra', sub: 'Nhập chỉ số xong là tiền phòng, điện, dịch vụ tự cộng đúng từng phòng.' },
    { tone: 'sky',   pic: 'card',      tag: 'Thu tiền',     title: 'Tiền về là<br>tự gạch nợ', sub: 'Ngân hàng báo có, hệ thống khớp đúng hóa đơn và nhắn cho khách.' },
    { tone: 'coral', pic: 'megaphone', tag: 'Cho thuê',     title: 'Đăng tin lên Facebook<br>chỉ một chạm', sub: 'Phòng trống, giá, tiện nghi và ảnh được gom sẵn thành bài đăng.' },
    { tone: 'grape', pic: 'contract',  tag: 'Hợp đồng',     title: 'Quét hợp đồng giấy,<br>máy điền hộ', sub: 'Chụp tờ hợp đồng đã ký, thông tin và chữ ký được đọc rồi điền sẵn.' },
    { tone: 'leaf',  pic: 'chat',      tag: 'Trợ lý ảo',    title: 'Hỏi tiếng Việt,<br>trả lời bằng số thật', sub: '"Tháng này thu bao nhiêu?" — trợ lý đọc thẳng dữ liệu của bạn.' },
  ];

  const TENANT = [
    { tone: 'sun',   pic: 'receipt', tag: 'Hóa đơn',  title: 'Hóa đơn rõ từng khoản', sub: 'Tiền phòng, điện, dịch vụ tách riêng, xem lại được mọi tháng.' },
    { tone: 'sky',   pic: 'card',    tag: 'Thanh toán', title: 'Quét mã là xong', sub: 'Chuyển khoản đúng nội dung, trả hết hay trả một phần đều ghi nhận ngay.' },
    { tone: 'leaf',  pic: 'camera',  tag: 'Chỉ số điện', title: 'Chụp đồng hồ,<br>gửi thẳng cho chủ nhà', sub: 'Không cần nhắn tin, ảnh và số điện được gửi đi cùng lúc.' },
    { tone: 'coral', pic: 'wrench',  tag: 'Báo hỏng', title: 'Hỏng gì báo nấy,<br>theo dõi tới khi xong', sub: 'Gửi kèm ảnh, biết yêu cầu đang ở bước nào.' },
  ];

  function html(slides, opt) {
    opt = opt || {};
    const size = opt.compact ? 74 : 96;
    const cards = slides.map((s, i) => `
      <article class="promo-slide${i === 0 ? ' is-on' : ''}" data-tone="${esc(s.tone || 'sun')}">
        <span class="promo-blob b1" aria-hidden="true"></span>
        <span class="promo-blob b2" aria-hidden="true"></span>
        <div class="promo-txt">
          ${s.tag ? `<span class="promo-tag">${esc(s.tag)}</span>` : ''}
          <h3>${s.title}</h3>
          <p>${esc(s.sub)}</p>
        </div>
        <span class="promo-pic" aria-hidden="true">${root.HH.pic(s.pic || 'house', size)}</span>
        <span class="promo-shine" aria-hidden="true"></span>
      </article>`).join('');
    const dots = slides.map((s, i) =>
      `<button type="button" class="promo-dot${i === 0 ? ' is-on' : ''}" data-i="${i}" aria-label="Xem tin ${i + 1}"><i></i></button>`).join('');
    return `<div class="promo${opt.compact ? ' compact' : ''}" data-promo style="--promo-dur:${DUR}ms"
              role="region" aria-label="Giới thiệu Happy Home">
      <div class="promo-view"><div class="promo-track">${cards}</div></div>
      <div class="promo-dots">${dots}</div>
    </div>`;
  }

  function mount(scope) {
    const rail = (scope || document).querySelector('[data-promo]');
    if (!rail || rail.dataset.promoOn) return;     // gắn một lần cho mỗi băng-rôn
    rail.dataset.promoOn = '1';
    const view = rail.querySelector('.promo-view');
    const track = rail.querySelector('.promo-track');
    const slides = [].slice.call(rail.querySelectorAll('.promo-slide'));
    const dots = [].slice.call(rail.querySelectorAll('.promo-dot'));
    if (slides.length < 2) return;

    const fx = root.HH && root.HH.fx;
    const soft = !(fx && fx.reduce && fx.reduce());   // có được phép chuyển động không
    let at = 0, timer = null, hold = false, drag = null;

    function go(next, animate) {
      at = (next % slides.length + slides.length) % slides.length;
      track.style.transition = (animate && soft) ? '' : 'none';
      track.style.transform = 'translate3d(' + (-at * 100) + '%,0,0)';
      slides.forEach((s, k) => s.classList.toggle('is-on', k === at));
      dots.forEach((d, k) => d.classList.toggle('is-on', k === at));
      plan();
    }

    function plan() {
      clearTimeout(timer);
      if (!soft || hold) return;
      timer = setTimeout(() => {
        if (!rail.isConnected) return stop();       // trang đã bị thay -> thôi
        if (document.visibilityState !== 'visible') return plan();
        go(at + 1, true);
      }, DUR);
    }

    function stop() { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); }
    function onVis() { if (!rail.isConnected) return stop(); if (document.visibilityState === 'visible') plan(); }
    document.addEventListener('visibilitychange', onVis);

    dots.forEach((d, k) => d.onclick = () => go(k, true));

    // Dừng khi rê chuột hoặc đang chạm vào băng-rôn
    rail.addEventListener('pointerenter', () => { hold = true; rail.classList.add('is-hold'); clearTimeout(timer); });
    rail.addEventListener('pointerleave', () => { hold = false; rail.classList.remove('is-hold'); plan(); });

    // Vuốt qua lại
    view.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, dx: 0 };
      hold = true; clearTimeout(timer);
      track.style.transition = 'none';
      try { view.setPointerCapture(e.pointerId); } catch (err) {}
    });
    view.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.dx = e.clientX - drag.x;
      track.style.transform = 'translate3d(calc(' + (-at * 100) + '% + ' + drag.dx + 'px),0,0)';
    });
    const release = () => {
      if (!drag) return;
      const dx = drag.dx; drag = null; hold = false;
      go(Math.abs(dx) > SWIPE ? at + (dx < 0 ? 1 : -1) : at, true);
    };
    view.addEventListener('pointerup', release);
    view.addEventListener('pointercancel', release);

    go(0, false);
  }

  root.HH = root.HH || {};
  root.HH.promo = { html, mount, OWNER, TENANT };
})(typeof window !== 'undefined' ? window : globalThis);

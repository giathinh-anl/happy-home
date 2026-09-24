/* ============================================================
   Phần "trang ngoài" của màn đăng nhập: thanh chạy, băng-rôn, hình khối
   bay lơ lửng và thẻ hoạt động nhảy lên góc trái.

   Dùng chung cho trang quản trị và app khách thuê:
       el.innerHTML = HH.promo.ticker() + HH.promo.sky()
                    + HH.promo.html(HH.promo.OWNER);
       HH.promo.mount(el);          // băng-rôn
       HH.promo.feed(el);           // thẻ hoạt động (chỉ màn hình rộng)
   ============================================================ */
(function (root) {
  const DUR = 5200;                       // mỗi tấm băng-rôn dừng bao lâu (ms)
  const SWIPE = 45;                       // vuốt bao nhiêu px thì đổi tấm
  const FEED_EVERY = 4200;                // bao lâu thì nhảy một thẻ hoạt động
  const FEED_STAY = 5200;                 // thẻ nằm lại bao lâu rồi biến mất

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  /* ---------- nội dung: sửa chữ ở đây là đổi được cả hai app ---------- */
  const OWNER = [
    { tone: 'teal',  pic: 'receipt',   tag: 'Hóa đơn',    title: 'Chốt điện một lần,<br>hóa đơn cả dãy tự ra', sub: 'Nhập chỉ số xong là tiền phòng, điện, dịch vụ tự cộng đúng từng phòng.' },
    { tone: 'sky',   pic: 'card',      tag: 'Thu tiền',   title: 'Tiền về là<br>tự gạch nợ', sub: 'Ngân hàng báo có, hệ thống khớp đúng hóa đơn rồi báo cho khách.' },
    { tone: 'coral', pic: 'megaphone', tag: 'Cho thuê',   title: 'Đăng tin lên Facebook<br>chỉ một chạm', sub: 'Phòng trống, giá, tiện nghi và ảnh được gom sẵn thành bài đăng.' },
    { tone: 'grape', pic: 'contract',  tag: 'Hợp đồng',   title: 'Quét hợp đồng giấy,<br>máy điền hộ', sub: 'Chụp tờ hợp đồng đã ký, thông tin và chữ ký được đọc rồi điền sẵn.' },
    { tone: 'sun',   pic: 'chat',      tag: 'Trợ lý ảo',  title: 'Hỏi tiếng Việt,<br>trả lời bằng số thật', sub: '“Tháng này thu bao nhiêu?” — trợ lý đọc thẳng dữ liệu của bạn.' },
  ];

  const TENANT = [
    { tone: 'teal',  pic: 'receipt', tag: 'Hóa đơn',     title: 'Hóa đơn rõ<br>từng khoản', sub: 'Tiền phòng, điện, dịch vụ tách riêng, xem lại được mọi tháng.' },
    { tone: 'sky',   pic: 'card',    tag: 'Thanh toán',  title: 'Quét mã<br>là xong', sub: 'Chuyển khoản đúng nội dung, trả hết hay một phần đều ghi nhận ngay.' },
    { tone: 'leaf',  pic: 'camera',  tag: 'Chỉ số điện', title: 'Chụp đồng hồ,<br>gửi thẳng chủ nhà', sub: 'Không cần nhắn tin, ảnh và số điện được gửi đi cùng lúc.' },
    { tone: 'coral', pic: 'wrench',  tag: 'Báo hỏng',    title: 'Hỏng gì báo nấy,<br>theo tới khi xong', sub: 'Gửi kèm ảnh, biết yêu cầu đang ở bước nào.' },
  ];

  // Thẻ hoạt động — là VÍ DỤ minh họa phần mềm làm được gì, không phải
  // người dùng thật, nên mỗi thẻ đều có nhãn "ví dụ".
  const FEED = [
    { tone: 'teal',  pic: 'receipt',  t: 'Đã lập hóa đơn tháng 8', s: '24 phòng · Happy Home Quận 7' },
    { tone: 'sky',   pic: 'card',     t: 'Tiền về, tự gạch nợ', s: '3.500.000 đ · phòng P305' },
    { tone: 'coral', pic: 'wrench',   t: 'Khách báo hỏng vòi nước', s: 'P204 · đã tạo yêu cầu sửa' },
    { tone: 'leaf',  pic: 'camera',   t: 'Khách gửi ảnh chỉ số điện', s: 'P101 · 120 kWh tháng này' },
    { tone: 'grape', pic: 'contract', t: 'Quét xong hợp đồng giấy', s: 'Điền sẵn 12 ô, có cả chữ ký' },
    { tone: 'sun',   pic: 'megaphone', t: 'Đã đăng tin phòng trống', s: 'P405 · 3.200.000 đ/tháng' },
  ];

  const TICKER = [
    '🏠 Happy Home — quản lý nhà cho thuê nhẹ tênh mỗi ngày',
    '🧾 Hóa đơn tự tính tiền phòng, điện và dịch vụ',
    '💸 Ngân hàng báo có là tự gạch nợ, khỏi dò tay',
    '📱 Khách thuê có app riêng: xem hóa đơn, gửi chỉ số, báo hỏng',
    '🤖 Trợ lý ảo trả lời bằng số liệu thật của nhà bạn',
  ];

  /* ---------- thanh chữ chạy trên cùng ---------- */
  function ticker(items) {
    const list = items || TICKER;
    const run = list.map(t => `<span>${esc(t)}</span>`).join('');
    return `<div class="hh-ticker" aria-hidden="true"><div class="hh-ticker-run">${run}${run}</div></div>`;
  }

  /* ---------- hình khối màu bay lơ lửng phía sau ---------- */
  const SKY = [
    { k: 'ring', t: 'grape', x: 4,  y: 24, s: 46, d: 0,   u: 13 },
    { k: 'dot',  t: 'coral', x: 10, y: 13, s: 14, d: 1.2, u: 10 },
    { k: 'tri',  t: 'sun',   x: 18, y: 7,  s: 18, d: .6,  u: 12 },
    { k: 'sq',   t: 'sky',   x: 27, y: 4,  s: 13, d: 2,   u: 11 },
    { k: 'dot',  t: 'leaf',  x: 47, y: 9,  s: 10, d: 1.6, u: 14 },
    { k: 'ring', t: 'sky',   x: 90, y: 30, s: 38, d: .4,  u: 12 },
    { k: 'tri',  t: 'coral', x: 76, y: 15, s: 16, d: 2.4, u: 13 },
    { k: 'dot',  t: 'sun',   x: 86, y: 62, s: 13, d: 1,   u: 11 },
    { k: 'sq',   t: 'grape', x: 68, y: 72, s: 14, d: 2.8, u: 15 },
    { k: 'ring', t: 'leaf',  x: 79, y: 87, s: 30, d: 1.8, u: 12 },
    { k: 'dot',  t: 'sky',   x: 33, y: 80, s: 11, d: 2.2, u: 13 },
    { k: 'tri',  t: 'grape', x: 12, y: 68, s: 15, d: 3,   u: 14 },
  ];

  function sky() {
    return `<div class="hh-sky" aria-hidden="true">${SKY.map(p =>
      `<span class="sh ${p.k}" data-tone="${p.t}" style="left:${p.x}%;top:${p.y}%;--s:${p.s}px;--d:${p.d}s;--u:${p.u}s"></span>`
    ).join('')}</div>`;
  }

  /* ---------- băng-rôn ---------- */
  function slideShapes() {
    return `<span class="ps-sh a"></span><span class="ps-sh b"></span><span class="ps-sh c"></span>`;
  }

  function html(slides, opt) {
    opt = opt || {};
    const size = opt.compact ? 52 : 64;
    const cards = slides.map((s, i) => `
      <article class="promo-slide${i === 0 ? ' is-on' : ''}" data-tone="${esc(s.tone || 'teal')}">
        <span class="promo-blob b1" aria-hidden="true"></span>
        <span class="promo-blob b2" aria-hidden="true"></span>
        ${slideShapes()}
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

    const soft = !reduced();
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

  /* ---------- thẻ hoạt động nhảy lên góc trái ---------- */
  function feed(scope, items) {
    const host = (scope || document).querySelector('[data-promo-feed]');
    if (!host || host.dataset.feedOn) return;
    host.dataset.feedOn = '1';
    if (reduced() || !matchMedia('(min-width: 1100px) and (min-height: 820px)').matches) return;

    const list = items || FEED;
    let i = 0, timer = null;

    function pop() {
      if (!host.isConnected) { clearTimeout(timer); return; }
      if (document.visibilityState !== 'visible') { timer = setTimeout(pop, FEED_EVERY); return; }
      const it = list[i % list.length]; i++;
      const card = document.createElement('div');
      card.className = 'hh-feed-card';
      card.dataset.tone = it.tone || 'teal';
      card.innerHTML = `<span class="fd-ic">${root.HH.pic(it.pic || 'house', 30)}</span>
        <div class="fd-tx"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>
        <span class="fd-tag">ví dụ</span>`;
      host.appendChild(card);
      while (host.children.length > 2) host.removeChild(host.firstElementChild);
      setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 500); }, FEED_STAY);
      timer = setTimeout(pop, FEED_EVERY);
    }
    timer = setTimeout(pop, 1400);
  }

  function reduced() {
    const fx = root.HH && root.HH.fx;
    return !!(fx && fx.reduce && fx.reduce());
  }

  root.HH = root.HH || {};
  root.HH.promo = { html, mount, ticker, sky, feed, OWNER, TENANT, FEED, TICKER };
})(typeof window !== 'undefined' ? window : globalThis);

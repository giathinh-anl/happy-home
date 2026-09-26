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

  /* ============================================================
     HỒ SƠ NHÀ TRỌ — sửa ở đây là đổi được cả banner lẫn thanh chạy.
     Số liệu lấy đúng theo dữ liệu đang có trong hệ thống.
     KHÔNG đưa doanh thu, công nợ hay bất kỳ số tiền nào vào banner:
     đó là thông tin riêng của chủ trọ, không phải thứ để quảng cáo.
     ============================================================ */
  const HOME = {
    name: 'Happy Home',
    blocks: 3,                      // số tòa nhà
    rooms: 57,                      // 24 + 18 + 15 phòng
    kinds: 3,                       // phòng đơn, phòng đôi, phòng cao cấp
    hotline: '',                    // ĐIỀN SỐ THẬT CỦA NHÀ TRỌ, để trống thì hiện "đang cập nhật"
    hours: '8:00 – 20:00 mỗi ngày',
    sites: [
      { name: 'Happy Home Quận 7', addr: '123 Nguyễn Thị Thập, Quận 7, TP.HCM', rooms: 24 },
      { name: 'Happy Home Gò Vấp', addr: '45 Quang Trung, Gò Vấp, TP.HCM', rooms: 18 },
      { name: 'Happy Home Bình Thạnh', addr: '78 Điện Biên Phủ, Bình Thạnh, TP.HCM', rooms: 15 },
    ],
    amenities: [
      { pic: 'sofa',    t: 'Nội thất có sẵn' },
      { pic: 'bolt',    t: 'Điện theo chỉ số' },
      { pic: 'drop',    t: 'Nước sạch' },
      { pic: 'lock',    t: 'An ninh, khóa riêng' },
      { pic: 'wrench',  t: 'Báo hỏng có thợ' },
      { pic: 'receipt', t: 'Hóa đơn rõ khoản' },
    ],
  };
  const hotline = () => HOME.hotline || 'đang cập nhật';

  const OWNER = [
    { tone: 'teal', tag: 'Về chúng tôi', title: 'Happy Home —<br>chỗ ở tử tế, tiền bạc rõ ràng',
      sub: 'Chuỗi nhà trọ cho thuê tại TP.HCM, nhận khách là sinh viên và người đi làm. Mọi khoản thu chi đều chạy trên phần mềm riêng nên khách xem lại được bất cứ lúc nào.' },
    { tone: 'sky', tag: 'Quy mô', title: HOME.blocks + ' tòa nhà,<br>' + HOME.rooms + ' phòng cho thuê',
      sub: 'Quận 7, Gò Vấp và Bình Thạnh. Ba loại phòng: phòng đơn 18 m², phòng đôi 22 m², phòng cao cấp 26 m² — ở được từ 2 đến 3 người.' },
    { tone: 'leaf', tag: 'Tiện ích', title: 'Dọn vào là ở được,<br>không phải sắm gì thêm',
      sub: 'Phòng có sẵn máy lạnh, tủ lạnh, giường và tủ quần áo. Tòa nhà có internet, nước sạch, thu gom rác mỗi ngày, khóa riêng từng phòng.' },
    { tone: 'sun', tag: 'Điểm lợi khi thuê', title: 'Hợp đồng rõ ràng,<br>không phí ẩn',
      sub: 'Điện tính theo chỉ số thực tế chứ không khoán, hóa đơn tách riêng từng khoản. Khách có app riêng để xem hóa đơn, gửi chỉ số và báo hỏng.' },
    { tone: 'grape', tag: 'Quy trình thuê', title: 'Bốn bước<br>là có phòng',
      sub: 'Xem phòng → ký hợp đồng và đặt cọc → nhận phòng, bàn giao tài sản có biên bản → mỗi tháng nhận hóa đơn trên app rồi thanh toán.' },
    { tone: 'coral', tag: 'Liên hệ', title: 'Ghé xem phòng<br>bất cứ lúc nào',
      sub: HOME.sites.map(s => s.addr.replace(', TP.HCM', '')).join(' · ') + '. Hotline ' + hotline() + ', ' + HOME.hours + '.' },
  ];

  const TENANT = [
    { tone: 'teal',  pic: 'receipt', tag: 'Hóa đơn',     title: 'Hóa đơn rõ<br>từng khoản', sub: 'Tiền phòng, điện, dịch vụ tách riêng, xem lại được mọi tháng.' },
    { tone: 'sky',   pic: 'card',    tag: 'Thanh toán',  title: 'Quét mã<br>là xong', sub: 'Chuyển khoản đúng nội dung, trả hết hay một phần đều ghi nhận ngay.' },
    { tone: 'leaf',  pic: 'camera',  tag: 'Chỉ số điện', title: 'Chụp đồng hồ,<br>gửi thẳng chủ nhà', sub: 'Không cần nhắn tin, ảnh và số điện được gửi đi cùng lúc.' },
    { tone: 'coral', pic: 'wrench',  tag: 'Báo hỏng',    title: 'Hỏng gì báo nấy,<br>theo tới khi xong', sub: 'Gửi kèm ảnh, biết yêu cầu đang ở bước nào.' },
  ];

  // Thẻ tin nhanh — là VÍ DỤ minh họa cách nhà trọ vận hành, không phải
  // sự việc có thật, nên mỗi thẻ đều có nhãn "ví dụ". Không có số tiền.
  const FEED = [
    { tone: 'teal',  pic: 'door',     t: 'Phòng P405 còn trống', s: 'Phòng đơn 18 m² · tầng 4' },
    { tone: 'coral', pic: 'wrench',   t: 'Báo hỏng xử lý trong ngày', s: 'P204 · thợ tới lúc 15:30' },
    { tone: 'sky',   pic: 'users',    t: 'Khách mới nhận phòng', s: 'P112 · bàn giao đủ tài sản' },
    { tone: 'grape', pic: 'contract', t: 'Ký hợp đồng tại chỗ', s: 'Có bản giấy lưu cho hai bên' },
    { tone: 'leaf',  pic: 'drop',     t: 'Nước sạch, thu gom rác mỗi ngày', s: 'Áp dụng cho cả 3 tòa nhà' },
    { tone: 'sun',   pic: 'phone',    t: 'Hẹn xem phòng qua hotline', s: HOME.hours },
  ];

  const TICKER = [
    '🏠 Nhà trọ Happy Home — ' + HOME.blocks + ' tòa nhà tại Quận 7, Gò Vấp, Bình Thạnh',
    '🛏️ Phòng có sẵn máy lạnh, tủ lạnh, giường và tủ quần áo',
    '🧾 Điện tính theo chỉ số thực tế, hóa đơn tách riêng từng khoản',
    '🔧 Báo hỏng có thợ tới tận phòng, theo dõi tới khi xong',
    '📱 Khách thuê có app riêng: xem hóa đơn, gửi chỉ số, báo hỏng',
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
    if (reduced()) return;

    const list = items || FEED;
    let i = 0, timer = null;

    function pop() {
      if (!host.isConnected) { clearTimeout(timer); return; }
      if (document.visibilityState !== 'visible') { timer = setTimeout(pop, FEED_EVERY); return; }
      const it = list[i % list.length]; i++;
      const card = document.createElement('div');
      card.className = 'hh-feed-card';
      card.dataset.tone = it.tone || 'teal';
      card.innerHTML = `<span class="fd-ic">${root.HH.pic(it.pic || 'house', 26)}</span>
        <div class="fd-tx"><b>${esc(it.t)}</b><span>${esc(it.s)}</span></div>
        <span class="fd-tag">ví dụ</span>`;
      host.appendChild(card);
      while (host.children.length > 1) host.removeChild(host.firstElementChild);
      setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 500); }, FEED_STAY);
      timer = setTimeout(pop, FEED_EVERY);
    }
    timer = setTimeout(pop, 1400);
  }

  /* ============================================================
     BĂNG-RÔN LỚN (trang quản trị): chữ đổi luân phiên bên trái,
     ảnh dựng màn hình phần mềm trong khung trình duyệt + khung điện
     thoại bên phải, nghiêng nhẹ và nhúc nhích theo con trỏ.
     ============================================================ */

  const TICKS = ['Sinh viên & người đi làm', 'Ở ngay, khỏi sắm đồ', 'Điện tính đúng chỉ số'];

  // Hồ sơ nhà trọ dựng bằng HTML/CSS (không phải ảnh chụp), nét ở mọi cỡ
  function profileCard() {
    const sites = HOME.sites.map(s =>
      `<li><b>${esc(s.name.replace(HOME.name + ' ', ''))}</b><span>${esc(s.addr.replace(', TP.HCM', ''))}</span><em>${s.rooms} phòng</em></li>`).join('');
    const amen = HOME.amenities.map(a =>
      `<span class="pf-am">${root.HH.pic(a.pic, 22)}${esc(a.t)}</span>`).join('');
    return `<div class="pf-card">
      <div class="pf-photo">${root.HH.scene({ align: 'xMidYMax' })}
        <span class="pf-tag">Hồ sơ nhà trọ</span>
      </div>
      <div class="pf-body">
        <div class="pf-facts">
          <div><b>${HOME.blocks}</b><span>tòa nhà</span></div>
          <div><b>${HOME.rooms}</b><span>phòng</span></div>
          <div><b>${HOME.kinds}</b><span>loại phòng</span></div>
        </div>
        <ul class="pf-sites">${sites}</ul>
        <div class="pf-amens">${amen}</div>
      </div>
    </div>`;
  }

  // Khung điện thoại: thẻ phòng trống, không có số tiền nào
  function roomPhone() {
    return `<div class="mk-phone">
      <span class="mk-notch"></span>
      <div class="mk-ph-head"><span class="mk-dot"></span>happy home</div>
      <div class="mk-ph-room">
        <span>Còn trống</span><b>Phòng P405</b><i>Phòng đơn · 18 m² · 2 người</i>
      </div>
      <div class="mk-ph-tiles"><span></span><span></span><span></span></div>
      <div class="mk-ph-line"></div>
      <div class="mk-ph-line short"></div>
    </div>`;
  }

  function hero(items) {
    const list = items || OWNER;
    const rot = list.map((s, i) => `
      <article class="ad-item${i === 0 ? ' is-on' : ''}" data-tone="${esc(s.tone || 'teal')}">
        <span class="ad-chip">${esc(s.tag || '')}</span>
        <h2>${s.title}</h2>
        <p>${esc(s.sub)}</p>
      </article>`).join('');
    const dots = list.map((s, i) =>
      `<button type="button" class="ad-dot${i === 0 ? ' is-on' : ''}" data-i="${i}" aria-label="Xem tin ${i + 1}"><i></i></button>`).join('');
    const ticks = TICKS.map(t => `<li>${esc(t)}</li>`).join('');
    return `<section class="hero-ad" data-promo-ad style="--ad-dur:${DUR}ms"
              role="region" aria-label="Giới thiệu phần mềm Happy Home">
      <span class="ad-grid" aria-hidden="true"></span>
      <span class="ad-glow" aria-hidden="true"></span>
      <div class="ad-left">
        <span class="ad-eyebrow">Nhà trọ ${esc(HOME.name)} · TP.HCM</span>
        <div class="ad-rot">${rot}</div>
        <ul class="ad-ticks">${ticks}</ul>
        <div class="ad-dots">${dots}</div>
      </div>
      <div class="ad-right" aria-hidden="true">
        <div class="ad-stage">${profileCard()}${roomPhone()}
          <div class="ad-feed" data-promo-feed></div>
        </div>
      </div>
    </section>`;
  }

  function mountHero(scope) {
    const ad = (scope || document).querySelector('[data-promo-ad]');
    if (!ad || ad.dataset.adOn) return;
    ad.dataset.adOn = '1';
    const items = [].slice.call(ad.querySelectorAll('.ad-item'));
    const dots = [].slice.call(ad.querySelectorAll('.ad-dot'));
    const stage = ad.querySelector('.ad-stage');
    const soft = !reduced();
    let at = 0, timer = null, hold = false;

    function go(next) {
      at = (next % items.length + items.length) % items.length;
      items.forEach((s, k) => s.classList.toggle('is-on', k === at));
      dots.forEach((d, k) => d.classList.toggle('is-on', k === at));
      ad.dataset.tone = items[at].dataset.tone || 'teal';
      plan();
    }
    function plan() {
      clearTimeout(timer);
      if (!soft || hold || items.length < 2) return;
      timer = setTimeout(() => {
        if (!ad.isConnected) return stop();
        if (document.visibilityState !== 'visible') return plan();
        go(at + 1);
      }, DUR);
    }
    function stop() { clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); }
    function onVis() { if (!ad.isConnected) return stop(); if (document.visibilityState === 'visible') plan(); }
    document.addEventListener('visibilitychange', onVis);

    dots.forEach((d, k) => d.onclick = () => go(k));
    ad.addEventListener('pointerenter', () => { hold = true; ad.classList.add('is-hold'); clearTimeout(timer); });
    ad.addEventListener('pointerleave', () => {
      hold = false; ad.classList.remove('is-hold'); plan();
      if (stage) stage.style.removeProperty('--mx'), stage.style.removeProperty('--my');
    });

    // Ảnh dựng nhúc nhích nhẹ theo con trỏ cho có chiều sâu
    if (stage && soft) {
      ad.addEventListener('pointermove', (e) => {
        const r = ad.getBoundingClientRect();
        stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
        stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3));
      });
    }
    go(0);
  }

  function reduced() {
    const fx = root.HH && root.HH.fx;
    return !!(fx && fx.reduce && fx.reduce());
  }

  root.HH = root.HH || {};
  root.HH.promo = { html, mount, hero, mountHero, ticker, sky, feed, OWNER, TENANT, FEED, TICKER };
})(typeof window !== 'undefined' ? window : globalThis);

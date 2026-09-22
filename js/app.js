/* ============================================================
   Happy Home / LOZIDO-style — Khung ứng dụng + điều hướng + boot
   ============================================================ */
HH.app = (function () {
  const U = HH.util, S = HH.store, h = U.html, raw = U.raw;

  const ic = (n, s) => HH.icon(n, { size: s || 18 });
  const pic = (n, s) => String(HH.pic(n, s || 28));   // icon tượng hình nhiều màu

  // Mục cấp công ty (thanh trên). owner=true -> chỉ chủ trọ.
  const TOP_TILES = [
    { key: 'home',   ic: 'building', label: 'Quản lý nhà',        path: '/buildings' },
    { key: 'report', ic: 'chart',    label: 'Tổng báo cáo',       path: '/dashboard' },
    { key: 'bank',   ic: 'card',     label: 'Khách chuyển khoản', path: '/transfers' },
    { key: 'post',   ic: 'megaphone',label: 'Đăng tin',           path: '/post' },
    { key: 'group',  ic: 'users',    label: 'Công ty/nhóm',       path: '/group', owner: true },
    { key: 'config', ic: 'settings', label: 'Cài đặt',            path: '/config' },
  ];

  // Mục cấp tòa nhà. pic = hình tượng hình riêng khi trùng icon nét với mục khác.
  const MODULES = [
    { ic: 'door',      label: 'Phòng',      seg: 'units', perm: 'rooms' },
    { ic: 'receipt',   label: 'Hóa đơn',    seg: 'invoices', perm: 'invoices' },
    { ic: 'concierge', label: 'Dịch vụ',    seg: 'services', perm: 'services' },
    { ic: 'file',      label: 'Hợp đồng',   seg: 'contracts', perm: 'contracts' },
    { ic: 'box',       label: 'Tài sản',    seg: 'assets', perm: 'assets' },
    { ic: 'users',     label: 'Khách thuê', seg: 'tenants', perm: 'tenants' },
  ];
  const MORE = [
    { ic: 'gauge',    label: 'Chỉ số điện',          seg: 'readings', perm: 'readings' },
    { ic: 'wallet',   label: 'Thanh toán & công nợ', seg: 'payments', perm: 'payments' },
    { ic: 'wrench',   label: 'Sự cố phòng',          seg: 'incidents', perm: 'incidents' },
    { ic: 'chart',    label: 'Thu chi',              seg: 'expenses', perm: 'expenses', pic: 'coins' },
    { ic: 'lock',     label: 'Khóa thông minh',      seg: 'locks', perm: 'rooms' },
    { ic: 'settings', label: 'Cấu hình tòa nhà',     seg: 'config', perm: 'settings', pic: 'sliders' },
  ];
  const can = (m) => !m.perm || S.can(m.perm);
  const picOf = (m, s) => pic(m.pic || m.ic, s);

  /* ============================================================
     KHUNG
     Máy tính: thanh trên (cấp công ty) + hàng mục tòa nhà — như bố cục cũ.
     Điện thoại: thanh trên gọn + thanh tab dưới đáy + bảng Menu.
     Cả hai cùng nằm trong trang, CSS chọn cái nào hiện theo bề rộng màn hình.
     ============================================================ */
  let lastBid = null;   // tòa đang làm việc, giữ lại khi sang trang cấp công ty

  const cntBadge = (n, cls) => n ? `<span class="${cls}">${n > 99 ? '99+' : n}</span>` : '';

  function counts(bid) {
    const b = S.building(bid);
    return {
      overdue: b ? S.invoicesOf(b.id).filter(i => i.status === 'overdue').length : 0,
      incidents: b ? S.incidentsOf(b.id).length : 0,
      claims: S.pendingClaimCount ? S.pendingClaimCount() : 0,
      noti: S.notificationCount ? S.notificationCount() : 0,
    };
  }
  const modCount = (m, c) => m.seg === 'invoices' ? c.overdue : m.seg === 'incidents' ? c.incidents : 0;
  const isCompanyActive = (t, path) => t.key === 'home' ? (path === '/buildings' || path.startsWith('/b/')) : path === t.path;

  /* ---------- Máy tính: thanh trên ---------- */
  function header(path, c) {
    const nav = TOP_TILES.filter(t => !t.owner || S.isOwner()).map(t => {
      const active = isCompanyActive(t, path);
      const n = t.key === 'bank' ? cntBadge(c.claims, 'hd-cnt') : '';
      return `<a class="hd-item ${active ? 'active' : ''}" href="#${t.path}" ${active ? 'aria-current="page"' : ''}>
        <span class="hd-pic pic-hop">${pic(t.ic, 30)}${n}</span><span>${t.label}</span></a>`;
    }).join('');
    const name = (S.prefs && S.prefs.userName) || '';
    return `<header class="hd"><div class="hd-in">
      <a class="hd-logo" href="#/buildings" aria-label="Happy Home, về trang quản lý nhà">
        <span class="mark"><img src="assets/logo-mark.svg" alt="" width="34" height="29"></span>
        <span class="word"><b>happy home</b><small>Quản lý nhà cho thuê</small></span></a>
      <nav class="hd-nav" id="hdNav" aria-label="Công ty"><span class="slide-ind" data-mode="box" aria-hidden="true"></span>${nav}</nav>
      <div class="hd-right">
        <button class="hd-bell pic-hop" id="btnSync" title="Tải lại dữ liệu khách gửi" aria-label="Tải lại dữ liệu">${pic('refresh2', 28)}</button>
        <a class="hd-bell pic-hop ${path === '/noti' ? 'active' : ''}" href="#/noti" aria-label="Thông báo${c.noti ? ', ' + c.noti + ' mục' : ''}">
          ${pic('bell', 28)}${cntBadge(c.noti > 9 ? '9+' : c.noti, 'hd-cnt')}</a>
        <button class="hd-user" data-act="account" aria-haspopup="menu" aria-label="Tài khoản">
          <span class="av">${U.esc(U.initials(name || 'H'))}</span>
          <span class="u-txt"><b>${U.esc(name)}</b><small>${S.isOwner() ? 'Chủ trọ' : 'Nhân viên'}</small></span>
          ${ic('chevron', 14)}</button>
      </div>
    </div></header>`;
  }

  /* ---------- Máy tính: hàng mục của tòa nhà (chỉ trong trang tòa nhà) ---------- */
  function modulebar(bid, path, c) {
    const b = S.building(bid);
    if (!b) return '';
    const seg = path.split('/')[3] || 'units';
    const item = (m) => {
      const n = modCount(m, c);
      return `<a class="mb-item pic-hop ${seg === m.seg ? 'active' : ''}" href="#/b/${bid}/${m.seg}" title="${m.label}" ${seg === m.seg ? 'aria-current="page"' : ''}>
        ${picOf(m, 26)}<span>${m.label}</span>${cntBadge(n, 'mb-cnt' + (m.seg === 'invoices' ? '' : ' soft'))}</a>`;
    };
    const more = MORE.filter(can);
    const moreAct = more.find(m => m.seg === seg);
    const moreN = more.reduce((s, m) => s + modCount(m, c), 0);
    const moreBtn = more.length ? `<button class="mb-item pic-hop ${moreAct ? 'active' : ''}" id="moreBtn" aria-haspopup="menu" title="${moreAct ? moreAct.label : 'Thêm'}">
        ${moreAct ? picOf(moreAct, 26) : pic('apps', 26)}<span>${moreAct ? moreAct.label : 'Thêm'}</span>${cntBadge(moreN, 'mb-cnt soft')}${ic('chevron', 14)}</button>` : '';
    return `<div class="mb"><div class="mb-in">
      <button class="mb-bld" id="bCard" aria-haspopup="menu" aria-label="Đổi tòa nhà đang quản lý">
        <span class="mb-bld-pic">${pic('building', 32)}${S.buildings.length > 1 ? `<span class="n">${S.buildings.length}</span>` : ''}</span>
        <span class="mb-bld-txt"><small>Đang quản lý</small><b>${U.esc(b.name)}</b></span>${ic('chevron', 14)}</button>
      <nav class="mb-nav" id="mbNav" aria-label="Tòa nhà"><span class="slide-ind" data-mode="box" aria-hidden="true"></span>
        ${MODULES.filter(can).map(item).join('')}${moreBtn}</nav>
    </div></div>`;
  }

  /* ---------- Điện thoại: thanh trên gọn ---------- */
  function mobileTop(bid, path, c) {
    const b = S.building(bid);
    const name = (S.prefs && S.prefs.userName) || '';
    return `<header class="mt">
      <a class="mt-logo" href="#/buildings" aria-label="Happy Home, về trang quản lý nhà"><img src="assets/logo-mark.svg" alt="" width="29" height="25"></a>
      <button class="mt-bld" id="bCardM" aria-haspopup="menu" aria-label="Đổi tòa nhà đang quản lý">
        <small>Đang quản lý</small><span><b>${U.esc(b ? b.name : 'Chưa có tòa nhà')}</b>${ic('chevron', 14)}</span></button>
      <button class="mt-btn" id="btnSyncM" aria-label="Tải lại dữ liệu khách gửi">${pic('refresh2', 26)}</button>
      <a class="mt-btn" href="#/noti" aria-label="Thông báo${c.noti ? ', ' + c.noti + ' mục' : ''}">${pic('bell', 26)}${cntBadge(c.noti > 9 ? '9+' : c.noti, 'hd-cnt')}</a>
      <button class="av" data-act="account" aria-haspopup="menu" aria-label="Tài khoản">${U.esc(U.initials(name || 'H'))}</button>
    </header>`;
  }

  /* ---------- Điện thoại: thanh tab dưới (4 mục hay dùng + Menu) ---------- */
  function mobileTabs(bid, path, c) {
    const seg = path.startsWith('/b/') ? (path.split('/')[3] || 'units') : null;
    const tabs = [{ href: '#/dashboard', p: 'chart', label: 'Tổng quan', active: path === '/dashboard' }];
    const pref = ['units', 'invoices', 'tenants', 'readings', 'contracts', 'payments'];
    const all = MODULES.concat(MORE).filter(can);
    pref.map(s => all.find(m => m.seg === s)).filter(Boolean).slice(0, 3).forEach(m => tabs.push({
      href: `#/b/${bid}/${m.seg}`, p: m.pic || m.ic, label: m.seg === 'tenants' ? 'Khách' : m.label,
      active: seg === m.seg, n: modCount(m, c),
    }));
    const menuActive = !tabs.some(t => t.active);
    tabs.push({ menu: true, p: 'apps', label: 'Menu', active: menuActive });
    return `<nav class="mtab" id="mTabs" style="--n:${tabs.length}" aria-label="Điều hướng nhanh">
      <span class="slide-ind" data-mode="fixed" aria-hidden="true"></span>
      ${tabs.map(t => t.menu
        ? `<button class="mtab-i ${t.active ? 'active' : ''}" id="mMenu" aria-haspopup="dialog">${pic(t.p, 28)}<span>${t.label}</span></button>`
        : `<a class="mtab-i ${t.active ? 'active' : ''}" href="${t.href}" ${t.active ? 'aria-current="page"' : ''}>${pic(t.p, 28)}<span>${t.label}</span>${cntBadge(t.n, 'hd-cnt')}</a>`).join('')}
    </nav>`;
  }

  /* ---------- Điện thoại: bảng Menu trượt lên (mọi mục, xếp lưới icon) ---------- */
  function openSheet(bid) {
    const path = HH.router.current().split('?')[0];
    const seg = path.startsWith('/b/') ? (path.split('/')[3] || 'units') : null;
    const b = S.building(bid), c = counts(bid);
    const rooms = b ? S.roomsOf(b.id) : [];
    const occ = rooms.filter(r => r.status === 'occupied' || r.status === 'notice').length;
    let i = 0;
    const tile = (href, p, label, active, n) => `<a class="sheet-tile ${active ? 'active' : ''}" href="${href}" style="--i:${i++}">
      ${pic(p, 34)}<span>${U.esc(label)}</span>${cntBadge(n, 'hd-cnt')}</a>`;
    const bTiles = b ? MODULES.concat(MORE).filter(can).map(m => tile(`#/b/${bid}/${m.seg}`, m.pic || m.ic, m.label, seg === m.seg, modCount(m, c))).join('') : '';
    const cTiles = TOP_TILES.filter(t => !t.owner || S.isOwner()).map(t => tile(`#${t.path}`, t.ic, t.label, t.key === 'home' ? path === '/buildings' : path === t.path, t.key === 'bank' ? c.claims : 0)).join('');
    const name = (S.prefs && S.prefs.userName) || '';
    const wrap = document.createElement('div');
    wrap.className = 'sheet-back';
    wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="sheet-grab" aria-hidden="true"></div>
      ${b ? `<button class="sheet-bld" id="shBld">${pic('building', 36)}<span><small>Đang quản lý</small><b>${U.esc(b.name)}</b></span>
        <em>${rooms.length} phòng, ${rooms.length ? Math.round(occ / rooms.length * 100) : 0}%</em></button>
      <h4>Tòa nhà</h4><div class="sheet-grid">${bTiles}</div>` : ''}
      <h4>Công ty</h4><div class="sheet-grid">${cTiles}</div>
      <div class="sheet-user"><span class="av">${U.esc(U.initials(name || 'H'))}</span>
        <span><b>${U.esc(name)}</b><small>${S.isOwner() ? 'Chủ trọ' : 'Nhân viên'}</small></span>
        <button class="btn btn-outline btn-sm" id="shAcct">Tài khoản</button></div>
    </div>`;
    const close = () => {
      if (!wrap.isConnected) return;
      wrap.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => wrap.remove(), HH.fx.reduce() ? 0 : 260);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('a')) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    const sb = wrap.querySelector('#shBld'); if (sb) sb.onclick = () => { close(); openBuildingMenu(document.getElementById('bCardM'), bid); };
    wrap.querySelector('#shAcct').onclick = () => { close(); openUserMenu(document.querySelector('.mt .av')); };
    const first = wrap.querySelector('.sheet-tile.active, .sheet-tile'); if (first) first.focus({ preventScroll: true });
  }

  function shellFrame(top, contentHtml, bottom) {
    return `<div class="lz-app" id="lzApp">
      ${top}
      <main class="lz-content"><div class="content-inner" id="pageRoot">${contentHtml}</div></main>
      ${bottom}
    </div>`;
  }

  function pageCtx(pageKey, params, route) {
    const bid = params.bid;
    return { pageKey, params, route, bid, building: bid ? S.building(bid) : null,
      path: HH.router.current(), go: HH.router.go };
  }

  /* ---------- Chuyển trang ----------
     Đổi sang trang khác: trang cũ trượt ra, trang mới trượt vào (đi tới thì
     sang trái, quay lại thì sang phải). Vẽ lại CÙNG trang (lọc, đổi kỳ, vừa
     lưu xong): không chạy hiệu ứng, giữ nguyên chỗ đang cuộn. */
  let lastPath = null, fromBare = false, stuckIO = null;

  // Thứ tự trang để biết hướng đi: mục công ty trước, rồi các mục của tòa nhà
  function pageOrder(path) {
    if (path.startsWith('/b/')) {
      const parts = path.split('/');
      const i = MODULES.concat(MORE).findIndex(m => m.seg === (parts[3] || 'units'));
      return 100 + (i < 0 ? 50 : i) + (parts.length > 4 ? .5 : 0);   // trang con (…/new, …/:id) sâu hơn
    }
    const i = TOP_TILES.findIndex(t => t.path === path);
    return i < 0 ? 90 : i;
  }

  function renderShell(pageKey, params, route) {
    const path = HH.router.current().split('?')[0];
    const same = path === lastPath && !fromBare;
    const first = !lastPath && !fromBare;           // vừa mở ứng dụng: chỉ cần hiệu ứng trồi lên
    const dir = fromBare ? 'fade' : (lastPath && pageOrder(path) < pageOrder(lastPath) ? 'back' : 'fwd');
    lastPath = path; fromBare = false;
    if (same || first) return paint(pageKey, params, route, same, false);
    HH.fx.transition((vt) => paint(pageKey, params, route, false, vt), dir);
  }

  function paint(pageKey, params, route, same, inVT) {
    const path = HH.router.current().split('?')[0];
    const keepY = same ? window.scrollY : 0;
    if (params.bid && S.building(params.bid)) lastBid = params.bid;
    if (!lastBid || !S.building(lastBid)) lastBid = S.buildings[0] ? S.buildings[0].id : null;
    const c = counts(lastBid);
    const top = header(path, c) + (path.startsWith('/b/') ? modulebar(lastBid, path, c) : '') + mobileTop(lastBid, path, c);
    const bottom = mobileTabs(lastBid, path, c);
    let contentHtml = '';
    const page = HH.pages[pageKey];
    const ctx = pageCtx(pageKey, params, route);
    try {
      if (pageKey === 'notfound') contentHtml = notFoundHtml();
      else if (pageKey === 'forbidden') contentHtml = forbiddenHtml();
      else if (pageKey === 'stub') contentHtml = HH.pages.stub.render(ctx);
      else if (page) contentHtml = page.render(ctx);
      else contentHtml = HH.pages.stub.render(ctx);
    } catch (e) {
      console.error(e);
      contentHtml = `<div class="alert alert-danger"><span class="ic">${HH.ic('alert', 16)}</span><div>Lỗi hiển thị trang: ${U.esc(e.message)}</div></div>`;
    }
    document.getElementById('app').innerHTML = shellFrame(top, contentHtml, bottom);
    document.body.classList.add('has-shell');
    wireShell(Object.assign({}, params, { bid: params.bid || lastBid }));
    try { if (page && page.mount && pageKey !== 'stub') page.mount(ctx);
          else if (pageKey === 'stub' && HH.pages.stub.mount) HH.pages.stub.mount(ctx); } catch (e) { console.error(e); }
    if (HH.assistant) HH.assistant.mount();   // khung chat trợ lý (nằm ngoài #app nên không bị vẽ lại)
    window.scrollTo(0, keepY);
    // Chuyển động: chỉ báo trượt sang mục mới; nội dung trồi lên khi trình duyệt
    // không có hiệu ứng chuyển trang (có rồi thì thôi, tránh chồng hai hiệu ứng)
    HH.fx.slide(document.getElementById('hdNav'), 'hd');
    HH.fx.slide(document.getElementById('mbNav'), 'mb');
    HH.fx.slide(document.getElementById('mTabs'), 'mtab');
    if (!same && !inVT) HH.fx.enter(document.getElementById('pageRoot'));
    watchStuck();
  }

  // Hàng mục tòa nhà đổ bóng khi đã dính lên đầu màn hình (không dùng sự kiện cuộn)
  function watchStuck() {
    if (stuckIO) { stuckIO.disconnect(); stuckIO = null; }
    const hd = document.querySelector('.hd'), mb = document.querySelector('.mb');
    if (!hd || !mb || !('IntersectionObserver' in window)) return;
    stuckIO = new IntersectionObserver(([e]) => mb.classList.toggle('stuck', !e.isIntersecting));
    stuckIO.observe(hd);
  }

  function renderBare(pageKey, params, route) {
    const page = HH.pages[pageKey];
    const ctx = pageCtx(pageKey, params, route);
    const fromShell = !!document.getElementById('lzApp');   // đang trong ứng dụng -> đăng xuất
    lastPath = null; fromBare = true;
    const run = () => {
      if (HH.assistant) HH.assistant.unmount();  // màn hình đăng nhập không hiện trợ lý
      document.body.classList.remove('has-shell');
      document.getElementById('app').innerHTML = page.render(ctx);
      if (page.mount) page.mount(ctx);
    };
    if (fromShell) HH.fx.transition(run, 'fade'); else run();
  }

  function wireShell(params) {
    document.querySelectorAll('#lzApp [data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'logout') { S.logout(); HH.router.go('/login'); }
      else if (a === 'account') openUserMenu(b);
    });
    ['bCard', 'bCardM'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.onclick = () => openBuildingMenu(el, params.bid);
    });
    const more = document.getElementById('moreBtn');
    if (more) more.onclick = () => openMoreMenu(more, params.bid);
    const mm = document.getElementById('mMenu');
    if (mm) mm.onclick = () => openSheet(params.bid);
    ['btnSync', 'btnSyncM'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.onclick = () => pullServer(true, b);
    });
  }

  /* ---------- Dữ liệu khách gửi trong lúc web đang mở ----------
     Chỉ số điện, báo hỏng, báo chuyển khoản từ app khách nằm trên máy chủ.
     Web quản trị nạp dữ liệu lúc đăng nhập, nên phải tải lại thì mới thấy:
     tự tải khi quay lại tab, mỗi 2 phút, và khi bấm nút làm mới. */
  let lastPull = Date.now(), pulling = false;
  async function pullServer(manual, btn) {
    if (!S.usingBackend()) {
      if (manual) HH.ui.toast('Bản demo không có máy chủ để tải lại', { type: 'warning' });
      return;
    }
    if (pulling || (!manual && Date.now() - lastPull < 60000)) return;
    pulling = true;
    if (btn) btn.classList.add('spin');
    try {
      const r = await S.refreshFromServer();
      lastPull = Date.now();
      if (!r.ok) { if (manual) HH.ui.toast('Không tải được dữ liệu mới', { type: 'error' }); return; }
      if (r.changed) { HH.router.render(); if (manual) HH.ui.toast('Đã cập nhật dữ liệu mới', { type: 'ok' }); }
      else if (manual) HH.ui.toast('Dữ liệu đã là mới nhất', { type: 'ok' });
    } finally {
      pulling = false;
      const b2 = btn && btn.isConnected ? btn : document.getElementById(btn && btn.id);
      if (b2) b2.classList.remove('spin');
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullServer(false); });
  setInterval(() => { if (document.visibilityState === 'visible') pullServer(false); }, 120000);

  function openMoreMenu(anchor, bid) {
    const seg = (HH.router.current().split('?')[0].split('/')[3]) || '';
    const items = MORE.filter(can).map(m => ({
      icon: picOf(m, 24), label: m.label, cls: seg === m.seg ? 'on' : '',
      onClick: () => HH.router.go(`/b/${bid}/${m.seg}`),
    }));
    HH.ui.openMenu(anchor, items);
  }
  function UI() { return HH.ui; }


  function openUserMenu(anchor) {
    const roleLabel = S.isOwner() ? 'Chủ trọ (toàn quyền)'
      : `Nhân viên, ${S.myPermissions().length} quyền`;
    const items = [
      { icon: ic('user', 16), label: `${S.prefs.userName}`, onClick: () => {} },
      { icon: ic(S.isOwner() ? 'shield' : 'key', 16), label: roleLabel, onClick: () => HH.router.go('/config') },
      { sep: true },
    ];
    // Chỉ chế độ demo (không có máy chủ) mới cho đổi vai trò để xem thử
    if (!S.usingBackend()) items.push(
      { icon: ic(S.isOwner() ? 'check' : 'user', 16), label: 'Xem thử: Chủ trọ', onClick: () => switchRole('owner') },
      { icon: ic(!S.isOwner() ? 'check' : 'user', 16), label: 'Xem thử: Nhân viên', onClick: () => switchRole('staff') },
      { sep: true });
    if (S.isOwner()) items.push({ icon: ic('users', 16), label: 'Quản lý nhân viên', onClick: () => HH.router.go('/group') }, { sep: true });
    return HH.ui.openMenu(anchor, items.concat(userMenuTail()));
  }
  function userMenuTail() {
    // Nhân viên không được xóa/khôi phục toàn bộ dữ liệu
    if (!S.isOwner()) return [{ icon: ic('logout', 16), label: 'Đăng xuất', danger: true, onClick: () => { S.logout(); HH.router.go('/login'); } }];
    return [
      { icon: ic('refresh', 16), label: 'Khôi phục dữ liệu mẫu', onClick: () => {
        HH.ui.modal({ title: 'Khôi phục dữ liệu mẫu', bodyHtml: '<p class="muted">Xóa toàn bộ thay đổi và nạp lại dữ liệu mẫu ban đầu. Không thể hoàn tác.</p>',
          footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-danger" id="doReset">Khôi phục</button>',
          onMount(el) { el.querySelector('#doReset').onclick = () => S.resetData(); } });
      } },
      { sep: true },
      { icon: ic('logout', 16), label: 'Đăng xuất', danger: true, onClick: () => { S.logout(); HH.router.go('/login'); } },
    ];
  }
  function switchRole(role) {
    S.login(role);
    HH.ui.toast(`Đã chuyển sang vai trò ${role === 'owner' ? 'Chủ trọ' : 'Nhân viên vận hành'}`, { type: 'ok' });
    HH.router.render();
  }
  function addBuildingDialog() {
    HH.ui.modal({ title: 'Thêm tòa nhà', bodyHtml: h`
      <div class="field"><label>Tên tòa nhà *</label><input class="input" id="nbName" placeholder="VD: Happy Home Thủ Đức"></div>
      <div class="field" style="margin-top:12px"><label>Địa chỉ</label><input class="input" id="nbAddr" placeholder="Số nhà, đường, quận, thành phố"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="nbSave">Thêm tòa nhà</button>`,
      onMount(el, close) {
        el.querySelector('#nbSave').onclick = () => {
          const name = el.querySelector('#nbName').value.trim();
          if (!name) { HH.ui.toast('Vui lòng nhập tên tòa nhà', { type: 'error' }); return; }
          const b = S.addBuilding({ id: U.uid('b'), name, address: el.querySelector('#nbAddr').value.trim(), floors: 1, perFloor: 0 });
          S.log('building.add', `Thêm tòa nhà ${name}`);
          close(); HH.ui.toast('Đã thêm tòa nhà. Giờ hãy tạo phòng.', { type: 'ok' }); HH.router.go(`/b/${b.id}/units`);
        };
      } });
  }

  function openBuildingMenu(anchor, curBid) {
    const path = HH.router.current();
    const seg = path.startsWith('/b/') ? (path.split('/')[3] || 'units') : 'units';
    const items = S.buildings.map(b => ({
      icon: pic('building', 24), label: b.name, cls: b.id === curBid ? 'on' : '',
      onClick: () => HH.router.go(`/b/${b.id}/${seg}`),
    }));
    if (S.isOwner()) items.push({ sep: true }, { icon: ic('plus', 16), label: 'Thêm tòa nhà', onClick: () => addBuildingDialog() });
    HH.ui.openMenu(anchor, items);
  }

  function notFoundHtml() {
    return `<div class="stub"><div class="big-ic">${pic('house', 56)}</div><h3>Không tìm thấy trang</h3>
      <p class="muted">Đường dẫn không tồn tại.</p>
      <div style="margin-top:16px"><a class="btn btn-primary" href="#/buildings">Về Quản lý nhà</a></div></div>`;
  }
  function forbiddenHtml() {
    return `<div class="stub"><div class="big-ic">${pic('lock', 56)}</div><h3>Bạn không có quyền truy cập</h3>
      <p class="muted">Mục này chỉ dành cho chủ trọ. Bạn đang ở vai trò nhân viên vận hành.</p>
      <div style="margin-top:16px"><a class="btn btn-outline" href="#/buildings">Quay lại</a></div></div>`;
  }

  /* ---------- Phím tắt (§6.4) ---------- */
  function shortcuts(e) {
    if (e.key === 'Escape') { HH.ui.closeMenus(); HH.ui.closeTopModal(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    if (typing) return;
    if (e.key === '/') { const s = document.querySelector('[data-search]'); if (s) { e.preventDefault(); s.focus(); } }
    else if (e.key === 'n') { const b = document.querySelector('[data-primary-new]'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === '?') { showShortcuts(); }
  }
  function showShortcuts() {
    HH.ui.modal({ title: 'Phím tắt', bodyHtml: `
      <table class="dt" style="width:100%"><tbody>
        <tr><td><kbd>/</kbd></td><td>Nhảy tới ô tìm kiếm</td></tr>
        <tr><td><kbd>n</kbd></td><td>Tạo mới trong ngữ cảnh hiện tại</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Đóng hộp thoại, menu</td></tr>
        <tr><td><kbd>Tab</kbd> / <kbd>Enter</kbd></td><td>Ô tiếp theo khi nhập chỉ số</td></tr>
        <tr><td><kbd>?</kbd></td><td>Hiện bảng phím tắt</td></tr>
      </tbody></table>`, footHtml: `<span class="spacer"></span><button class="btn btn-primary" data-close>Đóng</button>` });
  }

  async function boot() {
    document.addEventListener('keydown', shortcuts);
    if (S.usingBackend()) {
      HH.backend.init();
      try {
        const session = await HH.backend.getSession();
        if (session) await S.onSignedIn(session.user);
        else S.prefs.auth = false;
      } catch (e) { console.error('Khởi tạo backend lỗi:', e); S.prefs.auth = false; }
    }
    HH.router.start();
  }

  return { renderShell, renderBare, boot, showShortcuts, addBuildingDialog };
})();

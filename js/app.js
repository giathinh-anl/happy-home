/* ============================================================
   Happy Home / LOZIDO-style — Khung ứng dụng + điều hướng + boot
   ============================================================ */
HH.app = (function () {
  const U = HH.util, S = HH.store, h = U.html, raw = U.raw;

  // Thanh nav xanh trên cùng (cấp công ty). owner=true -> chỉ chủ trọ.
  const ic = (n, s) => HH.icon(n, { size: s || 18 });

  const TOP_TILES = [
    { key: 'home',   ic: 'building', label: 'Quản lý nhà',        path: '/buildings' },
    { key: 'report', ic: 'chart',    label: 'Tổng báo cáo',       path: '/dashboard', pill: 'Mới', pillClass: 'new' },
    { key: 'bank',   ic: 'card',     label: 'Khách chuyển khoản', path: '/transfers' },
    { key: 'post',   ic: 'megaphone',label: 'Đăng tin',           path: '/post' },
    { key: 'group',  ic: 'users',    label: 'Công ty/nhóm',       path: '/group', owner: true },
    { key: 'config', ic: 'settings', label: 'Cài đặt',            path: '/config' },
    { key: 'noti',   ic: 'bell',     label: 'Thông báo',          path: '/noti', pill: '0', pillClass: 'zero' },
    { key: 'acct',   ic: 'user',     label: 'Tài khoản',          action: 'account' },
    { key: 'logout', ic: 'logout',   label: 'Đăng xuất',          action: 'logout' },
  ];

  // Hàng module (cấp tòa nhà).
  const MODULES = [
    { ic: 'door',      label: 'Phòng',      seg: 'units', perm: 'rooms' },
    { ic: 'receipt',   label: 'Hóa đơn',    seg: 'invoices', perm: 'invoices' },
    { ic: 'concierge', label: 'Dịch vụ',    seg: 'services', perm: 'services' },
    { ic: 'file',      label: 'Hợp đồng',   seg: 'contracts', perm: 'contracts' },
    { ic: 'box',       label: 'Tài sản',    seg: 'assets', perm: 'assets' },
    { ic: 'users',     label: 'Khách thuê', seg: 'tenants', perm: 'tenants' },
  ];
  const MORE = [
    { ic: 'gauge',    label: 'Chỉ số điện nước',     seg: 'readings', perm: 'readings' },
    { ic: 'wallet',   label: 'Thanh toán & công nợ', seg: 'payments', perm: 'payments' },
    { ic: 'wrench',   label: 'Sự cố phòng',          seg: 'incidents', perm: 'incidents' },
    { ic: 'chart',    label: 'Thu chi',              seg: 'expenses', perm: 'expenses' },
    { ic: 'lock',     label: 'Khóa thông minh',      seg: 'locks', perm: 'rooms' },
    { ic: 'settings', label: 'Cấu hình tòa nhà',     seg: 'config', perm: 'settings' },
  ];

  /* ============================================================
     KHUNG: thanh bên (tòa nhà đang quản lý + các mục) + thanh trên mỏng.
     Tên các mục giữ nguyên như trước, chỉ đổi cách bày.
     ============================================================ */
  let lastBid = null;   // tòa đang làm việc — giữ lại khi sang trang cấp công ty

  const cnt = (n, tone) => n ? `<span class="sb-cnt ${tone || ''}">${n > 99 ? '99+' : n}</span>` : '';

  function sidebar(bid, path) {
    const b = S.building(bid);
    const seg = path.startsWith('/b/') ? (path.split('/')[3] || 'units') : null;
    const rooms = b ? S.roomsOf(b.id) : [];
    const occ = rooms.filter(r => r.status === 'occupied' || r.status === 'notice').length;
    const overdue = b ? S.invoicesOf(b.id).filter(i => i.status === 'overdue').length : 0;
    const openInc = b ? S.incidentsOf(b.id).length : 0;
    const claims = S.pendingClaimCount ? S.pendingClaimCount() : 0;

    const modItem = (m) => {
      const n = m.seg === 'invoices' ? cnt(overdue, 'bad') : m.seg === 'incidents' ? cnt(openInc) : '';
      return `<a class="sb-item ${seg === m.seg ? 'active' : ''}" href="#/b/${bid}/${m.seg}"
        ${seg === m.seg ? 'aria-current="page"' : ''}>${ic(m.ic, 18)}<span>${m.label}</span>${n}</a>`;
    };
    const mods = MODULES.concat(MORE).filter(m => !m.perm || S.can(m.perm)).map(modItem).join('');

    const company = TOP_TILES.filter(t => t.path && t.key !== 'noti' && (!t.owner || S.isOwner())).map(t => {
      const active = t.key === 'home' ? path === '/buildings' : path === t.path;
      const n = t.key === 'bank' ? cnt(claims, 'bad') : '';
      return `<a class="sb-item ${active ? 'active' : ''}" href="#${t.path}" ${active ? 'aria-current="page"' : ''}>
        ${ic(t.ic, 18)}<span>${t.label}</span>${n}</a>`;
    }).join('');

    const name = (S.prefs && S.prefs.userName) || '';
    return `<aside class="sb" id="sb" aria-label="Điều hướng">
      <a class="sb-logo" href="#/buildings" aria-label="Happy Home, về trang quản lý nhà">
        <span class="mark"><img src="assets/logo-mark.svg" alt="" width="30" height="26"></span>
        <span class="word"><b>happy home</b><small>Quản lý nhà cho thuê</small></span>
      </a>
      <button class="sb-bld" id="bCard" aria-haspopup="menu" aria-label="Đổi tòa nhà đang quản lý">
        <span class="sb-bld-ring" aria-hidden="true"></span>
        <span class="sb-bld-txt"><small>Đang quản lý</small><b>${U.esc(b ? b.name : 'Chưa có tòa nhà')}</b>
          ${b ? `<em>${rooms.length} phòng, lấp đầy ${rooms.length ? Math.round(occ / rooms.length * 100) : 0}%</em>` : ''}</span>
        ${ic('chevron', 16)}
      </button>
      <nav class="sb-nav" aria-label="Tòa nhà">${b ? mods : ''}</nav>
      <div class="sb-group">Công ty</div>
      <nav class="sb-nav" aria-label="Công ty">${company}</nav>
      <button class="sb-user" data-act="account" aria-haspopup="menu">
        <span class="av">${U.esc(U.initials(name || 'H'))}</span>
        <span class="u-txt"><b>${U.esc(name)}</b><small>${S.isOwner() ? 'Chủ trọ' : 'Nhân viên'}</small></span>
        ${ic('dots', 18)}
      </button>
    </aside>`;
  }

  // Tên trang hiện tại cho thanh trên (lấy đúng nhãn menu)
  function pageLabel(path, route) {
    if (path.startsWith('/b/')) {
      const seg = path.split('/')[3] || 'units';
      const m = MODULES.concat(MORE).find(x => x.seg === seg);
      return m ? m.label : ((route && route.meta && route.meta.title) || '');
    }
    const t = TOP_TILES.find(x => x.path === path);
    return t ? t.label : ((route && route.meta && route.meta.title) || '');
  }

  function appbar(bid, path, route) {
    const b = S.building(bid);
    const noti = S.notificationCount ? S.notificationCount() : 0;
    const label = pageLabel(path, route);
    return `<header class="appbar">
      <button class="appbar-btn sb-toggle" id="sbOpen" aria-label="Mở menu">${ic('menu', 20)}</button>
      <div class="crumb">
        ${path.startsWith('/b/') && b ? `<span class="c-b">${U.esc(b.name)}</span><span class="c-sep" aria-hidden="true">/</span>` : ''}
        <span class="c-p">${U.esc(label)}</span>
      </div>
      <div class="appbar-right">
        <a class="appbar-btn" href="#/noti" aria-label="Thông báo${noti ? ', ' + noti + ' mục' : ''}">
          ${ic('bell', 19)}${noti ? `<span class="appbar-cnt">${noti > 9 ? '9+' : noti}</span>` : ''}</a>
      </div>
    </header>`;
  }

  function shellFrame(sideHtml, barHtml, contentHtml) {
    return `<div class="lz-app" id="lzApp">
      ${sideHtml}
      <div class="sb-scrim" id="sbScrim" aria-hidden="true"></div>
      <div class="main-col">
        ${barHtml}
        <main class="lz-content"><div class="content-inner" id="pageRoot">${contentHtml}</div></main>
      </div>
    </div>`;
  }

  function pageCtx(pageKey, params, route) {
    const bid = params.bid;
    return { pageKey, params, route, bid, building: bid ? S.building(bid) : null,
      path: HH.router.current(), go: HH.router.go };
  }

  function renderShell(pageKey, params, route) {
    const path = HH.router.current().split('?')[0];
    if (params.bid && S.building(params.bid)) lastBid = params.bid;
    if (!lastBid || !S.building(lastBid)) lastBid = S.buildings[0] ? S.buildings[0].id : null;
    const side = sidebar(lastBid, path);
    const bar = appbar(lastBid, path, route);
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
    document.getElementById('app').innerHTML = shellFrame(side, bar, contentHtml);
    wireShell(Object.assign({}, params, { bid: params.bid || lastBid }));
    try { if (page && page.mount && pageKey !== 'stub') page.mount(ctx);
          else if (pageKey === 'stub' && HH.pages.stub.mount) HH.pages.stub.mount(ctx); } catch (e) { console.error(e); }
    if (HH.assistant) HH.assistant.mount();   // khung chat trợ lý (nằm ngoài #app nên không bị vẽ lại)
    window.scrollTo(0, 0);
  }

  function renderBare(pageKey, params, route) {
    const page = HH.pages[pageKey];
    const ctx = pageCtx(pageKey, params, route);
    if (HH.assistant) HH.assistant.unmount();  // màn hình đăng nhập không hiện trợ lý
    document.getElementById('app').innerHTML = page.render(ctx);
    if (page.mount) page.mount(ctx);
  }

  function wireShell(params) {
    document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'logout') { S.logout(); HH.router.go('/login'); }
      else if (a === 'account') openUserMenu(b);
    });
    const card = document.getElementById('bCard');
    if (card) card.onclick = () => openBuildingMenu(card, params.bid);
    // Điện thoại: thanh bên là ngăn kéo
    const appEl = document.getElementById('lzApp');
    const setOpen = (on) => appEl && appEl.classList.toggle('sb-open', on);
    const op = document.getElementById('sbOpen'); if (op) op.onclick = () => setOpen(true);
    const sc = document.getElementById('sbScrim'); if (sc) sc.onclick = () => setOpen(false);
    document.querySelectorAll('#sb .sb-item').forEach(a => a.addEventListener('click', () => setOpen(false)));
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
      icon: ic(b.id === curBid ? 'check' : 'building', 16), label: b.name,
      onClick: () => HH.router.go(`/b/${b.id}/${seg}`),
    }));
    if (S.isOwner()) items.push({ sep: true }, { icon: ic('plus', 16), label: 'Thêm tòa nhà', onClick: () => addBuildingDialog() });
    HH.ui.openMenu(anchor, items);
  }

  function notFoundHtml() {
    return `<div class="stub"><div class="big-ic">${ic('search', 34)}</div><h3>Không tìm thấy trang</h3>
      <p class="muted">Đường dẫn không tồn tại.</p>
      <div style="margin-top:16px"><a class="btn btn-primary" href="#/buildings">Về Quản lý nhà</a></div></div>`;
  }
  function forbiddenHtml() {
    return `<div class="stub"><div class="big-ic">${ic('lock', 34)}</div><h3>Bạn không có quyền truy cập</h3>
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

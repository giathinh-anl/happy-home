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

  /* ---------- Thanh trên ---------- */
  function topbar(path) {
    const inBuilding = path.startsWith('/b/');
    const notiCount = S.notificationCount ? S.notificationCount() : 0;
    const tiles = TOP_TILES.filter(t => !t.owner || S.isOwner()).map(t => {
      let active = false;
      if (t.key === 'home') active = inBuilding || path === '/buildings';
      else if (t.path) active = path === t.path;
      let pillText = t.pill, pillClass = t.pillClass;
      if (t.key === 'noti') { pillText = String(notiCount); pillClass = notiCount > 0 ? '' : 'zero'; }
      if (t.key === 'bank') { const n = S.pendingClaimCount ? S.pendingClaimCount() : 0;
        pillText = n ? String(n) : null; pillClass = ''; }
      const pill = pillText ? `<span class="pill ${pillClass || ''}">${pillText}</span>` : '';
      const attr = t.action ? `data-act="${t.action}"` : `href="#${t.path}"`;
      const tag = t.action ? 'button' : 'a';
      return `<${tag} class="lz-tile ${active ? 'active' : ''}" ${attr} title="${t.label}">
        ${ic(t.ic)}<span class="lbl">${t.label}</span>${pill}</${tag}>`;
    }).join('');
    return h`<header class="lz-topbar"><div class="lz-topbar-inner">
      <a class="lz-logo" href="#/buildings">
        <span class="mark">HH</span>
        <span class="word"><b>Happy Home</b><small>Quản lý nhà cho thuê</small></span>
      </a>
      <nav class="lz-topnav">${raw(tiles)}</nav>
    </div></header>`;
  }

  /* ---------- Hàng module ---------- */
  function modulebar(bid, path) {
    const b = S.building(bid);
    const seg = path.split('/')[3] || 'units';
    const mods = MODULES.filter(m => !m.perm || S.can(m.perm)).map(m => {
      const active = seg === m.seg;
      return `<a class="lz-module ${active ? 'active' : ''}" href="#/b/${bid}/${m.seg}" title="${m.label}">
        ${ic(m.ic, 20)}<span>${m.label}</span></a>`;
    }).join('');
    const moreActive = MORE.some(m => m.seg === seg);
    return h`<div class="lz-modulebar"><div class="lz-modulebar-inner">
      <div class="lz-building-card" id="bCard">
        <span class="home">${raw(ic('building', 19))}<span class="cnt">${S.buildings.length}</span></span>
        <span class="b-info"><span class="k">Đang quản lý</span><span class="n">${b ? b.name : '—'}</span></span>
        <button class="add" id="bAdd" title="Thêm tòa nhà">${raw(ic('plus', 16))}</button>
      </div>
      <div class="lz-modules">
        ${raw(mods)}
        <button class="lz-module ${raw(moreActive ? 'active' : '')}" id="moreBtn" title="Thêm">${raw(ic('dots', 20))}<span>Thêm</span></button>
      </div>
    </div></div>`;
  }

  function shellFrame(topHtml, moduleHtml, contentHtml) {
    return h`<div class="lz-app">
      ${raw(topHtml)}
      ${raw(moduleHtml || '')}
      <main class="lz-content"><div class="content-inner" id="pageRoot">${raw(contentHtml)}</div></main>
    </div>`;
  }

  function pageCtx(pageKey, params, route) {
    const bid = params.bid;
    return { pageKey, params, route, bid, building: bid ? S.building(bid) : null,
      path: HH.router.current(), go: HH.router.go };
  }

  function renderShell(pageKey, params, route) {
    const path = HH.router.current();
    const top = topbar(path);
    const modules = params.bid ? modulebar(params.bid, path) : '';
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
      contentHtml = `<div class="alert alert-danger"><span class="ic">⚠</span><div>Lỗi hiển thị trang: ${U.esc(e.message)}</div></div>`;
    }
    document.getElementById('app').innerHTML = shellFrame(top, modules, contentHtml);
    wireShell(params);
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
    if (card) card.onclick = (e) => {
      if (e.target.closest('#bAdd')) { e.stopPropagation(); addBuildingDialog(); return; }
      openBuildingMenu(card, params.bid);
    };
    const more = document.getElementById('moreBtn');
    if (more) more.onclick = () => openMoreMenu(more, params.bid);
  }
  function UI() { return HH.ui; }

  function openMoreMenu(anchor, bid) {
    const items = MORE.filter(m => !m.perm || S.can(m.perm)).map(m => ({
      icon: ic(m.ic, 17), label: m.label, onClick: () => HH.router.go(`/b/${bid}/${m.seg}`),
    }));
    if (!items.length) items.push({ icon: '🔒', label: 'Không có mục nào được cấp quyền', onClick: () => {} });
    HH.ui.openMenu(anchor, items);
  }

  function openUserMenu(anchor) {
    const roleLabel = S.isOwner() ? 'Chủ trọ (toàn quyền)'
      : `Nhân viên · ${S.myPermissions().length} quyền`;
    const items = [
      { icon: '👤', label: `${S.prefs.userName}`, onClick: () => {} },
      { icon: S.isOwner() ? '👑' : '🔑', label: roleLabel, onClick: () => HH.router.go('/config') },
      { sep: true },
    ];
    // Chỉ chế độ demo (không có máy chủ) mới cho đổi vai trò để xem thử
    if (!S.usingBackend()) items.push(
      { icon: S.isOwner() ? '●' : '○', label: 'Xem thử: Chủ trọ', onClick: () => switchRole('owner') },
      { icon: !S.isOwner() ? '●' : '○', label: 'Xem thử: Nhân viên', onClick: () => switchRole('staff') },
      { sep: true });
    if (S.isOwner()) items.push({ icon: '🧑‍🤝‍🧑', label: 'Quản lý nhân viên', onClick: () => HH.router.go('/group') }, { sep: true });
    return HH.ui.openMenu(anchor, items.concat(userMenuTail()));
  }
  function userMenuTail() {
    // Nhân viên không được xóa/khôi phục toàn bộ dữ liệu
    if (!S.isOwner()) return [{ icon: '🚪', label: 'Đăng xuất', danger: true, onClick: () => { S.logout(); HH.router.go('/login'); } }];
    return [
      { icon: '↺', label: 'Khôi phục dữ liệu mẫu', onClick: () => {
        HH.ui.modal({ title: 'Khôi phục dữ liệu mẫu', bodyHtml: '<p class="muted">Xóa toàn bộ thay đổi và nạp lại dữ liệu mẫu ban đầu. Không thể hoàn tác.</p>',
          footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-danger" id="doReset">Khôi phục</button>',
          onMount(el) { el.querySelector('#doReset').onclick = () => S.resetData(); } });
      } },
      { sep: true },
      { icon: '🚪', label: 'Đăng xuất', danger: true, onClick: () => { S.logout(); HH.router.go('/login'); } },
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
          close(); HH.ui.toast('Đã thêm tòa nhà — hãy tạo phòng', { type: 'ok' }); HH.router.go(`/b/${b.id}/units`);
        };
      } });
  }

  function openBuildingMenu(anchor, curBid) {
    const path = HH.router.current();
    const seg = path.split('/')[3] || 'units';
    HH.ui.openMenu(anchor, S.buildings.map(b => ({
      icon: b.id === curBid ? '●' : '○', label: b.name,
      onClick: () => HH.router.go(`/b/${b.id}/${seg}`),
    })));
  }

  function notFoundHtml() {
    return `<div class="stub"><div class="big-ic">🧭</div><h3>Không tìm thấy trang</h3>
      <p class="muted">Đường dẫn không tồn tại.</p>
      <div style="margin-top:16px"><a class="btn btn-primary" href="#/buildings">Về Quản lý nhà</a></div></div>`;
  }
  function forbiddenHtml() {
    return `<div class="stub"><div class="big-ic">🔒</div><h3>Bạn không có quyền truy cập</h3>
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

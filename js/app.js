/* ============================================================
   Happy Home / LOZIDO-style — Khung ứng dụng + điều hướng + boot
   ============================================================ */
HH.app = (function () {
  const U = HH.util, S = HH.store, h = U.html, raw = U.raw;

  // Thanh nav xanh trên cùng (cấp công ty). owner=true -> chỉ chủ trọ.
  const TOP_TILES = [
    { key: 'home',   ic: '🏘️', label: 'Quản lý nhà',      path: '/buildings' },
    { key: 'report', ic: '📊', label: 'Tổng báo cáo',     path: '/dashboard', pill: 'Mới', pillClass: 'new' },
    { key: 'bank',   ic: '💳', label: 'Khách chuyển khoản', path: '/transfers' },
    { key: 'post',   ic: '📢', label: 'Đăng tin',          path: '/post' },
    { key: 'group',  ic: '🧑‍🤝‍🧑', label: 'Công ty/nhóm', path: '/group', owner: true },
    { key: 'config', ic: '⚙️', label: 'Cài đặt chung',     path: '/config', owner: true },
    { key: 'noti',   ic: '🔔', label: 'Thông báo',         path: '/noti', pill: '0', pillClass: 'zero' },
    { key: 'acct',   ic: '👤', label: 'Tài khoản',         action: 'account' },
    { key: 'logout', ic: '🚪', label: 'Đăng xuất',         action: 'logout' },
  ];

  // Hàng module (cấp tòa nhà).
  const MODULES = [
    { ic: '🏠', label: 'Quản lý phòng', seg: 'units' },
    { ic: '🧾', label: 'Hóa đơn',       seg: 'invoices' },
    { ic: '🛎️', label: 'Dịch vụ',       seg: 'services' },
    { ic: '📄', label: 'Hợp đồng',      seg: 'contracts' },
    { ic: '📦', label: 'Tài sản',       seg: 'assets' },
    { ic: '👥', label: 'Khách thuê',    seg: 'tenants' },
  ];
  const MORE = [
    { ic: '📉', label: 'Chỉ số điện nước',    seg: 'readings' },
    { ic: '₫',  label: 'Thanh toán & công nợ', seg: 'payments' },
    { ic: '📊', label: 'Thu chi',              seg: 'expenses', owner: true },
    { ic: '🔐', label: 'Khóa thông minh',      seg: 'locks' },
    { ic: '⚙️', label: 'Cấu hình tòa nhà',     seg: 'config', owner: true },
  ];

  /* ---------- Thanh trên ---------- */
  function topbar(path) {
    const inBuilding = path.startsWith('/b/');
    const tiles = TOP_TILES.filter(t => !t.owner || S.isOwner()).map(t => {
      let active = false;
      if (t.key === 'home') active = inBuilding || path === '/buildings';
      else if (t.path) active = path === t.path;
      const pill = t.pill ? `<span class="pill ${t.pillClass || ''}">${t.pill}</span>` : '';
      const attr = t.action ? `data-act="${t.action}"` : `href="#${t.path}"`;
      const tag = t.action ? 'button' : 'a';
      return `<${tag} class="lz-tile ${active ? 'active' : ''}" ${attr}>
        ${pill}<span class="ic">${t.ic}</span><span class="lbl">${t.label}</span></${tag}>`;
    }).join('');
    return h`<header class="lz-topbar"><div class="lz-topbar-inner">
      <a class="lz-logo" href="#/buildings">
        <span class="mark">HH</span>
        <span class="word"><b>Happy Home</b><small>QUẢN LÝ NHÀ CHO THUÊ</small></span>
      </a>
      <nav class="lz-topnav">${raw(tiles)}</nav>
    </div></header>`;
  }

  /* ---------- Hàng module ---------- */
  function modulebar(bid, path) {
    const b = S.building(bid);
    const seg = path.split('/')[3] || 'units';
    const mods = MODULES.map(m => {
      const active = seg === m.seg;
      return `<a class="lz-module ${active ? 'active' : ''}" href="#/b/${bid}/${m.seg}">
        <span class="ic">${m.ic}</span><span>${m.label}</span></a>`;
    }).join('');
    const moreActive = MORE.some(m => m.seg === seg);
    return h`<div class="lz-modulebar"><div class="lz-modulebar-inner">
      <div class="lz-building-card" id="bCard">
        <span class="home">🏠<span class="cnt">${S.buildings.length}</span></span>
        <span class="b-info"><span class="k">Đang quản lý</span><span class="n">${b ? b.name : '—'}</span></span>
        <span class="add" id="bAdd" title="Thêm tòa nhà">+</span>
      </div>
      <div class="lz-modules">
        ${raw(mods)}
        <button class="lz-module ${raw(moreActive ? 'active' : '')}" id="moreBtn"><span class="ic">⋯</span><span>Thêm</span></button>
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
    window.scrollTo(0, 0);
  }

  function renderBare(pageKey, params, route) {
    const page = HH.pages[pageKey];
    const ctx = pageCtx(pageKey, params, route);
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
    if (card) card.onclick = (e) => { if (e.target.id === 'bAdd') { addBuildingDialog(); return; } openBuildingMenu(card, params.bid); };
    const more = document.getElementById('moreBtn');
    if (more) more.onclick = () => openMoreMenu(more, params.bid);
  }
  function UI() { return HH.ui; }

  function openMoreMenu(anchor, bid) {
    const items = MORE.filter(m => !m.owner || S.isOwner()).map(m => ({
      icon: m.ic, label: m.label, onClick: () => HH.router.go(`/b/${bid}/${m.seg}`),
    }));
    HH.ui.openMenu(anchor, items);
  }

  function openUserMenu(anchor) {
    HH.ui.openMenu(anchor, [
      { icon: '👤', label: `${S.prefs.userName}`, onClick: () => {} },
      { sep: true },
      { icon: S.isOwner() ? '●' : '○', label: 'Vai trò: Chủ trọ', onClick: () => switchRole('owner') },
      { icon: !S.isOwner() ? '●' : '○', label: 'Vai trò: Nhân viên vận hành', onClick: () => switchRole('staff') },
      { sep: true },
      { icon: '↺', label: 'Khôi phục dữ liệu mẫu', onClick: () => {
        HH.ui.modal({ title: 'Khôi phục dữ liệu mẫu', bodyHtml: '<p class="muted">Xóa toàn bộ thay đổi và nạp lại dữ liệu mẫu ban đầu. Không thể hoàn tác.</p>',
          footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-danger" id="doReset">Khôi phục</button>',
          onMount(el) { el.querySelector('#doReset').onclick = () => S.resetData(); } });
      } },
      { sep: true },
      { icon: '🚪', label: 'Đăng xuất', danger: true, onClick: () => { S.logout(); HH.router.go('/login'); } },
    ]);
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

  function boot() {
    document.addEventListener('keydown', shortcuts);
    HH.router.start();
  }

  return { renderShell, renderBare, boot, showShortcuts, addBuildingDialog };
})();

/* ============================================================
   Happy Home — Router theo hash (#/...) — chạy được qua file://
   ============================================================ */
HH.router = (function () {
  const routes = [
    // Tầng công ty
    { pat: '/login', page: 'login', bare: true },
    { pat: '/dashboard', page: 'dashboard' },
    { pat: '/buildings', page: 'buildings' },
    { pat: '/reports', page: 'stub', meta: { title: 'Báo cáo', owner: true } },
    { pat: '/accounting', page: 'stub', meta: { title: 'Sổ kế toán', owner: true } },
    { pat: '/hr', page: 'stub', meta: { title: 'Nhân sự & phân quyền', owner: true } },
    { pat: '/config', page: 'stub', meta: { title: 'Cài đặt chung', owner: true } },
    { pat: '/logs', page: 'logs', meta: { title: 'Nhật ký hệ thống', owner: true } },
    { pat: '/transfers', page: 'stub', meta: { title: 'Khách chuyển khoản' } },
    { pat: '/post', page: 'stub', meta: { title: 'Đăng tin cho thuê' } },
    { pat: '/group', page: 'stub', meta: { title: 'Công ty / nhóm', owner: true } },
    { pat: '/noti', page: 'noti' },
    // Tầng tòa nhà
    { pat: '/b/:bid/units', page: 'units' },
    { pat: '/b/:bid/tenants', page: 'tenants' },
    { pat: '/b/:bid/tenants/new', page: 'tenantNew' },
    { pat: '/b/:bid/contracts', page: 'contracts' },
    { pat: '/b/:bid/contracts/new', page: 'contractNew' },
    { pat: '/b/:bid/contracts/:cid/terminate', page: 'terminate' },
    { pat: '/b/:bid/services', page: 'services' },
    { pat: '/b/:bid/readings', page: 'readings' },
    { pat: '/b/:bid/invoices', page: 'invoices' },
    { pat: '/b/:bid/invoices/:iid', page: 'invoiceDetail' },
    { pat: '/b/:bid/payments', page: 'payments' },
    { pat: '/b/:bid/expenses', page: 'stub', meta: { title: 'Thu chi', owner: true } },
    { pat: '/b/:bid/assets', page: 'assets' },
    { pat: '/b/:bid/incidents', page: 'incidents' },
    { pat: '/b/:bid/locks', page: 'locks' },
    { pat: '/b/:bid/config', page: 'buildingConfig', meta: { title: 'Cấu hình tòa nhà', owner: true } },
  ];

  function match(path) {
    for (const r of routes) {
      const pp = r.pat.split('/'), sp = path.split('/');
      if (pp.length !== sp.length) continue;
      const params = {}; let ok = true;
      for (let i = 0; i < pp.length; i++) {
        if (pp[i].startsWith(':')) params[pp[i].slice(1)] = decodeURIComponent(sp[i]);
        else if (pp[i] !== sp[i]) { ok = false; break; }
      }
      if (ok) return { route: r, params };
    }
    return null;
  }

  function current() {
    let path = location.hash.replace(/^#/, '') || '/';
    if (path === '/') path = HH.store.prefs.auth ? ('/b/' + HH.store.buildings[0].id + '/units') : '/login';
    return path;
  }

  function go(path) {
    if (location.hash.replace(/^#/, '') === path) { render(); }
    else location.hash = path;
  }

  function render() {
    HH.ui.clearBulkBars();
    HH.ui.closeMenus();
    let path = current();
    const m = match(path);

    // Chưa đăng nhập -> ép về login
    if (!HH.store.prefs.auth && (!m || m.route.page !== 'login')) { location.hash = '/login'; return; }
    if (HH.store.prefs.auth && m && m.route.page === 'login') { location.hash = '/dashboard'; return; }

    if (!m) { HH.app.renderShell('notfound', {}, { page: 'notfound' }); return; }

    // Chặn theo vai trò (menu sinh theo vai trò — §1.5)
    if (m.route.meta && m.route.meta.owner && !HH.store.isOwner()) {
      HH.app.renderShell('forbidden', m.params, m.route); return;
    }

    if (m.route.bare) { HH.app.renderBare(m.route.page, m.params, m.route); }
    else { HH.app.renderShell(m.route.page, m.params, m.route); }
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { go, render, start, current, match };
})();

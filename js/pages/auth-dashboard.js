/* ============================================================
   Trang: Đăng nhập, Tổng quan công ty, Tòa nhà, Nhật ký, Stub
   ============================================================ */
HH.pages = HH.pages || {};
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  /* ---------------- ĐĂNG NHẬP (§3.1) ---------------- */
  HH.pages.login = {
    render() {
      const backend = S.usingBackend();
      const demoBlock = backend ? '' : `
        <div class="field">
          <label>Đăng nhập với vai trò (demo)</label>
          <div class="view-toggle" role="tablist">
            <button type="button" class="active" data-role="owner">Chủ trọ</button>
            <button type="button" data-role="staff">Nhân viên vận hành</button>
          </div>
        </div>`;
      const hint = backend
        ? `<div class="login-hints">Kết nối máy chủ <b>Supabase</b>. <a href="#" id="toggleMode">Chưa có tài khoản? Đăng ký</a></div>`
        : `<div class="login-hints">Bản demo: nhập email hợp lệ và mật khẩu bất kỳ. <a href="#" id="quickFill">Điền nhanh</a></div>`;
      // Dòng chữ lớn hiện lên từng chữ một
      let wi = 0;
      const words = (t, cls) => t.split(' ').map(w => `<span class="w ${cls || ''}" style="--i:${wi++}">${U.esc(w)}</span>`).join(' ');
      return h`<div class="login-page">
        <div class="login-art" aria-hidden="true">${HH.scene()}</div>
        <div class="login-wrap">
          <section class="login-brand">
            <div class="login-sign"><img class="login-logo3d" src="assets/logo-3d.webp" alt="Logo Happy Home" width="2000" height="1804"></div>
            <h2 class="login-h">${raw(words('Quản lý nhà cho thuê'))}<br>${raw(words('nhẹ tênh mỗi ngày', 'hl'))}</h2>
            <p class="login-sub">Phòng, hợp đồng, hóa đơn và công nợ gọn trong một nơi.</p>
            <ul class="login-feats">
              <li>${HH.pic('receipt', 30)}<span>Hóa đơn tự tính điện nước</span></li>
              <li>${HH.pic('card', 30)}<span>Tự khớp tiền chuyển khoản</span></li>
              <li>${HH.pic('chat', 30)}<span>Trợ lý ảo trả lời số liệu</span></li>
            </ul>
          </section>
          <div class="login-form-wrap">
          <form class="login-form" id="loginForm" novalidate>
            <div class="login-mini-logo"><img src="assets/logo-mark.svg" alt="" width="44" height="38"><span>happy home</span></div>
            <div><h1 id="authTitle">Đăng nhập</h1><p class="lead">${raw(backend ? 'Tài khoản của bạn' : 'Hệ thống quản lý')}</p></div>
            <div id="loginError" class="alert alert-danger hidden"><span class="ic">${HH.ic('alert', 16)}</span><div id="loginErrText">Email hoặc mật khẩu không đúng</div></div>
            <div class="field" id="nameField" style="display:none">
              <label for="fullName">Họ và tên</label>
              <input class="input" id="fullName" placeholder="Nguyễn Văn A">
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input class="input" id="email" type="email" autocomplete="username" placeholder="ban@happyhome.vn">
              <span class="err hidden" data-err="email">Email không hợp lệ</span>
            </div>
            <div class="field">
              <label for="pw">Mật khẩu</label>
              <div class="pw-field">
                <input class="input" id="pw" type="password" autocomplete="current-password" placeholder="••••••••">
                <button type="button" class="toggle" id="pwToggle" aria-label="Hiện mật khẩu">${HH.ic('eye', 16)}</button>
              </div>
              ${raw(backend ? '<span class="hint">Tối thiểu 6 ký tự</span>' : '')}
            </div>
            ${raw(demoBlock)}
            <button class="btn btn-primary btn-lg btn-block" id="loginBtn" type="submit">Đăng nhập</button>
            ${raw(hint)}
            <a href="tenant-app/index.html" style="text-align:center;display:block;margin-top:4px">Bạn là khách thuê? Đăng nhập tại đây →</a>
          </form>
          </div>
        </div>
      </div>`;
    },
    mount() {
      if (S.usingBackend()) return mountBackendAuth();
      mountDemoAuth();
    },
  };

  function emailValid(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || '').trim()); }

  function mountDemoAuth() {
    const form = document.getElementById('loginForm');
    const email = document.getElementById('email');
    const pw = document.getElementById('pw');
    const errBox = document.getElementById('loginError');
    let role = 'owner';
    document.getElementById('pwToggle').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; };
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
      document.querySelectorAll('[data-role]').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); role = b.dataset.role;
    });
    const qf = document.getElementById('quickFill');
    if (qf) qf.onclick = (e) => { e.preventDefault(); email.value = 'chutro@happyhome.vn'; pw.value = 'demo1234'; };
    email.onblur = () => {
      const err = form.querySelector('[data-err="email"]');
      if (email.value && !emailValid(email.value)) { email.classList.add('invalid'); err.classList.remove('hidden'); }
      else { email.classList.remove('invalid'); err.classList.add('hidden'); }
    };
    form.onsubmit = (e) => {
      e.preventDefault(); errBox.classList.add('hidden');
      if (!emailValid(email.value) || !pw.value) { errBox.classList.remove('hidden'); return; }
      const btn = document.getElementById('loginBtn');
      btn.classList.add('loading'); btn.textContent = 'Đang đăng nhập...';
      form.querySelectorAll('input,button').forEach(el => el.disabled = true);
      setTimeout(() => { S.login(role); HH.router.go('/b/' + S.buildings[0].id + '/units'); }, 700);
    };
  }

  function mountBackendAuth() {
    const form = document.getElementById('loginForm');
    const email = document.getElementById('email');
    const pw = document.getElementById('pw');
    const nameField = document.getElementById('nameField');
    const errBox = document.getElementById('loginError');
    const errText = document.getElementById('loginErrText');
    const title = document.getElementById('authTitle');
    const btn = document.getElementById('loginBtn');
    let mode = 'signin';

    document.getElementById('pwToggle').onclick = () => { pw.type = pw.type === 'password' ? 'text' : 'password'; };
    const toggle = document.getElementById('toggleMode');
    toggle.onclick = (e) => {
      e.preventDefault(); errBox.classList.add('hidden');
      mode = mode === 'signin' ? 'signup' : 'signin';
      title.textContent = mode === 'signup' ? 'Đăng ký' : 'Đăng nhập';
      btn.textContent = mode === 'signup' ? 'Đăng ký' : 'Đăng nhập';
      nameField.style.display = mode === 'signup' ? '' : 'none';
      toggle.textContent = mode === 'signup' ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký';
    };

    const showErr = (msg) => { errText.textContent = msg; errBox.classList.remove('hidden'); };
    const mapErr = (m) => {
      m = (m || '').toLowerCase();
      if (m.includes('invalid login')) return 'Email hoặc mật khẩu không đúng.';
      if (m.includes('already registered') || m.includes('already been registered')) return 'Email này đã được đăng ký. Hãy đăng nhập.';
      if (m.includes('password')) return 'Mật khẩu chưa đạt yêu cầu (tối thiểu 6 ký tự).';
      if (m.includes('email')) return 'Email không hợp lệ.';
      return 'Có lỗi xảy ra. Vui lòng thử lại. (' + m + ')';
    };

    form.onsubmit = async (e) => {
      e.preventDefault(); errBox.classList.add('hidden');
      if (!emailValid(email.value)) { showErr('Email không hợp lệ.'); return; }
      if ((pw.value || '').length < 6) { showErr('Mật khẩu tối thiểu 6 ký tự.'); return; }
      btn.classList.add('loading'); const old = btn.textContent;
      btn.textContent = mode === 'signup' ? 'Đang đăng ký...' : 'Đang đăng nhập...';
      form.querySelectorAll('input,button').forEach(el => el.disabled = true);
      const unlock = () => { btn.classList.remove('loading'); btn.textContent = old; form.querySelectorAll('input,button').forEach(el => el.disabled = false); };
      try {
        let res;
        if (mode === 'signup') res = await HH.backend.signUp(email.value.trim(), pw.value, document.getElementById('fullName').value.trim());
        else res = await HH.backend.signIn(email.value.trim(), pw.value);
        if (res.error) { unlock(); showErr(mapErr(res.error.message)); return; }
        if (!res.data.session) { unlock(); showErr('Tài khoản đã tạo. Vui lòng kiểm tra email xác nhận rồi đăng nhập.'); return; }
        const outcome = await S.onSignedIn(res.data.user);
        if (outcome === 'error') { unlock(); showErr('Kết nối máy chủ chưa ổn định. Vui lòng bấm lại sau vài giây.'); return; }
        if (!S.isOwner()) UI.toast(`Đăng nhập với vai trò nhân viên · ${S.myPermissions().length} quyền`, { type: 'ok' });
        HH.router.go(HH.router.landingPath());
      } catch (err) { unlock(); showErr(mapErr(err.message)); }
    };
  }

  /* ---------------- TỔNG QUAN CÔNG TY (§3.2) ---------------- */
  const ic = (n, s) => HH.icon(n, s || 18);

  // Biến động so với kỳ trước, nói bằng chữ (không có kỳ trước thì nói thẳng)
  function delta(now, before, opt) {
    opt = opt || {};
    if (!before) return `<span class="dl flat">chưa có kỳ trước để so</span>`;
    const r = (now - before) / before;
    if (Math.abs(r) < 0.005) return `<span class="dl flat">gần như bằng kỳ trước</span>`;
    const up = r > 0, good = opt.inverse ? !up : up;
    return `<span class="dl ${good ? 'up' : 'down'}">${up ? 'Tăng' : 'Giảm'} ${U.percent(Math.abs(r))} so với kỳ trước</span>`;
  }

  const pic = (n, s) => String(HH.pic(n, s || 28));

  function panel(title, bodyHtml, opt) {
    opt = opt || {};
    return `<section class="card dh-panel ${opt.cls || ''}">
      <header class="dh-panel-h">${opt.pic ? `<span class="dh-panel-pic">${pic(opt.pic, 26)}</span>` : ''}<h3>${U.esc(title)}</h3>${opt.right || ''}</header>
      <div class="dh-panel-b">${bodyHtml}</div>
    </section>`;
  }

  const TONE = { paid: '#2D7A4E', partial: '#1D6E6B', issued: '#E4B07A', overdue: '#B3402F', draft: '#C8D2CF' };

  // Lời chào theo giờ trong ngày
  function greeting() {
    const hr = new Date().getHours();
    return hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  }
  // Cách hiện số khi "chạy" (HH.fx.countUp)
  const FMT = { money: (v) => U.currency(Math.round(v)), pct: (v) => U.percent(v), int: (v) => U.number(Math.round(v)) };

  HH.pages.dashboard = {
    render() {
      const d = S.dashboardSummary();
      const a = S.dashboardAnalytics();
      const owner = S.isOwner();
      const firstB = S.buildings[0] ? S.buildings[0].id : '';
      const K = a.kpi;
      const P = S.periodLabel(a.period);
      const first = ((S.prefs && S.prefs.userName) || '').trim().split(/\s+/).slice(-1)[0];
      const openInc = S.incidents.filter(x => x.status !== 'done').length;

      /* ---- Việc cần xử lý: xếp theo mức gấp ---- */
      const todo = [
        { p: 'alarm', tone: 'bad', n: d.alerts.expiredContracts || 0, t: 'hợp đồng đã quá hạn', href: `#/b/${firstB}/contracts?filter=expired` },
        { p: 'receipt', tone: 'bad', n: d.alerts.overdueInvoices, t: 'hóa đơn quá hạn', href: `#/b/${firstB}/invoices?status=overdue` },
        { p: 'card', tone: '', n: S.pendingClaimCount(), t: 'phiếu chuyển khoản chờ duyệt', href: '#/transfers' },
        { p: 'wrench', tone: '', n: openInc, t: 'sự cố đang mở', href: `#/b/${firstB}/incidents` },
        { p: 'calendar', tone: 'warn', n: d.alerts.expiringContracts, t: 'hợp đồng hết hạn trong 30 ngày', href: `#/b/${firstB}/contracts?filter=soon` },
        { p: 'meter', tone: '', n: d.alerts.pendingReadings, t: 'phòng chưa ghi chỉ số', href: `#/b/${firstB}/readings` },
      ].filter(x => x.n > 0);
      const todoHtml = todo.length
        ? `<ol class="dh-todo">${todo.map((x, i) => `<li style="--i:${i}"><a href="${x.href}">
            <span class="dh-todo-pic">${pic(x.p, 30)}</span>
            <span class="dh-todo-t"><b class="${x.tone}">${x.n}</b> ${U.esc(x.t)}</span>${ic('chevron', 16)}</a></li>`).join('')}</ol>`
        : `<div class="dh-calm">${pic('house', 46)}<p>Mọi việc đã xong, không có gì tồn đọng.</p></div>`;

      /* ---- Băng rôn: lời chào + con số chính, nền là tranh khu phố ---- */
      const remain = Math.max(0, K.billed - K.revenue);
      const quick = [
        { perm: 'readings', href: `#/b/${firstB}/readings`, p: 'meter', t: 'Ghi chỉ số' },
        { perm: 'invoices', href: `#/b/${firstB}/invoices`, p: 'receipt', t: 'Hóa đơn' },
        { perm: 'payments', href: '#/transfers', p: 'card', t: 'Duyệt chuyển khoản' },
      ].filter(q => S.can(q.perm)).map(q => `<a class="dh-q" href="${q.href}">${pic(q.p, 26)}<span>${q.t}</span></a>`).join('');
      const bannerBody = owner ? `
          <div class="dh-hero-k">Đã thu kỳ ${P}</div>
          <div class="dh-hero-v" data-count="${K.revenue}" data-fmt="money">${U.currency(K.revenue)}</div>
          <div class="dh-hero-s">trên ${U.currency(K.billed)} đã phát hành, còn <b>${U.currency(remain)}</b> chưa thu</div>
          <div class="dh-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(K.collectRate * 100)}"
            aria-label="Tỷ lệ đã thu"><span style="width:${Math.min(100, Math.round(K.collectRate * 100))}%"></span></div>
          <div class="dh-meter-l"><b>${U.percent(K.collectRate)}</b> đã thu ${delta(K.revenue, K.revenuePrev)}</div>`
        : `
          <div class="dh-hero-k">Tỷ lệ lấp đầy</div>
          <div class="dh-hero-v" data-count="${K.occupancy}" data-fmt="pct">${U.percent(K.occupancy)}</div>
          <div class="dh-hero-s">${K.occupiedRooms} trên ${K.totalRooms} phòng đang có người thuê</div>
          <div class="dh-meter"><span style="width:${Math.round(K.occupancy * 100)}%"></span></div>`;
      const banner = `<section class="dh-banner">
          <div class="dh-banner-art" aria-hidden="true">${HH.scene()}</div>
          <div class="dh-banner-in">
            <p class="dh-greet">${greeting()}, <b>${U.esc(first)}</b></p>
            ${bannerBody}
            ${quick ? `<div class="dh-quick">${quick}</div>` : ''}
          </div>
        </section>`;

      /* ---- Bốn ô số liệu, mỗi ô một hình + một màu nền nhạt ---- */
      const vacant = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).filter(r => r.status === 'vacant').length, 0);
      const kpis = owner ? [
        { p: 'wallet', t: 'sun', k: 'Công nợ phải thu', v: K.debt, f: 'money', cls: 'warn', sub: `<span class="dl flat">${a.debtorCount} phòng còn nợ</span>` },
        { p: 'coins', t: 'coral', k: 'Chi phí vận hành', v: K.cost, f: 'money', sub: delta(K.cost, K.costPrev, { inverse: true }) },
        { p: 'chart', t: 'leaf', k: 'Lợi nhuận ròng', v: K.profit, f: 'money', cls: K.profit < 0 ? 'bad' : '', sub: delta(K.profit, K.profitPrev) },
        { p: 'house', t: 'sky', k: 'Lấp đầy', v: K.occupancy, f: 'pct', sub: `<span class="dl flat">${K.occupiedRooms}/${K.totalRooms} phòng</span>` },
      ] : [
        { p: 'door', t: 'leaf', k: 'Phòng trống', v: vacant, f: 'int', sub: '<span class="dl flat">sẵn sàng cho thuê</span>' },
        { p: 'meter', t: 'sky', k: 'Chưa ghi chỉ số', v: d.alerts.pendingReadings, f: 'int', cls: 'warn', sub: '<span class="dl flat">phòng kỳ này</span>' },
        { p: 'wrench', t: 'coral', k: 'Sự cố đang mở', v: openInc, f: 'int', sub: '<span class="dl flat">cần xử lý</span>' },
        { p: 'calendar', t: 'grape', k: 'Hợp đồng sắp hết hạn', v: d.alerts.expiringContracts, f: 'int', sub: '<span class="dl flat">trong 30 ngày</span>' },
      ];
      const kpiHtml = `<div class="dh-kpis">${kpis.map(x => `<div class="dh-kpi t-${x.t}">
          <span class="dh-kpi-pic">${pic(x.p, 36)}</span>
          <span class="k">${x.k}</span>
          <span class="v ${x.cls || ''}" data-count="${x.v}" data-fmt="${x.f}">${FMT[x.f](x.v)}</span>${x.sub}</div>`).join('')}</div>`;

      /* ---- Dòng tiền 6 kỳ: cột đôi thu / chi, cột mọc lên lần lượt ---- */
      const maxS = Math.max(1, ...a.series.map(s => Math.max(s.revenue, s.cost)));
      const flow = `<div class="dh-flow" role="img" aria-label="Dòng tiền ${a.series.length} kỳ gần nhất">
        ${a.series.map((s, i) => `<div class="dh-flow-col ${s.period === a.period ? 'now' : ''}" style="--k:${i}">
          <div class="dh-flow-bars">
            <i class="rev" style="height:${Math.max(2, Math.round(s.revenue / maxS * 100))}%" title="Thu ${U.currency(s.revenue)}"></i>
            <i class="cost" style="height:${Math.max(2, Math.round(s.cost / maxS * 100))}%" title="Chi ${U.currency(s.cost)}"></i>
          </div><span>${s.label}</span></div>`).join('')}
        </div>
        <div class="dh-flow-leg"><span><i class="rev"></i>Đã thu</span><span><i class="cost"></i>Chi phí</span></div>`;

      const mix = (label) => (a.invoiceMix.find(x => x.label === label) || {}).value || 0;
      const invStack = HH.chart.stack([
        { label: 'Đã thu đủ', value: mix('Đã thu đủ'), color: TONE.paid },
        { label: 'Thu một phần', value: mix('Thu một phần'), color: TONE.partial },
        { label: 'Chờ thu', value: mix('Chờ thu'), color: TONE.issued },
        { label: 'Quá hạn', value: mix('Quá hạn'), color: TONE.overdue },
      ], { fmt: (v) => v + ' HĐ', empty: `Kỳ ${P} chưa có hóa đơn` });

      /* ---- Phòng (trạng thái) ---- */
      const roomColors = { 'Đang thuê': '#1D6E6B', 'Báo trả': '#E4B07A', 'Đã cọc giữ': '#7DB6B1', 'Trống': '#C8D2CF', 'Bảo trì': '#B3402F' };
      const roomsHtml = `<div class="dh-rooms-top"><span class="big">${U.percent(K.occupancy)}</span>
          <span class="muted">lấp đầy, ${K.occupiedRooms}/${K.totalRooms} phòng</span></div>
        ${HH.chart.stack(a.roomMix.map(x => ({ label: x.label, value: x.value, color: roomColors[x.label] })), { fmt: (v) => v + ' phòng' })}
        <div class="dh-usage">
          <div>${pic('bolt', 24)}<span><b>${U.number(Math.round(a.usage.elecKwh))}</b> kWh điện</span></div>
          <div>${pic('meter', 24)}<span><b>${a.usage.roomsRead}/${K.occupiedRooms}</b> phòng đã ghi số</span></div>
        </div>`;

      /* ---- Các tòa nhà ---- */
      const bRows = a.byBuilding.map(b => {
        const dd = d.buildings.find(x => x.id === b.id) || {};
        const rate = b.billed ? b.collected / b.billed : 0;
        return `<tr data-bid="${b.id}" tabindex="0">
          <td><div class="dh-bname">${pic('building', 30)}<span><b>${U.esc(b.name)}</b><small>${b.rooms} phòng, ${b.vacant} trống</small></span></div></td>
          <td><div class="dh-mini"><span style="width:${Math.round(b.occupancy * 100)}%"></span></div>
            <span class="num text-xs">${U.percent(b.occupancy)}</span></td>
          ${owner ? `<td class="num">${U.currency(b.collected)}<div class="faint text-xs">${U.percent(rate)} đã thu</div></td>
          <td class="num ${dd.debt ? 'dh-debt' : ''}">${U.currency(dd.debt || 0)}</td>` : ''}
        </tr>`;
      }).join('');
      const bTable = `<div class="dt-scroll"><table class="dt dh-btable">
        <thead><tr><th>Tòa nhà</th><th>Lấp đầy</th>${owner ? '<th class="num">Đã thu kỳ này</th><th class="num">Công nợ</th>' : ''}</tr></thead>
        <tbody id="bldRows">${bRows}</tbody></table></div>`;

      /* ---- Tiền vào gần đây / nợ nhiều nhất ---- */
      const av = (name) => `<span class="dh-av" aria-hidden="true">${U.esc(U.initials(name || '?'))}</span>`;
      const recent = a.recentPayments.length
        ? `<ul class="dh-list">${a.recentPayments.map(p => `<li>${av(p.tenantName)}
            <span class="dh-list-m"><b>Phòng ${U.esc(p.roomCode || '')}</b>${p.tenantName ? `<span>${U.esc(p.tenantName)}</span>` : ''}</span>
            <span class="dh-list-s">${U.fmtDate(p.date)}</span>
            <span class="dh-list-v in">+${U.currency(p.amount)}</span></li>`).join('')}</ul>`
        : `<div class="dh-calm">${pic('wallet', 44)}<p>Chưa có khoản thu nào.</p></div>`;
      const debtors = a.topDebtors.length
        ? `<ul class="dh-list">${a.topDebtors.map(t => `<li>${av(t.tenantName)}
            <a class="dh-list-m" href="#/b/${t.buildingId}/invoices"><b>Phòng ${U.esc(t.roomCode)}</b><span>${U.esc(t.tenantName || '')}</span></a>
            <span class="dh-list-s">${U.esc((t.buildingName || '').replace(/^Happy Home\s*/, ''))}</span>
            <span class="dh-list-v out">${U.currency(t.amount)}</span></li>`).join('')}</ul>`
        : `<div class="dh-calm">${pic('house', 44)}<p>Không còn khoản nợ nào.</p></div>`;

      return h`
      <div class="page-head">
        <div><h1 class="page-title">Tổng quan</h1><div class="page-sub">Toàn công ty, kỳ ${P}</div></div>
        <div class="page-actions">
          <div id="periodSel"></div>
          ${raw(owner ? `<button class="btn btn-outline" id="exportReport">${ic('download', 16)} Xuất báo cáo</button>` : '')}
        </div>
      </div>

      <div class="dh-top">
        ${raw(banner)}
        <section class="card dh-todo-card">
          <header class="dh-panel-h"><span class="dh-panel-pic">${raw(pic('clipboard', 26))}</span><h3>Cần xử lý</h3><span class="faint text-xs">xếp theo mức gấp</span></header>
          ${raw(todoHtml)}
        </section>
      </div>

      ${raw(kpiHtml)}

      <div class="dh-row ${raw(owner ? 'dh-row-a' : 'dh-row-a2')}">
        ${raw(owner ? panel(`Dòng tiền ${a.series.length} kỳ`, flow, { pic: 'coins' }) : '')}
        ${raw(panel('Hóa đơn kỳ này', invStack, { pic: 'receipt' }))}
        ${raw(panel('Phòng', roomsHtml, { pic: 'door' }))}
      </div>

      <div class="dh-row">${raw(panel('Các tòa nhà', bTable, { cls: 'flush', pic: 'building' }))}</div>

      <div class="dh-row dh-row-b">
        ${raw(panel('Tiền vào gần đây', recent, { pic: 'card', right: `<a class="link-sm" href="#/b/${firstB}/payments">Xem tất cả</a>` }))}
        ${raw(panel('Nợ nhiều nhất', debtors, { pic: 'wallet' }))}
      </div>`;
    },
    mount() {
      document.querySelectorAll('#bldRows tr[data-bid]').forEach(tr => {
        tr.onclick = () => HH.router.go(`/b/${tr.dataset.bid}/units`);
        tr.onkeydown = (e) => { if (e.key === 'Enter') tr.onclick(); };
      });
      const psel = document.getElementById('periodSel');
      if (psel) {
        const opt = { value: S.period(), pending: S.periodsWithData(), onChange: (p) => { S.setPeriod(p); HH.router.render(); } };
        psel.innerHTML = UI.periodSelector(opt);
        UI.attachPeriod(psel.querySelector('[data-period-root]'), opt);
      }
      HH.fx.countUp(document.getElementById('pageRoot'), FMT);
      const ex = document.getElementById('exportReport');
      if (ex) ex.onclick = () => {
        const d = S.dashboardSummary(), a = S.dashboardAnalytics();
        U.downloadCSV(`bao-cao-${d.period}.csv`,
          ['Tòa nhà', 'Số phòng', 'Tỷ lệ lấp đầy', 'Phát hành kỳ', 'Đã thu kỳ', 'Công nợ'],
          a.byBuilding.map(b => {
            const bb = d.buildings.find(x => x.id === b.id) || {};
            return [b.name, b.rooms, U.percent(b.occupancy), b.billed, b.collected, bb.debt || 0];
          }));
        UI.toast('Đã tải báo cáo (CSV)', { type: 'ok' });
      };
    },
  };

  /* ---------------- TÒA NHÀ (danh sách) ---------------- */
  HH.pages.buildings = {
    render() {
      const cards = S.buildings.map(b => {
        const rs = S.roomsOf(b.id);
        const occ = rs.filter(r => r.status === 'occupied' || r.status === 'notice').length;
        const vacant = rs.filter(r => r.status === 'vacant').length;
        const debt = S.invoicesOf(b.id).reduce((s, i) => s + (i.total - i.paid), 0);
        return h`<a class="card bl-card" href="#/b/${b.id}/units">
          <div class="bl-art" aria-hidden="true">${HH.scene()}</div>
          <div class="bl-body">
            <div class="between"><h3>${b.name}</h3><span class="badge s-info">${rs.length} phòng</span></div>
            <div class="muted text-sm bl-addr">${HH.ic('pin', 14)} ${b.address || 'Chưa có địa chỉ'}</div>
            <div class="bl-stats">
              <div>${HH.pic('house', 28)}<span><small>Lấp đầy</small><b>${U.percent(rs.length ? occ / rs.length : 0)}</b></span></div>
              <div>${HH.pic('door', 28)}<span><small>Phòng trống</small><b>${vacant}</b></span></div>
              <div>${HH.pic('wallet', 28)}<span><small>Công nợ</small><b>${U.currency(debt)}</b></span></div>
            </div>
          </div>
        </a>`;
      });
      return h`<div class="page-head"><div><h1 class="page-title">Tòa nhà</h1>
        <div class="page-sub">Chọn một tòa để vào quản lý chi tiết</div></div>
        ${raw(S.isOwner() ? `<div class="page-actions"><button class="btn btn-primary" data-primary-new>${HH.ic('plus', 16)} Thêm tòa nhà</button></div>` : '')}
        </div>
        <div class="bl-grid">${cards}</div>`;
    },
    mount() {
      const b = document.querySelector('[data-primary-new]');
      if (b) b.onclick = () => HH.app.addBuildingDialog();
    },
  };

  /* ---------------- NHẬT KÝ HỆ THỐNG ---------------- */
  HH.pages.logs = {
    render() {
      const seed = [
        { at: '2026-08-08T09:12:00', actor: 'Nguyễn Văn A', action: 'invoice.edit', message: 'Chỉnh sửa hóa đơn HD-2608-013', reason: 'Điều chỉnh chỉ số điện ghi nhầm' },
        { at: '2026-08-05T16:40:00', actor: 'Nguyễn Văn A', action: 'invoice.issue', message: 'Phát hành 24 hóa đơn kỳ T8/2026', reason: null },
        { at: '2026-08-03T10:05:00', actor: 'Trần Thị Vận Hành', action: 'payment.record', message: 'Ghi nhận thanh toán 2.180.000 ₫ cho HD-2607-001', reason: null },
      ];
      const all = S.auditLog.concat(seed);
      const rows = all.map(l => h`<tr>
        <td class="mono nowrap">${U.fmtDate(l.at)} ${new Date(l.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
        <td>${l.actor}</td>
        <td><span class="badge s-neutral"><span class="dot"></span>${l.action}</span></td>
        <td>${l.message}</td>
        <td class="muted">${l.reason || '-'}</td>
      </tr>`);
      return h`<div class="page-head"><div><div class="page-title">Nhật ký hệ thống</div>
        <div class="page-sub">Mọi thao tác ghi đè, phát hành và thanh toán đều được lưu vết</div></div></div>
        <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Nội dung</th><th>Lý do</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
    },
  };

  /* ---------------- STUB (trang chưa dựng) ---------------- */
  HH.pages.stub = {
    render(ctx) {
      const title = (ctx.route.meta && ctx.route.meta.title) || 'Màn hình';
      return h`<div class="page-head"><div><div class="page-title">${title}</div></div></div>
        <div class="card"><div class="stub"><div class="big-ic">${HH.ic('wrench', 30)}</div>
          <h3>${title}</h3>
          <p class="muted">Màn hình này nằm trong đặc tả và sẽ được dựng ở bước tiếp theo.<br>
          Phiên bản hiện tại tập trung vào luồng vận hành cốt lõi.</p>
        </div></div>`;
    },
  };
})();

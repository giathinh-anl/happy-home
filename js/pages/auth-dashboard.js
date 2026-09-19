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
      return h`<div class="login-split">
        <div class="login-brand">
          <img class="login-logo3d" src="assets/logo-3d.webp" alt="Logo Happy Home" width="2000" height="1804">
          <div class="login-copy">
            <div class="tagline">Quản lý nhà cho thuê thông minh</div>
            <div class="sub">Vận hành tòa nhà, hợp đồng, hóa đơn và công nợ trong một hệ thống duy nhất.</div>
          </div>
        </div>
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

  function panel(title, bodyHtml, opt) {
    opt = opt || {};
    return `<section class="card dh-panel ${opt.cls || ''}">
      <header class="dh-panel-h"><h3>${U.esc(title)}</h3>${opt.right || ''}</header>
      <div class="dh-panel-b">${bodyHtml}</div>
    </section>`;
  }

  const TONE = { paid: '#2D7A4E', partial: '#1D6E6B', issued: '#E4B07A', overdue: '#B3402F', draft: '#C8D2CF' };

  HH.pages.dashboard = {
    render() {
      const d = S.dashboardSummary();
      const a = S.dashboardAnalytics();
      const owner = S.isOwner();
      const firstB = S.buildings[0] ? S.buildings[0].id : '';
      const K = a.kpi;
      const P = S.periodLabel(a.period);

      /* ---- Việc cần xử lý: xếp theo mức gấp ---- */
      const todo = [
        { i: 'alert', tone: 'bad', n: d.alerts.expiredContracts || 0, t: 'hợp đồng đã quá hạn', href: `#/b/${firstB}/contracts?filter=expired` },
        { i: 'receipt', tone: 'bad', n: d.alerts.overdueInvoices, t: 'hóa đơn quá hạn', href: `#/b/${firstB}/invoices?status=overdue` },
        { i: 'bank', tone: '', n: S.pendingClaimCount(), t: 'phiếu chuyển khoản chờ duyệt', href: '#/transfers' },
        { i: 'wrench', tone: '', n: S.incidents.filter(x => x.status !== 'done').length, t: 'sự cố đang mở', href: `#/b/${firstB}/incidents` },
        { i: 'file', tone: 'warn', n: d.alerts.expiringContracts, t: 'hợp đồng hết hạn trong 30 ngày', href: `#/b/${firstB}/contracts?filter=soon` },
        { i: 'gauge', tone: '', n: d.alerts.pendingReadings, t: 'phòng chưa ghi chỉ số', href: `#/b/${firstB}/readings` },
      ].filter(x => x.n > 0);
      const todoHtml = todo.length
        ? `<ol class="dh-todo">${todo.map(x => `<li><a href="${x.href}">
            <span class="dh-todo-n ${x.tone}">${x.n}</span><span class="dh-todo-t">${U.esc(x.t)}</span>${ic('chevron', 16)}</a></li>`).join('')}</ol>`
        : `<div class="dh-calm">${ic('check', 22)}<p>Không có việc tồn đọng.</p></div>`;

      /* ---- Khối chính: tiền đã thu (chủ trọ) hoặc tình trạng phòng (nhân viên) ---- */
      const remain = Math.max(0, K.billed - K.revenue);
      const maxS = Math.max(1, ...a.series.map(s => Math.max(s.revenue, s.cost)));
      const flow = `<div class="dh-flow" role="img" aria-label="Dòng tiền ${a.series.length} kỳ gần nhất">
        ${a.series.map(s => `<div class="dh-flow-col ${s.period === a.period ? 'now' : ''}">
          <div class="dh-flow-bars">
            <i class="rev" style="height:${Math.max(2, Math.round(s.revenue / maxS * 100))}%" title="Thu ${U.currency(s.revenue)}"></i>
            <i class="cost" style="height:${Math.max(2, Math.round(s.cost / maxS * 100))}%" title="Chi ${U.currency(s.cost)}"></i>
          </div><span>${s.label}</span></div>`).join('')}
        </div>
        <div class="dh-flow-leg"><span><i class="rev"></i>Đã thu</span><span><i class="cost"></i>Chi phí</span></div>`;

      const invStack = HH.chart.stack([
        { label: 'Đã thu đủ', value: a.invoiceMix.find(x => x.label === 'Đã thu đủ') ? a.invoiceMix.find(x => x.label === 'Đã thu đủ').value : 0, color: TONE.paid },
        { label: 'Thu một phần', value: (a.invoiceMix.find(x => x.label === 'Thu một phần') || {}).value || 0, color: TONE.partial },
        { label: 'Chờ thu', value: (a.invoiceMix.find(x => x.label === 'Chờ thu') || {}).value || 0, color: TONE.issued },
        { label: 'Quá hạn', value: (a.invoiceMix.find(x => x.label === 'Quá hạn') || {}).value || 0, color: TONE.overdue },
      ], { fmt: (v) => v + ' HĐ', empty: `Kỳ ${P} chưa có hóa đơn` });

      const hero = owner ? `<section class="dh-hero">
          <div class="dh-hero-k">Đã thu kỳ ${P}</div>
          <div class="dh-hero-v">${U.currency(K.revenue)}</div>
          <div class="dh-hero-s">trên ${U.currency(K.billed)} đã phát hành, còn <b>${U.currency(remain)}</b> chưa thu</div>
          <div class="dh-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(K.collectRate * 100)}"
            aria-label="Tỷ lệ đã thu"><span style="width:${Math.min(100, Math.round(K.collectRate * 100))}%"></span></div>
          <div class="dh-meter-l"><b>${U.percent(K.collectRate)}</b> đã thu ${delta(K.revenue, K.revenuePrev)}</div>
          <div class="dh-hero-split">
            <div><h4>Hóa đơn kỳ này</h4>${invStack}</div>
            <div><h4>Dòng tiền ${a.series.length} kỳ</h4>${flow}</div>
          </div>
        </section>`
        : `<section class="dh-hero">
          <div class="dh-hero-k">Tỷ lệ lấp đầy</div>
          <div class="dh-hero-v">${U.percent(K.occupancy)}</div>
          <div class="dh-hero-s">${K.occupiedRooms} trên ${K.totalRooms} phòng đang có người thuê</div>
          <div class="dh-meter"><span style="width:${Math.round(K.occupancy * 100)}%"></span></div>
          <div class="dh-hero-split"><div><h4>Hóa đơn kỳ này</h4>${invStack}</div><div></div></div>
        </section>`;

      /* ---- Dải số liệu ---- */
      const vacant = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).filter(r => r.status === 'vacant').length, 0);
      const strip = owner ? [
        ['Công nợ phải thu', U.currency(K.debt), delta(K.debt, 0), 'warn'],
        ['Chi phí vận hành', U.currency(K.cost), delta(K.cost, K.costPrev, { inverse: true }), ''],
        ['Lợi nhuận ròng', U.currency(K.profit), delta(K.profit, K.profitPrev), K.profit < 0 ? 'bad' : ''],
        ['Lấp đầy', U.percent(K.occupancy), `<span class="dl flat">${K.occupiedRooms}/${K.totalRooms} phòng</span>`, ''],
      ] : [
        ['Phòng trống', String(vacant), '<span class="dl flat">sẵn sàng cho thuê</span>', ''],
        ['Chưa ghi chỉ số', String(d.alerts.pendingReadings), '<span class="dl flat">phòng kỳ này</span>', 'warn'],
        ['Sự cố đang mở', String(S.incidents.filter(x => x.status !== 'done').length), '<span class="dl flat">cần xử lý</span>', ''],
        ['Hợp đồng sắp hết hạn', String(d.alerts.expiringContracts), '<span class="dl flat">trong 30 ngày</span>', ''],
      ];
      // Công nợ không có số kỳ trước tương ứng -> không ghi "chưa có kỳ trước"
      if (owner) strip[0][2] = `<span class="dl flat">${a.debtorCount} phòng còn nợ</span>`;
      const stripHtml = `<div class="dh-strip">${strip.map(x => `<div class="dh-stat">
          <span class="k">${x[0]}</span><span class="v ${x[3]}">${x[1]}</span>${x[2]}</div>`).join('')}</div>`;

      /* ---- Phòng (trạng thái) ---- */
      const roomColors = { 'Đang thuê': '#1D6E6B', 'Báo trả': '#E4B07A', 'Đã cọc giữ': '#7DB6B1', 'Trống': '#C8D2CF', 'Bảo trì': '#B3402F' };
      const roomsHtml = `<div class="dh-rooms-top"><span class="big">${U.percent(K.occupancy)}</span>
          <span class="muted">lấp đầy, ${K.occupiedRooms}/${K.totalRooms} phòng</span></div>
        ${HH.chart.stack(a.roomMix.map(x => ({ label: x.label, value: x.value, color: roomColors[x.label] })), { fmt: (v) => v + ' phòng' })}
        <div class="dh-usage">
          <div>${ic('bolt', 16)}<span><b>${U.number(Math.round(a.usage.elecKwh))}</b> kWh điện</span></div>
          <div>${ic('drop', 16)}<span><b>${U.number(Math.round(a.usage.waterM3))}</b> m³ nước</span></div>
          <div>${ic('gauge', 16)}<span><b>${a.usage.roomsRead}/${K.occupiedRooms}</b> phòng đã ghi số</span></div>
        </div>`;

      /* ---- Các tòa nhà (gộp "hiệu suất thu" + "tình hình các tòa") ---- */
      const bRows = a.byBuilding.map(b => {
        const dd = d.buildings.find(x => x.id === b.id) || {};
        const rate = b.billed ? b.collected / b.billed : 0;
        return `<tr data-bid="${b.id}" tabindex="0">
          <td><b>${U.esc(b.name)}</b><div class="faint text-xs">${b.rooms} phòng, ${b.vacant} trống</div></td>
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
      const recent = a.recentPayments.length
        ? `<ul class="dh-list">${a.recentPayments.map(p => `<li>
            <span class="dh-list-m"><b>Phòng ${U.esc(p.roomCode || '')}</b>${p.tenantName ? `<span>${U.esc(p.tenantName)}</span>` : ''}</span>
            <span class="dh-list-s">${U.fmtDate(p.date)}</span>
            <span class="dh-list-v in">+${U.currency(p.amount)}</span></li>`).join('')}</ul>`
        : `<div class="dh-calm">${ic('wallet', 22)}<p>Chưa có khoản thu nào.</p></div>`;
      const debtors = a.topDebtors.length
        ? `<ul class="dh-list">${a.topDebtors.map(t => `<li>
            <a class="dh-list-m" href="#/b/${t.buildingId}/invoices"><b>Phòng ${U.esc(t.roomCode)}</b><span>${U.esc(t.tenantName || '')}</span></a>
            <span class="dh-list-s">${U.esc((t.buildingName || '').replace(/^Happy Home\s*/, ''))}</span>
            <span class="dh-list-v out">${U.currency(t.amount)}</span></li>`).join('')}</ul>`
        : `<div class="dh-calm">${ic('check', 22)}<p>Không còn khoản nợ nào.</p></div>`;

      return h`
      <div class="page-head">
        <div><h1 class="page-title">Tổng quan</h1><div class="page-sub">Toàn công ty, kỳ ${P}</div></div>
        <div class="page-actions">
          <div id="periodSel"></div>
          ${raw(owner ? `<button class="btn btn-outline" id="exportReport">${ic('download', 16)} Xuất báo cáo</button>` : '')}
        </div>
      </div>

      <div class="dh-top">
        ${raw(hero)}
        <section class="card dh-todo-card">
          <header class="dh-panel-h"><h3>Cần xử lý</h3><span class="faint text-xs">xếp theo mức gấp</span></header>
          ${raw(todoHtml)}
        </section>
      </div>

      ${raw(stripHtml)}

      <div class="dh-row dh-row-a">
        ${raw(panel('Phòng', roomsHtml))}
        ${raw(panel('Các tòa nhà', bTable, { cls: 'flush' }))}
      </div>

      <div class="dh-row dh-row-b">
        ${raw(panel('Tiền vào gần đây', recent, { right: `<a class="link-sm" href="#/b/${firstB}/payments">Xem tất cả</a>` }))}
        ${raw(panel('Nợ nhiều nhất', debtors))}
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
        return h`<a class="card card-pad" href="#/b/${b.id}/units" style="display:block">
          <div class="between"><h3>${b.name}</h3><span class="badge s-info"><span class="dot"></span>${rs.length} phòng</span></div>
          <div class="muted text-sm" style="margin:4px 0 12px">${b.address}</div>
          <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);gap:12px">
            <div><div class="m-label muted">Lấp đầy</div><div class="mono b text-lg">${U.percent(occ / rs.length)}</div></div>
            <div><div class="m-label muted">Phòng trống</div><div class="mono b text-lg">${vacant}</div></div>
            <div><div class="m-label muted">Công nợ</div><div class="mono b text-lg">${U.currency(debt)}</div></div>
          </div>
        </a>`;
      });
      return h`<div class="page-head"><div><div class="page-title">Tòa nhà</div>
        <div class="page-sub">Chọn một tòa để vào quản lý chi tiết</div></div>
        ${raw(S.isOwner() ? `<div class="page-actions"><button class="btn btn-primary" data-primary-new>+ Thêm tòa nhà</button></div>` : '')}
        </div>
        <div class="grid-3">${cards}</div>`;
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

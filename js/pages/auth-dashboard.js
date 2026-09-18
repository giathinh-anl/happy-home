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
            <div id="loginError" class="alert alert-danger hidden"><span class="ic">⚠</span><div id="loginErrText">Email hoặc mật khẩu không đúng</div></div>
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
                <button type="button" class="toggle" id="pwToggle" aria-label="Hiện mật khẩu">👁</button>
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
  const shortMoney = (n) => {
    n = n || 0;
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' tỷ';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' tr';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
  };

  // Thẻ chỉ số lớn: giá trị + biến động so với kỳ trước + đường xu hướng nhỏ
  function kpiCard(o) {
    const t = o.trend;
    const up = t > 0, flat = !t || Math.abs(t) < 0.005;
    const good = o.inverse ? !up : up;
    const tone = flat ? 'flat' : (good ? 'up' : 'down');
    const arrow = flat ? '→' : (up ? '↑' : '↓');
    const spark = o.spark && o.spark.length
      ? HH.chart.area(o.spark, { height: 40, color: o.color || 'var(--brand-500)' }) : '';
    return `<div class="kpi ${o.accent ? 'kpi-' + o.accent : ''}">
      <div class="kpi-top">
        <span class="kpi-ic">${ic(o.icon, 17)}</span>
        <span class="kpi-label">${U.esc(o.label)}</span>
      </div>
      <div class="kpi-val">${U.esc(o.value)}</div>
      <div class="kpi-foot">
        <span class="kpi-tr ${tone}">${arrow} ${flat ? '—' : U.percent(Math.abs(t))}</span>
        <span class="kpi-sub">${U.esc(o.sub || 'so với kỳ trước')}</span>
      </div>
      ${spark ? `<div class="kpi-spark">${spark}</div>` : ''}
    </div>`;
  }

  function panel(title, bodyHtml, opt) {
    opt = opt || {};
    return `<section class="card ch-card ${opt.cls || ''}">
      <div class="card-head">
        <h3>${U.esc(title)}</h3>
        ${opt.right ? `<div class="ch-head-right">${opt.right}</div>` : ''}
      </div>
      <div class="card-pad">${bodyHtml}</div>
    </section>`;
  }

  HH.pages.dashboard = {
    render() {
      const d = S.dashboardSummary();
      const a = S.dashboardAnalytics();
      const owner = S.isOwner();
      const firstB = S.buildings[0] ? S.buildings[0].id : '';
      const K = a.kpi;

      /* ---- Hàng 1: thẻ chỉ số ---- */
      const sparkRev = a.series.map(s => ({ label: s.label, value: s.revenue }));
      const sparkCost = a.series.map(s => ({ label: s.label, value: s.cost }));
      let cards;
      if (owner) {
        cards = [
          kpiCard({ icon: 'wallet', label: 'Đã thu ' + S.periodLabel(a.period), value: U.currency(K.revenue),
            trend: K.revenueTrend, spark: sparkRev, color: '#22c55e', accent: 'green' }),
          kpiCard({ icon: 'clock', label: 'Công nợ phải thu', value: U.currency(K.debt),
            trend: K.debtTrend, inverse: true, color: '#f59e0b', accent: 'amber' }),
          kpiCard({ icon: 'chart', label: 'Chi phí vận hành', value: U.currency(K.cost),
            trend: K.costTrend, inverse: true, spark: sparkCost, color: '#ef4444', accent: 'red' }),
          kpiCard({ icon: 'trend', label: 'Lợi nhuận ròng', value: U.currency(K.profit),
            trend: K.profitTrend, color: '#3b82f6', accent: 'blue' }),
        ].join('');
      } else {
        const vacant = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).filter(r => r.status === 'vacant').length, 0);
        const openInc = S.incidents.filter(x => x.status !== 'done').length;
        cards = [
          kpiCard({ icon: 'building', label: 'Tỷ lệ lấp đầy', value: U.percent(K.occupancy),
            trend: 0, sub: `${K.occupiedRooms}/${K.totalRooms} phòng`, accent: 'green' }),
          kpiCard({ icon: 'key', label: 'Phòng trống', value: String(vacant), trend: 0, sub: 'sẵn sàng cho thuê' }),
          kpiCard({ icon: 'gauge', label: 'Chưa ghi chỉ số', value: String(d.alerts.pendingReadings),
            trend: 0, sub: 'phòng kỳ này', accent: 'amber' }),
          kpiCard({ icon: 'wrench', label: 'Sự cố đang mở', value: String(openInc), trend: 0, sub: 'cần xử lý', accent: 'red' }),
        ].join('');
      }

      /* ---- Thu / Chi 6 kỳ (cột kép) ---- */
      const maxSeries = Math.max(1, ...a.series.map(s => Math.max(s.revenue, s.cost)));
      const dualBars = `<div class="ch-dual">
        ${a.series.map(s => {
          const rh = Math.max(2, Math.round(s.revenue / maxSeries * 100));
          const ch = Math.max(2, Math.round(s.cost / maxSeries * 100));
          const now = s.period === a.period;
          return `<div class="ch-dual-col ${now ? 'now' : ''}">
            <div class="ch-dual-bars">
              <div class="ch-dual-b rev" style="height:${rh}%" title="Thu ${U.currency(s.revenue)}"></div>
              <div class="ch-dual-b cost" style="height:${ch}%" title="Chi ${U.currency(s.cost)}"></div>
            </div>
            <div class="ch-dual-l">${s.label}</div></div>`;
        }).join('')}
      </div>
      <div class="ch-legend-row">
        <span class="ch-leg-i"><i style="background:#22c55e"></i>Đã thu</span>
        <span class="ch-leg-i"><i style="background:#ef4444"></i>Chi phí</span>
        <span class="ch-leg-i muted">Cao nhất: ${U.currency(maxSeries)}</span>
      </div>`;

      /* ---- Cơ cấu hóa đơn (donut) ---- */
      const mix = HH.chart.donut(a.revenueMix, {
        size: 176, centerTitle: 'Phát hành', centerValue: shortMoney(K.billed),
      });

      /* ---- Tỉ lệ thu (gauge) ---- */
      const gaugeBox = `<div class="ch-gauge-box">
        ${HH.chart.gauge(K.collectRate, { label: 'Đã thu ' + U.currency(K.revenue) + ' / ' + U.currency(K.billed) })}
        <div class="ch-mini-row">
          <div class="ch-mini"><span class="l">Còn phải thu</span><span class="v warn">${U.currency(Math.max(0, K.billed - K.revenue))}</span></div>
          <div class="ch-mini"><span class="l">Hóa đơn quá hạn</span><span class="v danger">${d.alerts.overdueInvoices}</span></div>
        </div>
      </div>`;

      /* ---- Trạng thái phòng ---- */
      const roomDonut = HH.chart.donut(a.roomMix, {
        size: 168, centerTitle: 'Tổng phòng', centerValue: String(K.totalRooms),
        fmt: (v) => v + ' phòng',
      });

      /* ---- Tình trạng hóa đơn kỳ này ---- */
      const invDonut = a.invoiceMix.length
        ? HH.chart.donut(a.invoiceMix, { size: 168, centerTitle: 'Hóa đơn', centerValue: String(a.invoiceMix.reduce((s, x) => s + x.value, 0)), fmt: (v) => v + ' hđ' })
        : `<div class="ch-empty">${ic('receipt', 26)}<p>Kỳ này chưa có hóa đơn</p>
           <a class="btn btn-outline btn-sm" href="#/b/${firstB}/invoices">Tạo hóa đơn</a></div>`;

      /* ---- Chi phí theo hạng mục ---- */
      const expBox = a.expenseMix.length
        ? HH.chart.progress(a.expenseMix.map(x => ({ label: x.label, value: x.value, max: a.expenseMix[0].value, sub: U.currency(x.value) })))
        : `<div class="ch-empty">${ic('chart', 26)}<p>Kỳ này chưa ghi khoản chi nào</p>
           <a class="btn btn-outline btn-sm" href="#/b/${firstB}/expenses">Ghi khoản chi</a></div>`;

      /* ---- Hiệu suất từng tòa ---- */
      const bldProg = HH.chart.progress(a.byBuilding.map(b => ({
        label: b.name, value: b.collected, max: Math.max(1, b.billed),
        sub: `${U.currency(b.collected)} / ${U.currency(b.billed)} · lấp đầy ${U.percent(b.occupancy)}`,
      })));

      /* ---- Việc cần xử lý ---- */
      const alerts = [
        { i: 'alert', tone: 'danger', n: d.alerts.expiredContracts || 0, text: 'hợp đồng đã quá hạn — cần xử lý', href: `#/b/${firstB}/contracts?filter=expired` },
        { i: 'file', tone: 'warning', n: d.alerts.expiringContracts, text: 'hợp đồng sắp hết hạn trong 30 ngày', href: `#/b/${firstB}/contracts?filter=soon` },
        { i: 'receipt', tone: 'danger', n: d.alerts.overdueInvoices, text: 'hóa đơn quá hạn', href: `#/b/${firstB}/invoices?status=overdue` },
        { i: 'gauge', tone: 'info', n: d.alerts.pendingReadings, text: 'phòng chưa ghi chỉ số kỳ này', href: `#/b/${firstB}/readings` },
        { i: 'bank', tone: 'info', n: S.pendingClaimCount(), text: 'phiếu khách báo chuyển khoản chờ duyệt', href: `#/transfers` },
        { i: 'wrench', tone: 'purple', n: S.incidents.filter(x => x.status !== 'done').length, text: 'sự cố đang mở', href: `#/b/${firstB}/incidents` },
      ].filter(x => x.n > 0).map(x => `<a class="todo-item" href="${x.href}">
        <span class="ic alert-${x.tone}">${ic(x.i, 16)}</span>
        <span><b class="num">${x.n}</b> ${U.esc(x.text)}</span>
        <span class="chev">›</span></a>`).join('');

      /* ---- Phiếu thu gần đây ---- */
      const recent = a.recentPayments.length
        ? a.recentPayments.map(p => `<div class="act-row">
            <span class="act-ic ok">${ic('wallet', 15)}</span>
            <div class="act-main">
              <div class="act-t">Phòng ${U.esc(p.roomCode || '—')}${p.tenantName ? ' · ' + U.esc(p.tenantName) : ''}</div>
              <div class="act-s">${[p.receiptNo, p.method, U.fmtDate(p.date)].filter(Boolean).map(U.esc).join(' · ')}</div>
            </div>
            <span class="act-v">+${U.currency(p.amount)}</span></div>`).join('')
        : `<div class="ch-empty">${ic('wallet', 26)}<p>Chưa có phiếu thu nào</p>
           <a class="btn btn-outline btn-sm" href="#/b/${firstB}/payments">Đi tới thu tiền</a></div>`;

      /* ---- Top công nợ ---- */
      const debtors = a.topDebtors.length
        ? a.topDebtors.map(t => `<a class="act-row" href="#/b/${t.buildingId}/invoices">
            <span class="act-ic warn">${ic('door', 15)}</span>
            <div class="act-main">
              <div class="act-t">Phòng ${U.esc(t.roomCode)} · ${U.esc(t.buildingName || '')}</div>
              <div class="act-s">${U.esc(t.tenantName || '')} · ${t.n} hóa đơn chưa thanh toán</div>
            </div>
            <span class="act-v danger">${U.currency(t.amount)}</span></a>`).join('')
        : `<div class="ch-empty">${ic('check', 26)}<p>Không còn khoản nợ nào</p></div>`;

      /* ---- Tiêu thụ điện nước ---- */
      const usage = `<div class="usage-row">
        <div class="usage-box elec">
          <span class="u-ic">${ic('bolt', 18)}</span>
          <div><div class="u-v">${U.number(Math.round(a.usage.elecKwh))} <small>kWh</small></div>
          <div class="u-l">Điện tiêu thụ kỳ này</div></div>
        </div>
        <div class="usage-box water">
          <span class="u-ic">${ic('drop', 18)}</span>
          <div><div class="u-v">${U.number(Math.round(a.usage.waterM3))} <small>m³</small></div>
          <div class="u-l">Nước tiêu thụ kỳ này</div></div>
        </div>
        <div class="usage-box read">
          <span class="u-ic">${ic('gauge', 18)}</span>
          <div><div class="u-v">${a.usage.roomsRead}<small>/${K.occupiedRooms}</small></div>
          <div class="u-l">Phòng đã ghi chỉ số</div></div>
        </div>
      </div>`;

      /* ---- Bảng tòa nhà ---- */
      const rows = d.buildings.map(b => {
        const cols = owner
          ? `<td class="num">${U.currency(b.revenue)}</td><td class="num">${U.currency(b.debt)}</td>`
          : '';
        return `<tr data-bid="${b.id}" style="cursor:pointer">
          <td class="b">${U.esc(b.name)}</td>
          <td class="num">${b.unitCount}</td>
          <td class="num">${U.percent(b.occupancyRate)}</td>
          ${cols}
        </tr>`;
      }).join('');

      return h`
      <div class="page-head">
        <div><div class="page-title">Tổng quan</div><div class="page-sub">Toàn công ty · Kỳ ${S.periodLabel(a.period)}</div></div>
        <div class="page-actions">
          ${raw(owner ? `<button class="btn btn-outline" id="exportReport">${ic('download', 16)} Xuất báo cáo</button>` : '')}
        </div>
      </div>
      <div id="periodSel" style="margin-bottom:16px"></div>

      <div class="kpi-grid">${raw(cards)}</div>

      <div class="dash-2col">
        ${raw(panel('Dòng tiền 6 kỳ gần nhất', dualBars))}
        ${raw(panel('Tiến độ thu kỳ ' + S.periodLabel(a.period), gaugeBox))}
      </div>

      <div class="dash-3col">
        ${raw(panel('Cơ cấu hóa đơn kỳ này', mix))}
        ${raw(panel('Tình trạng phòng', roomDonut))}
        ${raw(panel('Tình trạng hóa đơn', invDonut))}
      </div>

      ${raw(panel('Tiêu thụ điện · nước kỳ ' + S.periodLabel(a.period), usage))}

      <div class="dash-2col">
        ${raw(panel('Hiệu suất thu theo tòa nhà', bldProg))}
        ${raw(panel('Chi phí theo hạng mục', expBox))}
      </div>

      <div class="dash-2col">
        ${raw(panel('Phiếu thu gần đây', `<div class="act-list">${recent}</div>`, {
          right: `<a class="link-sm" href="#/b/${firstB}/payments">Xem tất cả ›</a>` }))}
        ${raw(panel('Phòng nợ nhiều nhất', `<div class="act-list">${debtors}</div>`))}
      </div>

      <div class="dash-2col">
        ${raw(panel('Cần xử lý', `<div class="todo-list">${alerts || '<div class="ch-empty">' + ic('check', 26) + '<p>Không có việc cần xử lý</p></div>'}</div>`))}
        ${raw(panel('Tình hình các tòa nhà', `<div class="dt-scroll"><table class="dt">
          <thead><tr><th scope="col">Tòa nhà</th><th class="num" scope="col">Phòng</th><th class="num" scope="col">Lấp đầy</th>
          ${owner ? '<th class="num" scope="col">Doanh thu</th><th class="num" scope="col">Công nợ</th>' : ''}
          </tr></thead><tbody id="bldRows">${rows}</tbody></table></div>`, { cls: 'ch-card-flush' }))}
      </div>`;
    },
    mount() {
      document.querySelectorAll('#bldRows tr[data-bid]').forEach(tr =>
        tr.onclick = () => HH.router.go(`/b/${tr.dataset.bid}/units`));
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
        <td class="muted">${l.reason || '—'}</td>
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
        <div class="card"><div class="stub"><div class="big-ic">🚧</div>
          <h3>${title}</h3>
          <p class="muted">Màn hình này nằm trong đặc tả và sẽ được dựng ở bước tiếp theo.<br>
          Phiên bản hiện tại tập trung vào luồng vận hành cốt lõi.</p>
        </div></div>`;
    },
  };
})();

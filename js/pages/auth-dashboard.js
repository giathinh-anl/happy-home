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
          <div class="logo-lg"><span class="mark">H</span> HAPPY HOME</div>
          <div class="tagline">Quản lý nhà cho thuê thông minh</div>
          <div class="sub">Vận hành tòa nhà, hợp đồng, hóa đơn và công nợ trong một hệ thống duy nhất.</div>
        </div>
        <div class="login-form-wrap">
          <form class="login-form" id="loginForm" novalidate>
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
        HH.router.go('/b/' + (S.buildings[0] ? S.buildings[0].id : 'b1') + '/units');
      } catch (err) { unlock(); showErr(mapErr(err.message)); }
    };
  }

  /* ---------------- TỔNG QUAN CÔNG TY (§3.2) ---------------- */
  HH.pages.dashboard = {
    render() {
      const d = S.dashboardSummary();
      const owner = S.isOwner();
      let cards;
      if (owner) {
        cards = [
          UI.metricCard({ label: 'Tỷ lệ lấp đầy', value: d.occupancyRate, format: 'percent', trend: d.occupancyTrend }),
          UI.metricCard({ label: 'Doanh thu tháng 8', value: d.revenue, format: 'currency', trend: d.revenueTrend }),
          UI.metricCard({ label: 'Công nợ', value: d.outstandingDebt, format: 'currency', trend: d.debtTrend, intent: 'warning' }),
          UI.metricCard({ label: 'Chi phí vận hành', value: d.operatingCost, format: 'currency', trend: d.costTrend }),
        ];
      } else {
        const vacant = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).filter(r => r.status === 'vacant').length, 0);
        cards = [
          UI.metricCard({ label: 'Tỷ lệ lấp đầy', value: d.occupancyRate, format: 'percent', trend: d.occupancyTrend }),
          UI.metricCard({ label: 'Phòng trống', value: vacant, format: 'number' }),
          UI.metricCard({ label: 'Phòng chưa ghi chỉ số', value: d.alerts.pendingReadings, format: 'number', intent: 'warning' }),
          UI.metricCard({ label: 'Yêu cầu đang mở', value: 4, format: 'number' }),
        ];
      }
      const maxRev = Math.max(...d.revenueHistory.map(x => x.amount));
      const bars = d.revenueHistory.map(x => h`<div class="bar-col">
        <div class="bar" style="height:${raw(Math.round(x.amount / maxRev * 100))}%" title="${U.currency(x.amount)}"></div>
        <div class="cap">${x.period}</div></div>`);

      const alerts = [
        { ic: '⚠', tone: 'warning', n: d.alerts.expiringContracts, text: 'hợp đồng sắp hết hạn trong 30 ngày', href: '#/buildings' },
        { ic: '⚠', tone: 'danger', n: d.alerts.overdueInvoices, text: 'hóa đơn quá hạn', href: `#/b/b1/invoices?status=overdue` },
        { ic: '⚠', tone: 'info', n: d.alerts.pendingReadings, text: 'phòng chưa ghi chỉ số kỳ này', href: `#/b/b1/readings` },
      ].map(a => h`<a class="todo-item" href="${a.href}">
        <span class="ic alert-${a.tone}">${raw(a.ic)}</span>
        <span><b class="num">${a.n}</b> ${a.text}</span>
        <span class="chev">›</span></a>`);

      const rows = d.buildings.map(b => {
        const cols = owner
          ? h`<td class="num">${U.currency(b.revenue)}</td><td class="num">${U.currency(b.debt)}</td>`
          : '';
        return h`<tr data-bid="${b.id}" style="cursor:pointer">
          <td class="b">${b.name}</td>
          <td class="num">${b.unitCount}</td>
          <td class="num">${U.percent(b.occupancyRate)}</td>
          ${raw(cols)}
        </tr>`;
      });

      return h`
      <div class="page-head">
        <div><div class="page-title">Tổng quan</div><div class="page-sub">Toàn công ty · Kỳ T8/2026</div></div>
        <div class="page-actions">
          <button class="period-chip">📅 T8/2026 ▾</button>
          ${raw(owner ? `<button class="btn btn-outline">Xuất báo cáo</button>` : '')}
        </div>
      </div>
      <div class="metric-grid">${cards}</div>
      <div class="dash-grid">
        <div class="card">
          <div class="card-head"><h3>Doanh thu 6 tháng gần nhất</h3></div>
          <div class="card-pad"><div class="spark">${bars}</div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Cần xử lý</h3></div>
          <div class="card-pad"><div class="todo-list">${alerts}</div></div>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Tình hình các tòa nhà</h3></div>
        <div class="dt-scroll"><table class="dt">
          <thead><tr><th scope="col">Tòa nhà</th><th class="num" scope="col">Phòng</th><th class="num" scope="col">Lấp đầy</th>
            ${raw(owner ? '<th class="num" scope="col">Doanh thu</th><th class="num" scope="col">Công nợ</th>' : '')}
          </tr></thead>
          <tbody id="bldRows">${rows}</tbody>
        </table></div>
      </div>`;
    },
    mount() {
      document.querySelectorAll('#bldRows tr[data-bid]').forEach(tr =>
        tr.onclick = () => HH.router.go(`/b/${tr.dataset.bid}/units`));
      const chip = document.querySelector('.period-chip');
      if (chip) chip.onclick = () => UI.toast('Bản demo cố định ở kỳ T8/2026', { type: 'ok' });
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

/* ============================================================
   Happy Home — App khách thuê (Phần IV)
   Kết nối Supabase qua RPC (xem supabase/migration-tenant-app.sql)
   ============================================================ */
(function () {
  'use strict';
  const cfg = window.HH_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && cfg.supabaseUrl.indexOf('YOUR-') === -1 && typeof supabase !== 'undefined');
  const client = enabled ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const CUR_PERIOD = '2026-08', CUR_PERIOD_LABEL = 'T8/2026';
  const TODAY = new Date('2026-08-13');
  const DEMO_OTP = '123456';
  // Tài khoản nhận tiền. bin = mã ngân hàng theo chuẩn NAPAS (MB Bank = 970422,
  // Vietcombank 970436, Techcombank 970407, ACB 970416, BIDV 970418, VietinBank 970415).
  // Đổi ở đây (hoặc đặt HH_CONFIG.bank trong js/config.js) là mã VietQR đổi theo.
  const BANK = Object.assign(
    { name: 'MB Bank', bin: '970422', account: '0912345678', holder: 'CTY HAPPY HOME' },
    (window.HH_CONFIG && HH_CONFIG.bank) || {});

  /* Nội dung chuyển khoản chuẩn để web quản trị tự khớp hóa đơn: "HD2608013".
     Không dùng dấu/khoảng trắng vì nhiều ngân hàng cắt bỏ ký tự lạ. */
  function payContent(inv) { return inv ? String(inv.id).replace(/[^A-Za-z0-9]/g, '') : ''; }

  /* Mã VietQR thật — quét bằng app ngân hàng là tự điền số tiền + nội dung */
  function vietQrUrl(amount, content) {
    return `https://img.vietqr.io/image/${encodeURIComponent(BANK.bin)}-${encodeURIComponent(BANK.account)}-compact2.png`
      + `?amount=${encodeURIComponent(Math.round(amount || 0))}`
      + `&addInfo=${encodeURIComponent(content || '')}`
      + `&accountName=${encodeURIComponent(BANK.holder)}`;
  }
  const PHONE_KEY = 'hh_tenant_phone';

  /* ---------- tiện ích ---------- */
  const viNum = new Intl.NumberFormat('vi-VN');
  const vnd = (n) => (n == null || isNaN(n)) ? '—' : viNum.format(Math.round(n)) + ' ₫';
  const num = (n) => (n == null || isNaN(n)) ? '—' : viNum.format(n);
  const pad = (x) => String(x).padStart(2, '0');
  const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '—' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
  const daysLeft = (d) => Math.round((new Date(d) - TODAY) / 86400000);
  const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const el = (id) => document.getElementById(id);

  function toast(msg) {
    const z = el('ttoast'); const t = document.createElement('div'); t.className = 't-toast'; t.textContent = msg;
    z.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
  }
  function copy(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Đã sao chép ' + (label || '')), () => toast('Không sao chép được'));
    else toast('Trình duyệt không hỗ trợ sao chép');
  }

  /* ---------- trạng thái ---------- */
  const state = { phone: null, pendingPhone: null, data: null, otpTries: 0, repair: { cat: null, time: 'Bất kỳ', photos: [] } };

  const INV_STATUS = {
    draft: ['Nháp', 'neutral'], issued: ['Đã phát hành', 'info'], partial: ['Trả một phần', 'warning'],
    paid: ['Đã thanh toán', 'success'], overdue: ['Quá hạn', 'danger'], cancelled: ['Đã hủy', 'neutral'],
  };
  const badge = (status) => { const m = INV_STATUS[status] || [status, 'neutral']; return `<span class="t-badge ${m[1]}"><span class="d"></span>${m[0]}</span>`; };

  /* ---------- gọi RPC ---------- */
  function rpcMissing(err) { const s = ((err && err.message) || '').toLowerCase(); return s.includes('could not find the function') || s.includes('does not exist') || (err && (err.code === '42883' || err.code === 'PGRST202')); }

  async function loadData(phone) {
    if (!enabled) throw new Error('NO_CONFIG');
    const { data, error } = await client.rpc('tenant_data', { p_phone: phone });
    if (error) { if (rpcMissing(error)) throw new Error('NOT_ACTIVATED'); throw new Error(error.message); }
    return data; // null nếu không tìm thấy SĐT
  }
  async function rpc(fn, args) {
    const { data, error } = await client.rpc(fn, args);
    if (error) { if (rpcMissing(error)) throw new Error('NOT_ACTIVATED'); throw new Error(error.message); }
    return data;
  }

  /* ---------- điều hướng ---------- */
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  window.addEventListener('hashchange', render);

  function render() {
    const h = location.hash || '';
    if (!state.phone) { // chưa đăng nhập
      if (h === '#/otp' && state.pendingPhone) return screenOtp();
      return screenLogin();
    }
    if (!state.data) return screenLoading();
    if (h.startsWith('#/invoice/')) return screenInvoiceDetail(h.split('/')[2]);
    if (h.startsWith('#/pay')) return screenPay(h.split('/')[2]);
    if (h === '#/invoices') return screenInvoices();
    if (h === '#/repair') return screenRepair();
    if (h === '#/track') return screenTrack();
    if (h === '#/readings') return screenReadings();
    if (h === '#/room') return screenRoom();
    if (h === '#/contract') return screenContract();
    if (h === '#/usage') return screenUsage();
    if (h === '#/history') return screenPayHistory();
    if (h === '#/account') return screenAccount();
    if (h === '#/services') return screenServices();
    if (h === '#/chat') return screenChat();
    if (h === '#/proof') return screenProof();
    return screenHome();
  }

  /* ---------- thanh tab dưới ---------- */
  const TABS = [
    { key: 'home', hash: '#/home', ic: '🏠', label: 'Trang chủ' },
    { key: 'invoices', hash: '#/invoices', ic: '🧾', label: 'Hóa đơn' },
    { key: 'room', hash: '#/room', ic: '🚪', label: 'Phòng của tôi' },
    { key: 'account', hash: '#/account', ic: '👤', label: 'Tài khoản' },
  ];
  function tabbar(active) {
    const unpaid = (state.data.invoices || []).filter(i => (i.total - i.paid) > 0).length;
    return `<nav class="t-tabbar">${TABS.map(t => `<button class="t-tab ${t.key === active ? 'on' : ''}" data-tab="${t.hash}">
      ${t.key === 'invoices' && unpaid ? `<span class="dot-badge">${unpaid}</span>` : ''}
      <span class="ic">${t.ic}</span><span>${t.label}</span></button>`).join('')}</nav>`;
  }
  function wireTabs() {
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
  }

  /* ---------- Thanh bên (chỉ hiện trên máy tính) ---------- */
  const SIDE_MAIN = [
    { hash: '#/home', ic: '🏠', label: 'Trang chủ', key: 'home' },
    { hash: '#/invoices', ic: '🧾', label: 'Hóa đơn', key: 'invoices' },
    { hash: '#/room', ic: '🚪', label: 'Phòng của tôi', key: 'room' },
    { hash: '#/contract', ic: '📄', label: 'Hợp đồng', key: 'contract' },
  ];
  const SIDE_MORE = [
    { hash: '#/readings', ic: '📷', label: 'Gửi chỉ số', key: 'readings' },
    { hash: '#/repair', ic: '🔧', label: 'Báo hỏng', key: 'repair' },
    { hash: '#/track', ic: '🛠️', label: 'Yêu cầu sửa chữa', key: 'track' },
    { hash: '#/usage', ic: '📊', label: 'Lịch sử điện nước', key: 'usage' },
    { hash: '#/history', ic: '💳', label: 'Lịch sử thanh toán', key: 'history' },
    { hash: '#/services', ic: '🛎️', label: 'Bảng giá dịch vụ', key: 'services' },
    { hash: '#/chat', ic: '💬', label: 'Trợ lý ảo', key: 'chat' },
    { hash: '#/account', ic: '👤', label: 'Tài khoản', key: 'account' },
  ];

  function sidebar() {
    const d = state.data; if (!d) return '';
    // mục đang chọn suy ra từ URL (kể cả màn hình con như #/invoice/... , #/pay/...)
    const h = location.hash || '#/home';
    const seg = h.split('/')[1] || 'home';
    const active = { invoice: 'invoices', pay: 'invoices', otp: 'home', '': 'home' }[seg] || seg;
    const unpaid = (d.invoices || []).filter(i => (i.total - i.paid) > 0).length;
    const item = (x) => `<button class="t-nav ${x.key === active ? 'on' : ''}" data-tab="${x.hash}">
      <span class="nic">${x.ic}</span><span>${x.label}</span>
      ${x.key === 'invoices' && unpaid ? `<span class="nbadge">${unpaid}</span>` : ''}</button>`;
    const nm = d.tenant.fullName || '';
    return `<aside class="t-side">
      <div class="s-brand"><span class="mark">H</span>
        <span><b>Happy Home</b><small>Khách thuê</small></span></div>
      <div class="s-me"><span class="av">${esc((nm.trim().split(/\s+/).slice(-1)[0] || '?')[0])}</span>
        <span style="min-width:0"><span class="nm">${esc(nm)}</span>
          <span class="rm">Phòng ${esc(d.tenant.roomCode || '')}</span></span></div>
      ${SIDE_MAIN.map(item).join('')}
      <div class="s-sep"></div>
      <div class="s-label">Tiện ích</div>
      ${SIDE_MORE.map(item).join('')}
      <div class="s-foot"><button class="t-nav" id="sideLogout" style="color:var(--danger)">
        <span class="nic">⎋</span><span>Đăng xuất</span></button></div>
    </aside>`;
  }

  /* ---------- màn hình: ĐĂNG NHẬP ---------- */
  function screenLogin() {
    el('tapp').innerHTML = `<div class="t-login">
      <div class="logo"><div class="mark">H</div><h1>Happy Home</h1><p class="lead">Nhập số điện thoại đã đăng ký với chủ nhà</p></div>
      <div id="loginErr"></div>
      <div class="t-field"><label>Số điện thoại</label>
        <div class="t-phone"><span class="cc">+84</span><input id="phone" type="tel" inputmode="numeric" placeholder="0912 345 678" autocomplete="tel"></div>
      </div>
      <button class="t-btn" id="sendOtp">Gửi mã xác thực</button>
      ${enabled ? '' : '<div class="t-hint">⚠ Chưa cấu hình máy chủ (js/config.js).</div>'}
      <div class="t-hint">Bản demo: nhập SĐT của một khách thuê có trong hệ thống. Mã OTP demo là <b>123456</b>.</div>
      <div style="flex:1"></div>
      <a href="../index.html" class="t-btn ghost">← Trang quản trị (chủ trọ)</a>
    </div>`;
    el('phone').addEventListener('keydown', e => { if (e.key === 'Enter') el('sendOtp').click(); });
    el('sendOtp').onclick = async () => {
      const phone = (el('phone').value || '').replace(/\s/g, '').replace(/^\+?84/, '0');
      el('loginErr').innerHTML = '';
      if (!/^0\d{9}$/.test(phone)) { el('loginErr').innerHTML = errBox('Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0).'); return; }
      const btn = el('sendOtp'); btn.classList.add('loading'); btn.disabled = true;
      try {
        const data = await loadData(phone);
        if (!data) { el('loginErr').innerHTML = errBox('Số điện thoại chưa được đăng ký với chủ nhà.'); return; }
        state.pendingPhone = phone; state.data = data; state.otpTries = 0;
        go('#/otp');
      } catch (e) {
        el('loginErr').innerHTML = errBox(e.message === 'NOT_ACTIVATED'
          ? 'App khách thuê chưa được kích hoạt (cần chạy SQL migration-tenant-app.sql).'
          : e.message === 'NO_CONFIG' ? 'Chưa cấu hình máy chủ.' : 'Không kết nối được máy chủ. Thử lại sau.');
      } finally { btn.classList.remove('loading'); btn.disabled = false; }
    };
  }
  const errBox = (m) => `<div class="t-err"><span>⚠</span><div>${esc(m)}</div></div>`;

  /* ---------- màn hình: OTP ---------- */
  function screenOtp() {
    const masked = state.pendingPhone.replace(/(\d{4})\d{3}(\d{3})/, '$1 *** $2');
    el('tapp').innerHTML = `<div class="t-login">
      <div class="logo" style="margin-top:8px"><div class="mark">H</div></div>
      <h1 style="font-size:22px">Nhập mã xác thực</h1>
      <p class="lead">Mã gồm 6 chữ số đã gửi tới<br><b>${masked}</b></p>
      <div id="otpErr"></div>
      <div class="otp-boxes" id="otpBoxes">
        ${[0, 1, 2, 3, 4, 5].map(i => `<input type="tel" inputmode="numeric" maxlength="1" data-i="${i}" autocomplete="${i === 0 ? 'one-time-code' : 'off'}">`).join('')}
      </div>
      <div class="otp-resend" id="resend">Gửi lại mã sau <b id="cd">60</b> giây</div>
      <button class="t-btn" id="verify">Xác nhận</button>
      <button class="t-btn ghost" id="changePhone">← Đổi số điện thoại</button>
      <div class="t-hint">Mã demo: <b>123456</b></div>
    </div>`;
    const boxes = Array.from(document.querySelectorAll('#otpBoxes input'));
    boxes[0].focus();
    const getCode = () => boxes.map(b => b.value).join('');
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => {
        b.value = b.value.replace(/\D/g, '').slice(0, 1);
        if (b.value && i < 5) boxes[i + 1].focus();
        if (getCode().length === 6) doVerify();
      });
      b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus(); });
      b.addEventListener('paste', (e) => {
        e.preventDefault(); const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        t.split('').forEach((c, j) => { if (boxes[j]) boxes[j].value = c; });
        if (t.length === 6) doVerify(); else if (boxes[t.length]) boxes[t.length].focus();
      });
    });
    // đếm ngược
    let cd = 60; const cdEl = el('cd'); const timer = setInterval(() => {
      cd--; if (cdEl) cdEl.textContent = cd;
      if (cd <= 0) { clearInterval(timer); el('resend').innerHTML = '<a href="#" id="resendLink">Gửi lại mã</a>'; const r = el('resendLink'); if (r) r.onclick = (e) => { e.preventDefault(); screenOtp(); }; }
    }, 1000);
    el('verify').onclick = doVerify;
    el('changePhone').onclick = () => { state.pendingPhone = null; state.data = null; go('#/login'); };

    function doVerify() {
      const code = getCode();
      if (code.length < 6) { el('otpErr').innerHTML = errBox('Vui lòng nhập đủ 6 số.'); return; }
      if (code !== DEMO_OTP) {
        state.otpTries++;
        if (state.otpTries >= 3) { el('otpErr').innerHTML = errBox('Sai quá 3 lần. Vui lòng thử lại sau 5 phút.'); boxes.forEach(b => b.disabled = true); el('verify').disabled = true; return; }
        el('otpErr').innerHTML = errBox(`Mã không đúng. Còn ${3 - state.otpTries} lần thử.`);
        boxes.forEach(b => b.value = ''); boxes[0].focus();
        return;
      }
      // đúng
      clearInterval(timer);
      state.phone = state.pendingPhone;
      try { localStorage.setItem(PHONE_KEY, state.phone); } catch (e) {}
      go('#/home');
    }
  }

  /* ---------- khung có header + nội dung ---------- */
  function shell(title, body, opts) {
    opts = opts || {};
    const header = opts.home
      ? `<div class="t-header"><div class="brand"><span class="mark">H</span> Happy Home</div>
           <button class="iconbtn" id="reload" title="Tải lại">⟳</button></div>`
      : `<div class="t-header plain"><button class="back" id="back">←</button><div class="htitle">${esc(title)}</div></div>`;
    const tabs = opts.tab ? tabbar(opts.tab) : '';
    // Nút trợ lý ảo nổi — hiện ở các màn hình chính (điện thoại)
    const fab = opts.tab ? `<button class="chat-fab" id="chatFab" title="Trợ lý ảo" aria-label="Trợ lý ảo">💬</button>` : '';
    // Tiêu đề trang cho bố cục máy tính (điện thoại đã có thanh header riêng)
    const deskHead = `<div class="t-page-head"><h1>${esc(opts.deskTitle || title || 'Trang chủ')}</h1>
      ${opts.deskSub ? `<p>${esc(opts.deskSub)}</p>` : ''}</div>`;
    el('tapp').innerHTML = `<div class="t-app">${sidebar()}${header}
      <div class="t-main">${deskHead}${body}</div>${fab}${tabs}</div>`;
    const fb = el('chatFab'); if (fb) fb.onclick = () => go('#/chat');
    wireTabs();   // thanh bên dùng chung data-tab
    const slo = el('sideLogout');
    if (slo) slo.onclick = () => { if (!confirm('Đăng xuất khỏi ứng dụng?')) return;
      try { localStorage.removeItem(PHONE_KEY); } catch (e) {}
      state.phone = null; state.data = null; go('#/login'); };
    const back = el('back'); if (back) back.onclick = () => history.length > 1 ? history.back() : go('#/home');
    const rl = el('reload'); if (rl) rl.onclick = async () => {
      rl.textContent = '⏳';
      try { state.data = await loadData(state.phone); toast('Đã cập nhật'); } catch (e) { toast('Không tải được'); }
      render();
    };
    if (opts.tab) wireTabs();
  }

  function screenLoading() { shell('', `<div class="skeleton-card"></div><div class="skeleton-card"></div>`, { home: true }); }

  /* ---------- màn hình: TRANG CHỦ ---------- */
  function currentUnpaid() { return (state.data.invoices || []).find(i => (i.total - i.paid) > 0); }

  function screenHome() {
    const d = state.data;
    const inv = currentUnpaid();
    let dueCard;
    if (!inv) {
      dueCard = `<div class="due-card paid"><div class="label">Công nợ</div>
        <div class="amount">${vnd(0)}</div><div class="meta">✓ Bạn đã thanh toán đầy đủ</div></div>`;
    } else {
      const remain = inv.total - inv.paid; const dl = daysLeft(inv.dueDate);
      const cls = dl < 0 ? 'danger' : 'warn';
      const meta = dl < 0 ? `Quá hạn ${Math.abs(dl)} ngày (hạn ${fmtDate(inv.dueDate)})` : `Hạn: ${fmtDate(inv.dueDate)} · Còn ${dl} ngày`;
      dueCard = `<div class="due-card ${cls}"><div class="label">Cần thanh toán</div>
        <div class="amount">${vnd(remain)}</div><div class="meta">${meta}</div>
        <button class="t-btn" id="payNow">Thanh toán ngay</button></div>`;
    }
    const notis = buildNotifications();
    // nhắc hạn hợp đồng
    const c = d.contract;
    let ctWarn = '';
    if (c && c.end) {
      const dl = daysLeft(c.end);
      if (dl < 0) ctWarn = `<div class="t-err" style="background:var(--danger-bg);border-color:#fecaca"><span>⛔</span>
        <div><b>Hợp đồng đã hết hạn</b> ${fmtDate(c.end)}. Liên hệ chủ nhà để gia hạn.</div></div>`;
      else if (dl <= 30) ctWarn = `<div class="t-err" style="background:var(--warning-bg);border-color:#fde68a;color:#92400e"><span>⚠</span>
        <div><b>Hợp đồng sắp hết hạn</b> — còn ${dl} ngày (${fmtDate(c.end)}).</div></div>`;
    }
    // tiêu thụ kỳ gần nhất
    const usage = latestUsage();
    const usageCard = usage ? `<div class="t-card">
      <div class="t-section-head" style="margin-bottom:4px"><h3>Tiêu thụ ${esc(usage.label)}</h3>
        <a href="#/usage">Xem lịch sử →</a></div>
      <div class="t-row"><span class="k">⚡ Điện</span><span class="v mono">${num(usage.elec)} kWh</span></div>
      <div class="t-row"><span class="k">💧 Nước</span><span class="v mono">${num(usage.water)} m³</span></div>
    </div>` : '';

    const contractCardHtml = c ? contractCard(c) : '';
    shell('', `
      <div class="room-head"><div class="rname">Phòng ${esc(d.room.code || d.tenant.roomCode)}</div>
        <div class="bname">${esc(d.building.name || '')}</div></div>
      ${ctWarn}
      <div class="t-grid2">
        <div>
          ${dueCard}
          <div class="section-title">Truy cập nhanh</div>
          <div class="quick-grid" style="grid-template-columns:repeat(4,1fr)">
            <button class="quick-item" data-nav="#/invoices"><div class="qic" style="background:var(--info-bg)">🧾</div><div class="qlabel">Hóa đơn</div></button>
            <button class="quick-item" data-nav="#/readings"><div class="qic" style="background:var(--brand-50)">📷</div><div class="qlabel">Ghi chỉ số</div></button>
            <button class="quick-item" data-nav="#/repair"><div class="qic" style="background:var(--warning-bg)">🔧</div><div class="qlabel">Báo hỏng</div></button>
            <button class="quick-item" data-nav="#/chat"><div class="qic" style="background:var(--purple-bg)">💬</div><div class="qlabel">Trợ lý ảo</div></button>
          </div>
          ${usageCard}
        </div>
        <div>
          ${contractCardHtml}
          <div class="section-title">Thông báo gần đây</div>
          <div class="t-card">${notis || '<div style="color:var(--neutral-400);text-align:center;padding:8px">Chưa có thông báo</div>'}</div>
        </div>
      </div>
    `, { home: true, tab: 'home', deskTitle: 'Xin chào, ' + (d.tenant.fullName || '').split(' ').slice(-1)[0],
         deskSub: `Phòng ${d.room.code || d.tenant.roomCode} · ${d.building.name || ''}` });
    const pn = el('payNow'); if (pn) pn.onclick = () => go('#/pay/' + inv.id);
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  /* ---------- tính tiêu thụ ---------- */
  function usageList() {
    return (state.data.readings || []).filter(r => r.elecCurr != null || r.waterCurr != null)
      .map(r => ({
        period: r.period, label: vnPeriod(r.period),
        elec: (r.elecCurr != null && r.elecPrev != null) ? Math.max(0, r.elecCurr - r.elecPrev) : null,
        water: (r.waterCurr != null && r.waterPrev != null) ? Math.max(0, r.waterCurr - r.waterPrev) : null,
      })).sort((a, b) => (b.period || '').localeCompare(a.period || ''));
  }
  function latestUsage() { const l = usageList(); return l.length ? l[0] : null; }

  function buildNotifications() {
    const d = state.data; const items = [];
    const inv = (d.invoices || [])[0];
    if (inv) items.push({ t: `Hóa đơn ${CUR_PERIOD_LABEL} ${badgeText(inv.status)}`, time: fmtDate(inv.periodStart || inv.dueDate) });
    (d.incidents || []).slice(0, 2).forEach(x => items.push({ t: `Yêu cầu "${esc(x.title)}" · ${incStatusLabel(x.status)}`, time: fmtDate(x.createdAt) }));
    return items.map(i => `<div class="noti-item"><span class="dot"></span><div><div class="ntext">${i.t}</div><div class="ntime">${i.time}</div></div></div>`).join('');
  }
  const badgeText = (s) => (INV_STATUS[s] || ['', ''])[0];
  const incStatusLabel = (s) => ({ open: 'Chờ xử lý', processing: 'Đang xử lý', done: 'Đã hoàn tất' }[s] || s);

  /* ---------- màn hình: HÓA ĐƠN ---------- */
  function screenInvoices() {
    const rows = (state.data.invoices || []).map(i => {
      const remain = i.total - i.paid;
      return `<button class="inv-item" data-nav="#/invoice/${i.id}">
        <div><div style="font-weight:700">Hóa đơn ${vnPeriod(i.period)}</div>
          <div style="margin-top:4px">${badge(i.status)}</div></div>
        <div style="text-align:right"><div class="iamt">${vnd(i.total)}</div>
          ${remain > 0 ? `<div style="color:var(--danger);font-size:12px;font-weight:600">Còn ${vnd(remain)}</div>` : '<div style="color:var(--success);font-size:12px">Đã trả đủ</div>'}</div>
      </button>`;
    }).join('');
    const inv = state.data.invoices || [];
    const unpaidTotal = inv.reduce((s, i) => s + Math.max(0, i.total - i.paid), 0);
    const summary = inv.length ? `<div class="t-card" style="margin-bottom:14px">
      <div class="t-row"><span class="k">Còn phải thanh toán</span>
        <span class="v mono" style="color:${unpaidTotal > 0 ? 'var(--danger)' : 'var(--success)'}">${vnd(unpaidTotal)}</span></div>
      <div class="t-row tap" data-nav="#/history"><span class="k">Lịch sử thanh toán</span><span class="v">›</span></div>
    </div>` : '';
    shell('Hóa đơn', summary + (rows || `<div class="t-empty"><div class="eic">🧾</div><p>Chưa có hóa đơn nào</p></div>`), { tab: 'invoices' });
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }
  const vnPeriod = (p) => { if (!p) return ''; const [y, m] = p.split('-'); return 'T' + Number(m) + '/' + y; };

  /* ---------- màn hình: CHI TIẾT HÓA ĐƠN ---------- */
  function screenInvoiceDetail(id) {
    const inv = (state.data.invoices || []).find(i => i.id === id);
    if (!inv) { shell('Hóa đơn', `<div class="t-empty">Không tìm thấy hóa đơn</div>`); return; }
    const remain = inv.total - inv.paid;
    const lines = (inv.lines || []).map(l => `<div class="inv-line">
      <div><div class="lname">${esc(l.label)}</div>${l.meta ? `<div class="lbasis">${esc(l.meta)}</div>` : ''}</div>
      <div class="lamt">${vnd(l.amount)}</div></div>`).join('');
    shell('Chi tiết hóa đơn', `
      <div class="t-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div><div style="font-weight:800;font-size:18px">Hóa đơn ${vnPeriod(inv.period)}</div>
            <div style="color:var(--neutral-600);font-size:13px" class="mono">Phòng ${esc(state.data.room.code)}</div></div>
          ${badge(inv.status)}
        </div>
        <div class="mono" style="color:var(--neutral-600);font-size:13px;margin-bottom:8px">Kỳ ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)} · Hạn ${fmtDate(inv.dueDate)}</div>
        ${lines}
        <div class="inv-total"><span>Đã thanh toán</span><span class="mono" style="color:var(--success)">${vnd(inv.paid)}</span></div>
        <div class="inv-total"><span>Còn lại</span><span class="mono" style="color:${remain > 0 ? 'var(--danger)' : 'inherit'}">${vnd(remain)}</span></div>
        <div class="inv-total grand"><span>Tổng cộng</span><span class="mono">${vnd(inv.total)}</span></div>
      </div>
      ${remain > 0 ? `<button class="t-btn" id="pay">Thanh toán ${vnd(remain)}</button>` : ''}
    `);
    const p = el('pay'); if (p) p.onclick = () => go('#/pay/' + inv.id);
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  /* ---------- màn hình: THANH TOÁN ---------- */
  function screenPay(id) {
    const inv = (state.data.invoices || []).find(i => i.id === id) || currentUnpaid();
    if (!inv) { shell('Thanh toán', `<div class="t-empty"><div class="eic">✓</div><p>Không có khoản cần thanh toán</p></div>`); return; }
    const remain = inv.total - inv.paid;
    const content = payContent(inv);
    shell('Thanh toán', `
      <div style="text-align:center;margin-bottom:8px">
        <div style="color:var(--neutral-600)">Hóa đơn ${vnPeriod(inv.period)}</div>
        <div class="mono" style="font-size:28px;font-weight:800">${vnd(remain)}</div>
      </div>
      <div class="qr-box">
        <img class="qr-img" alt="Mã VietQR" src="${vietQrUrl(remain, content)}"
          onerror="this.outerHTML='<div class=&quot;qr-fallback&quot;></div>'">
        <div style="color:var(--neutral-600);font-size:14px">
          Quét mã bằng <b>app ngân hàng bất kỳ</b> — số tiền và nội dung tự điền sẵn.<br>
          <span style="color:var(--success);font-weight:600">Chuyển xong là hệ thống tự trừ công nợ.</span></div>
      </div>
      <div class="divider">hoặc</div>
      <div class="t-card">
        <div style="font-weight:700;margin-bottom:6px">Chuyển khoản thủ công</div>
        <div class="bank-row"><span class="bk">Ngân hàng</span><span class="bv">${BANK.name}</span></div>
        <div class="bank-row"><span class="bk">Số tài khoản</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${BANK.account}</span><button class="copybtn" data-copy="${BANK.account}" data-l="số tài khoản">📋</button></span></div>
        <div class="bank-row"><span class="bk">Chủ tài khoản</span><span class="bv">${BANK.holder}</span></div>
        <div class="bank-row"><span class="bk">Số tiền</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${num(remain)}</span><button class="copybtn" data-copy="${remain}" data-l="số tiền">📋</button></span></div>
        <div class="bank-row"><span class="bk">Nội dung</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${esc(content)}</span><button class="copybtn" data-copy="${esc(content)}" data-l="nội dung">📋</button></span></div>
      </div>
      <div class="t-note" style="margin-top:10px">Ghi <b>đúng nội dung</b> ở trên thì hệ thống nhận ra hóa đơn
        và tự xóa công nợ. Ghi khác thì chủ nhà phải đối soát tay, sẽ lâu hơn.</div>
      <button class="t-btn" id="paid" style="margin-top:6px">Tôi đã chuyển khoản</button>
    `);
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy, b.dataset.l));
    el('paid').onclick = () => { state.claim = { invoiceId: inv.id, amount: remain, note: content, photo: null }; go('#/proof'); };
  }

  /* ---------- màn hình: GỬI CHỨNG TỪ CHUYỂN KHOẢN ---------- */
  function screenProof() {
    const c = state.claim;
    if (!c) { go('#/home'); return; }
    const inv = (state.data.invoices || []).find(i => i.id === c.invoiceId);
    shell('Xác nhận chuyển khoản', `
      <div class="t-card">
        <div class="t-row"><span class="k">Hóa đơn</span><span class="v">${inv ? vnPeriod(inv.period) : esc(c.invoiceId)}</span></div>
        <div class="t-row"><span class="k">Phòng</span><span class="v">${esc(state.data.tenant.roomCode || '')}</span></div>
      </div>
      <div class="t-field"><label>Số tiền đã chuyển</label>
        <input class="t-input mono" id="pfAmount" inputmode="numeric" value="${num(c.amount)}"></div>
      <div class="t-field"><label>Nội dung / ghi chú</label>
        <input class="t-input" id="pfNote" value="${esc(c.note || '')}" placeholder="VD: đã CK lúc 9h sáng"></div>
      <div class="t-field"><label>Ảnh chứng từ <span style="color:var(--neutral-400);font-weight:400">(biên lai ngân hàng)</span></label>
        <div id="pfPhotoBox">
          <label class="photo-slot" style="width:100%;height:170px;border-radius:14px">
            <span style="text-align:center;color:var(--neutral-400)">📷<div style="font-size:13px;margin-top:6px">Chụp hoặc chọn ảnh biên lai</div></span>
            <input type="file" accept="image/*" id="pfPhoto" hidden></label>
        </div></div>
      <div class="t-hint" style="text-align:left">Chủ nhà sẽ đối chiếu và xác nhận. Hóa đơn được cập nhật sau khi chủ nhà xác nhận.</div>
      <button class="t-btn" id="pfSend" style="margin-top:14px">Gửi xác nhận</button>
    `);
    const drawPhoto = () => {
      const box = el('pfPhotoBox');
      box.innerHTML = c.photo
        ? `<div style="position:relative"><img src="${c.photo}" style="width:100%;border-radius:14px;border:1px solid var(--neutral-200)">
             <button id="pfDel" style="position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;
               background:rgba(0,0,0,.6);color:#fff;border:none;font-size:14px">✕</button></div>`
        : `<label class="photo-slot" style="width:100%;height:170px;border-radius:14px">
             <span style="text-align:center;color:var(--neutral-400)">📷<div style="font-size:13px;margin-top:6px">Chụp hoặc chọn ảnh biên lai</div></span>
             <input type="file" accept="image/*" id="pfPhoto" hidden></label>`;
      const inp = el('pfPhoto');
      if (inp) inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { c.photo = rd.result; drawPhoto(); };
        rd.readAsDataURL(f);
      };
      const del = el('pfDel'); if (del) del.onclick = () => { c.photo = null; drawPhoto(); };
    };
    drawPhoto();
    const amt = el('pfAmount');
    amt.oninput = () => { const n = parseInt((amt.value || '').replace(/\D/g, ''), 10); amt.value = n ? num(n) : ''; };
    el('pfSend').onclick = async (e) => {
      const amount = parseInt((amt.value || '').replace(/\D/g, ''), 10) || 0;
      if (!amount) { toast('Nhập số tiền đã chuyển'); return; }
      e.currentTarget.classList.add('loading');
      const note = el('pfNote').value.trim();
      try {
        await rpc('tenant_submit_payment_claim', { p_phone: state.phone, p_invoice_id: c.invoiceId,
          p_amount: amount, p_note: note, p_photo: c.photo });
        state.claim = null;
        toast('Đã gửi xác nhận cho chủ nhà');
        go('#/home');
      } catch (err) {
        // Máy chủ chưa có hàm mới -> vẫn báo cho chủ nhà theo cách cũ
        try {
          await rpc('tenant_notify_paid', { p_phone: state.phone, p_invoice_id: c.invoiceId });
          state.claim = null; toast('Đã báo chủ nhà (chưa gửi được ảnh)'); go('#/home');
        } catch (e2) {
          toast(e2.message === 'NOT_ACTIVATED' ? 'Chưa kích hoạt (cần chạy SQL)' : 'Không gửi được, thử lại');
          e.currentTarget.classList.remove('loading');
        }
      }
    };
  }

  /* ---------- màn hình: BÁO HỎNG ---------- */
  const CATS = [{ k: 'Điện', ic: '⚡' }, { k: 'Nước', ic: '💧' }, { k: 'Máy lạnh', ic: '❄️' }, { k: 'Khác', ic: '⋯' }];
  const TIMES = ['Sáng', 'Chiều', 'Tối', 'Bất kỳ'];
  function screenRepair() {
    const r = state.repair;
    shell('Báo hỏng', `
      <div class="t-field"><label>Hạng mục</label>
        <div class="cat-grid">${CATS.map(c => `<button class="cat-item ${r.cat === c.k ? 'sel' : ''}" data-cat="${c.k}"><div class="cic">${c.ic}</div><div class="clabel">${c.k}</div></button>`).join('')}</div>
      </div>
      <div class="t-field"><label>Mô tả sự cố</label><textarea class="t-textarea" id="desc" placeholder="Mô tả chi tiết sự cố bạn gặp...">${esc(r.desc || '')}</textarea></div>
      <div class="t-field"><label>Hình ảnh (tối đa 5)</label>
        <div class="photo-grid" id="photos">
          <label class="photo-slot">＋<input type="file" accept="image/*" id="photoInput" hidden></label>
        </div>
      </div>
      <div class="t-field"><label>Thời gian thuận tiện</label>
        <div class="radio-row">${TIMES.map(t => `<button class="radio-chip ${r.time === t ? 'sel' : ''}" data-time="${t}"><span>${r.time === t ? '●' : '○'}</span>${t}</button>`).join('')}</div>
      </div>
      <button class="t-btn" id="send">Gửi yêu cầu</button>
    `);
    document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { r.cat = b.dataset.cat; screenRepair(); });
    document.querySelectorAll('[data-time]').forEach(b => b.onclick = () => { r.time = b.dataset.time; screenRepair(); });
    el('desc').oninput = (e) => r.desc = e.target.value;
    renderPhotos();
    el('photoInput').onchange = (e) => {
      const f = e.target.files[0]; if (!f || r.photos.length >= 5) return;
      const rd = new FileReader(); rd.onload = () => { r.photos.push(rd.result); renderPhotos(); }; rd.readAsDataURL(f);
    };
    el('send').onclick = async (e) => {
      if (!r.cat) { toast('Vui lòng chọn hạng mục'); return; }
      if (!(r.desc || '').trim()) { toast('Vui lòng mô tả sự cố'); return; }
      e.currentTarget.classList.add('loading');
      const title = r.desc.trim();
      try {
        // Gửi kèm ảnh; nếu máy chủ chưa cập nhật hàm (chưa chạy migration) thì gửi không ảnh
        try {
          await rpc('tenant_create_incident', { p_phone: state.phone, p_category: r.cat, p_title: title, p_photos: r.photos });
        } catch (e1) {
          await rpc('tenant_create_incident', { p_phone: state.phone, p_category: r.cat, p_title: title });
        }
        state.data = await loadData(state.phone); // tải lại để có yêu cầu mới
        state.repair = { cat: null, time: 'Bất kỳ', photos: [] };
        toast('Đã gửi yêu cầu sửa chữa');
        go('#/track');
      } catch (err) {
        toast(err.message === 'NOT_ACTIVATED' ? 'Chưa kích hoạt (cần chạy SQL)' : 'Không gửi được, thử lại');
        e.currentTarget.classList.remove('loading');
      }
    };
    function renderPhotos() {
      const box = el('photos');
      const thumbs = r.photos.map((p, i) => `<div class="photo-slot filled"><img src="${p}"></div>`).join('');
      box.innerHTML = thumbs + (r.photos.length < 5 ? `<label class="photo-slot">＋<input type="file" accept="image/*" id="photoInput" hidden></label>` : '');
      const pin = el('photoInput'); if (pin) pin.onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { r.photos.push(rd.result); renderPhotos(); }; rd.readAsDataURL(f); };
    }
  }

  /* ---------- màn hình: THEO DÕI YÊU CẦU ---------- */
  function screenTrack() {
    const incs = state.data.incidents || [];
    const body = incs.length ? incs.map(x => {
      const steps = [
        { t: 'Đã tiếp nhận', done: true },
        { t: 'Đang xử lý', done: x.status === 'processing' || x.status === 'done', active: x.status === 'processing' },
        { t: 'Hoàn tất', done: x.status === 'done', active: false },
      ];
      return `<div class="t-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700">${esc(x.category)}: ${esc(x.title)}</div>
          <span class="t-badge ${x.status === 'done' ? 'success' : x.status === 'processing' ? 'info' : 'warning'}"><span class="d"></span>${incStatusLabel(x.status)}</span>
        </div>
        <div class="timeline">${steps.map(s => `<div class="tl-item ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}"><div class="tl-title">${s.t}</div><div class="tl-time">${s.done ? fmtDate(x.createdAt) : '—'}</div></div>`).join('')}</div>
      </div>`;
    }).join('') : `<div class="t-empty"><div class="eic">🔧</div><p>Chưa có yêu cầu nào</p><button class="t-btn" style="margin-top:16px;max-width:200px" id="newReq">Tạo yêu cầu</button></div>`;
    shell('Yêu cầu sửa chữa', body + (incs.length ? `<button class="t-btn outline" id="newReq" style="margin-top:6px">＋ Tạo yêu cầu mới</button>` : ''));
    const nr = el('newReq'); if (nr) nr.onclick = () => go('#/repair');
  }

  /* ---------- màn hình: GHI CHỈ SỐ ---------- */
  function screenReadings() {
    shell('Ghi chỉ số', `
      <p style="color:var(--neutral-600);margin-bottom:16px">Tự ghi chỉ số điện, nước kỳ <b>${CUR_PERIOD_LABEL}</b>. Chủ trọ sẽ đối chiếu & duyệt.</p>
      <div class="t-field"><label>⚡ Chỉ số điện (kWh)</label><input class="t-input mono" id="elec" inputmode="numeric" placeholder="VD: 12680"></div>
      <div class="t-field"><label>💧 Chỉ số nước (m³)</label><input class="t-input mono" id="water" inputmode="numeric" placeholder="VD: 48"></div>
      <div class="t-field"><label>Ảnh đồng hồ (tùy chọn)</label>
        <div class="photo-grid"><label class="photo-slot">📷<input type="file" accept="image/*" hidden></label></div></div>
      <button class="t-btn" id="submitR">Gửi chỉ số</button>
    `);
    el('submitR').onclick = async (e) => {
      const elec = parseInt((el('elec').value || '').replace(/\D/g, ''), 10);
      const water = parseInt((el('water').value || '').replace(/\D/g, ''), 10);
      if (!elec && !water) { toast('Nhập ít nhất một chỉ số'); return; }
      e.currentTarget.classList.add('loading');
      try {
        await rpc('tenant_submit_reading', { p_phone: state.phone, p_period: CUR_PERIOD, p_elec: elec || null, p_water: water || null });
        toast('Đã gửi chỉ số, chờ chủ trọ duyệt'); go('#/home');
      } catch (err) { toast(err.message === 'NOT_ACTIVATED' ? 'Chưa kích hoạt (cần chạy SQL)' : 'Không gửi được, thử lại'); e.currentTarget.classList.remove('loading'); }
    };
  }

  /* ---------- màn hình: PHÒNG CỦA TÔI ---------- */
  function screenRoom() {
    const d = state.data, r = d.room || {}, c = d.contract;
    const mates = d.roommates || [];
    const assets = d.assets || [];
    const ct = c ? contractCard(c) : '';
    shell('Phòng của tôi', `
      <div class="t-card">
        <div class="t-section-head"><h3>Phòng ${esc(r.code || d.tenant.roomCode)}</h3>
          ${r.typeLabel ? `<span class="t-badge info"><span class="d"></span>${esc(r.typeLabel)}</span>` : ''}</div>
        <div class="t-row"><span class="k">Tòa nhà</span><span class="v">${esc(d.building.name || '')}</span></div>
        <div class="t-row"><span class="k">Địa chỉ</span><span class="v" style="font-weight:500;font-size:13px">${esc(d.building.address || '—')}</span></div>
        <div class="t-row"><span class="k">Giá thuê</span><span class="v mono">${vnd(r.price)}</span></div>
        ${r.area ? `<div class="t-row"><span class="k">Diện tích</span><span class="v mono">${r.area} m²</span></div>` : ''}
        ${r.maxOccupants ? `<div class="t-row"><span class="k">Số người tối đa</span><span class="v">${r.maxOccupants}</span></div>` : ''}
      </div>
      ${ct}
      ${mates.length ? `<div class="t-card"><div class="t-section-head"><h3>Người ở cùng (${mates.length})</h3></div>
        ${mates.map(m => `<div class="t-row"><span class="k">${esc(m.fullName)}${m.isRep ? ' · <b>đại diện</b>' : ''}</span>
          <span class="v mono" style="font-size:13px">${esc(m.phone || '')}</span></div>`).join('')}</div>` : ''}
      ${assets.length ? `<div class="t-card"><div class="t-section-head"><h3>Tài sản trong phòng (${assets.length})</h3></div>
        <div class="t-chips">${assets.map(a => `<span class="t-chip ${a.condition === 'good' ? '' : esc(a.condition || '')}">
          ${a.icon || '📦'} ${esc(a.name)}${(a.quantity || 1) > 1 ? ' ×' + a.quantity : ''}</span>`).join('')}</div>
        <p style="color:var(--neutral-500);font-size:12px;margin-top:10px">Vui lòng giữ gìn tài sản. Hư hỏng do lỗi sử dụng sẽ bồi thường theo giá trị còn lại.</p></div>` : ''}
      <div class="t-card" style="padding:0;overflow:hidden">
        <button class="t-action" data-nav="#/usage"><span class="aic" style="background:var(--brand-50)">📊</span>Lịch sử điện nước<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/services"><span class="aic" style="background:var(--info-bg)">🛎️</span>Bảng giá dịch vụ<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/track"><span class="aic" style="background:var(--warning-bg)">🔧</span>Yêu cầu sửa chữa<span class="chev">›</span></button>
      </div>
    `, { tab: 'room' });
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  function contractCard(c) {
    const dl = c.end ? daysLeft(c.end) : null;
    const cls = dl == null ? '' : (dl < 0 ? 'danger' : (dl <= 30 ? 'warn' : ''));
    const meta = dl == null ? '' : (dl < 0 ? `Đã hết hạn ${Math.abs(dl)} ngày trước` : `Còn ${dl} ngày`);
    return `<div class="contract-card ${cls}">
        <div class="cc-label">Hợp đồng đến ngày</div>
        <div class="cc-date">${fmtDate(c.end)}</div>
        <div class="cc-meta">${meta}${c.rent ? ' · ' + vnd(c.rent) + '/tháng' : ''}</div>
        <button class="t-btn" style="background:rgba(255,255,255,.22);margin-top:12px" data-nav="#/contract">Xem hợp đồng & điều khoản</button>
      </div>`;
  }

  /* ---------- màn hình: HỢP ĐỒNG & ĐIỀU KHOẢN ---------- */
  const DEFAULT_TERMS = [
    { title: 'Mục đích thuê', body: 'Bên B thuê phòng của Bên A để làm nơi ở. Không sử dụng vào mục đích khác nếu không có sự đồng ý bằng văn bản của Bên A.' },
    { title: 'Tiền thuê và thanh toán', body: 'Tiền thuê được thanh toán hàng tháng theo kỳ ghi trong hợp đồng. Quá hạn thanh toán {dueDays} ngày, Bên A có quyền nhắc nhở và áp dụng biện pháp theo thỏa thuận.' },
    { title: 'Tiền đặt cọc', body: 'Bên B đặt cọc {deposit} để bảo đảm thực hiện hợp đồng. Tiền cọc được hoàn trả khi kết thúc hợp đồng sau khi trừ các khoản còn nợ và chi phí hư hỏng (nếu có).' },
    { title: 'Chi phí dịch vụ', body: 'Tiền điện, nước và các dịch vụ khác được tính theo chỉ số thực tế hoặc đơn giá niêm yết tại thời điểm sử dụng, thanh toán cùng kỳ tiền thuê.' },
    { title: 'Quyền và nghĩa vụ của Bên A (bên cho thuê)', body: 'Bàn giao phòng đúng hiện trạng thỏa thuận; bảo đảm quyền sử dụng ổn định cho Bên B; sửa chữa hư hỏng do kết cấu công trình hoặc hao mòn tự nhiên.' },
    { title: 'Quyền và nghĩa vụ của Bên B (bên thuê)', body: 'Thanh toán đầy đủ, đúng hạn; giữ gìn tài sản trong phòng; không tự ý sửa chữa, cải tạo khi chưa được đồng ý; không chuyển nhượng lại phòng cho người khác.' },
    { title: 'Sử dụng tài sản trong phòng', body: 'Bên B có trách nhiệm bảo quản tài sản đã nhận bàn giao. Hư hỏng do lỗi của Bên B thì Bên B bồi thường theo giá trị còn lại của tài sản.' },
    { title: 'An ninh, trật tự và phòng cháy chữa cháy', body: 'Bên B tuân thủ nội quy nhà trọ, giữ gìn an ninh trật tự, vệ sinh chung, chấp hành quy định về phòng cháy chữa cháy và đăng ký tạm trú theo quy định pháp luật.' },
    { title: 'Chấm dứt hợp đồng trước hạn', body: 'Bên muốn chấm dứt hợp đồng trước hạn phải báo trước ít nhất 30 ngày. Trường hợp Bên B tự ý chấm dứt không báo trước, Bên A có quyền khấu trừ tiền cọc theo thỏa thuận.' },
    { title: 'Điều khoản chung', body: 'Hai bên cam kết thực hiện đúng các điều khoản. Mọi thay đổi phải được lập thành văn bản có chữ ký hai bên. Tranh chấp được giải quyết trên tinh thần thương lượng, nếu không được thì đưa ra cơ quan có thẩm quyền.' },
  ];
  function screenContract() {
    const c = state.data.contract;
    if (!c) { shell('Hợp đồng', `<div class="t-empty"><div class="eic">📄</div><p>Chưa có thông tin hợp đồng</p>
      <p style="font-size:13px">Liên hệ chủ nhà để được cung cấp.</p></div>`); return; }
    const src = (c.terms && c.terms.length) ? c.terms : DEFAULT_TERMS;
    const terms = src.map(t => ({ title: t.title, body: (t.body || '')
      .replace('{deposit}', vnd(c.deposit)).replace('{rent}', vnd(c.rent)).replace('{dueDays}', c.dueDays || 5) }));
    shell('Hợp đồng & điều khoản', `
      ${contractCard(c)}
      <div class="t-card">
        <div class="t-section-head"><h3>Thông tin hợp đồng</h3></div>
        <div class="t-row"><span class="k">Phòng</span><span class="v">${esc(state.data.room.code || '')}</span></div>
        <div class="t-row"><span class="k">Giá thuê</span><span class="v mono">${vnd(c.rent)}</span></div>
        <div class="t-row"><span class="k">Tiền cọc</span><span class="v mono">${vnd(c.deposit)}</span></div>
        <div class="t-row"><span class="k">Ngày bắt đầu</span><span class="v mono">${fmtDate(c.start)}</span></div>
        <div class="t-row"><span class="k">Ngày kết thúc</span><span class="v mono">${fmtDate(c.end)}</span></div>
        ${c.billingDay ? `<div class="t-row"><span class="k">Ngày chốt hóa đơn</span><span class="v">Ngày ${c.billingDay}</span></div>` : ''}
        ${c.dueDays ? `<div class="t-row"><span class="k">Hạn thanh toán</span><span class="v">${c.dueDays} ngày sau chốt</span></div>` : ''}
      </div>
      <div class="t-card">
        <div class="t-section-head"><h3>Điều khoản (${terms.length})</h3></div>
        ${terms.map((t, i) => `<div class="term-item"><div class="tt">Điều ${i + 1}. ${esc(t.title)}</div>
          <div class="tb">${esc(t.body)}</div></div>`).join('')}
      </div>`);
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  /* ---------- màn hình: LỊCH SỬ ĐIỆN NƯỚC ---------- */
  function screenUsage() {
    const list = usageList();
    if (!list.length) { shell('Lịch sử điện nước', `<div class="t-empty"><div class="eic">📊</div><p>Chưa có dữ liệu chỉ số</p></div>`); return; }
    const recent = list.slice(0, 6).reverse();
    const maxE = Math.max(1, ...recent.map(x => x.elec || 0));
    const maxW = Math.max(1, ...recent.map(x => x.water || 0));
    const bars = (key, cls, max) => recent.map(x => `<div class="usage-col">
      <div class="val">${x[key] != null ? num(x[key]) : ''}</div>
      <div class="usage-bar ${cls}" style="height:${Math.round(((x[key] || 0) / max) * 78)}%"></div>
      <div class="cap">${esc(x.label)}</div></div>`).join('');
    shell('Lịch sử điện nước', `
      <div class="t-card"><div class="t-section-head"><h3>⚡ Điện (kWh)</h3></div>
        <div class="usage-chart">${bars('elec', '', maxE)}</div></div>
      <div class="t-card"><div class="t-section-head"><h3>💧 Nước (m³)</h3></div>
        <div class="usage-chart">${bars('water', 'water', maxW)}</div></div>
      <div class="t-card"><div class="t-section-head"><h3>Chi tiết theo kỳ</h3></div>
        ${list.map(x => `<div class="t-row"><span class="k">${esc(x.label)}</span>
          <span class="v mono" style="font-size:13px">⚡ ${x.elec != null ? num(x.elec) : '—'} · 💧 ${x.water != null ? num(x.water) : '—'}</span></div>`).join('')}
      </div>`);
  }

  /* ---------- màn hình: BẢNG GIÁ DỊCH VỤ ---------- */
  function screenServices() {
    const svcs = state.data.services || [];
    const method = { per_kwh: 'Theo chỉ số điện', per_person: 'Theo số người', flat: 'Cố định theo tháng' };
    shell('Bảng giá dịch vụ', svcs.length ? `<div class="t-card">
        <div class="t-row"><span class="k">Tiền phòng</span><span class="v mono">${vnd(state.data.room.price)}/tháng</span></div>
        ${svcs.map(s => `<div class="t-row"><span class="k">${esc(s.name)}<div style="font-size:11px;color:var(--neutral-400)">${esc(method[s.method] || '')}</div></span>
          <span class="v mono">${num(s.unit)} ${esc((s.unitLabel || '').replace('₫', 'đ'))}</span></div>`).join('')}
      </div>
      <p style="color:var(--neutral-500);font-size:12px;text-align:center">Đơn giá do chủ nhà niêm yết, áp dụng cho kỳ hiện hành.</p>`
      : `<div class="t-empty"><div class="eic">🛎️</div><p>Chưa có bảng giá dịch vụ</p></div>`);
  }

  /* ---------- màn hình: LỊCH SỬ THANH TOÁN ---------- */
  function screenPayHistory() {
    const pays = state.data.payments || [];
    shell('Lịch sử thanh toán', pays.length ? `
      <div class="t-card"><div class="t-section-head"><h3>Tổng đã thanh toán</h3></div>
        <div class="mono" style="font-size:26px;font-weight:800;color:var(--success)">${vnd(pays.reduce((s, p) => s + p.amount, 0))}</div>
        <div style="color:var(--neutral-500);font-size:13px">${pays.length} lần thanh toán</div></div>
      <div class="t-card">${pays.map(p => `<div class="t-row">
        <span class="k"><b style="color:var(--neutral-900)">${fmtDate(p.date)}</b>
          <div style="font-size:12px">${esc(p.method || '')}${p.invoiceId ? ' · ' + esc(p.invoiceId) : ''}</div></span>
        <span class="v mono" style="color:var(--success)">+${vnd(p.amount)}</span></div>`).join('')}</div>`
      : `<div class="t-empty"><div class="eic">💳</div><p>Chưa có lịch sử thanh toán</p></div>`);
  }

  /* ---------- màn hình: TÀI KHOẢN ---------- */
  function screenAccount() {
    const t = state.data.tenant, b = state.data.building;
    shell('Tài khoản', `
      <div class="t-profile">
        <div class="t-avatar">${esc((t.fullName || '?').trim().split(/\s+/).slice(-1)[0][0] || '?')}</div>
        <div class="pname">${esc(t.fullName)}</div>
        <div class="psub">Phòng ${esc(t.roomCode || '')} · ${esc(b.name || '')}</div>
        ${t.isRep ? '<div style="margin-top:6px"><span class="t-badge success"><span class="d"></span>Đại diện hợp đồng</span></div>' : ''}
      </div>
      <div class="t-card">
        <div class="t-section-head"><h3>Thông tin cá nhân</h3></div>
        <div class="t-row"><span class="k">Số điện thoại</span><span class="v mono">${esc(t.phone || '')}</span></div>
        ${t.idNumber ? `<div class="t-row"><span class="k">Số CCCD</span><span class="v mono">${esc(t.idNumber)}</span></div>` : ''}
        ${t.dob ? `<div class="t-row"><span class="k">Ngày sinh</span><span class="v mono">${esc(t.dob)}</span></div>` : ''}
        ${t.gender ? `<div class="t-row"><span class="k">Giới tính</span><span class="v">${esc(t.gender)}</span></div>` : ''}
        ${t.vehiclePlate ? `<div class="t-row"><span class="k">Biển số xe</span><span class="v mono">${esc(t.vehiclePlate)}</span></div>` : ''}
        <div class="t-row"><span class="k">Tạm trú</span><span class="v">${t.tamtru
          ? '<span class="t-badge success"><span class="d"></span>Đã đăng ký</span>'
          : '<span class="t-badge warning"><span class="d"></span>Chưa đăng ký</span>'}</span></div>
      </div>
      <div class="t-card" style="padding:0;overflow:hidden">
        <button class="t-action" data-nav="#/history"><span class="aic" style="background:var(--success-bg)">💳</span>Lịch sử thanh toán<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/contract"><span class="aic" style="background:var(--brand-50)">📄</span>Hợp đồng & điều khoản<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/track"><span class="aic" style="background:var(--warning-bg)">🔧</span>Yêu cầu sửa chữa<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/chat"><span class="aic" style="background:var(--purple-bg)">💬</span>Trợ lý ảo<span class="chev">›</span></button>
        <button class="t-action" id="helpBtn"><span class="aic" style="background:var(--info-bg)">❓</span>Hướng dẫn sử dụng<span class="chev">›</span></button>
      </div>
      <div class="t-card" style="padding:0;overflow:hidden">
        <button class="t-action danger" id="logoutBtn"><span class="aic" style="background:var(--danger-bg)">⎋</span>Đăng xuất<span class="chev">›</span></button>
      </div>
      <p style="text-align:center;color:var(--neutral-400);font-size:12px;margin-top:12px">Happy Home · App khách thuê</p>
    `, { tab: 'account' });
    document.querySelectorAll('[data-nav]').forEach(x => x.onclick = () => go(x.dataset.nav));
    el('helpBtn').onclick = () => alert('• Trang chủ: xem tiền cần đóng và hạn thanh toán\n• Hóa đơn: xem chi tiết từng khoản\n• Phòng của tôi: hợp đồng, điều khoản, tài sản, bảng giá\n• Ghi chỉ số: tự gửi số điện/nước cho chủ nhà\n• Báo hỏng: gửi yêu cầu sửa chữa và theo dõi tiến độ');
    el('logoutBtn').onclick = () => {
      if (!confirm('Đăng xuất khỏi ứng dụng?')) return;
      try { localStorage.removeItem(PHONE_KEY); } catch (e) {}
      state.phone = null; state.data = null; go('#/login');
    };
  }

  /* ============================================================
     TRỢ LÝ ẢO (Phần V)
     Ràng buộc an toàn:
     - Danh tính lấy từ phiên đăng nhập (state.phone đã được máy chủ xác thực),
       KHÔNG lấy từ nội dung tin nhắn.
     - Trợ lý CHỈ đọc dữ liệu; không sửa hóa đơn/thanh toán.
     - Không đoán khi không có dữ liệu — trả lời trung thực và chuyển tiếp.
     ============================================================ */
  const chat = { msgs: [], busy: false };

  const SUGGESTIONS = [
    'Tháng này tôi đóng bao nhiêu?',
    'Hạn đóng tiền khi nào?',
    'Tiền điện nước tháng này',
    'Hợp đồng của tôi',
    'Báo hỏng thiết bị',
    'Thông tin chuyển khoản',
  ];

  const norm = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const hasAny = (t, arr) => arr.some(k => t.includes(k));

  function pushMsg(who, html, actions, byAi) {
    chat.msgs.push({ who, html, actions: actions || [], ai: !!byAi });
  }

  /** Bộ hiểu ý định — trả lời DỰA TRÊN dữ liệu thật của khách đang đăng nhập */
  function answer(text) {
    const t = norm(text);
    const d = state.data;
    const inv = currentUnpaid();
    const c = d.contract;

    // 1) Chào hỏi
    if (hasAny(t, ['xin chao', 'chao ', 'hello', 'hi ', 'alo']) && t.length < 20)
      return { html: `Chào anh/chị <b>${esc(d.tenant.fullName)}</b>! Em có thể giúp gì cho phòng <b>${esc(d.tenant.roomCode || '')}</b> ạ?`,
        actions: [{ label: 'Tiền tháng này', send: 'Tháng này tôi đóng bao nhiêu?' },
                  { label: 'Báo hỏng', go: '#/repair' }] };

    // 2) Số tiền phải đóng / hóa đơn — kèm BẢNG PHÂN TÍCH
    if (hasAny(t, ['bao nhieu', 'tien phong', 'hoa don', 'phai dong', 'phai tra', 'thanh toan bao nhieu', 'no bao nhieu', 'cong no'])) {
      if (!inv) return { html: `Hiện anh/chị <b>không còn khoản nào phải thanh toán</b>. Cảm ơn anh/chị đã đóng đầy đủ ạ! ✓`,
        actions: [{ label: 'Xem lịch sử hóa đơn', go: '#/invoices' }] };
      const remain = inv.total - inv.paid;
      const rows = (inv.lines || []).map(l => `<tr><td>${esc(l.label)}</td><td>${vnd(l.amount)}</td></tr>`).join('');
      const dl = daysLeft(inv.dueDate);
      return {
        html: `<div class="b-title">Hóa đơn ${vnPeriod(inv.period)}</div>
          <table>${rows}<tr class="sum"><td>Tổng cộng</td><td>${vnd(inv.total)}</td></tr>
          ${inv.paid > 0 ? `<tr><td>Đã thanh toán</td><td>−${vnd(inv.paid)}</td></tr>
            <tr class="sum"><td>Còn phải đóng</td><td>${vnd(remain)}</td></tr>` : ''}</table>
          <div class="b-note">Hạn: <b>${fmtDate(inv.dueDate)}</b> · ${dl < 0
            ? `<span class="b-warn">đã quá hạn ${Math.abs(dl)} ngày</span>` : `còn ${dl} ngày`}</div>`,
        actions: [{ label: 'Xem chi tiết', go: '#/invoice/' + inv.id },
                  { label: 'Thanh toán', go: '#/pay/' + inv.id, solid: true }] };
    }

    // 3) Hạn đóng tiền
    if (hasAny(t, ['han dong', 'khi nao', 'han thanh toan', 'bao gio', 'deadline', 'han cuoi'])) {
      if (!inv) return { html: 'Hiện chưa có hóa đơn nào đang chờ thanh toán ạ.', actions: [{ label: 'Xem hóa đơn', go: '#/invoices' }] };
      const dl = daysLeft(inv.dueDate);
      return { html: `Hóa đơn <b>${vnPeriod(inv.period)}</b> có hạn thanh toán ngày <b>${fmtDate(inv.dueDate)}</b>.<br>
        ${dl < 0 ? `<span class="b-warn">Đã quá hạn ${Math.abs(dl)} ngày</span> — anh/chị vui lòng thanh toán sớm giúp em ạ.`
                 : `Còn <b>${dl} ngày</b> nữa ạ.`}`,
        actions: [{ label: 'Thanh toán ngay', go: '#/pay/' + inv.id, solid: true }] };
    }

    // 4) Điện nước / tiêu thụ
    if (hasAny(t, ['dien nuoc', 'tien dien', 'tien nuoc', 'chi so', 'tieu thu', 'so dien', 'so nuoc', 'kwh'])) {
      const u = latestUsage();
      if (!u) return { html: 'Em chưa thấy dữ liệu chỉ số điện nước của phòng mình. Anh/chị có thể tự gửi chỉ số để chủ nhà duyệt ạ.',
        actions: [{ label: 'Gửi chỉ số', go: '#/readings', solid: true }] };
      const eLine = (inv && (inv.lines || []).find(l => l.type === 'elec' || /điện/i.test(l.label)));
      const wLine = (inv && (inv.lines || []).find(l => /nước/i.test(l.label)));
      return { html: `<div class="b-title">Tiêu thụ ${esc(u.label)}</div>
        <table>
          <tr><td>⚡ Điện</td><td>${u.elec != null ? num(u.elec) + ' kWh' : '—'}</td></tr>
          ${eLine ? `<tr><td>Tiền điện</td><td>${vnd(eLine.amount)}</td></tr>` : ''}
          <tr><td>💧 Nước</td><td>${u.water != null ? num(u.water) + ' m³' : '—'}</td></tr>
          ${wLine ? `<tr><td>Tiền nước</td><td>${vnd(wLine.amount)}</td></tr>` : ''}
        </table>
        <div class="b-note">Số liệu lấy từ chỉ số chủ nhà đã ghi.</div>`,
        actions: [{ label: 'Lịch sử điện nước', go: '#/usage' }, { label: 'Bảng giá', go: '#/services' }] };
    }

    // 5) Hợp đồng
    if (hasAny(t, ['hop dong', 'het han', 'gia han', 'dieu khoan', 'thoi han thue'])) {
      if (!c) return { html: 'Em chưa thấy thông tin hợp đồng của phòng mình trên hệ thống. Anh/chị vui lòng liên hệ chủ nhà ạ.',
        actions: [{ label: 'Liên hệ chủ nhà', act: 'contact' }] };
      const dl = c.end ? daysLeft(c.end) : null;
      return { html: `<div class="b-title">Hợp đồng phòng ${esc(d.tenant.roomCode || '')}</div>
        <table>
          <tr><td>Giá thuê</td><td>${vnd(c.rent)}</td></tr>
          <tr><td>Tiền cọc</td><td>${vnd(c.deposit)}</td></tr>
          <tr><td>Từ ngày</td><td>${fmtDate(c.start)}</td></tr>
          <tr><td>Đến ngày</td><td>${fmtDate(c.end)}</td></tr>
        </table>
        ${dl != null ? `<div class="b-note">${dl < 0
          ? `<span class="b-warn">Hợp đồng đã hết hạn ${Math.abs(dl)} ngày</span> — vui lòng liên hệ chủ nhà để gia hạn.`
          : (dl <= 30 ? `<span class="b-warn">Sắp hết hạn — còn ${dl} ngày.</span>` : `Còn <b>${dl} ngày</b>.`)}</div>` : ''}`,
        actions: [{ label: 'Xem điều khoản', go: '#/contract' }] };
    }

    // 6) Báo hỏng -> THẺ XÁC NHẬN trước khi tạo phiếu
    if (hasAny(t, ['bao hong', 'hu ', 'hong ', 'sua chua', 'sua giup', 'khong len', 'khong chay', 'ro ri', 'chap dien', 'mat dien', 'mat nuoc', 'tac ', 'bi hu'])) {
      // Ưu tiên thiết bị cụ thể trước (VD "máy lạnh chảy nước" phải là Máy lạnh, không phải Nước)
      const cat = hasAny(t, ['may lanh', 'dieu hoa', 'khong mat']) ? 'Máy lạnh'
        : hasAny(t, ['chap dien', 'o cam', 'bong den', 'mat dien', 'cup dien', 'aptomat', 'dien']) ? 'Điện'
        : hasAny(t, ['nuoc', 'voi ', 'ro ri', 'bon cau', 'tac ', 'nghet']) ? 'Nước'
        : 'Khác';
      const title = text.trim().replace(/^(cho|giup|toi|minh|em|anh|chi)\s+/i, '');
      return { html: `Em sẽ tạo <b>yêu cầu sửa chữa</b> với nội dung:<br>
        <div style="background:var(--neutral-100);padding:10px 12px;border-radius:10px;margin:8px 0">
          <b>${esc(cat)}</b><br>"${esc(title)}"</div>
        Anh/chị xác nhận giúp em ạ?`,
        actions: [{ label: 'Xác nhận gửi', act: 'mkincident', data: { cat, title }, solid: true },
                  { label: 'Sửa lại', go: '#/repair' }] };
    }

    // 7) Thanh toán / chuyển khoản
    if (hasAny(t, ['chuyen khoan', 'ngan hang', 'stk', 'so tai khoan', 'qr', 'tra tien', 'dong tien o dau', 'thanh toan the nao'])) {
      return { html: `Anh/chị có thể thanh toán bằng <b>mã QR</b> hoặc <b>chuyển khoản</b>:
        <table>
          <tr><td>Ngân hàng</td><td>${esc(BANK.name)}</td></tr>
          <tr><td>Số tài khoản</td><td>${esc(BANK.account)}</td></tr>
          <tr><td>Chủ tài khoản</td><td>${esc(BANK.holder)}</td></tr>
        </table>
        <div class="b-note">Nội dung ghi đúng: <b>${esc(payContent(inv) || d.tenant.roomCode || '')}</b> — ghi đúng thì hệ thống tự trừ công nợ.</div>`,
        actions: inv ? [{ label: 'Mở trang thanh toán', go: '#/pay/' + inv.id, solid: true }] : [] };
    }

    // 8) Bảng giá dịch vụ
    if (hasAny(t, ['gia dich vu', 'don gia', 'bang gia', 'gia dien', 'gia nuoc', 'phi rac', 'internet bao nhieu'])) {
      const svcs = d.services || [];
      if (!svcs.length) return { html: 'Em chưa có bảng giá dịch vụ trên hệ thống. Anh/chị vui lòng hỏi chủ nhà ạ.',
        actions: [{ label: 'Liên hệ chủ nhà', act: 'contact' }] };
      return { html: `<div class="b-title">Bảng giá dịch vụ</div><table>
        <tr><td>Tiền phòng</td><td>${vnd(d.room.price)}</td></tr>
        ${svcs.map(s => `<tr><td>${esc(s.name)}</td><td>${num(s.unit)} ${esc((s.unitLabel || '').replace('₫', 'đ'))}</td></tr>`).join('')}
        </table>`, actions: [{ label: 'Xem đầy đủ', go: '#/services' }] };
    }

    // 9) Tài sản trong phòng
    if (hasAny(t, ['tai san', 'do dac', 'thiet bi', 'trong phong co gi', 'noi that'])) {
      const a = d.assets || [];
      if (!a.length) return { html: 'Phòng mình chưa có danh sách tài sản trên hệ thống ạ.' };
      return { html: `Phòng <b>${esc(d.tenant.roomCode)}</b> có <b>${a.length}</b> tài sản:<br>
        ${a.map(x => `• ${esc(x.name)}${(x.quantity || 1) > 1 ? ' ×' + x.quantity : ''}`).join('<br>')}
        <div class="b-note">Vui lòng giữ gìn giúp em ạ.</div>`,
        actions: [{ label: 'Xem phòng của tôi', go: '#/room' }] };
    }

    // 10) Liên hệ chủ nhà
    if (hasAny(t, ['lien he', 'so dien thoai chu', 'goi chu', 'chu nha', 'chu tro', 'gap ai'])) {
      return { html: 'Em kết nối anh/chị với chủ nhà nhé.', actions: [{ label: 'Liên hệ chủ nhà', act: 'contact', solid: true }] };
    }

    // 11) Lịch sử thanh toán
    if (hasAny(t, ['da dong', 'lich su', 'bien lai', 'phieu thu', 'da tra'])) {
      const p = d.payments || [];
      if (!p.length) return { html: 'Em chưa thấy lịch sử thanh toán nào ạ.' };
      const total = p.reduce((s, x) => s + x.amount, 0);
      return { html: `Anh/chị đã thanh toán <b>${vnd(total)}</b> qua <b>${p.length}</b> lần.<br>
        Gần nhất: <b>${vnd(p[0].amount)}</b> ngày ${fmtDate(p[0].date)}.`,
        actions: [{ label: 'Xem lịch sử', go: '#/history' }] };
    }

    // 12) Không hiểu -> để tầng AI xử lý (nếu có), sau đó mới chuyển cho quản lý
    return { html: null, forward: text };
  }

  /* ============================================================
     TẦNG 2 — GEMINI FLASH (chỉ chạy khi luật từ khóa ở trên không nhận ra ý định)
     Mô hình CHỈ làm 2 việc: (a) phân loại ý định, (b) soạn lời văn từ số thật.
     Số liệu luôn do code lấy từ dữ liệu của CHÍNH khách đang đăng nhập
     (state.data — máy chủ trả về theo state.phone đã xác thực), không phải do mô hình nghĩ ra.
     ============================================================ */
  const T_INTENTS = [
    { key: 'invoice', desc: 'Số tiền phải đóng, chi tiết hóa đơn, còn nợ bao nhiêu' },
    { key: 'due', desc: 'Hạn đóng tiền, còn bao nhiêu ngày, đóng trễ thì sao' },
    { key: 'utilities', desc: 'Điện nước: số kWh, số khối, tiền điện tiền nước' },
    { key: 'contract', desc: 'Hợp đồng: giá thuê, tiền cọc, ngày bắt đầu/kết thúc, gia hạn' },
    { key: 'terms', desc: 'Điều khoản, nội quy, quy định của hợp đồng' },
    { key: 'payinfo', desc: 'Cách thanh toán, số tài khoản ngân hàng, mã QR' },
    { key: 'history', desc: 'Lịch sử đã thanh toán, biên lai, phiếu thu' },
    { key: 'prices', desc: 'Bảng giá dịch vụ: giá điện, giá nước, phí rác, internet' },
    { key: 'assets', desc: 'Tài sản, đồ đạc, thiết bị có trong phòng' },
    { key: 'room', desc: 'Thông tin phòng: diện tích, giá, tầng, người ở cùng' },
    { key: 'repair', desc: 'Báo hỏng, yêu cầu sửa chữa, theo dõi tiến độ sửa' },
    { key: 'contact', desc: 'Liên hệ chủ nhà, số điện thoại quản lý' },
  ];

  /* Lấy SỐ THẬT cho từng ý định — đây là dữ liệu duy nhất mô hình được dùng */
  function tenantFacts(key) {
    const d = state.data, inv = currentUnpaid(), c = d.contract, u = latestUsage();
    const base = { họ_tên: d.tenant.fullName, phòng: d.tenant.roomCode || '' };
    switch (key) {
      case 'invoice':
        if (!inv) return { ...base, còn_phải_đóng: '0 ₫', ghi_chú: 'Khách đã thanh toán đầy đủ, không còn khoản nào' };
        return { ...base, kỳ: vnPeriod(inv.period), tổng_hóa_đơn: vnd(inv.total),
          đã_thanh_toán: vnd(inv.paid), còn_phải_đóng: vnd(inv.total - inv.paid),
          hạn_thanh_toán: fmtDate(inv.dueDate), còn_lại_ngày: daysLeft(inv.dueDate),
          các_khoản: (inv.lines || []).map(l => ({ khoản: l.label, tiền: vnd(l.amount), mô_tả: l.meta || null })) };
      case 'due':
        if (!inv) return { ...base, ghi_chú: 'Không có hóa đơn nào đang chờ thanh toán' };
        return { ...base, kỳ: vnPeriod(inv.period), hạn_thanh_toán: fmtDate(inv.dueDate),
          còn_lại_ngày: daysLeft(inv.dueDate), số_tiền: vnd(inv.total - inv.paid) };
      case 'utilities':
        if (!u) return { ...base, ghi_chú: 'Chưa có chỉ số điện nước nào được ghi cho phòng này' };
        return { ...base, kỳ: u.label, điện_kWh: u.elec, nước_m3: u.water,
          tiền_điện: inv ? (((inv.lines || []).find(l => l.type === 'elec' || /điện/i.test(l.label)) || {}).amount != null
            ? vnd((inv.lines.find(l => l.type === 'elec' || /điện/i.test(l.label))).amount) : null) : null,
          tiền_nước: inv ? (((inv.lines || []).find(l => /nước/i.test(l.label)) || {}).amount != null
            ? vnd((inv.lines.find(l => /nước/i.test(l.label))).amount) : null) : null };
      case 'contract':
      case 'terms':
        if (!c) return { ...base, ghi_chú: 'Chưa có thông tin hợp đồng trên hệ thống' };
        return { ...base, giá_thuê: vnd(c.rent), tiền_cọc: vnd(c.deposit),
          từ_ngày: fmtDate(c.start), đến_ngày: fmtDate(c.end),
          còn_lại_ngày: c.end ? daysLeft(c.end) : null,
          điều_khoản: key === 'terms' ? (c.terms && c.terms.length ? c.terms : DEFAULT_TERMS) : undefined };
      case 'payinfo':
        return { ...base, ngân_hàng: BANK.name, số_tài_khoản: BANK.account, chủ_tài_khoản: BANK.holder,
          nội_dung_chuyển_khoản: payContent(inv) || (d.tenant.roomCode || ''),
          số_tiền_cần_chuyển: inv ? vnd(inv.total - inv.paid) : '0 ₫' };
      case 'history': {
        const p = d.payments || [];
        return { ...base, số_lần_đã_đóng: p.length, tổng_đã_đóng: vnd(p.reduce((s, x) => s + x.amount, 0)),
          gần_nhất: p.length ? { số_tiền: vnd(p[0].amount), ngày: fmtDate(p[0].date) } : null };
      }
      case 'prices':
        return { ...base, tiền_phòng: vnd(d.room && d.room.price),
          dịch_vụ: (d.services || []).map(s => ({ tên: s.name, đơn_giá: num(s.unit) + ' ' + (s.unitLabel || '') })) };
      case 'assets':
        return { ...base, số_tài_sản: (d.assets || []).length,
          danh_sách: (d.assets || []).map(a => a.name + ((a.quantity || 1) > 1 ? ' ×' + a.quantity : '')) };
      case 'room':
        return { ...base, diện_tích: d.room && d.room.area ? d.room.area + ' m²' : null,
          tầng: d.room && d.room.floor, giá_thuê: vnd(d.room && d.room.price),
          người_ở_cùng: (d.roommates || []).map(r => r.fullName) };
      case 'repair': {
        const inc = d.incidents || [];
        return { ...base, số_yêu_cầu_đã_gửi: inc.length,
          đang_xử_lý: inc.filter(x => x.status !== 'done').length,
          danh_sách: inc.slice(0, 5).map(x => ({ nội_dung: x.title, trạng_thái: x.status, ngày: fmtDate(x.createdAt) })) };
      }
      case 'contact':
        return { ...base, tên_tòa_nhà: d.building && d.building.name,
          số_điện_thoại_quản_lý: (d.building && d.building.contactPhone) || null };
      default:
        return base;
    }
  }

  const T_ACTIONS = {
    invoice: (inv) => inv ? [{ label: 'Xem chi tiết', go: '#/invoice/' + inv.id }, { label: 'Thanh toán', go: '#/pay/' + inv.id, solid: true }] : [],
    due: (inv) => inv ? [{ label: 'Thanh toán ngay', go: '#/pay/' + inv.id, solid: true }] : [],
    utilities: () => [{ label: 'Lịch sử điện nước', go: '#/usage' }],
    contract: () => [{ label: 'Xem hợp đồng', go: '#/contract' }],
    terms: () => [{ label: 'Xem điều khoản', go: '#/contract' }],
    payinfo: (inv) => inv ? [{ label: 'Mở trang thanh toán', go: '#/pay/' + inv.id, solid: true }] : [],
    history: () => [{ label: 'Xem lịch sử', go: '#/history' }],
    prices: () => [{ label: 'Bảng giá đầy đủ', go: '#/services' }],
    assets: () => [{ label: 'Phòng của tôi', go: '#/room' }],
    room: () => [{ label: 'Phòng của tôi', go: '#/room' }],
    repair: () => [{ label: 'Báo hỏng', go: '#/repair', solid: true }, { label: 'Theo dõi', go: '#/track' }],
    contact: () => [{ label: 'Liên hệ chủ nhà', act: 'contact', solid: true }],
  };

  /** Trả lời bằng Gemini. Trả về null nếu không dùng được -> chuyển cho quản lý. */
  async function aiAnswer(text) {
    const G = window.HHGemini;
    if (!G || !G.configured()) return null;
    try {
      const ck = 't|' + norm(text);
      const cls = G.cacheGet(ck) || await G.classify(text, T_INTENTS);
      G.cacheSet(ck, cls);
      if (cls.intent === 'unknown' || cls.confidence < 0.35 || !T_INTENTS.some(i => i.key === cls.intent)) return null;

      const facts = tenantFacts(cls.intent);          // <- số thật, code tự lấy
      const composed = await G.compose(text, facts,
        'Xưng "em", gọi khách là "anh/chị". Người hỏi là khách đang thuê phòng. Thân thiện, ngắn gọn.');
      const inv = currentUnpaid();
      return { html: composed.replace(/```[a-z]*|```/g, '').trim(),
        actions: (T_ACTIONS[cls.intent] ? T_ACTIONS[cls.intent](inv) : []), ai: true };
    } catch (e) {
      return null;   // hết lượt / lỗi mạng -> quay về luồng chuyển cho quản lý
    }
  }

  /* ---------- màn hình chat ---------- */
  function screenChat() {
    if (!chat.msgs.length) {
      pushMsg('bot', `Chào anh/chị <b>${esc(state.data.tenant.fullName)}</b>! Em là trợ lý của Happy Home.<br>
        Em có thể tra cứu <b>tiền phòng, hạn đóng, điện nước, hợp đồng</b> và <b>tạo yêu cầu sửa chữa</b> giúp anh/chị.`);
    }
    const body = chat.msgs.map((m, i) => `
      <div class="chat-msg ${m.who === 'me' ? 'me' : ''}">
        <div class="bubble">${m.html}
          ${m.ai ? '<span class="b-ai">✦ soạn bởi Gemini · số liệu lấy từ hệ thống</span>' : ''}
          ${m.actions.length ? `<div class="b-actions">${m.actions.map((a, j) =>
            `<button class="b-act ${a.solid ? 'solid' : ''}" data-mi="${i}" data-ai="${j}">${esc(a.label)}</button>`).join('')}</div>` : ''}
        </div></div>`).join('');

    el('tapp').innerHTML = `<div class="t-app">${sidebar()}<div class="chat-wrap">
      <div class="t-header plain"><button class="back" id="back">←</button>
        <div class="htitle">Trợ lý Happy Home</div></div>
      <div class="chat-body" id="chatBody">${body}${chat.busy ? '<div class="chat-typing"><i></i><i></i><i></i></div>' : ''}</div>
      <div class="chat-sugg">${SUGGESTIONS.map(s => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="chat-input">
        <textarea id="chatIn" rows="1" placeholder="Nhập câu hỏi..."></textarea>
        <button class="chat-send" id="chatSend" aria-label="Gửi">➤</button>
      </div></div></div>`;

    wireTabs();
    const slo2 = el('sideLogout');
    if (slo2) slo2.onclick = () => { try { localStorage.removeItem(PHONE_KEY); } catch (e) {}
      state.phone = null; state.data = null; go('#/login'); };
    el('back').onclick = () => go('#/home');
    const bodyEl = el('chatBody'); bodyEl.scrollTop = bodyEl.scrollHeight;
    const inp = el('chatIn');
    const send = () => { const v = inp.value.trim(); if (!v) return; inp.value = ''; inp.style.height = 'auto'; ask(v); };
    el('chatSend').onclick = send;
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(96, inp.scrollHeight) + 'px'; };
    document.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => ask(b.dataset.sugg));
    document.querySelectorAll('[data-mi]').forEach(b => b.onclick = () => {
      const a = chat.msgs[+b.dataset.mi].actions[+b.dataset.ai];
      if (a.go) return go(a.go);
      if (a.send) return ask(a.send);
      if (a.act === 'contact') return contactLandlord();
      if (a.act === 'mkincident') return doCreateIncident(a.data);
    });
  }

  async function ask(text) {
    pushMsg('me', esc(text));
    chat.busy = true; screenChat();

    // Tầng 1 — luật từ khóa (miễn phí, tức thì)
    await new Promise(r => setTimeout(r, 380));
    const res = answer(text);
    if (res.html) {
      chat.busy = false;
      pushMsg('bot', res.html, res.actions);
      screenChat(); return;
    }

    // Tầng 2 — Gemini Flash (chỉ khi luật không nhận ra)
    const ai = await aiAnswer(text);
    chat.busy = false;
    if (ai) { pushMsg('bot', ai.html, ai.actions, true); screenChat(); return; }

    // Tầng 3 — trả lời trung thực + chuyển cho quản lý
    forwardToLandlord(res.forward);
    screenChat();
  }

  // Không xử lý được -> trả lời trung thực + gửi câu hỏi cho chủ nhà (đúng đặc tả §5.1)
  async function forwardToLandlord(text) {
    pushMsg('bot', `Việc này em chưa hỗ trợ được ạ. Em đã <b>chuyển câu hỏi cho bộ phận quản lý</b>,
      anh/chị sẽ được liên hệ lại trong giờ làm việc.`, [{ label: 'Liên hệ ngay', act: 'contact' }]);
    screenChat();
    try {
      await rpc('tenant_create_incident', { p_phone: state.phone, p_category: 'Khác', p_title: '[Câu hỏi] ' + text });
      state.data = await loadData(state.phone);
    } catch (e) { /* không chặn hội thoại nếu gửi lỗi */ }
  }

  async function doCreateIncident(data) {
    pushMsg('bot', 'Em đang gửi yêu cầu...'); screenChat();
    try {
      await rpc('tenant_create_incident', { p_phone: state.phone, p_category: data.cat, p_title: data.title });
      state.data = await loadData(state.phone);
      chat.msgs.pop();
      pushMsg('bot', `Đã gửi yêu cầu <b>${esc(data.cat)}</b> tới chủ nhà ✓<br>Anh/chị theo dõi tiến độ trong mục Yêu cầu sửa chữa nhé.`,
        [{ label: 'Theo dõi yêu cầu', go: '#/track', solid: true }]);
    } catch (e) {
      chat.msgs.pop();
      pushMsg('bot', e.message === 'NOT_ACTIVATED'
        ? 'Chức năng gửi yêu cầu chưa được kích hoạt trên hệ thống ạ.'
        : 'Em gửi chưa được, anh/chị thử lại giúp em ạ.', [{ label: 'Thử lại', go: '#/repair' }]);
    }
    screenChat();
  }

  function contactLandlord() {
    const phone = (state.data.building && state.data.building.contactPhone) || '';
    if (!phone) { toast('Chưa có số liên hệ của chủ nhà'); return; }
    location.href = 'tel:' + phone;
  }

  /* ---------- khởi động ---------- */
  async function boot() {
    let saved = null; try { saved = localStorage.getItem(PHONE_KEY); } catch (e) {}
    if (saved && enabled) {
      state.phone = saved;
      render(); // hiện loading
      try { state.data = await loadData(saved); } catch (e) { state.data = null; }
      if (!state.data) { state.phone = null; try { localStorage.removeItem(PHONE_KEY); } catch (e) {} }
      render();
    } else {
      render();
    }
  }
  boot();
})();

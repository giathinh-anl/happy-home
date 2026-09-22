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
  // Logo dùng chung với web quản trị (thư mục assets ở gốc dự án)
  const LOGO = '../assets/logo-mark.svg', LOGO_3D = '../assets/logo-3d.webp';
  const logoImg = (w) => `<img src="${LOGO}" alt="" width="${w}" height="${Math.round(w * 0.865)}">`;

  /* ---------- tiện ích ---------- */
  const viNum = new Intl.NumberFormat('vi-VN');
  const vnd = (n) => (n == null || isNaN(n)) ? '-' : viNum.format(Math.round(n)) + ' ₫';
  const num = (n) => (n == null || isNaN(n)) ? '-' : viNum.format(n);
  const pad = (x) => String(x).padStart(2, '0');
  const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '-' : `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
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

  /* Ảnh chụp từ điện thoại rất nặng, nén lại trước khi gửi lên máy chủ */
  function compressImg(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = reject;
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => resolve(rd.result);
        img.onload = () => {
          const sc = Math.min(1, (maxSize || 1000) / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { resolve(cv.toDataURL('image/jpeg', quality || 0.72)); } catch (e) { resolve(rd.result); }
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }

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

  /* Chuyển màn như ứng dụng điện thoại: vào màn con (chi tiết, thanh toán...) thì
     màn mới trượt từ phải sang; quay lại thì trượt ngược; đổi tab theo thứ tự tab. */
  const TAB_ORDER = ['#/home', '#/invoices', '#/room', '#/account'];
  const depthOf = (h) => (!h || h === '#/' || TAB_ORDER.indexOf(h) > -1) ? 0 : /^#\/(pay|proof)/.test(h) ? 2 : 1;
  let lastHash = location.hash, inVT = false;
  window.addEventListener('hashchange', () => {
    const from = lastHash, to = location.hash;
    lastHash = to;
    const auth = !state.phone || !state.data || /^#\/(otp|login)/.test(from || '') || /^#\/(otp|login)/.test(to);
    const df = depthOf(from), dt = depthOf(to);
    const dir = auth ? 'fade' : dt > df ? 'fwd' : dt < df ? 'back'
      : (TAB_ORDER.indexOf(to) >= TAB_ORDER.indexOf(from) ? 'fwd' : 'back');
    HH.fx.transition((vt) => { inVT = vt; try { render(); window.scrollTo(0, 0); } finally { inVT = false; } }, dir);
  });

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
    { key: 'home', hash: '#/home', ic: HH.pic('house', 28), label: 'Trang chủ' },
    { key: 'invoices', hash: '#/invoices', ic: HH.pic('receipt', 28), label: 'Hóa đơn' },
    { key: 'room', hash: '#/room', ic: HH.pic('door', 28), label: 'Phòng của tôi' },
    { key: 'account', hash: '#/account', ic: HH.pic('user', 28), label: 'Tài khoản' },
  ];
  function tabbar(active) {
    const unpaid = (state.data.invoices || []).filter(i => (i.total - i.paid) > 0).length;
    return `<nav class="t-tabbar" id="tTabs"><span class="slide-ind" data-mode="fixed" aria-hidden="true"></span>${TABS.map(t => `<button class="t-tab ${t.key === active ? 'on active' : ''}" data-tab="${t.hash}">
      ${t.key === 'invoices' && unpaid ? `<span class="dot-badge">${unpaid}</span>` : ''}
      <span class="ic">${t.ic}</span><span>${t.label}</span></button>`).join('')}</nav>`;
  }
  function wireTabs() {
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
  }

  /* ---------- Thanh bên (chỉ hiện trên máy tính) ---------- */
  const SIDE_MAIN = [
    { hash: '#/home', ic: HH.pic('house', 26), label: 'Trang chủ', key: 'home' },
    { hash: '#/invoices', ic: HH.pic('receipt', 26), label: 'Hóa đơn', key: 'invoices' },
    { hash: '#/room', ic: HH.pic('door', 26), label: 'Phòng của tôi', key: 'room' },
    { hash: '#/contract', ic: HH.pic('contract', 26), label: 'Hợp đồng', key: 'contract' },
  ];
  const SIDE_MORE = [
    { hash: '#/readings', ic: HH.pic('camera', 26), label: 'Gửi chỉ số điện', key: 'readings' },
    { hash: '#/repair', ic: HH.pic('wrench', 26), label: 'Báo hỏng', key: 'repair' },
    { hash: '#/track', ic: HH.pic('clipboard', 26), label: 'Yêu cầu sửa chữa', key: 'track' },
    { hash: '#/usage', ic: HH.pic('chart', 26), label: 'Lịch sử điện', key: 'usage' },
    { hash: '#/history', ic: HH.pic('card', 26), label: 'Lịch sử thanh toán', key: 'history' },
    { hash: '#/services', ic: HH.pic('concierge', 26), label: 'Bảng giá dịch vụ', key: 'services' },
    { hash: '#/chat', ic: HH.pic('chat', 26), label: 'Trợ lý ảo', key: 'chat' },
    { hash: '#/account', ic: HH.pic('user', 26), label: 'Tài khoản', key: 'account' },
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
      <div class="s-brand"><span class="mark">${logoImg(28)}</span>
        <span><b class="wordmark">happy home</b><small>Khách thuê</small></span></div>
      <div class="s-me"><span class="av">${esc((nm.trim().split(/\s+/).slice(-1)[0] || '?')[0])}</span>
        <span style="min-width:0"><span class="nm">${esc(nm)}</span>
          <span class="rm">Phòng ${esc(d.tenant.roomCode || '')}</span></span></div>
      ${SIDE_MAIN.map(item).join('')}
      <div class="s-sep"></div>
      <div class="s-label">Tiện ích</div>
      ${SIDE_MORE.map(item).join('')}
      <div class="s-foot"><button class="t-nav" id="sideLogout" style="color:var(--danger)">
        <span class="nic">${HH.ic('logout', 16)}</span><span>Đăng xuất</span></button></div>
    </aside>`;
  }

  /* ---------- màn hình: ĐĂNG NHẬP ---------- */
  function screenLogin() {
    el('tapp').innerHTML = `<div class="t-login">
      <div class="t-login-art" aria-hidden="true">${HH.scene()}</div>
      <div class="logo"><div class="t-sign"><img class="logo3d" src="${LOGO_3D}" alt="Logo Happy Home" width="2000" height="1804"></div>
        <h1 class="sr-only">Happy Home</h1><p class="lead">Nhập số điện thoại đã đăng ký với chủ nhà</p></div>
      <div id="loginErr"></div>
      <div class="t-field"><label>Số điện thoại</label>
        <div class="t-phone"><span class="cc">+84</span><input id="phone" type="tel" inputmode="numeric" placeholder="0912 345 678" autocomplete="tel"></div>
      </div>
      <button class="t-btn" id="sendOtp">Gửi mã xác thực</button>
      ${enabled ? '<div class="t-hint">Bản demo: nhập SĐT của một khách thuê có trong hệ thống. Mã OTP demo là <b>123456</b>.</div>'
        : '<div id="cfgWarn">' + errBox(NO_CONFIG_MSG) + '</div>'}
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
        if (e.message === 'NO_CONFIG') {        // lời nhắc đã hiện sẵn bên dưới, chỉ làm nó nháy lên cho dễ thấy
          const box = document.querySelector('#cfgWarn .t-err');
          if (box && box.animate) box.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 });
          return;
        }
        el('loginErr').innerHTML = errBox(e.message === 'NOT_ACTIVATED'
          ? 'App khách thuê chưa được kích hoạt (cần chạy SQL migration-tenant-app.sql).'
          : e.message === 'NO_CONFIG' ? NO_CONFIG_MSG : 'Không kết nối được máy chủ. Thử lại sau.');
      } finally { btn.classList.remove('loading'); btn.disabled = false; }
    };
  }
  const errBox = (m) => `<div class="t-err"><span>${HH.ic('alert', 16)}</span><div>${esc(m)}</div></div>`;
  // Tệp js/config.js chứa địa chỉ máy chủ nên cố ý không đưa lên GitHub -> máy khác tải mã về sẽ thiếu
  const NO_CONFIG_MSG = 'Chưa kết nối máy chủ: thiếu tệp js/config.js (tệp này không có trên GitHub). '
    + 'Chép js/config.js từ máy chính vào thư mục js của dự án rồi tải lại trang.';

  /* ---------- màn hình: OTP ---------- */
  function screenOtp() {
    const masked = state.pendingPhone.replace(/(\d{4})\d{3}(\d{3})/, '$1 *** $2');
    el('tapp').innerHTML = `<div class="t-login">
      <div class="t-login-art short" aria-hidden="true">${HH.scene()}</div>
      <div class="logo"><div class="mark">${logoImg(46)}</div></div>
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
      ? `<div class="t-header"><div class="brand"><span class="mark">${logoImg(24)}</span><span class="wordmark">happy home</span></div>
           <button class="iconbtn" id="reload" title="Tải lại">${HH.ic('refresh', 16)}</button></div>`
      : `<div class="t-header plain"><button class="back" id="back">←</button><div class="htitle">${esc(title)}</div></div>`;
    const tabs = opts.tab ? tabbar(opts.tab) : '';
    // Nút trợ lý ảo nổi — hiện ở các màn hình chính (điện thoại)
    const fab = opts.tab ? `<button class="chat-fab" id="chatFab" title="Trợ lý ảo" aria-label="Trợ lý ảo">${HH.pic('chat', 30)}</button>` : '';
    // Tiêu đề trang cho bố cục máy tính (điện thoại đã có thanh header riêng)
    const deskHead = opts.hero ? '' : `<div class="t-page-head"><h1>${esc(opts.deskTitle || title || 'Trang chủ')}</h1>
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
      rl.innerHTML = String(HH.ic('clock', 16)); rl.disabled = true;
      try { state.data = await loadData(state.phone); toast('Đã cập nhật'); } catch (e) { toast('Không tải được'); }
      render();
    };
    if (opts.tab) wireTabs();
    // Chuyển động: viên chỉ báo trượt sang tab mới, các khối trồi lên, số tiền chạy
    HH.fx.slide(el('tTabs'), 't-tab');
    if (!inVT) HH.fx.enter(document.querySelector('.t-main'));
    HH.fx.countUp(el('tapp'), { vnd: (v) => vnd(v) });
  }

  function screenLoading() { shell('', `<div class="skeleton-card"></div><div class="skeleton-card"></div>`, { home: true }); }

  /* ---------- màn hình: TRANG CHỦ ---------- */
  function greet() {
    const hr = new Date().getHours();
    return hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  }
  function currentUnpaid() { return (state.data.invoices || []).find(i => (i.total - i.paid) > 0); }

  function screenHome() {
    const d = state.data;
    const inv = currentUnpaid();
    let dueCard;
    if (!inv) {
      dueCard = `<div class="due-card paid"><div class="label">Công nợ</div>
        <div class="amount">${vnd(0)}</div><div class="meta">Bạn đã thanh toán đầy đủ</div></div>`;
    } else {
      const remain = inv.total - inv.paid; const dl = daysLeft(inv.dueDate);
      const cls = dl < 0 ? 'danger' : 'warn';
      const meta = dl < 0 ? `Quá hạn ${Math.abs(dl)} ngày (hạn ${fmtDate(inv.dueDate)})` : `Hạn: ${fmtDate(inv.dueDate)} · Còn ${dl} ngày`;
      dueCard = `<div class="due-card ${cls}"><div class="label">Cần thanh toán</div>
        <div class="amount" data-count="${remain}" data-fmt="vnd">${vnd(remain)}</div><div class="meta">${meta}</div>
        <button class="t-btn" id="payNow">Thanh toán ngay</button></div>`;
    }
    const notis = buildNotifications();
    // nhắc hạn hợp đồng
    const c = d.contract;
    let ctWarn = '';
    if (c && c.end) {
      const dl = daysLeft(c.end);
      if (dl < 0) ctWarn = `<div class="t-err" style="background:var(--danger-bg);border-color:#fecaca"><span>${HH.ic('alert', 16)}</span>
        <div><b>Hợp đồng đã hết hạn</b> ${fmtDate(c.end)}. Liên hệ chủ nhà để gia hạn.</div></div>`;
      else if (dl <= 30) ctWarn = `<div class="t-err" style="background:var(--warning-bg);border-color:#fde68a;color:#92400e"><span>${HH.ic('alert', 16)}</span>
        <div><b>Hợp đồng sắp hết hạn,</b> còn ${dl} ngày (${fmtDate(c.end)}).</div></div>`;
    }
    // tiêu thụ kỳ gần nhất
    const usage = latestUsage();
    const usageCard = usage ? `<div class="t-card">
      <div class="t-section-head" style="margin-bottom:4px"><h3>Tiêu thụ ${esc(usage.label)}</h3>
        <a href="#/usage">Xem lịch sử →</a></div>
      <div class="t-row"><span class="k">${HH.pic('bolt', 26)} Điện</span><span class="v mono">${num(usage.elec)} kWh</span></div>
    </div>` : '';

    const contractCardHtml = c ? contractCard(c) : '';
    shell('', `
      <section class="t-hero">
        <div class="t-hero-art" aria-hidden="true">${HH.scene()}</div>
        <div class="t-hero-in"><p class="hi">${greet()}, <b>${esc((d.tenant.fullName || '').trim().split(/\s+/).slice(-1)[0])}</b></p>
          <div class="rm">Phòng ${esc(d.room.code || d.tenant.roomCode)}</div>
          <div class="bn">${HH.ic('pin', 14)} ${esc(d.building.name || '')}</div></div>
      </section>
      ${ctWarn}
      <div class="t-grid2">
        <div>
          ${dueCard}
          <div class="section-title">Truy cập nhanh</div>
          <div class="quick-grid" style="grid-template-columns:repeat(4,1fr)">
            <button class="quick-item" data-nav="#/invoices"><div class="qic t-sky">${HH.pic('receipt', 34)}</div><div class="qlabel">Hóa đơn</div></button>
            <button class="quick-item" data-nav="#/readings"><div class="qic t-leaf">${HH.pic('camera', 34)}</div><div class="qlabel">Gửi chỉ số</div></button>
            <button class="quick-item" data-nav="#/repair"><div class="qic t-coral">${HH.pic('wrench', 34)}</div><div class="qlabel">Báo hỏng</div></button>
            <button class="quick-item" data-nav="#/chat"><div class="qic t-grape">${HH.pic('chat', 34)}</div><div class="qlabel">Trợ lý ảo</div></button>
          </div>
          ${usageCard}
        </div>
        <div>
          ${contractCardHtml}
          <div class="section-title">Thông báo gần đây</div>
          <div class="t-card">${notis || '<div style="color:var(--neutral-400);text-align:center;padding:8px">Chưa có thông báo</div>'}</div>
        </div>
      </div>
    `, { home: true, hero: true, tab: 'home', deskTitle: 'Xin chào, ' + (d.tenant.fullName || '').split(' ').slice(-1)[0],
         deskSub: `Phòng ${d.room.code || d.tenant.roomCode} · ${d.building.name || ''}` });
    const pn = el('payNow'); if (pn) pn.onclick = () => go('#/pay/' + inv.id);
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

  /* ---------- tính tiêu thụ ---------- */
  function usageList() {
    return (state.data.readings || []).filter(r => r.elecCurr != null)
      .map(r => ({
        period: r.period, label: vnPeriod(r.period),
        elec: (r.elecCurr != null && r.elecPrev != null) ? Math.max(0, r.elecCurr - r.elecPrev) : null,
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
    shell('Hóa đơn', summary + (rows || `<div class="t-empty"><div class="eic">${HH.pic('receipt', 64)}</div><p>Chưa có hóa đơn nào</p></div>`), { tab: 'invoices' });
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
        <div class="mono" style="color:var(--neutral-600);font-size:13px;margin-bottom:8px">Kỳ ${fmtDate(inv.periodStart)} đến ${fmtDate(inv.periodEnd)} · Hạn ${fmtDate(inv.dueDate)}</div>
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
    if (!inv) { shell('Thanh toán', `<div class="t-empty"><div class="eic">${HH.pic('wallet', 64)}</div><p>Không có khoản cần thanh toán</p></div>`); return; }
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
          Quét mã bằng <b>app ngân hàng bất kỳ</b>, số tiền và nội dung tự điền sẵn.<br>
          <span style="color:var(--success);font-weight:600">Chuyển xong là hệ thống tự trừ công nợ.</span></div>
      </div>
      <div class="divider">hoặc</div>
      <div class="t-card">
        <div style="font-weight:700;margin-bottom:6px">Chuyển khoản thủ công</div>
        <div class="bank-row"><span class="bk">Ngân hàng</span><span class="bv">${BANK.name}</span></div>
        <div class="bank-row"><span class="bk">Số tài khoản</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${BANK.account}</span><button class="copybtn" data-copy="${BANK.account}" data-l="số tài khoản">${HH.ic('copy', 16)}</button></span></div>
        <div class="bank-row"><span class="bk">Chủ tài khoản</span><span class="bv">${BANK.holder}</span></div>
        <div class="bank-row"><span class="bk">Số tiền</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${num(remain)}</span><button class="copybtn" data-copy="${remain}" data-l="số tiền">${HH.ic('copy', 16)}</button></span></div>
        <div class="bank-row"><span class="bk">Nội dung</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${esc(content)}</span><button class="copybtn" data-copy="${esc(content)}" data-l="nội dung">${HH.ic('copy', 16)}</button></span></div>
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
            <span style="text-align:center;color:var(--neutral-400)">${HH.ic('camera', 16)}<div style="font-size:13px;margin-top:6px">Chụp hoặc chọn ảnh biên lai</div></span>
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
             <span style="text-align:center;color:var(--neutral-400)">${HH.ic('camera', 16)}<div style="font-size:13px;margin-top:6px">Chụp hoặc chọn ảnh biên lai</div></span>
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
        HH.fx.confetti();
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
  const CATS = [{ k: 'Điện', ic: HH.pic('bolt', 34) }, { k: 'Nước', ic: HH.pic('drop', 34) }, { k: 'Máy lạnh', ic: HH.pic('gear', 34) }, { k: 'Khác', ic: HH.pic('wrench', 34) }];
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
          <label class="photo-slot">${HH.ic('plus', 16)}<input type="file" accept="image/*" id="photoInput" hidden></label>
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
    el('photoInput').onchange = async (e) => {
      const f = e.target.files[0]; if (!f || r.photos.length >= 5) return;
      r.photos.push(await compressImg(f, 1100, 0.7)); renderPhotos();
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
      box.innerHTML = thumbs + (r.photos.length < 5 ? `<label class="photo-slot">${HH.ic('plus', 16)}<input type="file" accept="image/*" id="photoInput" hidden></label>` : '');
      const pin = el('photoInput'); if (pin) pin.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; r.photos.push(await compressImg(f, 1100, 0.7)); renderPhotos(); };
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
        <div class="timeline">${steps.map(s => `<div class="tl-item ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}"><div class="tl-title">${s.t}</div><div class="tl-time">${s.done ? fmtDate(x.createdAt) : '-'}</div></div>`).join('')}</div>
      </div>`;
    }).join('') : `<div class="t-empty"><div class="eic">${HH.pic('clipboard', 64)}</div><p>Chưa có yêu cầu nào</p><button class="t-btn" style="margin-top:16px;max-width:200px" id="newReq">Tạo yêu cầu</button></div>`;
    shell('Yêu cầu sửa chữa', body + (incs.length ? `<button class="t-btn outline" id="newReq" style="margin-top:6px">${HH.ic('plus', 16)} Tạo yêu cầu mới</button>` : ''));
    const nr = el('newReq'); if (nr) nr.onclick = () => go('#/repair');
  }

  /* ---------- màn hình: GHI CHỈ SỐ ĐIỆN ----------
     Tiền nước tính theo số người nên không cần chỉ số nước.
     Ảnh đồng hồ gửi kèm để chủ trọ xem rồi duyệt. */
  function screenReadings() {
    const rd = { photos: [] };
    shell('Gửi chỉ số điện', `
      <p style="color:var(--neutral-600);margin-bottom:16px">Tự gửi chỉ số điện kỳ <b>${CUR_PERIOD_LABEL}</b>. Chủ trọ xem ảnh rồi duyệt.
        Tiền nước tính theo số người ở nên không cần gửi chỉ số nước.</p>
      <div class="t-field"><label>${HH.pic('bolt', 26)} Chỉ số điện (kWh)</label><input class="t-input mono" id="elec" inputmode="numeric" placeholder="VD: 12680"></div>
      <div class="t-field"><label>Ảnh đồng hồ điện</label>
        <div class="photo-grid" id="rdPhotos"></div>
        <div class="t-note" style="margin-top:8px">Chụp rõ dãy số trên đồng hồ. Ảnh này gửi thẳng cho chủ trọ.</div></div>
      <button class="t-btn" id="submitR">Gửi chỉ số</button>
    `);
    drawRdPhotos();
    el('submitR').onclick = async (e) => {
      const elec = parseInt((el('elec').value || '').replace(/\D/g, ''), 10);
      if (!elec) { toast('Nhập chỉ số điện'); return; }
      e.currentTarget.classList.add('loading');
      try {
        // Gửi kèm ảnh; máy chủ chưa cập nhật hàm thì gửi số không ảnh
        try {
          await rpc('tenant_submit_reading', { p_phone: state.phone, p_period: CUR_PERIOD, p_elec: elec, p_water: null, p_photos: rd.photos });
        } catch (e1) {
          await rpc('tenant_submit_reading', { p_phone: state.phone, p_period: CUR_PERIOD, p_elec: elec, p_water: null });
        }
        state.data = await loadData(state.phone);
        toast('Đã gửi chỉ số, chờ chủ trọ duyệt'); go('#/home');
      } catch (err) { toast(err.message === 'NOT_ACTIVATED' ? 'Chưa kích hoạt (cần chạy SQL)' : 'Không gửi được, thử lại'); e.currentTarget.classList.remove('loading'); }
    };

    function drawRdPhotos() {
      const box = el('rdPhotos'); if (!box) return;
      box.innerHTML = rd.photos.map((p, i) => `<div class="photo-slot filled"><img src="${p}"><button class="ph-del" data-del="${i}" aria-label="Xóa ảnh">${HH.ic('x', 14)}</button></div>`).join('')
        + (rd.photos.length < 3 ? `<label class="photo-slot">${HH.ic('camera', 16)}<input type="file" accept="image/*" capture="environment" id="rdPhotoInput" hidden></label>` : '');
      const inp = el('rdPhotoInput');
      if (inp) inp.onchange = async (ev) => {
        const f = ev.target.files[0]; if (!f) return;
        rd.photos.push(await compressImg(f, 1100, 0.7));
        drawRdPhotos();
      };
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { rd.photos.splice(+b.dataset.del, 1); drawRdPhotos(); });
    }
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
        <div class="t-row"><span class="k">Địa chỉ</span><span class="v" style="font-weight:500;font-size:13px">${esc(d.building.address || 'chưa có địa chỉ')}</span></div>
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
        <button class="t-action" data-nav="#/usage"><span class="aic t-leaf">${HH.pic('chart', 26)}</span>Lịch sử điện<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/services"><span class="aic t-sun">${HH.pic('concierge', 26)}</span>Bảng giá dịch vụ<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/track"><span class="aic t-coral">${HH.pic('clipboard', 26)}</span>Yêu cầu sửa chữa<span class="chev">›</span></button>
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
    if (!c) { shell('Hợp đồng', `<div class="t-empty"><div class="eic">${HH.pic('contract', 64)}</div><p>Chưa có thông tin hợp đồng</p>
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

  /* ---------- màn hình: LỊCH SỬ ĐIỆN ---------- */
  function screenUsage() {
    const list = usageList();
    if (!list.length) { shell('Lịch sử điện', `<div class="t-empty"><div class="eic">${HH.pic('chart', 64)}</div><p>Chưa có dữ liệu chỉ số</p></div>`); return; }
    const recent = list.slice(0, 6).reverse();
    const maxE = Math.max(1, ...recent.map(x => x.elec || 0));
    const bars = recent.map(x => `<div class="usage-col">
      <div class="val">${x.elec != null ? num(x.elec) : ''}</div>
      <div class="usage-bar" style="height:${Math.round(((x.elec || 0) / maxE) * 78)}%"></div>
      <div class="cap">${esc(x.label)}</div></div>`).join('');
    shell('Lịch sử điện', `
      <div class="t-card"><div class="t-section-head"><h3>${HH.pic('bolt', 26)} Điện (kWh)</h3></div>
        <div class="usage-chart">${bars}</div></div>
      <div class="t-card"><div class="t-section-head"><h3>Chi tiết theo kỳ</h3></div>
        ${list.map(x => `<div class="t-row"><span class="k">${esc(x.label)}</span>
          <span class="v mono" style="font-size:13px">${x.elec != null ? num(x.elec) + ' kWh' : '-'}</span></div>`).join('')}
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
      : `<div class="t-empty"><div class="eic">${HH.pic('concierge', 64)}</div><p>Chưa có bảng giá dịch vụ</p></div>`);
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
      : `<div class="t-empty"><div class="eic">${HH.pic('card', 64)}</div><p>Chưa có lịch sử thanh toán</p></div>`);
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
        <button class="t-action" data-nav="#/history"><span class="aic t-sky">${HH.pic('card', 26)}</span>Lịch sử thanh toán<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/contract"><span class="aic t-grape">${HH.pic('contract', 26)}</span>Hợp đồng & điều khoản<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/track"><span class="aic t-coral">${HH.pic('clipboard', 26)}</span>Yêu cầu sửa chữa<span class="chev">›</span></button>
        <button class="t-action" data-nav="#/chat"><span class="aic t-grape">${HH.pic('chat', 26)}</span>Trợ lý ảo<span class="chev">›</span></button>
        <button class="t-action" id="helpBtn"><span class="aic t-sky">${HH.ic('help', 20)}</span>Hướng dẫn sử dụng<span class="chev">›</span></button>
      </div>
      <div class="t-card" style="padding:0;overflow:hidden">
        <button class="t-action danger" id="logoutBtn"><span class="aic" style="background:var(--danger-bg)">${HH.ic('logout', 16)}</span>Đăng xuất<span class="chev">›</span></button>
      </div>
      <p style="text-align:center;color:var(--neutral-400);font-size:12px;margin-top:12px">Happy Home · App khách thuê</p>
    `, { tab: 'account' });
    document.querySelectorAll('[data-nav]').forEach(x => x.onclick = () => go(x.dataset.nav));
    el('helpBtn').onclick = () => alert('• Trang chủ: xem tiền cần đóng và hạn thanh toán\n• Hóa đơn: xem chi tiết từng khoản\n• Phòng của tôi: hợp đồng, điều khoản, tài sản, bảng giá\n• Gửi chỉ số: tự gửi số điện kèm ảnh đồng hồ cho chủ nhà\n• Báo hỏng: gửi yêu cầu sửa chữa và theo dõi tiến độ');
    el('logoutBtn').onclick = () => {
      if (!confirm('Đăng xuất khỏi ứng dụng?')) return;
      try { localStorage.removeItem(PHONE_KEY); sessionStorage.removeItem('hh_tchat_' + state.phone); } catch (e) {}
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
  const NLU = window.HHNLU;
  const chat = { msgs: [], busy: false, ctx: NLU ? NLU.createContext() : null, loadedFor: null };
  const chatKey = () => 'hh_tchat_' + (state.phone || '');

  const SUGGESTIONS = [
    'Tháng này tôi đóng bao nhiêu?',
    'Sao tháng này tiền cao hơn?',
    'Hạn đóng tiền khi nào?',
    'Tiền điện nước tháng này',
    'Hợp đồng còn bao lâu?',
    'Thông tin chuyển khoản',
  ];

  const norm = NLU ? NLU.norm : (s) => String(s || '').toLowerCase();
  const hasAny = (t, arr) => arr.some(k => t.includes(k));

  function pushMsg(who, html, actions, byAi, extra) {
    chat.msgs.push(Object.assign({ who, html, actions: actions || [], ai: !!byAi }, extra || {}));
    saveChat();
  }

  /* Hội thoại giữ trong sessionStorage theo từng số điện thoại (đóng tab là mất) */
  function saveChat() {
    try {
      sessionStorage.setItem(chatKey(), JSON.stringify({
        msgs: chat.msgs.slice(-40), ctx: chat.ctx ? chat.ctx.dump() : null }));
    } catch (e) { /* bỏ qua */ }
  }
  function loadChat() {
    if (chat.loadedFor === state.phone) return;
    chat.loadedFor = state.phone;
    chat.msgs = [];
    if (chat.ctx) chat.ctx.clear();
    try {
      const o = JSON.parse(sessionStorage.getItem(chatKey()) || 'null');
      if (o && Array.isArray(o.msgs)) chat.msgs = o.msgs;
      if (o && chat.ctx) chat.ctx.load(o.ctx);
    } catch (e) { /* bắt đầu mới */ }
  }

  /* ---------- dữ liệu của khách đang đăng nhập ---------- */
  const invList = () => (state.data.invoices || []).filter(i => i.status !== 'cancelled' && i.status !== 'draft')
    .slice().sort((a, b) => (a.period || '').localeCompare(b.period || ''));
  const invOf = (per) => invList().find(i => i.period === per);
  const readingOf = (per) => usageList().find(u => u.period === per);
  const lineAmt = (inv, re) => { const l = inv && (inv.lines || []).find(x => re.test(x.label) || (re.source.includes('điện') && x.type === 'elec')); return l ? l.amount : null; };
  const termsList = () => {
    const c = state.data.contract || {};
    const src = (c.terms && c.terms.length) ? c.terms : DEFAULT_TERMS;
    return src.map(t => ({ title: t.title, body: (t.body || '')
      .replace('{deposit}', vnd(c.deposit)).replace('{rent}', vnd(c.rent)).replace('{dueDays}', c.dueDays || 5) }));
  };
  const diffTxt = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + vnd(Math.abs(n));

  /* ============================================================
     BỘ Ý ĐỊNH — mỗi ý định tự lấy SỐ THẬT từ state.data (dữ liệu máy chủ
     trả về theo số điện thoại đã xác thực, không lấy từ nội dung tin nhắn).
     ============================================================ */
  const TI = {};

  TI.invoice = {
    desc: 'Số tiền phải đóng, chi tiết hóa đơn của một tháng, còn nợ bao nhiêu',
    kw: ['phai dong', 'phai tra', 'dong bao nhieu', 'tra bao nhieu', 'tien phong', 'hoa don', 'tien nha',
      'het bao nhieu', 'tong tien', 'con no', 'no bao nhieu', 'cong no', 'tien thang'],
    weak: ['bao nhieu'],
    run(sl) {
      const inv = sl.period ? invOf(sl.period) : currentUnpaid();
      const facts = { kỳ: sl.period ? vnPeriod(sl.period) : null };
      if (sl.period && !inv) return { facts, html: `Em chưa thấy hóa đơn <b>${vnPeriod(sl.period)}</b> của phòng mình ạ.`,
        suggest: ['Tháng này tôi đóng bao nhiêu?', 'Lịch sử thanh toán'] };
      if (!inv) return { facts: { còn_phải_đóng: '0 ₫' },
        html: `Hiện anh/chị <b>không còn khoản nào phải thanh toán</b>. Cảm ơn anh/chị đã đóng đầy đủ ạ! ✓`,
        actions: [{ label: 'Xem lịch sử hóa đơn', go: '#/invoices' }],
        suggest: ['Sao tháng này tiền cao hơn?', 'Lịch sử thanh toán'] };
      const remain = inv.total - inv.paid;
      const dl = daysLeft(inv.dueDate);
      Object.assign(facts, { kỳ: vnPeriod(inv.period), tổng: vnd(inv.total), đã_trả: vnd(inv.paid), còn_phải_đóng: vnd(remain),
        hạn: fmtDate(inv.dueDate), còn_lại_ngày: dl, các_khoản: (inv.lines || []).map(l => ({ khoản: l.label, tiền: vnd(l.amount) })) });
      const rows = (inv.lines || []).map(l => `<tr><td>${esc(l.label)}</td><td>${vnd(l.amount)}</td></tr>`).join('');
      return { facts,
        html: `<div class="b-title">Hóa đơn ${vnPeriod(inv.period)}</div>
          <table>${rows}<tr class="sum"><td>Tổng cộng</td><td>${vnd(inv.total)}</td></tr>
          ${inv.paid > 0 ? `<tr><td>Đã thanh toán</td><td>−${vnd(inv.paid)}</td></tr>
            <tr class="sum"><td>Còn phải đóng</td><td>${vnd(remain)}</td></tr>` : ''}</table>
          <div class="b-note">${remain <= 0 ? '<b>Đã thanh toán đủ ✓</b>'
            : `Hạn: <b>${fmtDate(inv.dueDate)}</b> · ${dl < 0 ? `<span class="b-warn">đã quá hạn ${-dl} ngày</span>` : `còn ${dl} ngày`}`}</div>`,
        actions: [{ label: 'Xem chi tiết', go: '#/invoice/' + inv.id }]
          .concat(remain > 0 ? [{ label: 'Thanh toán', go: '#/pay/' + inv.id, solid: true }] : []),
        suggest: ['So với tháng trước', 'Tiền điện tháng này', 'Thông tin chuyển khoản'] };
    },
  };

  TI.due = {
    desc: 'Hạn đóng tiền, còn bao nhiêu ngày, đóng trễ thì sao',
    kw: ['han dong', 'han thanh toan', 'han cuoi', 'deadline', 'khi nao phai dong', 'bao gio phai dong',
      'dong truoc ngay', 'tre han', 'qua han', 'dong tre', 'ngay may phai dong'],
    run(sl) {
      const inv = sl.period ? invOf(sl.period) : currentUnpaid();
      if (!inv || inv.total - inv.paid <= 0) return { facts: {},
        html: sl.period && inv ? `Hóa đơn <b>${vnPeriod(inv.period)}</b> đã thanh toán đủ rồi ạ ✓`
          : 'Hiện chưa có hóa đơn nào đang chờ thanh toán ạ.',
        actions: [{ label: 'Xem hóa đơn', go: '#/invoices' }] };
      const dl = daysLeft(inv.dueDate);
      const late = termsList().find(t => /quá hạn|thanh toán/i.test(t.title + t.body));
      return { facts: { kỳ: vnPeriod(inv.period), hạn: fmtDate(inv.dueDate), còn_lại_ngày: dl, số_tiền: vnd(inv.total - inv.paid) },
        html: `Hóa đơn <b>${vnPeriod(inv.period)}</b> (${vnd(inv.total - inv.paid)}) có hạn <b>${fmtDate(inv.dueDate)}</b>.<br>
          ${dl < 0 ? `<span class="b-warn">Đã quá hạn ${-dl} ngày</span>, anh/chị thanh toán sớm giúp em ạ.` : `Còn <b>${dl} ngày</b> nữa ạ.`}
          ${late && dl < 3 ? `<div class="b-note">Theo hợp đồng: ${esc(late.body)}</div>` : ''}`,
        actions: [{ label: 'Thanh toán ngay', go: '#/pay/' + inv.id, solid: true }],
        suggest: ['Thông tin chuyển khoản'] };
    },
  };

  TI.utilities = {
    desc: 'Điện nước của một tháng: số kWh, tiền điện, tiền nước',
    kw: ['dien nuoc', 'tien dien', 'tien nuoc', 'so dien', 'so nuoc', 'kwh', 'tieu thu', 'xai dien', 'dung dien',
      'so khoi', 'chi so', 'xai het', 'dung het'],
    run(sl) {
      const u = sl.period ? readingOf(sl.period) : latestUsage();
      if (!u) return { facts: {},
        html: sl.period ? `Em chưa thấy chỉ số điện <b>${vnPeriod(sl.period)}</b> của phòng mình ạ.`
          : 'Em chưa thấy chỉ số điện của phòng mình. Anh/chị có thể tự gửi chỉ số để chủ nhà duyệt ạ.',
        actions: [{ label: 'Gửi chỉ số', go: '#/readings', solid: true }] };
      // Tiền điện/nước lấy từ hóa đơn CÙNG KỲ với chỉ số (không lẫn kỳ khác)
      const inv = invOf(u.period);
      const eAmt = lineAmt(inv, /điện/i), wAmt = lineAmt(inv, /nước/i);
      return { facts: { kỳ: u.label, điện_kWh: u.elec, tiền_điện: eAmt != null ? vnd(eAmt) : null, tiền_nước: wAmt != null ? vnd(wAmt) : null },
        html: `<div class="b-title">Điện nước ${esc(u.label)}</div>
          <table>
            <tr><td>Điện</td><td>${u.elec != null ? num(u.elec) + ' kWh' : '-'}</td></tr>
            ${eAmt != null ? `<tr><td>Tiền điện</td><td>${vnd(eAmt)}</td></tr>` : ''}
            ${wAmt != null ? `<tr><td>Tiền nước</td><td>${vnd(wAmt)}</td></tr>` : ''}
          </table>
          <div class="b-note">Tiền nước tính theo số người ở, không theo chỉ số.</div>`,
        actions: [{ label: 'Lịch sử điện', go: '#/usage' }],
        suggest: ['So với tháng trước', 'Giá điện bao nhiêu một số?'] };
    },
  };

  TI.compare = {
    desc: 'So sánh hóa đơn/tiền điện tháng này với tháng trước, vì sao tiền cao hơn',
    kw: ['so voi', 'so sanh', 'cao hon', 'nhieu hon', 'dat hon', 'tang len', 'chenh lech', 'it hon', 'thap hon', 'giam xuong'],
    run(sl) {
      const list = invList();
      const cur = sl.period ? invOf(sl.period) : list[list.length - 1];
      const idx = cur ? list.indexOf(cur) : -1;
      const base = sl.basePeriod ? invOf(sl.basePeriod) : (idx > 0 ? list[idx - 1] : null);
      if (!cur || !base) return { facts: {},
        html: 'Em cần ít nhất <b>2 hóa đơn</b> của phòng mình để so sánh, hiện chưa đủ ạ.',
        actions: [{ label: 'Xem hóa đơn', go: '#/invoices' }] };
      const labels = [];
      [base, cur].forEach(i => (i.lines || []).forEach(l => { if (!labels.includes(l.label)) labels.push(l.label); }));
      const amt = (i, lb) => { const l = (i.lines || []).find(x => x.label === lb); return l ? l.amount : 0; };
      const diffs = labels.map(lb => ({ lb, a: amt(base, lb), b: amt(cur, lb), d: amt(cur, lb) - amt(base, lb) }));
      const total = cur.total - base.total;
      const main = diffs.filter(x => Math.sign(x.d) === Math.sign(total) && x.d !== 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
      const ru = readingOf(cur.period), rb = readingOf(base.period);
      const P0 = vnPeriod(base.period), P1 = vnPeriod(cur.period);
      let why = '';
      if (main) {
        why = `, chủ yếu do <b>${esc(main.lb)}</b> ${main.d > 0 ? 'tăng' : 'giảm'} ${vnd(Math.abs(main.d))}`;
        if (/điện/i.test(main.lb) && ru && rb && ru.elec != null && rb.elec != null) why += ` (dùng ${num(ru.elec)} kWh so với ${num(rb.elec)} kWh)`;
      }
      const head = total === 0 ? `Hóa đơn <b>${P1}</b> bằng đúng <b>${P0}</b>: ${vnd(cur.total)}.`
        : `Hóa đơn <b>${P1}</b> ${total > 0 ? 'cao' : 'thấp'} hơn <b>${P0}</b> <b>${vnd(Math.abs(total))}</b>${why}.`;
      return { facts: { kỳ_gốc: P0, kỳ_so: P1, tổng_kỳ_gốc: vnd(base.total), tổng_kỳ_so: vnd(cur.total), chênh: diffTxt(total),
          theo_khoản: diffs.map(x => ({ khoản: x.lb, [P0]: vnd(x.a), [P1]: vnd(x.b), chênh: diffTxt(x.d) })),
          điện_kWh: { [P0]: rb && rb.elec, [P1]: ru && ru.elec } },
        html: `${head}
          <table><tr><td></td><td><b>${P0}</b></td><td><b>${P1}</b></td></tr>
          ${diffs.map(x => `<tr><td>${esc(x.lb)}</td><td>${vnd(x.a)}</td><td>${vnd(x.b)}${x.d ? `<br><span class="${x.d > 0 ? 'b-warn' : 'b-good'}">${diffTxt(x.d)}</span>` : ''}</td></tr>`).join('')}
          <tr class="sum"><td>Tổng</td><td>${vnd(base.total)}</td><td>${vnd(cur.total)}</td></tr></table>`,
        actions: [{ label: 'Lịch sử điện', go: '#/usage' }],
        suggest: ['Giá điện bao nhiêu một số?', 'Tháng này tôi đóng bao nhiêu?'] };
    },
  };

  TI.contract = {
    desc: 'Hợp đồng: giá thuê, tiền cọc, ngày bắt đầu/hết hạn, còn bao lâu, gia hạn',
    kw: ['hop dong', 'het han', 'gia han', 'thoi han thue', 'tien coc', 'ngay het han', 'bao lau nua', 'con bao nhieu ngay', 'con bao lau', 'ket thuc'],
    run() {
      const c = state.data.contract;
      if (!c) return { facts: {}, html: 'Em chưa thấy thông tin hợp đồng của phòng mình trên hệ thống. Anh/chị vui lòng liên hệ chủ nhà ạ.',
        actions: [{ label: 'Liên hệ chủ nhà', act: 'contact' }] };
      const dl = c.end ? daysLeft(c.end) : null;
      return { facts: { giá_thuê: vnd(c.rent), tiền_cọc: vnd(c.deposit), từ: fmtDate(c.start), đến: fmtDate(c.end), còn_lại_ngày: dl },
        html: `<div class="b-title">Hợp đồng phòng ${esc(state.data.tenant.roomCode || '')}</div>
          <table>
            <tr><td>Giá thuê</td><td>${vnd(c.rent)}</td></tr>
            <tr><td>Tiền cọc</td><td>${vnd(c.deposit)}</td></tr>
            <tr><td>Từ ngày</td><td>${fmtDate(c.start)}</td></tr>
            <tr><td>Đến ngày</td><td>${fmtDate(c.end)}</td></tr>
          </table>
          ${dl != null ? `<div class="b-note">${dl < 0
            ? `<span class="b-warn">Hợp đồng đã hết hạn ${-dl} ngày</span>. Vui lòng liên hệ chủ nhà để gia hạn.`
            : (dl <= 30 ? `<span class="b-warn">Sắp hết hạn, còn ${dl} ngày.</span>` : `Còn <b>${dl} ngày</b>.`)}</div>` : ''}`,
        actions: [{ label: 'Xem điều khoản', go: '#/contract' }],
        suggest: ['Muốn dọn đi thì báo trước bao lâu?', 'Tiền cọc có được trả lại không?'] };
    },
  };

  // Tra điều khoản theo đúng điều người thuê đang hỏi
  const TERM_TOPICS = [
    { re: /(don di|tra phong|cham dut|chuyen di|bao truoc|ket thuc som)/, tr: /chấm dứt/i },
    { re: /(tien coc|coc|hoan tra|tra lai coc)/, tr: /cọc/i },
    { re: /(hu hong|lam hong|boi thuong|den bu|tai san)/, tr: /tài sản|bồi thường/i },
    { re: /(sua chua|cai tao|khoan|son lai|dong dinh)/, tr: /sửa chữa|cải tạo/i },
    { re: /(tre han|qua han|dong tre|cham dong)/, tr: /thanh toán/i },
    { re: /(tam tru|an ninh|pccc|chay no|on ao|gio giac|nuoi|thu cung|khach|ban be o lai)/, tr: /an ninh|nội quy/i },
    { re: /(sang nhuong|cho thue lai|nhuong lai|o ghep)/, tr: /Bên B|chuyển nhượng/i },
    { re: /(dien|nuoc|dich vu|internet|wifi)/, tr: /dịch vụ/i },
  ];
  TI.terms = {
    desc: 'Điều khoản, nội quy: báo trước khi dọn đi, trả cọc, bồi thường, nuôi thú, tạm trú…',
    kw: ['dieu khoan', 'noi quy', 'quy dinh', 'duoc phep', 'co duoc', 'bao truoc', 'don di', 'tra phong', 'tra lai coc',
      'hoan coc', 'tra lai', 'hoan tra', 'lay lai coc', 'mat coc', 'boi thuong', 'nuoi', 'thu cung', 'tam tru', 'o ghep',
      'sang nhuong', 'cham dut'],
    run(sl, text) {
      const t = norm(text);
      const all = termsList();
      const topic = TERM_TOPICS.find(x => x.re.test(t));
      const hits = topic ? all.filter(x => topic.tr.test(x.title + ' ' + x.body)) : [];
      if (hits.length) {
        return { facts: { điều_khoản_liên_quan: hits },
          html: `Theo hợp đồng của anh/chị:${hits.slice(0, 2).map(x =>
            `<div class="b-term"><b>${esc(x.title)}</b><br>${esc(x.body)}</div>`).join('')}
            <div class="b-note">Trường hợp cụ thể anh/chị nên hỏi thêm chủ nhà ạ.</div>`,
          actions: [{ label: 'Xem đủ điều khoản', go: '#/contract' }, { label: 'Hỏi chủ nhà', act: 'contact' }] };
      }
      return { facts: { số_điều_khoản: all.length, tiêu_đề: all.map(x => x.title) },
        html: `Hợp đồng có <b>${all.length}</b> điều khoản:<br>${all.map((x, i) => `${i + 1}. ${esc(x.title)}`).join('<br>')}
          <div class="b-note">Anh/chị hỏi cụ thể (ví dụ “dọn đi thì báo trước bao lâu?”) em sẽ trích đúng điều đó.</div>`,
        actions: [{ label: 'Xem đầy đủ', go: '#/contract' }] };
    },
  };

  // Báo hỏng: có đồ vật + trạng thái hỏng -> THẺ XÁC NHẬN trước khi tạo phiếu
  const BROKEN = /\b(hong|hu|ro ri|chay nuoc|tac|nghet|chap dien|chap mach|khong (len|chay|mat|vao|sang|lanh|nong|xa|dong|mo)|mat (dien|nuoc|mang|wifi)|bi yeu|keu to|bi ket)\b/;
  TI.repair = {
    desc: 'Báo hỏng thiết bị, yêu cầu sửa chữa mới',
    kw: ['bao hong', 'bi hong', 'hu hong', 'bi hu', 'sua chua', 'sua giup', 'khong len', 'khong chay', 'ro ri', 'chap dien',
      'mat dien', 'mat nuoc', 'bi tac', 'khong mat', 'chay nuoc', 'hong roi', 'can sua', 'mat mang', 'mat wifi'],
    neg: ['theo doi', 'tien do', 'sua xong chua', 'da sua chua', 'khi nao sua', 'bao gio sua'],
    run(sl, text) {
      const t = norm(text);
      const cat = hasAny(t, ['may lanh', 'dieu hoa', 'khong mat']) ? 'Máy lạnh'
        : hasAny(t, ['wifi', 'mang', 'internet']) ? 'Internet'
        : hasAny(t, ['chap dien', 'o cam', 'bong den', 'den ', 'mat dien', 'cup dien', 'aptomat', 'dien']) ? 'Điện'
        : hasAny(t, ['nuoc', 'voi', 'ro ri', 'bon cau', 'tac', 'nghet', 'binh nong lanh']) ? 'Nước'
        : 'Khác';
      const title = text.trim().replace(/^(cho|giup|toi|minh|em|anh|chi|phong)\s+/i, '');
      return { facts: { loại: cat, nội_dung: title },
        html: `Em sẽ tạo <b>yêu cầu sửa chữa</b> với nội dung:
          <div class="b-term"><b>${esc(cat)}</b><br>"${esc(title)}"</div>
          Anh/chị xác nhận giúp em ạ?`,
        actions: [{ label: 'Xác nhận gửi', act: 'mkincident', data: { cat, title }, solid: true },
          { label: 'Sửa lại / thêm ảnh', go: '#/repair' }] };
    },
  };

  TI.track = {
    desc: 'Theo dõi tiến độ các yêu cầu sửa chữa đã gửi',
    kw: ['theo doi', 'tien do', 'yeu cau cua toi', 'sua xong chua', 'da sua chua', 'khi nao sua', 'bao gio sua', 'da bao hong'],
    run() {
      const inc = state.data.incidents || [];
      if (!inc.length) return { facts: {}, html: 'Anh/chị chưa gửi yêu cầu sửa chữa nào ạ.',
        actions: [{ label: 'Báo hỏng', go: '#/repair', solid: true }] };
      const open = inc.filter(x => x.status !== 'done');
      return { facts: { đang_xử_lý: open.length, danh_sách: inc.slice(0, 5).map(x => ({ nội_dung: x.title, trạng_thái: incStatusLabel(x.status), ngày: fmtDate(x.createdAt) })) },
        html: `${open.length ? `Có <b>${open.length}</b> yêu cầu đang chờ/đang xử lý:` : 'Tất cả yêu cầu đã được xử lý xong ✓'}
          <table>${inc.slice(0, 5).map(x => `<tr><td>${esc(x.title)}<br><span class="b-muted">${fmtDate(x.createdAt)}</span></td>
            <td>${incStatusLabel(x.status)}</td></tr>`).join('')}</table>`,
        actions: [{ label: 'Xem chi tiết', go: '#/track' }] };
    },
  };

  TI.payinfo = {
    desc: 'Cách thanh toán, số tài khoản ngân hàng, mã QR, nội dung chuyển khoản',
    kw: ['chuyen khoan', 'ngan hang', 'stk', 'so tai khoan', 'ma qr', 'quet ma', 'tra tien o dau', 'dong tien o dau',
      'thanh toan the nao', 'cach thanh toan', 'noi dung chuyen', 'ghi noi dung'],
    run() {
      const inv = currentUnpaid();
      return { facts: { ngân_hàng: BANK.name, số_tài_khoản: BANK.account, chủ_tài_khoản: BANK.holder,
          nội_dung: payContent(inv) || state.data.tenant.roomCode, số_tiền: inv ? vnd(inv.total - inv.paid) : '0 ₫' },
        html: `Anh/chị quét <b>mã VietQR</b> hoặc chuyển khoản:
          <table>
            <tr><td>Ngân hàng</td><td>${esc(BANK.name)}</td></tr>
            <tr><td>Số tài khoản</td><td>${esc(BANK.account)}</td></tr>
            <tr><td>Chủ tài khoản</td><td>${esc(BANK.holder)}</td></tr>
            ${inv ? `<tr><td>Số tiền</td><td>${vnd(inv.total - inv.paid)}</td></tr>
            <tr><td>Nội dung</td><td><b>${esc(payContent(inv))}</b></td></tr>` : ''}
          </table>
          <div class="b-note">Ghi đúng nội dung thì hệ thống tự trừ công nợ, không cần chờ chủ nhà duyệt.</div>`,
        actions: inv ? [{ label: 'Mở mã QR', go: '#/pay/' + inv.id, solid: true }] : [] };
    },
  };

  TI.history = {
    desc: 'Lịch sử đã thanh toán, biên lai, phiếu thu',
    kw: ['da dong', 'lich su', 'bien lai', 'phieu thu', 'da tra', 'da thanh toan', 'thang nao da dong', 'da chuyen'],
    run(sl) {
      let p = (state.data.payments || []).slice();
      if (sl.months) {
        const from = NLU.shiftPeriod(CUR_PERIOD, -(sl.months - 1));
        p = p.filter(x => (x.date || '').slice(0, 7) >= from);
      }
      if (!p.length) return { facts: {}, html: 'Em chưa thấy lịch sử thanh toán nào ạ.' };
      const total = p.reduce((s, x) => s + x.amount, 0);
      return { facts: { số_lần: p.length, tổng: vnd(total), gần_nhất: { số_tiền: vnd(p[0].amount), ngày: fmtDate(p[0].date) } },
        html: `Anh/chị đã thanh toán <b>${vnd(total)}</b> qua <b>${p.length}</b> lần${sl.months ? ` trong ${sl.months} tháng gần đây` : ''}:
          <table>${p.slice(0, 5).map(x => `<tr><td>${fmtDate(x.date)}</td><td>${vnd(x.amount)}</td></tr>`).join('')}</table>`,
        actions: [{ label: 'Xem lịch sử', go: '#/history' }] };
    },
  };

  TI.prices = {
    desc: 'Bảng giá dịch vụ: giá điện một số, giá nước, phí rác, internet',
    kw: ['gia dich vu', 'don gia', 'bang gia', 'gia dien', 'gia nuoc', 'phi rac', 'gia internet', 'wifi bao nhieu',
      'bao nhieu mot so', 'bao nhieu 1 so', 'bao nhieu mot khoi', 'mot so dien', 'phi dich vu'],
    run() {
      const svcs = state.data.services || [];
      if (!svcs.length) return { facts: {}, html: 'Em chưa có bảng giá dịch vụ trên hệ thống. Anh/chị vui lòng hỏi chủ nhà ạ.',
        actions: [{ label: 'Liên hệ chủ nhà', act: 'contact' }] };
      return { facts: { tiền_phòng: vnd(state.data.room.price), dịch_vụ: svcs.map(s => ({ tên: s.name, giá: num(s.unit) + ' ' + (s.unitLabel || '') })) },
        html: `<div class="b-title">Bảng giá dịch vụ</div><table>
          <tr><td>Tiền phòng</td><td>${vnd(state.data.room.price)}</td></tr>
          ${svcs.map(s => `<tr><td>${esc(s.name)}</td><td>${num(s.unit)} ${esc((s.unitLabel || '').replace('₫', 'đ'))}</td></tr>`).join('')}
          </table>`, actions: [{ label: 'Xem đầy đủ', go: '#/services' }] };
    },
  };

  TI.assets = {
    desc: 'Tài sản, đồ đạc, thiết bị có trong phòng',
    kw: ['tai san', 'do dac', 'thiet bi', 'trong phong co gi', 'noi that', 'co nhung gi', 'duoc trang bi'],
    run() {
      const a = state.data.assets || [];
      if (!a.length) return { facts: {}, html: 'Phòng mình chưa có danh sách tài sản trên hệ thống ạ.' };
      return { facts: { tài_sản: a.map(x => x.name) },
        html: `Phòng <b>${esc(state.data.tenant.roomCode)}</b> có <b>${a.length}</b> tài sản:<br>
          ${a.map(x => `• ${esc(x.name)}${(x.quantity || 1) > 1 ? ' ×' + x.quantity : ''}`).join('<br>')}
          <div class="b-note">Vui lòng giữ gìn giúp em ạ. Hư hỏng do sử dụng sai sẽ phải bồi thường theo hợp đồng.</div>`,
        actions: [{ label: 'Xem phòng của tôi', go: '#/room' }] };
    },
  };

  TI.room = {
    desc: 'Thông tin phòng: diện tích, tầng, giá, người ở cùng',
    kw: ['phong cua toi', 'phong toi', 'dien tich', 'bao nhieu met', 'o chung', 'o cung', 'cung phong', 'may nguoi', 'tang may'],
    run() {
      const d = state.data, r = d.room || {};
      const mates = (d.roommates || []).map(x => x.fullName).filter(Boolean);
      return { facts: { phòng: r.code, tầng: r.floor, diện_tích: r.area, giá: vnd(r.price), người_ở: mates },
        html: `<div class="b-title">Phòng ${esc(r.code || d.tenant.roomCode || '')}</div>
          <table>
            ${r.area ? `<tr><td>Diện tích</td><td>${r.area} m²</td></tr>` : ''}
            ${r.floor ? `<tr><td>Tầng</td><td>${r.floor}</td></tr>` : ''}
            <tr><td>Giá thuê</td><td>${vnd(r.price)}</td></tr>
            <tr><td>Người ở</td><td>${mates.length ? mates.map(esc).join('<br>') : esc(d.tenant.fullName)}</td></tr>
          </table>`,
        actions: [{ label: 'Phòng của tôi', go: '#/room' }] };
    },
  };

  TI.contact = {
    desc: 'Liên hệ chủ nhà, số điện thoại quản lý',
    kw: ['lien he', 'so dien thoai chu', 'goi chu', 'chu nha', 'chu tro', 'quan ly', 'gap ai', 'hotline', 'nguoi phu trach'],
    run() {
      const b = state.data.building || {};
      return { facts: { tòa: b.name, điện_thoại: b.contactPhone || null },
        html: b.contactPhone ? `Chủ nhà <b>${esc(b.name || '')}</b>: <b>${esc(b.contactPhone)}</b>.` : 'Em kết nối anh/chị với chủ nhà nhé.',
        actions: [{ label: 'Gọi chủ nhà', act: 'contact', solid: true }] };
    },
  };

  TI.help = {
    desc: 'Hỏi trợ lý làm được gì',
    kw: ['giup gi', 'lam duoc gi', 'hoi duoc gi', 'huong dan', 'em la ai', 'ban la ai', 'ho tro gi'],
    run() {
      return { facts: {},
        html: `Em tra cứu <b>dữ liệu thật</b> của phòng mình và hiểu được <b>tháng</b> trong câu hỏi. Anh/chị thử:
          <table>
            <tr><td>Tiền</td><td>Tháng 7 tôi đóng bao nhiêu?</td></tr>
            <tr><td>Vì sao</td><td>Sao tháng này tiền cao hơn?</td></tr>
            <tr><td>Điện nước</td><td>Tiền điện tháng trước</td></tr>
            <tr><td>Hợp đồng</td><td>Dọn đi thì báo trước bao lâu?</td></tr>
            <tr><td>Sửa chữa</td><td>Máy lạnh không mát · Sửa xong chưa?</td></tr>
          </table>`,
        suggest: SUGGESTIONS.slice(0, 3) };
    },
  };

  /* ---------- hiểu câu hỏi ---------- */
  const T_GREET = /^(xin chao|chao|hello|hi|alo|chao em|chao ban)( (em|ban|bot|tro ly|anh|chi))?$/;

  function understand(text, forced) {
    const t = norm(text);
    const ctx = chat.ctx;
    const last = ctx.get();
    const ranked = NLU.score(text, TI);
    let intent = forced || (ranked[0] && ranked[0].score >= 2 ? ranked[0].key : null);

    // "Sao tháng này tiền điện cao vậy?" -> so sánh (dù có chữ "tiền điện")
    if (!forced && /\b(cao|tang|nhieu|dat|giam|it|thap|chenh|khac)\b/.test(t)
      && /\b(sao|tai sao|vi sao|so voi|hon|the nao ma)\b/.test(t)
      && /\b(tien|hoa don|dien|nuoc|thang)\b/.test(t)) intent = 'compare';
    // Có đồ vật đang hỏng mà chưa hỏi tiến độ -> báo hỏng
    if (!forced && (!intent || intent === 'utilities') && BROKEN.test(t) && !/theo doi|tien do|xong chua/.test(t)) intent = 'repair';

    const p = NLU.extractPeriod(text, CUR_PERIOD);
    const slots = { period: p ? p.period : null, months: NLU.extractMonths(text), basePeriod: null };
    const carried = [];
    const follow = NLU.looksFollowUp(text);

    if (!intent && last && (slots.period || slots.months || follow)) { intent = last.intent; carried.push('hỏi tiếp'); }
    if (!intent) return null;

    if (intent === 'compare') {
      const parts = t.split(/\bso voi\b/);
      if (parts.length > 1) {
        const a = NLU.extractPeriod(parts[0], CUR_PERIOD), b = NLU.extractPeriod(parts.slice(1).join(' '), CUR_PERIOD);
        slots.period = a ? a.period : (last && last.slots.period) || null;
        if (b) slots.basePeriod = b.how === 'prev' && slots.period ? NLU.shiftPeriod(slots.period, -1) : b.period;
      }
    } else if (!slots.period && last && last.slots.period && (follow || carried.length)) {
      slots.period = last.slots.period; carried.push(vnPeriod(slots.period));
    }
    return { intent, slots, carried };
  }

  const T_LABEL = { invoice: 'hóa đơn', due: 'hạn đóng', utilities: 'điện nước', compare: 'so sánh hóa đơn',
    contract: 'hợp đồng', terms: 'điều khoản', repair: 'báo hỏng', track: 'tiến độ sửa chữa', payinfo: 'chuyển khoản',
    history: 'lịch sử thanh toán', prices: 'bảng giá', assets: 'tài sản', room: 'phòng', contact: 'liên hệ', help: 'hướng dẫn' };

  /** Tầng 1: trả lời bằng dữ liệu thật. null = không hiểu */
  function answer(text, forced) {
    if (!NLU) return { html: 'Trợ lý chưa tải xong, anh/chị tải lại trang giúp em ạ.' };
    if (T_GREET.test(norm(text))) {
      return { html: `Chào anh/chị <b>${esc(state.data.tenant.fullName)}</b>! Em có thể giúp gì cho phòng <b>${esc(state.data.tenant.roomCode || '')}</b> ạ?`,
        suggest: SUGGESTIONS.slice(0, 4) };
    }
    const u = understand(text, forced);
    if (!u) return null;
    const r = TI[u.intent].run(u.slots, text);
    chat.ctx.set(u.intent, u.slots);
    const scope = u.slots.period ? vnPeriod(u.slots.period) : '';
    return Object.assign({}, r, { intent: u.intent,
      note: u.carried.length ? `Hiểu là: ${T_LABEL[u.intent]}${scope ? ' · ' + scope : ''}` : '' });
  }

  /* ============================================================
     TẦNG 2 — GEMINI FLASH (chỉ chạy khi tầng 1 không hiểu)
     Mô hình CHỈ: (a) phân loại ý định + tháng, (b) soạn lời văn từ số thật.
     Số liệu luôn do code lấy từ dữ liệu của CHÍNH khách đang đăng nhập.
     ============================================================ */
  const T_INTENTS = Object.keys(TI).map(k => ({ key: k, desc: TI[k].desc,
    params: ['invoice', 'due', 'utilities', 'compare'].includes(k) ? 'period' : (k === 'history' ? 'months' : '') }));

  async function aiAnswer(text) {
    const G = window.HHGemini;
    if (!G || !G.configured() || !NLU) return null;
    try {
      const last = chat.ctx.get();
      const ck = 't|' + norm(text) + '|' + (last ? last.intent + (last.slots.period || '') : '');
      const cls = G.cacheGet(ck) || await G.classify(text, T_INTENTS, {
        today: CUR_PERIOD,
        context: last ? `Câu trước khách hỏi về "${T_LABEL[last.intent]}"${last.slots.period ? ' tháng ' + vnPeriod(last.slots.period) : ''}.` : '',
      });
      G.cacheSet(ck, cls);
      if (cls.intent === 'unknown' || cls.confidence < 0.35 || !TI[cls.intent]) return null;
      // Kiểm tra tham số mô hình đưa: kỳ phải đúng dạng YYYY-MM
      const p = cls.params || {};
      const per = /^\d{4}-(0[1-9]|1[0-2])$/.test(p.period || '') ? p.period : null;
      const r = answer(text + (per ? ' ' + per.split('-')[1] + '/' + per.split('-')[0] : ''), cls.intent);
      if (!r || r.html == null) return null;
      // Thẻ xác nhận (báo hỏng) và bảng số giữ nguyên; còn lại để Gemini viết lời tự nhiên hơn
      if (cls.intent === 'repair' || /<table/.test(r.html)) return r;
      const composed = await G.compose(text, r.facts || {},
        'Xưng "em", gọi khách là "anh/chị". Người hỏi là khách đang thuê phòng. Thân thiện, ngắn gọn.');
      return Object.assign({}, r, { html: composed.replace(/```[a-z]*|```/g, '').trim(), ai: true });
    } catch (e) {
      return null;   // hết lượt / lỗi mạng -> quay về luồng chuyển cho quản lý
    }
  }

  /* ---------- màn hình chat ---------- */
  function screenChat() {
    loadChat();
    if (!chat.msgs.length) {
      pushMsg('bot', `Chào anh/chị <b>${esc(state.data.tenant.fullName)}</b>! Em là trợ lý của Happy Home.<br>
        Em tra cứu <b>tiền phòng, điện nước, hợp đồng</b> theo đúng tháng anh/chị hỏi, giải thích vì sao hóa đơn thay đổi,
        và <b>tạo yêu cầu sửa chữa</b> giúp anh/chị.`, [], false, { suggest: SUGGESTIONS });
    }
    const lastBot = [...chat.msgs].reverse().find(m => m.who === 'bot');
    const sugg = (lastBot && lastBot.suggest && lastBot.suggest.length) ? lastBot.suggest : SUGGESTIONS;
    const body = chat.msgs.map((m, i) => `
      <div class="chat-msg ${m.who === 'me' ? 'me' : ''}">
        <div class="bubble">${m.note ? `<div class="b-ctx">${HH.ic('refresh', 16)} ${esc(m.note)}</div>` : ''}${m.html}
          ${m.ai ? '<span class="b-ai">' + HH.ic('sparkles', 16) + ' lời văn do Gemini soạn · số liệu lấy từ hệ thống</span>' : ''}
          ${(m.actions || []).length ? `<div class="b-actions">${m.actions.map((a, j) =>
            `<button class="b-act ${a.solid ? 'solid' : ''}" data-mi="${i}" data-ai="${j}">${esc(a.label)}</button>`).join('')}</div>` : ''}
        </div></div>`).join('');

    el('tapp').innerHTML = `<div class="t-app">${sidebar()}<div class="chat-wrap">
      <div class="t-header plain"><button class="back" id="back" aria-label="Quay lại">←</button>
        <div class="htitle">Trợ lý Happy Home</div>
        <button class="chat-new" id="chatNew" title="Cuộc trò chuyện mới">Trò chuyện mới</button></div>
      <div class="chat-body" id="chatBody" aria-live="polite">${body}${chat.busy ? '<div class="chat-typing"><i></i><i></i><i></i></div>' : ''}</div>
      <div class="chat-sugg">${sugg.map(s => `<button data-sugg="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <div class="chat-input">
        <textarea id="chatIn" rows="1" placeholder="Hỏi về tiền phòng, điện nước, hợp đồng…"></textarea>
        <button class="chat-send" id="chatSend" aria-label="Gửi">${HH.ic('send', 16)}</button>
      </div></div></div>`;

    wireTabs();
    const slo2 = el('sideLogout');
    if (slo2) slo2.onclick = () => { try { localStorage.removeItem(PHONE_KEY); sessionStorage.removeItem(chatKey()); } catch (e) {}
      state.phone = null; state.data = null; go('#/login'); };
    el('back').onclick = () => go('#/home');
    el('chatNew').onclick = () => { chat.msgs = []; chat.ctx.clear(); saveChat(); screenChat(); };
    const bodyEl = el('chatBody'); bodyEl.scrollTop = bodyEl.scrollHeight;
    const inp = el('chatIn');
    const send = () => { const v = inp.value.trim(); if (!v || chat.busy) return; inp.value = ''; inp.style.height = 'auto'; ask(v); };
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
      if (a.act === 'forward') return forwardToLandlord(a.data);
    });
  }

  async function ask(text) {
    if (chat.busy) return;
    pushMsg('me', esc(text));
    chat.busy = true; screenChat();

    // Tầng 1 — hiểu câu tại chỗ (miễn phí, tức thì)
    await new Promise(r => setTimeout(r, 320));
    let res = answer(text);

    // Tầng 2 — Gemini Flash (chỉ khi tầng 1 không hiểu)
    if (!res) res = await aiAnswer(text);
    chat.busy = false;

    if (res) {
      pushMsg('bot', res.html, res.actions, res.ai, { suggest: res.suggest, note: res.note });
    } else {
      // Tầng 3 — nói thật là chưa hiểu, HỎI trước khi chuyển cho chủ nhà (tránh gửi nhầm câu linh tinh)
      pushMsg('bot', `Câu này em chưa trả lời được ạ. Anh/chị muốn em <b>chuyển câu hỏi cho chủ nhà</b> không?`,
        [{ label: 'Gửi cho chủ nhà', act: 'forward', data: text, solid: true }, { label: 'Em làm được gì?', send: 'Bạn giúp được gì?' }]);
    }
    screenChat();
  }

  // Khách đồng ý -> gửi câu hỏi cho chủ nhà (đúng đặc tả §5.1)
  async function forwardToLandlord(text) {
    if (!text) return;
    pushMsg('bot', 'Em đang chuyển câu hỏi...'); screenChat();
    try {
      await rpc('tenant_create_incident', { p_phone: state.phone, p_category: 'Khác', p_title: '[Câu hỏi] ' + text });
      state.data = await loadData(state.phone);
      chat.msgs.pop();
      pushMsg('bot', `Em đã <b>chuyển câu hỏi cho chủ nhà</b> ✓ Anh/chị sẽ được trả lời trong giờ làm việc.`,
        [{ label: 'Gọi ngay', act: 'contact' }]);
    } catch (e) {
      chat.msgs.pop();
      pushMsg('bot', 'Em chuyển chưa được ạ. Anh/chị gọi trực tiếp chủ nhà giúp em nhé.',
        [{ label: 'Gọi chủ nhà', act: 'contact', solid: true }]);
    }
    screenChat();
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

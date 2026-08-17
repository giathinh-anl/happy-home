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
  const BANK = { name: 'MB Bank', account: '0912345678', holder: 'CTY HAPPY HOME' };
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
    return screenHome();
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
           <button class="iconbtn" id="logout" title="Đăng xuất">⎋</button></div>`
      : `<div class="t-header plain"><button class="back" id="back">←</button><div class="htitle">${esc(title)}</div></div>`;
    el('tapp').innerHTML = `<div class="t-app">${header}<div class="t-main">${body}</div></div>`;
    const back = el('back'); if (back) back.onclick = () => history.length > 1 ? history.back() : go('#/home');
    const lo = el('logout'); if (lo) lo.onclick = () => { try { localStorage.removeItem(PHONE_KEY); } catch (e) {} state.phone = null; state.data = null; go('#/login'); };
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
    shell('', `
      <div class="room-head"><div class="rname">Phòng ${esc(d.room.code || d.tenant.roomCode)}</div>
        <div class="bname">${esc(d.building.name || '')}</div></div>
      ${dueCard}
      <div class="section-title">Truy cập nhanh</div>
      <div class="quick-grid">
        <button class="quick-item" data-nav="#/invoices"><div class="qic" style="background:var(--info-bg)">🧾</div><div class="qlabel">Hóa đơn</div></button>
        <button class="quick-item" data-nav="#/readings"><div class="qic" style="background:var(--brand-50)">📷</div><div class="qlabel">Ghi chỉ số</div></button>
        <button class="quick-item" data-nav="#/repair"><div class="qic" style="background:var(--warning-bg)">🔧</div><div class="qlabel">Báo hỏng</div></button>
      </div>
      <div class="section-title">Thông báo gần đây</div>
      <div class="t-card">${notis || '<div class="muted" style="color:var(--neutral-400);text-align:center;padding:8px">Chưa có thông báo</div>'}</div>
    `, { home: true });
    const pn = el('payNow'); if (pn) pn.onclick = () => go('#/pay/' + inv.id);
    document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => go(b.dataset.nav));
  }

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
    shell('Hóa đơn', rows || `<div class="t-empty"><div class="eic">🧾</div><p>Chưa có hóa đơn nào</p></div>`);
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
    const content = `${state.data.room.code} ${vnPeriod(inv.period)}`;
    const qrData = encodeURIComponent(`${BANK.name} ${BANK.account} ${BANK.holder} ${remain} ${content}`);
    shell('Thanh toán', `
      <div style="text-align:center;margin-bottom:8px">
        <div style="color:var(--neutral-600)">Hóa đơn ${vnPeriod(inv.period)}</div>
        <div class="mono" style="font-size:28px;font-weight:800">${vnd(remain)}</div>
      </div>
      <div class="qr-box">
        <img class="qr-img" alt="Mã QR" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}"
          onerror="this.outerHTML='<div class=&quot;qr-fallback&quot;></div>'">
        <div style="color:var(--neutral-600);font-size:14px">Quét mã bằng ứng dụng ngân hàng để thanh toán</div>
      </div>
      <div class="divider">hoặc</div>
      <div class="t-card">
        <div style="font-weight:700;margin-bottom:6px">Chuyển khoản thủ công</div>
        <div class="bank-row"><span class="bk">Ngân hàng</span><span class="bv">${BANK.name}</span></div>
        <div class="bank-row"><span class="bk">Số tài khoản</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${BANK.account}</span><button class="copybtn" data-copy="${BANK.account}" data-l="số tài khoản">📋</button></span></div>
        <div class="bank-row"><span class="bk">Chủ tài khoản</span><span class="bv">${BANK.holder}</span></div>
        <div class="bank-row"><span class="bk">Số tiền</span><span style="display:flex;gap:8px;align-items:center"><span class="bv mono">${num(remain)}</span><button class="copybtn" data-copy="${remain}" data-l="số tiền">📋</button></span></div>
        <div class="bank-row"><span class="bk">Nội dung</span><span style="display:flex;gap:8px;align-items:center"><span class="bv">${esc(content)}</span><button class="copybtn" data-copy="${esc(content)}" data-l="nội dung">📋</button></span></div>
      </div>
      <button class="t-btn" id="paid" style="margin-top:6px">Tôi đã chuyển khoản</button>
    `);
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(b.dataset.copy, b.dataset.l));
    el('paid').onclick = async (e) => {
      e.currentTarget.classList.add('loading');
      try { await rpc('tenant_notify_paid', { p_phone: state.phone, p_invoice_id: inv.id }); toast('Đã báo chủ trọ. Cảm ơn bạn!'); go('#/home'); }
      catch (err) { toast(err.message === 'NOT_ACTIVATED' ? 'Chưa kích hoạt (cần chạy SQL)' : 'Không gửi được, thử lại'); e.currentTarget.classList.remove('loading'); }
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
        await rpc('tenant_create_incident', { p_phone: state.phone, p_category: r.cat, p_title: title });
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

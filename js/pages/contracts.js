/* ============================================================
   Trang: Hợp đồng — danh sách, lập mới (5 bước), trả phòng & thanh lý
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  /* ---------------- DANH SÁCH + NHẮC HẾT HẠN ---------------- */
  // Nhãn đếm ngược theo mức độ khẩn
  function expiryChip(c) {
    const lvl = S.expiryLevel(c), d = S.daysToExpiry(c);
    if (c.status === 'terminated') return '<span class="faint">—</span>';
    if (d == null) return '<span class="faint">—</span>';
    if (lvl === 'expired') return `<span class="exp-chip expired">⛔ Quá hạn ${Math.abs(d)} ngày</span>`;
    if (lvl === 'urgent') return `<span class="exp-chip urgent">🔥 Còn ${d} ngày</span>`;
    if (lvl === 'soon') return `<span class="exp-chip soon">⚠ Còn ${d} ngày</span>`;
    if (lvl === 'watch') return `<span class="exp-chip watch">Còn ${d} ngày</span>`;
    return `<span class="faint">Còn ${d} ngày</span>`;
  }

  const CT_FILTERS = [
    { key: 'expired', label: 'Đã quá hạn', tone: 'danger', test: c => S.expiryLevel(c) === 'expired' },
    { key: 'urgent', label: 'Hết hạn ≤ 7 ngày', tone: 'danger', test: c => S.expiryLevel(c) === 'urgent' },
    { key: 'soon', label: 'Sắp hết hạn ≤ 30 ngày', tone: 'warning', test: c => { const l = S.expiryLevel(c); return l === 'soon' || l === 'urgent'; } },
    { key: 'active', label: 'Đang hiệu lực', tone: 'success', test: c => c.status === 'active' },
    { key: 'terminated', label: 'Đã thanh lý', tone: 'neutral', test: c => c.status === 'terminated' },
  ];

  HH.pages.contracts = {
    render(ctx) {
      const all = S.contractsOf(ctx.bid);
      const q = new URLSearchParams((location.hash.split('?')[1] || ''));
      const filterKey = q.get('filter');
      const f = CT_FILTERS.find(x => x.key === filterKey);
      const rows = f ? all.filter(f.test) : all;

      // --- Khối nhắc nhở sắp hết hạn ---
      const expired = S.expiringContracts(ctx.bid, -1);
      const urgent = S.expiringContracts(ctx.bid, 7).filter(c => S.daysToExpiry(c) >= 0);
      const soon = S.expiringContracts(ctx.bid, 30).filter(c => S.daysToExpiry(c) > 7);
      let reminder = '';
      if (expired.length || urgent.length || soon.length) {
        const line = (list, cls, icon, label) => list.length ? `<div class="rem-line">
          <span class="rem-ic ${cls}">${icon}</span>
          <div class="grow"><b>${list.length} hợp đồng ${label}</b>
            <div class="muted text-xs">${list.slice(0, 6).map(c => `${c.roomCode} (${c.tenantName})`).join(' · ')}${list.length > 6 ? ' …' : ''}</div></div>
          <button class="btn btn-sm ${cls === 'danger' ? 'btn-danger' : 'btn-outline'}" data-remfilter="${cls === 'danger' && icon === '⛔' ? 'expired' : (icon === '🔥' ? 'urgent' : 'soon')}">Xem</button>
        </div>` : '';
        reminder = `<div class="reminder-box ${expired.length || urgent.length ? 'alarm' : ''}">
          <div class="rem-head"><span>🔔</span><b>Nhắc nhở hạn hợp đồng</b>
            <span class="muted text-xs">Cập nhật ${U.fmtDate(U.today())}</span></div>
          ${line(expired, 'danger', '⛔', 'ĐÃ QUÁ HẠN — cần gia hạn hoặc thanh lý')}
          ${line(urgent, 'danger', '🔥', 'hết hạn trong 7 ngày')}
          ${line(soon, 'warning', '⚠', 'sắp hết hạn trong 30 ngày')}
        </div>`;
      }

      const chips = CT_FILTERS.map(x => {
        const n = all.filter(x.test).length;
        const on = filterKey === x.key;
        return `<button class="lz-chip ${on ? 'on' : ''}" data-ctfilter="${x.key}">
          <span class="lz-chip-box">${on ? '✓' : ''}</span>${x.label}
          <span class="lz-chip-cnt s-${x.tone}">${n}</span></button>`;
      }).join('');

      const dt = UI.DataTable({
        rows, rowId: c => c.id, searchKeys: ['id', 'roomCode', 'tenantName'],
        searchPlaceholder: 'Tìm mã HĐ, phòng, khách...',
        emptyTitle: 'Chưa có hợp đồng nào', emptyIcon: '📄',
        emptyAction: { label: 'Lập hợp đồng', onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/new`) },
        columns: [
          { key: 'roomCode', label: 'Phòng', sortable: true, render: c => `<span class="badge s-info"><span class="dot"></span>${c.roomCode}</span>` },
          { key: 'tenantName', label: 'Khách thuê', sortable: true, render: c => `<b>${U.esc(c.tenantName)}</b>` },
          { key: 'rent', label: 'Giá thuê', align: 'right', sortable: true, render: c => U.currency(c.rent) },
          { key: 'deposit', label: 'Tiền cọc', align: 'right', render: c => U.currency(c.deposit) },
          { key: 'start', label: 'Bắt đầu', render: c => `<span class="mono">${U.fmtDate(c.start)}</span>` },
          { key: 'end', label: 'Kết thúc', sortable: true, sortVal: c => new Date(c.end).getTime(),
            render: c => `<span class="mono">${U.fmtDate(c.end)}</span>` },
          { key: 'expiry', label: 'Còn lại', sortVal: c => S.daysToExpiry(c) || 9999, sortable: true, render: c => expiryChip(c) },
          { key: 'status', label: 'Trạng thái', render: c => UI.statusBadge(
              c.status === 'active' && c.expiringSoon ? 'expiring' : c.status, 'contract') },
        ],
        onRowClick: c => HH.router.go(`/b/${ctx.bid}/contracts/${c.id}`),
        rowClass: c => { const l = S.expiryLevel(c); return l === 'expired' ? 'row-expired' : (l === 'urgent' ? 'row-urgent' : ''); },
        actions: c => contractActions(ctx, c),
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">📄</span>
          <div><div class="page-title-lg">Hợp đồng</div>
          <div class="page-sub">${ctx.building.name} · ${all.length} hợp đồng${raw(f ? ` · lọc: ${f.label}` : '')}</div></div></div>
        <div class="page-actions">
          <button class="btn btn-success" id="ctExport">📊 Xuất excel</button>
          <button class="btn btn-primary" data-primary-new>+ Lập hợp đồng</button></div>
      </div>
      ${raw(reminder)}
      <div class="lz-chips"><span class="lz-chips-ic">▽</span>${raw(chips)}</div>
      ${raw(dt.render())}`;
    },
    mount(ctx) {
      ctx._dt.attach(document);
      document.querySelector('[data-primary-new]').onclick = () => HH.router.go(`/b/${ctx.bid}/contracts/new`);
      document.querySelectorAll('[data-ctfilter]').forEach(b => b.onclick = () => {
        const k = b.dataset.ctfilter;
        const cur = new URLSearchParams((location.hash.split('?')[1] || '')).get('filter');
        HH.router.go(`/b/${ctx.bid}/contracts` + (cur === k ? '' : `?filter=${k}`));
      });
      document.querySelectorAll('[data-remfilter]').forEach(b => b.onclick = () =>
        HH.router.go(`/b/${ctx.bid}/contracts?filter=${b.dataset.remfilter}`));
      const ex = document.getElementById('ctExport');
      if (ex) ex.onclick = () => {
        U.downloadCSV(`hop-dong-${ctx.bid}.csv`,
          ['Mã HĐ', 'Phòng', 'Khách thuê', 'Giá thuê', 'Tiền cọc', 'Bắt đầu', 'Kết thúc', 'Còn lại (ngày)', 'Trạng thái'],
          S.contractsOf(ctx.bid).map(c => [c.id, c.roomCode, c.tenantName, c.rent, c.deposit,
            U.fmtDate(c.start), U.fmtDate(c.end), S.daysToExpiry(c), (UI.STATUS.contract[c.status] || {}).label || c.status]));
        UI.toast('Đã tải file Excel (CSV)', { type: 'ok' });
      };
    },
  };

  function contractActions(ctx, c) {
    const items = [{ icon: '👁', label: 'Xem chi tiết & điều khoản', onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/${c.id}`) },
      { icon: '🖨', label: 'In hợp đồng', onClick: () => printContract(ctx, c) }];
    if (c.status === 'active' || c.status === 'terminating' || c.status === 'expired') {
      items.push({ sep: true }, { icon: '🔄', label: 'Gia hạn hợp đồng', onClick: () => renewDialog(ctx, c) });
      items.push({ icon: '⏻', label: 'Trả phòng & thanh lý', danger: true, onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/${c.id}/terminate`) });
    }
    return items;
  }

  /* ---------------- GIA HẠN ---------------- */
  function renewDialog(ctx, c) {
    const d = S.daysToExpiry(c);
    UI.modal({ title: `Gia hạn hợp đồng — Phòng ${c.roomCode}`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Hợp đồng hiện hết hạn ngày <b class="mono">${U.fmtDate(c.end)}</b>
        ${raw(d < 0 ? `<span style="color:var(--danger)">(đã quá hạn ${Math.abs(d)} ngày)</span>` : `(còn ${d} ngày)`)}</p>
      <div class="field"><label>Gia hạn thêm</label>
        <select class="select" id="rnMonths">
          <option value="3">3 tháng</option><option value="6">6 tháng</option>
          <option value="12" selected>12 tháng</option><option value="24">24 tháng</option></select></div>
      <div class="field" style="margin-top:12px"><label>Giá thuê mới (để trống nếu giữ nguyên)</label>
        <input class="input money" id="rnRent" placeholder="${U.number(c.rent)}"></div>
      <p class="hint" id="rnPreview" style="margin-top:10px"></p>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="rnGo">Gia hạn</button>`,
      onMount(el, close) {
        const sel = el.querySelector('#rnMonths'), rent = el.querySelector('#rnRent'), pv = el.querySelector('#rnPreview');
        const upd = () => {
          const base = new Date(c.end) > U.today() ? new Date(c.end) : U.today();
          pv.innerHTML = `→ Hạn mới: <b class="mono">${U.fmtDate(U.addMonths(base, +sel.value))}</b>`;
        };
        sel.onchange = upd; upd();
        rent.oninput = () => { const n = U.parseNum(rent.value); rent.value = n ? U.number(n) : ''; };
        el.querySelector('#rnGo').onclick = (e) => {
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            S.renewContract(c.id, +sel.value, U.parseNum(rent.value) || null);
            close(); UI.toast('Đã gia hạn hợp đồng', { type: 'ok' }); HH.router.render();
          }, 350);
        };
      } });
  }

  /* ---------------- IN HỢP ĐỒNG ---------------- */
  function printContract(ctx, c) {
    const b = S.building(ctx.bid) || {};
    const terms = S.termsOf(c);
    const tenants = S.tenantsOf(ctx.bid).filter(t => t.roomCode === c.roomCode);
    const rep = tenants.find(t => t.isRep) || tenants[0] || {};
    const assets = S.assetsOf(ctx.bid, c.roomCode);
    const win = window.open('', '_blank', 'width=860,height=1000');
    if (!win) { UI.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép popup.', { type: 'error' }); return; }
    const termsHtml = terms.map((t, i) => `<div class="clause"><b>Điều ${i + 1}. ${U.esc(t.title)}</b><p>${U.esc(t.body)}</p></div>`).join('');
    const assetHtml = assets.length
      ? `<table class="tbl"><thead><tr><th>Tài sản</th><th>SL</th><th>Tình trạng</th></tr></thead><tbody>${assets.map(a =>
          `<tr><td>${U.esc(a.name)}</td><td>${a.quantity || 1} ${U.esc(a.unit || '')}</td><td>${(UI.STATUS.asset[a.condition] || {}).label || ''}</td></tr>`).join('')}</tbody></table>`
      : '<p><i>Không có tài sản bàn giao.</i></p>';
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hợp đồng ${c.roomCode}</title>
      <style>body{font-family:'Times New Roman',serif;font-size:14px;line-height:1.6;color:#000;max-width:760px;margin:28px auto;padding:0 20px}
      h1{text-align:center;font-size:19px;margin:6px 0}.center{text-align:center}.muted{color:#555}
      .head{text-align:center;margin-bottom:18px}.head .nation{font-weight:700;font-size:14px}
      .head .slogan{font-weight:700;text-decoration:underline;margin-bottom:14px}
      .party{margin:10px 0}.party b{display:block;margin-bottom:2px}
      .clause{margin:10px 0}.clause p{margin:3px 0 0;text-align:justify}
      .tbl{width:100%;border-collapse:collapse;margin:8px 0}.tbl th,.tbl td{border:1px solid #333;padding:5px 8px;font-size:13px}
      .sign{display:flex;justify-content:space-around;margin-top:36px;text-align:center}
      .sign div{width:45%}.sign i{font-size:12px;color:#555}
      table.info{width:100%;margin:8px 0}table.info td{padding:3px 0;vertical-align:top}
      @media print{body{margin:0}}</style></head><body>
      <div class="head"><div class="nation">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="slogan">Độc lập – Tự do – Hạnh phúc</div>
        <h1>HỢP ĐỒNG THUÊ PHÒNG TRỌ</h1>
        <div class="muted">Số: ${U.esc(c.id)}</div></div>
      <p>Hôm nay, ngày ${U.fmtDate(c.start)}, tại ${U.esc(b.address || b.name || '')}, chúng tôi gồm:</p>
      <div class="party"><b>BÊN CHO THUÊ (Bên A):</b>
        <table class="info"><tr><td style="width:38%">Đại diện</td><td>${U.esc(b.contactName || S.prefs.userName || '')}</td></tr>
        <tr><td>Địa chỉ</td><td>${U.esc(b.address || '')}</td></tr>
        <tr><td>Điện thoại</td><td>${U.esc(b.contactPhone || '')}</td></tr></table></div>
      <div class="party"><b>BÊN THUÊ (Bên B):</b>
        <table class="info"><tr><td style="width:38%">Họ và tên</td><td>${U.esc(rep.fullName || c.tenantName || '')}</td></tr>
        <tr><td>Số CCCD</td><td>${U.esc(rep.idNumber || '')}${rep.cccdIssueDate ? ' — cấp ngày ' + U.esc(rep.cccdIssueDate) : ''}</td></tr>
        <tr><td>Ngày sinh</td><td>${U.esc(rep.dob || '')}</td></tr>
        <tr><td>Điện thoại</td><td>${U.esc(rep.phone || '')}</td></tr>
        <tr><td>Địa chỉ thường trú</td><td>${U.esc(rep.address || '')}</td></tr></table></div>
      ${tenants.length > 1 ? `<p><b>Những người ở cùng:</b> ${tenants.filter(t => t !== rep).map(t => U.esc(t.fullName)).join(', ')}</p>` : ''}
      <p>Hai bên thống nhất ký hợp đồng thuê phòng trọ với các nội dung sau:</p>
      <div class="clause"><b>Thông tin phòng thuê</b>
        <table class="tbl"><tr><td>Phòng</td><td><b>${U.esc(c.roomCode)}</b></td><td>Giá thuê</td><td><b>${U.currency(c.rent)}/tháng</b></td></tr>
        <tr><td>Thời hạn</td><td>${U.fmtDate(c.start)} – ${U.fmtDate(c.end)}</td><td>Tiền cọc</td><td>${U.currency(c.deposit)}</td></tr>
        <tr><td>Kỳ thanh toán</td><td>Ngày ${c.billingDay} hàng tháng</td><td>Hạn thanh toán</td><td>${c.dueDays} ngày sau ngày chốt</td></tr></table></div>
      ${termsHtml}
      <div class="clause"><b>Phụ lục: Tài sản bàn giao</b>${assetHtml}</div>
      <div class="sign"><div><b>BÊN CHO THUÊ (Bên A)</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${U.esc(b.contactName || S.prefs.userName || '')}</div>
        <div><b>BÊN THUÊ (Bên B)</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${U.esc(rep.fullName || c.tenantName || '')}</div></div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }

  /* ---------------- CHI TIẾT HỢP ĐỒNG + ĐIỀU KHOẢN ---------------- */
  HH.pages.contractDetail = {
    render(ctx) {
      const c = S.contract(ctx.params.cid);
      if (!c) return `<div class="alert alert-danger"><span class="ic">⚠</span><div>Không tìm thấy hợp đồng.</div></div>`;
      ctx._c = c;
      const d = S.daysToExpiry(c), lvl = S.expiryLevel(c);
      const tenants = S.tenantsOf(ctx.bid).filter(t => t.roomCode === c.roomCode);
      const assets = S.assetsOf(ctx.bid, c.roomCode);
      const invs = S.invoicesForContract(c.id);
      const debt = invs.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.total - i.paid), 0);
      const terms = S.termsOf(c);
      const custom = !!(c.terms && c.terms.length);

      let banner = '';
      if (lvl === 'expired') banner = `<div class="alert alert-danger" style="margin-bottom:16px"><span class="ic">⛔</span>
        <div><b>Hợp đồng đã quá hạn ${Math.abs(d)} ngày</b> (hết hạn ${U.fmtDate(c.end)}). Hãy <b>gia hạn</b> hoặc <b>thanh lý</b> để dữ liệu chính xác.</div></div>`;
      else if (lvl === 'urgent') banner = `<div class="alert alert-danger" style="margin-bottom:16px"><span class="ic">🔥</span>
        <div><b>Hợp đồng hết hạn trong ${d} ngày</b> (${U.fmtDate(c.end)}). Liên hệ khách thuê để xác nhận gia hạn.</div></div>`;
      else if (lvl === 'soon') banner = `<div class="alert alert-warning" style="margin-bottom:16px"><span class="ic">⚠</span>
        <div><b>Sắp hết hạn — còn ${d} ngày</b> (${U.fmtDate(c.end)}). Nên hỏi ý khách thuê về việc gia hạn.</div></div>`;

      const termsHtml = terms.map((t, i) => `<div class="clause-item">
        <div class="clause-title"><span class="cnum">Điều ${i + 1}</span> ${U.esc(t.title)}</div>
        <div class="clause-body">${U.esc(t.body)}</div></div>`).join('');

      const total = invs.length, paidCount = invs.filter(i => i.status === 'paid').length;

      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/contracts">← Hợp đồng</a>
          <div class="row-gap-3"><span class="lz-home-ic">📄</span>
            <div><div class="page-title-lg">Hợp đồng phòng ${c.roomCode}</div>
            <div class="page-sub mono">${c.id}</div></div></div></div>
        <div class="page-actions">
          <button class="btn btn-outline" id="ctPrint">🖨 In hợp đồng</button>
          ${raw(c.status !== 'terminated' ? `<button class="btn btn-primary" id="ctRenew">🔄 Gia hạn</button>` : '')}
          ${raw(c.status !== 'terminated' ? `<button class="btn btn-danger" id="ctTerm">⏻ Thanh lý</button>` : '')}
        </div></div>
      ${raw(banner)}
      <div class="row-gap-3 wrap" style="margin-bottom:16px">
        ${raw(UI.statusBadge(c.status === 'active' && c.expiringSoon ? 'expiring' : c.status, 'contract'))}
        ${raw(expiryChip(c))}
        ${raw(c.renewCount ? `<span class="badge s-info"><span class="dot"></span>Đã gia hạn ${c.renewCount} lần</span>` : '')}
      </div>

      <div class="ct-grid">
        <div class="col" style="gap:16px">
          <div class="card"><div class="card-head"><h3>Thông tin hợp đồng</h3></div><div class="card-pad">
            <div class="grid-2">
              <div class="field"><label>Phòng</label><div class="b">${c.roomCode}</div></div>
              <div class="field"><label>Khách thuê đại diện</label><div class="b">${U.esc(c.tenantName)}</div></div>
              <div class="field"><label>Giá thuê</label><div class="mono b" style="color:var(--brand-700)">${U.currency(c.rent)}<span class="muted text-xs">/tháng</span></div></div>
              <div class="field"><label>Tiền cọc</label><div class="mono b">${U.currency(c.deposit)}</div></div>
              <div class="field"><label>Ngày bắt đầu</label><div class="mono">${U.fmtDate(c.start)}</div></div>
              <div class="field"><label>Ngày kết thúc</label><div class="mono">${U.fmtDate(c.end)}</div></div>
              <div class="field"><label>Ngày chốt hóa đơn</label><div>Ngày ${c.billingDay} hàng tháng</div></div>
              <div class="field"><label>Hạn thanh toán</label><div>${c.dueDays} ngày sau ngày chốt</div></div>
            </div>
            ${raw(S.isOwner() && c.status !== 'terminated' ? `<div style="margin-top:14px"><button class="btn btn-outline btn-sm" id="ctEdit">✏️ Sửa thông tin</button></div>` : '')}
          </div></div>

          <div class="card"><div class="card-head">
            <h3>Điều khoản hợp đồng ${raw(custom ? '<span class="badge s-purple" style="margin-left:6px"><span class="dot"></span>Đã tùy chỉnh</span>' : '<span class="badge s-neutral" style="margin-left:6px"><span class="dot"></span>Mẫu chuẩn</span>')}</h3>
            ${raw(S.isOwner() ? '<button class="btn btn-outline btn-sm" id="ctTerms">✏️ Sửa điều khoản</button>' : '')}
          </div><div class="card-pad">${raw(termsHtml)}</div></div>
        </div>

        <div class="col" style="gap:16px">
          <div class="card"><div class="card-head"><h3>Người ở (${tenants.length})</h3></div><div class="card-pad">
            ${raw(tenants.length ? tenants.map(t => `<div class="row-gap-2" style="padding:8px 0;border-bottom:1px solid var(--neutral-100)">
              <span class="avatar" style="width:30px;height:30px;flex:0 0 30px;font-size:12px">${U.initials(t.fullName)}</span>
              <div class="grow"><b>${U.esc(t.fullName)}</b>${t.isRep ? ' <span class="tn-tag rep">Đại diện</span>' : ''}
                <div class="muted text-xs mono">${U.esc(t.phone || '')} · CCCD ${U.esc(t.idNumber || '—')}</div></div>
              </div>`).join('') : '<span class="faint text-sm">Chưa có thông tin người ở</span>')}
          </div></div>

          <div class="card"><div class="card-head"><h3>Tài chính</h3></div><div class="card-pad">
            <div class="settle-row"><span class="muted">Số hóa đơn</span><span class="b">${total} (đã trả ${paidCount})</span></div>
            <div class="settle-row"><span class="muted">Công nợ hiện tại</span>
              <span class="amt" style="color:${raw(debt > 0 ? 'var(--danger)' : 'var(--success)')}">${U.currency(debt)}</span></div>
            <div class="settle-row"><span class="muted">Tiền cọc đang giữ</span><span class="amt">${U.currency(c.deposit)}</span></div>
            <div style="margin-top:10px"><a href="#/b/${ctx.bid}/invoices" class="text-sm">Xem hóa đơn →</a></div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Tài sản bàn giao (${assets.length})</h3></div><div class="card-pad">
            ${raw(assets.length ? `<div class="room-assets">${assets.map(a => `<span class="room-asset-chip ${a.condition === 'good' ? '' : a.condition}">${a.icon || '📦'} ${U.esc(a.name)}</span>`).join('')}</div>`
              : '<span class="faint text-sm">Chưa có tài sản</span>')}
          </div></div>
        </div>
      </div>`;
    },
    mount(ctx) {
      const c = ctx._c; if (!c) return;
      const p = document.getElementById('ctPrint'); if (p) p.onclick = () => printContract(ctx, c);
      const r = document.getElementById('ctRenew'); if (r) r.onclick = () => renewDialog(ctx, c);
      const t = document.getElementById('ctTerm'); if (t) t.onclick = () => HH.router.go(`/b/${ctx.bid}/contracts/${c.id}/terminate`);
      const e = document.getElementById('ctEdit'); if (e) e.onclick = () => editContract(ctx, c);
      const tm = document.getElementById('ctTerms'); if (tm) tm.onclick = () => editTerms(ctx, c);
    },
  };

  function editContract(ctx, c) {
    UI.modal({ title: 'Sửa thông tin hợp đồng', size: 'wide', bodyHtml: h`
      <div class="grid-2">
        <div class="field"><label>Giá thuê (₫/tháng)</label><input class="input money" id="edRent" value="${U.number(c.rent)}"></div>
        <div class="field"><label>Tiền cọc (₫)</label><input class="input money" id="edDep" value="${U.number(c.deposit)}"></div>
        <div class="field"><label>Ngày bắt đầu</label><input class="input" type="date" id="edStart" value="${new Date(c.start).toISOString().slice(0, 10)}"></div>
        <div class="field"><label>Ngày kết thúc</label><input class="input" type="date" id="edEnd" value="${new Date(c.end).toISOString().slice(0, 10)}"></div>
        <div class="field"><label>Ngày chốt hóa đơn</label><select class="select" id="edBill">
          ${raw([1, 5, 10, 15].map(x => `<option ${c.billingDay === x ? 'selected' : ''}>${x}</option>`).join(''))}</select></div>
        <div class="field"><label>Hạn thanh toán (ngày)</label><input class="input mono" id="edDue" value="${c.dueDays}"></div>
      </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="edSave">Lưu</button>`,
      onMount(el, close) {
        ['edRent', 'edDep'].forEach(id => { const i = el.querySelector('#' + id);
          i.oninput = () => { const n = U.parseNum(i.value); i.value = n ? U.number(n) : ''; }; });
        el.querySelector('#edSave').onclick = () => {
          const patch = {
            rent: U.parseNum(el.querySelector('#edRent').value) || c.rent,
            deposit: U.parseNum(el.querySelector('#edDep').value) || 0,
            start: new Date(el.querySelector('#edStart').value).toISOString(),
            end: new Date(el.querySelector('#edEnd').value).toISOString(),
            billingDay: +el.querySelector('#edBill').value,
            dueDays: U.parseNum(el.querySelector('#edDue').value) || 5,
          };
          S.updateContract(c.id, patch);
          const room = S.room(ctx.bid, c.roomCode); if (room) { room.contractEnd = patch.end; room.price = patch.rent; }
          S.refreshExpiryFlags(); S.persist();
          S.log('contract.update', `Sửa hợp đồng ${c.roomCode}`);
          close(); UI.toast('Đã lưu hợp đồng', { type: 'ok' }); HH.router.render();
        };
      } });
  }

  function editTerms(ctx, c) {
    let list = (c.terms && c.terms.length ? c.terms : S.DEFAULT_TERMS).map(t => ({ title: t.title, body: t.body }));
    const render = (el) => {
      el.querySelector('[data-terms]').innerHTML = list.map((t, i) => `<div class="card" style="box-shadow:none;margin-bottom:10px"><div class="card-pad" style="padding:12px">
        <div class="between" style="margin-bottom:6px"><b>Điều ${i + 1}</b>
          <button class="kebab" data-rmterm="${i}" title="Xóa">✕</button></div>
        <input class="input" data-tt="${i}" value="${U.esc(t.title)}" placeholder="Tiêu đề điều khoản" style="margin-bottom:6px">
        <textarea class="textarea" data-tb="${i}" style="min-height:70px" placeholder="Nội dung">${U.esc(t.body)}</textarea>
      </div></div>`).join('');
      el.querySelectorAll('[data-rmterm]').forEach(b => b.onclick = () => { list.splice(+b.dataset.rmterm, 1); render(el); });
      el.querySelectorAll('[data-tt]').forEach(i => i.oninput = () => list[+i.dataset.tt].title = i.value);
      el.querySelectorAll('[data-tb]').forEach(i => i.oninput = () => list[+i.dataset.tb].body = i.value);
    };
    UI.modal({ title: `Điều khoản hợp đồng — Phòng ${c.roomCode}`, size: 'xwide',
      bodyHtml: `<p class="muted" style="margin-bottom:12px">Có thể dùng biến: <b class="mono">{deposit}</b> (tiền cọc), <b class="mono">{rent}</b> (giá thuê), <b class="mono">{dueDays}</b> (hạn thanh toán).</p>
        <div data-terms></div>
        <button class="btn btn-outline btn-sm" id="addTerm">＋ Thêm điều khoản</button>`,
      footHtml: `<button class="btn btn-outline" id="resetTerms">↺ Về mẫu chuẩn</button><span class="spacer"></span>
        <button class="btn btn-outline" data-close>Hủy</button><button class="btn btn-primary" id="saveTerms">Lưu điều khoản</button>`,
      onMount(el, close) {
        render(el);
        el.querySelector('#addTerm').onclick = () => { list.push({ title: '', body: '' }); render(el); };
        el.querySelector('#resetTerms').onclick = () => { list = S.DEFAULT_TERMS.map(t => ({ title: t.title, body: t.body })); render(el); };
        el.querySelector('#saveTerms').onclick = () => {
          const clean = list.filter(t => (t.title || '').trim() || (t.body || '').trim());
          S.updateContract(c.id, { terms: clean });
          S.log('contract.terms', `Cập nhật điều khoản hợp đồng ${c.roomCode}`);
          close(); UI.toast('Đã lưu điều khoản', { type: 'ok' }); HH.router.render();
        };
      } });
  }

  /* ---------------- LẬP HỢP ĐỒNG (5 bước) ---------------- */
  const STEPS = ['Phòng', 'Khách thuê', 'Điều khoản', 'Dịch vụ', 'Bàn giao'];

  HH.pages.contractNew = {
    render(ctx) {
      ctx._w = { step: 0, roomCode: null, tenants: [], term: {
        start: '2026-08-15', months: 12, rent: null, deposit: null, depositEq: true,
        cycle: 'monthly', billingDay: 1, dueDays: 5 }, services: {}, handover: {} };
      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/contracts">← Hợp đồng</a>
          <div class="page-title">Lập hợp đồng mới</div>
          <div class="page-sub">Biểu mẫu tự lưu nháp sau mỗi bước</div></div></div>
        <div id="stepper"></div>
        <div class="card card-pad" id="wizBody" style="max-width:720px;margin:0 auto"></div>`;
    },
    mount(ctx) { renderStep(ctx); },
  };

  function renderStepper(step) {
    return `<div class="stepper" style="max-width:720px;margin:0 auto 24px">` + STEPS.map((s, i) =>
      `<div class="step ${i < step ? 'done' : ''} ${i === step ? 'current' : ''}">
        <div class="dot">${i < step ? '✓' : i + 1}</div><div class="lbl">${s}</div></div>`).join('') + `</div>`;
  }

  function renderStep(ctx) {
    const w = ctx._w;
    document.getElementById('stepper').innerHTML = renderStepper(w.step);
    const body = document.getElementById('wizBody');
    const fns = [step1, step2, step3, step4, step5, stepConfirm];
    fns[w.step](ctx, body);
  }

  function navFoot(ctx, opts) {
    const w = ctx._w;
    return `<div class="between" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--neutral-200)">
      ${w.step > 0 ? '<button class="btn btn-outline" data-back>← Quay lại</button>' : '<span></span>'}
      <button class="btn btn-primary" data-next ${opts && opts.disableNext ? 'disabled' : ''}>${opts && opts.nextLabel || 'Tiếp tục →'}</button>
    </div>`;
  }
  function wireNav(ctx, onNext) {
    const w = ctx._w;
    const back = document.querySelector('[data-back]');
    if (back) back.onclick = () => { w.step--; renderStep(ctx); };
    document.querySelector('[data-next]').onclick = () => {
      if (onNext && onNext() === false) return;
      w.step++;
      if (w.step < 5) UI.toast('Đã lưu nháp', { type: 'ok' });
      renderStep(ctx);
    };
  }

  // Bước 1 — Phòng
  function step1(ctx, body) {
    const rooms = S.roomsOf(ctx.bid).filter(r => r.status === 'vacant' || r.status === 'reserved')
      .sort((a, b) => a.code.localeCompare(b.code));
    const w = ctx._w;
    const cards = rooms.map(r => `<label class="card card-pad" style="cursor:pointer;display:block;border-color:${w.roomCode === r.code ? 'var(--brand-500)' : ''}">
      <div class="row-gap-3"><input type="radio" name="room" value="${r.code}" ${w.roomCode === r.code ? 'checked' : ''}>
        <div class="grow"><div class="b">${r.code} <span class="faint" style="font-weight:400">· ${r.typeLabel}</span></div>
          <div class="mono muted text-sm">${U.currency(r.price)}/tháng · ${r.area} m²</div></div>
        ${UI.statusBadge(r.status, 'room')}</div></label>`).join('');
    body.innerHTML = `<h3 style="margin-bottom:4px">Bước 1 — Chọn phòng</h3>
      <p class="muted" style="margin-bottom:16px">Chỉ hiện phòng trống hoặc đã giữ chỗ.</p>
      <div class="col" style="gap:10px">${cards || '<div class="empty"><div class="ic">🚪</div><h4>Không còn phòng trống</h4></div>'}</div>
      ${navFoot(ctx, { disableNext: !w.roomCode })}`;
    body.querySelectorAll('input[name=room]').forEach(i => i.onchange = () => {
      w.roomCode = i.value; const r = S.room(ctx.bid, i.value);
      w.term.rent = r.price; w.term.deposit = r.price;
      renderStep(ctx);
    });
    wireNav(ctx, () => !!w.roomCode);
  }

  // Bước 2 — Khách thuê
  function step2(ctx, body) {
    const w = ctx._w;
    const room = S.room(ctx.bid, w.roomCode);
    const all = S.tenantsOf(ctx.bid);
    const list = w.tenants.map((t, i) => `<div class="between" style="padding:8px 0;border-bottom:1px solid var(--neutral-100)">
      <div><b>${t.fullName}</b> <span class="mono muted text-sm">· ${t.idNumber}</span></div>
      <button class="kebab" data-rm="${i}" title="Xóa">✕</button></div>`).join('');
    const over = w.tenants.length > room.maxOccupants;
    body.innerHTML = `<h3 style="margin-bottom:4px">Bước 2 — Khách thuê</h3>
      <p class="muted" style="margin-bottom:16px">Phòng ${room.code} chứa tối đa ${room.maxOccupants} người.</p>
      <div class="card" style="box-shadow:none"><div class="card-pad">
        ${list || '<p class="muted center">Chưa thêm người ở nào</p>'}
        ${over ? '<div class="alert alert-warning" style="margin-top:12px"><span class="ic">⚠</span><div>Vượt sức chứa phòng — vẫn có thể tiếp tục.</div></div>' : ''}
      </div></div>
      <div class="row-gap-2" style="margin-top:12px">
        <select class="select" id="existTenant" style="max-width:280px"><option value="">+ Thêm khách đã có...</option>
          ${all.map(t => `<option value="${t.id}">${t.fullName} · ${t.idNumber}</option>`).join('')}</select>
        <a href="#/b/${ctx.bid}/tenants/new" class="btn btn-outline">Tạo khách mới</a>
      </div>
      ${navFoot(ctx, { disableNext: w.tenants.length === 0 })}`;
    body.querySelector('#existTenant').onchange = (e) => {
      const t = S.tenantById(e.target.value); if (t && !w.tenants.find(x => x.id === t.id)) { w.tenants.push(t); renderStep(ctx); }
    };
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { w.tenants.splice(+b.dataset.rm, 1); renderStep(ctx); });
    wireNav(ctx, () => w.tenants.length > 0);
  }

  // Bước 3 — Điều khoản
  function step3(ctx, body) {
    const w = ctx._w, t = w.term;
    const end = U.fmtDate(U.addMonths(new Date(t.start), t.months));
    body.innerHTML = `<h3 style="margin-bottom:16px">Bước 3 — Điều khoản hợp đồng</h3>
      <div class="grid-2">
        <div class="field"><label>Ngày bắt đầu</label><input class="input" type="date" data-t="start" value="${t.start}"></div>
        <div class="field"><label>Thời hạn</label><select class="select" data-t="months">
          ${[6, 12, 24].map(m => `<option value="${m}" ${t.months === m ? 'selected' : ''}>${m} tháng</option>`).join('')}</select></div>
      </div>
      <p class="muted" style="margin:8px 0 16px">→ Ngày kết thúc: <b class="mono" id="endDate">${end}</b></p>
      <div class="field"><label>Giá thuê (₫/tháng)</label><input class="input money" data-t="rent" value="${U.number(t.rent)}"></div>
      <div class="field" style="margin-top:12px"><label>Tiền cọc (₫)</label><input class="input money" data-t="deposit" value="${U.number(t.deposit)}" ${t.depositEq ? 'disabled' : ''}>
        <label class="check" style="margin-top:6px"><input type="checkbox" data-t="depositEq" ${t.depositEq ? 'checked' : ''}> Bằng một tháng tiền thuê</label></div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Chu kỳ thanh toán</label><select class="select" data-t="cycle">
          <option value="monthly">Hàng tháng</option><option value="quarterly">Hàng quý</option></select></div>
        <div class="field"><label>Ngày chốt hóa đơn</label><select class="select" data-t="billingDay">
          ${[1, 5, 10, 15].map(d => `<option ${t.billingDay === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Hạn thanh toán</label>
        <div class="row-gap-2"><input class="input mono" data-t="dueDays" value="${t.dueDays}" style="width:70px"> <span class="muted">ngày sau ngày chốt</span></div></div>
      <div class="alert alert-info" style="margin-top:16px"><span class="ic">📋</span>
        <div>Hợp đồng áp dụng <b>${S.DEFAULT_TERMS.length} điều khoản mẫu chuẩn</b> (mục đích thuê, thanh toán, tiền cọc, quyền–nghĩa vụ hai bên, chấm dứt trước hạn…).
        <button class="btn btn-sm btn-outline" id="viewTerms" style="margin-left:8px">Xem điều khoản</button>
        <div class="text-xs" style="margin-top:4px">Sau khi ký có thể chỉnh sửa riêng cho hợp đồng này.</div></div></div>
      ${navFoot(ctx)}`;
    const viewT = body.querySelector('#viewTerms');
    if (viewT) viewT.onclick = () => {
      const preview = { deposit: t.deposit, rent: t.rent, dueDays: t.dueDays };
      const html = S.termsOf(preview).map((x, i) => `<div class="clause-item">
        <div class="clause-title"><span class="cnum">Điều ${i + 1}</span> ${U.esc(x.title)}</div>
        <div class="clause-body">${U.esc(x.body)}</div></div>`).join('');
      UI.modal({ title: 'Điều khoản hợp đồng (mẫu chuẩn)', size: 'wide', bodyHtml: html,
        footHtml: `<span class="spacer"></span><button class="btn btn-primary" data-close>Đã hiểu</button>` });
    };
    const g = (k) => body.querySelector(`[data-t="${k}"]`);
    const recompute = () => { g('rent').value; document.getElementById('endDate').textContent = U.fmtDate(U.addMonths(new Date(t.start), t.months)); };
    g('start').oninput = () => { t.start = g('start').value; recompute(); };
    g('months').onchange = () => { t.months = +g('months').value; recompute(); };
    g('rent').oninput = () => { t.rent = U.parseNum(g('rent').value); g('rent').value = t.rent ? U.number(t.rent) : ''; if (t.depositEq) { t.deposit = t.rent; g('deposit').value = U.number(t.deposit || 0); } };
    g('deposit').oninput = () => { t.deposit = U.parseNum(g('deposit').value); };
    g('depositEq').onchange = () => { t.depositEq = g('depositEq').checked; g('deposit').disabled = t.depositEq; if (t.depositEq) { t.deposit = t.rent; g('deposit').value = U.number(t.deposit || 0); } };
    g('cycle').onchange = () => t.cycle = g('cycle').value;
    g('billingDay').onchange = () => t.billingDay = +g('billingDay').value;
    g('dueDays').oninput = () => t.dueDays = U.parseNum(g('dueDays').value) || 0;
    wireNav(ctx);
  }

  // Bước 4 — Dịch vụ
  function step4(ctx, body) {
    const w = ctx._w;
    const svcs = S.servicesOf(ctx.bid);
    if (Object.keys(w.services).length === 0) svcs.forEach(s => w.services[s.id] = { on: true, unit: s.unit });
    const methodLabel = { per_kwh: 'Theo chỉ số điện', per_person: 'Theo số người', flat: 'Cố định' };
    const rows = svcs.map(s => { const st = w.services[s.id];
      return `<div class="between" style="padding:12px 0;border-bottom:1px solid var(--neutral-100)">
        <label class="check"><input type="checkbox" data-sv="${s.id}" ${st.on ? 'checked' : ''}>
          <span><b>${s.name}</b><div class="muted text-xs">${methodLabel[s.method]}</div></span></label>
        <div class="row-gap-2"><input class="input money" data-svu="${s.id}" value="${U.number(st.unit)}" style="width:130px"><span class="muted text-sm">${s.unitLabel}</span></div>
      </div>`; }).join('');
    body.innerHTML = `<h3 style="margin-bottom:4px">Bước 4 — Dịch vụ áp dụng</h3>
      <p class="muted" style="margin-bottom:12px">Mặc định tích hết. Có thể đặt đơn giá riêng cho hợp đồng này.</p>
      ${rows}${navFoot(ctx)}`;
    body.querySelectorAll('[data-sv]').forEach(c => c.onchange = () => w.services[c.dataset.sv].on = c.checked);
    body.querySelectorAll('[data-svu]').forEach(i => i.oninput = () => { const n = U.parseNum(i.value); w.services[i.dataset.svu].unit = n; i.value = n ? U.number(n) : ''; });
    wireNav(ctx);
  }

  // Bước 5 — Bàn giao
  function step5(ctx, body) {
    const w = ctx._w;
    const assets = S.assetsOf(ctx.bid, w.roomCode);
    const assetRows = assets.length ? assets.map(a => `<div class="between" style="padding:10px 0;border-bottom:1px solid var(--neutral-100)">
      <div><b>${a.name}</b> <span class="mono muted text-xs">${a.id}</span></div>
      <select class="select" style="max-width:200px" data-asset="${a.id}">
        <option value="good">Tốt</option><option value="wear">Hao mòn tự nhiên</option><option value="broken">Hư hỏng</option></select>
    </div>`).join('') : '<p class="muted">Phòng chưa khai báo tài sản.</p>';
    body.innerHTML = `<h3 style="margin-bottom:16px">Bước 5 — Bàn giao</h3>
      <div class="field"><label>Chỉ số điện ban đầu</label><input class="input mono" data-h="elec" placeholder="VD: 12450"></div>
      <div class="field" style="margin-top:12px"><label>Chỉ số nước ban đầu</label><input class="input mono" data-h="water" placeholder="VD: 45"></div>
      <div class="field" style="margin-top:12px"><label>Ảnh đồng hồ</label>
        <label class="btn btn-outline" style="width:fit-content">📷 Tải ảnh<input type="file" accept="image/*" hidden></label></div>
      <h4 style="margin:20px 0 4px">Biên bản bàn giao tài sản</h4>
      <div>${assetRows}</div>
      ${navFoot(ctx, { nextLabel: 'Xem lại & xác nhận →' })}`;
    body.querySelectorAll('[data-asset]').forEach(s => s.onchange = () => w.handover[s.dataset.asset] = s.value);
    wireNav(ctx);
  }

  // Màn hình xác nhận cuối
  function stepConfirm(ctx, body) {
    const w = ctx._w;
    const room = S.room(ctx.bid, w.roomCode);
    const end = U.fmtDate(U.addMonths(new Date(w.term.start), w.term.months));
    const svcOn = S.servicesOf(ctx.bid).filter(s => w.services[s.id] && w.services[s.id].on).map(s => s.name).join(', ');
    const summary = (label, val) => `<div class="settle-row"><span class="muted">${label}</span><span class="b">${val}</span></div>`;
    body.innerHTML = `<h3 style="margin-bottom:4px">Xác nhận hợp đồng</h3>
      <p class="muted" style="margin-bottom:16px">Kiểm tra lại toàn bộ thông tin trước khi ký.</p>
      <div class="card" style="box-shadow:none"><div class="card-pad">
        ${summary('Phòng', room.code + ' · ' + room.typeLabel)}
        ${summary('Khách thuê', w.tenants.map(t => t.fullName).join(', '))}
        ${summary('Thời hạn', `${U.fmtDate(w.term.start)} → ${end} (${w.term.months} tháng)`)}
        ${summary('Giá thuê', U.currency(w.term.rent))}
        ${summary('Tiền cọc', U.currency(w.term.deposit))}
        ${summary('Chốt HĐ', `Ngày ${w.term.billingDay} · hạn ${w.term.dueDays} ngày`)}
        ${summary('Dịch vụ', svcOn || '—')}
      </div></div>
      <div class="alert alert-info" style="margin-top:16px"><span class="ic">ℹ</span><div>Khi ký, hệ thống sẽ tự động:
        <ul class="consequence" style="margin:6px 0 0"><li>Chuyển phòng sang <b>Đang thuê</b></li>
        <li>Tạo tài khoản đăng nhập cho khách thuê</li><li>Cấp mã mở cửa thông minh</li></ul></div></div>
      <div class="between" style="margin-top:24px">
        <button class="btn btn-outline" data-back>← Quay lại</button>
        <button class="btn btn-primary btn-lg" data-sign>Ký hợp đồng và bàn giao phòng</button>
      </div>`;
    body.querySelector('[data-back]').onclick = () => { w.step = 4; renderStep(ctx); };
    body.querySelector('[data-sign]').onclick = (e) => {
      const btn = e.currentTarget; btn.classList.add('loading');
      setTimeout(() => {
        const start = new Date(w.term.start).toISOString();
        const c = { id: U.uid('hd'), buildingId: ctx.bid, roomCode: room.code, roomType: room.type,
          tenantName: w.tenants.map(t => t.fullName).join(', '), tenantId: w.tenants[0].id,
          rent: w.term.rent, deposit: w.term.deposit, start, end: U.addMonths(new Date(w.term.start), w.term.months).toISOString(),
          billingDay: w.term.billingDay, dueDays: w.term.dueDays, cycle: w.term.cycle, status: 'active', debt: 0 };
        S.addContract(c);
        room.status = 'occupied'; room.tenantName = c.tenantName; room.tenantId = c.tenantId;
        room.contractId = c.id; room.contractEnd = c.end;
        S.log('contract.sign', `Ký hợp đồng phòng ${room.code} cho ${c.tenantName}`);
        S.persist();
        UI.toast('Đã ký hợp đồng và bàn giao phòng', { type: 'ok' });
        HH.router.go(`/b/${ctx.bid}/contracts`);
      }, 700);
    };
  }

  /* ---------------- TRẢ PHÒNG & THANH LÝ (§3.10) ---------------- */
  const TSTEPS = ['Thông tin', 'Kiểm kê tài sản', 'Chốt công nợ', 'Quyết toán'];

  HH.pages.terminate = {
    render(ctx) {
      const c = S.contract(ctx.params.cid);
      if (!c) return `<div class="alert alert-danger"><span class="ic">⚠</span><div>Không tìm thấy hợp đồng.</div></div>`;
      ctx._c = c;
      ctx._t = { step: 0, returnDate: '2026-08-31', reason: '', assets: {}, checks: { shown: false, paid: false } };
      const assets = S.assetsOf(ctx.bid, c.roomCode);
      assets.forEach(a => ctx._t.assets[a.id] = { condition: 'good', compensation: 0 });
      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/contracts">← Hợp đồng</a>
          <div class="page-title">Trả phòng — ${c.roomCode}</div>
          <div class="page-sub">${c.tenantName}</div></div></div>
        <div id="tstepper"></div>
        <div class="card card-pad" id="tbody" style="max-width:720px;margin:0 auto"></div>`;
    },
    mount(ctx) { renderTStep(ctx); },
  };

  function renderTStep(ctx) {
    document.getElementById('tstepper').innerHTML =
      `<div class="stepper" style="max-width:720px;margin:0 auto 24px">` + TSTEPS.map((s, i) =>
        `<div class="step ${i < ctx._t.step ? 'done' : ''} ${i === ctx._t.step ? 'current' : ''}">
          <div class="dot">${i < ctx._t.step ? '✓' : i + 1}</div><div class="lbl">${s}</div></div>`).join('') + `</div>`;
    [tStep1, tStep2, tStep3, tStep4][ctx._t.step](ctx, document.getElementById('tbody'));
  }
  function tFoot(ctx, opts) {
    const t = ctx._t;
    return `<div class="between" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--neutral-200)">
      ${t.step > 0 ? '<button class="btn btn-outline" data-tback>← Quay lại</button>' : '<span></span>'}
      <button class="btn ${opts && opts.danger ? 'btn-danger' : 'btn-primary'}" data-tnext ${opts && opts.disable ? 'disabled' : ''}>${(opts && opts.label) || 'Tiếp tục →'}</button></div>`;
  }
  function tWire(ctx, onNext) {
    const t = ctx._t;
    const b = document.querySelector('[data-tback]'); if (b) b.onclick = () => { t.step--; renderTStep(ctx); };
    document.querySelector('[data-tnext]').onclick = () => { if (onNext && onNext() === false) return; t.step++; renderTStep(ctx); };
  }

  function tStep1(ctx, body) {
    const t = ctx._t;
    body.innerHTML = `<h3 style="margin-bottom:16px">Thông tin trả phòng</h3>
      <div class="field"><label>Ngày trả phòng</label><input class="input" type="date" data-x="date" value="${t.returnDate}"></div>
      <div class="field" style="margin-top:12px"><label>Lý do trả phòng</label>
        <select class="select" data-x="reason"><option>Hết hạn hợp đồng</option><option>Khách chủ động trả sớm</option><option>Chuyển phòng</option><option>Khác</option></select></div>
      ${tFoot(ctx)}`;
    body.querySelector('[data-x="date"]').oninput = (e) => t.returnDate = e.target.value;
    body.querySelector('[data-x="reason"]').onchange = (e) => t.reason = e.target.value;
    tWire(ctx);
  }

  function tStep2(ctx, body) {
    const t = ctx._t;
    const assets = S.assetsOf(ctx.bid, ctx._c.roomCode);
    const rows = assets.map(a => {
      const st = t.assets[a.id];
      const months = Math.min(a.lifeMonths, U.daysBetween(a.buyDate, U.today()) / 30 | 0);
      const residual = Math.round(a.buyPrice * (1 - months / a.lifeMonths));
      return `<div class="card" style="box-shadow:none;margin-bottom:12px"><div class="card-pad">
        <div class="between"><div><b>${a.name}</b> <span class="mono muted text-xs">${a.id}</span></div>
          <span class="muted text-xs">Lúc giao: Tốt</span></div>
        <div class="field" style="margin-top:12px"><label>Tình trạng hiện tại</label>
          <div class="row-gap-3 wrap">
            ${['good', 'wear', 'broken'].map(cd => `<label class="check"><input type="radio" name="cond-${a.id}" value="${cd}" ${st.condition === cd ? 'checked' : ''}> ${UI.STATUS.asset[cd].label}</label>`).join('')}
          </div></div>
        <div class="between" style="margin-top:12px">
          <div><div class="muted text-xs">Giá trị còn lại</div><div class="mono b">${U.currency(residual)}</div>
            <div class="muted text-xs">Mua ${U.currency(a.buyPrice)} · dùng ${months}/${a.lifeMonths} tháng</div></div>
          <div class="field" style="max-width:200px"><label>Bồi thường (₫)</label>
            <input class="input money" data-comp="${a.id}" value="${U.number(st.compensation)}" ${st.condition === 'good' ? 'disabled' : ''}></div>
        </div></div></div>`;
    }).join('');
    body.innerHTML = `<h3 style="margin-bottom:4px">Kiểm kê tài sản</h3>
      <p class="muted" style="margin-bottom:16px">Đối chiếu với biên bản bàn giao ban đầu.</p>
      ${rows || '<p class="muted">Không có tài sản.</p>'}${tFoot(ctx)}`;
    assets.forEach(a => {
      body.querySelectorAll(`input[name="cond-${a.id}"]`).forEach(r => r.onchange = () => {
        t.assets[a.id].condition = r.value;
        const comp = body.querySelector(`[data-comp="${a.id}"]`);
        comp.disabled = r.value === 'good';
        if (r.value === 'good') { t.assets[a.id].compensation = 0; comp.value = '0'; }
        else if (r.value === 'broken' && !t.assets[a.id].compensation) {
          // gợi ý = giá trị còn lại
          const months = Math.min(a.lifeMonths, U.daysBetween(a.buyDate, U.today()) / 30 | 0);
          const residual = Math.round(a.buyPrice * (1 - months / a.lifeMonths));
          t.assets[a.id].compensation = residual; comp.value = U.number(residual);
        }
      });
      const comp = body.querySelector(`[data-comp="${a.id}"]`);
      if (comp) comp.oninput = () => { const n = U.parseNum(comp.value) || 0; t.assets[a.id].compensation = n; comp.value = U.number(n); };
    });
    tWire(ctx);
  }

  function tStep3(ctx, body) {
    const c = ctx._c;
    const invs = S.invoicesForContract(c.id).filter(i => i.status !== 'paid' && i.status !== 'cancelled');
    const debt = invs.reduce((s, i) => s + (i.total - i.paid), 0);
    ctx._t.debt = debt;
    const rows = invs.length ? invs.map(i => `<div class="alloc-row"><span>${i.id} · ${i.period}</span>
      <span class="a-amt">${U.currency(i.total - i.paid)}</span></div>`).join('') : '<p class="muted">Không còn công nợ hóa đơn.</p>';
    body.innerHTML = `<h3 style="margin-bottom:16px">Chốt công nợ</h3>
      <div class="field"><label>Chỉ số điện chốt</label><input class="input mono" placeholder="Nhập chỉ số cuối"></div>
      <div class="field" style="margin-top:12px"><label>Chỉ số nước chốt</label><input class="input mono" placeholder="Nhập chỉ số cuối"></div>
      <h4 style="margin:20px 0 8px">Công nợ hóa đơn còn lại</h4>
      <div class="alloc-box">${rows}<div class="alloc-row" style="border-top:2px solid var(--neutral-200);margin-top:4px"><b>Tổng công nợ</b><b class="a-amt">${U.currency(debt)}</b></div></div>
      ${tFoot(ctx)}`;
    tWire(ctx);
  }

  function tStep4(ctx, body) {
    const c = ctx._c, t = ctx._t;
    const deposit = c.deposit;
    const debt = t.debt || 0;
    const compensation = Object.values(t.assets).reduce((s, a) => s + (a.compensation || 0), 0);
    const penalty = t.reason === 'Khách chủ động trả sớm' ? 0 : 0;
    const refund = deposit - debt - compensation - penalty;
    const compAssets = Object.entries(t.assets).filter(([, a]) => a.compensation > 0)
      .map(([id]) => id).join(', ');
    body.innerHTML = `<h3 style="margin-bottom:16px">Quyết toán hợp đồng</h3>
      <div class="card" style="box-shadow:none"><div class="card-pad">
        <div class="settle-row"><span class="b">Tiền cọc đang giữ</span><span class="amt">${U.currency(deposit)}</span></div>
        <div style="margin:10px 0 4px" class="muted b">Trừ các khoản:</div>
        <div class="settle-row"><span>Công nợ hóa đơn còn lại</span><span class="amt" style="color:var(--danger)">−${U.currency(debt)}</span></div>
        <div class="settle-row"><span>Bồi thường tài sản hư hỏng<div class="sub">${compAssets || 'Không'}</div></span><span class="amt" style="color:var(--danger)">−${U.currency(compensation)}</span></div>
        <div class="settle-row"><span>Phạt trả phòng trước hạn</span><span class="amt" style="color:var(--danger)">−${U.currency(penalty)}</span></div>
      </div></div>
      <div class="settle-total ${refund >= 0 ? 'pos' : 'neg'}" style="margin-top:16px">
        <span>${refund >= 0 ? 'Số tiền hoàn trả khách thuê' : 'Khách thuê còn phải thanh toán'}</span>
        <span class="amt">${U.currency(Math.abs(refund))}</span></div>
      <div class="col" style="gap:8px;margin-top:16px">
        <label class="check"><input type="checkbox" data-chk="shown"> Đã trình bày bảng quyết toán cho khách thuê</label>
        <label class="check"><input type="checkbox" data-chk="paid"> Đã ${refund >= 0 ? 'chi trả số tiền hoàn cọc' : 'thu số tiền còn thiếu'}</label>
      </div>
      <div class="alert alert-info" style="margin-top:16px"><span class="ic">ℹ</span><div>Sau khi xác nhận, hệ thống sẽ:
        <ul class="consequence" style="margin:6px 0 0"><li>Thanh lý hợp đồng</li><li>Thu hồi toàn bộ mã mở cửa</li>
        <li>Chuyển phòng sang trạng thái dọn dẹp</li><li>Chuyển tài khoản khách sang chế độ chỉ đọc</li></ul></div></div>
      <div class="between" style="margin-top:24px">
        <button class="btn btn-outline" data-tback>← Quay lại</button>
        <button class="btn btn-danger btn-lg" data-settle disabled>Xác nhận thanh lý</button></div>`;
    const btn = body.querySelector('[data-settle]');
    const check = () => { btn.disabled = !(t.checks.shown && t.checks.paid); };
    body.querySelectorAll('[data-chk]').forEach(c2 => c2.onchange = () => { t.checks[c2.dataset.chk] = c2.checked; check(); });
    body.querySelector('[data-tback]').onclick = () => { t.step--; renderTStep(ctx); };
    btn.onclick = () => {
      btn.classList.add('loading');
      setTimeout(() => {
        const room = S.room(ctx.bid, c.roomCode);
        c.status = 'terminated'; room.status = 'cleaning'; room.tenantName = null; room.tenantId = null;
        room.contractId = null; room.contractEnd = null; room.debt = 0;
        S.log('contract.terminate', `Thanh lý hợp đồng ${c.roomCode}, hoàn ${U.currency(refund)}`);
        S.persist();
        UI.toast('Đã thanh lý hợp đồng', { type: 'ok' });
        HH.router.go(`/b/${ctx.bid}/contracts`);
      }, 700);
    };
  }
})();

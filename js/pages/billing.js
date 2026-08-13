/* ============================================================
   Trang: Chỉ số điện nước, Hóa đơn, Chi tiết HĐ, Thanh toán/công nợ
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  /* ================= GHI CHỈ SỐ (§3.6) ================= */
  HH.pages.readings = {
    render(ctx) {
      ctx._tab = ctx._tab || 'elec';
      const rooms = S.roomsOf(ctx.bid).filter(r => r.status === 'occupied' || r.status === 'notice')
        .sort((a, b) => a.code.localeCompare(b.code));
      const period = S.CUR_PERIOD;
      const done = rooms.filter(r => { const rd = S.reading(ctx.bid, r.code, period); return rd && rd.elecCurr != null; }).length;
      return h`<div class="page-head">
        <div><div class="page-title">Chỉ số điện nước</div><div class="page-sub">${ctx.building.name} · Kỳ T8/2026</div></div>
        <div class="page-actions">
          <span class="badge s-info" style="align-self:center"><span class="dot"></span>Đã ghi ${done}/${rooms.length} phòng</span>
          <button class="btn btn-outline" id="importXls">Nhập từ Excel</button>
          <button class="btn btn-primary" id="toBill">Xong, lập hóa đơn →</button>
        </div></div>
        <div class="tabs" style="margin-bottom:16px">
          <button class="tab ${raw(ctx._tab === 'elec' ? 'active' : '')}" data-tab="elec">⚡ Điện</button>
          <button class="tab ${raw(ctx._tab === 'water' ? 'active' : '')}" data-tab="water">💧 Nước</button>
        </div>
        <div class="dt-wrap"><div class="dt-scroll"><table class="dt" id="readTable">
          <thead><tr><th>Phòng</th><th>Khách</th>
            <th class="num">${raw(ctx._tab === 'elec' ? 'Điện' : 'Nước')} kỳ trước</th>
            <th class="num">${raw(ctx._tab === 'elec' ? 'Điện' : 'Nước')} kỳ này</th>
            <th class="num">Tiêu thụ</th><th class="center">Ảnh</th><th></th></tr></thead>
          <tbody>${raw(readingRows(ctx, rooms, period))}</tbody>
        </table></div></div>
        <p class="muted text-xs" style="margin-top:10px">Mẹo: dùng <kbd>Enter</kbd> hoặc <kbd>Tab</kbd> để nhảy xuống phòng kế tiếp.</p>`;
    },
    mount(ctx) {
      document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { ctx._tab = b.dataset.tab; HH.router.render(); });
      document.getElementById('toBill').onclick = () => HH.router.go(`/b/${ctx.bid}/invoices`);
      document.getElementById('importXls').onclick = () => importExcel(ctx);
      wireReadingInputs(ctx);
    },
  };

  function readingRows(ctx, rooms, period) {
    const tab = ctx._tab;
    return rooms.map((r, idx) => {
      const rd = S.reading(ctx.bid, r.code, period) || {};
      const prev = tab === 'elec' ? rd.elecPrev : rd.waterPrev;
      const curr = tab === 'elec' ? rd.elecCurr : rd.waterCurr;
      const use = (curr != null && prev != null) ? curr - prev : null;
      const avg = tab === 'elec' ? (rd.elecAvg || 190) : 4;
      const abnormal = use != null && use > avg * 3;
      const isTenant = rd.source === 'tenant' && !rd.approved;
      const rowCls = abnormal ? 'warn-row' : (isTenant ? 'tenant-row' : '');
      const done = curr != null;
      return `<tr class="${rowCls}" data-code="${r.code}">
        <td><b>${r.code}</b></td>
        <td>${r.tenantName}${isTenant ? ' <span class="self-tag">👤 khách tự ghi</span>' : ''}</td>
        <td class="num">${prev != null ? U.number(prev) : '—'}</td>
        <td class="num"><input class="input reading-input mono" data-read="${idx}" data-code="${r.code}" value="${curr != null ? curr : ''}" ${isTenant ? 'style="background:var(--info-bg)"' : ''}></td>
        <td class="num"><span class="consume" data-use="${r.code}" style="${abnormal ? 'color:var(--warning)' : ''}">${use != null ? U.number(use) : ''}</span>
          ${abnormal ? `<div class="reading-note" data-note="${r.code}">Cao gấp ${(use / avg).toFixed(1)} lần</div>` : ''}</td>
        <td class="center"><button class="photo-btn" title="Ảnh đồng hồ">${done ? '📷' : '＋'}</button></td>
        <td class="center">${isTenant ? `<button class="btn btn-sm btn-outline" data-approve="${r.code}">Duyệt</button>` : (done ? '<span style="color:var(--success)">✓</span>' : '')}</td>
      </tr>`;
    }).join('');
  }

  function wireReadingInputs(ctx) {
    const inputs = Array.from(document.querySelectorAll('[data-read]'));
    inputs.forEach((inp) => {
      inp.oninput = () => {
        const n = U.parseNum(inp.value); inp.value = n != null ? n : '';
        const code = inp.dataset.code;
        const rd = S.reading(ctx.bid, code, S.CUR_PERIOD);
        if (!rd) return;
        const prev = ctx._tab === 'elec' ? rd.elecPrev : rd.waterPrev;
        if (ctx._tab === 'elec') rd.elecCurr = n; else rd.waterCurr = n;
        const useEl = document.querySelector(`[data-use="${code}"]`);
        if (n == null) { useEl.textContent = ''; return; }
        // chỉ số mới nhỏ hơn cũ -> hỏi nguyên nhân
        if (n < prev) { promptRollover(ctx, code, prev, n, inp); return; }
        const use = n - prev; useEl.textContent = U.number(use);
        const avg = ctx._tab === 'elec' ? (rd.elecAvg || 190) : 4;
        const tr = inp.closest('tr');
        if (use > avg * 3) { tr.classList.add('warn-row'); useEl.style.color = 'var(--warning)';
          if (!tr.querySelector('[data-note]')) { const note = document.createElement('div'); note.className = 'reading-note'; note.dataset.note = code; note.textContent = `Cao gấp ${(use / avg).toFixed(1)} lần`; useEl.after(note); } }
        else { tr.classList.remove('warn-row'); useEl.style.color = ''; const nt = tr.querySelector('[data-note]'); if (nt) nt.remove(); }
      };
      inp.onkeydown = (e) => {
        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          const i = inputs.indexOf(inp);
          const next = inputs[i + 1]; if (next) { next.focus(); next.select(); }
        }
      };
    });
    document.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => {
      const rd = S.reading(ctx.bid, b.dataset.approve, S.CUR_PERIOD); if (rd) rd.approved = true;
      UI.toast(`Đã duyệt chỉ số phòng ${b.dataset.approve}`, { type: 'ok' }); HH.router.render();
    });
  }

  function promptRollover(ctx, code, prev, curr, inp) {
    UI.modal({ title: `Chỉ số mới nhỏ hơn chỉ số cũ — ${code}`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Kỳ trước <b class="mono">${U.number(prev)}</b>, kỳ này <b class="mono">${U.number(curr)}</b>. Nguyên nhân?</p>
      <div class="col" style="gap:8px">
        <label class="check"><input type="radio" name="rollover" value="wrap" checked> Đồng hồ quay hết vòng</label>
        <label class="check"><input type="radio" name="rollover" value="replace"> Đã thay đồng hồ mới</label>
      </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" data-ok>Xác nhận</button>`,
      onMount(el, close) {
        el.querySelector('[data-ok]').onclick = () => {
          const v = el.querySelector('input[name=rollover]:checked').value;
          close();
          UI.toast(v === 'wrap' ? 'Đã tính bù theo số vòng đồng hồ' : 'Đã ghi nhận thay đồng hồ mới', { type: 'ok' });
        };
      },
      onClose() { inp.value = ''; },
    });
  }

  function importExcel(ctx) {
    UI.modal({ title: 'Nhập chỉ số từ Excel', bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Tải file mẫu, điền chỉ số rồi dán vào ô dưới. Hệ thống đối chiếu theo mã phòng.</p>
      <a href="#" class="btn btn-outline btn-sm" style="margin-bottom:12px">⬇ Tải file mẫu</a>
      <textarea class="textarea mono" placeholder="P101\t12680\nP102\t8512\n..." style="min-height:120px"></textarea>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" data-close>Xem trước & ghi nhận</button>` });
  }

  /* ================= HÓA ĐƠN (§3.7) ================= */
  HH.pages.invoices = {
    render(ctx) {
      const period = S.CUR_PERIOD;
      let list = S.invoicesOf(ctx.bid, period);
      // lọc theo query ?status=
      const q = new URLSearchParams((location.hash.split('?')[1] || ''));
      const initStatus = q.get('status');
      const issued = list.filter(i => i.status !== 'cancelled');
      const totalIssued = issued.reduce((s, i) => s + i.total, 0);
      const collected = issued.reduce((s, i) => s + i.paid, 0);
      const remaining = totalIssued - collected;
      const overdue = issued.filter(i => i.status === 'overdue');
      const overdueSum = overdue.reduce((s, i) => s + (i.total - i.paid), 0);

      const cards = `<div class="metric-grid">
        ${UI.metricCard({ label: 'Tổng phát hành', value: totalIssued, format: 'currency', sub: issued.length + ' HĐ' })}
        ${UI.metricCard({ label: 'Đã thu', value: collected, format: 'currency', intent: 'success', sub: issued.filter(i => i.status === 'paid').length + ' HĐ' })}
        ${UI.metricCard({ label: 'Còn phải thu', value: remaining, format: 'currency', intent: 'warning' })}
        ${UI.metricCard({ label: 'Quá hạn', value: overdueSum, format: 'currency', intent: 'danger', sub: overdue.length + ' HĐ' })}
      </div>`;

      const statusFilter = `<select class="select" id="stFilter" style="max-width:170px">
        <option value="">Mọi trạng thái</option>
        ${['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'].map(s =>
        `<option value="${s}" ${initStatus === s ? 'selected' : ''}>${UI.STATUS.invoice[s].label}</option>`).join('')}</select>`;

      const dt = UI.DataTable({
        rows: list, rowId: i => i.id, searchKeys: ['id', 'roomCode', 'tenantName'],
        searchPlaceholder: 'Tìm mã HĐ, phòng, khách...',
        selectable: true, initialFilter: initStatus,
        filterFn: (r, f) => r.status === f,
        toolbarLeft: statusFilter,
        toolbarRight: `<button class="btn btn-outline" id="genInv">Sinh hóa đơn</button><button class="btn btn-outline">Xuất Excel</button>`,
        bulkActions: [
          { label: 'Phát hành', primary: true, onClick: (ids, clear) => issueFlow(ctx, ids, clear) },
          { label: 'Xuất Excel', onClick: () => UI.toast('Đã xuất Excel (demo)', { type: 'ok' }) },
        ],
        columns: [
          { key: 'id', label: 'Mã HĐ', mono: true, sortable: true, render: i => `<span class="mono b">${i.id}</span>` },
          { key: 'roomCode', label: 'Phòng' },
          { key: 'tenantName', label: 'Khách', render: i => i.tenantName },
          { key: 'total', label: 'Tổng tiền', align: 'right', sortable: true, render: i => U.currency(i.total) },
          { key: 'paid', label: 'Đã trả', align: 'right', render: i => i.paid ? U.currency(i.paid) : '<span class="faint">0 ₫</span>' },
          { key: 'status', label: 'Trạng thái', render: i => UI.statusBadge(i.status, 'invoice') },
        ],
        onRowClick: i => HH.router.go(`/b/${ctx.bid}/invoices/${i.id}`),
        actions: i => invoiceActions(ctx, i),
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div><div class="page-title">Hóa đơn</div><div class="page-sub">${ctx.building.name} · Kỳ T8/2026</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-primary-new id="genInv2">+ Sinh hóa đơn</button></div>
      </div>
      <div id="periodSel" style="margin-bottom:16px"></div>
      ${raw(cards)}
      <div style="margin-top:16px">${raw(dt.render())}</div>`;
    },
    mount(ctx) {
      // period selector
      const pending = new Set(['2026-08']);
      const psel = document.getElementById('periodSel');
      psel.innerHTML = UI.periodSelector({ value: S.CUR_PERIOD, pending });
      UI.attachPeriod(psel.querySelector('[data-period-root]'), { value: S.CUR_PERIOD, pending,
        onChange: () => UI.toast('Bản demo cố định ở kỳ T8/2026', { type: 'ok' }) });
      ctx._dt.attach(document);
      const st = document.getElementById('stFilter');
      st.onchange = () => ctx._dt.setFilter(st.value || null);
      if (st.value) ctx._dt.setFilter(st.value);
      const gen = () => generateFlow(ctx);
      document.getElementById('genInv').onclick = gen;
      document.getElementById('genInv2').onclick = gen;
    },
  };

  function invoiceActions(ctx, i) {
    const items = [
      { icon: '👁', label: 'Xem chi tiết', onClick: () => HH.router.go(`/b/${ctx.bid}/invoices/${i.id}`) },
      { icon: '🖨', label: 'In hóa đơn', onClick: () => UI.toast('Đang chuẩn bị bản in (demo)', { type: 'ok' }) },
    ];
    if (i.status !== 'paid' && i.status !== 'cancelled')
      items.push({ icon: '₫', label: 'Ghi nhận thanh toán', onClick: () => paymentDialog(ctx, i) });
    if (S.isOwner() && i.status !== 'cancelled' && i.status !== 'draft')
      items.push({ sep: true }, { icon: '✕', label: 'Hủy hóa đơn', danger: true, onClick: () => cancelInvoice(ctx, i) });
    return items;
  }

  function generateFlow(ctx) {
    const contracts = S.contractsOf(ctx.bid).filter(c => c.status === 'active' || c.status === 'terminating');
    const withReading = contracts.filter(c => { const rd = S.reading(ctx.bid, c.roomCode, S.CUR_PERIOD); return rd && rd.elecCurr != null; });
    const missing = contracts.filter(c => { const rd = S.reading(ctx.bid, c.roomCode, S.CUR_PERIOD); return !(rd && rd.elecCurr != null); });
    UI.modal({ title: `Sinh hóa đơn kỳ T8/2026`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Hệ thống sẽ tạo hóa đơn cho <b>${contracts.length}</b> hợp đồng đang hiệu lực.</p>
      <div class="alert alert-success" style="margin-bottom:10px"><span class="ic">✓</span><div><b>${withReading.length}</b> phòng đã có đủ chỉ số điện nước</div></div>
      ${raw(missing.length ? `<div class="alert alert-warning"><span class="ic">⚠</span><div><b>${missing.length}</b> phòng thiếu chỉ số: ${missing.map(c => c.roomCode).join(', ')}<br>
        <span class="text-sm">Các phòng thiếu chỉ số sẽ được bỏ qua. Bạn có thể bổ sung và sinh lại sau.</span></div></div>` : '')}`,
      footHtml: `${missing.length ? `<button class="btn btn-outline" id="toReadings">Bổ sung chỉ số</button>` : '<span></span>'}<span class="spacer"></span><button class="btn btn-primary" data-go>Vẫn tiếp tục</button>`,
      onMount(el, close) {
        const tr = el.querySelector('#toReadings'); if (tr) tr.onclick = () => { close(); HH.router.go(`/b/${ctx.bid}/readings`); };
        el.querySelector('[data-go]').onclick = () => {
          close();
          // tạo hóa đơn nháp cho phòng có chỉ số nhưng chưa có HĐ kỳ này
          let created = 0;
          withReading.forEach(c => {
            const exists = S.invoicesOf(ctx.bid, S.CUR_PERIOD).find(i => i.contractId === c.id);
            if (!exists) { /* trong bản demo dữ liệu đã có sẵn phần lớn */ created++; }
          });
          UI.toast(created ? `Đã sinh ${created} hóa đơn nháp để rà soát` : 'Các hóa đơn kỳ này đã được tạo trước đó — chuyển sang rà soát', { type: 'ok' });
        };
      },
    });
  }

  function issueFlow(ctx, ids, clear) {
    const steps = ['Đang phát hành hóa đơn...', 'Đang sinh mã thanh toán...', 'Đang gửi thông báo tới khách thuê...'];
    const m = UI.modal({ title: 'Phát hành hóa đơn', dismissable: false,
      bodyHtml: `<div class="progress-track" style="margin-bottom:12px"><div class="progress-fill" id="issueProg" style="width:5%"></div></div>
        <p class="muted" id="issueStep">${steps[0]}</p>`,
      footHtml: undefined });
    let s = 0; const prog = m.el.querySelector('#issueProg'); const label = m.el.querySelector('#issueStep');
    const timer = setInterval(() => {
      s++; prog.style.width = Math.min(100, 5 + s * 33) + '%';
      if (s < steps.length) label.textContent = steps[s];
      if (s >= 3) { clearInterval(timer); S.issueInvoices(ids);
        setTimeout(() => { m.close(); clear && clear(); UI.toast(`Đã phát hành ${ids.length} hóa đơn`, { type: 'ok' }); HH.router.render(); }, 300); }
    }, 550);
  }

  function cancelInvoice(ctx, inv) {
    if (inv.paid > 0) {
      UI.toast('Không thể hủy hóa đơn đã có thanh toán. Bạn có thể phát hành hóa đơn bù.', { type: 'error', sticky: true });
      return;
    }
    UI.dangerDialog({
      title: 'Hủy hóa đơn đã phát hành',
      description: `Hóa đơn <b>${inv.id}</b> đã được gửi tới khách thuê ngày ${U.fmtDate(inv.dueDate)}.`,
      consequences: ['Khách thuê sẽ nhận thông báo hủy', 'Công nợ kỳ này được tính lại', 'Thao tác được ghi vào nhật ký hệ thống'],
      confirmLabel: 'Xác nhận hủy', reasonLabel: 'Lý do hủy',
      onConfirm: (reason) => { S.cancelInvoice(inv.id, reason); UI.toast('Đã hủy hóa đơn', { type: 'ok' }); HH.router.render(); },
    });
  }

  /* ================= CHI TIẾT HÓA ĐƠN (§3.8) ================= */
  HH.pages.invoiceDetail = {
    render(ctx) {
      const inv = S.invoice(ctx.params.iid);
      if (!inv) return `<div class="alert alert-danger"><span class="ic">⚠</span><div>Không tìm thấy hóa đơn.</div></div>`;
      ctx._inv = inv;
      const lines = inv.lines.map(l => `<div class="inv-line"><div class="l-main">
        <div class="l-name">${l.label}</div><div class="l-basis">${l.meta || ''}</div>
        ${l.type === 'elec' ? '<a href="#" class="text-xs" data-meter>Xem ảnh đồng hồ</a>' : ''}</div>
        <div class="l-amt">${U.currency(l.amount)}</div></div>`).join('');
      const pays = S.paymentsOf(inv.id);
      const payRows = pays.length ? pays.map(p => `<div class="between" style="padding:10px 0;border-bottom:1px solid var(--neutral-100)">
        <div class="mono">${U.fmtDate(p.date)} · ${p.method}</div>
        <div class="row-gap-3"><span class="mono b">${U.currency(p.amount)}</span><a href="#" class="text-xs">chứng từ</a></div></div>`).join('')
        : '<p class="muted center" style="padding:12px">Chưa có thanh toán nào</p>';
      const remaining = inv.total - inv.paid;
      const editedBanner = inv.edited ? `<div class="alert alert-purple" style="margin-bottom:16px"><span class="ic">✎</span>
        <div>Hóa đơn này đã được chỉnh sửa ngày ${U.fmtDate(inv.editedAt)} bởi ${inv.editedBy}. <a href="#/logs">Xem nhật ký</a></div></div>` : '';

      return h`<div class="inv-doc" style="margin:0 auto">
        <div class="page-head"><div><a class="back-link" href="#/b/${ctx.bid}/invoices">← Hóa đơn</a>
          <div class="page-title mono">${inv.id}</div></div>
          <div class="page-actions"><button class="kebab" id="invMenu" style="border:1px solid var(--neutral-200)">⋯</button></div></div>
        ${raw(editedBanner)}
        <div class="card inv-header-card">
          <div style="margin-bottom:12px">${raw(UI.statusBadge(inv.status, 'invoice'))}</div>
          <div class="b text-lg">Phòng ${inv.roomCode} · ${inv.tenantName}</div>
          <div class="muted mono">Kỳ ${U.fmtDate(inv.periodStart)} – ${U.fmtDate(inv.periodEnd)}</div>
          <div class="muted mono">Hạn thanh toán: ${U.fmtDate(inv.dueDate)}</div>
          <hr style="border:none;border-top:1px solid var(--neutral-200);margin:16px 0">
          ${raw(lines)}
          <hr style="border:none;border-top:1px solid var(--neutral-200);margin:16px 0">
          <div class="inv-total-row"><span>Đã thanh toán</span><span class="amt" style="color:var(--success)">${U.currency(inv.paid)}</span></div>
          <div class="inv-total-row"><span>Còn lại</span><span class="amt" style="color:${raw(remaining > 0 ? 'var(--danger)' : 'inherit')}">${U.currency(remaining)}</span></div>
          <div class="inv-total-row grand"><span>Tổng cộng</span><span class="amt">${U.currency(inv.total)}</span></div>
        </div>
        <h3 style="margin:24px 0 8px">Lịch sử thanh toán</h3>
        <div class="card card-pad">${raw(payRows)}</div>
      </div>`;
    },
    mount(ctx) {
      const inv = ctx._inv; if (!inv) return;
      const mb = document.getElementById('invMenu');
      if (mb) mb.onclick = () => UI.openMenu(mb, [
        { icon: '🖨', label: 'In hóa đơn', onClick: () => UI.toast('Đang chuẩn bị bản in (demo)', { type: 'ok' }) },
        { icon: '✉', label: 'Gửi lại cho khách', onClick: () => UI.toast('Đã gửi lại hóa đơn cho khách', { type: 'ok' }) },
        ...(inv.status !== 'paid' && inv.status !== 'cancelled' ? [{ icon: '₫', label: 'Ghi nhận thanh toán', onClick: () => paymentDialog(ctx, inv) }] : []),
        ...(S.isOwner() && inv.status !== 'cancelled' ? [{ sep: true }, { icon: '✕', label: 'Hủy hóa đơn', danger: true, onClick: () => cancelInvoice(ctx, inv) }] : []),
      ]);
      const meter = document.querySelector('[data-meter]');
      if (meter) meter.onclick = (e) => { e.preventDefault();
        UI.modal({ title: 'Ảnh đồng hồ điện', bodyHtml: `<div class="ocr-img" style="min-height:280px">🔌 Ảnh chốt chỉ số (demo)</div>`,
          footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` }); };
    },
  };

  /* ================= GHI NHẬN THANH TOÁN (§3.9) ================= */
  function paymentDialog(ctx, invoice) {
    // các hóa đơn còn nợ của cùng hợp đồng, cũ trước
    const debts = S.invoicesForContract(invoice.contractId)
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .sort((a, b) => a.period.localeCompare(b.period));
    const totalDebt = debts.reduce((s, i) => s + (i.total - i.paid), 0);
    const c = S.contract(invoice.contractId);

    UI.modal({ title: 'Ghi nhận thanh toán', size: 'wide', bodyHtml: h`
      <div class="grid-2">
        <div class="field"><label>Hợp đồng</label><div class="b">${invoice.roomCode} · ${invoice.tenantName}</div></div>
        <div class="field"><label>Công nợ</label><div class="mono b" style="color:var(--danger)">${U.currency(totalDebt)}</div></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Số tiền nhận (₫)</label>
        <input class="input money" id="payAmt" placeholder="0" value="${U.number(totalDebt)}"></div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Hình thức</label><select class="select" id="payMethod"><option>Chuyển khoản</option><option>Tiền mặt</option><option>Ví điện tử</option></select></div>
        <div class="field"><label>Ngày nhận</label><input class="input" type="date" id="payDate" value="2026-08-12"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Nội dung chuyển khoản</label><input class="input" id="payNote" placeholder="VD: ${invoice.roomCode} T8"></div>
      <div class="field" style="margin-top:12px"><label>Chứng từ</label><label class="btn btn-outline btn-sm" style="width:fit-content">📎 Tải ảnh<input type="file" hidden></label></div>
      <h4 style="margin:20px 0 8px">Phân bổ tự động <span class="muted text-xs" style="font-weight:400">· trả trước cho hóa đơn kỳ cũ nhất</span></h4>
      <div class="alloc-box" id="allocBox"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="doPay">Ghi nhận</button>`,
      onMount(el, close) {
        const amtInp = el.querySelector('#payAmt');
        const box = el.querySelector('#allocBox');
        const renderAlloc = () => {
          let amt = U.parseNum(amtInp.value) || 0;
          let rows = '';
          debts.forEach(i => {
            const need = i.total - i.paid;
            const applied = Math.min(need, amt);
            amt -= applied;
            const full = applied >= need;
            rows += `<div class="alloc-row"><span>${i.id} · ${i.period}</span>
              <span class="a-amt">${U.currency(need)}</span>
              ${applied > 0 ? (full ? '<span class="a-check">✓</span>' : `<span class="a-partial">${U.currency(applied)} / ${U.currency(need)}</span>`) : '<span class="faint">—</span>'}</div>`;
          });
          rows += `<div class="alloc-row" style="border-top:2px solid var(--neutral-200)"><b>Số dư chuyển kỳ sau</b>
            <b class="a-amt" style="color:${amt > 0 ? 'var(--info)' : 'inherit'}">${U.currency(amt)}</b></div>`;
          box.innerHTML = rows;
        };
        amtInp.oninput = () => { const n = U.parseNum(amtInp.value); amtInp.value = n != null ? U.number(n) : ''; renderAlloc(); };
        renderAlloc();
        el.querySelector('#doPay').onclick = (e) => {
          let amt = U.parseNum(amtInp.value) || 0;
          if (amt <= 0) { UI.toast('Nhập số tiền hợp lệ', { type: 'error' }); return; }
          e.currentTarget.classList.add('loading');
          const method = el.querySelector('#payMethod').value;
          const date = new Date(el.querySelector('#payDate').value).toISOString();
          const note = el.querySelector('#payNote').value;
          setTimeout(() => {
            debts.forEach(i => { const need = i.total - i.paid; const applied = Math.min(need, amt);
              if (applied > 0) { S.recordPayment(i.id, applied, method, date, note); amt -= applied; } });
            close(); UI.toast('Đã ghi nhận thanh toán', { type: 'ok' }); HH.router.render();
          }, 500);
        };
      },
    });
  }

  /* ================= THANH TOÁN & CÔNG NỢ ================= */
  HH.pages.payments = {
    render(ctx) {
      const contracts = S.contractsOf(ctx.bid).filter(c => c.status === 'active' || c.status === 'terminating');
      const rows = contracts.map(c => {
        const debt = S.invoicesForContract(c.id).filter(i => i.status !== 'paid' && i.status !== 'cancelled')
          .reduce((s, i) => s + (i.total - i.paid), 0);
        return { c, debt };
      }).filter(x => x.debt > 0).sort((a, b) => b.debt - a.debt);
      const total = rows.reduce((s, x) => s + x.debt, 0);
      const dt = UI.DataTable({
        rows, rowId: x => x.c.id, searchKeys: [],
        searchPlaceholder: 'Tìm phòng, khách...',
        emptyTitle: 'Không có công nợ', emptyIcon: '✓', emptyDesc: 'Tất cả hóa đơn đã được thanh toán.',
        columns: [
          { key: 'room', label: 'Phòng', render: x => `<b>${x.c.roomCode}</b>` },
          { key: 'tenant', label: 'Khách thuê', render: x => x.c.tenantName },
          { key: 'debt', label: 'Công nợ', align: 'right', sortable: true, sortVal: x => x.debt, render: x => `<span style="color:var(--danger);font-weight:600">${U.currency(x.debt)}</span>` },
        ],
        actions: x => [{ icon: '₫', label: 'Ghi nhận thanh toán', onClick: () => {
          const inv = S.invoicesForContract(x.c.id).find(i => i.status !== 'paid' && i.status !== 'cancelled');
          if (inv) paymentDialog(ctx, inv);
        } }],
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div><div class="page-title">Thanh toán & công nợ</div><div class="page-sub">${ctx.building.name}</div></div></div>
        <div class="metric-grid" style="grid-template-columns:repeat(2,1fr);max-width:520px;margin-bottom:16px">
          ${raw(UI.metricCard({ label: 'Tổng công nợ', value: total, format: 'currency', intent: 'warning' }))}
          ${raw(UI.metricCard({ label: 'Số khách còn nợ', value: rows.length, format: 'number' }))}
        </div>
        ${raw(dt.render())}`;
    },
    mount(ctx) { ctx._dt.attach(document); },
  };
})();

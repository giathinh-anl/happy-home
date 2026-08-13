/* ============================================================
   Trang: Hợp đồng — danh sách, lập mới (5 bước), trả phòng & thanh lý
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  /* ---------------- DANH SÁCH ---------------- */
  HH.pages.contracts = {
    render(ctx) {
      const rows = S.contractsOf(ctx.bid);
      const dt = UI.DataTable({
        rows, rowId: c => c.id, searchKeys: ['id', 'roomCode', 'tenantName'],
        searchPlaceholder: 'Tìm mã HĐ, phòng, khách...',
        emptyTitle: 'Chưa có hợp đồng nào', emptyIcon: '📄',
        emptyAction: { label: 'Lập hợp đồng', onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/new`) },
        columns: [
          { key: 'id', label: 'Mã HĐ', mono: true, sortable: true, render: c => `<span class="mono b">${c.id.slice(0, 8)}</span>` },
          { key: 'roomCode', label: 'Phòng', render: c => `<span class="badge s-info"><span class="dot"></span>${c.roomCode}</span>` },
          { key: 'tenantName', label: 'Khách thuê', sortable: true, render: c => `<b>${c.tenantName}</b>` },
          { key: 'rent', label: 'Giá thuê', align: 'right', sortable: true, render: c => U.currency(c.rent) },
          { key: 'start', label: 'Bắt đầu', render: c => `<span class="mono">${U.fmtDate(c.start)}</span>` },
          { key: 'end', label: 'Kết thúc', sortable: true, sortVal: c => new Date(c.end).getTime(),
            render: c => { const d = U.daysBetween(U.today(), c.end); const soon = d >= 0 && d <= 30;
              return `<span class="mono ${soon ? '' : ''}" style="${soon ? 'color:var(--warning);font-weight:600' : ''}">${U.fmtDate(c.end)}${soon ? ` · còn ${d}n` : ''}</span>`; } },
          { key: 'status', label: 'Trạng thái', render: c => UI.statusBadge(c.expiringSoon && c.status === 'active' ? 'expiring' : c.status, 'contract') },
        ],
        actions: c => {
          const items = [{ icon: '👁', label: 'Xem hợp đồng', onClick: () => showContract(c) }];
          if (c.status === 'active' || c.status === 'terminating')
            items.push({ sep: true }, { icon: '⏻', label: 'Trả phòng & thanh lý', danger: true, onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/${c.id}/terminate`) });
          return items;
        },
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div><div class="page-title">Hợp đồng</div><div class="page-sub">${ctx.building.name} · ${rows.length} hợp đồng</div></div>
        <div class="page-actions"><button class="btn btn-primary" data-primary-new>+ Lập hợp đồng</button></div>
      </div>${raw(dt.render())}`;
    },
    mount(ctx) {
      ctx._dt.attach(document);
      document.querySelector('[data-primary-new]').onclick = () => HH.router.go(`/b/${ctx.bid}/contracts/new`);
    },
  };

  function showContract(c) {
    UI.modal({ title: `Hợp đồng ${c.roomCode}`, size: 'wide', bodyHtml: h`
      <div class="row-gap-3" style="margin-bottom:16px">${raw(UI.statusBadge(c.status, 'contract'))}
        <span class="mono muted">${c.id}</span></div>
      <div class="grid-2">
        <div class="field"><label>Khách thuê</label><div class="b">${c.tenantName}</div></div>
        <div class="field"><label>Phòng</label><div>${c.roomCode}</div></div>
        <div class="field"><label>Giá thuê</label><div class="mono b">${U.currency(c.rent)}</div></div>
        <div class="field"><label>Tiền cọc</label><div class="mono b">${U.currency(c.deposit)}</div></div>
        <div class="field"><label>Ngày bắt đầu</label><div class="mono">${U.fmtDate(c.start)}</div></div>
        <div class="field"><label>Ngày kết thúc</label><div class="mono">${U.fmtDate(c.end)}</div></div>
        <div class="field"><label>Ngày chốt hóa đơn</label><div>Ngày ${c.billingDay} hàng tháng</div></div>
        <div class="field"><label>Hạn thanh toán</label><div>${c.dueDays} ngày sau ngày chốt</div></div>
      </div>`, footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` });
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
      ${navFoot(ctx)}`;
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

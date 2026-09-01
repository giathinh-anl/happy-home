/* ============================================================
   Trang: Dịch vụ & đơn giá, Tài sản
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;
  const methodLabel = { per_kwh: 'Theo chỉ số điện', per_person: 'Theo số người', flat: 'Cố định theo tháng' };

  /* ---------------- DỊCH VỤ & ĐƠN GIÁ ---------------- */
  const SVC_ICONS = { per_kwh: '⚡', per_person: '💧', flat: '📄' };

  HH.pages.services = {
    render(ctx) {
      const svcs = S.servicesOf(ctx.bid);
      const owner = S.isOwner();
      const rows = svcs.map(s => `<tr>
        <td><span style="font-size:18px;margin-right:6px">${SVC_ICONS[s.method] || '🛎️'}</span><b>${U.esc(s.name)}</b></td>
        <td><span class="badge s-neutral"><span class="dot"></span>${methodLabel[s.method]}</span></td>
        <td class="num mono b">${U.number(s.unit)}</td>
        <td>${s.unitLabel}</td>
        ${owner ? `<td class="col-actions"><button class="kebab" data-svmenu="${s.id}">⋯</button></td>` : ''}
      </tr>`);
      const tbody = rows.length ? rows
        : [`<tr><td colspan="${owner ? 5 : 4}"><div class="empty"><div class="ic">🛎️</div><h4>Chưa có dịch vụ nào</h4><p class="muted">Thêm dịch vụ để tính vào hóa đơn hằng tháng.</p></div></td></tr>`];
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Dịch vụ & đơn giá</div><div class="page-sub">${ctx.building.name} · ${svcs.length} dịch vụ · đơn giá hiện hành</div></div></div>
        <div class="page-actions"><button class="btn btn-success" id="svExport">📊 Xuất excel</button>
        ${raw(owner ? '<button class="btn btn-primary" data-primary-new>＋ Thêm dịch vụ</button>' : '')}</div>
      </div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Dịch vụ</th><th>Phương pháp tính</th><th class="num">Đơn giá</th><th>Đơn vị</th>${raw(owner ? '<th></th>' : '')}</tr></thead>
        <tbody>${rows.length ? raw(rows.join('')) : raw(tbody[0])}</tbody></table></div></div>`;
    },
    mount(ctx) {
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => serviceForm(ctx, null);
      const ex = document.getElementById('svExport');
      if (ex) ex.onclick = () => {
        const svcs = S.servicesOf(ctx.bid);
        U.downloadCSV(`dich-vu-${ctx.bid}.csv`, ['Dịch vụ', 'Phương pháp tính', 'Đơn giá', 'Đơn vị'],
          svcs.map(s => [s.name, methodLabel[s.method], s.unit, s.unitLabel]));
        UI.toast('Đã tải file Excel (CSV)', { type: 'ok' });
      };
      document.querySelectorAll('[data-svmenu]').forEach(b => b.onclick = () => {
        const s = S.servicesOf(ctx.bid).find(x => x.id === b.dataset.svmenu);
        UI.openMenu(b, [
          { icon: '✏️', label: 'Sửa dịch vụ', onClick: () => serviceForm(ctx, s) },
          { sep: true },
          { icon: '🗑', label: 'Xóa dịch vụ', danger: true, onClick: () => {
            UI.dangerDialog({ title: `Xóa dịch vụ "${s.name}"`,
              description: 'Dịch vụ sẽ không còn được tính vào hóa đơn các kỳ tới.',
              consequences: ['Không ảnh hưởng hóa đơn đã phát hành', 'Thao tác được ghi vào nhật ký'],
              confirmLabel: 'Xóa dịch vụ', reasonLabel: 'Lý do xóa',
              onConfirm: () => { S.removeService(s.id); UI.toast('Đã xóa dịch vụ', { type: 'ok' }); HH.router.render(); } });
          } },
        ]);
      });
    },
  };

  function serviceForm(ctx, s) {
    const isNew = !s;
    const methods = { per_kwh: 'Theo chỉ số điện (₫/kWh)', per_person: 'Theo số người (₫/người)', flat: 'Cố định theo tháng (₫/tháng)' };
    const method = s ? s.method : 'flat';
    UI.modal({
      title: isNew ? 'Thêm dịch vụ' : `Sửa dịch vụ — ${s.name}`,
      bodyHtml: h`
        <div class="field"><label>Tên dịch vụ *</label><input class="input" id="svName" value="${s ? s.name : ''}" placeholder="VD: Phí giữ xe"></div>
        <div class="field" style="margin-top:12px"><label>Phương pháp tính *</label>
          <select class="select" id="svMethod">${raw(Object.entries(methods).map(([k, v]) => `<option value="${k}" ${k === method ? 'selected' : ''}>${v}</option>`).join(''))}</select></div>
        <div class="field" style="margin-top:12px"><label>Đơn giá (₫) *</label><input class="input money" id="svUnit" value="${s ? U.number(s.unit) : ''}" placeholder="0"></div>
        <p class="muted text-xs" style="margin-top:8px">Áp dụng cho hóa đơn phát hành từ kỳ tới. Hợp đồng có đơn giá riêng không bị ảnh hưởng.</p>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="svSave">${isNew ? 'Thêm dịch vụ' : 'Lưu'}</button>`,
      onMount(el, close) {
        const unit = el.querySelector('#svUnit');
        unit.oninput = () => { const n = U.parseNum(unit.value); unit.value = n ? U.number(n) : ''; };
        el.querySelector('#svSave').onclick = (e) => {
          const name = el.querySelector('#svName').value.trim();
          const m = el.querySelector('#svMethod').value;
          const u = U.parseNum(unit.value);
          if (!name || !u) { UI.toast('Nhập tên và đơn giá hợp lệ', { type: 'error' }); return; }
          const unitLabel = m === 'per_kwh' ? '₫/kWh' : m === 'per_person' ? '₫/người' : '₫/tháng';
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            if (isNew) { S.addService({ id: U.uid('sv'), buildingId: ctx.bid, name, method: m, unit: u, unitLabel });
              S.log('service.add', `Thêm dịch vụ ${name}`); }
            else S.updateService(s.id, { name, method: m, unit: u, unitLabel });
            close(); UI.toast(isNew ? 'Đã thêm dịch vụ' : 'Đã cập nhật dịch vụ', { type: 'ok' }); HH.router.render();
          }, 350);
        };
      },
    });
  }

  /* ---------------- TÀI SẢN (gắn theo phòng) ---------------- */
  let assetView = 'room';   // 'room' = nhóm theo phòng | 'list' = bảng
  let assetRoomFilter = null;
  const assetPage = { page: 1, size: 9 };

  function withResidual(a) {
    const months = Math.min(a.lifeMonths || 60, (U.daysBetween(a.buyDate, U.today()) / 30) | 0);
    return Object.assign({}, a, { months, residual: Math.round((a.buyPrice || 0) * (1 - months / (a.lifeMonths || 60))) });
  }

  HH.pages.assets = {
    render(ctx) {
      const all = S.assetsOf(ctx.bid).map(withResidual);
      const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
      const inRoom = all.filter(a => a.roomCode).length;
      const inStock = all.length - inRoom;
      const totalValue = all.reduce((s, a) => s + (a.residual || 0) * (a.quantity || 1), 0);

      const head = h`<div class="page-head">
        <div><div><div class="page-title-lg">Tài sản theo phòng</div>
          <div class="page-sub">${ctx.building.name} · ${all.length} mục · ${inRoom} trong phòng · ${inStock} ở kho chung</div></div></div>
        <div class="page-actions">
          <div class="view-toggle">
            <button class="${raw(assetView === 'room' ? 'active' : '')}" data-aview="room">▦ Theo phòng</button>
            <button class="${raw(assetView === 'list' ? 'active' : '')}" data-aview="list">☰ Bảng</button>
          </div>
          <button class="btn btn-success" id="assetExport">📊 Xuất excel</button>
          ${raw(S.isOwner() ? '<button class="btn btn-primary" data-primary-new>＋ Thêm tài sản</button>' : '')}
        </div></div>
        <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);max-width:760px;margin-bottom:16px">
          ${raw(UI.metricCard({ label: 'Tổng giá trị còn lại', value: totalValue, format: 'currency' }))}
          ${raw(UI.metricCard({ label: 'Đang trong phòng', value: inRoom, format: 'number', intent: 'success' }))}
          ${raw(UI.metricCard({ label: 'Kho chung (chưa gắn phòng)', value: inStock, format: 'number', intent: inStock ? 'warning' : 'default' }))}
        </div>`;

      if (assetView === 'list') {
        const dt = UI.DataTable({
          rows: assetRoomFilter ? all.filter(a => (a.roomCode || '') === (assetRoomFilter === '__stock__' ? '' : assetRoomFilter)) : all,
          rowId: a => a.id, searchKeys: ['id', 'name', 'roomCode'],
          searchPlaceholder: 'Tìm tài sản, phòng...',
          emptyTitle: 'Chưa có tài sản', emptyIcon: '📦',
          emptyAction: { label: 'Thêm tài sản', onClick: () => assetForm(ctx, null) },
          columns: [
            { key: 'icon', label: '', width: '48px', render: a => `<span style="font-size:22px">${a.icon || '📦'}</span>` },
            { key: 'name', label: 'Tên tài sản', sortable: true, render: a => `<b>${U.esc(a.name)}</b>` },
            { key: 'roomCode', label: 'Phòng', sortable: true, render: a => a.roomCode ? `<span class="badge s-info"><span class="dot"></span>${a.roomCode}</span>` : '<span class="faint">Kho chung</span>' },
            { key: 'quantity', label: 'Số lượng', align: 'right', render: a => `${U.number(a.quantity || 1)} ${a.unit || 'cái'}` },
            { key: 'buyPrice', label: 'Giá trị nhập', align: 'right', render: a => U.currency(a.buyPrice) },
            { key: 'residual', label: 'Giá trị còn lại', align: 'right', sortable: true, render: a => U.currency(a.residual) },
            { key: 'condition', label: 'Tình trạng', render: a => UI.statusBadge(a.condition, 'asset') },
          ],
          actions: a => assetActions(ctx, a),
        });
        ctx._dt = dt;
        return head + dt.render();
      }

      // ----- Chế độ nhóm theo phòng -----
      const groups = rooms.map(r => {
        const items = all.filter(a => a.roomCode === r.code);
        return { key: r.code, title: r.code, sub: r.typeLabel + (r.tenantName ? ' · ' + r.tenantName : ''),
          badge: UI.statusBadge(r.status, 'room'), items };
      });
      const stockItems = all.filter(a => !a.roomCode);
      groups.unshift({ key: '__stock__', title: 'Kho chung', sub: 'Chưa gắn vào phòng nào',
        badge: '<span class="badge s-neutral"><span class="dot"></span>Kho</span>', items: stockItems });

      const apg = UI.paginate(groups, assetPage, { unit: 'phòng', sizes: [9, 18, 36] });
      ctx._apg = apg;
      const cards = apg.items.map(g => {
        const value = g.items.reduce((s, a) => s + (a.residual || 0) * (a.quantity || 1), 0);
        const list = g.items.length ? g.items.map(a => `<div class="asset-row" data-amenu="${a.id}">
            <span class="a-ic">${a.icon || '📦'}</span>
            <span class="a-name"><b>${U.esc(a.name)}</b>
              <div class="muted text-xs">${U.number(a.quantity || 1)} ${U.esc(a.unit || 'cái')} · ${U.currency(a.residual)}</div></span>
            ${UI.statusBadge(a.condition, 'asset')}
            <button class="kebab" data-akebab="${a.id}">⋯</button>
          </div>`).join('')
          : `<div class="muted text-sm" style="text-align:center;padding:14px 0">Chưa có tài sản
              ${S.isOwner() ? `<div style="margin-top:8px"><button class="btn btn-sm btn-outline" data-addto="${g.key}">＋ Thêm vào ${g.key === '__stock__' ? 'kho' : g.title}</button></div>` : ''}</div>`;
        return `<div class="card asset-card">
          <div class="card-head" style="padding:12px 14px">
            <div><b>${g.title}</b> <span class="muted text-xs">${U.esc(g.sub)}</span></div>
            ${g.badge}
          </div>
          <div class="card-pad" style="padding:8px 14px 14px">
            ${list}
            <div class="between" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--neutral-200)">
              <span class="muted text-xs">${g.items.length} tài sản</span>
              <span class="mono b text-sm">${U.currency(value)}</span>
            </div>
            ${g.items.length && S.isOwner() ? `<div style="margin-top:8px"><button class="btn btn-sm btn-outline" data-addto="${g.key}">＋ Thêm vào ${g.key === '__stock__' ? 'kho' : g.title}</button></div>` : ''}
          </div></div>`;
      }).join('');

      return head + `<div class="asset-grid">${cards}</div>` + apg.html;
    },
    mount(ctx) {
      if (ctx._dt) ctx._dt.attach(document);
      if (ctx._apg) ctx._apg.attach(document, () => HH.router.render());
      document.querySelectorAll('[data-aview]').forEach(b => b.onclick = () => { assetView = b.dataset.aview; HH.router.render(); });
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => assetForm(ctx, null);
      document.querySelectorAll('[data-addto]').forEach(b => b.onclick = () => {
        const k = b.dataset.addto;
        assetForm(ctx, null, k === '__stock__' ? null : k);
      });
      document.querySelectorAll('[data-akebab]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        UI.openMenu(b, assetActions(ctx, S.asset(b.dataset.akebab)));
      });
      const ex = document.getElementById('assetExport');
      if (ex) ex.onclick = () => {
        U.downloadCSV(`tai-san-${ctx.bid}.csv`, ['Tên tài sản', 'Phòng', 'Số lượng', 'Đơn vị', 'Giá trị nhập', 'Giá trị còn lại', 'Tình trạng'],
          S.assetsOf(ctx.bid).map(withResidual).map(a => [a.name, a.roomCode || 'Kho chung', a.quantity || 1, a.unit || 'cái',
            a.buyPrice, a.residual, (UI.STATUS.asset[a.condition] || {}).label || a.condition]));
        UI.toast('Đã tải file Excel (CSV)', { type: 'ok' });
      };
    },
  };

  function assetActions(ctx, a) {
    if (!a) return [];
    const items = [{ icon: '✏️', label: 'Sửa tài sản', onClick: () => assetForm(ctx, a) },
      { icon: '🏠', label: 'Chuyển sang phòng khác', onClick: () => moveAsset(ctx, a) }];
    const conds = { good: 'Tốt', wear: 'Hao mòn tự nhiên', broken: 'Hư hỏng' };
    items.push({ sep: true });
    Object.keys(conds).forEach(c => { if (c !== a.condition)
      items.push({ icon: '●', label: 'Đánh dấu: ' + conds[c], onClick: () => {
        S.updateAsset(a.id, { condition: c }); UI.toast('Đã cập nhật tình trạng', { type: 'ok' }); HH.router.render(); } }); });
    if (S.isOwner()) items.push({ sep: true }, { icon: '🗑', label: 'Xóa tài sản', danger: true, onClick: () => {
      UI.dangerDialog({ title: `Xóa tài sản "${a.name}"`,
        description: 'Tài sản sẽ bị xóa khỏi danh sách và biên bản bàn giao.',
        consequences: ['Không thể hoàn tác', 'Thao tác được ghi vào nhật ký'],
        confirmLabel: 'Xóa tài sản', reasonLabel: 'Lý do xóa',
        onConfirm: () => { S.removeAsset(a.id); UI.toast('Đã xóa tài sản', { type: 'ok' }); HH.router.render(); } });
    } });
    return items;
  }

  function moveAsset(ctx, a) {
    const rooms = S.roomsOf(ctx.bid).slice().sort((x, y) => x.code.localeCompare(y.code));
    const opts = `<option value="">— Kho chung (không gắn phòng) —</option>` +
      rooms.map(r => `<option value="${r.code}" ${a.roomCode === r.code ? 'selected' : ''}>${r.code} · ${r.typeLabel}${r.tenantName ? ' · ' + U.esc(r.tenantName) : ''}</option>`).join('');
    UI.modal({ title: `Chuyển "${a.name}" sang phòng`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Hiện tại: <b>${a.roomCode || 'Kho chung'}</b></p>
      <div class="field"><label>Chuyển tới</label><select class="select" id="mvRoom">${raw(opts)}</select></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="mvGo">Chuyển</button>`,
      onMount(el, close) {
        el.querySelector('#mvGo').onclick = () => {
          const to = el.querySelector('#mvRoom').value || null;
          S.updateAsset(a.id, { roomCode: to });
          S.log('asset.move', `Chuyển tài sản ${a.name} → ${to || 'Kho chung'}`);
          close(); UI.toast(`Đã chuyển sang ${to || 'kho chung'}`, { type: 'ok' }); HH.router.render();
        };
      } });
  }

  const ASSET_ICONS = ['🧊', '🌀', '❄️', '💡', '🪑', '🛋️', '🚪', '🗄️', '🔑', '🔐', '🛏️', '🪞', '📺', '🍳', '🚿', '🧺', '🪟', '🔥'];

  function assetForm(ctx, existing, presetRoom) {
    const isNew = !existing;
    let icon = existing ? (existing.icon || '📦') : '❄️';
    const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
    const curRoom = existing ? existing.roomCode : (presetRoom || null);
    const roomOpts = `<option value="">— Kho chung (chưa gắn phòng) —</option>` +
      rooms.map(r => `<option value="${r.code}" ${curRoom === r.code ? 'selected' : ''}>${r.code} · ${r.typeLabel}${r.tenantName ? ' · ' + U.esc(r.tenantName) : ''}</option>`).join('');
    const grid = ASSET_ICONS.map(ic => `<button type="button" class="icon-opt ${ic === icon ? 'sel' : ''}" data-ic="${ic}">${ic}</button>`).join('');
    UI.modal({
      size: 'wide',
      headHtml: `<div class="row-gap-3"><span class="lz-home-ic" style="border:none">🎁</span><h3>${isNew ? 'Thêm mới tài sản' : 'Sửa tài sản'}</h3></div>`,
      bodyHtml: h`
        <div class="grid-2">
          <div class="field"><label>Tên tài sản *</label><input class="input" data-a="name" value="${existing ? existing.name : ''}" placeholder="VD: Máy lạnh Panasonic"></div>
          <div class="field"><label>Gắn vào phòng</label><select class="select" data-a="room">${raw(roomOpts)}</select></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Chọn icon đại diện cho tài sản</label>
          <div class="icon-grid" id="iconGrid">${raw(grid)}</div></div>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Giá trị nhập vào (đ) *</label><input class="input money" data-a="buy" value="${existing ? U.number(existing.buyPrice) : ''}" placeholder="0"></div>
          <div class="field"><label>Số tháng khấu hao</label><input class="input mono" data-a="life" value="${existing ? (existing.lifeMonths || 60) : 60}"></div>
        </div>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Tổng số lượng *</label><input class="input mono" data-a="qty" value="${existing ? (existing.quantity || 1) : 1}"></div>
          <div class="field"><label>Đơn vị</label><select class="select" data-a="unit">
            ${raw(['Cái', 'Chiếc', 'Bộ', 'Máy'].map(u => `<option ${existing && existing.unit === u ? 'selected' : ''}>${u}</option>`).join(''))}</select></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Tình trạng</label><select class="select" data-a="cond">
          ${raw(['good', 'wear', 'broken'].map(c => `<option value="${c}" ${existing && existing.condition === c ? 'selected' : ''}>${UI.STATUS.asset[c].label}</option>`).join(''))}</select></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span><button class="btn btn-primary" data-add>${isNew ? 'Thêm tài sản' : 'Lưu'}</button>`,
      onMount(el, close) {
        el.querySelectorAll('[data-ic]').forEach(b => b.onclick = () => {
          icon = b.dataset.ic; el.querySelectorAll('.icon-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
        });
        const buy = el.querySelector('[data-a="buy"]');
        buy.oninput = () => { const n = U.parseNum(buy.value); buy.value = n ? U.number(n) : ''; };
        el.querySelector('[data-add]').onclick = (e) => {
          const get = (k) => (el.querySelector(`[data-a="${k}"]`) || {}).value || '';
          const price = U.parseNum(get('buy'));
          if (!get('name').trim() || !price) { UI.toast('Nhập tên và giá trị tài sản', { type: 'error' }); return; }
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            const patch = { icon, name: get('name').trim(), buyPrice: price, roomCode: get('room') || null,
              lifeMonths: U.parseNum(get('life')) || 60, condition: get('cond'),
              quantity: U.parseNum(get('qty')) || 1, unit: get('unit') };
            if (isNew) {
              S.addAsset(Object.assign({ id: U.uid('TS').toUpperCase(), buildingId: ctx.bid, buyDate: U.today().toISOString() }, patch));
              S.log('asset.create', `Thêm tài sản ${patch.name}${patch.roomCode ? ' vào ' + patch.roomCode : ''}`);
            } else { S.updateAsset(existing.id, patch); S.log('asset.update', `Sửa tài sản ${patch.name}`); }
            close(); UI.toast(isNew ? 'Đã thêm tài sản' : 'Đã lưu tài sản', { type: 'ok' }); HH.router.render();
          }, 400);
        };
      },
    });
  }


  /* ---------------- SỰ CỐ PHÒNG ---------------- */
  const INC_STATUS = { open: { label: 'Chờ xử lý', tone: 'warning' },
    processing: { label: 'Đang xử lý', tone: 'info' }, done: { label: 'Đã xong', tone: 'success' } };
  let incShowDone = false;

  HH.pages.incidents = {
    render(ctx) {
      const all = S.allIncidentsOf(ctx.bid);
      const rows = incShowDone ? all : all.filter(x => x.status !== 'done');
      const open = all.filter(x => x.status === 'open').length;
      const doing = all.filter(x => x.status === 'processing').length;
      const done = all.filter(x => x.status === 'done').length;
      const dt = UI.DataTable({
        rows, rowId: x => x.id, searchKeys: ['roomCode', 'title', 'category'],
        searchPlaceholder: 'Tìm phòng, sự cố...',
        emptyTitle: 'Không có sự cố nào', emptyIcon: '✅', emptyDesc: 'Tất cả phòng đang hoạt động bình thường.',
        emptyAction: { label: 'Tạo yêu cầu', onClick: () => incidentForm(ctx) },
        columns: [
          { key: 'roomCode', label: 'Phòng', render: x => `<b>${U.esc(x.roomCode || '')}</b>` },
          { key: 'category', label: 'Hạng mục', render: x => `<span class="badge s-neutral"><span class="dot"></span>${U.esc(x.category || '')}</span>` },
          { key: 'title', label: 'Mô tả sự cố', render: x => `${U.esc(x.title || '')}
            ${(x.photos && x.photos.length) ? `<button class="btn btn-sm btn-outline" data-incphoto="${x.id}" style="margin-left:8px;padding:2px 8px">
              ${HH.icon('camera', 13)} ${x.photos.length} ảnh</button>` : ''}` },
          { key: 'createdAt', label: 'Ngày báo', sortable: true, render: x => `<span class="mono">${U.fmtDate(x.createdAt)}</span>` },
          { key: 'status', label: 'Trạng thái', render: x => { const s = INC_STATUS[x.status] || INC_STATUS.open;
            return `<span class="badge s-${s.tone}"><span class="dot"></span>${s.label}</span>`; } },
        ],
        actions: x => {
          const items = [];
          if (x.status !== 'processing' && x.status !== 'done')
            items.push({ icon: HH.icon('wrench', 16), label: 'Bắt đầu xử lý', onClick: () => {
              S.updateIncident(x.id, { status: 'processing' }); UI.toast('Đã chuyển sang đang xử lý', { type: 'ok' }); HH.router.render(); } });
          if (x.status !== 'done')
            items.push({ icon: HH.icon('check', 16), label: 'Đánh dấu đã xong', onClick: () => {
              S.updateIncident(x.id, { status: 'done', doneAt: new Date().toISOString() });
              S.log('incident.done', `Hoàn tất sự cố ${x.roomCode}: ${x.title}`);
              UI.toast('Đã đánh dấu xử lý xong', { type: 'ok' }); HH.router.render(); } });
          else items.push({ icon: HH.icon('refresh', 16), label: 'Mở lại', onClick: () => {
            S.updateIncident(x.id, { status: 'open' }); UI.toast('Đã mở lại yêu cầu', { type: 'ok' }); HH.router.render(); } });
          if (x.photos && x.photos.length)
            items.push({ icon: HH.icon('camera', 16), label: `Xem ${x.photos.length} ảnh`, onClick: () => showIncPhotos(x) });
          if (S.isOwner()) items.push({ sep: true }, { icon: HH.icon('trash', 16), label: 'Xóa yêu cầu', danger: true,
            onClick: () => { S.removeIncident(x.id); UI.toast('Đã xóa', { type: 'ok' }); HH.router.render(); } });
          return items;
        },
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/units">← Quản lý phòng</a>
          <div class="page-title-lg">Sự cố & sửa chữa</div>
          <div class="page-sub">${ctx.building.name} · ${open} chờ xử lý · ${doing} đang xử lý</div></div>
        <div class="page-actions">
          <button class="btn btn-outline" id="incToggle">${raw(HH.icon(incShowDone ? 'check' : 'list', 16))}
            ${raw(incShowDone ? 'Đang xem cả đã xong' : `Hiện cả đã xong (${done})`)}</button>
          <button class="btn btn-primary" data-primary-new>${raw(HH.icon('plus', 16))} Tạo yêu cầu</button></div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);max-width:700px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Chờ xử lý', value: open, format: 'number', intent: open ? 'warning' : 'default' }))}
        ${raw(UI.metricCard({ label: 'Đang xử lý', value: doing, format: 'number' }))}
        ${raw(UI.metricCard({ label: 'Đã hoàn tất', value: done, format: 'number', intent: 'success' }))}
      </div>
      ${raw(dt.render())}`;
    },
    mount(ctx) {
      ctx._dt.attach(document);
      const nb = document.querySelector('[data-primary-new]'); if (nb) nb.onclick = () => incidentForm(ctx);
      const tg = document.getElementById('incToggle'); if (tg) tg.onclick = () => { incShowDone = !incShowDone; HH.router.render(); };
      document.querySelectorAll('[data-incphoto]').forEach(b => b.onclick = (e) => {
        e.stopPropagation(); showIncPhotos(S.incident(b.dataset.incphoto));
      });
    },
  };

  function showIncPhotos(x) {
    if (!x || !x.photos || !x.photos.length) return;
    UI.modal({ title: `Ảnh yêu cầu — ${x.roomCode}`, size: 'wide',
      bodyHtml: `<p class="muted" style="margin-bottom:12px">${U.esc(x.title || '')}</p>
        <div class="photo-strip">${x.photos.map(p => `<div class="photo-thumb" style="width:100%;max-width:220px;height:170px"><img src="${p}"></div>`).join('')}</div>`,
      footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` });
  }

  function incidentForm(ctx) {
    const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
    const cats = ['Điện', 'Nước', 'Máy lạnh', 'Nội thất', 'Vệ sinh', 'An ninh', 'Khác'];
    UI.modal({ title: 'Tạo yêu cầu sửa chữa', bodyHtml: h`
      <div class="grid-2">
        <div class="field"><label>Phòng *</label><select class="select" id="icRoom">
          ${raw(rooms.map(r => `<option value="${r.code}">${r.code} · ${U.esc(r.typeLabel)}${r.tenantName ? ' · ' + U.esc(r.tenantName) : ''}</option>`).join(''))}
        </select></div>
        <div class="field"><label>Hạng mục</label><select class="select" id="icCat">
          ${raw(cats.map(c => `<option>${c}</option>`).join(''))}</select></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Mô tả sự cố *</label>
        <textarea class="textarea" id="icTitle" placeholder="VD: Bóng đèn nhà tắm bị cháy"></textarea></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="icSave">Tạo yêu cầu</button>`,
      onMount(el, close) {
        el.querySelector('#icSave').onclick = (e) => {
          const title = el.querySelector('#icTitle').value.trim();
          if (!title) { UI.toast('Nhập mô tả sự cố', { type: 'error' }); return; }
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            S.addIncident({ id: U.uid('sc'), buildingId: ctx.bid, roomCode: el.querySelector('#icRoom').value,
              category: el.querySelector('#icCat').value, title, status: 'open',
              photos: [], createdAt: new Date().toISOString() });
            S.log('incident.create', `Tạo yêu cầu sửa chữa ${title}`);
            close(); UI.toast('Đã tạo yêu cầu', { type: 'ok' }); HH.router.render();
          }, 300);
        };
      } });
  }
})();

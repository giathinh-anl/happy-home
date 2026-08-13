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
        <div class="row-gap-3"><span class="lz-home-ic">🛎️</span>
          <div><div class="page-title-lg">Dịch vụ & đơn giá</div><div class="page-sub">${ctx.building.name} · ${svcs.length} dịch vụ · đơn giá hiện hành</div></div></div>
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

  /* ---------------- TÀI SẢN ---------------- */
  HH.pages.assets = {
    render(ctx) {
      const rows = S.assetsOf(ctx.bid).map(a => {
        const months = Math.min(a.lifeMonths, U.daysBetween(a.buyDate, U.today()) / 30 | 0);
        return { ...a, residual: Math.round(a.buyPrice * (1 - months / a.lifeMonths)), months };
      });
      const dt = UI.DataTable({
        rows, rowId: a => a.id, searchKeys: ['id', 'name', 'roomCode'],
        searchPlaceholder: 'Tìm tài sản, phòng...',
        emptyTitle: 'Chưa có tài sản', emptyIcon: '📦',
        emptyAction: { label: 'Thêm tài sản', onClick: () => addAsset(ctx) },
        columns: [
          { key: 'icon', label: '', width: '48px', render: a => `<span style="font-size:22px">${a.icon || '📦'}</span>` },
          { key: 'name', label: 'Tên tài sản', sortable: true, render: a => `<b>${a.name}</b>` },
          { key: 'roomCode', label: 'Phòng', sortable: true, render: a => a.roomCode ? `<span class="badge s-info"><span class="dot"></span>${a.roomCode}</span>` : '<span class="faint">Kho chung</span>' },
          { key: 'quantity', label: 'Số lượng', align: 'right', render: a => `${U.number(a.quantity || 1)} ${a.unit || 'cái'}` },
          { key: 'buyPrice', label: 'Giá trị nhập', align: 'right', render: a => U.currency(a.buyPrice) },
          { key: 'residual', label: 'Giá trị còn lại', align: 'right', sortable: true, render: a => U.currency(a.residual) },
          { key: 'condition', label: 'Tình trạng', render: a => UI.statusBadge(a.condition, 'asset') },
        ],
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">📦</span>
          <div><div class="page-title-lg">Tất cả tài sản</div><div class="page-sub">Danh sách tài sản đang có · ${rows.length} mục</div></div></div>
        <div class="page-actions"><button class="btn btn-success" id="assetExport">📊 Xuất excel</button>
        ${raw(S.isOwner() ? '<button class="btn btn-primary" data-primary-new>＋ Thêm tài sản</button>' : '')}</div>
      </div>${raw(dt.render())}`;
    },
    mount(ctx) {
      ctx._dt.attach(document);
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => addAsset(ctx);
      const ex = document.getElementById('assetExport');
      if (ex) ex.onclick = () => {
        U.downloadCSV(`tai-san-${ctx.bid}.csv`, ['Tên tài sản', 'Phòng', 'Số lượng', 'Đơn vị', 'Giá trị nhập', 'Tình trạng'],
          S.assetsOf(ctx.bid).map(a => [a.name, a.roomCode || 'Kho chung', a.quantity || 1, a.unit || 'cái', a.buyPrice, (UI.STATUS.asset[a.condition] || {}).label || a.condition]));
        UI.toast('Đã tải file Excel (CSV)', { type: 'ok' });
      };
    },
  };

  const ASSET_ICONS = ['🧊', '🌀', '❄️', '💡', '🪑', '🛋️', '🚪', '🗄️', '🔑', '🔐', '🛏️', '🪞', '📺', '🍳', '🚿'];

  function addAsset(ctx) {
    let icon = '❄️';
    const grid = ASSET_ICONS.map(ic => `<button type="button" class="icon-opt ${ic === icon ? 'sel' : ''}" data-ic="${ic}">${ic}</button>`).join('');
    UI.modal({
      size: 'wide',
      headHtml: `<div class="row-gap-3"><span class="lz-home-ic" style="border:none">🎁</span><h3>Thêm mới tài sản</h3></div>`,
      bodyHtml: h`
        <div class="field"><label>Tên tài sản *</label><input class="input" data-a="name" placeholder="VD: Máy lạnh Panasonic"></div>
        <div class="field" style="margin-top:14px"><label>Chọn icon đại diện cho tài sản</label>
          <div class="icon-grid" id="iconGrid">${raw(grid)}</div></div>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Giá trị tài sản (đ) *</label><input class="input money" data-a="value" placeholder="0"></div>
          <div class="field"><label>Giá trị nhập vào (đ)</label><input class="input money" data-a="buy" placeholder="0"></div>
        </div>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Tổng số lượng *</label><input class="input mono" data-a="qty" value="1"></div>
          <div class="field"><label>Đơn vị</label><select class="select" data-a="unit"><option>Cái</option><option>Chiếc</option><option>Bộ</option><option>Máy</option></select></div>
        </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span><button class="btn btn-primary" data-add>Thêm tài sản</button>`,
      onMount(el, close) {
        el.querySelectorAll('[data-ic]').forEach(b => b.onclick = () => {
          icon = b.dataset.ic; el.querySelectorAll('.icon-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
        });
        ['value', 'buy'].forEach(k => { const inp = el.querySelector(`[data-a="${k}"]`);
          inp.oninput = () => { const n = U.parseNum(inp.value); inp.value = n ? U.number(n) : ''; }; });
        el.querySelector('[data-add]').onclick = (e) => {
          const get = (k) => (el.querySelector(`[data-a="${k}"]`) || {}).value || '';
          if (!get('name').trim() || !U.parseNum(get('value'))) { UI.toast('Nhập tên và giá trị tài sản', { type: 'error' }); return; }
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            const buy = U.parseNum(get('buy')) || U.parseNum(get('value'));
            S.addAsset({ id: U.uid('TS').toUpperCase(), buildingId: ctx.bid, roomCode: null, icon,
              name: get('name').trim(), buyPrice: buy, buyDate: U.today().toISOString(), lifeMonths: 60,
              condition: 'good', quantity: U.parseNum(get('qty')) || 1, unit: get('unit') });
            S.log('asset.create', `Thêm tài sản ${get('name')}`);
            close(); UI.toast('Đã thêm tài sản', { type: 'ok' }); HH.router.render();
          }, 450);
        };
      },
    });
  }

  /* ---------------- SỰ CỐ PHÒNG ---------------- */
  HH.pages.incidents = {
    render(ctx) {
      const rows = S.incidentsOf(ctx.bid);
      const statusMap = { open: { label: 'Chờ xử lý', tone: 'warning' }, processing: { label: 'Đang xử lý', tone: 'info' }, done: { label: 'Đã xong', tone: 'success' } };
      const dt = UI.DataTable({
        rows, rowId: x => x.id, searchKeys: ['roomCode', 'title', 'category'],
        searchPlaceholder: 'Tìm phòng, sự cố...',
        emptyTitle: 'Không có sự cố nào', emptyIcon: '✅', emptyDesc: 'Tất cả phòng đang hoạt động bình thường.',
        columns: [
          { key: 'roomCode', label: 'Phòng', render: x => `<b>${x.roomCode}</b>` },
          { key: 'category', label: 'Hạng mục', render: x => `<span class="badge s-neutral"><span class="dot"></span>${x.category}</span>` },
          { key: 'title', label: 'Mô tả sự cố' },
          { key: 'createdAt', label: 'Ngày báo', render: x => `<span class="mono">${U.fmtDate(x.createdAt)}</span>` },
          { key: 'status', label: 'Trạng thái', render: x => { const s = statusMap[x.status]; return `<span class="badge s-${s.tone}"><span class="dot"></span>${s.label}</span>`; } },
        ],
        actions: x => [{ icon: '✓', label: 'Đánh dấu đã xử lý', onClick: () => { x.status = 'done'; UI.toast('Đã đánh dấu xử lý xong', { type: 'ok' }); HH.router.render(); } }],
      });
      ctx._dt = dt;
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">🧰</span>
          <div><a class="back-link" href="#/b/${ctx.bid}/units">← Quản lý phòng</a>
          <div class="page-title-lg">Sự cố phòng</div><div class="page-sub">${ctx.building.name} · ${rows.length} vấn đề đang mở</div></div></div>
      </div>${raw(dt.render())}`;
    },
    mount(ctx) { ctx._dt.attach(document); },
  };
})();

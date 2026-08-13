/* ============================================================
   Trang: Dịch vụ & đơn giá, Tài sản
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;
  const methodLabel = { per_kwh: 'Theo chỉ số điện', per_person: 'Theo số người', flat: 'Cố định theo tháng' };

  /* ---------------- DỊCH VỤ & ĐƠN GIÁ ---------------- */
  HH.pages.services = {
    render(ctx) {
      const svcs = S.servicesOf(ctx.bid);
      const rows = svcs.map(s => `<tr>
        <td><b>${s.name}</b></td>
        <td><span class="badge s-neutral"><span class="dot"></span>${methodLabel[s.method]}</span></td>
        <td class="num mono">${U.number(s.unit)}</td>
        <td>${s.unitLabel}</td>
        ${S.isOwner() ? `<td class="col-actions"><button class="kebab" data-edit="${s.id}">⋯</button></td>` : ''}
      </tr>`).join('');
      return h`<div class="page-head">
        <div><div class="page-title">Dịch vụ & đơn giá</div><div class="page-sub">${ctx.building.name} · đơn giá hiện hành</div></div>
        ${raw(S.isOwner() ? '<div class="page-actions"><button class="btn btn-primary" data-primary-new>+ Thêm dịch vụ</button></div>' : '')}
      </div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Dịch vụ</th><th>Phương pháp tính</th><th class="num">Đơn giá</th><th>Đơn vị</th>${S.isOwner() ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
    },
    mount(ctx) {
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => UI.toast('Thêm dịch vụ mới (demo)', { type: 'ok' });
      document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
        const s = S.servicesOf(ctx.bid).find(x => x.id === b.dataset.edit);
        editService(ctx, s);
      });
    },
  };

  function editService(ctx, s) {
    UI.modal({ title: `Sửa đơn giá — ${s.name}`, bodyHtml: h`
      <div class="field"><label>Đơn giá (₫)</label><input class="input money" id="svUnit" value="${U.number(s.unit)}"></div>
      <p class="muted text-xs" style="margin-top:8px">Áp dụng cho hóa đơn phát hành từ kỳ tới. Hợp đồng có đơn giá riêng không bị ảnh hưởng.</p>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="svSave">Lưu</button>`,
      onMount(el, close) {
        const inp = el.querySelector('#svUnit');
        inp.oninput = () => { const n = U.parseNum(inp.value); inp.value = n ? U.number(n) : ''; };
        el.querySelector('#svSave').onclick = () => { s.unit = U.parseNum(inp.value) || s.unit; close();
          UI.toast('Đã cập nhật đơn giá', { type: 'ok' }); HH.router.render(); };
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
      if (ex) ex.onclick = () => UI.toast('Đã xuất Excel tài sản (demo)', { type: 'ok' });
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
            S.assets.push({ id: U.uid('TS').toUpperCase(), buildingId: ctx.bid, roomCode: null, icon,
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

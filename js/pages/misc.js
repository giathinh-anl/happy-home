/* ============================================================
   Trang: Dịch vụ & đơn giá, Tài sản
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, V = HH.validate, h = U.html, raw = U.raw;
  const methodLabel = { per_kwh: 'Theo chỉ số điện', per_person: 'Theo số người', flat: 'Cố định theo tháng' };

  /* ---------------- DỊCH VỤ & ĐƠN GIÁ ---------------- */
  const SVC_ICONS = { per_kwh: HH.ic('bolt', 16), per_person: HH.ic('drop', 16), flat: HH.ic('file', 16) };

  HH.pages.services = {
    render(ctx) {
      const svcs = S.servicesOf(ctx.bid);
      const owner = S.isOwner();
      const rows = svcs.map(s => `<tr>
        <td><span style="font-size:18px;margin-right:6px">${SVC_ICONS[s.method] || HH.ic('concierge', 16)}</span><b>${U.esc(s.name)}</b></td>
        <td><span class="badge s-neutral"><span class="dot"></span>${methodLabel[s.method]}</span></td>
        <td class="num mono b">${U.number(s.unit)}</td>
        <td>${s.unitLabel}</td>
        ${owner ? `<td class="col-actions"><button class="kebab" data-svmenu="${s.id}">⋯</button></td>` : ''}
      </tr>`);
      const tbody = rows.length ? rows
        : [`<tr><td colspan="${owner ? 5 : 4}"><div class="empty"><div class="ic">${HH.ic('concierge', 30)}</div><h4>Chưa có dịch vụ nào</h4><p class="muted">Thêm dịch vụ để tính vào hóa đơn hằng tháng.</p></div></td></tr>`];
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Dịch vụ & đơn giá</div><div class="page-sub">${ctx.building.name}, ${svcs.length} dịch vụ theo đơn giá hiện hành</div></div></div>
        <div class="page-actions"><button class="btn btn-success" id="svExport">${HH.ic('sheet', 16)} Xuất excel</button>
        ${raw(owner ? '<button class="btn btn-primary" data-primary-new>' + HH.ic('plus', 16) + ' Thêm dịch vụ</button>' : '')}</div>
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
          { icon: HH.ic('edit', 16), label: 'Sửa dịch vụ', onClick: () => serviceForm(ctx, s) },
          { sep: true },
          { icon: HH.ic('trash', 16), label: 'Xóa dịch vụ', danger: true, onClick: () => {
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
      title: isNew ? 'Thêm dịch vụ' : `Sửa dịch vụ ${s.name}`,
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
        const rules = UI.formRules(el, [
          { el: '#svName', ten: 'Tên dịch vụ', kiem: (v) => {
              const t = v.trim().toLowerCase();
              if (t.length > 60) return 'Tên dịch vụ tối đa 60 ký tự';
              if (S.servicesOf(ctx.bid).some(x => x.name.trim().toLowerCase() === t && (!s || x.id !== s.id))) return 'Đã có dịch vụ tên này';
            } },
          { el: '#svUnit', ten: 'Đơn giá', kiem: (v) => V.tien(v, { ten: 'Đơn giá', min: 1, max: 50000000 }) },
        ]);
        el.querySelector('#svSave').onclick = (e) => {
          if (!rules.check()) return;
          const name = el.querySelector('#svName').value.trim();
          const m = el.querySelector('#svMethod').value;
          const u = U.parseNum(unit.value);
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

  /* ---------------- KHO TÀI SẢN (mỗi tòa nhà một kho) ----------------
     Tài sản khai báo MỘT chỗ duy nhất: trong kho của tòa nhà.
     Cùng tên thì cùng giá, cùng đơn vị. Số lượng chỉ nhập thêm ở kho.
     Từ kho chuyển vào phòng, phòng trả lại về kho. Trong phòng không tạo mới. */
  let assetTab = 'stock';           // 'stock' = kho | 'rooms' = trong phòng
  const assetPage = { page: 1, size: 9 };

  function withResidual(a) {
    const months = Math.min(a.lifeMonths || 60, (U.daysBetween(a.buyDate, U.today()) / 30) | 0);
    return Object.assign({}, a, { months, residual: Math.round((a.buyPrice || 0) * (1 - months / (a.lifeMonths || 60))) });
  }

  // Gom mọi dòng cùng tên trong một tòa thành MỘT mặt hàng của kho
  function catalog(bid) {
    const map = new Map();
    S.assetsOf(bid).forEach(a => {
      const key = (a.name || '').trim().toLowerCase();
      if (!map.has(key)) map.set(key, { key, name: a.name, icon: a.icon || '📦', unit: a.unit || 'Cái',
        buyPrice: a.buyPrice || 0, lifeMonths: a.lifeMonths || 60, buyDate: a.buyDate, stock: 0, out: 0, rooms: [] });
      const it = map.get(key);
      const q = a.quantity || 1;
      if (a.roomCode) { it.out += q; it.rooms.push({ code: a.roomCode, qty: q, condition: a.condition, id: a.id }); }
      else { it.stock += q; it.icon = a.icon || it.icon; it.buyPrice = a.buyPrice || it.buyPrice; it.unit = a.unit || it.unit; }
    });
    const list = Array.from(map.values());
    list.forEach(it => { it.total = it.stock + it.out; it.residual = withResidual(it).residual; });
    return list.sort((x, y) => x.name.localeCompare(y.name, 'vi'));
  }

  HH.pages.assets = {
    render(ctx) {
      const items = catalog(ctx.bid);
      const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
      const totalQty = items.reduce((s, x) => s + x.total, 0);
      const inStock = items.reduce((s, x) => s + x.stock, 0);
      const value = items.reduce((s, x) => s + x.residual * x.total, 0);

      const head = h`<div class="page-head">
        <div><div class="page-title-lg">Kho tài sản</div>
          <div class="page-sub">${ctx.building.name}: ${items.length} loại, ${totalQty} món, ${inStock} món còn trong kho</div></div>
        <div class="page-actions">
          <div class="view-toggle">
            <button class="${raw(assetTab === 'stock' ? 'active' : '')}" data-atab="stock">${HH.ic('box', 15)} Kho</button>
            <button class="${raw(assetTab === 'rooms' ? 'active' : '')}" data-atab="rooms">${HH.ic('grid', 15)} Trong phòng</button>
          </div>
          <button class="btn btn-outline" id="assetExport">${HH.ic('download', 16)} Xuất Excel</button>
          ${raw(S.isOwner() ? '<button class="btn btn-primary" data-primary-new>' + HH.ic('plus', 16) + ' Thêm loại tài sản</button>' : '')}
        </div></div>
        <div class="dh-kpis" style="margin-top:0;margin-bottom:20px">
          <div class="dh-kpi t-sky"><span class="dh-kpi-pic">${raw(HH.pic('sofa', 36))}</span>
            <span class="k">Loại tài sản</span><span class="v">${items.length}</span>
            <span class="dl flat">khai báo trong kho</span></div>
          <div class="dh-kpi t-leaf"><span class="dh-kpi-pic">${raw(HH.pic('box', 36))}</span>
            <span class="k">Còn trong kho</span><span class="v">${inStock}</span>
            <span class="dl flat">sẵn sàng chuyển vào phòng</span></div>
          <div class="dh-kpi t-sun"><span class="dh-kpi-pic">${raw(HH.pic('door', 36))}</span>
            <span class="k">Đang ở các phòng</span><span class="v">${totalQty - inStock}</span>
            <span class="dl flat">trên tổng ${totalQty} món</span></div>
          <div class="dh-kpi t-coral"><span class="dh-kpi-pic">${raw(HH.pic('coins', 36))}</span>
            <span class="k">Giá trị còn lại</span><span class="v">${U.currency(value)}</span>
            <span class="dl flat">đã trừ khấu hao</span></div>
        </div>`;

      if (assetTab === 'stock') {
        const rows = items.map(it => `<tr data-kind="${U.esc(it.name)}">
          <td><div class="dh-bname"><span class="ast-ic">${it.icon}</span>
            <span><b>${U.esc(it.name)}</b><small>${U.currency(it.buyPrice)} mỗi ${U.esc((it.unit || 'cái').toLowerCase())}</small></span></div></td>
          <td class="num">${U.number(it.stock)}</td>
          <td class="num">${it.out ? U.number(it.out) : '<span class="faint">0</span>'}</td>
          <td class="num b">${U.number(it.total)}</td>
          <td class="num">${U.currency(it.residual * it.total)}</td>
          <td>${it.rooms.length ? it.rooms.slice(0, 4).map(r => `<span class="ast-chip">${U.esc(r.code)}${r.qty > 1 ? ' ×' + r.qty : ''}</span>`).join('')
            + (it.rooms.length > 4 ? `<span class="ast-chip">+${it.rooms.length - 4}</span>` : '') : '<span class="faint">chưa chuyển phòng nào</span>'}</td>
          <td class="col-actions"><button class="kebab" data-akind="${U.esc(it.name)}">⋯</button></td>
        </tr>`).join('');
        return head + `<div class="dt-wrap"><div class="dt-scroll"><table class="dt">
          <thead><tr><th>Tài sản</th><th class="num">Trong kho</th><th class="num">Ở phòng</th><th class="num">Tổng</th>
            <th class="num">Giá trị còn lại</th><th>Đang ở phòng nào</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7"><div class="empty"><div class="ic">${HH.pic('sofa', 64)}</div>
            <h4>Kho chưa có tài sản nào</h4><p class="muted">Bấm "Thêm loại tài sản" để khai báo máy lạnh, giường, tủ lạnh... rồi chuyển vào phòng.</p></div></td></tr>`}</tbody>
        </table></div></div>`;
      }

      // ----- Tab: tài sản đang ở các phòng -----
      const groups = rooms.map(r => ({
        key: r.code, title: r.code, sub: r.typeLabel + (r.tenantName ? ', ' + r.tenantName : ''),
        badge: UI.statusBadge(r.status, 'room'),
        items: S.assetsOf(ctx.bid, r.code).map(withResidual),
      }));
      const apg = UI.paginate(groups, assetPage, { unit: 'phòng', sizes: [9, 18, 36] });
      ctx._apg = apg;
      const cards = apg.items.map(g => {
        const val = g.items.reduce((s, a) => s + (a.residual || 0) * (a.quantity || 1), 0);
        const list = g.items.length ? g.items.map(a => `<div class="asset-row">
            <span class="a-ic">${a.icon || '📦'}</span>
            <span class="a-name"><b>${U.esc(a.name)}</b>
              <div class="muted text-xs">${U.number(a.quantity || 1)} ${U.esc((a.unit || 'cái').toLowerCase())}, ${U.currency(a.residual)}</div></span>
            ${UI.statusBadge(a.condition, 'asset')}
            <button class="kebab" data-aroom="${a.id}">⋯</button>
          </div>`).join('')
          : '<div class="muted text-sm" style="text-align:center;padding:14px 0">Phòng này chưa nhận tài sản nào</div>';
        return `<div class="card asset-card">
          <div class="card-head" style="padding:12px 14px">
            <div><b>${g.title}</b> <span class="muted text-xs">${U.esc(g.sub)}</span></div>${g.badge}
          </div>
          <div class="card-pad" style="padding:8px 14px 14px">
            ${list}
            <div class="between" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)">
              <span class="muted text-xs">${g.items.length} loại, ${g.items.reduce((s, a) => s + (a.quantity || 1), 0)} món</span>
              <span class="num b text-sm">${U.currency(val)}</span>
            </div>
            ${S.isOwner() ? `<div style="margin-top:8px"><button class="btn btn-sm btn-outline" data-toroom="${g.key}">
              ${HH.ic('box', 15)} Chuyển từ kho vào ${g.title}</button></div>` : ''}
          </div></div>`;
      }).join('');
      return head + `<div class="asset-grid">${cards}</div>` + apg.html;
    },

    mount(ctx) {
      if (ctx._apg) ctx._apg.attach(document, () => HH.router.render());
      document.querySelectorAll('[data-atab]').forEach(b => b.onclick = () => { assetTab = b.dataset.atab; HH.router.render(); });
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => kindForm(ctx, null);
      document.querySelectorAll('[data-akind]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const it = catalog(ctx.bid).find(x => x.name === b.dataset.akind);
        if (it) UI.openMenu(b, kindActions(ctx, it));
      });
      document.querySelectorAll('[data-aroom]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        UI.openMenu(b, roomAssetActions(ctx, S.asset(b.dataset.aroom)));
      });
      document.querySelectorAll('[data-toroom]').forEach(b => b.onclick = () => transferDialog(ctx, null, b.dataset.toroom));
      const ex = document.getElementById('assetExport');
      if (ex) ex.onclick = () => {
        U.downloadCSV(`kho-tai-san-${ctx.bid}.csv`,
          ['Tài sản', 'Giá mỗi cái', 'Đơn vị', 'Trong kho', 'Ở phòng', 'Tổng', 'Giá trị còn lại', 'Đang ở phòng'],
          catalog(ctx.bid).map(it => [it.name, it.buyPrice, it.unit, it.stock, it.out, it.total,
            it.residual * it.total, it.rooms.map(r => `${r.code}×${r.qty}`).join(' ')]));
        UI.toast('Đã tải bảng kho tài sản (CSV)', { type: 'ok' });
      };
    },
  };

  function kindActions(ctx, it) {
    const items = [
      { icon: HH.ic('download', 16), label: 'Nhập thêm vào kho', onClick: () => stockInDialog(ctx, it) },
      { icon: HH.ic('door', 16), label: 'Chuyển vào phòng', onClick: () => transferDialog(ctx, it, null) },
      { icon: HH.ic('edit', 16), label: 'Sửa tên, giá, đơn vị', onClick: () => kindForm(ctx, it) },
    ];
    if (S.isOwner()) items.push({ sep: true }, { icon: HH.ic('trash', 16), label: 'Xóa khỏi kho', danger: true, onClick: () => {
      UI.dangerDialog({ title: `Xóa "${it.name}" khỏi kho`,
        description: `Xóa cả ${it.total} món, kể cả ${it.out} món đang ở phòng.`,
        consequences: ['Không thể hoàn tác', 'Biên bản bàn giao cũ sẽ không còn tài sản này', 'Thao tác được ghi vào nhật ký'],
        confirmLabel: 'Xóa khỏi kho', reasonLabel: 'Lý do xóa',
        onConfirm: () => { S.removeAssetKind(ctx.bid, it.name); S.log('asset.remove', `Xóa tài sản ${it.name} khỏi kho`);
          UI.toast('Đã xóa khỏi kho', { type: 'ok' }); HH.router.render(); } });
    } });
    return items;
  }

  function roomAssetActions(ctx, a) {
    if (!a) return [];
    const items = [{ icon: HH.ic('undo', 16), label: 'Trả về kho', onClick: () => returnDialog(ctx, a) }];
    const conds = { good: 'Tốt', wear: 'Hao mòn tự nhiên', broken: 'Hư hỏng' };
    items.push({ sep: true });
    Object.keys(conds).forEach(c => { if (c !== a.condition)
      items.push({ icon: HH.ic('check', 16), label: 'Đánh dấu: ' + conds[c], onClick: () => {
        S.updateAsset(a.id, { condition: c }); UI.toast('Đã cập nhật tình trạng', { type: 'ok' }); HH.router.render(); } }); });
    return items;
  }

  const ASSET_ICONS = ['🧊', '🌀', '❄️', '💡', '🪑', '🛋️', '🚪', '🗄️', '🔑', '🔐', '🛏️', '🪞', '📺', '🍳', '🚿', '🧺', '🪟', '🔥'];

  /* Thêm / sửa MỘT LOẠI tài sản của kho. Cùng tên thì cùng giá nên sửa giá là
     đổi cho mọi món cùng tên, kể cả món đang ở trong phòng. */
  function kindForm(ctx, it) {
    const isNew = !it;
    let icon = it ? it.icon : '❄️';
    const grid = ASSET_ICONS.map(i => `<button type="button" class="icon-opt ${i === icon ? 'sel' : ''}" data-ic="${i}">${i}</button>`).join('');
    UI.modal({
      size: 'wide',
      headHtml: `<div class="row-gap-3"><span class="lz-home-ic" style="border:none">${HH.pic('sofa', 30)}</span>
        <h3>${isNew ? 'Thêm loại tài sản vào kho' : `Sửa "${U.esc(it.name)}"`}</h3></div>`,
      bodyHtml: h`
        <p class="muted text-sm" style="margin-bottom:14px">Tài sản chỉ khai báo ở kho. Các món cùng tên dùng chung một giá.
          Muốn đưa vào phòng thì dùng nút <b>Chuyển vào phòng</b>.</p>
        <div class="grid-2">
          <div class="field"><label>Tên tài sản *</label><input class="input" data-a="name" value="${it ? it.name : ''}" placeholder="VD: Máy lạnh Panasonic"></div>
          <div class="field"><label>Đơn vị</label><select class="select" data-a="unit">
            ${raw(['Cái', 'Chiếc', 'Bộ', 'Máy'].map(u => `<option ${it && it.unit === u ? 'selected' : ''}>${u}</option>`).join(''))}</select></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Chọn hình đại diện</label>
          <div class="icon-grid" id="iconGrid">${raw(grid)}</div></div>
        <div class="grid-2" style="margin-top:14px">
          <div class="field"><label>Giá mỗi ${raw(it ? U.esc((it.unit || 'cái').toLowerCase()) : 'cái')} (đ) *</label>
            <input class="input money" data-a="buy" value="${it ? U.number(it.buyPrice) : ''}" placeholder="0"></div>
          <div class="field"><label>Số tháng khấu hao</label><input class="input num" data-a="life" value="${it ? (it.lifeMonths || 60) : 60}"></div>
        </div>
        ${raw(isNew ? `<div class="field" style="margin-top:14px"><label>Số lượng nhập kho *</label>
          <input class="input num" data-a="qty" value="1"><span class="hint">Sau này nhập thêm bằng nút "Nhập thêm vào kho"</span></div>` : '')}`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span>
        <button class="btn btn-primary" data-add>${isNew ? 'Thêm vào kho' : 'Lưu'}</button>`,
      onMount(el, close) {
        el.querySelectorAll('[data-ic]').forEach(b => b.onclick = () => {
          icon = b.dataset.ic; el.querySelectorAll('.icon-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
        });
        const buy = el.querySelector('[data-a="buy"]');
        buy.oninput = () => { const n = U.parseNum(buy.value); buy.value = n ? U.number(n) : ''; };
        const rules = UI.formRules(el, [
          { el: '[data-a="name"]', ten: 'Tên tài sản', kiem: (v) => {
              const t = v.trim();
              if (t.length > 80) return 'Tên tài sản tối đa 80 ký tự';
              const dup = catalog(ctx.bid).find(x => x.name.toLowerCase() === t.toLowerCase());
              if (isNew && dup) return `Kho đã có "${dup.name}". Dùng "Nhập thêm vào kho" để cộng số lượng.`;
            } },
          { el: '[data-a="buy"]', ten: 'Giá tài sản', kiem: (v) => V.tien(v, { ten: 'Giá tài sản', min: 1, max: 1000000000 }) },
          { el: '[data-a="life"]', ten: 'Số tháng khấu hao', batBuoc: false, kiem: (v) => V.so(v, { ten: 'Số tháng khấu hao', min: 1, max: 600, nguyen: true }) },
          ...(isNew ? [{ el: '[data-a="qty"]', ten: 'Số lượng', kiem: (v) => V.so(v, { ten: 'Số lượng', min: 1, max: 10000, nguyen: true }) }] : []),
        ]);
        el.querySelector('[data-add]').onclick = (e) => {
          const get = (k) => (el.querySelector(`[data-a="${k}"]`) || {}).value || '';
          if (!rules.check()) return;
          const name = get('name').trim(), price = U.parseNum(get('buy'));
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            const base = { icon, buyPrice: price, unit: get('unit'), lifeMonths: U.parseNum(get('life')) || 60 };
            if (isNew) {
              S.stockAsset(ctx.bid, Object.assign({ name, quantity: U.parseNum(get('qty')) || 1 }, base));
              S.log('asset.create', `Nhập kho ${name} × ${U.parseNum(get('qty')) || 1}`);
            } else {
              S.updateAssetKind(ctx.bid, it.name, Object.assign({ name }, base));
              S.log('asset.update', `Sửa tài sản ${it.name}`);
            }
            close(); UI.toast(isNew ? 'Đã thêm vào kho' : 'Đã lưu', { type: 'ok' }); HH.router.render();
          }, 300);
        };
      },
    });
  }

  function stockInDialog(ctx, it) {
    UI.modal({ title: `Nhập thêm "${it.name}" vào kho`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Đang có <b>${it.stock}</b> ${U.esc((it.unit || 'cái').toLowerCase())} trong kho.</p>
      <div class="field"><label>Nhập thêm bao nhiêu?</label><input class="input num" id="inQty" value="1"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="inGo">Nhập kho</button>`,
      onMount(el, close) {
        const rules = UI.formRules(el, [
          { el: '#inQty', ten: 'Số lượng', kiem: (v) => V.so(v, { ten: 'Số lượng', min: 1, max: 10000, nguyen: true }) },
        ]);
        el.querySelector('#inGo').onclick = () => {
          if (!rules.check()) return;
          const n = U.parseNum(el.querySelector('#inQty').value);
          S.stockAsset(ctx.bid, { name: it.name, quantity: n, icon: it.icon, unit: it.unit, buyPrice: it.buyPrice, lifeMonths: it.lifeMonths });
          S.log('asset.stock', `Nhập thêm ${it.name} × ${n}`);
          close(); UI.toast(`Đã nhập thêm ${n} ${(it.unit || 'cái').toLowerCase()}`, { type: 'ok' }); HH.router.render();
        };
      } });
  }

  /* Chuyển từ kho vào phòng. Mở từ kho thì đã biết tài sản, mở từ phòng thì đã biết phòng. */
  function transferDialog(ctx, it, roomCode) {
    const items = catalog(ctx.bid).filter(x => x.stock > 0);
    if (!items.length) { UI.toast('Kho đang trống, hãy nhập tài sản vào kho trước', { type: 'warning' }); return; }
    const cur = it ? items.find(x => x.name === it.name) : items[0];
    if (it && !cur) { UI.toast(`"${it.name}" đã hết trong kho`, { type: 'warning' }); return; }
    const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
    UI.modal({ title: 'Chuyển tài sản từ kho vào phòng', bodyHtml: h`
      <div class="grid-2">
        <div class="field"><label>Tài sản</label><select class="select" id="trItem" ${raw(it ? 'disabled' : '')}>
          ${raw(items.map(x => `<option value="${U.esc(x.name)}" ${cur && x.name === cur.name ? 'selected' : ''}>${x.icon} ${U.esc(x.name)} (kho còn ${x.stock})</option>`).join(''))}
        </select></div>
        <div class="field"><label>Vào phòng</label><select class="select" id="trRoom">
          ${raw(rooms.map(r => `<option value="${r.code}" ${roomCode === r.code ? 'selected' : ''}>${r.code}, ${U.esc(r.typeLabel)}${r.tenantName ? ', ' + U.esc(r.tenantName) : ''}</option>`).join(''))}
        </select></div>
      </div>
      <div class="field" style="margin-top:14px"><label>Số lượng</label>
        <input class="input num" id="trQty" value="1">
        <span class="hint" id="trHint">Kho còn ${cur ? cur.stock : 0} ${U.esc(((cur && cur.unit) || 'cái').toLowerCase())}</span></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="trGo">Chuyển vào phòng</button>`,
      onMount(el, close) {
        const sel = el.querySelector('#trItem'), hint = el.querySelector('#trHint');
        const stockOf = (name) => (items.find(x => x.name === name) || {});
        sel.onchange = () => { const x = stockOf(sel.value); hint.textContent = `Kho còn ${x.stock || 0} ${(x.unit || 'cái').toLowerCase()}`; };
        const rules = UI.formRules(el, [
          { el: '#trQty', ten: 'Số lượng', kiem: (v) => V.so(v, { ten: 'Số lượng', min: 1, max: stockOf(sel.value).stock || 0, nguyen: true })
              .replace(/tối đa (\d+)$/, 'tối đa $1 (số đang có trong kho)') },
        ]);
        el.querySelector('#trGo').onclick = () => {
          if (!rules.check()) return;
          const name = sel.value, room = el.querySelector('#trRoom').value;
          const qty = U.parseNum(el.querySelector('#trQty').value);
          const x = stockOf(name);
          const r = S.moveAssetQty(ctx.bid, name, null, room, qty);
          if (!r.ok) { UI.toast('Không đủ số lượng trong kho', { type: 'error' }); return; }
          S.log('asset.move', `Chuyển ${name} × ${qty} từ kho vào phòng ${room}`);
          close(); UI.toast(`Đã chuyển ${qty} ${(x.unit || 'cái').toLowerCase()} vào phòng ${room}`, { type: 'ok' }); HH.router.render();
        };
      } });
  }

  function returnDialog(ctx, a) {
    const max = a.quantity || 1;
    UI.modal({ title: `Trả "${a.name}" về kho`, bodyHtml: h`
      <p class="muted" style="margin-bottom:12px">Phòng <b>${a.roomCode}</b> đang có <b>${max}</b> ${U.esc((a.unit || 'cái').toLowerCase())}.</p>
      <div class="field"><label>Trả về kho bao nhiêu?</label><input class="input num" id="rtQty" value="${max}"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="rtGo">Trả về kho</button>`,
      onMount(el, close) {
        const rules = UI.formRules(el, [
          { el: '#rtQty', ten: 'Số lượng', kiem: (v) => V.so(v, { ten: 'Số lượng', min: 1, max, nguyen: true }) },
        ]);
        el.querySelector('#rtGo').onclick = () => {
          if (!rules.check()) return;
          const n = U.parseNum(el.querySelector('#rtQty').value);
          const r = S.moveAssetQty(ctx.bid, a.name, a.roomCode, null, n);
          if (!r.ok) { UI.toast('Không trả được, thử lại', { type: 'error' }); return; }
          S.log('asset.move', `Trả ${a.name} × ${n} từ phòng ${a.roomCode} về kho`);
          close(); UI.toast(`Đã trả ${n} ${(a.unit || 'cái').toLowerCase()} về kho`, { type: 'ok' }); HH.router.render();
        };
      } });
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
      const cost30 = S.repairCost(ctx.bid, new Date(Date.now() - 30 * 86400000), U.today());
      const dt = UI.DataTable({
        rows, rowId: x => x.id, searchKeys: ['roomCode', 'title', 'category'],
        searchPlaceholder: 'Tìm phòng, sự cố...', onRowClick: x => incidentProgress(ctx, x),
        emptyTitle: 'Không có sự cố nào', emptyIcon: HH.ic('check', 16), emptyDesc: 'Tất cả phòng đang hoạt động bình thường.',
        emptyAction: { label: 'Tạo yêu cầu', onClick: () => incidentForm(ctx) },
        columns: [
          { key: 'roomCode', label: 'Phòng', render: x => `<b>${U.esc(x.roomCode || '')}</b>` },
          { key: 'category', label: 'Hạng mục', render: x => `<span class="badge s-neutral"><span class="dot"></span>${U.esc(x.category || '')}</span>` },
          { key: 'title', label: 'Mô tả sự cố', render: x => `${U.esc(x.title || '')}
            ${(x.photos && x.photos.length) ? `<button class="btn btn-sm btn-outline" data-incphoto="${x.id}" style="margin-left:8px;padding:2px 8px">
              ${HH.icon('camera', 13)} ${x.photos.length} ảnh</button>` : ''}` },
          { key: 'createdAt', label: 'Ngày báo', sortable: true, render: x => `<span class="mono">${U.fmtDate(x.createdAt)}</span>` },
          { key: 'status', label: 'Trạng thái', render: x => { const s = INC_STATUS[x.status] || INC_STATUS.open;
            const t = HH.progress.tinhTrang(x, U.today());
            const sub = x.status === 'done'
              ? (x.cost != null ? `Chi phí ${U.currency(x.cost)}${x.costPayer === 'khach' ? ' (khách chịu)' : ''}` : '')
              : [x.assignee ? U.esc(x.assignee) : '', x.scheduledFor ? 'hẹn ' + U.fmtDate(x.scheduledFor) : '',
                 t.quaLau ? `<b class="ip-late">mở ${t.soNgayMo} ngày</b>` : ''].filter(Boolean).join(' · ');
            return `<span class="badge s-${s.tone}"><span class="dot"></span>${s.label}</span>${sub ? `<div class="muted text-xs" style="margin-top:3px">${sub}</div>` : ''}`; } },
        ],
        actions: x => {
          const items = [{ icon: HH.icon('list', 16), label: 'Tiến độ & cập nhật', onClick: () => incidentProgress(ctx, x) }];
          if (x.status === 'open')
            items.push({ icon: HH.icon('wrench', 16), label: 'Bắt đầu xử lý', onClick: () => {
              const r = S.progressIncident(x.id, { loai: 'bat-dau' });
              if (!r.ok) { UI.toast(r.loi, { type: 'error' }); return; }
              UI.toast('Đã chuyển sang đang xử lý, khách thấy trong app', { type: 'ok' }); HH.router.render(); } });
          if (x.status !== 'done')
            items.push({ icon: HH.icon('check', 16), label: 'Đã sửa xong', onClick: () => incidentProgress(ctx, x, 'hoan-tat') });
          else items.push({ icon: HH.icon('refresh', 16), label: 'Mở lại', onClick: () => incidentProgress(ctx, x, 'mo-lai') });
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
          <div class="page-sub">${ctx.building.name}: ${open} chờ xử lý, ${doing} đang xử lý</div></div>
        <div class="page-actions">
          <button class="btn btn-outline" id="incToggle">${raw(HH.icon(incShowDone ? 'check' : 'list', 16))}
            ${raw(incShowDone ? 'Đang xem cả đã xong' : `Hiện cả đã xong (${done})`)}</button>
          <button class="btn btn-primary" data-primary-new>${raw(HH.icon('plus', 16))} Tạo yêu cầu</button></div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(4,1fr);max-width:920px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Chờ xử lý', value: open, format: 'number', intent: open ? 'warning' : 'default' }))}
        ${raw(UI.metricCard({ label: 'Đang xử lý', value: doing, format: 'number' }))}
        ${raw(UI.metricCard({ label: 'Đã hoàn tất', value: done, format: 'number', intent: 'success' }))}
        ${raw(UI.metricCard({ label: 'Chi phí sửa 30 ngày', value: cost30, format: 'currency', sub: 'chủ trọ chịu' }))}
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

  /* ---------- Tiến độ một sự cố: xem các mốc và cập nhật ---------- */
  const IP_VIEC = {
    'ghi-chu': 'Ghi chú', 'hen-tho': 'Hẹn thợ', 'bat-dau': 'Bắt đầu xử lý', 'hoan-tat': 'Đã sửa xong', 'mo-lai': 'Mở lại',
  };
  const ipViecChoPhep = (st) => st === 'done' ? ['ghi-chu', 'mo-lai'] : st === 'processing' ? ['ghi-chu', 'hen-tho', 'hoan-tat'] : ['ghi-chu', 'hen-tho', 'bat-dau', 'hoan-tat'];
  const ipGio = (at) => { const d = HH.dates.phanTich(at); return d ? `${U.fmtDate(d)} ${String(new Date(at).getHours()).padStart(2, '0')}:${String(new Date(at).getMinutes()).padStart(2, '0')}` : 'chưa rõ giờ'; };

  function ipTimeline(x) {
    return HH.progress.dongThoiGian(x).slice().reverse().map(e => {
      const L = HH.progress.LOAI[e.loai] || { nhan: e.loai };
      const ct = [e.tho ? 'Thợ: ' + U.esc(e.tho) + (e.thoSdt ? ' ' + U.esc(e.thoSdt) : '') : '', e.ngayHen ? 'Hẹn ngày ' + U.fmtDate(e.ngayHen) : '',
        e.chiPhi != null ? 'Chi phí ' + U.currency(e.chiPhi) : ''].filter(Boolean).join(' · ');
      return `<li class="ip-ev"><span class="ip-dot ${e.congKhai ? 'pub' : ''}"></span><div>
        <div><b>${U.esc(L.nhan)}</b> <span class="muted text-xs">${e.at ? ipGio(e.at) : 'chưa rõ giờ'}${e.by && !e.suy ? ' · ' + U.esc(e.by) : ''}</span>
          <span class="ip-tag ${e.congKhai ? 'pub' : ''}">${e.congKhai ? 'Khách thấy' : 'Nội bộ'}</span></div>
        ${ct ? `<div class="muted text-xs">${ct}</div>` : ''}${e.ghiChu ? `<div class="ip-note">${U.esc(e.ghiChu)}</div>` : ''}</div></li>`;
    }).join('');
  }

  function incidentProgress(ctx, x, preset) {
    const choPhep = ipViecChoPhep(x.status);
    const first = preset && choPhep.indexOf(preset) >= 0 ? preset : choPhep.find(v => v !== 'ghi-chu');
    const s = INC_STATUS[x.status] || INC_STATUS.open;
    UI.modal({
      title: `Phòng ${x.roomCode}: ${x.category || 'Sự cố'}`, size: 'wide',
      bodyHtml: `<div class="ip-head"><div><b>${U.esc(x.title || '')}</b><div class="muted text-xs">Báo ngày ${U.fmtDate(x.createdAt)}${x.assignee ? ' · Thợ ' + U.esc(x.assignee) + (x.assigneePhone ? ' ' + U.esc(x.assigneePhone) : '') : ''}${x.scheduledFor && x.status !== 'done' ? ' · Hẹn ' + U.fmtDate(x.scheduledFor) : ''}</div></div>
          <span class="badge s-${s.tone}"><span class="dot"></span>${s.label}</span></div>
        <div class="ip-cols">
          <div><div class="ip-h">Tiến độ</div><ol class="ip-tl">${ipTimeline(x)}</ol></div>
          <div><div class="ip-h">Cập nhật</div>
            <div class="field"><label>Việc</label><select class="select" id="ipViec">${choPhep.map(v => `<option value="${v}" ${v === first ? 'selected' : ''}>${IP_VIEC[v]}</option>`).join('')}</select></div>
            <div id="ipHen" hidden>
              <div class="field"><label>Ngày hẹn *</label>
                <div class="ip-quick"><input class="input" type="date" id="ipNgay" min="${U.dateKey(U.today())}">
                  <button type="button" class="btn btn-sm btn-outline" data-ngay="0">Hôm nay</button><button type="button" class="btn btn-sm btn-outline" data-ngay="1">Ngày mai</button><button type="button" class="btn btn-sm btn-outline" data-ngay="2">Ngày kia</button></div></div>
              <div class="grid-2"><div class="field"><label>Thợ</label><input class="input" id="ipTho" maxlength="80" value="${U.esc(x.assignee || '')}" placeholder="VD: Anh Hùng"></div>
                <div class="field"><label>Số điện thoại thợ</label><input class="input mono" id="ipSdt" inputmode="tel" value="${U.esc(x.assigneePhone || '')}" placeholder="Không bắt buộc"></div></div></div>
            <div id="ipXong" hidden>
              <div class="grid-2"><div class="field"><label>Chi phí (₫)</label><input class="input mono" id="ipCost" inputmode="numeric" autocomplete="off" placeholder="VD: 350.000"></div>
                <div class="field"><label>Ai chịu</label><select class="select" id="ipPayer"><option value="chu">Chủ trọ</option><option value="khach">Khách thuê</option></select></div></div></div>
            <div class="field"><label id="ipNoteLbl">Ghi chú</label><textarea class="textarea" id="ipNote" rows="2" maxlength="500" placeholder="VD: Thợ báo cần thay van, chờ vật tư"></textarea></div>
            <label class="rm-switch" style="margin-top:4px"><input type="checkbox" id="ipPub"><span><b>Cho khách thấy trong app</b><br><span class="muted text-xs" id="ipPubHint"></span></span></label>
            <div class="ip-err" id="ipErr" role="alert" hidden></div>
          </div></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button>${(x.photos && x.photos.length) ? `<button class="btn btn-ghost" id="ipPhotos">${HH.icon('camera', 14)} ${x.photos.length} ảnh</button>` : ''}<span class="spacer"></span><button class="btn btn-primary" id="ipSave">Lưu cập nhật</button>`,
      onMount(el, close) {
        const $ = (sel) => el.querySelector(sel);
        const sync = () => {
          const v = $('#ipViec').value;
          $('#ipHen').hidden = v !== 'hen-tho'; $('#ipXong').hidden = v !== 'hoan-tat';
          $('#ipNoteLbl').textContent = v === 'ghi-chu' ? 'Ghi chú *' : 'Ghi chú (không bắt buộc)';
          const congKhaiMacDinh = v !== 'ghi-chu';
          $('#ipPub').checked = congKhaiMacDinh;
          $('#ipPubHint').textContent = v === 'ghi-chu' ? 'Mặc định chỉ mình bạn thấy. Bật thì khách đọc được ghi chú này.'
            : v === 'hen-tho' ? 'Khách sẽ thấy ngày hẹn, tên thợ, số điện thoại thợ và ghi chú (nếu có). Tắt thì chỉ mình bạn thấy.'
            : v === 'hoan-tat' ? 'Khách thấy "Đã sửa xong" và ghi chú. Chi phí không bao giờ hiện cho khách.'
            : 'Khách thấy mốc này và ghi chú kèm theo. Tắt thì chỉ mình bạn thấy (trạng thái chung vẫn hiện cho khách).';
        };
        $('#ipViec').onchange = sync; sync();
        const ph = $('#ipPhotos'); if (ph) ph.onclick = () => { close(); showIncPhotos(x); };
        // Lỗi hiện ngay trong hộp thoại, kèm đưa con trỏ tới ô cần sửa (thông báo ở góc màn hình dễ bị bỏ sót)
        const loi = (msg, ten) => {
          const box = $('#ipErr'); box.textContent = msg; box.hidden = false;
          const f = ten && $(ten); if (f) { f.focus(); f.classList.add('invalid'); }
        };
        const xoaLoi = () => { $('#ipErr').hidden = true; el.querySelectorAll('.invalid').forEach(i => i.classList.remove('invalid')); };
        el.addEventListener('input', xoaLoi); el.addEventListener('change', xoaLoi);
        // ô tiền tự chèn dấu chấm ngăn cách khi gõ (350000 → 350.000) cho khỏi đếm nhầm số 0
        const cost = $('#ipCost');
        cost.addEventListener('input', () => { const d = cost.value.replace(/\D/g, '').slice(0, 10); cost.value = d ? Number(d).toLocaleString('vi-VN') : ''; });
        el.querySelectorAll('[data-ngay]').forEach(b => b.onclick = () => {
          const d = U.today(); d.setDate(d.getDate() + Number(b.dataset.ngay));
          $('#ipNgay').value = U.dateKey(d); xoaLoi();
        });
        // chỗ đặt con trỏ khi sai, theo từng loại lỗi
        const oLoi = { 'hen-tho': '#ipNgay', 'ghi-chu': '#ipNote', 'hoan-tat': '#ipCost' };
        $('#ipSave').onclick = (e) => {
          xoaLoi();
          const v = $('#ipViec').value;
          const sdt = HH.validate.chuanSdt($('#ipSdt').value);
          if (v === 'hen-tho' && sdt && !/^0\d{9}$/.test(sdt)) { loi('Số điện thoại thợ chưa đúng: 10 số, bắt đầu bằng 0.', '#ipSdt'); return; }
          const act = { loai: v, ghiChu: $('#ipNote').value };
          act.congKhai = $('#ipPub').checked;
          if (v === 'hen-tho') Object.assign(act, { ngayHen: $('#ipNgay').value, tho: $('#ipTho').value, thoSdt: sdt });
          if (v === 'hoan-tat') {
            const txt = $('#ipCost').value.trim(), c = txt ? U.parseNum(txt) : null;
            if (txt && c == null) { loi('Chi phí phải là số tiền, ví dụ 350.000.', '#ipCost'); return; }
            Object.assign(act, { chiPhi: c, nguoiChiu: $('#ipPayer').value });
          }
          const r = S.progressIncident(x.id, act);
          if (!r.ok) { loi(r.loi, oLoi[v]); return; }
          const khach = act.congKhai ? ', khách thấy trong app' : '';
          close(); HH.router.render();
          UI.toast({ 'hen-tho': 'Đã lưu lịch hẹn thợ' + khach, 'ghi-chu': 'Đã lưu ghi chú' + khach, 'bat-dau': 'Đã chuyển sang đang xử lý' + khach,
            'hoan-tat': 'Đã đánh dấu sửa xong. Muốn xem lại, bấm "Hiện cả đã xong".', 'mo-lai': 'Đã mở lại sự cố' + khach }[v] || 'Đã lưu tiến độ', { type: 'ok' });
        };
      } });
  }

  function showIncPhotos(x) {
    if (!x || !x.photos || !x.photos.length) return;
    UI.modal({ title: `Ảnh yêu cầu phòng ${x.roomCode}`, size: 'wide',
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
          ${raw(rooms.map(r => `<option value="${r.code}">${r.code} (${U.esc(r.typeLabel)})${r.tenantName ? ', ' + U.esc(r.tenantName) : ''}</option>`).join(''))}
        </select></div>
        <div class="field"><label>Hạng mục</label><select class="select" id="icCat">
          ${raw(cats.map(c => `<option>${c}</option>`).join(''))}</select></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Mô tả sự cố *</label>
        <textarea class="textarea" id="icTitle" placeholder="VD: Bóng đèn nhà tắm bị cháy"></textarea></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="icSave">Tạo yêu cầu</button>`,
      onMount(el, close) {
        const rules = UI.formRules(el, [
          { el: '#icTitle', ten: 'mô tả sự cố', kiem: (v) => {
              if (v.trim().length < 5) return 'Mô tả quá ngắn, ghi rõ hỏng gì để thợ biết';
              if (v.trim().length > 500) return 'Mô tả tối đa 500 ký tự';
            } },
        ]);
        el.querySelector('#icSave').onclick = (e) => {
          if (!rules.check()) return;
          const title = el.querySelector('#icTitle').value.trim();
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            S.addIncident({ id: U.uid('sc'), buildingId: ctx.bid, roomCode: el.querySelector('#icRoom').value,
              category: el.querySelector('#icCat').value, title, status: 'open',
              photos: [], createdAt: new Date().toISOString(),
              history: [HH.progress.suKien('tiep-nhan')] });
            S.log('incident.create', `Tạo yêu cầu sửa chữa ${title}`);
            close(); UI.toast('Đã tạo yêu cầu', { type: 'ok' }); HH.router.render();
          }, 300);
        };
      } });
  }
})();

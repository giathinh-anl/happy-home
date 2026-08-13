/* ============================================================
   Trang: Danh sách phòng — sơ đồ + bảng (§3.3)
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;
  const tone = (st) => (UI.STATUS.room[st] || { tone: 'neutral' }).tone;

  // máy trạng thái đơn giản: chuyển hợp lệ theo trình tự
  const VALID_NEXT = {
    vacant: ['reserved', 'occupied', 'cleaning', 'inactive'],
    reserved: ['occupied', 'vacant'],
    occupied: ['notice', 'vacant'],
    notice: ['cleaning', 'occupied'],
    cleaning: ['vacant', 'inactive'],
    inactive: ['vacant'],
  };

  // Trạng thái bộ lọc & ẩn/hiện cột (giữ trong phiên)
  let activeFilter = null;
  const hiddenCols = new Set();

  // Chip lọc kiểu LOZIDO
  const FILTERS = [
    { key: 'occupied', label: 'Đang ở',              tone: 'success', test: r => r.status === 'occupied' },
    { key: 'vacant',   label: 'Đang trống',          tone: 'info',    test: r => r.status === 'vacant' },
    { key: 'notice',   label: 'Đang báo kết thúc',   tone: 'purple',  test: r => r.status === 'notice' },
    { key: 'expiring', label: 'Sắp hết hạn hợp đồng', tone: 'warning', test: r => r.contractEnd && U.daysBetween(U.today(), r.contractEnd) >= 0 && U.daysBetween(U.today(), r.contractEnd) <= 30 },
    { key: 'expired',  label: 'Đã quá hạn hợp đồng',  tone: 'danger',  test: r => r.contractEnd && U.daysBetween(U.today(), r.contractEnd) < 0 },
    { key: 'reserved', label: 'Đang cọc giữ chỗ',     tone: 'warning', test: r => r.status === 'reserved' },
    { key: 'debt',     label: 'Đang nợ tiền',         tone: 'danger',  test: r => r.debt > 0 },
  ];

  function roomColumns(ctx) {
    return [
      { key: 'code', label: 'Tên phòng', sortable: true, render: r => `<b>${r.code}</b>` },
      { key: 'floor', label: 'Tầng', align: 'right', sortable: true },
      { key: 'typeLabel', label: 'Loại phòng' },
      { key: 'area', label: 'DT (m²)', align: 'right', render: r => U.number(r.area) },
      { key: 'price', label: 'Giá thuê', align: 'right', sortable: true, render: r => U.currency(r.price) },
      { key: 'status', label: 'Tình trạng', render: r => UI.statusBadge(r.status, 'room') },
      { key: 'tenantName', label: 'Khách thuê', render: r => r.tenantName || '<span class="faint">—</span>' },
      { key: 'contractEnd', label: 'Hạn hợp đồng', render: r => r.contractEnd ? U.fmtDate(r.contractEnd) : '<span class="faint">—</span>' },
      { key: 'holdingDeposit', label: 'Cọc giữ chỗ', align: 'right', render: r => r.holdingDeposit ? U.currency(r.holdingDeposit) : '<span class="faint">—</span>' },
      { key: 'debt', label: 'Tài chính', align: 'right', sortable: true, render: r => r.debt ? `<span style="color:var(--danger)">Nợ ${U.currency(r.debt)}</span>` : '<span style="color:var(--success)">Đủ</span>' },
    ];
  }

  function roomCell(r) {
    const t = tone(r.status);
    const name = (r.status === 'occupied' || r.status === 'notice') ? r.tenantName : UI.STATUS.room[r.status].label;
    return h`<div class="room-cell bl-${raw(t)}" data-room="${r.code}" tabindex="0">
      ${raw(r.debt ? `<span class="r-debt">Nợ ${U.number(r.debt)}</span>` : '')}
      <div class="r-code">${r.code}</div>
      <div class="r-tenant ${raw(name === UI.STATUS.room[r.status].label ? 'faint' : '')}">${name}</div>
      <div class="r-price">${U.currency(r.price)}</div>
      <button class="kebab" data-kebab="${r.code}" aria-label="Thao tác">⋯</button>
    </div>`;
  }

  function mapView(ctx, rooms) {
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => b - a);
    return floors.map(f => h`<div class="floor-block">
      <div class="floor-label">Tầng ${f}</div>
      <div class="room-grid">${rooms.filter(r => r.floor === f).map(roomCell)}</div>
    </div>`).join('');
  }

  function tableView(ctx, rooms) {
    const cols = roomColumns(ctx).filter(c => !hiddenCols.has(c.key));
    const dt = UI.DataTable({
      rows: rooms, rowId: r => r.code, searchable: true, searchKeys: ['code', 'tenantName', 'typeLabel'],
      searchPlaceholder: 'Tìm tên phòng...',
      columns: cols,
      actions: r => roomActions(ctx, r),
    });
    ctx._dt = dt;
    return dt.render();
  }

  function roomActions(ctx, r) {
    const items = [{ icon: '👁', label: 'Xem chi tiết', onClick: () => showRoom(ctx, r) }];
    if (r.status === 'vacant' || r.status === 'reserved')
      items.push({ icon: '▣', label: 'Lập hợp đồng', onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/new`) });
    if (S.isOwner())
      items.push({ sep: true }, { icon: '⇄', label: 'Đổi trạng thái', onClick: () => changeStatus(ctx, r) });
    return items;
  }

  function showRoom(ctx, r) {
    UI.modal({ title: `Phòng ${r.code}`, size: '', bodyHtml: h`
      <div class="row-gap-3" style="margin-bottom:12px">${raw(UI.statusBadge(r.status, 'room'))}
        <span class="badge s-neutral"><span class="dot"></span>${r.typeLabel}</span></div>
      <div class="grid-2">
        <div class="field"><label>Giá thuê</label><div class="mono b">${U.currency(r.price)}</div></div>
        <div class="field"><label>Diện tích</label><div class="mono b">${r.area} m²</div></div>
        <div class="field"><label>Khách thuê</label><div>${r.tenantName || '—'}</div></div>
        <div class="field"><label>Hết hạn HĐ</label><div class="mono">${r.contractEnd ? U.fmtDate(r.contractEnd) : '—'}</div></div>
        <div class="field"><label>Công nợ</label><div class="mono b" style="color:${raw(r.debt ? 'var(--danger)' : 'inherit')}">${U.currency(r.debt)}</div></div>
        <div class="field"><label>Số người tối đa</label><div>${r.maxOccupants}</div></div>
      </div>`,
      footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` });
  }

  /* ---- Đổi trạng thái thủ công: DangerDialog (§3.3) ---- */
  function changeStatus(ctx, r) {
    const valid = VALID_NEXT[r.status] || [];
    const all = Object.keys(UI.STATUS.room).filter(s => s !== r.status);
    let selected = valid[0] || all[0];
    const optHtml = all.map(s => {
      const invalid = !valid.includes(s);
      return `<option value="${s}" ${s === selected ? 'selected' : ''}>${UI.STATUS.room[s].label}${invalid ? ' — ngoài trình tự' : ''}</option>`;
    }).join('');
    const body = h`
      <p class="muted" style="margin-bottom:12px">Phòng <b>${r.code}</b> hiện đang: ${raw(UI.statusBadge(r.status, 'room'))}</p>
      <div class="field"><label>Chuyển sang trạng thái</label>
        <select class="select" data-newst>${raw(optHtml)}</select>
        <span class="hint" data-warn></span>
      </div>
      <div class="field" style="margin-top:12px"><label>Lý do (bắt buộc)</label>
        <textarea class="textarea" data-reason placeholder="Nhập lý do đổi trạng thái..."></textarea>
        <span class="hint">Tối thiểu 10 ký tự</span></div>`;
    const head = `<div class="danger-head"><span class="warn-ic">⚠</span><h3>Đổi trạng thái phòng ${r.code}</h3></div>`;
    UI.modal({
      headHtml: head, bodyHtml: body,
      footHtml: `<button class="btn btn-outline" data-close>Quay lại</button><span class="spacer"></span><button class="btn btn-danger" data-confirm disabled>Xác nhận đổi</button>`,
      onMount(el, close) {
        const sel = el.querySelector('[data-newst]');
        const ta = el.querySelector('[data-reason]');
        const warn = el.querySelector('[data-warn]');
        const btn = el.querySelector('[data-confirm]');
        const check = () => {
          const invalid = !valid.includes(sel.value);
          warn.textContent = invalid ? '⚠ Chuyển đổi này không theo trình tự thông thường' : '';
          warn.style.color = invalid ? 'var(--danger)' : '';
          btn.disabled = ta.value.trim().length < 10;
        };
        sel.oninput = check; ta.oninput = check;
        btn.onclick = () => {
          btn.classList.add('loading');
          setTimeout(() => {
            S.setRoomStatus(ctx.bid, r.code, sel.value, ta.value.trim());
            close(); UI.toast(`Đã đổi trạng thái phòng ${r.code}`, { type: 'ok' });
            HH.router.render();
          }, 350);
        };
      },
    });
  }

  /* ---- Tạo phòng hàng loạt (§3.3) ---- */
  function bulkCreate(ctx) {
    const types = S.ROOM_TYPES;
    const typeOpts = Object.entries(types).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
    const b = ctx.building;
    const floorOpts = Array.from({ length: b.floors }, (_, i) =>
      `<option value="${i + 1}">Tầng ${i + 1}</option>`).join('') + `<option value="new">+ Tầng mới</option>`;
    const step1 = h`
      <div class="grid-2">
        <div class="field"><label>Tầng</label><select class="select" data-f="floor">${raw(floorOpts)}</select></div>
        <div class="field"><label>Loại phòng</label><select class="select" data-f="type">${raw(typeOpts)}</select></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Quy tắc đặt tên</label>
        <div class="row-gap-2 wrap">
          <input class="input" data-f="prefix" value="P1" style="width:90px" placeholder="Tiền tố">
          <span class="muted">Từ số</span><input class="input mono" data-f="from" value="01" style="width:70px">
          <span class="muted">Đến số</span><input class="input mono" data-f="to" value="10" style="width:70px">
        </div>
        <div class="hint" data-preview></div>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Giá thuê (₫/tháng)</label><input class="input money" data-f="price" value="3.500.000"></div>
        <div class="field"><label>Diện tích (m²)</label><input class="input mono" data-f="area" value="20"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Số người tối đa</label>
        <select class="select" data-f="max" style="max-width:120px"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></div>`;

    UI.modal({
      title: 'Tạo phòng hàng loạt', stepText: 'Bước 1/2', size: 'wide',
      bodyHtml: `<div data-body>${step1}</div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" data-next>Tiếp tục →</button>`,
      onMount(el, close) {
        const body = el.querySelector('[data-body]');
        const get = (k) => el.querySelector(`[data-f="${k}"]`);
        const preview = () => {
          const prefix = get('prefix').value.trim();
          const from = parseInt(get('from').value) || 0, to = parseInt(get('to').value) || 0;
          const list = [];
          for (let i = from; i <= to && list.length < 60; i++) list.push(prefix + String(i).padStart(2, '0'));
          el.querySelector('[data-preview]').innerHTML = list.length
            ? `Xem trước: <b class="mono">${list.slice(0, 3).join(', ')}${list.length > 3 ? ' … ' + list[list.length - 1] : ''}</b> (${list.length} phòng)`
            : 'Nhập khoảng số hợp lệ';
          return list;
        };
        ['prefix', 'from', 'to'].forEach(k => get(k).oninput = preview);
        // format tiền
        get('price').oninput = () => { const n = U.parseNum(get('price').value); get('price').value = n ? U.number(n) : ''; };
        preview();

        el.querySelector('[data-next]').onclick = () => {
          const list = preview();
          const existing = new Set(S.roomsOf(ctx.bid).map(r => r.code));
          const type = get('type').value; const t = types[type];
          const price = U.parseNum(get('price').value) || t.price;
          const area = U.parseNum(get('area').value) || t.area;
          const max = parseInt(get('max').value);
          const floor = get('floor').value === 'new' ? ctx.building.floors + 1 : parseInt(get('floor').value);
          const rows = list.map(code => ({ code, floor, type, typeLabel: t.label, price, area, max, dup: existing.has(code) }));
          renderStep2(el, close, ctx, rows);
        };
      },
    });
  }

  function renderStep2(el, close, ctx, rows) {
    const dupCount = rows.filter(r => r.dup).length;
    const okCount = rows.length - dupCount;
    const trs = rows.map((r, i) => `<tr class="${r.dup ? 'disabled-row' : ''}">
      <td><b>${r.code}</b> ${r.dup ? '<span class="badge s-danger" style="margin-left:6px"><span class="dot"></span>Trùng mã</span>' : ''}</td>
      <td>Tầng ${r.floor}</td>
      <td><input class="input mono" data-i="${i}" data-k="price" value="${U.number(r.price)}" style="width:120px;text-align:right" ${r.dup ? 'disabled' : ''}></td>
      <td><input class="input mono" data-i="${i}" data-k="area" value="${r.area}" style="width:70px" ${r.dup ? 'disabled' : ''}></td>
    </tr>`).join('');
    el.querySelector('[data-body]').innerHTML = `
      ${dupCount ? `<div class="alert alert-warning" style="margin-bottom:12px"><span class="ic">⚠</span><div>${dupCount} phòng trùng mã đã có sẽ bị loại khỏi danh sách tạo.</div></div>` : ''}
      <div class="dt-scroll" style="max-height:340px;overflow:auto"><table class="dt">
        <thead><tr><th>Mã phòng</th><th>Tầng</th><th class="num">Giá thuê</th><th class="num">DT</th></tr></thead>
        <tbody>${trs}</tbody></table></div>`;
    el.querySelector('.step-pill').textContent = 'Bước 2/2';
    const foot = el.querySelector('.dialog-foot');
    foot.innerHTML = `<button class="btn btn-outline" data-back>← Quay lại</button><span class="spacer"></span>
      <button class="btn btn-primary" data-create ${okCount === 0 ? 'disabled' : ''}>Tạo ${okCount} phòng</button>`;
    el.querySelectorAll('[data-k]').forEach(inp => inp.oninput = () => {
      rows[+inp.dataset.i][inp.dataset.k] = U.parseNum(inp.value);
    });
    foot.querySelector('[data-back]').onclick = () => bulkCreate(ctx) & close();
    foot.querySelector('[data-create]').onclick = (e) => {
      const btn = e.currentTarget; btn.classList.add('loading');
      setTimeout(() => {
        const create = rows.filter(r => !r.dup);
        create.forEach(r => S.roomsOf(ctx.bid).push({
          id: U.uid('rm'), buildingId: ctx.bid, code: r.code, floor: r.floor, type: r.type,
          typeLabel: r.typeLabel, area: r.area, price: r.price, maxOccupants: r.max,
          status: 'vacant', tenantName: null, tenantId: null, contractId: null, contractEnd: null, debt: 0,
        }));
        S.log('room.bulkCreate', `Tạo ${create.length} phòng`);
        close(); UI.toast(`Đã tạo ${create.length} phòng`, { type: 'ok' });
        HH.router.render();
      }, 500);
    };
  }

  /* ---- 4 thẻ tổng hợp (kiểu LOZIDO) ---- */
  function summaryCards(ctx) {
    const s = S.roomSummary(ctx.bid);
    const card = (icon, iconBg, label, value, filter) =>
      `<div class="lz-sum" ${filter ? `data-sumfilter="${filter}"` : ''}>
        <span class="lz-sum-ic" style="background:${iconBg}">${icon}</span>
        <div class="lz-sum-body"><div class="lz-sum-label">${label}</div>
          <div class="lz-sum-val">${U.currency(value).replace(' ₫','')}<span class="lz-sum-cur">${typeof value==='number'?'đ':''}</span></div></div>
        <span class="lz-sum-go">→</span></div>`;
    return `<div class="lz-sum-grid">
      ${card('🧾', 'var(--danger-bg)', 'Tổng số tiền khách nợ', s.debt, 'debt')}
      ${card('💵', 'var(--success-bg)', 'Tổng số tiền cọc', s.deposit, null)}
      ${card('📦', 'var(--warning-bg)', 'Tổng tiền cọc giữ chỗ phòng', s.holding, 'reserved')}
      <div class="lz-sum" data-sumfilter="incident"><span class="lz-sum-ic" style="background:#fff7ed">🧰</span>
        <div class="lz-sum-body"><div class="lz-sum-label">Sự cố phòng</div>
          <div class="lz-sum-val">${s.incident} <span class="lz-sum-cur">Vấn đề</span></div></div>
        <span class="lz-sum-go">→</span></div>
    </div>`;
  }

  /* ---- Chip lọc ---- */
  function filterChips(rooms) {
    const chips = FILTERS.map(f => {
      const n = rooms.filter(f.test).length;
      const on = activeFilter === f.key;
      return `<button class="lz-chip ${on ? 'on' : ''}" data-filter="${f.key}">
        <span class="lz-chip-box">${on ? '✓' : ''}</span>${f.label}
        <span class="lz-chip-cnt s-${f.tone}">${n}</span></button>`;
    }).join('');
    return `<div class="lz-chips"><span class="lz-chips-ic">▽</span>${chips}</div>`;
  }

  /* ---- Trang ---- */
  HH.pages.units = {
    render(ctx) {
      let rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
      const allRooms = rooms;
      const view = S.prefs.roomView || 'table';
      if (rooms.length === 0) {
        return h`${raw(summaryCards(ctx))}
          <div class="card"><div class="empty"><div class="ic">🏠</div>
          <h4>Chưa có phòng nào trong tòa nhà này</h4>
          <p class="muted">Bắt đầu bằng cách tạo phòng hàng loạt theo tầng.</p>
          <div style="margin-top:16px"><button class="btn btn-primary" data-primary-new>Tạo phòng hàng loạt</button></div>
          </div></div>`;
      }
      const f = FILTERS.find(x => x.key === activeFilter);
      if (f) rooms = rooms.filter(f.test);
      const content = view === 'map' ? mapView(ctx, rooms) : tableView(ctx, rooms);
      return h`
        <div class="trial-banner">
          <div class="tb-text"><b>Tòa nhà thử nghiệm!</b>
            <p>Sau khi kết thúc thời gian thử nghiệm, bạn có thể tạo tòa nhà chính thức.</p></div>
          <button class="tb-btn" id="promoteBtn">⚡ Tạo tòa nhà chính thức</button>
        </div>
        ${raw(summaryCards(ctx))}
        <div class="page-head">
          <div class="row-gap-3"><span class="lz-home-ic">🏠</span>
            <div><div class="page-title-lg">Quản lý danh sách phòng</div>
            <div class="page-sub">${ctx.building.name}</div></div></div>
          <div class="page-actions">
            <div class="view-toggle">
              <button class="${raw(view === 'map' ? 'active' : '')}" data-view="map">▦ Sơ đồ</button>
              <button class="${raw(view === 'table' ? 'active' : '')}" data-view="table">☰ Bảng</button>
            </div>
            <button class="btn btn-dark" id="colToggle">🗂 Ẩn/Hiện cột <span class="cnt-badge">${roomColumns(ctx).length - hiddenCols.size}</span></button>
            <button class="btn btn-success" id="exportXls">📊 Xuất excel</button>
            <button class="btn btn-primary" data-primary-new>+ Tạo phòng</button>
          </div>
        </div>
        ${raw(filterChips(allRooms))}
        <div id="roomContent">${raw(content)}</div>`;
    },
    mount(ctx) {
      const nb = document.querySelector('[data-primary-new]');
      if (nb) nb.onclick = () => bulkCreate(ctx);
      document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
        S.setPref('roomView', b.dataset.view); HH.router.render();
      });
      document.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => {
        activeFilter = (activeFilter === b.dataset.filter) ? null : b.dataset.filter; HH.router.render();
      });
      document.querySelectorAll('[data-sumfilter]').forEach(b => b.onclick = () => {
        const k = b.dataset.sumfilter;
        if (k === 'incident') { HH.router.go(`/b/${ctx.bid}/incidents`); return; }
        activeFilter = (activeFilter === k) ? null : k; HH.router.render();
      });
      const ct = document.getElementById('colToggle');
      if (ct) ct.onclick = () => openColMenu(ct, ctx);
      const ex = document.getElementById('exportXls');
      if (ex) ex.onclick = () => UI.toast('Đã xuất Excel danh sách phòng (demo)', { type: 'ok' });
      const pr = document.getElementById('promoteBtn');
      if (pr) pr.onclick = () => UI.toast('Tạo tòa nhà chính thức (demo)', { type: 'ok' });
      if (ctx._dt) ctx._dt.attach(document);
      document.querySelectorAll('[data-kebab]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const r = S.room(ctx.bid, b.dataset.kebab);
        UI.openMenu(b, roomActions(ctx, r));
      });
      wireTooltips(ctx);
    },
  };

  function openColMenu(anchor, ctx) {
    const items = roomColumns(ctx).map(c => ({
      icon: hiddenCols.has(c.key) ? '☐' : '☑', label: c.label,
      onClick: () => { if (hiddenCols.has(c.key)) hiddenCols.delete(c.key); else hiddenCols.add(c.key);
        if (S.prefs.roomView !== 'table') S.setPref('roomView', 'table'); HH.router.render(); },
    }));
    UI.openMenu(anchor, items);
  }

  function wireTooltips(ctx) {
    let tip;
    document.querySelectorAll('.room-cell').forEach(cell => {
      cell.addEventListener('mouseenter', (e) => {
        const r = S.room(ctx.bid, cell.dataset.room); if (!r) return;
        tip = document.createElement('div'); tip.className = 'rt-tip';
        tip.innerHTML = h`
          <div class="b" style="margin-bottom:4px">${r.code} · ${r.typeLabel}</div>
          <div class="row"><span class="k">Khách thuê</span><span>${r.tenantName || '—'}</span></div>
          <div class="row"><span class="k">Hết hạn HĐ</span><span class="mono">${r.contractEnd ? U.fmtDate(r.contractEnd) : '—'}</span></div>
          <div class="row"><span class="k">Công nợ</span><span class="mono">${U.currency(r.debt)}</span></div>`;
        document.body.appendChild(tip);
      });
      cell.addEventListener('mousemove', (e) => {
        if (!tip) return;
        let x = e.clientX + 14, y = e.clientY + 14;
        if (x + 250 > window.innerWidth) x = e.clientX - 250;
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      });
      cell.addEventListener('mouseleave', () => { if (tip) { tip.remove(); tip = null; } });
      cell.addEventListener('click', (e) => { if (e.target.closest('button')) return; showRoom(ctx, S.room(ctx.bid, cell.dataset.room)); });
    });
  }
})();

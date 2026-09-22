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
      { key: 'tenantName', label: 'Khách thuê', render: (r) => {
          const n = S.tenantsOf(r.buildingId).filter(t => t.roomCode === r.code).length;
          if (!r.tenantName && !n) return '<span class="faint">-</span>';
          return `${U.esc(r.tenantName || '')}${n > 1 ? ` <span class="faint text-xs">+${n - 1} người</span>` : ''}`;
        } },
      { key: 'contractEnd', label: 'Hạn hợp đồng', render: r => r.contractEnd ? U.fmtDate(r.contractEnd) : '<span class="faint">-</span>' },
      { key: 'holdingDeposit', label: 'Cọc giữ chỗ', align: 'right', render: r => r.holdingDeposit ? U.currency(r.holdingDeposit) : '<span class="faint">-</span>' },
      { key: 'debt', label: 'Tài chính', align: 'right', sortable: true, render: r => r.debt ? `<span style="color:var(--danger)">Nợ ${U.currency(r.debt)}</span>` : '<span style="color:var(--success)">Đủ</span>' },
    ];
  }

  function roomCell(r) {
    const t = tone(r.status);
    const st = UI.STATUS.room[r.status] || { label: r.status };
    const occupied = (r.status === 'occupied' || r.status === 'notice');
    const days = r.contractEnd ? U.daysBetween(U.today(), r.contractEnd) : null;

    // Dòng dưới cùng: ưu tiên cảnh báo nợ > sắp hết hạn > hạn hợp đồng > gợi ý cho thuê
    let foot;
    if (r.debt > 0) foot = `<div class="rc-foot danger">${HH.icon('alert', 14)} Nợ ${U.currency(r.debt)}</div>`;
    else if (occupied && days != null && days < 0) foot = `<div class="rc-foot danger">${HH.icon('alert', 14)} HĐ quá hạn ${Math.abs(days)} ngày</div>`;
    else if (occupied && days != null && days <= 30) foot = `<div class="rc-foot warn">${HH.icon('clock', 14)} Còn ${days} ngày HĐ</div>`;
    else if (occupied && days != null) foot = `<div class="rc-foot">${HH.icon('calendar', 14)} Đến ${U.fmtDate(r.contractEnd)}</div>`;
    else if (r.status === 'vacant') foot = `<div class="rc-foot ok">${HH.icon('check', 14)} Sẵn sàng cho thuê</div>`;
    else if (r.status === 'reserved') foot = `<div class="rc-foot warn">${HH.icon('wallet', 14)} Cọc ${U.currency(r.holdingDeposit || 0)}</div>`;
    else foot = `<div class="rc-foot">${HH.icon('clock', 14)} ${U.esc(st.label)}</div>`;

    const who = occupied
      ? `<div class="rc-who"><span class="rc-av">${U.initials(r.tenantName || '')}</span>
           <span class="rc-name">${U.esc(r.tenantName || '')}</span>
           ${S.tenantsOf(r.buildingId).filter(t => t.roomCode === r.code).length > 1
             ? `<span class="rc-more">+${S.tenantsOf(r.buildingId).filter(t => t.roomCode === r.code).length - 1}</span>` : ''}</div>`
      : `<div class="rc-who empty">${HH.icon('door', 15)}<span class="rc-name">${U.esc(st.label)}</span></div>`;

    return `<div class="room-cell tone-${t}" data-room="${r.code}" tabindex="0" role="button" aria-label="Phòng ${r.code}">
      <div class="rc-top">
        <span class="rc-status"><i></i>${U.esc(st.label)}</span>
        <button class="rc-menu" data-kebab="${r.code}" aria-label="Thao tác">${HH.icon('dots', 16)}</button>
      </div>
      <div class="rc-code">${r.code}</div>
      ${who}
      <div class="rc-price"><span class="v">${U.currency(r.price)}</span><span class="u">/tháng</span></div>
      ${foot}
    </div>`;
  }

  const mapPage = { page: 1, size: 2 };   // phân trang theo TẦNG (mỗi trang N tầng)

  function mapView(ctx, rooms) {
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => b - a);
    const pg = UI.paginate(floors, mapPage, { unit: 'tầng', sizes: [2, 4, 8] });
    ctx._mapPg = pg;
    const blocks = pg.items.map(f => {
      const list = rooms.filter(r => r.floor === f);
      const occ = list.filter(r => r.status === 'occupied' || r.status === 'notice').length;
      return `<div class="floor-block">
        <div class="floor-label"><span>Tầng ${f}</span>
          <span class="floor-meta">${list.length} phòng · ${occ} đang thuê</span></div>
        <div class="room-grid">${list.map(roomCell).join('')}</div>
      </div>`;
    }).join('');
    return blocks + pg.html;
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
    const items = [{ icon: HH.ic('eye', 16), label: 'Xem chi tiết', onClick: () => showRoom(ctx, r) }];
    if (r.status === 'vacant' || r.status === 'reserved')
      items.push({ icon: '▣', label: 'Lập hợp đồng', onClick: () => HH.router.go(`/b/${ctx.bid}/contracts/new`) });
    if (S.isOwner())
      items.push({ sep: true }, { icon: HH.ic('swap', 16), label: 'Đổi trạng thái', onClick: () => changeStatus(ctx, r) });
    return items;
  }

  function showRoom(ctx, r) {
    const assets = S.assetsOf(ctx.bid, r.code);
    // Tất cả người đang ở phòng này, không chỉ người đại diện hợp đồng
    const people = S.tenantsOf(ctx.bid).filter(t => t.roomCode === r.code)
      .sort((a, b) => (b.isRep ? 1 : 0) - (a.isRep ? 1 : 0));
    const peopleHtml = people.length
      ? `<div class="room-people">${people.map(t => `<button class="rp" data-person="${t.id}">
          <span class="rp-av">${U.esc(U.initials(t.fullName || '?'))}</span>
          <span class="rp-txt"><b>${U.esc(t.fullName)}</b><small>${U.esc(t.phone || 'chưa có số điện thoại')}</small></span>
          ${t.isRep ? '<span class="tn-tag rep">Đại diện</span>' : ''}</button>`).join('')}</div>`
      : '<span class="faint text-sm">Chưa có ai ở phòng này</span>';
    const assetHtml = assets.length
      ? `<div class="room-assets">${assets.map(a => `<span class="room-asset-chip ${a.condition === 'good' ? '' : a.condition}">
          ${a.icon || '📦'} ${U.esc(a.name)}${(a.quantity || 1) > 1 ? ' ×' + a.quantity : ''}</span>`).join('')}</div>`
      : '<span class="faint text-sm">Chưa gắn tài sản nào cho phòng này</span>';
    const photos = r.photos || [];
    const photoHtml = photos.length
      ? `<div class="photo-strip">${photos.map((p, i) => `<div class="photo-thumb"><img src="${p}" alt="Ảnh ${i + 1}">
          ${S.isOwner() ? `<button class="ph-del" data-delphoto="${i}" title="Xóa ảnh">✕</button>` : ''}</div>`).join('')}</div>`
      : '<span class="faint text-sm">Chưa có ảnh phòng</span>';

    UI.modal({ title: `Phòng ${r.code}`, size: 'wide', bodyHtml: h`
      <div class="row-gap-3" style="margin-bottom:12px">${raw(UI.statusBadge(r.status, 'room'))}
        <span class="badge s-neutral"><span class="dot"></span>${r.typeLabel}</span></div>
      <div class="grid-2">
        <div class="field"><label>Giá thuê</label><div class="mono b">${U.currency(r.price)}</div></div>
        <div class="field"><label>Diện tích</label><div class="mono b">${r.area} m²</div></div>
        <div class="field"><label>Hết hạn HĐ</label><div class="mono">${r.contractEnd ? U.fmtDate(r.contractEnd) : '-'}</div></div>
        <div class="field"><label>Công nợ</label><div class="mono b" style="color:${raw(r.debt ? 'var(--danger)' : 'inherit')}">${U.currency(r.debt)}</div></div>
        <div class="field"><label>Số người tối đa</label><div>${r.maxOccupants}</div></div>
      </div>
      <div class="field" style="margin-top:16px">
        <label>Người ở (${people.length}/${r.maxOccupants})</label>
        ${raw(peopleHtml)}
        ${raw(S.can('tenants') ? `<div style="margin-top:10px" class="row-gap-2">
          <a class="btn btn-outline btn-sm" href="#/b/${ctx.bid}/tenants/new?room=${encodeURIComponent(r.code)}">${HH.ic('plus', 16)} Thêm người vào phòng</a>
          <a class="text-sm" href="#/b/${ctx.bid}/tenants?room=${encodeURIComponent(r.code)}">Xem hồ sơ khách thuê →</a></div>` : '')}
      </div>
      <div class="field" style="margin-top:16px">
        <label>Tài sản trong phòng (${assets.length})</label>
        ${raw(assetHtml)}
        ${raw(S.isOwner() ? `<div style="margin-top:8px"><a href="#/b/${ctx.bid}/assets" class="text-sm">Quản lý tài sản →</a></div>` : '')}
      </div>
      <div class="field" style="margin-top:16px">
        <label>Ảnh phòng (${photos.length}/6) <span class="hint" style="font-weight:400">· dùng cho đăng tin</span></label>
        ${raw(photoHtml)}
        ${raw(S.isOwner() && photos.length < 6 ? `<div style="margin-top:8px">
          <label class="btn btn-outline btn-sm" style="width:fit-content">${HH.ic('camera', 16)} Tải ảnh lên<input type="file" accept="image/*" multiple hidden id="roomPhotoInput"></label></div>` : '')}
      </div>
      <div class="field" style="margin-top:16px"><label>Mô tả (hiện trong tin đăng)</label>
        <textarea class="textarea" id="roomDesc" placeholder="VD: Phòng thoáng, có ban công, gần chợ...">${U.esc(r.description || '')}</textarea></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span>${S.isOwner() ? '<button class="btn btn-primary" id="saveRoomInfo">Lưu</button>' : ''}`,
      onMount(el, close) {
        el.querySelectorAll('[data-person]').forEach(b => b.onclick = () => {
          close(); HH.router.go(`/b/${ctx.bid}/tenants?tn=${encodeURIComponent(b.dataset.person)}`);
        });
        const inp = el.querySelector('#roomPhotoInput');
        if (inp) inp.onchange = async () => {
          const files = Array.from(inp.files || []).slice(0, 6 - (r.photos || []).length);
          if (!files.length) return;
          UI.toast('Đang xử lý ảnh...', { type: 'ok' });
          try {
            const list = (r.photos || []).slice();
            for (const f of files) list.push(await U.compressImage(f, 1000, 0.72));
            S.updateRoom(ctx.bid, r.code, { photos: list });
            UI.toast(`Đã thêm ${files.length} ảnh`, { type: 'ok' });
            close(); showRoom(ctx, S.room(ctx.bid, r.code));
          } catch (err) { UI.toast('Không xử lý được ảnh', { type: 'error' }); }
        };
        el.querySelectorAll('[data-delphoto]').forEach(b => b.onclick = () => {
          const list = (r.photos || []).slice(); list.splice(+b.dataset.delphoto, 1);
          S.updateRoom(ctx.bid, r.code, { photos: list });
          UI.toast('Đã xóa ảnh', { type: 'ok' });
          close(); showRoom(ctx, S.room(ctx.bid, r.code));
        });
        const save = el.querySelector('#saveRoomInfo');
        if (save) save.onclick = () => {
          S.updateRoom(ctx.bid, r.code, { description: el.querySelector('#roomDesc').value.trim() });
          close(); UI.toast('Đã lưu thông tin phòng', { type: 'ok' }); HH.router.render();
        };
      } });
  }

  /* ---- Đổi trạng thái thủ công: DangerDialog (§3.3) ---- */
  function changeStatus(ctx, r) {
    const valid = VALID_NEXT[r.status] || [];
    const all = Object.keys(UI.STATUS.room).filter(s => s !== r.status);
    let selected = valid[0] || all[0];
    const optHtml = all.map(s => {
      const invalid = !valid.includes(s);
      return `<option value="${s}" ${s === selected ? 'selected' : ''}>${UI.STATUS.room[s].label}${invalid ? ' (ngoài trình tự)' : ''}</option>`;
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
    const head = `<div class="danger-head"><span class="warn-ic">${HH.ic('alert', 16)}</span><h3>Đổi trạng thái phòng ${r.code}</h3></div>`;
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
          warn.textContent = invalid ? 'Chuyển đổi này không theo trình tự thông thường.' : '';
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
      ${dupCount ? `<div class="alert alert-warning" style="margin-bottom:12px"><span class="ic">${HH.ic('alert', 16)}</span><div>${dupCount} phòng trùng mã đã có sẽ bị loại khỏi danh sách tạo.</div></div>` : ''}
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
        create.forEach(r => S.addRoom({
          id: U.uid('rm'), buildingId: ctx.bid, code: r.code, floor: r.floor, type: r.type,
          typeLabel: r.typeLabel, area: r.area, price: r.price, maxOccupants: r.max,
          status: 'vacant', tenantName: null, tenantId: null, contractId: null, contractEnd: null, debt: 0, holdingDeposit: 0,
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
    const card = (iconName, tone, label, value, filter) =>
      `<div class="lz-sum" ${filter ? `data-sumfilter="${filter}"` : ''}>
        <span class="lz-sum-ic ${tone}">${HH.pic(iconName, 32)}</span>
        <div class="lz-sum-body"><div class="lz-sum-label">${label}</div>
          <div class="lz-sum-val">${U.currency(value).replace(' ₫','')}<span class="lz-sum-cur">${typeof value==='number'?'đ':''}</span></div></div>
        <span class="lz-sum-go">${HH.icon('chevron', 16)}</span></div>`;
    return `<div class="lz-sum-grid">
      ${card('receipt', 'tone-danger', 'Tổng tiền khách nợ', s.debt, 'debt')}
      ${card('coins', 'tone-success', 'Tổng tiền cọc', s.deposit, null)}
      ${card('calendar', 'tone-warning', 'Cọc giữ chỗ phòng', s.holding, 'reserved')}
      <div class="lz-sum" data-sumfilter="incident"><span class="lz-sum-ic tone-info">${HH.pic('wrench', 32)}</span>
        <div class="lz-sum-body"><div class="lz-sum-label">Sự cố phòng</div>
          <div class="lz-sum-val">${s.incident} <span class="lz-sum-cur">vấn đề</span></div></div>
        <span class="lz-sum-go">${HH.icon('chevron', 16)}</span></div>
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
          <div class="card"><div class="empty"><div class="ic">${HH.pic('building', 72)}</div>
          <h4>Chưa có phòng nào trong tòa nhà này</h4>
          <p class="muted">Bắt đầu bằng cách tạo phòng hàng loạt theo tầng.</p>
          <div style="margin-top:16px"><button class="btn btn-primary" data-primary-new>Tạo phòng hàng loạt</button></div>
          </div></div>`;
      }
      const f = FILTERS.find(x => x.key === activeFilter);
      if (f) rooms = rooms.filter(f.test);
      const content = view === 'map' ? mapView(ctx, rooms) : tableView(ctx, rooms);
      return h`
        ${raw(summaryCards(ctx))}
        <div class="page-head">
          <div><div class="page-title-lg">Danh sách phòng</div>
            <div class="page-sub">${ctx.building.name} · ${rooms.length} phòng</div></div>
          <div class="page-actions">
            <div class="view-toggle">
              <button class="${raw(view === 'map' ? 'active' : '')}" data-view="map">${raw(HH.icon('grid', 15))} Sơ đồ</button>
              <button class="${raw(view === 'table' ? 'active' : '')}" data-view="table">${raw(HH.icon('list', 15))} Bảng</button>
            </div>
            ${raw(view === 'table' ? `<button class="btn btn-outline" id="colToggle">${HH.icon('columns', 16)} Ẩn/Hiện cột
              <span class="cnt-badge">${roomColumns(ctx).length - hiddenCols.size}</span></button>` : '')}
            <button class="btn btn-outline" id="exportXls">${raw(HH.icon('sheet', 16))} Xuất Excel</button>
            <button class="btn btn-primary" data-primary-new>${raw(HH.icon('plus', 16))} Tạo phòng</button>
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
      if (ex) ex.onclick = () => {
        U.downloadCSV(`phong-${ctx.bid}.csv`, ['Tên phòng', 'Tầng', 'Loại phòng', 'DT (m2)', 'Giá thuê', 'Tình trạng', 'Khách thuê', 'Hạn hợp đồng', 'Công nợ'],
          S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code)).map(r => [
            r.code, r.floor, r.typeLabel, r.area, r.price, (UI.STATUS.room[r.status] || {}).label || r.status,
            r.tenantName || '', r.contractEnd ? U.fmtDate(r.contractEnd) : '', r.debt || 0]));
        UI.toast('Đã tải file Excel (CSV) danh sách phòng', { type: 'ok' });
      };
      if (ctx._dt) ctx._dt.attach(document);
      if (ctx._mapPg) ctx._mapPg.attach(document, () => HH.router.render());
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
      icon: hiddenCols.has(c.key) ? HH.ic('square', 16) : HH.ic('checkSquare', 16), label: c.label,
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
          <div class="row"><span class="k">Khách thuê</span><span>${r.tenantName || 'chưa có'}</span></div>
          <div class="row"><span class="k">Hết hạn HĐ</span><span class="mono">${r.contractEnd ? U.fmtDate(r.contractEnd) : '-'}</span></div>
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

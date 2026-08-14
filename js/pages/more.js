/* ============================================================
   Trang bổ sung: Thông báo, Khóa thông minh, Cấu hình tòa nhà
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  /* ---------------- THÔNG BÁO ---------------- */
  HH.pages.noti = {
    render() {
      const items = S.notifications();
      const body = items.length ? items.map(n => h`<a class="todo-item" href="${n.href}">
          <span class="ic alert-${raw(n.tone)}">${raw(n.icon)}</span>
          <span class="grow"><b>${n.title}</b><div class="muted text-xs">${n.sub}</div></span>
          <span class="chev">›</span></a>`).join('')
        : `<div class="empty"><div class="ic">✅</div><h4>Không có thông báo nào</h4><p class="muted">Mọi việc đang được xử lý tốt.</p></div>`;
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">🔔</span>
          <div><div class="page-title-lg">Thông báo</div><div class="page-sub">Việc cần xử lý trên toàn hệ thống · ${items.length} mục</div></div></div>
      </div>
      <div class="card" style="max-width:760px"><div class="card-pad"><div class="todo-list">${raw(body)}</div></div></div>`;
    },
  };

  /* ---------------- KHÓA THÔNG MINH ---------------- */
  const lockCodes = {}; // mã mở cửa tạm (chưa lưu bền — cần cột riêng để lưu)

  function repTenant(bid, code) {
    const ts = S.tenantsOf(bid).filter(t => t.roomCode === code);
    return ts.find(t => t.isRep) || ts[0] || null;
  }

  HH.pages.locks = {
    render(ctx) {
      const rooms = S.roomsOf(ctx.bid).filter(r => r.status === 'occupied' || r.status === 'notice')
        .sort((a, b) => a.code.localeCompare(b.code));
      const connected = rooms.filter(r => { const t = repTenant(ctx.bid, r.code); return t && t.ttlock; }).length;
      const rows = rooms.map(r => {
        const t = repTenant(ctx.bid, r.code);
        const on = t && t.ttlock;
        const code = lockCodes[r.code];
        return `<tr>
          <td><b>${r.code}</b></td>
          <td>${t ? t.fullName : '<span class="faint">—</span>'}</td>
          <td><span class="tn-ttlock ${on ? 'on' : ''}">${on ? '🔒 Đã kết nối' : '🔓 Chưa kết nối'}</span></td>
          <td class="mono">${code ? `<b>${code}</b>` : '<span class="faint">—</span>'}</td>
          <td class="col-actions"><button class="kebab" data-lock="${r.code}">⋯</button></td>
        </tr>`;
      }).join('');
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">🔐</span>
          <div><div class="page-title-lg">Khóa thông minh</div>
          <div class="page-sub">${ctx.building.name} · đã kết nối ${connected}/${rooms.length} phòng</div></div></div>
      </div>
      <div class="alert alert-info" style="margin-bottom:16px"><span class="ic">ℹ</span>
        <div>Quản lý khóa TTLock của từng phòng. Cấp mã mở cửa cho khách khi cần.</div></div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Phòng</th><th>Khách đại diện</th><th>Trạng thái khóa</th><th>Mã mở cửa</th><th></th></tr></thead>
        <tbody>${raw(rows || `<tr><td colspan="5"><div class="empty"><div class="ic">🔐</div><h4>Chưa có phòng đang thuê</h4></div></td></tr>`)}</tbody>
      </table></div></div>`;
    },
    mount(ctx) {
      document.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => {
        const code = b.dataset.lock;
        const t = repTenant(ctx.bid, code);
        const on = t && t.ttlock;
        const items = [];
        if (t) items.push({ icon: on ? '🔓' : '🔒', label: on ? 'Ngắt kết nối khóa' : 'Kết nối khóa TTLock',
          onClick: () => { t.ttlock = !t.ttlock; S.persist(); UI.toast(t.ttlock ? 'Đã kết nối khóa' : 'Đã ngắt kết nối', { type: 'ok' }); HH.router.render(); } });
        items.push({ icon: '🔢', label: 'Cấp mã mở cửa mới', onClick: () => {
          lockCodes[code] = String(Math.floor(100000 + Math.random() * 900000));
          UI.toast(`Mã mở cửa phòng ${code}: ${lockCodes[code]}`, { type: 'ok', sticky: true }); HH.router.render();
        } });
        if (lockCodes[code]) items.push({ icon: '🗑', label: 'Thu hồi mã', danger: true,
          onClick: () => { delete lockCodes[code]; UI.toast('Đã thu hồi mã', { type: 'ok' }); HH.router.render(); } });
        UI.openMenu(b, items);
      });
    },
  };

  /* ---------------- CẤU HÌNH TÒA NHÀ ---------------- */
  HH.pages.buildingConfig = {
    render(ctx) {
      const b = ctx.building;
      const types = Object.entries(S.ROOM_TYPES).map(([k, v]) =>
        `<tr><td><b>${v.label}</b></td><td class="num mono">${U.currency(v.price)}</td><td class="num">${v.area} m²</td><td class="num">${v.max} người</td></tr>`).join('');
      const rooms = S.roomsOf(ctx.bid);
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">⚙️</span>
          <div><div class="page-title-lg">Cấu hình tòa nhà</div><div class="page-sub">${b.name}</div></div></div>
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card"><div class="card-head"><h3>Thông tin tòa nhà</h3></div><div class="card-pad">
          <div class="field"><label>Tên tòa nhà</label><input class="input" id="bName" value="${U.esc(b.name)}"></div>
          <div class="field" style="margin-top:12px"><label>Địa chỉ</label><input class="input" id="bAddr" value="${U.esc(b.address || '')}"></div>
          <div class="grid-2" style="margin-top:12px">
            <div class="field"><label>Số tầng</label><input class="input mono" id="bFloors" value="${b.floors || 1}"></div>
            <div><div class="field"><label>Tổng số phòng</label><div class="mono b" style="padding-top:9px">${rooms.length}</div></div></div>
          </div>
          <div style="margin-top:16px"><button class="btn btn-primary" id="saveBuilding">Lưu thay đổi</button></div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Loại phòng & đơn giá mặc định</h3></div>
          <div class="dt-scroll"><table class="dt">
            <thead><tr><th>Loại phòng</th><th class="num">Giá thuê</th><th class="num">Diện tích</th><th class="num">Sức chứa</th></tr></thead>
            <tbody>${raw(types)}</tbody></table></div>
        </div>
      </div>`;
    },
    mount(ctx) {
      document.getElementById('saveBuilding').onclick = (e) => {
        const name = document.getElementById('bName').value.trim();
        const address = document.getElementById('bAddr').value.trim();
        const floors = U.parseNum(document.getElementById('bFloors').value) || ctx.building.floors;
        if (!name) { UI.toast('Tên tòa nhà không được để trống', { type: 'error' }); return; }
        e.currentTarget.classList.add('loading');
        setTimeout(() => {
          S.updateBuilding(ctx.bid, { name, address, floors });
          S.log('building.update', `Cập nhật cấu hình tòa nhà ${name}`);
          UI.toast('Đã lưu cấu hình tòa nhà', { type: 'ok' });
          HH.router.render();
        }, 300);
      };
    },
  };
})();

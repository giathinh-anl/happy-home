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

  /* ---------------- THU CHI ---------------- */
  const TX_CATS = {
    income: ['Tiền thuê', 'Tiền cọc', 'Tiền dịch vụ', 'Thu khác'],
    expense: ['Sửa chữa', 'Điện nước chung', 'Lương nhân viên', 'Vệ sinh', 'Thuế/phí', 'Chi khác'],
  };

  HH.pages.expenses = {
    render(ctx) {
      const txs = S.transactionsOf(ctx.bid).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const income = txs.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
      const profit = income - expense;
      const rows = txs.map(t => `<tr>
        <td class="mono">${U.fmtDate(t.date)}</td>
        <td>${t.kind === 'income' ? '<span class="badge s-success"><span class="dot"></span>Thu</span>' : '<span class="badge s-danger"><span class="dot"></span>Chi</span>'}</td>
        <td>${U.esc(t.category || '')}</td>
        <td class="muted">${U.esc(t.note || '')}</td>
        <td class="num mono b" style="color:${t.kind === 'income' ? 'var(--success)' : 'var(--danger)'}">${t.kind === 'income' ? '+' : '−'}${U.currency(t.amount)}</td>
        <td class="col-actions"><button class="kebab" data-txdel="${t.id}">⋯</button></td>
      </tr>`).join('');
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">📊</span>
          <div><div class="page-title-lg">Thu chi</div><div class="page-sub">${ctx.building.name} · ${txs.length} khoản</div></div></div>
        <div class="page-actions">
          <button class="btn btn-success" id="addIncome">＋ Khoản thu</button>
          <button class="btn btn-danger" id="addExpense">＋ Khoản chi</button>
        </div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);max-width:760px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Tổng thu', value: income, format: 'currency', intent: 'success' }))}
        ${raw(UI.metricCard({ label: 'Tổng chi', value: expense, format: 'currency', intent: 'danger' }))}
        ${raw(UI.metricCard({ label: 'Chênh lệch (lợi nhuận)', value: profit, format: 'currency', intent: profit >= 0 ? 'success' : 'danger' }))}
      </div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Ngày</th><th>Loại</th><th>Hạng mục</th><th>Ghi chú</th><th class="num">Số tiền</th><th></th></tr></thead>
        <tbody>${raw(rows || `<tr><td colspan="6"><div class="empty"><div class="ic">📊</div><h4>Chưa có khoản thu chi nào</h4><p class="muted">Bấm "Khoản thu" hoặc "Khoản chi" để ghi nhận.</p></div></td></tr>`)}</tbody>
      </table></div></div>`;
    },
    mount(ctx) {
      const inc = document.getElementById('addIncome'); if (inc) inc.onclick = () => txForm(ctx, 'income');
      const exp = document.getElementById('addExpense'); if (exp) exp.onclick = () => txForm(ctx, 'expense');
      document.querySelectorAll('[data-txdel]').forEach(b => b.onclick = () => {
        UI.openMenu(b, [{ icon: '🗑', label: 'Xóa khoản này', danger: true, onClick: () => {
          S.removeTransaction(b.dataset.txdel); UI.toast('Đã xóa', { type: 'ok' }); HH.router.render(); } }]);
      });
    },
  };

  function txForm(ctx, kind) {
    const cats = TX_CATS[kind];
    UI.modal({
      title: kind === 'income' ? 'Thêm khoản thu' : 'Thêm khoản chi',
      bodyHtml: h`
        <div class="grid-2">
          <div class="field"><label>Hạng mục</label><select class="select" id="txCat">${raw(cats.map(c => `<option>${c}</option>`).join(''))}</select></div>
          <div class="field"><label>Ngày</label><input class="input" type="date" id="txDate" value="2026-08-13"></div>
        </div>
        <div class="field" style="margin-top:12px"><label>Số tiền (₫)</label><input class="input money" id="txAmount" placeholder="0"></div>
        <div class="field" style="margin-top:12px"><label>Ghi chú</label><input class="input" id="txNote" placeholder="Mô tả ngắn"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn ${kind === 'income' ? 'btn-success' : 'btn-danger'}" id="txSave">Ghi nhận</button>`,
      onMount(el, close) {
        const amt = el.querySelector('#txAmount');
        amt.oninput = () => { const n = U.parseNum(amt.value); amt.value = n ? U.number(n) : ''; };
        el.querySelector('#txSave').onclick = (e) => {
          const amount = U.parseNum(amt.value);
          if (!amount) { UI.toast('Nhập số tiền hợp lệ', { type: 'error' }); return; }
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            S.addTransaction({ id: U.uid('tx'), buildingId: ctx.bid, kind,
              category: el.querySelector('#txCat').value, amount,
              date: new Date(el.querySelector('#txDate').value).toISOString(),
              note: el.querySelector('#txNote').value.trim() });
            S.log('tx.add', `${kind === 'income' ? 'Thu' : 'Chi'} ${U.currency(amount)}`);
            close(); UI.toast('Đã ghi nhận', { type: 'ok' }); HH.router.render();
          }, 300);
        };
      },
    });
  }

  /* ---------------- KHÁCH CHUYỂN KHOẢN ---------------- */
  HH.pages.transfers = {
    render() {
      const rows = [];
      S.buildings.forEach(b => {
        S.paymentsAll().filter(p => p.buildingId === b.id && (p.method || '').includes('Chuyển khoản')).forEach(p => {
          const inv = S.invoice(p.invoiceId);
          rows.push({ p, b, inv });
        });
      });
      rows.sort((a, b) => (b.p.date || '').localeCompare(a.p.date || ''));
      const total = rows.reduce((s, r) => s + r.p.amount, 0);
      const trs = rows.map(r => `<tr>
        <td class="mono">${U.fmtDate(r.p.date)}</td>
        <td>${r.b.name}</td>
        <td>${r.inv ? r.inv.roomCode : '—'}</td>
        <td>${r.inv ? r.inv.tenantName : '—'}</td>
        <td class="mono">${r.p.invoiceId || '—'}</td>
        <td class="num mono b">${U.currency(r.p.amount)}</td>
        <td><span class="badge s-success"><span class="dot"></span>Đã khớp</span></td>
      </tr>`).join('');
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">💳</span>
          <div><div class="page-title-lg">Khách chuyển khoản</div><div class="page-sub">Đối soát các thanh toán chuyển khoản · ${rows.length} giao dịch</div></div></div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(2,1fr);max-width:520px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Tổng đã nhận (chuyển khoản)', value: total, format: 'currency', intent: 'success' }))}
        ${raw(UI.metricCard({ label: 'Số giao dịch', value: rows.length, format: 'number' }))}
      </div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Ngày</th><th>Tòa nhà</th><th>Phòng</th><th>Khách</th><th>Mã HĐ</th><th class="num">Số tiền</th><th>Trạng thái</th></tr></thead>
        <tbody>${raw(trs || `<tr><td colspan="7"><div class="empty"><div class="ic">💳</div><h4>Chưa có giao dịch chuyển khoản</h4></div></td></tr>`)}</tbody>
      </table></div></div>`;
    },
  };

  /* ---------------- ĐĂNG TIN ---------------- */
  HH.pages.post = {
    render() {
      const cards = [];
      S.buildings.forEach(b => {
        S.roomsOf(b.id).filter(r => r.status === 'vacant').forEach(r => {
          const text = `[CHO THUÊ] ${r.typeLabel} ${r.code} - ${b.name}\nGiá: ${U.currency(r.price)}/tháng · Diện tích: ${r.area}m² · Tối đa ${r.maxOccupants} người\nĐịa chỉ: ${b.address || ''}\nLiên hệ để xem phòng!`;
          cards.push(`<div class="card card-pad">
            <div class="between"><h3>${r.code} · ${b.name}</h3><span class="badge s-success"><span class="dot"></span>Trống</span></div>
            <div class="mono b text-lg" style="color:var(--brand-700);margin:6px 0">${U.currency(r.price)}/tháng</div>
            <div class="muted text-sm">${r.typeLabel} · ${r.area}m² · tối đa ${r.maxOccupants} người</div>
            <div class="muted text-xs" style="margin:6px 0">${b.address || ''}</div>
            <button class="btn btn-outline btn-sm" data-copy="${encodeURIComponent(text)}">📋 Sao chép tin đăng</button>
          </div>`);
        });
      });
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">📢</span>
          <div><div class="page-title-lg">Đăng tin cho thuê</div><div class="page-sub">Phòng trống sẵn sàng cho thuê · ${cards.length} phòng</div></div></div>
      </div>
      ${raw(cards.length ? `<div class="grid-3">${cards.join('')}</div>` : `<div class="card"><div class="empty"><div class="ic">📢</div><h4>Không có phòng trống</h4><p class="muted">Tất cả phòng đang được thuê hoặc giữ chỗ.</p></div></div>`)}`;
    },
    mount() {
      document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => {
        const text = decodeURIComponent(b.dataset.copy);
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.toast('Đã sao chép tin đăng', { type: 'ok' }), () => UI.toast('Không sao chép được', { type: 'error' }));
        else UI.toast('Trình duyệt không hỗ trợ sao chép', { type: 'error' });
      });
    },
  };

  /* ---------------- CÔNG TY / NHÓM ---------------- */
  HH.pages.group = {
    render() {
      const rooms = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).length, 0);
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">🧑‍🤝‍🧑</span>
          <div><div class="page-title-lg">Công ty / nhóm</div><div class="page-sub">Thông tin tổ chức & thành viên</div></div></div>
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card"><div class="card-head"><h3>Thông tin công ty</h3></div><div class="card-pad">
          <div class="field"><label>Tên công ty</label><div class="b">Happy Home</div></div>
          <div class="field" style="margin-top:12px"><label>Gói dịch vụ</label><div><span class="badge s-info"><span class="dot"></span>Free</span></div></div>
          <div class="field" style="margin-top:12px"><label>Quy mô</label><div>${S.buildings.length} tòa nhà · ${rooms} phòng</div></div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Thành viên</h3></div>
          <div class="dt-scroll"><table class="dt">
            <thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th></tr></thead>
            <tbody>
              <tr><td><div class="row-gap-2"><span class="avatar" style="width:30px;height:30px;flex:0 0 30px;font-size:12px">${U.initials(S.prefs.userName)}</span><b>${U.esc(S.prefs.userName)}</b></div></td>
                <td><span class="badge s-purple"><span class="dot"></span>Chủ trọ</span></td><td><span class="badge s-success"><span class="dot"></span>Đang hoạt động</span></td></tr>
            </tbody></table></div>
          <div class="card-pad"><button class="btn btn-outline" id="inviteBtn">＋ Mời nhân viên</button></div>
        </div>
      </div>`;
    },
    mount() {
      const b = document.getElementById('inviteBtn');
      if (b) b.onclick = () => UI.toast('Tính năng mời nhân viên sẽ có ở bản kế tiếp', { type: 'ok' });
    },
  };

  /* ---------------- CÀI ĐẶT CHUNG ---------------- */
  HH.pages.companyConfig = {
    render() {
      return h`<div class="page-head">
        <div class="row-gap-3"><span class="lz-home-ic">⚙️</span>
          <div><div class="page-title-lg">Cài đặt chung</div><div class="page-sub">Thiết lập tài khoản & ứng dụng</div></div></div>
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card"><div class="card-head"><h3>Tài khoản</h3></div><div class="card-pad">
          <div class="field"><label>Tên hiển thị</label><input class="input" id="cfgName" value="${U.esc(S.prefs.userName)}"></div>
          <div style="margin-top:16px"><button class="btn btn-primary" id="cfgSave">Lưu</button></div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Dữ liệu & ứng dụng</h3></div><div class="card-pad">
          <div class="field"><label>Chế độ lưu trữ</label><div>${raw(S.usingBackend() ? '<span class="badge s-success"><span class="dot"></span>Máy chủ Supabase</span>' : '<span class="badge s-warning"><span class="dot"></span>Cục bộ (trình duyệt)</span>')}</div></div>
          <div class="field" style="margin-top:12px"><label>Phiên bản</label><div class="mono">Happy Home v1.0</div></div>
          <div style="margin-top:16px"><button class="btn btn-outline" id="cfgReset" style="color:var(--danger)">↺ Khôi phục dữ liệu mẫu</button></div>
        </div></div>
      </div>`;
    },
    mount() {
      document.getElementById('cfgSave').onclick = () => {
        const name = document.getElementById('cfgName').value.trim();
        if (name) { S.setPref('userName', name); UI.toast('Đã lưu', { type: 'ok' }); HH.router.render(); }
      };
      document.getElementById('cfgReset').onclick = () => {
        UI.modal({ title: 'Khôi phục dữ liệu mẫu', bodyHtml: '<p class="muted">Xóa toàn bộ thay đổi và nạp lại dữ liệu mẫu ban đầu. Không thể hoàn tác.</p>',
          footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-danger" id="doReset">Khôi phục</button>',
          onMount(el) { el.querySelector('#doReset').onclick = () => S.resetData(); } });
      };
    },
  };
})();

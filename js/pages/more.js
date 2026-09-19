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
        : `<div class="empty"><div class="ic">${HH.ic('check', 30)}</div><h4>Không có thông báo nào</h4><p class="muted">Mọi việc đang được xử lý tốt.</p></div>`;
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Thông báo</div><div class="page-sub">Việc cần xử lý trên toàn hệ thống · ${items.length} mục</div></div></div>
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
          <td>${t ? t.fullName : '<span class="faint">-</span>'}</td>
          <td><span class="tn-ttlock ${on ? 'on' : ''}">${on ? '' + HH.ic('lock', 16) + ' Đã kết nối' : '' + HH.ic('unlock', 16) + ' Chưa kết nối'}</span></td>
          <td class="mono">${code ? `<b>${code}</b>` : '<span class="faint">-</span>'}</td>
          <td class="col-actions"><button class="kebab" data-lock="${r.code}">⋯</button></td>
        </tr>`;
      }).join('');
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Khóa thông minh</div>
          <div class="page-sub">${ctx.building.name} · đã kết nối ${connected}/${rooms.length} phòng</div></div></div>
      </div>
      <div class="alert alert-info" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
        <div>Quản lý khóa TTLock của từng phòng. Cấp mã mở cửa cho khách khi cần.</div></div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Phòng</th><th>Khách đại diện</th><th>Trạng thái khóa</th><th>Mã mở cửa</th><th></th></tr></thead>
        <tbody>${raw(rows || `<tr><td colspan="5"><div class="empty"><div class="ic">${HH.ic('lock', 30)}</div><h4>Chưa có phòng đang thuê</h4></div></td></tr>`)}</tbody>
      </table></div></div>`;
    },
    mount(ctx) {
      document.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => {
        const code = b.dataset.lock;
        const t = repTenant(ctx.bid, code);
        const on = t && t.ttlock;
        const items = [];
        if (t) items.push({ icon: on ? HH.ic('unlock', 16) : HH.ic('lock', 16), label: on ? 'Ngắt kết nối khóa' : 'Kết nối khóa TTLock',
          onClick: () => { t.ttlock = !t.ttlock; S.persist(); UI.toast(t.ttlock ? 'Đã kết nối khóa' : 'Đã ngắt kết nối', { type: 'ok' }); HH.router.render(); } });
        items.push({ icon: HH.ic('key', 16), label: 'Cấp mã mở cửa mới', onClick: () => {
          lockCodes[code] = String(Math.floor(100000 + Math.random() * 900000));
          UI.toast(`Mã mở cửa phòng ${code}: ${lockCodes[code]}`, { type: 'ok', sticky: true }); HH.router.render();
        } });
        if (lockCodes[code]) items.push({ icon: HH.ic('trash', 16), label: 'Thu hồi mã', danger: true,
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
        <div><div><div class="page-title-lg">Cấu hình tòa nhà</div><div class="page-sub">${b.name}</div></div></div>
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
      </div>
      <div class="card" style="border-color:#fecaca;margin-top:16px;max-width:520px"><div class="card-pad">
        <h3 style="color:var(--danger)">Vùng nguy hiểm</h3>
        <p class="muted text-sm" style="margin:6px 0 12px">Xóa tòa nhà sẽ xóa vĩnh viễn toàn bộ phòng, khách thuê, hợp đồng, hóa đơn… của tòa này.</p>
        <button class="btn btn-danger" id="delBuilding">${HH.ic('trash', 16)} Xóa tòa nhà này</button>
      </div></div>`;
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
      document.getElementById('delBuilding').onclick = () => {
        UI.dangerDialog({
          title: `Xóa tòa nhà "${ctx.building.name}"`,
          description: 'Toàn bộ phòng, khách thuê, hợp đồng, hóa đơn, thanh toán… của tòa này sẽ bị xóa vĩnh viễn.',
          consequences: ['Không thể hoàn tác', 'Dữ liệu bị xóa cả trên máy chủ', 'Thao tác được ghi vào nhật ký'],
          confirmLabel: 'Xóa tòa nhà', reasonLabel: 'Lý do xóa',
          onConfirm: async () => {
            await S.removeBuilding(ctx.bid);
            UI.toast('Đã xóa tòa nhà', { type: 'ok' });
            HH.router.go('/buildings');
          },
        });
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
        <div><div><div class="page-title-lg">Thu chi</div><div class="page-sub">${ctx.building.name} · ${txs.length} khoản</div></div></div>
        <div class="page-actions">
          <button class="btn btn-success" id="addIncome">${HH.ic('plus', 16)} Khoản thu</button>
          <button class="btn btn-danger" id="addExpense">${HH.ic('plus', 16)} Khoản chi</button>
        </div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);max-width:760px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Tổng thu', value: income, format: 'currency', intent: 'success' }))}
        ${raw(UI.metricCard({ label: 'Tổng chi', value: expense, format: 'currency', intent: 'danger' }))}
        ${raw(UI.metricCard({ label: 'Chênh lệch (lợi nhuận)', value: profit, format: 'currency', intent: profit >= 0 ? 'success' : 'danger' }))}
      </div>
      <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Ngày</th><th>Loại</th><th>Hạng mục</th><th>Ghi chú</th><th class="num">Số tiền</th><th></th></tr></thead>
        <tbody>${raw(rows || `<tr><td colspan="6"><div class="empty"><div class="ic">${HH.ic('sheet', 30)}</div><h4>Chưa có khoản thu chi nào</h4><p class="muted">Bấm "Khoản thu" hoặc "Khoản chi" để ghi nhận.</p></div></td></tr>`)}</tbody>
      </table></div></div>`;
    },
    mount(ctx) {
      const inc = document.getElementById('addIncome'); if (inc) inc.onclick = () => txForm(ctx, 'income');
      const exp = document.getElementById('addExpense'); if (exp) exp.onclick = () => txForm(ctx, 'expense');
      document.querySelectorAll('[data-txdel]').forEach(b => b.onclick = () => {
        UI.openMenu(b, [{ icon: HH.ic('trash', 16), label: 'Xóa khoản này', danger: true, onClick: () => {
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

  /* ---------------- KHÁCH CHUYỂN KHOẢN & ĐỐI SOÁT NGÂN HÀNG ---------------- */
  const trTab = { tab: 'claims' };

  HH.pages.transfers = {
    render() {
      const rows = [];
      S.buildings.forEach(b => {
        S.paymentsAll().filter(p => p.buildingId === b.id && (p.method || '').includes('Chuyển khoản')).forEach(p => {
          rows.push({ p, b, inv: S.invoice(p.invoiceId) });
        });
      });
      rows.sort((a, b) => (b.p.date || '').localeCompare(a.p.date || ''));
      const total = rows.reduce((s, r) => s + r.p.amount, 0);
      const autoCount = rows.filter(r => r.p.auto).length;
      const pending = S.claimsOf(null, 'pending').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const waiting = S.unhandledBankTx();

      const tabs = `<div class="view-toggle" style="margin-bottom:16px">
        <button data-trtab="claims" class="${trTab.tab === 'claims' ? 'active' : ''}">
          Khách báo chuyển khoản${pending.length ? ` (${pending.length})` : ''}</button>
        <button data-trtab="bank" class="${trTab.tab === 'bank' ? 'active' : ''}">
          Đối soát ngân hàng${waiting.length ? ` (${waiting.length})` : ''}</button>
        <button data-trtab="done" class="${trTab.tab === 'done' ? 'active' : ''}">Đã ghi thu (${rows.length})</button>
      </div>`;

      const body = trTab.tab === 'claims' ? claimsTab(pending)
        : trTab.tab === 'bank' ? bankTab(waiting) : doneTab(rows);

      return h`<div class="page-head">
        <div><div class="page-title-lg">Khách chuyển khoản</div>
          <div class="page-sub">${pending.length} phiếu chờ duyệt, ${rows.length} giao dịch đã ghi thu</div></div>
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(4,1fr);max-width:1000px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Phiếu khách báo · chờ duyệt', value: pending.length, format: 'number', intent: pending.length ? 'warning' : 'default' }))}
        ${raw(UI.metricCard({ label: 'Giao dịch NH chờ đối soát', value: waiting.length, format: 'number', intent: waiting.length ? 'warning' : 'default' }))}
        ${raw(UI.metricCard({ label: 'Tổng đã nhận qua CK', value: total, format: 'currency', intent: 'success' }))}
        ${raw(UI.metricCard({ label: 'Tự động ghi thu', value: autoCount, format: 'number' }))}
      </div>
      ${raw(tabs)}
      ${raw(body)}`;
    },

    mount() {
      document.querySelectorAll('[data-trtab]').forEach(b => b.onclick = () => {
        trTab.tab = b.dataset.trtab; HH.router.render();
      });

      // --- Phiếu khách báo đã chuyển khoản ---
      document.querySelectorAll('[data-okclaim]').forEach(b => b.onclick = () => {
        const c = S.claim(b.dataset.okclaim); if (!c) return;
        const inv = S.invoice(c.invoiceId);
        if (!inv) { UI.toast('Không tìm thấy hóa đơn của phiếu này', { type: 'error' }); return; }
        const p = S.recordPayment(inv.id, Math.min(c.amount, inv.total - inv.paid),
          'Chuyển khoản', new Date().toISOString(), c.note || 'Khách báo chuyển khoản');
        S.updateClaim(c.id, { status: 'confirmed' });
        UI.toast(`Đã ghi thu ${U.currency(p ? p.amount : c.amount)} · phiếu ${p ? p.receiptNo : ''}`, { type: 'ok' });
        HH.router.render();
      });
      document.querySelectorAll('[data-noclaim]').forEach(b => b.onclick = () => {
        UI.dangerDialog({ title: 'Từ chối phiếu chuyển khoản',
          description: 'Phiếu sẽ được đánh dấu không hợp lệ. Công nợ của khách giữ nguyên.',
          consequences: ['Không ghi nhận khoản thu nào', 'Thao tác được ghi vào nhật ký'],
          confirmLabel: 'Từ chối phiếu', reasonLabel: 'Lý do từ chối',
          onConfirm: (reason) => {
            S.updateClaim(b.dataset.noclaim, { status: 'rejected', rejectReason: reason });
            S.log('claim.reject', `Từ chối phiếu chuyển khoản ${b.dataset.noclaim}`, reason);
            UI.toast('Đã từ chối phiếu', { type: 'ok' }); HH.router.render();
          } });
      });
      document.querySelectorAll('[data-zoom]').forEach(img => img.onclick = () => {
        UI.modal({ title: 'Ảnh chứng từ', size: 'wide',
          bodyHtml: `<img src="${img.src}" style="width:100%;border-radius:10px">`,
          footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` });
      });

      // --- Đối soát ngân hàng ---
      const paste = document.getElementById('btnPaste');
      if (paste) paste.onclick = () => pasteStatementDialog();
      const hook = document.getElementById('btnHook');
      if (hook) hook.onclick = () => webhookDialog();
      const runAll = document.getElementById('btnRunAll');
      if (runAll) runAll.onclick = () => {
        const r = S.autoReconcile();
        if (r.done.length) UI.toast(`Đã tự động ghi thu ${r.done.length} giao dịch. Công nợ tương ứng đã xóa.`, { type: 'ok' });
        else UI.toast(r.review.length ? 'Không có giao dịch nào khớp chắc chắn. Xem cột "Kết quả dò".' : 'Không có giao dịch mới',
          { type: r.review.length ? 'warning' : 'info' });
        HH.router.render();
      };
      document.querySelectorAll('[data-btapply]').forEach(b => b.onclick = () => {
        const tx = S.bankTx.find(x => x.id === b.dataset.btapply);
        if (tx) pickInvoiceDialog(tx);
      });
      document.querySelectorAll('[data-btdel]').forEach(b => b.onclick = () => {
        S.removeBankTx(b.dataset.btdel); UI.toast('Đã bỏ giao dịch', { type: 'ok' }); HH.router.render();
      });
    },
  };

  function claimsTab(pending) {
    if (!pending.length) return `<div class="card"><div class="empty" style="padding:32px">
      <div class="ic">${HH.icon('check', 26)}</div><h4>Không có phiếu nào chờ duyệt</h4>
      <p class="muted">Khách bấm "Tôi đã chuyển khoản" trong app thì phiếu sẽ hiện ở đây.</p></div></div>`;
    return `<div class="claim-grid">${pending.map(c => `<div class="claim-card">
      <div class="claim-info">
        <div class="between" style="margin-bottom:6px">
          <b>${U.esc(c.tenantName || '')} · Phòng ${U.esc(c.roomCode || '')}</b>
          <span class="badge s-warning"><span class="dot"></span>Chờ đối soát</span></div>
        <div class="mono b text-lg" style="color:var(--brand-700)">${U.currency(c.amount)}</div>
        <div class="muted text-sm">Hóa đơn <b class="mono">${U.esc(c.invoiceId || '-')}</b> · báo lúc ${U.fmtDate(c.createdAt)}</div>
        ${c.note ? `<div class="muted text-sm" style="margin-top:4px">"${U.esc(c.note)}"</div>` : ''}
        <div class="row-gap-2" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" data-okclaim="${c.id}">${HH.icon('check', 15)} Xác nhận & ghi thu</button>
          <button class="btn btn-outline btn-sm" data-noclaim="${c.id}">${HH.icon('x', 15)} Từ chối</button>
        </div>
      </div>
      <div class="claim-proof">${c.photo
        ? `<img src="${c.photo}" alt="Chứng từ" data-zoom="${c.id}">`
        : `<div class="no-proof">${HH.icon('camera', 22)}<span>Không có ảnh</span></div>`}</div>
    </div>`).join('')}</div>`;
  }

  function bankTab(waiting) {
    const preview = S.autoReconcile({ dryRun: true });
    const okIds = new Set(preview.done.map(x => x.tx.id));
    const trs = waiting.map(t => {
      const m = S.matchTransfer(t);
      const ok = okIds.has(t.id);
      return `<tr>
        <td class="mono nowrap">${U.fmtDate(t.date)}</td>
        <td class="mono">${U.esc(t.content || '')}</td>
        <td class="num mono b">${U.currency(t.amount)}</td>
        <td>${ok
          ? `<span class="badge s-success"><span class="dot"></span>Khớp ${U.esc(m.invoice.roomCode)} · ${S.periodLabel(m.invoice.period)}</span>`
          : `<span class="badge ${m.status === 'ambiguous' ? 's-warning' : 's-neutral'}"><span class="dot"></span>${m.status === 'ambiguous' ? 'Chưa chắc' : 'Không khớp'}</span>`}
          <div class="muted text-xs" style="margin-top:3px">${U.esc(m.reason || '')}</div></td>
        <td class="col-actions nowrap">
          <button class="btn btn-outline btn-sm" data-btapply="${t.id}">Chọn hóa đơn</button>
          <button class="kebab" data-btdel="${t.id}" title="Bỏ giao dịch">${HH.icon('trash', 15)}</button></td>
      </tr>`;
    }).join('');

    return `<div class="card" style="margin-bottom:16px"><div class="card-pad">
      <div class="between" style="flex-wrap:wrap;gap:12px">
        <div>
          <b>Tiền về là tự xóa công nợ</b>
          <div class="muted text-sm" style="margin-top:4px;max-width:620px">
            App đọc <b>nội dung chuyển khoản</b> để tìm đúng hóa đơn rồi ghi thu. Hóa đơn chuyển sang
            <b>Đã thu</b> và công nợ biến mất. Khách quét mã VietQR trong app khách thuê thì nội dung
            luôn đúng dạng <span class="mono">HD2608013</span> nên gần như khớp 100%.</div>
        </div>
        <div class="row-gap-2">
          <button class="btn btn-outline" id="btnHook">${HH.icon('bolt', 16)} Nối ngân hàng</button>
          <button class="btn btn-outline" id="btnPaste">${HH.icon('sheet', 16)} Dán sao kê</button>
          <button class="btn btn-primary" id="btnRunAll">${HH.icon('refresh', 16)} Chạy đối soát</button>
        </div>
      </div></div></div>
      ${waiting.length ? `<div class="dt-wrap"><div class="dt-scroll"><table class="dt">
        <thead><tr><th>Ngày</th><th>Nội dung chuyển khoản</th><th class="num">Số tiền</th><th>Kết quả dò</th><th></th></tr></thead>
        <tbody>${trs}</tbody></table></div></div>`
      : `<div class="card"><div class="empty" style="padding:32px">
          <div class="ic">${HH.icon('bank', 26)}</div><h4>Chưa có giao dịch ngân hàng nào chờ</h4>
          <p class="muted">Bấm <b>Nối ngân hàng</b> để tiền về là tự vào đây, hoặc <b>Dán sao kê</b> để đối soát thủ công.</p></div></div>`}`;
  }

  function doneTab(rows) {
    const trs = rows.map(r => `<tr>
      <td class="mono nowrap">${U.fmtDate(r.p.date)}</td>
      <td>${U.esc(r.b.name)}</td>
      <td>${r.inv ? U.esc(r.inv.roomCode) : '-'}</td>
      <td>${r.inv ? U.esc(r.inv.tenantName || '') : '-'}</td>
      <td class="mono">${U.esc(r.p.invoiceId || '-')}</td>
      <td class="num mono b">${U.currency(r.p.amount)}</td>
      <td>${r.p.auto
        ? '<span class="badge s-purple"><span class="dot"></span>Tự động</span>'
        : '<span class="badge s-success"><span class="dot"></span>Thủ công</span>'}</td>
    </tr>`).join('');
    return `<div class="dt-wrap"><div class="dt-scroll"><table class="dt">
      <thead><tr><th>Ngày</th><th>Tòa nhà</th><th>Phòng</th><th>Khách</th><th>Mã HĐ</th><th class="num">Số tiền</th><th>Cách ghi</th></tr></thead>
      <tbody>${trs || `<tr><td colspan="7"><div class="empty"><div class="ic">${HH.icon('card', 26)}</div><h4>Chưa có giao dịch chuyển khoản</h4></div></td></tr>`}</tbody>
    </table></div></div>`;
  }

  /* Dán sao kê ngân hàng -> tách giao dịch -> xem trước -> nạp vào hàng chờ */
  function pasteStatementDialog() {
    UI.modal({
      size: 'wide', title: 'Dán sao kê ngân hàng',
      bodyHtml: h`<p class="muted text-sm" style="margin-bottom:10px">
          Mở app/web ngân hàng, sao chép các dòng giao dịch <b>tiền vào</b> rồi dán xuống dưới.
          Mỗi dòng một giao dịch, app tự tách ngày, số tiền và nội dung.</p>
        <textarea class="textarea" id="stText" style="min-height:180px;font-family:var(--font-mono);font-size:13px"
          placeholder="03/09/2026  HD2608013 CHUYEN TIEN  3.943.000&#10;03/09/2026  P205 T8 2026  4.321.000"></textarea>
        <div id="stPreview" style="margin-top:12px"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span>
        <button class="btn btn-primary" id="stAdd" disabled>Nạp vào hàng chờ</button>`,
      onMount(el, close) {
        const ta = el.querySelector('#stText'), pv = el.querySelector('#stPreview'), add = el.querySelector('#stAdd');
        let parsed = [];
        const refresh = () => {
          parsed = S.parseStatement(ta.value);
          add.disabled = !parsed.length;
          if (!parsed.length) { pv.innerHTML = `<div class="muted text-sm">Chưa nhận ra giao dịch nào.</div>`; return; }
          let okN = 0;
          const trs = parsed.map(t => {
            const m = S.matchTransfer(t);
            if (m.status === 'matched') okN++;
            return `<tr><td class="mono nowrap">${U.fmtDate(t.date)}</td>
              <td class="mono">${U.esc(t.content)}</td>
              <td class="num mono b">${U.currency(t.amount)}</td>
              <td>${m.status === 'matched'
                ? `<span class="badge s-success"><span class="dot"></span>${U.esc(m.invoice.roomCode)} · ${S.periodLabel(m.invoice.period)}</span>`
                : `<span class="badge s-warning"><span class="dot"></span>${m.status === 'ambiguous' ? 'Chưa chắc' : 'Không khớp'}</span>`}</td></tr>`;
          }).join('');
          pv.innerHTML = `<div class="muted text-sm" style="margin-bottom:6px">
              Nhận ra <b>${parsed.length}</b> giao dịch · <b style="color:var(--success)">${okN}</b> khớp chắc chắn</div>
            <div class="dt-scroll" style="max-height:210px"><table class="dt">
            <thead><tr><th>Ngày</th><th>Nội dung</th><th class="num">Số tiền</th><th>Dò được</th></tr></thead>
            <tbody>${trs}</tbody></table></div>`;
        };
        ta.oninput = U.debounce(refresh, 250);
        refresh();
        add.onclick = () => {
          let n = 0; parsed.forEach(t => { if (S.addBankTx(t)) n++; });
          close();
          const r = S.autoReconcile();
          UI.toast(`Đã nạp ${n} giao dịch, tự ghi thu ${r.done.length}${r.review.length ? `, ${r.review.length} cần kiểm tra` : ''}.`,
            { type: 'ok', sticky: true });
          trTab.tab = 'bank'; HH.router.render();
        };
      },
    });
  }

  /* Giao dịch không tự khớp -> chủ trọ chọn hóa đơn thủ công */
  function pickInvoiceDialog(tx) {
    const open = [];
    S.buildings.forEach(b => S.invoicesOf(b.id)
      .filter(i => i.status !== 'cancelled' && i.status !== 'draft' && i.total > i.paid)
      .forEach(i => open.push({ i, b })));
    open.sort((a, b) => (a.i.period + a.i.roomCode).localeCompare(b.i.period + b.i.roomCode));
    if (!open.length) { UI.toast('Không còn hóa đơn nào chưa thu', { type: 'warning' }); return; }
    UI.modal({
      size: 'wide', title: 'Chọn hóa đơn cho giao dịch này',
      bodyHtml: h`<div class="alert alert-info" style="margin-bottom:12px"><span class="ic">i</span><div>
          <b class="mono">${U.currency(tx.amount)}</b> · ${U.fmtDate(tx.date)}<br>
          Nội dung: <span class="mono">${tx.content || '(trống)'}</span></div></div>
        <div class="field"><label>Tìm nhanh</label>
          <input class="input" id="piQ" placeholder="Gõ mã phòng, tên khách hoặc mã hóa đơn..."></div>
        <div class="dt-scroll" style="max-height:280px;margin-top:10px"><table class="dt">
          <thead><tr><th>Mã HĐ</th><th>Phòng</th><th>Khách</th><th>Kỳ</th><th class="num">Còn nợ</th><th></th></tr></thead>
          <tbody id="piRows"></tbody></table></div>`,
      footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>`,
      onMount(el, close) {
        const q = el.querySelector('#piQ'), tb = el.querySelector('#piRows');
        const draw = () => {
          const k = q.value.trim().toLowerCase();
          const list = open.filter(({ i, b }) => !k ||
            (i.id + ' ' + i.roomCode + ' ' + (i.tenantName || '') + ' ' + b.name).toLowerCase().includes(k));
          tb.innerHTML = list.slice(0, 40).map(({ i, b }) => `<tr>
            <td class="mono">${U.esc(i.id)}</td>
            <td><b>${U.esc(i.roomCode)}</b><div class="muted text-xs">${U.esc(b.name)}</div></td>
            <td>${U.esc(i.tenantName || '')}</td><td class="mono">${S.periodLabel(i.period)}</td>
            <td class="num mono b">${U.currency(i.total - i.paid)}</td>
            <td class="col-actions"><button class="btn btn-primary btn-sm" data-pick="${U.esc(i.id)}">Ghi thu</button></td>
          </tr>`).join('') || `<tr><td colspan="6" class="muted" style="padding:16px">Không tìm thấy hóa đơn nào</td></tr>`;
          tb.querySelectorAll('[data-pick]').forEach(btn => btn.onclick = () => {
            const r = S.applyTransfer(tx, btn.dataset.pick);
            if (!r.payment) { UI.toast(r.reason || 'Không ghi thu được', { type: 'error' }); return; }
            tx.handled = true; tx.invoiceId = btn.dataset.pick; tx.paymentId = r.payment.id;
            tx.matchNote = 'Chủ trọ chọn thủ công'; S.persist();
            S.log('bank.manual', `Ghi thu thủ công ${U.currency(r.payment.amount)} cho ${btn.dataset.pick}`);
            close();
            UI.toast(`Đã ghi thu ${U.currency(r.payment.amount)} · phiếu ${r.payment.receiptNo}`
              + (r.over ? ` · dư ${U.currency(r.over)}` : ''), { type: 'ok' });
            HH.router.render();
          });
        };
        q.oninput = U.debounce(draw, 150); draw(); q.focus();
      },
    });
  }

  /* Hướng dẫn nối webhook ngân hàng để chạy hoàn toàn tự động */
  function webhookDialog() {
    const url = (window.HH_CONFIG && HH_CONFIG.supabaseUrl)
      ? HH_CONFIG.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/bank-webhook'
      : 'https://<project-ref>.supabase.co/functions/v1/bank-webhook';
    UI.modal({
      size: 'wide', title: 'Nối ngân hàng để chạy hoàn toàn tự động',
      bodyHtml: h`<p class="muted text-sm">Ngân hàng Việt Nam không mở API cho tài khoản cá nhân, nên cách chạy thật là
          dùng một dịch vụ đọc biến động số dư (<b>SePay</b>, <b>Casso</b>, đều có gói miễn phí) rồi cho nó
          bắn giao dịch về địa chỉ dưới đây. Tiền về là hóa đơn tự chuyển sang <b>Đã thu</b>.</p>
        <div class="field" style="margin-top:12px"><label>1. Địa chỉ webhook của bạn</label>
          <div class="row-gap-2"><input class="input mono" id="whUrl" readonly value="${url}">
            <button class="btn btn-outline" id="whCopy">Chép</button></div></div>
        <div class="field" style="margin-top:14px"><label>2. Mật khẩu dùng chung (secret)</label>
          <div class="row-gap-2"><input class="input mono" id="whSecret" readonly placeholder="Bấm Tạo secret →">
            <button class="btn btn-outline" id="whGen">Tạo secret</button>
            <button class="btn btn-outline" id="whSCopy">Chép</button></div>
          <span class="hint" style="display:block;margin-top:6px">Đặt chuỗi này vào biến
            <span class="mono">BANK_WEBHOOK_SECRET</span> của Edge Function. Không đưa cho ai khác.</span></div>
        <div class="field" style="margin-top:14px"><label>3. Các bước còn lại</label>
          <ol class="muted text-sm" style="padding-left:18px;line-height:1.9;margin:0">
            <li>Chạy <span class="mono">supabase/migration-bank-reconcile.sql</span> trong SQL Editor.</li>
            <li>Triển khai <span class="mono">supabase/functions/bank-webhook</span> (hướng dẫn ngay trong tệp).</li>
            <li>Vào SePay/Casso → thêm webhook → dán địa chỉ trên, chọn <b>chỉ giao dịch tiền vào</b>.</li>
            <li>Xong. Giao dịch tự hiện ở tab này và tự ghi thu nếu nội dung khớp hóa đơn.</li>
          </ol></div>
        <div class="alert alert-info" style="margin-top:14px"><span class="ic">i</span><div>
          Chưa nối được cũng không sao: bấm <b>Dán sao kê</b> để đối soát cả tháng trong vài giây,
          hoặc duyệt phiếu khách tự báo ở tab đầu tiên.</div></div>`,
      footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>`,
      onMount(el) {
        const sec = el.querySelector('#whSecret');
        el.querySelector('#whCopy').onclick = () => copyText(el.querySelector('#whUrl').value, 'địa chỉ webhook');
        el.querySelector('#whSCopy').onclick = () => sec.value
          ? copyText(sec.value, 'secret') : UI.toast('Chưa có secret. Bấm "Tạo secret" trước.', { type: 'warning' });
        el.querySelector('#whGen').onclick = async (e) => {
          if (!S.usingBackend()) { UI.toast('Cần kết nối Supabase mới tạo được secret', { type: 'error' }); return; }
          const btn = e.currentTarget; btn.classList.add('loading'); btn.disabled = true;
          const { data, error } = await HH.backend.rpc('bank_hook_secret');
          btn.classList.remove('loading'); btn.disabled = false;
          if (error) { UI.toast(/function/i.test(error.message)
            ? 'Chưa chạy migration-bank-reconcile.sql' : error.message, { type: 'error' }); return; }
          sec.value = data; UI.toast('Đã tạo secret. Nhớ chép và giữ kín.', { type: 'ok' });
        };
      },
    });
  }

  /* ---------------- ĐĂNG TIN ---------------- */
  const AMENITIES = ['Máy lạnh', 'Nóng lạnh', 'Ban công', 'Cửa sổ', 'Tủ lạnh', 'Máy giặt', 'Giường', 'Tủ quần áo', 'Bếp', 'Wifi', 'Giữ xe', 'Tự do giờ giấc'];
  const postPage = { page: 1, size: 9 };

  // Tiện nghi của phòng: nếu chủ trọ đã tự chọn thì tôn trọng đúng lựa chọn đó
  // (kể cả khi bỏ chọn hết); chưa chọn bao giờ thì lấy tạm từ danh sách tài sản.
  function roomAmenities(b, r) {
    if (r.amenitiesSet || (r.amenities && r.amenities.length)) return r.amenities || [];
    return S.assetsOf(b.id, r.code).map(a => a.name);
  }

  function listingText(b, r) {
    const am = roomAmenities(b, r);
    const lines = [
      `🏠 [CHO THUÊ] ${r.typeLabel} ${r.code} — ${b.name}`,
      ``,
      `💰 Giá thuê: ${U.currency(r.price)}/tháng`,
      `📐 Diện tích: ${r.area}m² · Tối đa ${r.maxOccupants} người`,
      `📍 Địa chỉ: ${b.address || '(đang cập nhật)'}`,
    ];
    if (am.length) lines.push(`✨ Tiện nghi: ${am.join(', ')}`);
    if (r.description) lines.push(``, r.description);
    const phone = b.contactPhone || '';
    lines.push(``, `📞 Liên hệ xem phòng${phone ? ': ' + phone : ''}`, `#chothue #phongtro #${(b.name || '').replace(/\s+/g, '')}`);
    return lines.join('\n');
  }

  HH.pages.post = {
    render() {
      const items = [];
      S.buildings.forEach(b => {
        S.roomsOf(b.id).filter(r => r.status === 'vacant' || r.status === 'cleaning').forEach(r => items.push({ b, r }));
      });
      const withPhoto = items.filter(x => (x.r.photos || []).length).length;

      const ppg = UI.paginate(items, postPage, { unit: 'tin', sizes: [9, 18, 36] });
      HH.pages.post._pg = ppg;
      const cards = ppg.items.map(({ b, r }) => {
        const photos = r.photos || [];
        const cover = photos.length
          ? `<div class="listing-cover"><img src="${photos[0]}" alt="${U.esc(r.code)}">
              ${photos.length > 1 ? `<span class="pcount">${HH.ic('camera', 16)} ${photos.length}</span>` : ''}</div>`
          : `<div class="listing-cover empty"><span>${HH.ic('camera', 16)}</span><small>Chưa có ảnh</small></div>`;
        const am = roomAmenities(b, r);
        return `<div class="card listing-card">
          ${cover}
          <div class="card-pad">
            <div class="between"><b>${r.code} · ${U.esc(b.name)}</b>${UI.statusBadge(r.status, 'room')}</div>
            <div class="mono b text-lg" style="color:var(--brand-700);margin:6px 0">${U.currency(r.price)}<span class="text-xs muted">/tháng</span></div>
            <div class="muted text-sm">${U.esc(r.typeLabel)}, ${r.area} m², tối đa ${r.maxOccupants} người</div>
            <div class="muted text-xs" style="margin:4px 0 8px">${HH.ic('pin', 14)} ${U.esc(b.address || '(chưa có địa chỉ)')}</div>
            ${am.length ? `<div class="room-assets" style="margin-bottom:10px">${am.slice(0, 4).map(x => `<span class="room-asset-chip">${U.esc(x)}</span>`).join('')}${am.length > 4 ? `<span class="room-asset-chip">+${am.length - 4}</span>` : ''}</div>` : ''}
            <div class="row-gap-2 wrap">
              <button class="btn btn-primary btn-sm" data-preview="${b.id}|${r.code}">${HH.ic('eye', 16)} Xem & đăng</button>
              <button class="btn btn-outline btn-sm" data-quickcopy="${b.id}|${r.code}">${HH.ic('copy', 16)} Chép</button>
            </div>
          </div></div>`;
      }).join('');

      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Đăng tin cho thuê</div>
          <div class="page-sub">${items.length} phòng trống sẵn sàng cho thuê, ${withPhoto} phòng đã có ảnh</div></div></div>
        <div class="page-actions">
          ${raw(items.length ? '<button class="btn btn-outline" id="copyAll">' + HH.ic('copy', 16) + ' Chép tất cả tin</button>' : '')}
        </div>
      </div>
      ${raw(items.length && withPhoto < items.length ? `<div class="alert alert-warning" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
        <div>Tin có ảnh thu hút gấp nhiều lần. Thêm ảnh tại <b>Quản lý phòng → bấm vào phòng → Ảnh phòng</b>.</div></div>` : '')}
      ${raw(items.length ? `<div class="listing-grid">${cards}</div>` + ppg.html
        : `<div class="card"><div class="empty"><div class="ic">${HH.ic('megaphone', 30)}</div><h4>Không có phòng trống</h4><p class="muted">Tất cả phòng đang được thuê hoặc giữ chỗ.</p></div></div>`)}`;
    },
    mount() {
      if (HH.pages.post._pg) HH.pages.post._pg.attach(document, () => HH.router.render());
      const find = (key) => { const [bid, code] = key.split('|'); return { b: S.building(bid), r: S.room(bid, code) }; };
      document.querySelectorAll('[data-quickcopy]').forEach(btn => btn.onclick = () => {
        const { b, r } = find(btn.dataset.quickcopy);
        copyText(listingText(b, r), 'tin đăng');
      });
      document.querySelectorAll('[data-preview]').forEach(btn => btn.onclick = () => {
        const { b, r } = find(btn.dataset.preview);
        listingDialog(b, r);
      });
      const all = document.getElementById('copyAll');
      if (all) all.onclick = () => {
        const texts = [];
        S.buildings.forEach(b => S.roomsOf(b.id).filter(r => r.status === 'vacant' || r.status === 'cleaning')
          .forEach(r => texts.push(listingText(b, r))));
        copyText(texts.join('\n\n──────────\n\n'), `${texts.length} tin đăng`);
      };
    },
  };

  function copyText(text, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(
      () => UI.toast('Đã sao chép ' + (label || ''), { type: 'ok' }),
      () => UI.toast('Không sao chép được', { type: 'error' }));
    else UI.toast('Trình duyệt không hỗ trợ sao chép', { type: 'error' });
  }

  function listingDialog(b, r) {
    const photos = r.photos || [];
    const curAm = roomAmenities(b, r);
    const text = listingText(b, r);
    const gallery = photos.length
      ? `<div class="photo-strip" style="margin-bottom:12px">${photos.map(p => `<div class="photo-thumb" style="width:120px;height:92px"><img src="${p}"></div>`).join('')}</div>`
      : `<div class="alert alert-warning" style="margin-bottom:12px"><span class="ic">${HH.ic('camera', 16)}</span><div>Phòng chưa có ảnh nên tin đăng sẽ kém hấp dẫn. Thêm ảnh trong <b>Quản lý phòng</b>.</div></div>`;
    const amChips = AMENITIES.map(a => `<button type="button" class="lz-chip ${curAm.includes(a) ? 'on' : ''}" data-am="${a}">
      <span class="lz-chip-box">${curAm.includes(a) ? '✓' : ''}</span>${a}</button>`).join('');

    UI.modal({
      size: 'wide', title: `Tin đăng phòng ${r.code}`,
      bodyHtml: h`
        ${raw(gallery)}
        <div class="field"><label>Tiện nghi (hiện trong tin)</label>
          <div class="lz-chips" style="margin-bottom:0">${raw(amChips)}</div></div>
        <div class="field" style="margin-top:14px"><label>Nội dung tin đăng (sửa được)</label>
          <textarea class="textarea" id="listingText" style="min-height:220px;font-size:14px">${U.esc(text)}</textarea></div>
        <p class="muted text-xs" style="margin-top:8px">Mẹo: bấm <b>Chép nội dung</b> rồi dán vào Facebook/Zalo. Ảnh cần tải lên thủ công ở bài đăng.</p>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span>
        <button class="btn btn-outline" id="dlPhotos" ${photos.length ? '' : 'disabled'}>${HH.ic('download', 16)} Tải ảnh</button>
        <button class="btn btn-outline" id="shareFb">${HH.ic('external', 16)} Mở Facebook</button>
        <button class="btn btn-primary" id="copyListing">${HH.ic('copy', 16)} Chép nội dung</button>`,
      onMount(el, close) {
        const ta = el.querySelector('#listingText');
        let list = curAm.slice();
        let edited = false;                          // người dùng đã tự sửa nội dung chưa
        ta.oninput = () => { edited = true; };

        // Đổi tiện nghi: cập nhật TẠI CHỖ, không đóng/mở lại hộp thoại (tránh giật)
        el.querySelectorAll('[data-am]').forEach(c => c.onclick = () => {
          const name = c.dataset.am;
          const i = list.indexOf(name);
          if (i >= 0) list.splice(i, 1); else list.push(name);
          c.classList.toggle('on', list.includes(name));
          c.querySelector('.lz-chip-box').textContent = list.includes(name) ? '✓' : '';
          S.updateRoom(b.id, r.code, { amenities: list, amenitiesSet: true });

          // Giữ nguyên nội dung người dùng đang gõ — chỉ thay đúng dòng "Tiện nghi"
          const line = list.length ? `✨ Tiện nghi: ${list.join(', ')}` : '';
          const caret = ta.selectionStart, scroll = ta.scrollTop;
          if (!edited) {
            ta.value = listingText(b, S.room(b.id, r.code));
          } else if (/^✨ Tiện nghi:.*$/m.test(ta.value)) {
            ta.value = ta.value.replace(/^✨ Tiện nghi:.*$/m, line).replace(/\n\n(?=\n)/g, '\n');
          } else if (line) {
            ta.value = ta.value.replace(/^(📍 .*)$/m, '$1\n' + line);
          }
          try { ta.setSelectionRange(Math.min(caret, ta.value.length), Math.min(caret, ta.value.length)); } catch (e) {}
          ta.scrollTop = scroll;
        });
        el.querySelector('#copyListing').onclick = () => copyText(ta.value, 'nội dung tin');
        el.querySelector('#shareFb').onclick = () => {
          copyText(ta.value, 'nội dung tin');
          window.open('https://www.facebook.com/', '_blank', 'noopener');
          UI.toast('Đã chép nội dung. Dán vào ô đăng bài Facebook.', { type: 'ok', sticky: true });
        };
        const dl = el.querySelector('#dlPhotos');
        if (dl && photos.length) dl.onclick = () => {
          photos.forEach((p, i) => {
            const a = document.createElement('a');
            a.href = p; a.download = `${r.code}-anh-${i + 1}.jpg`;
            document.body.appendChild(a); a.click(); a.remove();
          });
          UI.toast(`Đang tải ${photos.length} ảnh`, { type: 'ok' });
        };
      },
    });
  }

  /* ---------------- CÔNG TY / NHÓM + NHÂN SỰ ---------------- */
  const ROLE_LABEL = { manager: 'Quản lý', staff: 'Nhân viên vận hành' };

  HH.pages.group = {
    render() {
      const rooms = S.buildings.reduce((s, b) => s + S.roomsOf(b.id).length, 0);
      const list = S.staffList();
      const me = S.prefs.userName;

      const staffRows = list.map(s => {
        const perms = Array.isArray(s.permissions) ? s.permissions : [];
        const scope = (Array.isArray(s.buildingIds) && s.buildingIds.length)
          ? s.buildingIds.map(id => (S.building(id) || {}).name || id).join(', ') : 'Tất cả tòa nhà';
        return `<tr>
          <td><div class="row-gap-2">
            <span class="avatar" style="width:32px;height:32px;flex:0 0 32px;font-size:12px">${U.initials(s.fullName || s.email)}</span>
            <div><b>${U.esc(s.fullName || '(chưa đặt tên)')}</b>
              <div class="muted text-xs mono">${U.esc(s.email)}</div></div></div></td>
          <td><span class="badge ${s.role === 'manager' ? 's-purple' : 's-info'}"><span class="dot"></span>${ROLE_LABEL[s.role] || s.role}</span></td>
          <td><span class="muted text-xs">${U.esc(scope)}</span></td>
          <td><b class="mono">${perms.length}</b> <span class="muted text-xs">quyền</span></td>
          <td>${s.status === 'active'
            ? '<span class="badge s-success"><span class="dot"></span>Đang hoạt động</span>'
            : '<span class="badge s-neutral"><span class="dot"></span>Đã khóa</span>'}</td>
          <td class="col-actions"><button class="kebab" data-staffmenu="${s.id}">⋯</button></td>
        </tr>`;
      }).join('');

      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Công ty / nhóm</div><div class="page-sub">Thông tin tổ chức & tài khoản nhân viên</div></div></div>
        ${raw(S.isOwner() ? '<div class="page-actions"><button class="btn btn-primary" data-primary-new>' + HH.ic('plus', 16) + ' Thêm nhân viên</button></div>' : '')}
      </div>

      <div class="metric-grid" style="grid-template-columns:repeat(3,1fr);max-width:760px;margin-bottom:16px">
        ${raw(UI.metricCard({ label: 'Tòa nhà', value: S.buildings.length, format: 'number' }))}
        ${raw(UI.metricCard({ label: 'Tổng số phòng', value: rooms, format: 'number' }))}
        ${raw(UI.metricCard({ label: 'Nhân viên', value: list.filter(s => s.status === 'active').length, format: 'number', intent: 'success' }))}
      </div>

      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>Thành viên (${list.length + 1})</h3></div>
        <div class="dt-scroll"><table class="dt">
          <thead><tr><th>Thành viên</th><th>Vai trò</th><th>Phạm vi</th><th>Quyền</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            <tr><td><div class="row-gap-2">
              <span class="avatar" style="width:32px;height:32px;flex:0 0 32px;font-size:12px">${U.initials(me)}</span>
              <div><b>${U.esc(me)}</b><div class="muted text-xs">Bạn</div></div></div></td>
              <td><span class="badge s-purple"><span class="dot"></span>Chủ trọ</span></td>
              <td><span class="muted text-xs">Tất cả tòa nhà</span></td>
              <td><b class="mono">Toàn quyền</b></td>
              <td><span class="badge s-success"><span class="dot"></span>Đang hoạt động</span></td><td></td></tr>
            ${raw(staffRows)}
          </tbody></table></div>
        ${raw(list.length === 0 ? `<div class="card-pad"><div class="empty" style="padding:24px">
            <div class="ic">${HH.ic('users', 16)}</div><h4>Chưa có nhân viên nào</h4>
            <p class="muted">Thêm nhân viên và chọn quyền để họ đăng nhập vào hệ thống bằng tài khoản riêng.</p>
            ${S.isOwner() ? '<div style="margin-top:14px"><button class="btn btn-primary" data-primary-new>' + HH.ic('plus', 16) + ' Thêm nhân viên</button></div>' : ''}
          </div></div>` : '')}
      </div>

      <div class="alert alert-info"><span class="ic">${HH.ic('info', 16)}</span><div>
        <b>Cách nhân viên đăng nhập:</b> bạn thêm nhân viên bằng <b>email</b> → nhân viên vào trang đăng nhập,
        bấm <b>Đăng ký</b> bằng <u>đúng email đó</u> và tự đặt mật khẩu → hệ thống tự nhận diện và cấp đúng quyền bạn đã chọn.
        <div class="text-xs" style="margin-top:4px">Chủ trọ không thấy và không cần biết mật khẩu của nhân viên.</div>
      </div></div>`;
    },
    mount() {
      const nb = document.querySelectorAll('[data-primary-new]');
      nb.forEach(b => b.onclick = () => staffForm(null));
      document.querySelectorAll('[data-staffmenu]').forEach(b => b.onclick = () => {
        const s = S.staffById(b.dataset.staffmenu);
        UI.openMenu(b, [
          { icon: HH.ic('edit', 16), label: 'Sửa quyền & thông tin', onClick: () => staffForm(s) },
          { icon: s.status === 'active' ? HH.ic('lock', 16) : HH.ic('unlock', 16), label: s.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa',
            onClick: () => { S.updateStaff(s.id, { status: s.status === 'active' ? 'disabled' : 'active' });
              UI.toast(s.status === 'active' ? 'Đã khóa tài khoản' : 'Đã mở khóa', { type: 'ok' }); HH.router.render(); } },
          { sep: true },
          { icon: HH.ic('trash', 16), label: 'Xóa nhân viên', danger: true, onClick: () => {
            UI.dangerDialog({ title: `Xóa nhân viên "${s.fullName || s.email}"`,
              description: 'Nhân viên sẽ không còn truy cập được dữ liệu của bạn.',
              consequences: ['Tài khoản đăng nhập của họ vẫn tồn tại nhưng mất quyền truy cập', 'Thao tác được ghi vào nhật ký'],
              confirmLabel: 'Xóa nhân viên', reasonLabel: 'Lý do xóa',
              onConfirm: () => { S.removeStaff(s.id); UI.toast('Đã xóa nhân viên', { type: 'ok' }); HH.router.render(); } });
          } },
        ]);
      });
    },
  };

  function staffForm(existing) {
    const isNew = !existing;
    const perms = new Set(existing && Array.isArray(existing.permissions) ? existing.permissions : S.DEFAULT_STAFF_PERMS);
    const bids = new Set(existing && Array.isArray(existing.buildingIds) ? existing.buildingIds : []);
    const permHtml = S.PERMISSIONS.map(p => `<label class="perm-item ${perms.has(p.key) ? 'on' : ''}" data-permwrap="${p.key}">
      <input type="checkbox" data-perm="${p.key}" ${perms.has(p.key) ? 'checked' : ''}>
      <span><b>${p.label}</b>${p.sensitive ? ' <span class="badge s-warning" style="font-size:10px;padding:1px 6px">Nhạy cảm</span>' : ''}
        <div class="muted text-xs">${p.desc}</div></span></label>`).join('');
    const bHtml = S.buildings.map(b => `<label class="check" style="display:block;padding:5px 0">
      <input type="checkbox" data-bld="${b.id}" ${bids.has(b.id) ? 'checked' : ''}> ${U.esc(b.name)}</label>`).join('');

    UI.modal({
      title: isNew ? 'Thêm nhân viên' : `Sửa nhân viên ${existing.fullName || existing.email}`, size: 'xwide',
      bodyHtml: h`
        <div class="grid-2">
          <div class="field"><label>Email đăng nhập *</label>
            <input class="input" data-s="email" value="${existing ? existing.email : ''}" placeholder="nhanvien@gmail.com" ${raw(isNew ? '' : 'disabled')}>
            <span class="hint">Nhân viên sẽ đăng ký tài khoản bằng đúng email này</span></div>
          <div class="field"><label>Họ và tên</label><input class="input" data-s="fullName" value="${existing ? (existing.fullName || '') : ''}" placeholder="Trần Thị B"></div>
          <div class="field"><label>Số điện thoại</label><input class="input mono" data-s="phone" value="${existing ? (existing.phone || '') : ''}" placeholder="09xxxxxxxx"></div>
          <div class="field"><label>Vai trò</label><select class="select" data-s="role">
            <option value="staff" ${existing && existing.role === 'staff' ? 'selected' : ''}>Nhân viên vận hành</option>
            <option value="manager" ${existing && existing.role === 'manager' ? 'selected' : ''}>Quản lý</option>
          </select></div>
        </div>
        <div class="field" style="margin-top:16px">
          <label>Phạm vi tòa nhà <span class="hint" style="font-weight:400">· không chọn = tất cả</span></label>
          <div class="card" style="box-shadow:none"><div class="card-pad" style="padding:10px 12px">${raw(bHtml || '<span class="faint">Chưa có tòa nhà</span>')}</div></div>
        </div>
        <div class="field" style="margin-top:16px">
          <div class="between"><label>Quyền truy cập</label>
            <div class="row-gap-2"><button type="button" class="btn btn-sm btn-outline" id="permAll">Chọn tất cả</button>
              <button type="button" class="btn btn-sm btn-outline" id="permNone">Bỏ chọn</button></div></div>
          <div class="perm-grid">${raw(permHtml)}</div>
        </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span>
        <button class="btn btn-primary" data-save>${isNew ? 'Thêm nhân viên' : 'Lưu thay đổi'}</button>`,
      onMount(el, close) {
        const sync = () => el.querySelectorAll('[data-perm]').forEach(c =>
          el.querySelector(`[data-permwrap="${c.dataset.perm}"]`).classList.toggle('on', c.checked));
        el.querySelectorAll('[data-perm]').forEach(c => c.onchange = sync);
        el.querySelector('#permAll').onclick = () => { el.querySelectorAll('[data-perm]').forEach(c => c.checked = true); sync(); };
        el.querySelector('#permNone').onclick = () => { el.querySelectorAll('[data-perm]').forEach(c => c.checked = false); sync(); };
        el.querySelector('[data-save]').onclick = (e) => {
          const g = (k) => ((el.querySelector(`[data-s="${k}"]`) || {}).value || '').trim();
          const email = (isNew ? g('email') : existing.email).toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { UI.toast('Email không hợp lệ', { type: 'error' }); return; }
          if (isNew && S.staffList().some(x => (x.email || '').toLowerCase() === email)) {
            UI.toast('Email này đã được thêm', { type: 'error' }); return; }
          const permissions = [...el.querySelectorAll('[data-perm]')].filter(c => c.checked).map(c => c.dataset.perm);
          const buildingIds = [...el.querySelectorAll('[data-bld]')].filter(c => c.checked).map(c => c.dataset.bld);
          e.currentTarget.classList.add('loading');
          setTimeout(() => {
            const patch = { email, fullName: g('fullName'), phone: g('phone'), role: g('role'), permissions, buildingIds };
            if (isNew) {
              S.addStaff(Object.assign({ id: U.uid('st'), status: 'active', createdAt: new Date().toISOString() }, patch));
              S.log('staff.add', `Thêm nhân viên ${email} (${permissions.length} quyền)`);
            } else { S.updateStaff(existing.id, patch); S.log('staff.update', `Cập nhật quyền nhân viên ${email}`); }
            close();
            if (isNew) UI.modal({ title: 'Đã thêm nhân viên', bodyHtml: `
              <div class="alert alert-success" style="margin-bottom:12px"><span class="ic">✓</span><div>Đã thêm <b>${U.esc(email)}</b> với ${permissions.length} quyền.</div></div>
              <p class="b" style="margin-bottom:6px">Hướng dẫn cho nhân viên:</p>
              <ol style="padding-left:20px;line-height:1.9">
                <li>Mở trang đăng nhập của hệ thống</li>
                <li>Bấm <b>"Chưa có tài khoản? Đăng ký"</b></li>
                <li>Đăng ký bằng <b class="mono">${U.esc(email)}</b> và tự đặt mật khẩu (≥6 ký tự)</li>
                <li>Đăng nhập, hệ thống tự cấp đúng quyền bạn đã chọn</li>
              </ol>`,
              footHtml: `<span class="spacer"></span><button class="btn btn-primary" data-close>Đã hiểu</button>` });
            else UI.toast('Đã lưu nhân viên', { type: 'ok' });
            HH.router.render();
          }, 350);
        };
      },
    });
  }

  /* ---------------- CÀI ĐẶT CHUNG ---------------- */
  /* Bảng trạng thái trợ lý ảo — giải thích rõ tầng nào đang chạy */
  function aiStatusHtml() {
    const G = window.HHGemini;
    const on = !!(G && G.configured());
    const mode = on ? (G.viaProxy() ? 'Qua máy chủ trung gian (an toàn)' : 'Gọi thẳng từ trình duyệt') : '-';
    const left = on ? (G.quotaLimit - G.quotaUsed()) : 0;
    const nIntent = (HH.ai && HH.ai.INTENT_LIST.length) || 0;
    return `<div class="grid-2" style="align-items:start;gap:20px">
      <div>
        <div class="field"><label>Tầng 1: tra cứu tại chỗ</label>
          <div><span class="badge s-success"><span class="dot"></span>Luôn bật · miễn phí</span></div>
          <span class="hint" style="display:block;margin-top:6px">
            ${nIntent} nhóm câu hỏi thường gặp được nhận diện bằng từ khóa. Số liệu lấy trực tiếp
            từ cơ sở dữ liệu rồi ghép vào câu mẫu. Không gọi mạng, không tốn phí, không sai số.</span></div>
        <div class="field" style="margin-top:14px"><label>Tầng 2: Gemini Flash</label>
          <div>${on ? '<span class="badge s-purple"><span class="dot"></span>Đã bật</span>'
                    : '<span class="badge s-neutral"><span class="dot"></span>Chưa cấu hình</span>'}</div>
          <span class="hint" style="display:block;margin-top:6px">
            Chỉ chạy khi Tầng 1 không nhận ra ý định. Mô hình <b>chỉ phân loại ý định</b> rồi
            <b>soạn lời văn từ số liệu code đã lấy</b>, không bao giờ tự nghĩ ra con số.</span></div>
      </div>
      <div>
        ${on ? `<div class="field"><label>Cách kết nối</label><div class="mono">${U.esc(mode)}</div></div>
          <div class="field" style="margin-top:12px"><label>Mô hình</label><div class="mono">${U.esc(G.model())}</div></div>
          <div class="field" style="margin-top:12px"><label>Lượt còn lại hôm nay</label>
            <div class="mono b">${left} / ${G.quotaLimit}</div>
            <span class="hint" style="display:block;margin-top:4px">Bộ đếm nội bộ để không vượt hạn mức miễn phí của Google.</span></div>`
        : `<div class="alert alert-info"><span class="ic">i</span><div>
            Trợ lý vẫn hoạt động bình thường với các câu hỏi thường gặp.<br>
            Muốn bật Gemini cho câu hỏi phức tạp: lấy khóa miễn phí tại
            <b>aistudio.google.com/apikey</b> rồi thêm <span class="mono">geminiApiKey</span>
            (hoặc <span class="mono">aiProxyUrl</span>) vào <span class="mono">js/config.js</span>.
            Xem hướng dẫn trong <span class="mono">js/config.example.js</span>.</div></div>`}
      </div>
    </div>`;
  }

  HH.pages.companyConfig = {
    render() {
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Cài đặt chung</div><div class="page-sub">Thiết lập tài khoản & ứng dụng</div></div></div>
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card"><div class="card-head"><h3>Tài khoản</h3></div><div class="card-pad">
          <div class="field"><label>Tên hiển thị</label><input class="input" id="cfgName" value="${U.esc(S.prefs.userName)}"></div>
          <div style="margin-top:16px"><button class="btn btn-primary" id="cfgSave">Lưu</button></div>
        </div></div>
        <div class="card"><div class="card-head"><h3>Vai trò & quyền của bạn</h3></div><div class="card-pad">
          <div class="field"><label>Vai trò</label><div>${raw(S.isOwner()
            ? '<span class="badge s-purple"><span class="dot"></span>Chủ trọ, toàn quyền</span>'
            : '<span class="badge s-info"><span class="dot"></span>Nhân viên</span>')}</div></div>
          ${raw(S.isOwner() ? '' : `<div class="field" style="margin-top:12px"><label>Quyền được cấp (${S.myPermissions().length})</label>
            <div class="room-assets">${S.PERMISSIONS.filter(p => S.can(p.key))
              .map(p => `<span class="room-asset-chip">✓ ${U.esc(p.label)}</span>`).join('') || '<span class="faint">Chưa được cấp quyền nào</span>'}</div>
            <span class="hint" style="margin-top:6px;display:block">Liên hệ chủ trọ nếu cần thêm quyền.</span></div>`)}
          <div class="field" style="margin-top:12px"><label>Chế độ lưu trữ</label><div>${raw(S.usingBackend() ? '<span class="badge s-success"><span class="dot"></span>Máy chủ Supabase</span>' : '<span class="badge s-warning"><span class="dot"></span>Cục bộ (trình duyệt)</span>')}</div></div>
          <div class="field" style="margin-top:12px"><label>Phiên bản</label><div class="mono">Happy Home v1.0</div></div>
          ${raw(S.isOwner() ? '<div style="margin-top:16px"><button class="btn btn-outline" id="cfgReset" style="color:var(--danger)">' + HH.ic('refresh', 16) + ' Khôi phục dữ liệu mẫu</button></div>' : '')}
        </div></div>
        <div class="card" style="grid-column:1/-1"><div class="card-head"><h3>Trợ lý ảo (AI)</h3></div>
          <div class="card-pad">${raw(aiStatusHtml())}</div></div>
      </div>`;
    },
    mount() {
      document.getElementById('cfgSave').onclick = () => {
        const name = document.getElementById('cfgName').value.trim();
        if (name) { S.setPref('userName', name); UI.toast('Đã lưu', { type: 'ok' }); HH.router.render(); }
      };
      const rst = document.getElementById('cfgReset');
      if (rst) rst.onclick = () => {
        UI.modal({ title: 'Khôi phục dữ liệu mẫu', bodyHtml: '<p class="muted">Xóa toàn bộ thay đổi và nạp lại dữ liệu mẫu ban đầu. Không thể hoàn tác.</p>',
          footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-danger" id="doReset">Khôi phục</button>',
          onMount(el) { el.querySelector('#doReset').onclick = () => S.resetData(); } });
      };
    },
  };
})();

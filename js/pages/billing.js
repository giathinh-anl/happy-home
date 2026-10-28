/* ============================================================
   Trang: Chỉ số điện nước, Hóa đơn, Chi tiết HĐ, Thanh toán/công nợ
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, V = HH.validate, h = U.html, raw = U.raw;

  /* ================= GHI CHỈ SỐ (§3.6) ================= */
  HH.pages.readings = {
    render(ctx) {
      const rooms = S.roomsOf(ctx.bid).filter(r => r.status === 'occupied' || r.status === 'notice')
        .sort((a, b) => a.code.localeCompare(b.code));
      const period = S.period();
      const done = rooms.filter(r => { const rd = S.reading(ctx.bid, r.code, period); return rd && rd.elecCurr != null; }).length;
      return h`<div class="page-head">
        <div><div class="page-title">Chỉ số điện</div><div class="page-sub">${ctx.building.name} · Kỳ ${S.periodLabel(period)}</div></div>
        <div class="page-actions">
          <span class="badge s-info" style="align-self:center"><span class="dot"></span>Đã ghi ${done}/${rooms.length} phòng</span>
          <button class="btn btn-outline" id="rdVoice" title="Đọc chỉ số bằng giọng nói, xem lại rồi mới ghi">${raw(HH.icon('mic', 16))} Đọc chỉ số</button>
          <button class="btn btn-primary" id="toBill">Lập hóa đơn →</button>
        </div></div>
        <div id="periodSel" style="margin-bottom:16px"></div>
        <p class="muted text-sm" style="margin-bottom:12px">Tiền nước tính theo số người ở (xem Dịch vụ), không cần ghi chỉ số nước.</p>
        <div class="dt-wrap"><div class="dt-scroll"><table class="dt" id="readTable">
          <thead><tr><th>Phòng</th><th>Khách</th>
            <th class="num">Điện kỳ trước</th>
            <th class="num">Điện kỳ này</th>
            <th class="num">Tiêu thụ (kWh)</th><th class="center">Ảnh</th><th></th></tr></thead>
          <tbody>${raw(readingRows(ctx, rooms, period))}</tbody>
        </table></div></div>
        <p class="muted text-xs" style="margin-top:10px">Mẹo: dùng <kbd>Enter</kbd> hoặc <kbd>Tab</kbd> để nhảy xuống phòng kế tiếp.</p>`;
    },
    mount(ctx) {
      mountPeriodSelector();
      document.getElementById('toBill').onclick = () => HH.router.go(`/b/${ctx.bid}/invoices`);
      document.getElementById('rdVoice').onclick = () => HH.voiceUI.docChiSo(ctx);
      wireReadingInputs(ctx);
    },
  };

  function readingRows(ctx, rooms, period) {
    const prevPeriod = S.prevPeriodOf(period);
    return rooms.map((r, idx) => {
      const rd = S.reading(ctx.bid, r.code, period) || {};
      const prevRd = S.reading(ctx.bid, r.code, prevPeriod);
      const prevOf = (w) => {
        if (rd[w + 'Prev'] != null) return rd[w + 'Prev'];
        if (prevRd) return prevRd[w + 'Curr'] != null ? prevRd[w + 'Curr'] : prevRd[w + 'Prev'];
        return 0;
      };
      const prev = prevOf('elec');
      const curr = rd.elecCurr;
      const use = (curr != null && prev != null)
        ? Math.max(0, curr - prev) + (rd.elecExtra || 0) : null;
      const avg = rd.elecAvg || 190;
      const abnormal = use != null && use > avg * 3;
      const isTenant = rd.source === 'tenant' && !rd.approved;
      const rowCls = abnormal ? 'warn-row' : (isTenant ? 'tenant-row' : '');
      const done = curr != null;
      return `<tr class="${rowCls}" data-code="${r.code}">
        <td><b>${r.code}</b></td>
        <td>${r.tenantName}${isTenant ? ' <span class="self-tag">' + HH.ic('user', 16) + ' khách tự ghi</span>' : ''}</td>
        <td class="num">${prev != null ? U.number(prev) : '-'}</td>
        <td class="num"><input class="input reading-input mono" data-read="${idx}" data-code="${r.code}" value="${curr != null ? curr : ''}" ${isTenant ? 'style="background:var(--info-bg)"' : ''}></td>
        <td class="num"><span class="consume" data-use="${r.code}" style="${abnormal ? 'color:var(--warning)' : ''}">${use != null ? U.number(use) : ''}</span>
          ${abnormal ? `<div class="reading-note" data-note="${r.code}">Cao gấp ${(use / avg).toFixed(1)} lần</div>` : ''}</td>
        <td class="center">${(rd.photos || []).length
          ? `<button class="photo-btn" data-rdphoto="${r.code}" title="Xem ${rd.photos.length} ảnh đồng hồ khách gửi">${HH.ic('camera', 16)}<span class="ph-n">${rd.photos.length}</span></button>`
          : '<span class="faint">-</span>'}</td>
        <td class="center">${isTenant ? `<button class="btn btn-sm btn-outline" data-approve="${r.code}">Duyệt</button>` : (done ? '<span style="color:var(--success)">✓</span>' : '')}</td>
      </tr>`;
    }).join('');
  }

  function wireReadingInputs(ctx) {
    const inputs = Array.from(document.querySelectorAll('[data-read]'));
    const savePersist = U.debounce(() => S.persist(), 400);
    const kind = 'elec';   // chỉ còn điện, nước tính theo số người
    // Vẽ lại ô Tiêu thụ + cảnh báo cho 1 dòng
    function refreshRow(inp, rd, code) {
      const useEl = document.querySelector(`[data-use="${code}"]`);
      const tr = inp.closest('tr');
      const nt = tr.querySelector('[data-note]'); if (nt) nt.remove();
      const curr = rd[kind + 'Curr'], prev = rd[kind + 'Prev'];
      if (curr == null) { useEl.textContent = ''; useEl.style.color = ''; tr.classList.remove('warn-row'); return; }
      if (curr < prev) {   // chỉ nhắc nhẹ khi đang gõ, KHÔNG mở hộp thoại
        useEl.textContent = '-'; useEl.style.color = 'var(--danger)';
        const note = document.createElement('div');
        note.className = 'reading-note'; note.dataset.note = code;
        note.style.color = 'var(--danger)'; note.textContent = 'Nhỏ hơn kỳ trước';
        useEl.after(note); tr.classList.remove('warn-row');
        return;
      }
      const use = S.consumptionOf(rd, kind);
      useEl.textContent = U.number(use);
      const avg = rd.elecAvg || 190;
      if (use > avg * 3) {
        tr.classList.add('warn-row'); useEl.style.color = 'var(--warning)';
        const note = document.createElement('div');
        note.className = 'reading-note'; note.dataset.note = code;
        note.textContent = `Cao gấp ${(use / avg).toFixed(1)} lần`;
        useEl.after(note);
      } else { tr.classList.remove('warn-row'); useEl.style.color = ''; }
    }

    inputs.forEach((inp) => {
      const code = inp.dataset.code;
      inp.oninput = () => {
        const n = U.parseNum(inp.value); inp.value = n != null ? n : '';
        const rd = S.readingFor(ctx.bid, code, S.period()); // tạo bản ghi nếu chưa có
        if (!rd) return;
        rd[kind + 'Curr'] = n;
        savePersist();
        refreshRow(inp, rd, code);   // chỉ cập nhật hiển thị, không chặn nhập
      };
      // Chỉ hỏi nguyên nhân KHI ĐÃ NHẬP XONG (rời ô) — tránh bật hộp thoại lúc mới gõ 1 số
      inp.onblur = () => {
        const rd = S.reading(ctx.bid, code, S.period());
        if (!rd) return;
        const curr = rd[kind + 'Curr'], prev = rd[kind + 'Prev'];
        if (curr != null && prev != null && curr < prev && !inp.dataset.asking) {
          inp.dataset.asking = '1';
          promptRollover(ctx, code, prev, curr, inp, kind, () => {
            delete inp.dataset.asking;
            refreshRow(inp, S.reading(ctx.bid, code, S.period()), code);
          });
        }
      };
      inp.onkeydown = (e) => {
        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          const i = inputs.indexOf(inp);
          const next = inputs[i + 1];
          inp.blur();                       // kích hoạt kiểm tra khi rời ô
          if (next) { next.focus(); next.select(); }
        }
      };
    });
    // Xem ảnh đồng hồ khách gửi kèm, duyệt ngay trong hộp thoại
    document.querySelectorAll('[data-rdphoto]').forEach(b => b.onclick = () => {
      const code = b.dataset.rdphoto;
      const rd = S.reading(ctx.bid, code, S.period()) || {};
      const photos = rd.photos || [];
      const needOk = rd.source === 'tenant' && !rd.approved;
      UI.modal({
        size: 'wide', title: `Ảnh đồng hồ phòng ${code}`,
        bodyHtml: `<p class="muted text-sm" style="margin-bottom:12px">Khách gửi chỉ số <b class="num">${rd.elecCurr != null ? U.number(rd.elecCurr) : '-'}</b> kWh,
            kỳ trước <span class="num">${rd.elecPrev != null ? U.number(rd.elecPrev) : '-'}</span>.</p>
          <div class="rd-photos">${photos.map(src => `<a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="Ảnh đồng hồ phòng ${code}"></a>`).join('')}</div>`,
        footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span>
          ${needOk ? `<button class="btn btn-primary" id="rdOk">${HH.ic('check', 16)} Duyệt chỉ số</button>` : ''}`,
        onMount(el, close) {
          const ok = el.querySelector('#rdOk');
          if (ok) ok.onclick = () => {
            rd.approved = true; S.persist();
            close(); UI.toast(`Đã duyệt chỉ số phòng ${code}`, { type: 'ok' }); HH.router.render();
          };
        },
      });
    });
    document.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => {
      const rd = S.reading(ctx.bid, b.dataset.approve, S.period()); if (rd) rd.approved = true;
      S.persist();
      UI.toast(`Đã duyệt chỉ số phòng ${b.dataset.approve}`, { type: 'ok' }); HH.router.render();
    });
  }

  function promptRollover(ctx, code, prev, curr, inp, kind, done) {
    const digits = String(Math.floor(prev)).length;   // số chữ số của đồng hồ
    const maxVal = Math.pow(10, digits);              // VD 5 chữ số -> 100000
    const wrapUse = (maxVal - prev) + curr;
    let handled = false;
    UI.modal({
      title: `Phòng ${code}: chỉ số mới nhỏ hơn chỉ số cũ`,
      bodyHtml: h`
        <p class="muted" style="margin-bottom:12px">Kỳ trước <b class="mono">${U.number(prev)}</b>, kỳ này <b class="mono">${U.number(curr)}</b>. Nguyên nhân?</p>
        <div class="col" style="gap:10px">
          <label class="check"><input type="radio" name="rollover" value="wrap" checked>
            <span>Đồng hồ quay hết vòng (${digits} chữ số)
              <div class="muted text-xs">Tiêu thụ = (${U.number(maxVal)} − ${U.number(prev)}) + ${U.number(curr)} = <b>${U.number(wrapUse)}</b></div></span></label>
          <label class="check"><input type="radio" name="rollover" value="replace">
            <span>Đã thay đồng hồ mới
              <div class="muted text-xs">Khai chỉ số cuối của đồng hồ cũ và chỉ số đầu của đồng hồ mới</div></span></label>
          <label class="check"><input type="radio" name="rollover" value="fix">
            <span>Nhập nhầm, để tôi sửa lại
              <div class="muted text-xs">Xóa giá trị vừa nhập để gõ lại</div></span></label>
        </div>
        <div id="replaceBox" class="hidden" style="margin-top:14px">
          <div class="grid-2">
            <div class="field"><label>Chỉ số cuối đồng hồ cũ</label><input class="input mono" id="oldFinal" value="${prev}"></div>
            <div class="field"><label>Chỉ số đầu đồng hồ mới</label><input class="input mono" id="newStart" value="0"></div>
          </div>
          <p class="hint" id="repPreview" style="margin-top:8px"></p>
        </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" data-ok>Xác nhận</button>`,
      onMount(el, close) {
        const box = el.querySelector('#replaceBox');
        const oldF = el.querySelector('#oldFinal'), newS = el.querySelector('#newStart');
        const prevw = el.querySelector('#repPreview');
        const calcRep = () => {
          const of = U.parseNum(oldF.value) || 0, ns = U.parseNum(newS.value) || 0;
          const use = Math.max(0, of - prev) + Math.max(0, curr - ns);
          prevw.innerHTML = `→ Tiêu thụ kỳ này: <b class="mono">${U.number(use)}</b>`;
          return { of, ns, use };
        };
        el.querySelectorAll('input[name=rollover]').forEach(r => r.onchange = () => {
          box.classList.toggle('hidden', r.value !== 'replace' || !r.checked);
          if (el.querySelector('input[name=rollover]:checked').value === 'replace') calcRep();
        });
        oldF.oninput = calcRep; newS.oninput = calcRep;

        el.querySelector('[data-ok]').onclick = () => {
          const v = el.querySelector('input[name=rollover]:checked').value;
          const rd = S.readingFor(ctx.bid, code, S.period());
          if (v === 'wrap') {
            rd[kind + 'Extra'] = maxVal - prev;   // phần đồng hồ chạy hết vòng
            rd[kind + 'Prev'] = 0;                // mốc mới từ 0
            UI.toast(`Đã tính bù quay vòng · tiêu thụ ${U.number(wrapUse)}`, { type: 'ok' });
          } else if (v === 'replace') {
            const { of, ns } = calcRep();
            rd[kind + 'Extra'] = Math.max(0, of - prev);  // phần dùng trên đồng hồ cũ
            rd[kind + 'Prev'] = ns;                        // đồng hồ mới bắt đầu từ đây
            rd[kind + 'MeterChanged'] = true;
            UI.toast('Đã ghi nhận thay đồng hồ mới', { type: 'ok' });
          } else {                                 // nhập nhầm -> xóa để gõ lại
            rd[kind + 'Curr'] = null; inp.value = '';
            UI.toast('Đã xóa, mời nhập lại', { type: 'ok' });
          }
          S.persist();
          handled = true;
          close();
          if (done) done();
          if (v === 'fix') setTimeout(() => inp.focus(), 50);
        };
      },
      onClose() { if (!handled && done) done(); },   // bấm Hủy: giữ nguyên, không xóa số đã gõ
    });
  }

  /* ================= HÓA ĐƠN (§3.7) ================= */
  HH.pages.invoices = {
    render(ctx) {
      const period = S.period();
      let list = S.invoicesOf(ctx.bid, period);
      // lọc theo query ?status=
      const q = new URLSearchParams((location.hash.split('?')[1] || ''));
      const initStatus = q.get('status');
      const issued = list.filter(i => i.status !== 'cancelled');
      const totalIssued = issued.reduce((s, i) => s + i.total, 0);
      const collected = issued.reduce((s, i) => s + i.paid, 0);
      const remaining = totalIssued - collected;
      const overdue = issued.filter(i => i.status === 'overdue');
      const overdueSum = overdue.reduce((s, i) => s + (i.total - i.paid), 0);

      const cards = `<div class="metric-grid">
        ${UI.metricCard({ label: 'Tổng phát hành', value: totalIssued, format: 'currency', sub: issued.length + ' HĐ' })}
        ${UI.metricCard({ label: 'Đã thu', value: collected, format: 'currency', intent: 'success', sub: issued.filter(i => i.status === 'paid').length + ' HĐ' })}
        ${UI.metricCard({ label: 'Còn phải thu', value: remaining, format: 'currency', intent: 'warning' })}
        ${UI.metricCard({ label: 'Quá hạn', value: overdueSum, format: 'currency', intent: 'danger', sub: overdue.length + ' HĐ' })}
      </div>`;

      const statusFilter = `<select class="select" id="stFilter" style="max-width:170px">
        <option value="">Mọi trạng thái</option>
        ${['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'].map(s =>
        `<option value="${s}" ${initStatus === s ? 'selected' : ''}>${UI.STATUS.invoice[s].label}</option>`).join('')}</select>`;

      const dt = UI.DataTable({
        rows: list, rowId: i => i.id, searchKeys: ['id', 'roomCode', 'tenantName'],
        searchPlaceholder: 'Tìm mã HĐ, phòng, khách...',
        selectable: true, initialFilter: initStatus,
        filterFn: (r, f) => r.status === f,
        toolbarLeft: statusFilter,
        toolbarRight: `<button class="btn btn-outline" id="genInv">Chốt sổ tháng</button><button class="btn btn-success" id="invExport">${HH.ic('sheet', 16)} Xuất Excel</button>`,
        bulkActions: [
          { label: 'Phát hành', primary: true, onClick: (ids, clear) => issueFlow(ctx, ids, clear) },
          { label: 'Xuất Excel', onClick: (ids) => exportInvoices(ctx, list.filter(i => ids.includes(i.id))) },
        ],
        columns: [
          { key: 'id', label: 'Mã HĐ', mono: true, sortable: true, render: i => `<span class="mono b">${i.id}</span>` },
          { key: 'roomCode', label: 'Phòng' },
          { key: 'tenantName', label: 'Khách', render: i => i.tenantName },
          { key: 'total', label: 'Tổng tiền', align: 'right', sortable: true, render: i => U.currency(i.total) },
          { key: 'paid', label: 'Đã trả', align: 'right', render: i => i.paid ? U.currency(i.paid) : '<span class="faint">0 ₫</span>' },
          { key: 'status', label: 'Trạng thái', render: i => UI.statusBadge(i.status, 'invoice') },
        ],
        onRowClick: i => HH.router.go(`/b/${ctx.bid}/invoices/${i.id}`),
        actions: i => invoiceActions(ctx, i),
      });
      ctx._dt = dt;
      const drafts = list.filter(i => i.status === 'draft');
      const unpaid = list.filter(i => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft');
      const draftBanner = drafts.length ? `<div class="reminder-box" style="border-color:var(--info);border-left-color:var(--info)">
        <div class="rem-head"><span>${HH.ic('send', 16)}</span><b>Có ${drafts.length} hóa đơn nháp chờ phát hành</b></div>
        <div class="rem-line"><span class="rem-ic" style="background:var(--info-bg)">${HH.ic('receipt', 16)}</span>
          <div class="grow">Rà soát rồi phát hành để gửi tới khách thuê. Sau khi phát hành mới thu tiền được.
            <div class="muted text-xs">${drafts.slice(0, 8).map(i => i.roomCode).join(' · ')}${drafts.length > 8 ? ' …' : ''}</div></div>
          <button class="btn btn-primary btn-sm" id="issueAll">${HH.ic('send', 16)} Phát hành tất cả</button></div>
      </div>` : '';
      const collectBanner = (!drafts.length && unpaid.length) ? `<div class="alert alert-warning" style="margin-bottom:16px">
        <span class="ic">₫</span><div><b>${unpaid.length} hóa đơn chưa thu đủ.</b> Vào
        <a href="#/b/${ctx.bid}/payments">Thanh toán & công nợ</a> để thu tiền và in phiếu thu.</div></div>` : '';

      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Hóa đơn</div><div class="page-sub">${ctx.building.name} · Kỳ ${S.periodLabel(period)}</div></div></div>
        <div class="page-actions"><button class="btn btn-primary" data-primary-new id="genInv2">${raw(HH.ic('receipt', 16))} Chốt sổ tháng</button></div>
      </div>
      <div id="periodSel" style="margin-bottom:16px"></div>
      ${raw(cards)}
      <div style="margin-top:16px">${raw(batchPanel(ctx, period))}${raw(draftBanner)}${raw(collectBanner)}</div>
      <div>${raw(dt.render())}</div>`;
    },
    mount(ctx) {
      mountPeriodSelector();
      ctx._dt.attach(document);
      const st = document.getElementById('stFilter');
      st.onchange = () => ctx._dt.setFilter(st.value || null);
      if (st.value) ctx._dt.setFilter(st.value);
      const gen = () => generateFlow(ctx);
      document.getElementById('genInv').onclick = gen;
      document.getElementById('genInv2').onclick = gen;
      // đi từ "Hôm nay" bằng nút Chốt sổ: mở thẳng bước xem trước (một lần)
      if (new URLSearchParams((location.hash.split('?')[1] || '')).get('act') === 'chotso') {
        try { history.replaceState(null, '', location.href.split('?')[0].split('#')[0] + '#' + location.hash.slice(1).split('?')[0]); } catch (e) {}
        setTimeout(gen, 50);
      }
      const ie = document.getElementById('invExport');
      if (ie) ie.onclick = () => exportInvoices(ctx, S.invoicesOf(ctx.bid, S.period()));
      document.querySelectorAll('[data-bissue]').forEach(b => b.onclick = () => issueBatchFlow(ctx, b.dataset.bissue));
      document.querySelectorAll('[data-bundo]').forEach(b => b.onclick = () => undoBatchDialog(ctx, b.dataset.bundo));
      const ia = document.getElementById('issueAll');
      if (ia) ia.onclick = () => {
        const ids = S.invoicesOf(ctx.bid, S.period()).filter(i => i.status === 'draft').map(i => i.id);
        issueFlow(ctx, ids, null);
      };
    },
  };

  // Bộ chọn kỳ dùng chung — đổi kỳ thật, nạp lại dữ liệu theo kỳ
  function mountPeriodSelector() {
    const psel = document.getElementById('periodSel'); if (!psel) return;
    const opt = { value: S.period(), pending: S.periodsWithData(),
      onChange: (p) => { S.setPeriod(p); HH.router.render(); } };
    psel.innerHTML = UI.periodSelector(opt);
    UI.attachPeriod(psel.querySelector('[data-period-root]'), opt);
  }

  function exportInvoices(ctx, list) {
    U.downloadCSV(`hoa-don-${ctx.bid}-${S.period()}.csv`,
      ['Mã HĐ', 'Phòng', 'Khách', 'Tổng tiền', 'Đã trả', 'Còn lại', 'Trạng thái', 'Hạn TT'],
      list.map(i => [i.id, i.roomCode, i.tenantName, i.total, i.paid, i.total - i.paid,
        (UI.STATUS.invoice[i.status] || {}).label || i.status, U.fmtDate(i.dueDate)]));
    UI.toast(`Đã tải file Excel (CSV) · ${list.length} hóa đơn`, { type: 'ok' });
  }

  function printInvoice(ctx, inv) {
    const b = S.building(ctx.bid) || {};
    const rows = inv.lines.map(l => `<tr><td>${U.esc(l.label)}<div class="basis">${U.esc(l.meta || '')}</div></td><td class="r">${U.currency(l.amount)}</td></tr>`).join('');
    const win = window.open('', '_blank', 'width=820,height=960');
    if (!win) { UI.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép popup.', { type: 'error' }); return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${inv.id}</title>
      <style>body{font-family:'Be Vietnam Pro',Arial,sans-serif;color:#1c1917;max-width:640px;margin:24px auto;padding:0 16px}
      h1{font-size:20px;margin:0}.muted{color:#57534e}.r{text-align:right;font-variant-numeric:tabular-nums}
      table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:10px 0;border-bottom:1px solid #eee;vertical-align:top}
      .basis{font-size:11px;color:#777;margin-top:2px}.tot{display:flex;justify-content:space-between;padding:6px 0}
      .grand{font-size:18px;font-weight:700;border-top:2px solid #333;margin-top:8px;padding-top:10px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F5C5B;padding-bottom:12px}
      .brandrow{display:flex;gap:10px;align-items:center}.brandrow img{width:46px;height:auto}
      .brand{font-weight:800;color:#0F5C5B;letter-spacing:.02em}</style></head><body>
      <div class="head"><div class="brandrow"><img src="${U.asset('logo-mark.svg')}" alt="">
        <div><div class="brand">HAPPY HOME</div><div class="muted">${U.esc(b.name || '')}</div><div class="muted" style="font-size:12px">${U.esc(b.address || '')}</div></div></div>
        <div class="r"><h1>HÓA ĐƠN</h1><div class="muted" style="font-family:monospace">${inv.id}</div></div></div>
      <div style="margin-top:14px"><b>Phòng ${U.esc(inv.roomCode)}</b> · ${U.esc(inv.tenantName)}<br>
        <span class="muted">Kỳ ${U.fmtDate(inv.periodStart)} đến ${U.fmtDate(inv.periodEnd)} · Hạn ${U.fmtDate(inv.dueDate)}</span></div>
      <table><tbody>${rows}</tbody></table>
      <div class="tot"><span>Đã thanh toán</span><span class="r">${U.currency(inv.paid)}</span></div>
      <div class="tot"><span>Còn lại</span><span class="r">${U.currency(inv.total - inv.paid)}</span></div>
      <div class="tot grand"><span>Tổng cộng</span><span class="r">${U.currency(inv.total)}</span></div>
      <p class="muted" style="margin-top:24px;font-size:12px">Cảm ơn quý khách. In từ Happy Home.</p>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }

  function invoiceActions(ctx, i) {
    const items = [
      { icon: HH.ic('eye', 16), label: 'Xem chi tiết', onClick: () => HH.router.go(`/b/${ctx.bid}/invoices/${i.id}`) },
      { icon: HH.ic('print', 16), label: 'In hóa đơn', onClick: () => printInvoice(ctx, i) },
    ];
    if (i.status === 'draft')
      items.push({ icon: HH.ic('send', 16), label: 'Phát hành hóa đơn này', onClick: () => issueFlow(ctx, [i.id], null) });
    if (i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
      items.push({ icon: '₫', label: 'Thu tiền / ghi nhận thanh toán', onClick: () => paymentDialog(ctx, i) });
    if (S.isOwner() && i.status !== 'cancelled' && i.status !== 'draft')
      items.push({ sep: true }, { icon: '✕', label: 'Hủy hóa đơn', danger: true, onClick: () => cancelInvoice(ctx, i) });
    return items;
  }

  /* ================= CHỐT SỔ THÁNG ================= */
  const CS_TONE = { 'san-sang': 'success', 'bat-thuong': 'warning', 'thieu-chi-so': 'danger', 'chi-so-giam': 'danger', 'da-co': 'neutral', 'ngoai-ky': 'neutral' };
  const CS_THU_TU = { 'thieu-chi-so': 0, 'chi-so-giam': 1, 'bat-thuong': 2, 'san-sang': 3, 'da-co': 4, 'ngoai-ky': 5 };

  function generateFlow(ctx) {
    const period = S.period();
    const rows = S.closingPreview(ctx.bid, period).sort((a, b) => (CS_THU_TU[a.trangThai] - CS_THU_TU[b.trangThai]) || a.roomCode.localeCompare(b.roomCode));
    const sum = HH.closing.tom(rows);
    const chip = (k, label, n, tone) => n ? `<span class="badge s-${tone}">${n} ${label}</span>` : '';
    const trs = rows.map(r => `<tr data-cid="${U.esc(r.contractId)}">
      <td data-label="Phòng" class="dt-title"><label class="check"><input type="checkbox" data-cs="${U.esc(r.contractId)}" ${r.chon ? 'checked' : ''} ${r.chan ? 'disabled' : ''}> <b>${U.esc(r.roomCode)}</b></label></td>
      <td data-label="Khách">${U.esc(r.tenantName || '')}</td>
      <td data-label="Điện dùng" class="num mono">${r.tieuThu == null ? '-' : U.number(r.tieuThu) + ' kWh'}</td>
      <td data-label="Dự kiến" class="num mono">${r.duKien == null ? '-' : U.currency(r.duKien)}</td>
      <td data-label="Tình trạng"><span class="badge s-${CS_TONE[r.trangThai]}">${HH.closing.NHAN[r.trangThai]}</span>${r.ghiChu ? `<div class="muted text-xs" style="margin-top:3px">${U.esc(r.ghiChu)}</div>` : ''}</td></tr>`).join('');

    const body = h`
      <p class="muted" style="margin-bottom:10px">Xem trước toàn bộ phòng đang thuê rồi mới tạo hóa đơn nháp. Chưa gửi gì cho khách cho tới khi bạn bấm <b>Phát hành</b>,
        và cả đợt hoàn tác được nếu sai.</p>
      <div class="row-gap-2 wrap" style="margin-bottom:12px">
        ${raw(chip('ss', 'sẵn sàng', sum['san-sang'], 'success'))}${raw(chip('bt', 'nên xem lại', sum['bat-thuong'], 'warning'))}
        ${raw(chip('tc', 'thiếu chỉ số', sum['thieu-chi-so'], 'danger'))}${raw(chip('cg', 'chỉ số giảm', sum['chi-so-giam'], 'danger'))}
        ${raw(chip('dc', 'đã có hóa đơn', sum['da-co'], 'neutral'))}${raw(chip('nk', 'ngoài kỳ', sum['ngoai-ky'], 'neutral'))}
      </div>
      ${raw(sum.chan ? `<div class="alert alert-warning" style="margin-bottom:10px"><span class="ic">${HH.ic('alert', 16)}</span>
        <div><b>${sum.chan}</b> phòng bị chặn vì thiếu hoặc sai chỉ số điện. Bổ sung rồi mở lại Chốt sổ, các phòng còn lại vẫn chốt được ngay.</div></div>` : '')}
      ${raw(rows.length ? `<div class="dt-wrap"><div class="dt-scroll" style="max-height:340px;overflow:auto"><table class="dt dt-cards">
        <thead><tr><th>Phòng</th><th>Khách</th><th class="num">Điện dùng</th><th class="num">Dự kiến</th><th>Tình trạng</th></tr></thead>
        <tbody>${trs}</tbody></table></div></div>` : '<div class="alert alert-info"><span class="ic">' + HH.ic('info', 16) + '</span><div>Tòa này chưa có hợp đồng đang hiệu lực.</div></div>')}
      <div id="csFoot" class="muted text-sm" style="margin-top:10px"></div>`;

    UI.modal({ title: `Chốt sổ ${S.periodLabel(period)} · ${ctx.building.name}`, size: 'xwide', bodyHtml: body,
      footHtml: `${sum['thieu-chi-so'] ? '<button class="btn btn-outline" id="toReadings">Bổ sung chỉ số</button>' : '<button class="btn btn-outline" data-close>Đóng</button>'}
        <span class="spacer"></span><button class="btn btn-primary" id="csGo">Tạo hóa đơn nháp</button>`,
      onMount(el, close) {
        const tr = el.querySelector('#toReadings'); if (tr) tr.onclick = () => { close(); HH.router.go(`/b/${ctx.bid}/readings`); };
        const boxes = Array.from(el.querySelectorAll('[data-cs]')), go = el.querySelector('#csGo'), foot = el.querySelector('#csFoot');
        const chonDuoc = () => boxes.filter(b => b.checked).map(b => b.dataset.cs);
        const cap = () => {
          const ids = chonDuoc(), tong = rows.filter(r => ids.includes(r.contractId)).reduce((s, r) => s + (r.duKien || 0), 0);
          go.disabled = !ids.length; go.textContent = ids.length ? `Tạo ${ids.length} hóa đơn nháp` : 'Chưa chọn phòng nào';
          foot.innerHTML = ids.length ? `Đã chọn <b>${ids.length}</b> phòng · tổng dự kiến <b class="mono">${U.currency(tong)}</b>` : '';
        };
        boxes.forEach(b => b.onchange = cap); cap();
        go.onclick = () => {
          const ids = chonDuoc(); if (!ids.length) return;
          go.classList.add('loading'); go.disabled = true;
          const res = S.createBatch(ctx.bid, period, ids);
          if (!res) { UI.toast('Không tạo được hóa đơn nào (có thể phòng vừa được chốt ở nơi khác)', { type: 'warning' }); close(); HH.router.render(); return; }
          HH.router.render();                      // danh sách phía sau cập nhật ngay
          closingDone(ctx, el, close, res.batch);
        };
      },
    });
  }

  // Bước 2 của chốt sổ: đã có hóa đơn nháp, hỏi có phát hành luôn không
  function closingDone(ctx, el, close, batch) {
    el.querySelector('.dialog-body').innerHTML = h`
      <div class="alert alert-success" style="margin-bottom:14px"><span class="ic">✓</span>
        <div>Đã tạo <b>${batch.invoiceCount}</b> hóa đơn nháp, tổng <b class="mono">${U.currency(batch.totalAmount)}</b>.</div></div>
      <p class="muted">Hóa đơn nháp <b>chưa gửi cho khách</b> (khách chưa thấy trong app). Bạn có thể rà soát từng hóa đơn trước, hoặc phát hành cả đợt ngay.
        Sai thì <b>Hoàn tác đợt</b> để xóa nháp và làm lại.</p>`;
    const foot = el.querySelector('.dialog-foot');
    foot.innerHTML = `<button class="btn btn-outline" id="csUndo">Hoàn tác đợt này</button><span class="spacer"></span>
      <button class="btn btn-outline" id="csLater">Để rà soát trước</button><button class="btn btn-primary" id="csIssue">${HH.ic('send', 16)} Phát hành ${batch.invoiceCount} hóa đơn</button>`;
    foot.querySelector('#csLater').onclick = close;
    foot.querySelector('#csIssue').onclick = () => { close(); issueBatchFlow(ctx, batch.id); };
    foot.querySelector('#csUndo').onclick = () => { close(); undoBatchDialog(ctx, batch.id); };
  }

  function issueBatchFlow(ctx, batchId) {
    const ids = S.invoicesOfBatch(batchId).filter(i => i.status === 'draft').map(i => i.id);
    if (!ids.length) { UI.toast('Đợt này không còn hóa đơn nháp để phát hành', { type: 'warning' }); return; }
    issueFlow(ctx, ids, null, () => S.issueBatch(batchId));
  }

  function undoBatchDialog(ctx, batchId) {
    const b = S.invoiceBatches.find(x => x.id === batchId); if (!b) return;
    const inv = S.invoicesOfBatch(batchId);
    const daThu = inv.filter(i => (i.paid || 0) > 0).length, daPh = inv.filter(i => i.status !== 'draft' && i.status !== 'cancelled' && !(i.paid > 0)).length;
    UI.dangerDialog({
      title: `Hoàn tác đợt chốt sổ ${S.periodLabel(b.period)}`,
      description: `Đợt có <b>${inv.length}</b> hóa đơn (${U.currency(b.totalAmount)}).`,
      consequences: [`Hóa đơn nháp bị xóa hẳn`, daPh ? `${daPh} hóa đơn đã phát hành mà chưa thu tiền sẽ bị hủy, khách không còn thấy` : 'Không có hóa đơn đã phát hành nào bị hủy',
        daThu ? `${daThu} hóa đơn đã có thu tiền được GIỮ NGUYÊN` : 'Không có hóa đơn nào đã thu tiền', 'Chốt sổ lại được cho các phòng đó', 'Thao tác được ghi vào nhật ký'],
      confirmLabel: 'Hoàn tác đợt', reasonLabel: 'Lý do hoàn tác',
      onConfirm: (reason) => {
        const r = S.undoBatch(batchId, reason);
        if (!r.ok) { UI.toast(r.reason, { type: 'error' }); return; }
        UI.toast(`Đã hoàn tác: xóa ${r.xoa} nháp, hủy ${r.huy} hóa đơn${r.giu.length ? `, giữ ${r.giu.length} hóa đơn đã có thu tiền` : ''}`, { type: 'ok', sticky: !!r.giu.length });
        HH.router.render();
      },
    });
  }

  const BATCH_ST = { draft: ['Nháp, chưa phát hành', 'warning'], issued: ['Đã phát hành', 'success'], undone: ['Đã hoàn tác', 'neutral'], partial: ['Hoàn tác một phần', 'warning'] };
  function batchPanel(ctx, period) {
    const list = S.batchesOf(ctx.bid, period); if (!list.length) return '';
    return `<div class="reminder-box" style="margin-bottom:16px"><div class="rem-head"><span>${HH.ic('receipt', 16)}</span><b>Các đợt chốt sổ ${S.periodLabel(period)}</b></div>
      ${list.map(b => { const st = BATCH_ST[b.status] || BATCH_ST.draft, ds = S.invoicesOfBatch(b.id).filter(i => i.status === 'draft').length;
        return `<div class="rem-line"><div class="grow"><b>${b.invoiceCount} hóa đơn · ${U.currency(b.totalAmount)}</b>
          <div class="muted text-xs">${U.fmtDate(b.createdAt)} ${new Date(b.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · ${U.esc(b.createdBy || '')} · <span class="badge s-${st[1]}">${st[0]}</span></div></div>
          ${ds ? `<button class="btn btn-sm btn-primary" data-bissue="${U.esc(b.id)}">Phát hành ${ds}</button>` : ''}
          ${b.status !== 'undone' ? `<button class="btn btn-sm btn-outline" data-bundo="${U.esc(b.id)}">Hoàn tác đợt</button>` : ''}</div>`; }).join('')}</div>`;
  }

  function issueFlow(ctx, ids, clear, doIssue) {
    const steps = ['Đang phát hành hóa đơn...', 'Đang cập nhật công nợ...', 'Đang lưu...'];
    const m = UI.modal({ title: 'Phát hành hóa đơn', dismissable: false,
      bodyHtml: `<div class="progress-track" style="margin-bottom:12px"><div class="progress-fill" id="issueProg" style="width:5%"></div></div>
        <p class="muted" id="issueStep">${steps[0]}</p>`,
      footHtml: undefined });
    let s = 0; const prog = m.el.querySelector('#issueProg'); const label = m.el.querySelector('#issueStep');
    const timer = setInterval(() => {
      s++; prog.style.width = Math.min(100, 5 + s * 33) + '%';
      if (s < steps.length) label.textContent = steps[s];
      if (s >= 3) { clearInterval(timer); (doIssue || (() => S.issueInvoices(ids)))();
        setTimeout(() => { m.close(); clear && clear(); UI.toast(`Đã phát hành ${ids.length} hóa đơn. Khách xem được trong app khách thuê.`, { type: 'ok' }); HH.router.render(); }, 300); }
    }, 550);
  }

  function cancelInvoice(ctx, inv) {
    if (inv.paid > 0) {
      UI.toast('Không thể hủy hóa đơn đã có thanh toán. Bạn có thể phát hành hóa đơn bù.', { type: 'error', sticky: true });
      return;
    }
    UI.dangerDialog({
      title: 'Hủy hóa đơn đã phát hành',
      description: `Hóa đơn <b>${inv.id}</b> đã được gửi tới khách thuê ngày ${U.fmtDate(inv.dueDate)}.`,
      consequences: ['Khách thuê sẽ nhận thông báo hủy', 'Công nợ kỳ này được tính lại', 'Thao tác được ghi vào nhật ký hệ thống'],
      confirmLabel: 'Xác nhận hủy', reasonLabel: 'Lý do hủy',
      onConfirm: (reason) => { S.cancelInvoice(inv.id, reason); UI.toast('Đã hủy hóa đơn', { type: 'ok' }); HH.router.render(); },
    });
  }

  /* ================= CHI TIẾT HÓA ĐƠN (§3.8) ================= */
  HH.pages.invoiceDetail = {
    render(ctx) {
      const inv = S.invoice(ctx.params.iid);
      if (!inv) return `<div class="alert alert-danger"><span class="ic">${HH.ic('alert', 16)}</span><div>Không tìm thấy hóa đơn.</div></div>`;
      ctx._inv = inv;
      const lines = inv.lines.map(l => `<div class="inv-line"><div class="l-main">
        <div class="l-name">${l.label}</div><div class="l-basis">${l.meta || ''}</div>
        ${l.type === 'elec' ? '<a href="#" class="text-xs" data-meter>Xem ảnh đồng hồ</a>' : ''}</div>
        <div class="l-amt">${U.currency(l.amount)}</div></div>`).join('');
      const pays = S.paymentsOf(inv.id);
      const payRows = pays.length ? pays.map(p => `<div class="between" style="padding:10px 0;border-bottom:1px solid var(--neutral-100)">
        <div><span class="mono b">${U.esc(p.receiptNo || '')}</span>
          <div class="muted text-xs mono">${U.fmtDate(p.date)} · ${U.esc(p.method || '')}${p.createdBy ? ', ' + U.esc(p.createdBy) : ''}</div></div>
        <div class="row-gap-3"><span class="mono b" style="color:var(--success)">${U.currency(p.amount)}</span>
          <button class="btn btn-sm btn-outline" data-printrc="${p.id}">${HH.ic('print', 16)} Phiếu thu</button></div></div>`).join('')
        : '<p class="muted center" style="padding:12px">Chưa có thanh toán nào</p>';
      const remaining = inv.total - inv.paid;
      const editedBanner = inv.edited ? `<div class="alert alert-purple" style="margin-bottom:16px"><span class="ic">${HH.ic('edit', 16)}</span>
        <div>Hóa đơn này đã được chỉnh sửa ngày ${U.fmtDate(inv.editedAt)} bởi ${inv.editedBy}. <a href="#/logs">Xem nhật ký</a></div></div>` : '';

      return h`<div class="inv-doc" style="margin:0 auto">
        <div class="page-head"><div><a class="back-link" href="#/b/${ctx.bid}/invoices">← Hóa đơn</a>
          <div class="page-title mono">${inv.id}</div></div>
          <div class="page-actions">
            ${raw(inv.status === 'draft' ? '<button class="btn btn-primary" id="invIssue">' + HH.ic('send', 16) + ' Phát hành</button>' : '')}
            ${raw(remaining > 0 && inv.status !== 'draft' && inv.status !== 'cancelled'
              ? `<button class="btn btn-primary" id="invCollect">₫ Thu tiền</button>` : '')}
            <button class="btn btn-outline" id="invPrint">${HH.ic('print', 16)} In</button>
            <button class="kebab" id="invMenu" style="border:1px solid var(--neutral-200)">⋯</button></div></div>
        ${raw(editedBanner)}
        ${raw(inv.status === 'draft' ? `<div class="alert alert-info" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
          <div><b>Hóa đơn đang ở trạng thái nháp.</b> Hãy rà soát rồi bấm <b>Phát hành</b>. Sau khi phát hành mới gửi khách & thu tiền được.</div></div>` : '')}
        <div class="card inv-header-card">
          <div style="margin-bottom:12px">${raw(UI.statusBadge(inv.status, 'invoice'))}</div>
          <div class="b text-lg">Phòng ${inv.roomCode} · ${inv.tenantName}</div>
          <div class="muted mono">Kỳ ${U.fmtDate(inv.periodStart)} đến ${U.fmtDate(inv.periodEnd)}</div>
          <div class="muted mono">Hạn thanh toán: ${U.fmtDate(inv.dueDate)}</div>
          <hr style="border:none;border-top:1px solid var(--neutral-200);margin:16px 0">
          ${raw(lines)}
          <hr style="border:none;border-top:1px solid var(--neutral-200);margin:16px 0">
          <div class="inv-total-row"><span>Đã thanh toán</span><span class="amt" style="color:var(--success)">${U.currency(inv.paid)}</span></div>
          <div class="inv-total-row"><span>Còn lại</span><span class="amt" style="color:${raw(remaining > 0 ? 'var(--danger)' : 'inherit')}">${U.currency(remaining)}</span></div>
          <div class="inv-total-row grand"><span>Tổng cộng</span><span class="amt">${U.currency(inv.total)}</span></div>
        </div>
        ${raw(splitCard(inv))}
        <h3 style="margin:24px 0 8px">Lịch sử thanh toán</h3>
        <div class="card card-pad">${raw(payRows)}</div>
      </div>`;
    },
    mount(ctx) {
      const inv = ctx._inv; if (!inv) return;
      const mb = document.getElementById('invMenu');
      if (mb) mb.onclick = () => UI.openMenu(mb, [
        { icon: HH.ic('print', 16), label: 'In hóa đơn', onClick: () => printInvoice(ctx, inv) },
        { icon: HH.ic('send', 16), label: 'Gửi lại cho khách', onClick: () => { S.log('invoice.resend', `Gửi lại hóa đơn ${inv.id} cho khách`); UI.toast('Đã ghi nhận gửi lại cho khách', { type: 'ok' }); } },
        ...(inv.status !== 'paid' && inv.status !== 'cancelled' ? [{ icon: '₫', label: 'Ghi nhận thanh toán', onClick: () => paymentDialog(ctx, inv) }] : []),
        ...(S.isOwner() && inv.status !== 'cancelled' ? [{ sep: true }, { icon: '✕', label: 'Hủy hóa đơn', danger: true, onClick: () => cancelInvoice(ctx, inv) }] : []),
      ]);
      const ip = document.getElementById('invPrint'); if (ip) ip.onclick = () => printInvoice(ctx, inv);
      const ii = document.getElementById('invIssue'); if (ii) ii.onclick = () => issueFlow(ctx, [inv.id], null);
      const ic = document.getElementById('invCollect'); if (ic) ic.onclick = () => paymentDialog(ctx, inv);
      document.querySelectorAll('[data-printrc]').forEach(b => b.onclick = () => {
        const p = S.payment(b.dataset.printrc); if (!p) return;
        printReceipt(ctx, receiptGroup(ctx, p));
      });
      wireSplit(inv);
      const meter = document.querySelector('[data-meter]');
      if (meter) meter.onclick = (e) => { e.preventDefault();
        UI.modal({ title: 'Ảnh đồng hồ điện', bodyHtml: `<div class="ocr-img" style="min-height:280px">${HH.ic('bolt', 16)} Chưa có ảnh đồng hồ cho kỳ này</div>`,
          footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` }); };
    },
  };

  /* ================= CHIA HÓA ĐƠN CHO NGƯỜI Ở (js/split.js) ================= */
  const occupantsOf = (inv) => S.tenantsOf(inv.buildingId).filter(t => t.roomCode === inv.roomCode)
    .sort((a, b) => (b.isRep ? 1 : 0) - (a.isRep ? 1 : 0));

  function splitResult(inv) {
    const ppl = occupantsOf(inv);
    if (ppl.length < 2 || inv.status === 'draft' || inv.status === 'cancelled') return null;
    return HH.split.theoDaTra(HH.split.chia(inv.lines, ppl.map(t => ({ id: t.id, ten: t.fullName }))), inv.paid);
  }

  function splitCard(inv) {
    const kq = splitResult(inv); if (!kq) return '';
    const byId = Object.fromEntries(occupantsOf(inv).map(t => [t.id, t]));
    const rows = kq.nguoi.map(p => {
      const t = byId[p.id] || {};
      const chi = p.dong.filter(d => d.amount).map(d => `<div class="sp-line"><span>${U.esc(d.label)}</span><span class="mono">${U.currency(d.amount)}</span></div>`).join('');
      return `<div class="sp-person">
        <div class="sp-head"><div><b>${U.esc(p.ten || 'Chưa có tên')}</b>${t.isRep ? ' <span class="tn-tag rep">Đại diện</span>' : ''}
            <div class="muted text-xs">${U.esc(t.phone || 'Chưa có số điện thoại')}</div></div>
          <div class="sp-amt"><b class="mono">${U.currency(p.tong)}</b>
            ${p.daTra ? `<div class="muted text-xs">${p.conNo > 0 ? 'còn lại ' + U.currency(p.conNo) : 'đã đóng đủ'}</div>` : ''}</div></div>
        <details class="sp-more"><summary>Chi tiết phần này</summary>${chi}</details>
        <div class="row-gap-2" style="margin-top:8px">
          <button class="btn btn-sm btn-outline" data-spcopy="${U.esc(p.id)}">Chép tin nhắn</button>
          ${t.phone ? `<a class="btn btn-sm btn-outline" data-spzalo="${U.esc(p.id)}" href="https://zalo.me/${U.esc(String(t.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">Mở Zalo</a>` : ''}
        </div></div>`;
    }).join('');
    return `<h3 style="margin:24px 0 4px">Chia cho ${kq.nguoi.length} người ở</h3>
      <p class="muted text-sm" style="margin:0 0 8px">Chia ${kq.deu ? 'đều theo đầu người' : 'theo tỉ lệ'}, tổng các phần đúng bằng hóa đơn.
        Hệ thống vẫn ghi thu theo cả phòng; phần dưới đây để mỗi người biết mình đóng bao nhiêu và chuyển cùng nội dung <b class="mono">${U.esc(S.transferContent(inv) || '')}</b>.</p>
      <div class="card card-pad sp-wrap">${rows}</div>`;
  }

  function wireSplit(inv) {
    const kq = splitResult(inv); if (!kq) return;
    const text = (id) => {
      const p = kq.nguoi.find(x => x.id === id);
      return HH.split.soanTin(p, { phong: inv.roomCode, ky: inv.period, noiDungCK: S.transferContent(inv),
        taiKhoan: HH.reminders.taiKhoan(window.HH_CONFIG), nguoiGui: S.prefs.userName });
    };
    const chep = (id) => (navigator.clipboard && navigator.clipboard.writeText)
      ? navigator.clipboard.writeText(text(id)).then(() => UI.toast('Đã chép tin nhắn', { type: 'ok' }),
          () => UI.toast('Trình duyệt không cho chép tự động', { type: 'warning' }))
      : UI.toast('Trình duyệt không hỗ trợ sao chép', { type: 'error' });
    document.querySelectorAll('[data-spcopy]').forEach(b => b.onclick = () => chep(b.dataset.spcopy));
    // Zalo không nhận sẵn nội dung qua đường dẫn: chép trước để người dùng dán
    document.querySelectorAll('[data-spzalo]').forEach(a => a.addEventListener('click', () => chep(a.dataset.spzalo)));
  }

  /* ================= GHI NHẬN THANH TOÁN (§3.9) ================= */
  function paymentDialog(ctx, invoice) {
    // các hóa đơn còn nợ của cùng hợp đồng, cũ trước
    const debts = S.invoicesForContract(invoice.contractId)
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .sort((a, b) => a.period.localeCompare(b.period));
    const totalDebt = debts.reduce((s, i) => s + (i.total - i.paid), 0);
    const c = S.contract(invoice.contractId);

    UI.modal({ title: 'Ghi nhận thanh toán', size: 'wide', bodyHtml: h`
      <div class="grid-2">
        <div class="field"><label>Hợp đồng</label><div class="b">${invoice.roomCode} · ${invoice.tenantName}</div></div>
        <div class="field"><label>Công nợ</label><div class="mono b" style="color:var(--danger)">${U.currency(totalDebt)}</div></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Số tiền nhận (₫)</label>
        <input class="input money" id="payAmt" placeholder="0" value="${U.number(totalDebt)}"></div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Hình thức</label><select class="select" id="payMethod"><option>Chuyển khoản</option><option>Tiền mặt</option><option>Ví điện tử</option></select></div>
        <div class="field"><label>Ngày nhận</label><input class="input" type="date" id="payDate" value="${U.dateKey()}"></div>
      </div>
      <div class="field" style="margin-top:12px"><label>Nội dung chuyển khoản</label><input class="input" id="payNote" placeholder="VD: ${invoice.roomCode} T${Number(S.period().slice(5, 7))}"></div>
      <div class="field" style="margin-top:12px"><label>Chứng từ</label><label class="btn btn-outline btn-sm" style="width:fit-content">${HH.ic('upload', 16)} Tải ảnh<input type="file" hidden></label></div>
      <h4 style="margin:20px 0 8px">Phân bổ tự động <span class="muted text-xs" style="font-weight:400">· trả trước cho hóa đơn kỳ cũ nhất</span></h4>
      <div class="alloc-box" id="allocBox"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="doPay">Ghi nhận</button>`,
      onMount(el, close) {
        const amtInp = el.querySelector('#payAmt');
        const box = el.querySelector('#allocBox');
        const renderAlloc = () => {
          let amt = U.parseNum(amtInp.value) || 0;
          let rows = '';
          debts.forEach(i => {
            const need = i.total - i.paid;
            const applied = Math.min(need, amt);
            amt -= applied;
            const full = applied >= need;
            rows += `<div class="alloc-row"><span>${i.id} · ${i.period}</span>
              <span class="a-amt">${U.currency(need)}</span>
              ${applied > 0 ? (full ? '<span class="a-check">✓</span>' : `<span class="a-partial">${U.currency(applied)} / ${U.currency(need)}</span>`) : '<span class="faint">-</span>'}</div>`;
          });
          // Hệ thống chưa có sổ "tiền thừa chuyển kỳ sau", nên không cho nhập quá công nợ (xem luật #payAmt bên dưới)
          rows += `<div class="alloc-row" style="border-top:2px solid var(--neutral-200)"><b>Còn nợ sau khi thu</b>
            <b class="a-amt">${U.currency(Math.max(0, totalDebt - (U.parseNum(amtInp.value) || 0)))}</b></div>`;
          box.innerHTML = rows;
        };
        amtInp.oninput = () => { const n = U.parseNum(amtInp.value); amtInp.value = n != null ? U.number(n) : ''; renderAlloc(); };
        renderAlloc();
        const rules = UI.formRules(el, [
          { el: '#payAmt', ten: 'Số tiền nhận', kiem: (v) => {
              const n = V.docTien(v);
              if (n == null || n <= 0) return 'Nhập số tiền lớn hơn 0';
              if (n > totalDebt) return `Nhiều hơn công nợ ${U.currency(totalDebt)}, nhập tối đa số này`;
            } },
          { el: '#payDate', ten: 'Ngày nhận', kiem: (v) => V.ngayHopLe(v, { ten: 'Ngày nhận', khongTuongLai: true }) },
        ]);
        el.querySelector('#doPay').onclick = (e) => {
          if (!rules.check()) return;
          let amt = U.parseNum(amtInp.value) || 0;
          e.currentTarget.classList.add('loading');
          const method = el.querySelector('#payMethod').value;
          const date = new Date(el.querySelector('#payDate').value).toISOString();
          const note = el.querySelector('#payNote').value;
          setTimeout(() => {
            const receiptNo = S.nextReceiptNo(date);   // 1 lần thu = 1 phiếu thu chung
            const made = [];
            debts.forEach(i => { const need = i.total - i.paid; const applied = Math.min(need, amt);
              if (applied > 0) { made.push(S.recordPayment(i.id, applied, method, date, note, receiptNo)); amt -= applied; } });
            close();
            UI.toast(`Đã thu ${U.currency(made.reduce((s, p) => s + p.amount, 0))} · phiếu ${receiptNo}`, { type: 'ok', celebrate: true });
            if (made.length) receiptDialog(ctx, made, amt);   // amt còn dư = tiền thừa
            HH.router.render();
          }, 500);
        };
      },
    });
  }

  /* ================= PHIẾU THU ================= */
  function receiptDialog(ctx, pays, credit) {
    const total = pays.reduce((s, p) => s + p.amount, 0);
    const p0 = pays[0];
    const lines = pays.map(p => { const inv = S.invoice(p.invoiceId);
      return `<div class="alloc-row"><span>${p.invoiceId}${inv ? ' · ' + S.periodLabel(inv.period) : ''}</span>
        <span class="a-amt">${U.currency(p.amount)}</span></div>`; }).join('');
    UI.modal({
      title: 'Đã thu tiền', size: '',
      bodyHtml: h`
        <div class="alert alert-success" style="margin-bottom:14px"><span class="ic">✓</span>
          <div>Đã ghi nhận <b>${U.currency(total)}</b> · Phiếu thu <b class="mono">${p0.receiptNo}</b></div></div>
        <div class="grid-2">
          <div class="field"><label>Phòng</label><div class="b">${p0.roomCode || ''}</div></div>
          <div class="field"><label>Khách thuê</label><div class="b">${p0.tenantName || ''}</div></div>
          <div class="field"><label>Hình thức</label><div>${p0.method}</div></div>
          <div class="field"><label>Ngày thu</label><div class="mono">${U.fmtDate(p0.date)}</div></div>
        </div>
        <h4 style="margin:14px 0 6px">Phân bổ vào hóa đơn</h4>
        <div class="alloc-box">${raw(lines)}
          ${raw(credit > 0 ? `<div class="alloc-row" style="border-top:2px solid var(--neutral-200)">
            <b>Tiền thừa (ghi nhận cho kỳ sau)</b><b class="a-amt" style="color:var(--info)">${U.currency(credit)}</b></div>` : '')}
        </div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span>
        <button class="btn btn-primary" id="printReceipt">${HH.ic('print', 16)} In phiếu thu</button>`,
      onMount(el) { el.querySelector('#printReceipt').onclick = () => printReceipt(ctx, pays); },
    });
  }

  // Gom các khoản cùng 1 phiếu thu (dữ liệu cũ chưa có số phiếu -> chỉ lấy chính nó)
  function receiptGroup(ctx, p) {
    if (!p.receiptNo) return [p];
    return S.paymentsOfBuilding(ctx.bid).filter(x => x.receiptNo === p.receiptNo);
  }

  function printReceipt(ctx, pays) {
    if (!pays || !pays.length) { UI.toast('Không tìm thấy phiếu thu', { type: 'error' }); return; }
    const b = S.building(ctx.bid) || {};
    // bổ sung thông tin còn thiếu ở dữ liệu cũ
    pays = pays.map(p => {
      const inv = S.invoice(p.invoiceId) || {};
      return Object.assign({}, p, {
        receiptNo: p.receiptNo || ('PT-' + String(p.id || '').slice(-6).toUpperCase()),
        roomCode: p.roomCode || inv.roomCode || '',
        tenantName: p.tenantName || inv.tenantName || '',
        createdBy: p.createdBy || S.prefs.userName,
      });
    });
    const p0 = pays[0];
    const total = pays.reduce((s, p) => s + p.amount, 0);
    const rows = pays.map(p => { const inv = S.invoice(p.invoiceId);
      return `<tr><td>${U.esc(p.invoiceId)}</td><td>${inv ? S.periodLabel(inv.period) : ''}</td>
        <td class="r">${U.currency(p.amount)}</td></tr>`; }).join('');
    const win = window.open('', '_blank', 'width=800,height=760');
    if (!win) { UI.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép popup.', { type: 'error' }); return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${U.esc(p0.receiptNo)}</title>
      <style>body{font-family:'Times New Roman',serif;font-size:14px;color:#000;max-width:640px;margin:26px auto;padding:0 18px;line-height:1.6}
      .head{text-align:center;margin-bottom:16px}.brand{font-weight:700;font-size:15px}
      h1{font-size:21px;margin:10px 0 2px;letter-spacing:1px}.no{color:#555;font-family:monospace}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #333;padding:6px 9px;font-size:13px}
      .r{text-align:right}.tot{display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:2px solid #000;padding-top:8px;margin-top:6px}
      .info td{border:none;padding:3px 0}.words{font-style:italic;margin-top:6px}
      .sign{display:flex;justify-content:space-around;margin-top:40px;text-align:center}.sign div{width:45%}
      .sign i{font-size:12px;color:#555}@media print{body{margin:0}}</style></head><body>
      <div class="head"><img src="${U.asset('logo-mark.svg')}" alt="" style="width:40px;height:auto;display:block;margin:0 auto 4px">
        <div class="brand">${U.esc(b.name || 'HAPPY HOME')}</div>
        <div style="font-size:12px;color:#555">${U.esc(b.address || '')}</div>
        <h1>PHIẾU THU</h1><div class="no">Số: ${U.esc(p0.receiptNo)}</div></div>
      <table class="info">
        <tr><td style="width:34%">Họ tên người nộp</td><td><b>${U.esc(p0.tenantName || '')}</b></td></tr>
        <tr><td>Phòng</td><td><b>${U.esc(p0.roomCode || '')}</b></td></tr>
        <tr><td>Hình thức thanh toán</td><td>${U.esc(p0.method || '')}</td></tr>
        <tr><td>Ngày thu</td><td>${U.fmtDate(p0.date)}</td></tr>
        <tr><td>Lý do nộp</td><td>${U.esc(p0.note || 'Thanh toán tiền phòng và dịch vụ')}</td></tr>
      </table>
      <table><thead><tr><th>Mã hóa đơn</th><th>Kỳ</th><th class="r">Số tiền</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><span>TỔNG CỘNG</span><span>${U.currency(total)}</span></div>
      <div class="words">Bằng chữ: ${U.esc(docSo(total))}</div>
      <div class="sign">
        <div><b>NGƯỜI NỘP TIỀN</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${U.esc(p0.tenantName || '')}</div>
        <div><b>NGƯỜI THU TIỀN</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${U.esc(p0.createdBy || '')}</div>
      </div>
      <script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  }

  // Đọc số tiền thành chữ (tiếng Việt)
  function docSo(n) {
    if (!n) return 'Không đồng';
    const d = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const doc3 = (num, full) => {
      const tr = Math.floor(num / 100), ch = Math.floor((num % 100) / 10), dv = num % 10;
      let s = '';
      if (full || tr > 0) s += d[tr] + ' trăm';
      if (ch === 0) { if (dv > 0) s += (s ? ' lẻ ' : '') + d[dv]; }
      else if (ch === 1) { s += (s ? ' ' : '') + 'mười'; if (dv === 1) s += ' một'; else if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + d[dv]; }
      else { s += (s ? ' ' : '') + d[ch] + ' mươi'; if (dv === 1) s += ' mốt'; else if (dv === 5) s += ' lăm'; else if (dv > 0) s += ' ' + d[dv]; }
      return s.trim();
    };
    const units = ['', ' nghìn', ' triệu', ' tỷ'];
    const groups = []; let x = Math.round(n);
    while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
    let out = '';
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i] === 0) continue;
      out += (out ? ' ' : '') + doc3(groups[i], i < groups.length - 1) + units[i];
    }
    out = out.trim();
    return out.charAt(0).toUpperCase() + out.slice(1) + ' đồng';
  }

  /* ================= THANH TOÁN & CÔNG NỢ ================= */
  HH.pages.payments = {
    render(ctx) {
      ctx._ptab = ctx._ptab || 'debt';
      const contracts = S.contractsOf(ctx.bid).filter(c => c.status === 'active' || c.status === 'terminating' || c.status === 'expired');
      const rows = contracts.map(c => {
        const list = S.invoicesForContract(c.id).filter(i => i.status !== 'paid' && i.status !== 'cancelled');
        const debt = list.reduce((s, i) => s + (i.total - i.paid), 0);
        const oldest = list.sort((a, b) => (a.period || '').localeCompare(b.period || ''))[0];
        const overdue = list.some(i => S.isOverdue(i));
        return { c, debt, count: list.length, oldest, overdue };
      }).filter(x => x.debt > 0).sort((a, b) => b.debt - a.debt);
      const total = rows.reduce((s, x) => s + x.debt, 0);
      const overdueTotal = rows.filter(x => x.overdue).reduce((s, x) => s + x.debt, 0);

      // ----- Phiếu thu kỳ đang chọn -----
      const per = S.period();
      const pays = S.paymentsOfBuilding(ctx.bid, per).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const collected = pays.reduce((s, p) => s + p.amount, 0);

      const cards = `<div class="metric-grid">
        ${UI.metricCard({ label: 'Tổng công nợ', value: total, format: 'currency', intent: 'warning', sub: rows.length + ' khách còn nợ' })}
        ${UI.metricCard({ label: 'Trong đó quá hạn', value: overdueTotal, format: 'currency', intent: 'danger' })}
        ${UI.metricCard({ label: `Đã thu ${S.periodLabel(per)}`, value: collected, format: 'currency', intent: 'success', sub: pays.length + ' phiếu thu' })}
        ${UI.metricCard({ label: 'Số phiếu thu', value: pays.length, format: 'number' })}
      </div>`;

      let body;
      if (ctx._ptab === 'debt') {
        const dt = UI.DataTable({
          rows, rowId: x => x.c.id, searchKeys: [],
          searchable: false,
          emptyTitle: 'Không có công nợ', emptyIcon: '✓', emptyDesc: 'Tất cả hóa đơn đã được thanh toán.',
          columns: [
            { key: 'room', label: 'Phòng', render: x => `<b>${x.c.roomCode}</b>` },
            { key: 'tenant', label: 'Khách thuê', render: x => U.esc(x.c.tenantName) },
            { key: 'count', label: 'Số HĐ nợ', align: 'right', render: x => x.count },
            { key: 'oldest', label: 'Kỳ nợ cũ nhất', render: x => x.oldest ? S.periodLabel(x.oldest.period) : '-' },
            { key: 'debt', label: 'Công nợ', align: 'right', sortable: true, sortVal: x => x.debt,
              render: x => `<span style="color:var(--danger);font-weight:700">${U.currency(x.debt)}</span>` },
            { key: 'st', label: '', render: x => x.overdue ? '<span class="badge s-danger"><span class="dot"></span>Quá hạn</span>' : '' },
            { key: 'act', label: '', render: x => `<button class="btn btn-sm btn-primary" data-collect="${x.c.id}">₫ Thu tiền</button>` },
          ],
          rowClass: x => x.overdue ? 'row-expired' : '',
        });
        ctx._dt = dt;
        body = dt.render();
      } else {
        const dt = UI.DataTable({
          rows: pays, rowId: p => p.id, searchKeys: ['receiptNo', 'roomCode', 'tenantName', 'invoiceId'],
          searchPlaceholder: 'Tìm số phiếu, phòng, khách...',
          emptyTitle: 'Chưa có phiếu thu nào trong kỳ', emptyIcon: HH.ic('receipt', 16),
          toolbarRight: `<button class="btn btn-success" id="payExport">${HH.ic('sheet', 16)} Xuất excel</button>`,
          columns: [
            { key: 'receiptNo', label: 'Số phiếu', mono: true, render: p => `<b class="mono">${U.esc(p.receiptNo || p.id)}</b>` },
            { key: 'date', label: 'Ngày thu', sortable: true, sortVal: p => p.date, render: p => `<span class="mono">${U.fmtDate(p.date)}</span>` },
            { key: 'roomCode', label: 'Phòng', render: p => p.roomCode || '-' },
            { key: 'tenantName', label: 'Khách thuê', render: p => U.esc(p.tenantName || '') },
            { key: 'invoiceId', label: 'Hóa đơn', mono: true },
            { key: 'method', label: 'Hình thức' },
            { key: 'amount', label: 'Số tiền', align: 'right', sortable: true, render: p => `<b class="mono" style="color:var(--success)">${U.currency(p.amount)}</b>` },
          ],
          actions: p => [
            { icon: HH.ic('print', 16), label: 'In phiếu thu', onClick: () => printReceipt(ctx, receiptGroup(ctx, p)) },
            ...(S.isOwner() ? [{ sep: true }, { icon: HH.ic('undo', 16), label: 'Hủy phiếu thu', danger: true, onClick: () => cancelReceipt(ctx, p) }] : []),
          ],
        });
        ctx._dt = dt;
        body = dt.render();
      }

      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Thanh toán & công nợ</div>
          <div class="page-sub">${ctx.building.name} · kỳ ${S.periodLabel(per)}</div></div></div>
        <div class="page-actions"><a class="btn btn-outline" href="#/b/${ctx.bid}/reminders">${raw(HH.ic('megaphone', 16))} Nhắc nợ</a></div>
      </div>
      <div id="periodSel" style="margin-bottom:16px"></div>
      ${raw(cards)}
      <div class="tabs" style="margin:16px 0">
        <button class="tab ${raw(ctx._ptab === 'debt' ? 'active' : '')}" data-ptab="debt">${HH.ic('wallet', 16)} Công nợ cần thu (${rows.length})</button>
        <button class="tab ${raw(ctx._ptab === 'receipt' ? 'active' : '')}" data-ptab="receipt">${HH.ic('receipt', 16)} Phiếu thu (${pays.length})</button>
      </div>
      ${raw(body)}`;
    },
    mount(ctx) {
      mountPeriodSelector();
      ctx._dt.attach(document);
      document.querySelectorAll('[data-ptab]').forEach(b => b.onclick = () => { ctx._ptab = b.dataset.ptab; HH.router.render(); });
      document.querySelectorAll('[data-collect]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const inv = S.invoicesForContract(b.dataset.collect)
          .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
          .sort((x, y) => (x.period || '').localeCompare(y.period || ''))[0];
        if (inv) paymentDialog(ctx, inv); else UI.toast('Không còn hóa đơn cần thu', { type: 'ok' });
      });
      const ex = document.getElementById('payExport');
      if (ex) ex.onclick = () => {
        const pays = S.paymentsOfBuilding(ctx.bid, S.period());
        U.downloadCSV(`phieu-thu-${ctx.bid}-${S.period()}.csv`,
          ['Số phiếu', 'Ngày thu', 'Phòng', 'Khách thuê', 'Mã HĐ', 'Hình thức', 'Số tiền', 'Người thu'],
          pays.map(p => [p.receiptNo || p.id, U.fmtDate(p.date), p.roomCode || '', p.tenantName || '',
            p.invoiceId || '', p.method || '', p.amount, p.createdBy || '']));
        UI.toast('Đã tải file Excel (CSV) phiếu thu', { type: 'ok' });
      };
    },
  };

  function cancelReceipt(ctx, p) {
    UI.dangerDialog({
      title: `Hủy phiếu thu ${p.receiptNo || p.id}`,
      description: `Số tiền <b>${U.currency(p.amount)}</b> sẽ được trả lại thành công nợ của hóa đơn ${p.invoiceId}.`,
      consequences: ['Công nợ của khách tăng trở lại', 'Phiếu thu bị xóa khỏi sổ', 'Thao tác được ghi vào nhật ký'],
      confirmLabel: 'Hủy phiếu thu', reasonLabel: 'Lý do hủy',
      onConfirm: (reason) => { S.deletePayment(p.id, reason); UI.toast('Đã hủy phiếu thu', { type: 'ok' }); HH.router.render(); },
    });
  }
})();

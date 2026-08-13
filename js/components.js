/* ============================================================
   Happy Home — Thành phần giao diện dùng chung
   ============================================================ */
HH.ui = (function () {
  const U = HH.util;
  const h = U.html, raw = U.raw, esc = U.esc;

  /* ---------- Bảng quy ước trạng thái (§1.2) ---------- */
  const STATUS = {
    room: {
      vacant:   { label: 'Trống',           tone: 'success' },
      reserved: { label: 'Đã giữ chỗ',      tone: 'warning' },
      occupied: { label: 'Đang thuê',       tone: 'info' },
      notice:   { label: 'Báo trả',         tone: 'purple' },
      cleaning: { label: 'Đang dọn dẹp',    tone: 'neutral' },
      inactive: { label: 'Ngưng khai thác', tone: 'danger' },
    },
    invoice: {
      draft:     { label: 'Nháp',           tone: 'neutral' },
      issued:    { label: 'Đã phát hành',   tone: 'info' },
      partial:   { label: 'Trả một phần',   tone: 'warning' },
      paid:      { label: 'Đã thanh toán',  tone: 'success' },
      overdue:   { label: 'Quá hạn',        tone: 'danger' },
      cancelled: { label: 'Đã hủy',         tone: 'neutral', strike: true },
    },
    contract: {
      draft:       { label: 'Nháp',         tone: 'neutral' },
      active:      { label: 'Đang hiệu lực', tone: 'success' },
      expiring:    { label: 'Sắp hết hạn',  tone: 'warning' },
      terminating: { label: 'Đang trả phòng', tone: 'purple' },
      terminated:  { label: 'Đã thanh lý',  tone: 'neutral' },
      expired:     { label: 'Hết hạn',      tone: 'danger' },
    },
    asset: {
      good:    { label: 'Tốt',              tone: 'success' },
      wear:    { label: 'Hao mòn tự nhiên', tone: 'warning' },
      broken:  { label: 'Hư hỏng',          tone: 'danger' },
    },
  };

  function statusBadge(status, type) {
    const map = (STATUS[type] || {})[status] || { label: status, tone: 'neutral' };
    return h`<span class="badge s-${map.tone}${raw(map.strike ? ' strike' : '')}"><span class="dot"></span>${map.label}</span>`;
  }

  /* ---------- MetricCard ---------- */
  function metricCard(o) {
    if (o.loading) {
      return h`<div class="metric"><div class="skeleton" style="height:14px;width:60%"></div>
        <div class="skeleton" style="height:26px;width:80%"></div>
        <div class="skeleton" style="height:12px;width:40%"></div></div>`;
    }
    let valStr, title = '';
    if (o.format === 'currency') { valStr = U.currencyShort(o.value); title = U.currency(o.value); }
    else if (o.format === 'percent') valStr = U.percent(o.value);
    else valStr = U.number(o.value);
    const t = o.trend;
    const trendHtml = (t === undefined || t === null) ? '' :
      h`<div class="m-trend ${raw(t >= 0 ? 'up' : 'down')}">${raw(t >= 0 ? '▲' : '▼')} ${Math.abs(Math.round(t * 100))}% ${o.trendLabel || 'so với kỳ trước'}</div>`;
    return h`<div class="metric ${raw(o.intent ? 'intent-' + o.intent : '')} ${raw(o.big ? 'big' : '')} ${raw(o.onClick ? 'clickable' : '')}"
        ${raw(o.onClick ? `data-metric="${o.id}"` : '')} ${raw(title ? `title="${esc(title)}"` : '')}>
      <div class="m-top"><span class="m-label">${o.label}</span>${raw(o.icon ? `<span>${o.icon}</span>` : '')}</div>
      <div class="m-value">${raw(valStr)}</div>
      ${raw(trendHtml)}
      ${raw(o.sub ? `<div class="m-sub">${esc(o.sub)}</div>` : '')}
    </div>`;
  }

  /* ---------- Toast (§6.2) ---------- */
  function toastZone() {
    let z = document.getElementById('toastZone');
    if (!z) { z = document.createElement('div'); z.id = 'toastZone'; z.className = 'toast-zone'; document.body.appendChild(z); }
    return z;
  }
  function toast(msg, opt) {
    opt = opt || {};
    const z = toastZone();
    const el = document.createElement('div');
    el.className = 'toast ' + (opt.type === 'error' ? 'err' : opt.type === 'ok' ? 'ok' : '');
    const ic = opt.type === 'error' ? '⚠' : opt.type === 'ok' ? '✓' : 'ℹ';
    el.innerHTML = h`<span class="ic">${ic}</span><div class="t-body">${msg}</div>`;
    if (opt.action) {
      const b = document.createElement('button'); b.className = 't-action'; b.textContent = opt.action.label;
      b.onclick = () => { opt.action.onClick(); el.remove(); }; el.appendChild(b);
    }
    z.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, opt.sticky ? 9000 : 4000);
  }

  /* ---------- Modal chung ---------- */
  let openModals = [];
  function modal(o) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.setAttribute('role', 'presentation');
    const size = o.size ? ' ' + o.size : '';
    overlay.innerHTML = h`<div class="dialog${raw(size)}" role="dialog" aria-modal="true" aria-label="${o.title || ''}">
      <div class="dialog-head">
        <div>${raw(o.headHtml || `<h3>${esc(o.title || '')}</h3>`)}</div>
        <div class="row-gap-2">${raw(o.stepText ? `<span class="step-pill">${esc(o.stepText)}</span>` : '')}
          <button class="kebab" data-close aria-label="Đóng">✕</button></div>
      </div>
      <div class="dialog-body">${raw(o.bodyHtml || '')}</div>
      ${raw(o.footHtml !== undefined ? `<div class="dialog-foot">${o.footHtml}</div>` : '')}
    </div>`;
    document.body.appendChild(overlay);
    openModals.push(overlay);
    const close = () => { overlay.remove(); openModals = openModals.filter(m => m !== overlay); if (o.onClose) o.onClose(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay && o.dismissable !== false) close(); });
    overlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    // bẫy tiêu điểm cơ bản
    const focusable = overlay.querySelector('input,textarea,select,button:not([data-close])');
    if (focusable) setTimeout(() => focusable.focus(), 30);
    if (o.onMount) o.onMount(overlay, close);
    return { el: overlay, close };
  }
  function closeTopModal() {
    const m = openModals[openModals.length - 1];
    if (m) { const btn = m.querySelector('[data-close]'); if (btn) btn.click(); }
  }

  /* ---------- DangerDialog (§2.5) ---------- */
  function dangerDialog(o) {
    const conseq = (o.consequences || []).map(c => `<li>${esc(c)}</li>`).join('');
    const minLen = o.minReason || 10;
    const foot = `
      <button class="btn btn-outline" data-close>${esc(o.cancelLabel || 'Quay lại')}</button>
      <span class="spacer"></span>
      <button class="btn btn-danger" data-confirm disabled>${esc(o.confirmLabel || 'Xác nhận')}</button>`;
    const head = `<div class="danger-head"><span class="warn-ic">⚠</span><h3>${esc(o.title)}</h3></div>`;
    const body = h`
      ${raw(o.description ? `<p class="muted" style="margin-bottom:12px">${o.description}</p>` : '')}
      ${raw(conseq ? `<p class="b" style="margin-bottom:4px">Sau khi thực hiện:</p><ul class="consequence">${conseq}</ul>` : '')}
      <div class="field">
        <label>${esc(o.reasonLabel || 'Lý do')} (bắt buộc)</label>
        <textarea class="textarea" data-reason placeholder="Nhập lý do..."></textarea>
        <span class="hint">Tối thiểu ${minLen} ký tự</span>
      </div>`;
    return modal({
      headHtml: head, bodyHtml: body, footHtml: foot, size: '',
      onMount(el, close) {
        const ta = el.querySelector('[data-reason]');
        const btn = el.querySelector('[data-confirm]');
        ta.addEventListener('input', () => { btn.disabled = ta.value.trim().length < minLen; });
        btn.addEventListener('click', () => {
          btn.classList.add('loading');
          setTimeout(() => { close(); o.onConfirm(ta.value.trim()); }, 350);
        });
      },
    });
  }

  /* ---------- Menu thả xuống ---------- */
  function openMenu(anchor, items) {
    closeMenus();
    const menu = document.createElement('div');
    menu.className = 'menu'; menu.dataset.floating = '1';
    menu.innerHTML = items.map(it => it.sep ? '<div class="sep"></div>' :
      `<button class="${it.danger ? 'danger' : ''}">${it.icon ? `<span class="ic">${it.icon}</span>` : ''}<span>${esc(it.label)}</span></button>`).join('');
    document.body.appendChild(menu);
    const r = anchor.getBoundingClientRect();
    const mw = 210;
    let left = r.right - mw; if (left < 8) left = r.left;
    menu.style.left = Math.max(8, left) + 'px';
    let top = r.bottom + 4;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = r.top - menu.offsetHeight - 4;
    menu.style.top = top + 'px';
    let bi = 0;
    items.forEach((it) => {
      if (it.sep) return;
      const btn = menu.querySelectorAll('button')[bi++];
      btn.addEventListener('click', () => { closeMenus(); it.onClick && it.onClick(); });
    });
    setTimeout(() => document.addEventListener('click', closeMenus, { once: true }), 0);
  }
  function closeMenus() { document.querySelectorAll('.menu[data-floating]').forEach(m => m.remove()); }

  /* ---------- PeriodSelector (§2.4) ---------- */
  // periodsWithData: Set các 'YYYY-MM' còn dữ liệu chưa xử lý (chấm đỏ)
  function periodSelector(o) {
    const [selY, selM] = o.value.split('-').map(Number);
    const now = HH.util.today();
    const year = o._year || selY;
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const per = `${year}-${String(m).padStart(2, '0')}`;
      const future = (year > now.getFullYear()) || (year === now.getFullYear() && m > now.getMonth() + 1);
      const active = (year === selY && m === selM);
      const pending = o.pending && o.pending.has(per);
      months.push(`<button class="mo ${active ? 'active' : ''} ${pending ? 'has-pending' : ''}" ${future ? 'disabled' : ''} data-per="${per}">T${m}</button>`);
    }
    return h`<div class="period" data-period-root>
      <button class="yr" data-yr="-1">◄ ${year - 1}</button>
      <div class="months">${raw(months.join(''))}</div>
      <button class="yr" data-yr="1">${year + 1} ►</button>
    </div>`;
  }
  function attachPeriod(root, o) {
    const rerender = (year) => { o._year = year; root.outerHTML = periodSelector(o);
      // outerHTML replace loses ref -> re-find
      const nr = document.querySelector('[data-period-root]'); attachPeriod(nr, o); };
    root.querySelectorAll('[data-per]').forEach(b => b.addEventListener('click', () => {
      o.onChange(b.dataset.per);
    }));
    root.querySelectorAll('[data-yr]').forEach(b => b.addEventListener('click', () => {
      rerender((o._year || parseInt(o.value)) + parseInt(b.dataset.yr));
    }));
  }

  /* ---------- DataTable ---------- */
  let dtSeq = 0;
  function DataTable(opt) {
    const id = 'dt' + (++dtSeq);
    const state = { page: 1, q: '', sortKey: null, sortDir: 1, selected: new Set(),
      pageSize: opt.pageSize || 20, filter: opt.initialFilter || null };
    let root;

    function allRows() {
      let rows = opt.rows.slice();
      if (state.q && opt.searchKeys) {
        const q = state.q.toLowerCase();
        rows = rows.filter(r => opt.searchKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q)));
      }
      if (state.filter && opt.filterFn) rows = rows.filter(r => opt.filterFn(r, state.filter));
      if (state.sortKey) {
        const col = opt.columns.find(c => c.key === state.sortKey);
        rows.sort((a, b) => {
          let va = col.sortVal ? col.sortVal(a) : a[state.sortKey];
          let vb = col.sortVal ? col.sortVal(b) : b[state.sortKey];
          if (typeof va === 'string') return va.localeCompare(vb) * state.sortDir;
          return ((va ?? 0) - (vb ?? 0)) * state.sortDir;
        });
      }
      return rows;
    }

    function bodyRows() {
      const rows = allRows();
      const start = (state.page - 1) * state.pageSize;
      return rows.slice(start, start + state.pageSize);
    }

    function headHtml() {
      let cols = '';
      if (opt.selectable) cols += `<th class="col-check"><input type="checkbox" data-check-all></th>`;
      opt.columns.forEach(c => {
        const sortMark = state.sortKey === c.key ? (state.sortDir === 1 ? ' ▲' : ' ▼') : '';
        cols += `<th class="${c.align === 'right' || c.mono ? 'num' : ''} ${c.sortable ? 'sortable' : ''}" ${c.sortable ? `data-sort="${c.key}"` : ''} ${c.width ? `style="width:${c.width}"` : ''} scope="col">${esc(c.label)}${sortMark}</th>`;
      });
      if (opt.actions) cols += `<th class="col-actions"></th>`;
      return `<tr>${cols}</tr>`;
    }

    function rowHtml(r) {
      const rid = opt.rowId(r);
      let tds = '';
      if (opt.selectable) tds += `<td class="col-check"><input type="checkbox" data-row-check="${esc(rid)}" ${state.selected.has(rid) ? 'checked' : ''}></td>`;
      opt.columns.forEach(c => {
        const cls = (c.align === 'right' || c.mono) ? 'num' : '';
        const content = c.render ? c.render(r) : esc(r[c.key] ?? '—');
        tds += `<td class="${cls} ${c.tdClass ? c.tdClass(r) : ''}">${content}</td>`;
      });
      if (opt.actions) tds += `<td class="col-actions"><button class="kebab" data-kebab="${esc(rid)}" aria-label="Thao tác">⋯</button></td>`;
      const rowCls = opt.rowClass ? opt.rowClass(r) : '';
      return `<tr data-row="${esc(rid)}" class="${rowCls}">${tds}</tr>`;
    }

    function tableHtml() {
      const rows = allRows();
      if (rows.length === 0 && !opt.loading) {
        const total = opt.rows.length;
        return `<div class="empty"><div class="ic">${opt.emptyIcon || '📋'}</div>
          <h4>${esc(total === 0 ? (opt.emptyTitle || 'Chưa có dữ liệu') : 'Không có kết quả phù hợp')}</h4>
          <p class="muted">${esc(total === 0 ? (opt.emptyDesc || '') : 'Thử đổi từ khóa hoặc bộ lọc.')}</p>
          ${total === 0 && opt.emptyAction ? `<div style="margin-top:16px"><button class="btn btn-primary" data-empty-action>${esc(opt.emptyAction.label)}</button></div>` : ''}
        </div>`;
      }
      if (opt.loading) {
        const sk = Array.from({ length: 5 }).map(() =>
          `<tr>${opt.columns.map(() => '<td><div class="skeleton" style="height:16px"></div></td>').join('')}</tr>`).join('');
        return `<div class="dt-scroll"><table class="dt"><thead>${headHtml()}</thead><tbody>${sk}</tbody></table></div>`;
      }
      const body = bodyRows().map(rowHtml).join('');
      return `<div class="dt-scroll"><table class="dt ${opt.onRowClick ? 'dt-clickable' : ''}">
        <thead>${headHtml()}</thead><tbody>${body}</tbody></table></div>${footHtml(rows.length)}`;
    }

    function footHtml(total) {
      const pages = Math.max(1, Math.ceil(total / state.pageSize));
      const start = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
      const end = Math.min(total, state.page * state.pageSize);
      let pager = `<button data-pg="prev" ${state.page === 1 ? 'disabled' : ''}>‹</button>`;
      for (let p = 1; p <= pages; p++) {
        if (pages > 7 && Math.abs(p - state.page) > 2 && p !== 1 && p !== pages) {
          if (p === 2 || p === pages - 1) pager += `<span style="padding:0 4px">…</span>`;
          continue;
        }
        pager += `<button data-pg="${p}" class="${p === state.page ? 'active' : ''}">${p}</button>`;
      }
      pager += `<button data-pg="next" ${state.page >= pages ? 'disabled' : ''}>›</button>`;
      return `<div class="dt-foot"><span>Hiển thị <b class="mono">${start}–${end}</b> trong <b class="mono">${total}</b></span>
        <div class="pager">${pager}</div></div>`;
    }

    function toolbarHtml() {
      let left = '';
      if (opt.searchable !== false) {
        left = `<div class="dt-search"><span class="ic">🔍</span>
          <input class="input" data-search placeholder="${esc(opt.searchPlaceholder || 'Tìm kiếm...')}" value="${esc(state.q)}"></div>`;
      }
      return `<div class="dt-toolbar">${left}${opt.toolbarLeft || ''}<div class="grow"></div>${opt.toolbarRight || ''}</div>`;
    }

    function render() {
      return `<div class="dt-wrap" id="${id}">${toolbarHtml()}<div data-dt-body>${tableHtml()}</div></div>`;
    }

    function refresh() {
      const body = root.querySelector('[data-dt-body]');
      body.innerHTML = tableHtml();
      wireBody();
      updateBulk();
    }

    function updateBulk() {
      let bar = document.getElementById('bulkbar_' + id);
      if (!opt.bulkActions) return;
      if (state.selected.size === 0) { if (bar) bar.classList.remove('show'); return; }
      if (!bar) {
        bar = document.createElement('div'); bar.id = 'bulkbar_' + id; bar.className = 'bulkbar';
        document.body.appendChild(bar);
      }
      bar.innerHTML = `<b class="nowrap">Đã chọn ${state.selected.size} mục</b>` +
        opt.bulkActions.map((a, i) => `<button class="btn ${a.primary ? 'btn-primary' : 'btn-outline'} btn-sm" data-bulk="${i}">${esc(a.label)}</button>`).join('') +
        `<button class="btn btn-ghost btn-sm" data-bulk-clear style="color:#fff">Bỏ chọn</button>`;
      bar.querySelectorAll('[data-bulk]').forEach(b => b.onclick = () => {
        opt.bulkActions[+b.dataset.bulk].onClick(Array.from(state.selected), () => { state.selected.clear(); refresh(); });
      });
      bar.querySelector('[data-bulk-clear]').onclick = () => { state.selected.clear(); refresh(); };
      bar.classList.add('show');
    }

    function wireBody() {
      root.querySelectorAll('[data-sort]').forEach(th => th.onclick = () => {
        const k = th.dataset.sort;
        if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = 1; }
        refresh();
      });
      root.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => {
        const v = b.dataset.pg;
        const pages = Math.max(1, Math.ceil(allRows().length / state.pageSize));
        if (v === 'prev') state.page = Math.max(1, state.page - 1);
        else if (v === 'next') state.page = Math.min(pages, state.page + 1);
        else state.page = +v;
        refresh();
      });
      if (opt.onRowClick) root.querySelectorAll('tbody tr[data-row]').forEach(tr => tr.onclick = (e) => {
        if (e.target.closest('input,button,a')) return;
        const rid = tr.dataset.row; const r = opt.rows.find(x => String(opt.rowId(x)) === rid);
        opt.onRowClick(r);
      });
      if (opt.actions) root.querySelectorAll('[data-kebab]').forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const r = opt.rows.find(x => String(opt.rowId(x)) === b.dataset.kebab);
        openMenu(b, opt.actions(r));
      });
      if (opt.selectable) {
        const all = root.querySelector('[data-check-all]');
        if (all) all.onclick = () => {
          const rows = bodyRows();
          if (all.checked) rows.forEach(r => state.selected.add(opt.rowId(r)));
          else rows.forEach(r => state.selected.delete(opt.rowId(r)));
          refresh();
        };
        root.querySelectorAll('[data-row-check]').forEach(c => c.onclick = (e) => {
          e.stopPropagation();
          const rid = c.dataset.rowCheck;
          if (c.checked) state.selected.add(rid); else state.selected.delete(rid);
          updateBulk();
        });
      }
      const ea = root.querySelector('[data-empty-action]');
      if (ea) ea.onclick = () => opt.emptyAction.onClick();
    }

    function attach(container) {
      root = container.querySelector('#' + id) || document.getElementById(id);
      const s = root.querySelector('[data-search]');
      if (s) s.addEventListener('input', U.debounce(() => { state.q = s.value; state.page = 1; refresh(); }, 180));
      wireBody();
    }

    return { id, render, attach, refresh: () => refresh(),
      setRows(rows) { opt.rows = rows; state.page = 1; refresh(); },
      setFilter(f) { state.filter = f; state.page = 1; refresh(); },
      clearBulk() { const b = document.getElementById('bulkbar_' + id); if (b) b.remove(); } };
  }

  function clearBulkBars() { document.querySelectorAll('.bulkbar').forEach(b => b.remove()); }

  return { STATUS, statusBadge, metricCard, toast, modal, closeTopModal, dangerDialog,
    openMenu, closeMenus, periodSelector, attachPeriod, DataTable, clearBulkBars };
})();

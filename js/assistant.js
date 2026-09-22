/* ============================================================
   Happy Home — Khung chat trợ lý cho web quản trị
   Gắn thẳng vào <body> nên không bị mất khi router vẽ lại trang.
   Hội thoại + ngữ cảnh được giữ trong sessionStorage (tải lại trang vẫn còn,
   đóng tab là mất — không lưu lâu dài trên máy).
   ============================================================ */
HH.assistant = (function () {
  const U = HH.util;
  const KEY = 'hh_assist_v2';
  const state = { open: false, busy: false, msgs: [], mounted: false, history: [], hIdx: -1 };
  const ic = (n, s) => HH.icon(n, s || 18);

  /* ---------- Lưu / nạp hội thoại ---------- */
  function save() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        msgs: state.msgs.slice(-40), history: state.history.slice(-20),
        ctx: HH.ai.context.dump(), open: state.open,
      }));
    } catch (e) { /* trình duyệt chặn bộ nhớ -> bỏ qua */ }
  }
  function load() {
    try {
      const o = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (!o) return;
      state.msgs = Array.isArray(o.msgs) ? o.msgs : [];
      state.history = Array.isArray(o.history) ? o.history : [];
      HH.ai.context.load(o.ctx);
      state.open = !!o.open;
    } catch (e) { /* hỏng -> bắt đầu mới */ }
  }

  function mount() {
    if (state.mounted) return;
    load();
    const wrap = document.createElement('div');
    wrap.id = 'hhAssist';
    document.body.appendChild(wrap);
    state.mounted = true;
    paint();
  }

  function unmount() {
    const el = document.getElementById('hhAssist');
    if (el) el.remove();
    state.mounted = false; state.open = false; state.busy = false;
    state.msgs = []; state.history = [];
    HH.ai.context.clear();
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function greet() {
    const G = window.HHGemini;
    const mode = G && G.configured()
      ? `<span class="as-badge on">${ic('sparkles', 12)} Gemini đã bật</span>`
      : `<span class="as-badge">Tra cứu tại chỗ</span>`;
    state.msgs.push({ who: 'bot', html: `Chào anh/chị! Em là trợ lý Happy Home ${mode}<br>
      Em đọc <b>số liệu thật</b> và hiểu được tháng, tòa, phòng trong câu hỏi.
      Hỏi nối tiếp cũng được, ví dụ hỏi về P101 rồi hỏi <i>“còn nợ bao nhiêu?”</i>.`,
      suggest: HH.ai.SUGGESTIONS });
  }

  /* ---------- Vẽ phần giàu nội dung trong 1 tin ---------- */
  function tableHtml(t) {
    if (!t || !t.rows || !t.rows.length) return '';
    const num = t.num || [];
    const head = t.kv ? '' : `<thead><tr>${t.head.map((h, i) =>
      `<th class="${num.includes(i) ? 'n' : ''}">${U.esc(h)}</th>`).join('')}</tr></thead>`;
    const body = t.rows.map((r) => `<tr>${r.map((c, i) =>
      `<td class="${num.includes(i) ? 'n' : ''}${t.kv && i === 0 ? ' k' : ''}">${U.esc(c == null ? '' : String(c))}</td>`).join('')}</tr>`).join('');
    return `<div class="as-tbl-wrap"><table class="as-tbl ${t.kv ? 'kv' : ''}">${head}<tbody>${body}</tbody></table></div>`;
  }
  function chartHtml(c) {
    if (!c || !c.data || !c.data.length) return '';
    const short = (n) => n >= 1e9 ? (n / 1e9).toFixed(1).replace('.0', '') + 'tỷ'
      : n >= 1e6 ? Math.round(n / 1e6) + 'tr' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : (n ? String(n) : '');
    return `<div class="as-chart">${HH.chart.bars(c.data, { height: 120, highlightLast: true, shortFmt: short })}</div>`;
  }

  function msgHtml(m, i) {
    const acts = (m.actions || []).map((a, j) => a.href
      ? `<a class="as-act ${a.solid ? 'solid' : ''}" href="${U.esc(a.href)}" target="_blank" rel="noopener">${U.esc(a.label)}</a>`
      : `<button class="as-act ${a.solid ? 'solid' : ''}" data-mi="${i}" data-ai="${j}">${U.esc(a.label)}</button>`).join('');
    return `<div class="as-msg ${m.who === 'me' ? 'me' : ''}" data-msg="${i}">
      <div class="as-bub">
        ${m.note ? `<div class="as-note">${ic('refresh', 11)} ${U.esc(m.note)}</div>` : ''}
        ${m.html}
        ${tableHtml(m.table)}
        ${chartHtml(m.chart)}
        ${m.src === 'ai' ? `<span class="as-src">${ic('sparkles', 11)} lời văn do Gemini soạn · số liệu lấy từ hệ thống</span>` : ''}
        ${acts ? `<div class="as-acts">${acts}</div>` : ''}
      </div></div>`;
  }

  function paint() {
    const el = document.getElementById('hhAssist');
    if (!el) return;
    const G = window.HHGemini;
    const lastBot = [...state.msgs].reverse().find((m) => m.who === 'bot');
    const sugg = (lastBot && lastBot.suggest && lastBot.suggest.length) ? lastBot.suggest : HH.ai.SUGGESTIONS;
    const c = HH.ai.context.get();
    const scope = c ? HH.ai.scopeText(c.slots) : '';

    el.innerHTML = `
      <button class="as-fab ${state.open ? 'hide' : ''}" id="asFab" aria-label="Mở trợ lý ảo">
        <span class="as-fab-pic">${HH.pic('chat', 28)}</span><span>Trợ lý</span></button>
      <div class="as-panel ${state.open ? 'open' : ''}" role="dialog" aria-label="Trợ lý Happy Home">
        <div class="as-head">
          <span class="as-avt">${HH.pic('chat', 24)}</span>
          <div class="as-ttl"><b>Trợ lý Happy Home</b>
            <span>${G && G.configured() ? 'Gemini Flash, còn ' + (G.quotaLimit - G.quotaUsed()) + ' lượt hôm nay' : 'Tra cứu dữ liệu thật, không tốn phí'}</span></div>
          <button class="as-x" id="asReset" title="Bắt đầu hội thoại mới" aria-label="Bắt đầu hội thoại mới">${ic('refresh', 15)}</button>
          <button class="as-x" id="asClose" aria-label="Đóng">${ic('x', 16)}</button>
        </div>
        <div class="as-body" id="asBody" aria-live="polite">${state.msgs.map(msgHtml).join('')}
          ${state.busy ? '<div class="as-typing"><i></i><i></i><i></i></div>' : ''}</div>
        <div class="as-sugg">${sugg.map((s) =>
          `<button data-sugg="${U.esc(s)}">${U.esc(s)}</button>`).join('')}</div>
        ${scope ? `<div class="as-ctx"><span>Đang nói về: <b>${U.esc(scope)}</b></span>
          <button id="asCtxClear" title="Bỏ ngữ cảnh" aria-label="Bỏ ngữ cảnh">${ic('x', 12)}</button></div>` : ''}
        <div class="as-input">
          <textarea id="asIn" rows="1" placeholder="Hỏi doanh thu, công nợ, phòng P101…"></textarea>
          <button class="as-send" id="asSend" aria-label="Gửi">${ic('send', 16)}</button>
        </div>
      </div>`;
    wire();
  }

  function copyText(text) {
    const ok = () => HH.ui.toast('Đã chép. Dán vào Zalo hoặc tin nhắn để gửi khách.', { type: 'ok' });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok, () => fallbackCopy(text, ok));
    } else fallbackCopy(text, ok);
  }
  function fallbackCopy(text, ok) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { HH.ui.toast('Trình duyệt không cho chép', { type: 'error' }); }
    ta.remove();
  }

  function wire() {
    const q = (id) => document.getElementById(id);
    const fab = q('asFab');
    if (fab) fab.onclick = () => {
      state.open = true; if (!state.msgs.length) greet(); save(); paint();
      setTimeout(() => { const i = q('asIn'); if (i) i.focus(); }, 60);
    };
    const cl = q('asClose'); if (cl) cl.onclick = () => { state.open = false; save(); paint(); };
    const rs = q('asReset');
    if (rs) rs.onclick = () => {
      state.msgs = []; HH.ai.context.clear(); greet(); save(); paint();
    };
    const cc = q('asCtxClear');
    if (cc) cc.onclick = () => { HH.ai.context.clear(); save(); paint(); q('asIn').focus(); };

    const bd = q('asBody'); if (bd) bd.scrollTop = bd.scrollHeight;
    const inp = q('asIn');
    if (inp) {
      const send = () => {
        const v = inp.value.trim(); if (!v || state.busy) return;
        inp.value = ''; inp.style.height = 'auto'; ask(v);
      };
      q('asSend').onclick = send;
      inp.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return; }
        // ↑ / ↓ gọi lại câu đã hỏi
        if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && state.history.length && !inp.value.includes('\n')) {
          if (e.key === 'ArrowUp') state.hIdx = state.hIdx < 0 ? state.history.length - 1 : Math.max(0, state.hIdx - 1);
          else state.hIdx = state.hIdx < 0 ? -1 : state.hIdx + 1;
          if (state.hIdx >= state.history.length) state.hIdx = -1;
          inp.value = state.hIdx >= 0 ? state.history[state.hIdx] : '';
          e.preventDefault();
        }
      };
      inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(90, inp.scrollHeight) + 'px'; };
    }
    document.querySelectorAll('#hhAssist [data-sugg]').forEach((b) => b.onclick = () => ask(b.dataset.sugg));
    document.querySelectorAll('#hhAssist [data-mi]').forEach((b) => b.onclick = () => {
      const a = state.msgs[+b.dataset.mi].actions[+b.dataset.ai];
      if (a.copy) return copyText(a.copy);
      if (a.go) { state.open = false; save(); paint(); location.hash = a.go.replace(/^#/, ''); return; }
      if (a.send) ask(a.send);
    });
    // nút "Chép tin" nằm trong nội dung tin nhắc nợ
    document.querySelectorAll('#hhAssist [data-copyidx]').forEach((b) => b.onclick = () => {
      const host = b.closest('[data-msg]');
      const m = host && state.msgs[+host.dataset.msg];
      if (m && m.copies) copyText(m.copies[+b.dataset.copyidx]);
    });
  }

  async function ask(text) {
    state.msgs.push({ who: 'me', html: U.esc(text) });
    state.history.push(text); state.hIdx = -1;
    state.busy = true; paint();
    let res;
    try { res = await HH.ai.ask(text); }
    catch (e) {
      console.error(e);
      res = { html: 'Em gặp lỗi khi tra cứu. Anh/chị thử hỏi lại theo cách khác giúp em.', source: 'error' };
    }
    state.busy = false;
    state.msgs.push({ who: 'bot', html: res.html, actions: res.actions || [], src: res.source,
      table: res.table, chart: res.chart, copies: res.copies, suggest: res.suggest, note: res.note });
    save(); paint();
  }

  return {
    mount, unmount,
    open: () => { mount(); state.open = true; if (!state.msgs.length) greet(); save(); paint(); },
    ask,
  };
})();

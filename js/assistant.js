/* ============================================================
   Happy Home — Khung chat trợ lý cho web quản trị
   Gắn thẳng vào <body> nên không bị mất khi router vẽ lại trang.
   ============================================================ */
HH.assistant = (function () {
  const U = HH.util;
  const state = { open: false, busy: false, msgs: [], mounted: false };
  const ic = (n, s) => HH.icon(n, s || 18);

  function mount() {
    if (state.mounted) return;
    const wrap = document.createElement('div');
    wrap.id = 'hhAssist';
    document.body.appendChild(wrap);
    state.mounted = true;
    paint();
  }

  function unmount() {
    const el = document.getElementById('hhAssist');
    if (el) el.remove();
    state.mounted = false; state.open = false; state.msgs = []; state.busy = false;
  }

  function greet() {
    const G = window.HHGemini;
    const mode = G && G.configured()
      ? `<span class="as-badge on">${ic('sparkles', 12)} Gemini đã bật</span>`
      : `<span class="as-badge">Chế độ tra cứu nhanh</span>`;
    state.msgs.push({ who: 'bot', html: `Chào anh/chị! Em là trợ lý Happy Home. ${mode}<br>
      Em đọc <b>số liệu thật</b> trong hệ thống — không tự bịa con số nào.`,
      actions: [{ label: 'Hôm nay cần làm gì?', send: 'Hôm nay cần xử lý gì?' }] });
  }

  function paint() {
    const el = document.getElementById('hhAssist');
    if (!el) return;
    const G = window.HHGemini;
    const body = state.msgs.map((m, i) => `
      <div class="as-msg ${m.who === 'me' ? 'me' : ''}">
        <div class="as-bub">${m.html}
          ${m.src === 'ai' ? `<span class="as-src">${ic('sparkles', 11)} soạn bởi Gemini · số liệu lấy từ hệ thống</span>` : ''}
          ${(m.actions || []).length ? `<div class="as-acts">${m.actions.map((a, j) =>
            `<button class="as-act ${a.solid ? 'solid' : ''}" data-mi="${i}" data-ai="${j}">${U.esc(a.label)}</button>`).join('')}</div>` : ''}
        </div></div>`).join('');

    el.innerHTML = `
      <button class="as-fab ${state.open ? 'hide' : ''}" id="asFab" aria-label="Trợ lý ảo">
        ${ic('bot', 22)}<span>Trợ lý</span></button>
      <div class="as-panel ${state.open ? 'open' : ''}" role="dialog" aria-label="Trợ lý Happy Home">
        <div class="as-head">
          <span class="as-avt">${ic('bot', 18)}</span>
          <div class="as-ttl"><b>Trợ lý Happy Home</b>
            <span>${G && G.configured() ? 'Gemini Flash · ' + (G.quotaLimit - G.quotaUsed()) + ' lượt còn lại hôm nay' : 'Tra cứu dữ liệu thật'}</span></div>
          <button class="as-x" id="asClose" aria-label="Đóng">${ic('x', 16)}</button>
        </div>
        <div class="as-body" id="asBody">${body}
          ${state.busy ? '<div class="as-typing"><i></i><i></i><i></i></div>' : ''}</div>
        <div class="as-sugg">${HH.ai.SUGGESTIONS.map(s =>
          `<button data-sugg="${U.esc(s)}">${U.esc(s)}</button>`).join('')}</div>
        <div class="as-input">
          <textarea id="asIn" rows="1" placeholder="Hỏi về doanh thu, công nợ, phòng trống..."></textarea>
          <button class="as-send" id="asSend" aria-label="Gửi">${ic('send', 16)}</button>
        </div>
      </div>`;
    wire();
  }

  function wire() {
    const q = (id) => document.getElementById(id);
    const fab = q('asFab'); if (fab) fab.onclick = () => { state.open = true; if (!state.msgs.length) greet(); paint(); setTimeout(() => { const i = q('asIn'); if (i) i.focus(); }, 60); };
    const cl = q('asClose'); if (cl) cl.onclick = () => { state.open = false; paint(); };
    const bd = q('asBody'); if (bd) bd.scrollTop = bd.scrollHeight;
    const inp = q('asIn');
    if (inp) {
      const send = () => { const v = inp.value.trim(); if (!v || state.busy) return; inp.value = ''; inp.style.height = 'auto'; ask(v); };
      q('asSend').onclick = send;
      inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
      inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(90, inp.scrollHeight) + 'px'; };
    }
    document.querySelectorAll('#hhAssist [data-sugg]').forEach(b => b.onclick = () => ask(b.dataset.sugg));
    document.querySelectorAll('#hhAssist [data-mi]').forEach(b => b.onclick = () => {
      const a = state.msgs[+b.dataset.mi].actions[+b.dataset.ai];
      if (a.go) { state.open = false; paint(); location.hash = a.go.replace(/^#/, ''); return; }
      if (a.send) ask(a.send);
    });
  }

  async function ask(text) {
    state.msgs.push({ who: 'me', html: U.esc(text) });
    state.busy = true; paint();
    let res;
    try { res = await HH.ai.ask(text); }
    catch (e) { res = { html: 'Em gặp lỗi khi tra cứu ạ.', source: 'error' }; }
    state.busy = false;
    state.msgs.push({ who: 'bot', html: res.html, actions: res.actions || [], src: res.source });
    paint();
  }

  return { mount, unmount, open: () => { mount(); state.open = true; if (!state.msgs.length) greet(); paint(); } };
})();

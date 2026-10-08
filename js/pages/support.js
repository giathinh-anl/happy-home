/* ============================================================
   Trang: Hỏi đáp khách thuê (hộp thư của nhân viên trực)

   Trợ lý ảo trong app khách thuê chỉ tra cứu được hóa đơn, điện nước, hợp
   đồng. Câu nào nó không hiểu thì khách bấm "Nhắn cho nhân viên", tin rơi
   vào đây; nhân viên trả lời, khách đọc ngay trong app.

   Dữ liệu nằm ở bảng support_messages (supabase/migration-support-chat.sql).
   Chưa chạy migration thì trang vẫn mở được và nói rõ là chưa bật.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  const POLL_MS = 10000;          // bao lâu hỏi máy chủ xem có tin mới
  let poll = null;                // bộ đếm giờ của trang đang mở
  let openPhone = null;           // cuộc đang mở
  let ready = null;               // máy chủ đã có bảng chưa (null = chưa biết)

  /* ---------- thời gian đọc cho dễ ---------- */
  function khi(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const phut = Math.round((Date.now() - d.getTime()) / 60000);
    if (phut < 1) return 'vừa xong';
    if (phut < 60) return phut + ' phút trước';
    const gio = Math.round(phut / 60);
    if (gio < 24) return gio + ' giờ trước';
    return U.fmtDate(d) + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  HH.pages.support = {
    render(ctx) {
      const threads = S.supportThreads();
      const cho = threads.filter(t => t.waiting).length;
      const live = S.usingBackend();
      const tenToa = (id) => { const b = id && S.building(id); return b ? b.name : ''; };

      const banner = ready === false
        ? `<div class="alert alert-warning" style="margin-bottom:16px"><span class="ic">${HH.ic('alert', 16)}</span>
            <div><b>Máy chủ chưa bật phần hỏi đáp.</b> Chạy tệp
            <span class="code">supabase/migration-support-chat.sql</span> trong Supabase → SQL Editor rồi tải lại trang.</div></div>`
        : (!live ? `<div class="alert alert-info" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
            <div>Bản demo chưa nối máy chủ nên chưa nhận được tin của khách. Nối Supabase thì tin khách nhắn sẽ vào đây.</div></div>` : '');

      const items = threads.map(t => {
        const last = t.msgs[t.msgs.length - 1] || {};
        const who = last.sender === 'staff' ? 'Mình: ' : '';
        return `<button class="sp-thread ${t.phone === openPhone ? 'on' : ''} ${t.waiting ? 'waiting' : ''}" data-phone="${U.esc(t.phone)}">
          <span class="sp-av">${U.initials(t.tenantName || t.phone)}</span>
          <span class="sp-tx">
            <span class="sp-top"><b>${U.esc(t.tenantName || t.phone)}</b><i>${khi(t.lastAt)}</i></span>
            <span class="sp-sub">${t.roomCode ? U.esc(t.roomCode) + ' · ' : ''}${U.esc(t.phone)}${tenToa(t.buildingId) ? ' · ' + U.esc(tenToa(t.buildingId)) : ''}</span>
            <span class="sp-last">${U.esc(who + String(last.body || '').slice(0, 70))}</span>
          </span>
          ${t.unread ? `<span class="sp-dot">${t.unread}</span>` : ''}
        </button>`;
      }).join('');

      const cur = threads.find(t => t.phone === openPhone);
      const pane = !cur
        ? `<div class="sp-empty"><div class="ic">${HH.ic('chat', 30)}</div>
            <h4>${threads.length ? 'Chọn một khách để trả lời' : 'Chưa có câu hỏi nào'}</h4>
            <p class="muted">${threads.length ? 'Bấm vào tên khách ở danh sách bên trái.'
              : 'Khi trợ lý ảo trong app khách không trả lời được, câu hỏi của khách sẽ hiện ở đây.'}</p></div>`
        : `<div class="sp-head">
            <div><b>${U.esc(cur.tenantName || cur.phone)}</b>
              <span class="muted text-sm">${cur.roomCode ? U.esc(cur.roomCode) + ' · ' : ''}${U.esc(cur.phone)}</span></div>
            <a class="btn btn-outline btn-sm" href="tel:${U.esc(cur.phone)}">${HH.ic('phone', 16)} Gọi</a>
          </div>
          <div class="sp-body" id="spBody">${cur.msgs.map(m => `
            <div class="sp-msg ${m.sender === 'staff' ? 'me' : ''}">
              <div class="sp-bubble">${U.esc(m.body).split('\n').join('<br>')}
                <span class="sp-when">${m.sender === 'staff' && m.staffName ? U.esc(m.staffName) + ' · ' : ''}${khi(m.createdAt)}</span>
              </div></div>`).join('')}</div>
          <div class="sp-input">
            <textarea id="spText" rows="1" placeholder="Trả lời khách..."></textarea>
            <button class="btn btn-primary" id="spSend">${HH.ic('send', 16)} Gửi</button>
          </div>`;

      return h`<div class="page-head">
        <div><div class="page-title-lg">Hỏi đáp khách thuê</div>
          <div class="page-sub">Tất cả tòa nhà · ${threads.length} cuộc trò chuyện${cho ? ', ' + cho + ' khách đang chờ trả lời' : ''}</div></div>
      </div>
      ${raw(banner)}
      <div class="sp-wrap">
        <div class="sp-list">${raw(items || `<div class="sp-empty sm"><p class="muted">Chưa có khách nào nhắn.</p></div>`)}</div>
        <div class="sp-pane">${raw(pane)}</div>
      </div>`;
    },

    mount(ctx) {
      document.querySelectorAll('[data-phone]').forEach(b => b.onclick = () => {
        openPhone = b.dataset.phone;
        S.markSupportRead(openPhone);           // mở ra là coi như đã xem
        HH.router.render();
      });

      const body = document.getElementById('spBody');
      if (body) body.scrollTop = body.scrollHeight;

      const ta = document.getElementById('spText');
      const send = document.getElementById('spSend');
      if (ta && send) {
        ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
        const go = () => {
          const v = ta.value.trim();
          if (!v) return;
          const th = S.supportThreads().find(t => t.phone === openPhone);
          if (!S.replySupport(openPhone, v, th)) return;
          ta.value = '';
          HH.router.render();
          UI.toast('Đã gửi cho khách', { type: 'ok' });
        };
        send.onclick = go;
        ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
        ta.focus();
      }

      startPoll(ctx);
    },
  };

  /* ---------- Hỏi máy chủ xem có tin mới ----------
     Router không gọi unmount, nên bộ đếm tự tắt khi trang đã rời đi. */
  function startPoll(ctx) {
    clearInterval(poll);
    if (!S.usingBackend() || !HH.backend.loadKind) { ready = ready === null ? true : ready; return; }
    const tick = async () => {
      if (!document.querySelector('.sp-wrap')) { clearInterval(poll); poll = null; return; }
      const res = await HH.backend.loadKind('supportMsgs');
      if (res.missing) { if (ready !== false) { ready = false; HH.router.render(); } return; }
      if (res.error) return;                      // mạng chập chờn: bỏ qua lượt này
      if (ready !== true) ready = true;
      const them = S.mergeSupport(res.data);
      if (them) HH.router.render();               // có tin mới thì vẽ lại
    };
    tick();
    poll = setInterval(tick, POLL_MS);
  }
})();

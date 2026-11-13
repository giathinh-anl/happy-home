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

  const POLL_MS = 3500;          // nhịp hỏi máy chủ. Đang chat qua lại nên phải nhanh,
                                // 10 giây thì đứng chờ tưởng hỏng.
  let poll = null;                // bộ đếm giờ của trang đang mở
  let openPhone = null;           // cuộc đang mở
  let ready = null;               // máy chủ đã có bảng chưa (null = chưa biết)

  const CP = HH.chatPhotos;
  let pending = [];               // ảnh đang chọn để gửi kèm câu trả lời (data URL đã nén), giữ qua các lần vẽ lại trang
  const daThu = new Set();        // tin đã thử tải ảnh rồi: lỗi mạng hay máy chủ chưa bật thì đừng hỏi lại mỗi lần vẽ lại

  /* Khung ảnh trong bong bóng: ảnh đã có thì hiện, chưa có thì ô chờ (số ô = số ảnh của tin). Chuỗi ảnh chỉ vào được đây
     sau khi qua HH.chatPhotos.hopLe (S.loadSupportPhotos, S.replySupport), nên đưa vào thuộc tính src là an toàn. */
  const khungAnh = (m) => {
    const n = Number(m.photoCount) | 0;
    if (!n) return '';
    const ph = S.supportPhotosOf(m.id);
    const o = ph ? ph.map((d, i) => `<button type="button" class="sp-ph-i" data-lb="${U.esc(m.id)}" data-i="${i}" aria-label="Xem ảnh ${i + 1}"><img src="${d}" alt="Ảnh ${i + 1}"></button>`).join('')
      : Array.from({ length: n }, () => '<span class="sp-ph-i wait" aria-hidden="true">…</span>').join('');
    return `<div class="sp-ph" data-mid="${U.esc(m.id)}">${o}</div>`;
  };
  /* Nén ảnh chọn từ máy: thử từ bậc to đẹp tới bậc nhỏ cho tới khi vừa giới hạn (HH.chatPhotos.BAC_NEN) */
  async function nenAnh(file) {
    if (['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) < 0) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP');
    for (const b of CP.BAC_NEN) { const d = await U.compressImage(file, b.canh, b.chatLuong); if (CP.hopLe(d)) return d; }
    throw new Error('Ảnh quá nặng, hãy chọn ảnh khác');
  }
  function veAnhCho() {
    const box = document.getElementById('spPend'); if (!box) return;
    box.innerHTML = pending.map((d, i) => `<span class="sp-pend-i"><img src="${d}" alt="Ảnh đính kèm ${i + 1}"><button type="button" data-rm="${i}" aria-label="Bỏ ảnh ${i + 1}">×</button></span>`).join('');
    box.classList.toggle('on', pending.length > 0);
    box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { pending = CP.bo(pending, +b.dataset.rm); veAnhCho(); });
  }
  function xemAnhLon(id, i) {
    const ph = S.supportPhotosOf(id); if (!ph || !ph[i]) return;
    const o = document.createElement('div'); o.className = 'sp-lb'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Xem ảnh');
    o.innerHTML = `<img src="${ph[i]}" alt="Ảnh ${i + 1}"><button type="button" class="sp-lb-x" aria-label="Đóng">×</button>`;
    const dong = () => { o.remove(); document.removeEventListener('keydown', phim, true); };
    const phim = (e) => { if (e.key === 'Escape') { e.preventDefault(); dong(); } };
    o.onclick = dong; document.addEventListener('keydown', phim, true);
    document.body.appendChild(o); o.querySelector('.sp-lb-x').focus();
  }
  /* Tải ảnh của những tin đang hiện mà chưa có, rồi thay ô chờ bằng ảnh (không vẽ lại cả trang, để câu đang gõ dở không mất) */
  function taiAnh() {
    const can = Array.from(document.querySelectorAll('.sp-ph[data-mid]')).map(e => e.dataset.mid).filter(id => !S.supportPhotosOf(id) && !daThu.has(id));
    if (!can.length) return;
    can.forEach(id => daThu.add(id));
    S.loadSupportPhotos(can).then(r => {
      if (!r.added) return;
      document.querySelectorAll('.sp-ph[data-mid]').forEach(box => {
        const ph = S.supportPhotosOf(box.dataset.mid);
        if (ph && box.querySelector('.wait')) box.innerHTML = ph.map((d, i) => `<button type="button" class="sp-ph-i" data-lb="${U.esc(box.dataset.mid)}" data-i="${i}" aria-label="Xem ảnh ${i + 1}"><img src="${d}" alt="Ảnh ${i + 1}"></button>`).join('');
      });
    });
  }

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
            <span class="sp-last">${U.esc(who + CP.tomTat(last, 70))}</span>
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
              <div class="sp-bubble">${m.body ? U.esc(m.body).split('\n').join('<br>') : ''}${khungAnh(m)}
                <span class="sp-when">${m.sender === 'staff' && m.staffName ? U.esc(m.staffName) + ' · ' : ''}${khi(m.createdAt)}</span>
              </div></div>`).join('')}</div>
          <div class="sp-pend${pending.length ? ' on' : ''}" id="spPend">${pending.map((d, i) => `<span class="sp-pend-i"><img src="${d}" alt="Ảnh đính kèm ${i + 1}"><button type="button" data-rm="${i}" aria-label="Bỏ ảnh ${i + 1}">×</button></span>`).join('')}</div>
          <div class="sp-input">
            <label class="btn btn-outline sp-attach" for="spFile" title="Đính kèm ảnh (tối đa 3)" aria-label="Đính kèm ảnh">${HH.ic('camera', 16)}</label>
            <input type="file" id="spFile" accept="image/jpeg,image/png,image/webp" multiple hidden>
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
        openPhone = b.dataset.phone; pending = [];
        S.markSupportRead(openPhone);           // mở ra là coi như đã xem
        HH.router.render();
      });

      const body = document.getElementById('spBody');
      if (body) {
        body.scrollTop = body.scrollHeight;
        body.onclick = (e) => { const b = e.target.closest('[data-lb]'); if (b) xemAnhLon(b.dataset.lb, +b.dataset.i); };
        taiAnh();
      }
      document.querySelectorAll('#spPend [data-rm]').forEach(b => b.onclick = () => { pending = CP.bo(pending, +b.dataset.rm); veAnhCho(); });
      const tep = document.getElementById('spFile');
      if (tep) tep.onchange = async () => {
        const ds = Array.from(tep.files || []); tep.value = '';
        const moi = [];
        for (const f of ds.slice(0, CP.MAX_ANH)) { try { moi.push(await nenAnh(f)); } catch (e) { UI.toast(e.message || 'Không đọc được ảnh', { type: 'warning' }); } }
        const r = CP.them(pending, moi);
        pending = r.anh; veAnhCho();
        if (r.thua || ds.length > CP.MAX_ANH) UI.toast(`Mỗi tin gửi tối đa ${CP.MAX_ANH} ảnh`, { type: 'warning' });
      };

      const ta = document.getElementById('spText');
      const send = document.getElementById('spSend');
      if (ta && send) {
        ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
        const go = async () => {
          const v = ta.value.trim();
          if (!v && !pending.length) return;
          const th = S.supportThreads().find(t => t.phone === openPhone);
          const m = S.replySupport(openPhone, v, th, pending);
          if (!m) { UI.toast('Chưa gửi được, kiểm tra lại ảnh đính kèm', { type: 'warning' }); return; }
          const coAnh = pending.length > 0;
          pending = []; ta.value = '';
          HH.router.render();
          UI.toast('Đã gửi cho khách', { type: 'ok' });
          if (coAnh) {
            const r = await S.sendSupportPhotos(m);
            if (r.missing) UI.toast('Máy chủ chưa bật gửi ảnh trong chat nên khách CHƯA thấy ảnh. Nhờ người quản trị chạy tệp migration-chat-photos.sql.', { type: 'warning' });
            else if (r.error) UI.toast('Chưa gửi được ảnh lên máy chủ: ' + (r.error.message || 'lỗi không rõ'), { type: 'danger' });
          }
        };
        send.onclick = go;
        ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } };
        ta.focus();
      }

      startPoll();
    },
  };

  /* ---------- Hỏi máy chủ xem có tin mới ----------
     Router không gọi unmount, nên bộ đếm tự tắt khi trang đã rời đi.

     Bộ đếm đặt MỘT lần cho cả trang, không đặt lại trong mount. Trước đây
     mount gọi startPoll, mà tick có tin mới lại gọi render -> mount -> startPoll:
     vòng đếm cũ bị bỏ rơi còn vòng mới chồng lên, chat càng lâu càng nhiều vòng
     chạy song song. */
  function startPoll() {
    if (poll) return;                              // đã chạy rồi thì thôi
    if (!S.usingBackend() || !HH.backend.loadKind) { ready = ready === null ? true : ready; return; }
    const tick = async () => {
      if (!document.querySelector('.sp-wrap')) { clearInterval(poll); poll = null; return; }
      const res = await HH.backend.loadKind('supportMsgs');
      if (res.missing) { if (ready !== false) { ready = false; HH.router.render(); } return; }
      if (res.error) return;                       // mạng chập chờn: bỏ qua lượt này
      if (ready !== true) ready = true;
      const them = S.mergeSupport(res.data);
      if (them) HH.router.render();                // có tin mới thì vẽ lại
    };
    poll = setInterval(tick, POLL_MS);
    tick();
  }
})();

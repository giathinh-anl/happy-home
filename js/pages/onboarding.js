/* ============================================================
   Khách tự khai thông tin qua link / mã QR — phần của chủ trọ

   Chủ trọ tạo link cho một phòng (hết hạn, dùng một lần), gửi cho khách. Khách khai và chụp CCCD, hồ sơ về đây chờ duyệt.
   Duyệt = mở lại biểu mẫu "Thêm khách thuê" đã điền sẵn (có đủ kiểm tra dữ liệu và tìm trùng CCCD), đối chiếu với ảnh rồi lưu.
   Hàm máy chủ: supabase/migration-onboarding.sql. Chỉ CHỦ TRỌ dùng được. Phần tính toán thuần ở js/onboarding.js.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, O = HH.onboarding, h = U.html, raw = U.raw;

  const base = () => location.href.split('#')[0].split('?')[0];
  const HAN = [{ gio: 24, nhan: '24 giờ' }, { gio: 72, nhan: '3 ngày' }, { gio: 168, nhan: '7 ngày' }];
  const LOI = {
    demo: 'Bản demo không có máy chủ nên không tạo được link. Cần nối Supabase.',
    missing: 'Máy chủ chưa có chức năng này. Chạy supabase/migration-onboarding.sql trong Supabase → SQL Editor một lần.',
    auth: 'Cần đăng nhập tài khoản chủ trọ.',
    not_found: 'Không tìm thấy (có thể đã được xử lý). Tải lại danh sách.',
    room_not_found: 'Phòng này chưa có trên máy chủ. Đợi vài giây cho dữ liệu lưu xong rồi thử lại.',
    too_many: 'Đang có quá nhiều link chưa dùng (tối đa 50). Thu hồi bớt link cũ rồi tạo lại.',
    network: 'Không kết nối được máy chủ. Thử lại sau.', error: 'Máy chủ báo lỗi, thử lại sau.',
  };
  const loiText = (r) => LOI[r.loi] || ('Không làm được: ' + (r.message || r.loi));
  const alertLoi = (msg) => `<div class="alert alert-danger"><span class="ic">${HH.ic('alert', 16)}</span><div>${U.esc(msg)}</div></div>`;

  function chep(text, nhan) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(
      () => UI.toast('Đã chép ' + nhan, { type: 'ok' }), () => UI.toast('Trình duyệt không cho chép tự động', { type: 'warning' }));
    else UI.toast('Trình duyệt không hỗ trợ sao chép', { type: 'error' });
  }

  /* ---------- mã QR: tạo ngay trên máy (thư viện js/vendor/qrcode.js), link chứa mã riêng nên KHÔNG đưa cho dịch vụ QR bên ngoài ---------- */
  function qrSvg(text, kichCo) {
    if (typeof qrcode !== 'function') return '';
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag(kichCo ? { cellSize: kichCo, margin: 4 } : { cellSize: 6, margin: 3, scalable: true });
  }
  function taiQr(text, ten) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 720;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 720, 720); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, 720, 720);
      c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = ten; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrSvg(text, 8));
  }

  /* Phòng trống lên trước: mời khách mới thì thường là phòng trống, khỏi tìm trong cả chục phòng */
  function nhomPhong(rooms, preRoom) {
    const opt = (r) => `<option value="${U.esc(r.code)}" ${r.code === preRoom ? 'selected' : ''}>${U.esc(r.code)} · ${U.esc(r.typeLabel || '')}</option>`;
    const trong = rooms.filter(r => !r.tenantName), co = rooms.filter(r => r.tenantName);
    return (trong.length ? `<optgroup label="Phòng trống (${trong.length})">${trong.map(opt).join('')}</optgroup>` : '')
      + (co.length ? `<optgroup label="Phòng đang có khách (thêm người ở cùng)">${co.map(opt).join('')}</optgroup>` : '');
  }

  /* ---------------- TẠO LINK ---------------- */
  function inviteDialog(ctx, preRoom) {
    const rooms = S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code));
    const online = !!(HH.backend && HH.backend.enabled);
    const pending = S.pendingInvites(ctx.bid).length;
    UI.modal({
      title: 'Mời khách khai thông tin', size: 'wide',
      bodyHtml: h`
        <div id="ivForm">
          <p class="muted" style="margin-bottom:12px">Tạo một đường link kèm mã QR. Khách mở trên điện thoại, <b>tự điền thông tin và chụp CCCD hai mặt</b>, không cần cài gì.
            Bạn chỉ cần xem lại và duyệt.</p>
          ${raw(online ? '' : alertLoi(LOI.demo))}
          <div class="field"><label>Phòng</label>
            <select class="select" id="ivRoom">
              <option value="">Chưa gắn phòng (chọn lúc duyệt)</option>
              ${raw(nhomPhong(rooms, preRoom))}
            </select></div>
          <div class="field"><label>Link dùng được trong</label>
            <div class="iv-seg" role="radiogroup">${raw(HAN.map((x, i) => `<label class="iv-opt"><input type="radio" name="ivHan" value="${x.gio}" ${i === 1 ? 'checked' : ''}><span>${x.nhan}</span></label>`).join(''))}</div>
            <span class="hint">Hết hạn hoặc khách gửi xong là link tự chết. Cần thì tạo link mới.</span></div>
          <div class="field"><label>Ghi chú cho mình <span class="muted">(khách không thấy)</span></label>
            <input class="input" id="ivNote" maxlength="200" placeholder="VD: anh Nam xem phòng hôm qua"></div>
        </div>
        <div id="ivRes"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button>
        <button class="btn btn-ghost" id="ivList">${HH.icon('list', 14)} Danh sách lời mời${pending ? ` <span class="cnt-badge">${pending}</span>` : ''}</button>
        <span class="spacer"></span><button class="btn btn-primary" id="ivMake" ${online ? '' : 'disabled'}>Tạo link</button>`,
      onMount(el, close) {
        const $ = (s) => el.querySelector(s);
        $('#ivList').onclick = () => { close(); listDialog(ctx); };
        const make = $('#ivMake');
        make.onclick = async () => {
          if (make.dataset.again) { close(); inviteDialog(ctx, $('#ivRoom') ? $('#ivRoom').value : preRoom); return; }
          const room = $('#ivRoom').value, gio = Number(el.querySelector('input[name=ivHan]:checked').value), note = $('#ivNote').value.trim();
          make.classList.add('loading'); make.disabled = true; $('#ivRes').innerHTML = '';
          const r = await S.createInvite(ctx.bid, room, gio, note);
          make.classList.remove('loading'); make.disabled = false;
          if (r.loi) { $('#ivRes').innerHTML = alertLoi(loiText(r)); return; }
          const link = O.linkMoi(base(), r.data.token), msg = O.tinNhan({ phong: room, tenToa: ctx.building.name, link, hetHan: r.data.expiresAt });
          $('#ivForm').style.display = 'none';
          $('#ivRes').innerHTML = `
            <div class="iv-res">
              <div class="iv-qr" aria-label="Mã QR của link">${qrSvg(link)}</div>
              <div class="iv-side">
                <div class="iv-lbl">Link cho khách${room ? ' · phòng ' + U.esc(room) : ''}</div>
                <input class="input mono" id="ivLink" readonly value="${U.esc(link)}" aria-label="Link cho khách">
                <div class="muted text-xs" style="margin:6px 0 12px">Dùng được một lần, ${U.esc(O.conLai(r.data.expiresAt))}.</div>
                <div class="row-gap-2 wrap">
                  <button class="btn btn-sm btn-primary" id="ivCopy">Chép link</button>
                  <button class="btn btn-sm btn-outline" id="ivMsg">Chép tin nhắn mời</button>
                  ${navigator.share ? '<button class="btn btn-sm btn-outline" id="ivShare">Chia sẻ…</button>' : ''}
                  <button class="btn btn-sm btn-outline" id="ivQr">${HH.icon('upload', 14)} Tải mã QR</button>
                </div>
              </div>
            </div>
            <div class="alert alert-warning" style="margin-top:14px"><span class="ic">${HH.ic('alert', 16)}</span>
              <div>Link chỉ hiện <b>lúc này</b>. Máy chủ chỉ giữ bản băm nên đóng hộp thoại là không xem lại được; quên thì tạo link mới.
              Ai có link đều khai được, nên chỉ gửi đúng người.</div></div>`;
          $('#ivCopy').onclick = () => chep(link, 'link');
          $('#ivMsg').onclick = () => chep(msg, 'tin nhắn mời, dán vào Zalo hoặc tin nhắn');
          const sh = $('#ivShare'); if (sh) sh.onclick = () => navigator.share({ text: msg }).catch(() => {});
          $('#ivQr').onclick = () => taiQr(link, 'ma-qr-khai-thong-tin' + (room ? '-' + room : '') + '.png');
          $('#ivLink').addEventListener('focus', (e) => e.target.select());
          make.textContent = 'Tạo link khác'; make.dataset.again = '1';
        };
      },
    });
  }

  /* ---------------- DANH SÁCH ---------------- */
  const gioNgay = (iso) => iso ? U.fmtDate(iso) : '';
  let tab = 'duyet';

  function listDialog(ctx) {
    const TABS = [{ k: 'duyet', nhan: 'Chờ duyệt', loc: (i, t) => t.ma === 'cho-duyet' },
      { k: 'khai', nhan: 'Chờ khách khai', loc: (i, t) => t.ma === 'cho-khai' },
      { k: 'xong', nhan: 'Đã xử lý', loc: (i, t) => ['da-duyet', 'tu-choi', 'thu-hoi', 'het-han'].includes(t.ma) }];
    const tt = (i) => O.trangThai(i);
    const dem = () => TABS.map(t => S.invitesOf(ctx.bid).filter(i => t.loc(i, tt(i))).length);
    // mở vào tab có việc cần làm trước: hồ sơ chờ duyệt, rồi link đang chờ khách, rồi lịch sử. Lần nào mở cũng tính lại,
    // và khi dữ liệu mới về từ máy chủ mà người dùng chưa tự chọn tab thì chuyển theo (khách vừa gửi xong phải thấy ngay)
    const macDinh = () => { const d = dem(); return d[0] ? 'duyet' : d[1] ? 'khai' : d[2] ? 'xong' : 'duyet'; };
    let tuChon = false;
    tab = macDinh();
    UI.modal({
      title: `Khách tự khai · ${ctx.building.name}`, size: 'wide',
      bodyHtml: `<div class="lz-chips" id="ivTabs" style="margin-bottom:12px"></div><div id="ivBody"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span><button class="btn btn-primary" id="ivNew">${HH.icon('plus', 14)} Mời khách mới</button>`,
      onMount(el, close) {
        const veTabs = () => {
          const d = dem();
          el.querySelector('#ivTabs').innerHTML = TABS.map((t, i) => `<button class="lz-chip ${tab === t.k ? 'on' : ''}" data-tab="${t.k}"><span class="lz-chip-box">${tab === t.k ? '✓' : ''}</span>${t.nhan}<span class="lz-chip-cnt ${t.k === 'duyet' && d[i] ? 's-warning' : ''}">${d[i]}</span></button>`).join('');
          el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; tuChon = true; ve(); });
        };
        const ve = () => {
          veTabs();
          const t = TABS.find(x => x.k === tab), ds = S.invitesOf(ctx.bid).filter(i => t.loc(i, tt(i)));
          const body = el.querySelector('#ivBody');
          if (!ds.length) {
            body.innerHTML = `<div class="center muted" style="padding:28px 8px">${tab === 'duyet' ? 'Chưa có hồ sơ nào chờ duyệt.' : tab === 'khai' ? 'Không có link nào đang chờ khách khai.' : 'Chưa có hồ sơ nào đã xử lý.'}
              <div style="margin-top:12px"><button class="btn btn-sm btn-outline" id="ivNew2">Mời khách khai thông tin</button></div></div>`;
            const n2 = body.querySelector('#ivNew2'); if (n2) n2.onclick = () => { close(); inviteDialog(ctx); };
            return;
          }
          body.innerHTML = `<div class="dt-wrap"><div class="dt-scroll" style="max-height:420px;overflow:auto"><table class="dt dt-cards">
            <thead><tr><th>Phòng</th><th>Khách</th><th>Tình trạng</th><th></th></tr></thead><tbody>${ds.map(i => {
              const s = tt(i), d = i.data || {};
              const tinh = s.ma === 'cho-khai' ? `${U.esc(O.conLai(i.expiresAt))}` : s.ma === 'cho-duyet' ? `gửi ${U.esc(gioNgay(i.submittedAt))}` : s.ma === 'het-han' ? `hết hạn ${U.esc(gioNgay(i.expiresAt))}` : `${U.esc(gioNgay(i.decidedAt))}`;
              let act = '';
              if (s.ma === 'cho-duyet') act = `<button class="btn btn-sm btn-primary" data-duyet="${U.esc(i.id)}">Xem và duyệt</button> <button class="btn btn-sm btn-ghost" data-tuchoi="${U.esc(i.id)}">Từ chối</button>`;
              else if (s.ma === 'cho-khai') act = `<button class="btn btn-sm btn-outline" data-thuhoi="${U.esc(i.id)}">Thu hồi</button>`;
              else if (s.ma === 'da-duyet' || s.ma === 'tu-choi') act = `<button class="btn btn-sm btn-ghost" data-xoaanh="${U.esc(i.id)}" title="Xóa ảnh CCCD khỏi hệ thống khi không cần giữ nữa">Xóa ảnh CCCD</button>`;
              return `<tr><td data-label="Phòng" class="dt-title"><b>${U.esc(i.roomCode || 'Chưa gắn')}</b></td>
                <td data-label="Khách">${d.fullName ? `<b>${U.esc(d.fullName)}</b><div class="muted text-xs mono">${U.esc(d.phone || '')}</div>` : `<span class="muted">${U.esc(i.note || 'Chưa có người khai')}</span>`}</td>
                <td data-label="Tình trạng"><span class="badge s-${s.tone}"><span class="dot"></span>${s.nhan}</span><div class="muted text-xs" style="margin-top:3px">${tinh}${i.decisionNote ? ' · ' + U.esc(i.decisionNote) : ''}</div></td>
                <td data-label="" style="white-space:nowrap">${act}</td></tr>`;
            }).join('')}</tbody></table></div></div>`;
          body.querySelectorAll('[data-duyet]').forEach(b => b.onclick = () => {
            const i = S.inviteById(b.dataset.duyet); if (!i) return; close();
            HH.router.go(`/b/${i.buildingId}/tenants/new?invite=${encodeURIComponent(i.id)}${i.roomCode ? '&room=' + encodeURIComponent(i.roomCode) : ''}`);
          });
          body.querySelectorAll('[data-tuchoi]').forEach(b => b.onclick = () => { const i = S.inviteById(b.dataset.tuchoi); if (i) rejectInvite(i, () => { close(); listDialog(ctx); }); });
          body.querySelectorAll('[data-thuhoi]').forEach(b => b.onclick = async () => {
            b.classList.add('loading'); b.disabled = true;
            const r = await S.revokeInvite(b.dataset.thuhoi);
            if (r.loi) { UI.toast(loiText(r), { type: 'error' }); } else UI.toast('Đã thu hồi link, khách không mở được nữa', { type: 'ok' });
            ve();
          });
          body.querySelectorAll('[data-xoaanh]').forEach(b => b.onclick = () => UI.dangerDialog({
            title: 'Xóa ảnh CCCD của hồ sơ này', description: 'Ảnh CCCD hai mặt khách đã chụp sẽ bị xóa khỏi hệ thống.',
            consequences: ['Không khôi phục được', 'Thông tin chữ đã khai và hồ sơ khách thuê vẫn giữ nguyên', 'Thao tác được ghi vào nhật ký'],
            confirmLabel: 'Xóa ảnh', reasonLabel: 'Lý do xóa', minReason: 3,
            onConfirm: async () => { const r = await S.deleteInviteDocs(b.dataset.xoaanh); UI.toast(r.loi ? (r.loi === 'not_found' ? 'Hồ sơ này không còn ảnh nào' : loiText(r)) : 'Đã xóa ảnh CCCD', { type: r.loi ? 'warning' : 'ok' }); },
          }));
        };
        ve();
        el.querySelector('#ivNew').onclick = () => { close(); inviteDialog(ctx); };
        // tải lại từ máy chủ để thấy hồ sơ mới nhất rồi vẽ lại tại chỗ
        S.loadInvites().then(() => { if (!el.isConnected) return; if (!tuChon) tab = macDinh(); ve(); });
      },
    });
  }

  /** Từ chối hồ sơ khách đã gửi. after() chạy sau khi xong. */
  function rejectInvite(inv, after) {
    const ten = (inv.data && inv.data.fullName) || 'khách';
    UI.dangerDialog({
      title: `Từ chối hồ sơ của ${ten}`, description: 'Khách <b>không</b> nhận thông báo gì, bạn nên nhắn cho khách lý do và gửi link mới nếu cần.',
      consequences: ['Hồ sơ chuyển sang "Đã xử lý", không tạo khách thuê', 'Ảnh CCCD được giữ 30 ngày rồi tự xóa (hoặc bạn xóa ngay trong danh sách)', 'Thao tác được ghi vào nhật ký'],
      confirmLabel: 'Từ chối', reasonLabel: 'Lý do từ chối', minReason: 3,
      onConfirm: async (reason) => {
        const r = await S.decideInvite(inv.id, 'rejected', reason);
        if (r.loi) { UI.toast(loiText(r), { type: 'error' }); return; }
        UI.toast('Đã từ chối hồ sơ', { type: 'ok' }); if (after) after();
      },
    });
  }

  HH.onboardingUI = { inviteDialog, listDialog, rejectInvite, loiText };
})();

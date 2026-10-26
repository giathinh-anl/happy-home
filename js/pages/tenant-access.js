/* ============================================================
   Mã vào app khách thuê (chủ trọ cấp)

   Khách vào app khách thuê bằng số điện thoại + mã 6 số này. Máy chủ chỉ giữ bản băm nên chủ trọ
   cũng không xem lại được mã: phải chép hoặc gửi ngay lúc cấp. Quên thì cấp mã mới.
   Hàm máy chủ: owner_issue_tenant_code, owner_issue_tenant_codes, owner_revoke_tenant_access
   (supabase/migration-tenant-auth.sql). Chỉ CHỦ TRỌ cấp được, nhân viên thì không.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  // App khách nằm cùng chỗ với web quản trị
  const appUrl = () => new URL('tenant-app/index.html', location.href.split('#')[0]).href;
  const tinMoi = (name, phone, code) =>
    `Chào ${name}, mã vào app Happy Home của bạn là ${code}.\nMở ${appUrl()} rồi nhập số điện thoại ${phone} và mã này. Đừng chia sẻ mã cho người khác nhé.`;

  /** Gọi hàm máy chủ, trả { data } hoặc { loi: 'câu báo lỗi tiếng Việt' } */
  async function goi(name, args) {
    if (!HH.backend || !HH.backend.enabled) return { loi: 'Mã vào app chỉ dùng được khi web đã nối máy chủ Supabase.' };
    let r;
    try { r = await HH.backend.rpc(name, args); } catch (e) { return { loi: 'Không kết nối được máy chủ. Thử lại sau.' }; }
    if (r.error) {
      const m = (r.error.message || '').toLowerCase();
      if (r.error.code === 'PGRST202' || m.includes('could not find the function') || r.error.code === '42883')
        return { loi: 'Máy chủ chưa có chức năng này. Chạy tệp supabase/migration-tenant-auth.sql trong Supabase → SQL Editor một lần.' };
      return { loi: 'Máy chủ báo lỗi: ' + r.error.message };
    }
    const d = r.data;
    if (d && d.error) {
      return { loi: { auth: 'Cần đăng nhập tài khoản chủ trọ.', not_found: 'Không tìm thấy khách này trên máy chủ (đã lưu lên chưa?).',
        no_phone: 'Khách chưa có số điện thoại hợp lệ (10 số, bắt đầu bằng 0). Sửa hồ sơ khách trước.' }[d.error] || 'Không cấp được: ' + d.error };
    }
    return { data: d };
  }

  const ghiNho = (id, v) => { const t = S.tenantById(id); if (t) { t.appCodeSetAt = v; S.persist(); } };

  function chep(text, nhan) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(
      () => UI.toast('Đã chép ' + nhan, { type: 'ok' }), () => UI.toast('Trình duyệt không cho chép tự động', { type: 'warning' }));
    else UI.toast('Trình duyệt không hỗ trợ sao chép', { type: 'error' });
  }

  /* ---------------- MỘT KHÁCH ---------------- */
  function dialog(ctx, t) {
    const co = !!t.appCodeSetAt;
    UI.modal({
      title: `Mã vào app · ${t.fullName}`, size: 'wide',
      bodyHtml: h`
        <div class="alert alert-info" style="margin-bottom:14px"><span class="ic">${raw(HH.ic('info', 16))}</span>
          <div>Khách vào app khách thuê bằng <b>số điện thoại ${t.phone || '(chưa có)'}</b> và <b>mã 6 số</b> dưới đây.
          Mã chỉ hiện <b>một lần</b> lúc cấp, máy chủ chỉ giữ bản băm nên chủ trọ cũng không xem lại được.</div></div>
        <div class="row-gap-3" style="margin-bottom:10px">
          <span class="badge ${raw(co ? 's-success' : 's-warning')}"><span class="dot"></span>${co ? 'Đã cấp ngày ' + U.fmtDate(t.appCodeSetAt) : 'Chưa cấp mã'}</span></div>
        ${raw(co ? '<p class="muted text-sm">Cấp mã mới sẽ <b>đăng xuất khách khỏi mọi thiết bị</b> và mở khóa nếu khách đang bị khóa vì nhập sai.</p>' : '')}
        <div id="acRes"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span>
        ${co ? '<button class="btn btn-outline" id="acRevoke">Thu hồi quyền vào app</button>' : ''}
        <button class="btn btn-primary" id="acIssue">${co ? 'Cấp mã mới' : 'Cấp mã'}</button>`,
      onMount(el) {
        const res = el.querySelector('#acRes'), btn = el.querySelector('#acIssue');
        btn.onclick = async () => {
          btn.classList.add('loading'); btn.disabled = true; res.innerHTML = '';
          const r = await goi('owner_issue_tenant_code', { p_tenant_id: t.id });
          btn.classList.remove('loading'); btn.disabled = false;
          if (r.loi) { res.innerHTML = `<div class="alert alert-danger"><span class="ic">${HH.ic('alert', 16)}</span><div>${U.esc(r.loi)}</div></div>`; return; }
          const code = r.data.code, msg = tinMoi(t.fullName, t.phone, code);
          ghiNho(t.id, new Date().toISOString());
          res.innerHTML = `<div class="ac-box"><div class="ac-lbl">Mã vào app của ${U.esc(t.fullName)}</div>
              <div class="ac-code" id="acCode">${code}</div>
              <div class="muted text-xs">Hiện một lần duy nhất. Chép hoặc gửi cho khách ngay.</div>
              <div class="row-gap-2 wrap" style="margin-top:12px">
                <button class="btn btn-sm btn-primary" id="acCopyCode">Chép mã</button>
                <button class="btn btn-sm btn-outline" id="acCopyMsg">Chép tin nhắn mời</button>
                ${t.phone ? `<a class="btn btn-sm btn-outline" id="acZalo" href="https://zalo.me/${U.esc(String(t.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">Mở Zalo</a>` : ''}
              </div></div>`;
          el.querySelector('#acCopyCode').onclick = () => chep(code, 'mã');
          el.querySelector('#acCopyMsg').onclick = () => chep(msg, 'tin nhắn mời');
          const z = el.querySelector('#acZalo'); if (z) z.addEventListener('click', () => chep(msg, 'tin nhắn mời, dán vào Zalo'));
          HH.router.render();                    // cập nhật nhãn "đã có mã" phía sau hộp thoại
        };
        const rv = el.querySelector('#acRevoke');
        if (rv) rv.onclick = () => UI.dangerDialog({
          title: `Thu hồi quyền vào app của ${t.fullName}`,
          description: 'Khách sẽ không vào được app khách thuê nữa cho tới khi bạn cấp mã mới.',
          consequences: ['Mọi thiết bị đang đăng nhập bị đăng xuất', 'Mã cũ hết hiệu lực', 'Thao tác được ghi vào nhật ký'],
          confirmLabel: 'Thu hồi', reasonLabel: 'Lý do thu hồi',
          onConfirm: async (reason) => {
            const r = await goi('owner_revoke_tenant_access', { p_tenant_id: t.id });
            if (r.loi) { UI.toast(r.loi, { type: 'error' }); return; }
            ghiNho(t.id, null); S.log('tenant.revoke', `Thu hồi quyền vào app của ${t.fullName}`, reason);
            UI.toast('Đã thu hồi quyền vào app', { type: 'ok' }); HH.router.render();
          },
        });
      },
    });
  }

  /* ---------------- CẢ TÒA ---------------- */
  const coSdt = (t) => /^0\d{9}$/.test(HH.validate ? HH.validate.chuanSdt(t.phone) : String(t.phone || '').replace(/\D/g, ''));

  function bulkDialog(ctx) {
    const all = S.tenantsOf(ctx.bid).filter(coSdt);
    const thieu = all.filter(t => !t.appCodeSetAt);
    UI.modal({
      title: `Cấp mã vào app · ${ctx.building.name}`, size: 'wide',
      bodyHtml: h`
        <div id="acBulkTop">
          <p class="muted" style="margin-bottom:12px">Mỗi khách có số điện thoại hợp lệ sẽ nhận một mã 6 số riêng. Danh sách mã chỉ hiện <b>một lần</b>:
            chép, tải file hoặc in ngay rồi gửi cho từng khách (Zalo, tin nhắn hoặc nói trực tiếp).</p>
          <label class="check" style="display:block;margin-bottom:8px"><input type="radio" name="acMode" value="missing" checked>
            Chỉ khách <b>chưa có mã</b> (${thieu.length} người)</label>
          <label class="check" style="display:block"><input type="radio" name="acMode" value="all">
            <b>Tất cả</b> (${all.length} người). Mã cũ bị thay, khách đang dùng app sẽ bị đăng xuất.</label>
        </div>
        <div id="acBulkRes" style="margin-top:14px"></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span><button class="btn btn-primary" id="acBulkGo" ${thieu.length || all.length ? '' : 'disabled'}>Cấp mã</button>`,
      onMount(el) {
        const go = el.querySelector('#acBulkGo'), res = el.querySelector('#acBulkRes');
        go.onclick = async () => {
          const mode = el.querySelector('input[name=acMode]:checked').value;
          if (mode === 'all' && !confirm('Cấp lại mã cho TẤT CẢ khách? Mã cũ sẽ hết hiệu lực và mọi khách đang dùng app sẽ bị đăng xuất.')) return;
          go.classList.add('loading'); go.disabled = true;
          const r = await goi('owner_issue_tenant_codes', { p_building_id: ctx.bid, p_only_missing: mode === 'missing' });
          go.classList.remove('loading');
          if (r.loi) { go.disabled = false; res.innerHTML = `<div class="alert alert-danger"><span class="ic">${HH.ic('alert', 16)}</span><div>${U.esc(r.loi)}</div></div>`; return; }
          const list = r.data.codes || [];
          if (!list.length) { res.innerHTML = '<p class="muted">Không có khách nào cần cấp mã.</p>'; return; }
          const now = new Date().toISOString();
          list.forEach(c => { const t = S.tenantById(c.tenantId); if (t) t.appCodeSetAt = now; });
          S.persist();
          el.querySelector('#acBulkTop').style.display = 'none'; go.style.display = 'none';
          const rows = list.map(c => `<tr><td data-label="Phòng" class="dt-title"><b>${U.esc(c.roomCode || '')}</b></td><td data-label="Khách">${U.esc(c.name || '')}${c.isRep ? ' <span class="tn-tag rep">Đại diện</span>' : ''}</td>
              <td data-label="Điện thoại" class="mono">${U.esc(c.phone || '')}</td><td data-label="Mã" class="mono"><b class="ac-mini">${U.esc(c.code)}</b></td></tr>`).join('');
          res.innerHTML = `<div class="alert alert-warning" style="margin-bottom:10px"><span class="ic">${HH.ic('alert', 16)}</span>
              <div>Đã cấp <b>${list.length}</b> mã. Đây là <b>lần duy nhất</b> thấy chúng, hãy chép hoặc tải ngay.</div></div>
            <div class="row-gap-2 wrap" style="margin-bottom:10px">
              <button class="btn btn-sm btn-primary" id="acAllCopy">Chép danh sách</button>
              <button class="btn btn-sm btn-outline" id="acAllCsv">${HH.ic('sheet', 16)} Tải file Excel</button>
              <button class="btn btn-sm btn-outline" id="acAllPrint">${HH.ic('print', 16)} In</button></div>
            <div class="dt-wrap"><div class="dt-scroll" style="max-height:340px;overflow:auto"><table class="dt dt-cards">
              <thead><tr><th>Phòng</th><th>Khách</th><th>Điện thoại</th><th>Mã</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
          const text = list.map(c => `${c.roomCode} · ${c.name} · ${c.phone}: ${c.code}`).join('\n');
          el.querySelector('#acAllCopy').onclick = () => chep(text, 'danh sách mã');
          el.querySelector('#acAllCsv').onclick = () => {
            U.downloadCSV(`ma-vao-app-${ctx.bid}.csv`, ['Phòng', 'Họ tên', 'Điện thoại', 'Mã vào app', 'Tin nhắn mời'],
              list.map(c => [c.roomCode, c.name, c.phone, c.code, tinMoi(c.name, c.phone, c.code).replace(/\n/g, ' ')]));
            UI.toast('Đã tải file mã vào app. Giữ file cẩn thận, xóa sau khi gửi khách.', { type: 'ok' });
          };
          el.querySelector('#acAllPrint').onclick = () => {
            const w = window.open('', '_blank', 'width=760,height=900');
            if (!w) { UI.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép popup.', { type: 'error' }); return; }
            w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Mã vào app khách thuê</title>
              <style>body{font-family:Arial,sans-serif;font-size:14px;margin:24px}h1{font-size:18px}table{border-collapse:collapse;width:100%}
              td,th{border:1px solid #444;padding:6px 10px;text-align:left}.m{font-family:monospace;font-size:16px;font-weight:700;letter-spacing:3px}
              .note{color:#a00;margin:8px 0 14px}</style></head><body>
              <h1>Mã vào app khách thuê · ${U.esc(ctx.building.name)}</h1>
              <div class="note">Tài liệu mật: chỉ phát cho từng khách, không để người khác thấy. Mở ${U.esc(appUrl())} rồi nhập số điện thoại + mã.</div>
              <table><thead><tr><th>Phòng</th><th>Khách</th><th>Điện thoại</th><th>Mã</th></tr></thead><tbody>
              ${list.map(c => `<tr><td>${U.esc(c.roomCode || '')}</td><td>${U.esc(c.name || '')}</td><td>${U.esc(c.phone || '')}</td><td class="m">${U.esc(c.code)}</td></tr>`).join('')}
              </tbody></table></body></html>`);
            w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
          };
          HH.router.render();
        };
      },
    });
  }

  HH.tenantAccess = { dialog, bulkDialog };
})();

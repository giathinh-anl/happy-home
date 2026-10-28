/* ============================================================
   Trang: Nhắc nợ nhiều cấp + phí trễ hạn
   Tính toán nằm ở js/reminders.js (có kiểm thử). Hệ thống chỉ SOẠN tin, không tự gửi:
   chủ trọ đọc, sửa, rồi tự chép / mở Zalo / nhắn SMS.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw, R = HH.reminders;

  let rmFilter = null;          // mã mức đang lọc, hoặc 'homnay' = những phòng nên nhắc ngay

  const TONE = { 'sap-han': 'info', 'nhac-nhe': 'warning', 'nhac-phi': 'danger', 'khan': 'danger' };
  const levelBadge = (m) => `<span class="badge s-${TONE[m.ma]}${m.ma === 'khan' ? ' rm-khan' : ''}">${U.esc(m.nhan)}</span>`;

  const taiKhoan = () => R.taiKhoan(window.HH_CONFIG);

  const trangThai = (bid, g) => R.trangThaiNhac(S.lastReminder(bid, g.roomCode), g.muc, U.today());

  function rowsOf(bid) {
    return S.remindGroups(bid).map(g => ({ id: g.key, roomCode: g.roomCode, tenantName: g.tenantName || '', g, st: trangThai(bid, g) }));
  }

  // một thẻ <span> duy nhất: trên điện thoại ô bảng là flex, chữ rời rạc sẽ bị giãn cách đều ra hai bên
  const tre = (g) => '<span>' + (g.ngayTreMax > 0 ? `Quá hạn <b>${g.ngayTreMax}</b> ngày`
    : g.ngayTreMax === 0 ? 'Đến hạn hôm nay' : `Còn <b>${-g.ngayTreMax}</b> ngày`) + '</span>';

  /* ---------------- TRANG ---------------- */
  HH.pages.reminders = {
    render(ctx) {
      // Đường dẫn từ "Hôm nay" (?filter=homnay hoặc mã mức): áp bộ lọc một lần rồi bỏ khỏi địa chỉ,
      // nếu không bấm chip lọc sẽ bị đường dẫn đè lại mỗi lần vẽ lại.
      const q = new URLSearchParams((location.hash.split('?')[1] || ''));
      if (q.has('filter')) {
        rmFilter = q.get('filter') || null;
        try { history.replaceState(null, '', location.href.split('?')[0].split('#')[0] + '#' + location.hash.slice(1).split('?')[0]); } catch (e) {}
      }
      const policy = S.lateFeePolicy(ctx.bid);
      const all = rowsOf(ctx.bid);
      const nenNhac = all.filter(r => r.st.nenNhac);
      const view = rmFilter === 'homnay' ? nenNhac : rmFilter ? all.filter(r => r.g.muc.ma === rmFilter) : all;
      const tong = all.reduce((s, r) => s + r.g.tongCanTra, 0);
      const phi = all.reduce((s, r) => s + r.g.phi, 0);

      const chip = (key, label, n, tone) => {
        const on = rmFilter === key;
        return `<button class="lz-chip ${on ? 'on' : ''}" data-rmfilter="${key || ''}">
          <span class="lz-chip-box">${on ? '✓' : ''}</span>${label}<span class="lz-chip-cnt ${tone ? 's-' + tone : ''}">${n}</span></button>`;
      };
      const chips = chip('homnay', 'Nên nhắc ngay', nenNhac.length, nenNhac.length ? 'danger' : '')
        + R.MUC.map(m => chip(m.ma, m.ten, all.filter(r => r.g.muc.ma === m.ma).length, m.bac >= 2 ? 'danger' : '')).join('');

      const dt = UI.DataTable({
        rows: view, rowId: r => r.id, searchKeys: ['roomCode', 'tenantName'],
        searchPlaceholder: 'Tìm phòng hoặc tên khách...',
        emptyTitle: 'Chưa có phòng nào cần nhắc', emptyIcon: HH.ic('check', 30),
        emptyDesc: 'Không có khoản nào sắp đến hạn hoặc đã quá hạn.',
        onRowClick: r => openCompose(ctx, r.id),
        columns: [
          { key: 'roomCode', label: 'Phòng', sortable: true, sortVal: r => r.roomCode,
            render: r => `<b>${U.esc(r.roomCode)}</b><div class="muted text-xs">${U.esc(r.tenantName)}</div>` },
          { key: 'muc', label: 'Mức', sortable: true, sortVal: r => r.g.muc.bac, render: r => levelBadge(r.g.muc) },
          { key: 'tre', label: 'Hạn thanh toán', sortable: true, sortVal: r => r.g.ngayTreMax, render: r => tre(r.g) },
          { key: 'cantra', label: 'Cần thu', align: 'right', sortable: true, sortVal: r => r.g.tongCanTra,
            render: r => `<b class="mono" style="color:var(--danger)">${U.currency(r.g.tongCanTra)}</b>`
              + (r.g.phi ? `<div class="muted text-xs">gồm phí trễ hạn ${U.currency(r.g.phi)}</div>` : '') },
          { key: 'nhac', label: 'Đã nhắc?', render: r => `<span class="rm-st rm-${r.st.nenNhac ? 'can' : 'xong'}">${U.esc(r.st.nhan)}</span>` },
          { key: 'act', label: '', render: r => `<button class="btn btn-sm btn-primary" data-rm="${U.esc(r.id)}">Soạn tin</button>` },
        ],
      });
      ctx._dt = dt;

      const feeNote = policy.moiNgay
        ? `Phí trễ hạn: <b>${U.currency(policy.moiNgay)}/ngày</b>, miễn ${policy.mienNgay} ngày đầu, tối đa 10% tiền hóa đơn.`
        : 'Phí trễ hạn đang <b>tắt</b>. Bật nếu hợp đồng của bạn có ghi điều khoản này.';

      const cards = [
        UI.metricCard({ label: 'Phòng cần nhắc', value: all.length, format: 'number', intent: 'warning', sub: nenNhac.length + ' phòng nên nhắc ngay' }),
        UI.metricCard({ label: 'Tổng cần thu', value: tong, format: 'currency', intent: 'danger' }),
        UI.metricCard({ label: 'Phí trễ hạn tạm tính', value: phi, format: 'currency', sub: policy.moiNgay ? 'chưa ghi vào hóa đơn' : 'đang tắt' }),
        UI.metricCard({ label: 'Quá hạn trên 7 ngày', value: all.filter(r => r.g.muc.ma === 'khan').length, format: 'number', intent: 'danger' }),
      ].join('');

      return h`<div class="page-head">
        <div><div class="page-title-lg">Nhắc nợ</div>
          <div class="page-sub">${ctx.building.name} · ${all.length} phòng cần theo dõi</div></div>
        <div class="page-actions">
          <button class="btn btn-outline" id="rmPolicy">${raw(HH.ic('settings', 16))} Phí trễ hạn</button>
        </div>
      </div>
      <div class="metric-grid">${raw(cards)}</div>
      <div class="rm-note">${raw(HH.ic('info', 16))}<span>${raw(feeNote)} Hệ thống chỉ soạn tin, <b>không tự gửi</b>: bạn đọc, sửa rồi tự gửi.</span></div>
      <div class="lz-chips" style="margin:12px 0">${raw(HH.icon('filter', 16))}${raw(chips)}</div>
      <div id="rmTable">${raw(dt.render())}</div>`;
    },

    mount(ctx) {
      ctx._dt.attach(document);
      document.querySelectorAll('[data-rmfilter]').forEach(b => b.onclick = () => {
        rmFilter = rmFilter === b.dataset.rmfilter ? null : (b.dataset.rmfilter || null);
        HH.router.render();
      });
      // bấm nút trong dòng: ủy quyền ở bảng vì DataTable dựng lại thân bảng khi tìm / sắp xếp
      document.getElementById('rmTable').addEventListener('click', (e) => {
        const b = e.target.closest('[data-rm]'); if (!b) return;
        e.stopPropagation(); openCompose(ctx, b.dataset.rm);
      });
      document.getElementById('rmPolicy').onclick = () => policyDialog(ctx);
    },
  };

  /* ---------------- SOẠN TIN ---------------- */
  function openCompose(ctx, key) {
    const g = S.remindGroups(ctx.bid).find(x => x.key === key);
    if (!g) { UI.toast('Phòng này không còn khoản cần nhắc', { type: 'ok' }); HH.router.render(); return; }
    const policy = S.lateFeePolicy(ctx.bid), now = U.today();
    const tk = taiKhoan();
    const tenant = S.tenantById(g.tenantId) || {};
    const phone = String(tenant.phone || '').replace(/\D/g, '');
    const text = R.soanTin(g, { taiKhoan: tk, chinhSach: policy, noiDungCK: i => S.transferContent(i), homNay: now });
    const st = trangThai(ctx.bid, g);
    const canApply = S.isOwner() && policy.moiNgay > 0 && g.hoaDon.some(i => R.tinhPhi(i, policy, now).phi !== R.phiDaAp(i));

    const invRows = g.hoaDon.map(i => {
      const f = R.tinhPhi(i, policy, now), da = R.phiDaAp(i), n = R.ngayTre(i, now);
      return `<tr><td data-label="Kỳ" class="dt-title"><b>${U.esc(S.periodLabel(i.period))}</b></td>
        <td data-label="Hạn">${U.fmtDate(i.dueDate)}</td>
        <td data-label="Trễ" class="num">${n > 0 ? n + ' ngày' : '-'}</td>
        <td data-label="Còn nợ" class="num mono">${U.currency(R.conNo(i))}</td>
        <td data-label="Phí" class="num mono"><span>${f.phi ? U.currency(f.phi) : '-'}${f.bangTran ? ' <span class="muted text-xs" title="Chạm trần 10% tiền hóa đơn">(trần)</span>' : ''}</span>
          ${da ? `<div class="muted text-xs">đã ghi ${U.currency(da)}${S.isOwner() ? ` · <a href="#" data-unfee="${U.esc(i.id)}">gỡ</a>` : ''}</div>` : ''}</td></tr>`;
    }).join('');

    const body = h`
      <div class="rm-sum">
        <div><span>Còn nợ</span><b>${U.currency(g.conNo - g.phiDaAp)}</b></div>
        ${raw(policy.moiNgay ? `<div><span>Phí trễ hạn</span><b>${U.currency(g.phi)}</b></div>` : '')}
        <div class="tot"><span>Tổng cần trả</span><b>${U.currency(g.tongCanTra)}</b></div>
      </div>
      <div class="dt-wrap rm-inv"><div class="dt-scroll"><table class="dt dt-cards">
        <thead><tr><th>Kỳ</th><th>Hạn</th><th class="num">Trễ</th><th class="num">Còn nợ</th><th class="num">Phí tạm tính</th></tr></thead>
        <tbody>${raw(invRows)}</tbody></table></div></div>
      ${raw(canApply ? `<div class="rm-apply"><span>Phí mới chỉ là <b>tạm tính</b>, khách chưa thấy trong hóa đơn.</span>
        <button class="btn btn-sm btn-outline" id="rmApply">Ghi phí vào hóa đơn</button></div>` : '')}
      <div class="field" style="margin-top:14px"><label>Tin nhắn · ${raw(levelBadge(g.muc))}</label>
        <textarea class="textarea" id="rmText" rows="10">${text}</textarea>
        <span class="hint" id="rmHist">${U.esc(st.nhan)}</span></div>
      ${raw(tk ? '' : `<div class="alert alert-warning" style="margin-top:8px"><span class="ic">${HH.ic('alert', 16)}</span>
        <div>Chưa khai báo tài khoản nhận tiền nên tin chưa có số tài khoản. Thêm <span class="mono">bank: { name, account, holder }</span> vào <span class="mono">js/config.js</span>.</div></div>`)}`;

    // trên điện thoại (css/mobile.css): "Đã nhắc trực tiếp" một hàng riêng, ba nút gửi chia đều hàng dưới
    const foot = `<button class="btn btn-outline rm-f-close" data-close>Đóng</button>
      <button class="btn btn-outline rm-f-direct" id="rmDirect" title="Đã gọi điện hoặc nói trực tiếp">Đã nhắc trực tiếp</button>
      <button class="btn btn-outline rm-f-act" id="rmSms" ${phone ? '' : 'disabled title="Khách chưa có số điện thoại"'}>SMS</button>
      <button class="btn btn-outline rm-f-act" id="rmZalo" ${phone ? '' : 'disabled title="Khách chưa có số điện thoại"'}>Zalo</button>
      <button class="btn btn-primary rm-f-act" id="rmCopy">Chép tin</button>`;

    UI.modal({
      title: `Nhắc nợ phòng ${g.roomCode}${g.tenantName ? ' · ' + g.tenantName : ''}`, size: 'wide',
      bodyHtml: body, footHtml: foot,
      onMount(el, close) {
        const ta = el.querySelector('#rmText');
        const ghi = (kenh) => {
          S.logReminder(g, kenh);
          el.querySelector('#rmHist').textContent = 'Vừa ghi nhận đã nhắc qua ' + kenh;
          HH.router.render();
        };
        const chep = () => (navigator.clipboard && navigator.clipboard.writeText)
          ? navigator.clipboard.writeText(ta.value) : Promise.reject(new Error('no clipboard'));
        el.querySelector('#rmCopy').onclick = () => chep().then(
          () => { UI.toast('Đã chép tin nhắn', { type: 'ok' }); ghi('chép tin'); },
          () => { ta.select(); UI.toast('Trình duyệt không cho chép tự động. Tin đã được chọn sẵn, bấm Ctrl+C.', { type: 'warning' }); });
        el.querySelector('#rmZalo').onclick = () => {
          // Zalo không nhận sẵn nội dung qua đường dẫn, nên chép vào bộ nhớ để khách dán
          chep().then(() => UI.toast('Đã chép tin, dán vào ô chat Zalo', { type: 'ok' }), () => {});
          window.open('https://zalo.me/' + phone, '_blank', 'noopener');
          ghi('Zalo');
        };
        el.querySelector('#rmSms').onclick = () => {
          window.location.href = 'sms:' + phone + '?&body=' + encodeURIComponent(ta.value);
          ghi('SMS');
        };
        el.querySelector('#rmDirect').onclick = () => ghi('trực tiếp / điện thoại');

        const ap = el.querySelector('#rmApply');
        if (ap) ap.onclick = () => { close(); confirmApply(ctx, g, policy, now); };
        el.querySelectorAll('[data-unfee]').forEach(a => a.onclick = (e) => {
          e.preventDefault();
          S.applyLateFee(a.dataset.unfee, 0, 'Miễn phí trễ hạn');
          UI.toast('Đã gỡ phí trễ hạn khỏi hóa đơn', { type: 'ok' });
          close(); HH.router.render(); openCompose(ctx, key);
        });
      },
    });
  }

  /** Ghi phí vào hóa đơn thật: khách sẽ thấy, và số tiền phải trả đổi theo. Nên hỏi lại trước. */
  function confirmApply(ctx, g, policy, now) {
    const list = g.hoaDon.map(i => ({ i, f: R.tinhPhi(i, policy, now), da: R.phiDaAp(i) })).filter(x => x.f.phi !== x.da);
    const tong = list.reduce((s, x) => s + x.f.phi - x.da, 0);
    const li = list.map(x => `<li><b>${U.esc(x.i.id)}</b> (${U.esc(S.periodLabel(x.i.period))}): ${x.da ? U.currency(x.da) + ' → ' : ''}<b>${U.currency(x.f.phi)}</b></li>`).join('');
    UI.modal({
      title: `Ghi phí trễ hạn · phòng ${g.roomCode}`,
      bodyHtml: `<p class="muted" style="margin-bottom:10px">Phí được thêm thành một dòng vào hóa đơn, tính đến hôm nay (${U.fmtDate(now)}). Khách thấy khoản này trong app và số tiền cần trả tăng <b>${U.currency(tong)}</b>.</p>
        <ul class="consequence">${li}</ul>
        <div class="alert alert-warning" style="margin-top:12px"><span class="ic">${HH.ic('alert', 16)}</span>
          <div>Chỉ nên thu khi hợp đồng thuê đã ghi điều khoản phạt trễ hạn. Phí không tự tăng thêm theo ngày sau khi ghi; muốn cập nhật thì ghi lại.${S.nightlyPolicy(ctx.bid).phiTuDong ? ' Ghi tay là bạn tự quyết phí của hóa đơn này: lần chạy đêm sẽ không tự đổi nó nữa.' : ''}</div></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Quay lại</button><span class="spacer"></span><button class="btn btn-primary" id="rmGo">Ghi phí</button>`,
      onMount(el, close) {
        el.querySelector('#rmGo').onclick = () => {
          list.forEach(x => S.applyLateFee(x.i.id, x.f.phi,
            `${x.f.ngayTinhPhi} ngày × ${U.currency(policy.moiNgay)}${x.f.bangTran ? ', chạm trần 10%' : ''} · tính đến ${U.fmtDate(now)}`));
          UI.toast('Đã ghi phí trễ hạn vào hóa đơn', { type: 'ok' });
          close(); HH.router.render();
        };
      },
    });
  }

  /* ---------------- CHẠY NGAY (như lần chạy đêm) ---------------- */
  const LOI_CHAY = {
    missing: 'Máy chủ chưa có chức năng chạy ban đêm. Chạy supabase/migration-nightly.sql trong Supabase → SQL Editor một lần.',
    demo: 'Bản demo không có máy chủ nên không chạy được.', auth: 'Cần đăng nhập tài khoản chủ trọ.',
    network: 'Không kết nối được máy chủ. Thử lại sau.', flush: 'Chưa lưu được thay đổi đang chờ lên máy chủ. Thử lại sau.',
  };
  function runNightlyDialog(ctx, na) {
    const lam = [na.phiTuDong ? 'ghi phí trễ hạn vào các hóa đơn còn nợ và đã quá hạn quá số ngày miễn phí' : '',
      na.nhacTuDong ? 'gửi thông báo nhắc nợ vào app của khách có hóa đơn sắp đến hạn hoặc quá hạn' : '',
      'cập nhật trạng thái quá hạn của hóa đơn theo ngày'].filter(Boolean);
    UI.modal({
      title: 'Chạy ngay như lần chạy đêm',
      bodyHtml: `<p class="muted" style="margin-bottom:10px">Theo cài đặt đã lưu cho tòa này, máy chủ sẽ:</p>
        <ul class="consequence">${lam.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>
        <div class="alert alert-warning" style="margin-top:12px"><span class="ic">${HH.ic('alert', 16)}</span>
          <div>Phí được ghi vào hóa đơn thật và khách thấy ngay. Chạy lại trong ngày không ghi trùng. Chỉ nên bật khi hợp đồng thuê đã ghi điều khoản phạt trễ hạn.</div></div>`,
      footHtml: `<button class="btn btn-outline" data-close>Quay lại</button><span class="spacer"></span><button class="btn btn-primary" id="rnGo">Chạy ngay</button>`,
      onMount(el, close) {
        el.querySelector('#rnGo').onclick = async (e) => {
          const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Đang chạy...';
          const r = await S.runNightly(ctx.bid);
          close();
          if (!r.ok) { UI.toast(LOI_CHAY[r.reason] || ('Không chạy được: ' + (r.message || r.reason)), { type: 'error' }); return; }
          const d = r.data || {};
          const ds = [];
          if (na.phiTuDong) ds.push(`ghi phí cho ${d.fees || 0} hóa đơn` + (d.fees ? ` (+${U.currency(d.feeAmount || 0)})` : ''));
          if (na.nhacTuDong) ds.push(`gửi ${d.notices || 0} thông báo vào app khách`);
          if (d.statuses) ds.push(`đổi trạng thái ${d.statuses} hóa đơn`);
          UI.toast('Đã chạy: ' + (ds.length ? ds.join(', ') : 'không có gì cần xử lý') + '.', { type: 'ok' });
          HH.router.render();
        };
      },
    });
  }

  /* ---------------- CHÍNH SÁCH PHÍ ---------------- */
  function policyDialog(ctx) {
    const p = S.lateFeePolicy(ctx.bid), owner = S.isOwner();
    const on = p.moiNgay > 0;
    const na = S.nightlyPolicy(ctx.bid), online = !!(HH.backend && HH.backend.enabled), canAuto = owner && online;
    const body = h`
      <label class="rm-switch"><input type="checkbox" id="pfOn" ${raw(on ? 'checked' : '')} ${raw(owner ? '' : 'disabled')}>
        <span><b>Tính phí trễ hạn</b><br><span class="muted text-xs">Mặc định tắt. Chỉ thu khi hợp đồng thuê đã ghi điều khoản này.</span></span></label>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>Miễn phí mấy ngày đầu</label>
          <input class="input mono" id="pfGrace" inputmode="numeric" value="${p.mienNgay}" ${raw(owner ? '' : 'disabled')}>
          <span class="hint">0 = tính từ ngày đầu tiên quá hạn</span></div>
        <div class="field"><label>Phí mỗi ngày (₫)</label>
          <input class="input mono" id="pfPer" inputmode="numeric" value="${p.moiNgay || 20000}" ${raw(owner ? '' : 'disabled')}>
          <span class="hint">Tổng phí không quá 10% tiền hóa đơn</span></div>
      </div>
      <div class="rm-demo" id="pfDemo"></div>
      <div class="rm-auto">
        <h4>Tự động mỗi đêm (0 giờ 05)</h4>
        <label class="rm-switch"><input type="checkbox" id="pfAutoFee" ${raw(na.phiTuDong && on ? 'checked' : '')} ${raw(canAuto && on ? '' : 'disabled')}>
          <span><b>Tự ghi phí trễ hạn vào hóa đơn</b><br><span class="muted text-xs">Máy chủ tính lại mỗi đêm và ghi dòng “Phí trễ hạn” cho hóa đơn còn nợ, khách thấy trong app. Phí chỉ tăng, không tự giảm. Hóa đơn bạn đã tự ghi hoặc miễn phí bằng tay thì hệ thống không đụng lại.</span></span></label>
        <label class="rm-switch"><input type="checkbox" id="pfAutoRemind" ${raw(na.nhacTuDong ? 'checked' : '')} ${raw(canAuto ? '' : 'disabled')}>
          <span><b>Tự báo nhắc nợ vào app khách thuê</b><br><span class="muted text-xs">Khách thấy thông báo trong app khi sắp đến hạn, quá hạn 1 đến 3 ngày, 4 đến 7 ngày và từ 8 ngày. Không gửi Zalo hay SMS: bạn vẫn nhắc bằng tay ở trang này.</span></span></label>
        ${raw(canAuto ? `<div class="rm-auto-last muted text-xs">Lần chạy gần nhất: ${U.esc(na.ghiChu || 'chưa chạy lần nào')}</div>`
          : `<div class="rm-auto-last muted text-xs">${owner ? 'Cần nối máy chủ Supabase và chạy supabase/migration-nightly.sql để dùng mục này.' : 'Chỉ chủ trọ mới đổi được mục này.'}</div>`)}
      </div>
      <p class="muted text-xs" style="margin-top:10px">Chưa bật tự ghi thì phí chỉ là tạm tính trên trang Nhắc nợ cho đến khi bạn bấm “Ghi phí vào hóa đơn”.
        ${raw(owner ? '' : '<br><b>Chỉ chủ trọ mới đổi được mục này.</b>')}</p>`;
    UI.modal({
      title: 'Phí trễ hạn', bodyHtml: body,
      footHtml: `<button class="btn btn-outline" data-close>${owner ? 'Hủy' : 'Đóng'}</button>${canAuto ? `<button class="btn btn-ghost" id="pfRun" ${na.phiTuDong || na.nhacTuDong ? '' : 'disabled'} title="Làm đúng việc của lần chạy đêm, theo cài đặt đã lưu">Chạy ngay</button>` : ''}${owner ? '<span class="spacer"></span><button class="btn btn-primary" id="pfSave">Lưu</button>' : ''}`,
      onMount(el, close) {
        const $ = (s) => el.querySelector(s);
        const demo = () => {
          const per = U.parseNum($('#pfPer').value) || 0, gr = U.parseNum($('#pfGrace').value);
          const cs = { moiNgay: $('#pfOn').checked ? per : 0, mienNgay: gr };
          if (!cs.moiNgay) { $('#pfDemo').innerHTML = 'Phí đang tắt: khách trễ bao lâu cũng không bị tính thêm.'; return; }
          const mau = (t, n) => R.tinhPhi({ total: t, paid: 0, status: 'issued', lines: [{ amount: t }],
            dueDate: new Date(Date.now() - n * 86400000).toISOString() }, cs, new Date()).phi;
          $('#pfDemo').innerHTML = `Ví dụ hóa đơn 3.000.000 ₫: trễ 10 ngày → <b>${U.currency(mau(3000000, 10))}</b> · trễ 60 ngày → <b>${U.currency(mau(3000000, 60))}</b> (đã chạm trần 300.000 ₫).`;
        };
        ['#pfOn', '#pfPer', '#pfGrace'].forEach(s => $(s).addEventListener('input', demo));
        demo();
        // tự ghi phí chỉ có nghĩa khi đã bật tính phí
        $('#pfOn').addEventListener('change', () => {
          const af = $('#pfAutoFee'); if (!af || !canAuto) return;
          af.disabled = !$('#pfOn').checked; if (af.disabled) af.checked = false;
        });
        const run = $('#pfRun');
        if (run) run.onclick = () => { close(); runNightlyDialog(ctx, S.nightlyPolicy(ctx.bid)); };
        const save = $('#pfSave'); if (!save) return;
        save.onclick = () => {
          const bat = $('#pfOn').checked, per = U.parseNum($('#pfPer').value), gr = U.parseNum($('#pfGrace').value);
          if (bat) {
            if (!(per >= 1000 && per <= 1000000)) { UI.toast('Phí mỗi ngày nên từ 1.000 ₫ đến 1.000.000 ₫', { type: 'error' }); return; }
            if (!(gr >= 0 && gr <= 30)) { UI.toast('Số ngày miễn phí từ 0 đến 30', { type: 'error' }); return; }
          }
          S.setLateFeePolicy(ctx.bid, { moiNgay: bat ? per : 0, mienNgay: bat ? gr : p.mienNgay });
          let auto = null;
          if (canAuto) {
            auto = S.setNightlyPolicy(ctx.bid, { phiTuDong: bat && $('#pfAutoFee').checked, nhacTuDong: $('#pfAutoRemind').checked });
          }
          UI.toast(bat ? 'Đã bật phí trễ hạn' : 'Đã tắt phí trễ hạn', { type: 'ok' });
          close(); HH.router.render();
          if (auto && (auto.lateFeeAuto || auto.autoRemind) && HH.backend.hasColumn) HH.backend.hasColumn('buildings', 'late_fee_auto').then(ok => {
            if (!ok) UI.toast('Máy chủ chưa có chức năng chạy ban đêm. Chạy supabase/migration-nightly.sql trong Supabase → SQL Editor một lần, nếu không cài đặt sẽ mất khi tải lại trang.', { type: 'warning' });
          });
          // Chưa chạy migration thì máy chủ bỏ cột này và cài đặt mất khi tải lại: nói thẳng
          if (HH.backend && HH.backend.hasColumn) HH.backend.hasColumn('buildings', 'late_fee_per_day').then(ok => {
            if (!ok) UI.toast('Máy chủ chưa có cột lưu mục này. Chạy supabase/migration-late-fee.sql, nếu không cài đặt sẽ mất khi tải lại trang.', { type: 'warning' });
          });
        };
      },
    });
  }
})();

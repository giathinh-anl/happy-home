/* ============================================================
   Điểm thưởng đóng tiền đúng hạn: huy hiệu ở trang Khách thuê, hộp thoại xem điểm + đổi điểm giảm hóa đơn, hộp thoại cài đặt.
   Luật ở js/rewards.js (có kiểm thử); đây chỉ là giao diện.
   ============================================================ */
HH.rewardsUI = (function () {
  const U = HH.util, S = HH.store, UI = HH.ui, R = HH.rewards, h = U.html, raw = U.raw;
  const so = (n) => U.number(n);

  /** Huy hiệu số điểm cạnh tên phòng (chỉ hiện khi chương trình đang bật) */
  function badge(bid, roomCode) {
    if (!roomCode || !S.rewardConfig(bid).bat) return '';
    const r = S.rewardOf(bid, roomCode);
    return `<button class="rw-badge" data-reward="${U.esc(roomCode)}" title="Điểm thưởng đóng tiền đúng hạn. Bấm để xem sổ điểm và đổi điểm giảm hóa đơn.">`
      + `${HH.ic('sparkles', 14)} <b>${so(r.soDu)}</b> điểm</button>`;
  }

  /* ---------- Xem điểm + đổi điểm của một phòng ---------- */
  function roomDialog(ctx, roomCode) {
    const room = S.room(ctx.bid, roomCode);
    if (!room) return;
    const tenant = room.tenantName || '';
    UI.modal({
      title: `Điểm thưởng · Phòng ${roomCode}`, size: 'wide',
      bodyHtml: '<div id="rwBody"></div>',
      footHtml: '<button class="btn btn-outline" data-close>Đóng</button>',
      onMount(el) {
        const body = el.querySelector('#rwBody');
        const draw = () => {
          const r = S.rewardOf(ctx.bid, roomCode), cfg = r.cauHinh, targets = S.rewardTargets(ctx.bid, roomCode);
          const sach = r.sach.slice().reverse().slice(0, 10).map(s => `<div class="settle-row"><span>${s.loai === 'chuoi'
            ? `Thưởng ${s.soThang} tháng liền đúng hạn` : `Hóa đơn hạn ${U.fmtDate(s.ngay)} đóng đúng hạn`}</span><span class="b" style="color:var(--success)">+${so(s.diem)}</span></div>`).join('');
          const tien = (d) => U.currency(d * cfg.tiLeDoi);
          body.innerHTML = `
            <div class="rw-hero"><div><div class="muted text-sm">${U.esc(tenant)}${tenant ? ' · ' : ''}đang có</div><div class="rw-big">${so(r.soDu)} <small>điểm</small></div>
              <div class="muted text-xs">Đã tích ${so(r.tong)} · đã đổi ${so(r.daDoi)}${r.thieu ? ` · <span style="color:var(--warning)">thiếu ${so(r.thieu)} điểm so với số đã đổi (đổi cấu hình hoặc xóa hóa đơn)</span>` : ''}</div></div>
              <div class="rw-chain">${r.chuoiHienTai ? `${r.chuoiHienTai} tháng liền đúng hạn` : 'Chưa có tháng đúng hạn liền nhau'}${cfg.thuongChuoi > 0
                ? `<div class="muted text-xs">Còn ${r.conThieu} tháng đúng hạn nữa được thưởng thêm ${so(cfg.thuongChuoi)} điểm</div>` : ''}</div></div>
            <h4 style="margin:16px 0 6px">Đổi điểm giảm hóa đơn</h4>
            ${targets.length ? `<div class="grid-2">
                <div class="field"><label>Hóa đơn</label><select class="select" id="rwInv">${targets.map(i =>
                  `<option value="${U.esc(i.id)}">${U.esc(i.id)} · ${U.esc(S.periodLabel(i.period))} · còn ${U.currency(i.total - i.paid)}</option>`).join('')}</select></div>
                <div class="field"><label>Số điểm đổi (theo bậc ${so(cfg.buocDoi)})</label><input class="input mono" id="rwPts" inputmode="numeric" autocomplete="off"></div></div>
              <p class="hint" id="rwPrev" style="margin:6px 0 0"></p><p class="field-error" id="rwErr" style="margin:6px 0 0;color:var(--danger)"></p>
              <div style="margin-top:10px"><button class="btn btn-primary" id="rwGo">Đổi điểm</button></div>`
              : '<p class="muted text-sm">Khách chưa có hóa đơn nào chờ thu để đổi điểm vào.</p>'}
            <p class="muted text-xs" style="margin-top:8px">${so(cfg.buocDoi)} điểm = giảm ${tien(cfg.buocDoi)}; mỗi hóa đơn đổi tối đa ${Math.round(cfg.tran * 100)}% số còn phải thu. Khách thấy khoản giảm ngay trong hóa đơn ở app. Hủy hóa đơn thì điểm tự trả lại.</p>
            <h4 style="margin:16px 0 6px">Sổ điểm gần đây</h4>${sach || '<p class="muted text-sm">Chưa có điểm nào. Điểm tính từ các hóa đơn đóng đủ đúng hạn' + (cfg.tuNgay ? ' từ ' + U.fmtDate(cfg.tuNgay) : '') + '.</p>'}
            <div style="margin-top:14px"><button class="btn btn-outline btn-sm" id="rwMsg">${HH.ic('chat', 16)} Soạn tin báo điểm cho khách</button></div>
            <div id="rwMsgBox" class="hidden" style="margin-top:10px"><textarea class="textarea" id="rwMsgTxt" rows="4" readonly></textarea>
              <div style="margin-top:6px"><button class="btn btn-primary btn-sm" id="rwCopy">${HH.ic('copy', 16)} Sao chép</button></div></div>`;

          const inp = body.querySelector('#rwPts'), sel = body.querySelector('#rwInv'), prev = body.querySelector('#rwPrev'), err = body.querySelector('#rwErr');
          const capNhat = () => {
            if (!inp) return null;
            const inv = S.invoice(sel.value), con = inv ? inv.total - inv.paid : 0;
            const d = U.parseNum(inp.value);
            const k = R.doiDiem({ soDu: r.soDu, diem: d, cauHinh: cfg, conPhaiThu: con, fmt: { tien: U.currency } });
            prev.textContent = k.ok ? `→ Giảm ${U.currency(k.tien)}, hóa đơn còn ${U.currency(con - k.tien)}` : '';
            err.textContent = (!inp.value.trim() || k.ok) ? '' : k.loi;
            return k;
          };
          if (inp) {
            const toiDa = () => R.toiDaDoi({ soDu: r.soDu, conPhaiThu: (S.invoice(sel.value) || { total: 0, paid: 0 }).total - (S.invoice(sel.value) || { paid: 0 }).paid, cauHinh: cfg });
            const macDinh = () => {
              const m = toiDa(); inp.value = m > 0 ? String(m) : ''; capNhat();
              // chưa đổi được thì nói rõ vì sao (ô trống mà không giải thích thì không hiểu)
              if (m <= 0) prev.textContent = r.soDu < cfg.buocDoi ? `Cần tối thiểu ${so(cfg.buocDoi)} điểm để đổi, còn thiếu ${so(cfg.buocDoi - r.soDu)} điểm.` : 'Hóa đơn này còn quá ít để đổi điểm.';
            };
            sel.onchange = macDinh; inp.oninput = () => { inp.value = inp.value.replace(/[^\d]/g, ''); capNhat(); }; macDinh();
            body.querySelector('#rwGo').onclick = () => {
              const k = capNhat();
              if (!inp.value.trim()) { err.textContent = 'Nhập số điểm muốn đổi'; return; }
              if (!k || !k.ok) return;
              const res = S.redeemReward(ctx.bid, roomCode, sel.value, U.parseNum(inp.value));
              if (!res.ok) { err.textContent = res.loi; return; }
              UI.toast(`Đã đổi ${so(res.diem)} điểm, giảm ${U.currency(res.tien)}`, { type: 'ok' });
              draw();
              HH.router.render();        // huy hiệu ở trang phía sau cập nhật số điểm mới (hộp thoại này vẫn mở)
            };
          }
          body.querySelector('#rwMsg').onclick = () => {
            const box = body.querySelector('#rwMsgBox'); box.classList.remove('hidden');
            body.querySelector('#rwMsgTxt').value = R.soanTin({ ten: tenant, phong: roomCode, soDu: S.rewardOf(ctx.bid, roomCode).soDu, cauHinh: cfg, fmt: { tien: U.currency } });
          };
          body.querySelector('#rwCopy').onclick = async () => {
            const t = body.querySelector('#rwMsgTxt'); t.select();
            try { await navigator.clipboard.writeText(t.value); UI.toast('Đã sao chép tin nhắn', { type: 'ok' }); }
            catch (e) { document.execCommand && document.execCommand('copy'); UI.toast('Đã chọn sẵn tin nhắn, bấm Ctrl+C để sao chép', { type: 'ok' }); }
          };
        };
        draw();
      },
    });
  }

  /* ---------- Cài đặt (chủ trọ) ---------- */
  async function settingsDialog(ctx) {
    if (!S.isOwner()) return;
    const cu = S.rewardConfig(ctx.bid);
    const luu = HH.backend && HH.backend.hasColumn ? await HH.backend.hasColumn('buildings', 'reward_config') : true;
    const val = (k, d) => (cu.bat || cu.tuNgay ? cu[k] : d);
    UI.modal({
      title: 'Điểm thưởng đóng tiền đúng hạn', size: 'wide',
      bodyHtml: h`
        <p class="muted" style="margin-bottom:12px">Khách đóng đủ đúng hạn thì được điểm; đóng đúng hạn nhiều tháng liền được thưởng thêm; điểm đổi thành tiền giảm vào hóa đơn. Điểm tính lại từ hóa đơn và phiếu thu nên không bao giờ lệch. Mặc định tắt.</p>
        ${raw(luu ? '' : `<div class="alert alert-warning" style="margin-bottom:12px"><span class="ic">${HH.ic('alert', 16)}</span><div>Máy chủ chưa chạy <code>migration-rewards.sql</code> nên cài đặt này chỉ lưu tạm trong máy, tải lại trang là mất.</div></div>`)}
        <label class="check" style="margin-bottom:12px"><input type="checkbox" id="rwOn" ${cu.bat ? 'checked' : ''}><span><b>Bật điểm thưởng cho tòa nhà này</b></span></label>
        <div class="grid-2">
          <div class="field"><label>Tính điểm từ hóa đơn có hạn từ ngày</label><input class="input" type="date" id="rwFrom" value="${cu.tuNgay || U.dateKey()}"></div>
          <div class="field"><label>Điểm mỗi hóa đơn đóng đủ đúng hạn</label><input class="input mono" id="rwPer" inputmode="numeric" value="${val('diemMoiHoaDon', 10)}"></div>
          <div class="field"><label>Đóng đúng hạn bao nhiêu tháng liền thì thưởng thêm</label><input class="input mono" id="rwChain" inputmode="numeric" value="${val('chuoi', 3)}"></div>
          <div class="field"><label>Số điểm thưởng thêm (0 = không thưởng chuỗi)</label><input class="input mono" id="rwBonus" inputmode="numeric" value="${val('thuongChuoi', 20)}"></div>
          <div class="field"><label>Mỗi điểm đổi được (₫)</label><input class="input mono" id="rwRate" inputmode="numeric" value="${val('tiLeDoi', 1000)}"></div>
          <div class="field"><label>Đổi theo bậc (điểm)</label><input class="input mono" id="rwStep" inputmode="numeric" value="${val('buocDoi', 100)}"></div>
          <div class="field"><label>Mỗi hóa đơn đổi tối đa (% số còn phải thu)</label><input class="input mono" id="rwCap" inputmode="numeric" value="${Math.round(val('tran', 0.5) * 100)}"></div>
        </div>
        <p class="hint" id="rwEx" style="margin-top:6px"></p><p class="field-error" id="rwCfgErr" style="color:var(--danger);margin-top:6px"></p>`,
      footHtml: '<button class="btn btn-outline" data-close>Hủy</button><span class="spacer"></span><button class="btn btn-primary" id="rwSave">Lưu</button>',
      onMount(el, close) {
        const g = (id) => el.querySelector('#' + id);
        const doc = () => ({ bat: g('rwOn').checked, tuNgay: g('rwFrom').value || null, diemMoiHoaDon: U.parseNum(g('rwPer').value), chuoi: U.parseNum(g('rwChain').value),
          thuongChuoi: U.parseNum(g('rwBonus').value), tiLeDoi: U.parseNum(g('rwRate').value), buocDoi: U.parseNum(g('rwStep').value),
          tran: (U.parseNum(g('rwCap').value) || 0) / 100 });
        const ve = () => {
          const c = doc(), loi = R.kiemCauHinh(c); g('rwCfgErr').textContent = loi;
          g('rwEx').textContent = loi ? '' : `Ví dụ: đóng đúng hạn ${c.chuoi} tháng liền được ${so(c.diemMoiHoaDon * c.chuoi + c.thuongChuoi)} điểm; ${so(c.buocDoi)} điểm đổi được giảm ${U.currency(c.buocDoi * c.tiLeDoi)}.`;
          return !loi;
        };
        el.querySelectorAll('input').forEach(i => { i.oninput = ve; i.onchange = ve; }); ve();
        g('rwSave').onclick = () => {
          if (!ve()) return;
          const r = S.setRewardConfig(ctx.bid, doc());
          if (!r.ok) { g('rwCfgErr').textContent = r.loi; return; }
          close(); UI.toast(r.cauHinh.bat ? 'Đã lưu, điểm thưởng đang bật' : 'Đã tắt điểm thưởng', { type: 'ok' }); HH.router.render();
        };
      },
    });
  }

  return { badge, roomDialog, settingsDialog };
})();

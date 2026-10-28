/* ============================================================
   Trang: Ghi chỉ số điện khi không có mạng (mở từ ảnh chụp lần mở app trước, xem js/offline.js)
   Làm cho điện thoại: đứng ở tầng hầm, một tay cầm máy, một ô một phòng. Số ghi xong lưu ngay vào máy,
   có mạng thì bấm một nút để gửi (hoặc lần mở app sau tự gửi).
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, esc = U.esc;
  let bid = null;

  const period = () => S.period();
  const phong = () => S.roomsOf(bid).filter(r => r.status === 'occupied' || r.status === 'notice').sort((a, b) => a.code.localeCompare(b.code));

  // Dòng kết quả dưới ô nhập: đã lưu / cao bất thường / tiêu thụ
  function ketQua(code) {
    const rd = S.reading(bid, code, period());
    if (!rd || rd.elecCurr == null) return { t: '', c: '' };
    const dung = S.consumptionOf(rd, 'elec');
    const tb = rd.elecAvg || 190;
    if (dung != null && dung > tb * 3) return { t: `Đã lưu · dùng ${U.number(dung)} kWh, cao gấp ${(dung / tb).toFixed(1)} lần mức thường, kiểm tra lại số`, c: 'amber' };
    return { t: `Đã lưu trong máy · dùng ${U.number(dung || 0)} kWh`, c: 'ok' };
  }
  function veKetQua(code, loi) {
    const el = document.querySelector(`[data-res="${CSS.escape(code)}"]`); if (!el) return;
    const k = loi ? { t: loi, c: 'bad' } : ketQua(code);
    el.textContent = k.t; el.className = 'off-res ' + k.c;
    const row = el.closest('.off-row'); if (row) row.classList.toggle('bad', !!loi);
  }

  function dong(r, idx) {
    const rd = S.reading(bid, r.code, period()) || {};
    const prev = S.elecPrevOf(bid, r.code, period());
    const k = ketQua(r.code);
    return `<div class="off-row" data-code="${esc(r.code)}">
      <div class="off-room"><b>${esc(r.code)}</b><small>${esc(r.tenantName || 'Trống')}</small></div>
      <div class="off-prev"><small>Kỳ trước</small><span class="mono">${U.number(prev)}</span></div>
      <input class="input mono off-input" inputmode="numeric" autocomplete="off" enterkeyhint="next" data-idx="${idx}" data-code="${esc(r.code)}"
        aria-label="Chỉ số điện mới của phòng ${esc(r.code)}" placeholder="Chỉ số mới" value="${rd.elecCurr != null ? rd.elecCurr : ''}">
      <div class="off-res ${k.c}" data-res="${esc(r.code)}">${esc(k.t)}</div>
    </div>`;
  }
  const danhSach = () => { const rs = phong(); return rs.length ? rs.map(dong).join('') : '<p class="muted" style="padding:16px">Tòa này chưa có phòng đang có khách.</p>'; };

  // Số liệu cuối trang + chip trạng thái + nút gửi. Gọi lại khi mạng đổi.
  function capNhatTrangThai() {
    const chip = document.getElementById('offChip'), nut = document.getElementById('offSync'), tk = document.getElementById('offStat');
    const co = navigator.onLine !== false;
    if (chip) { chip.className = 'badge ' + (co ? 's-info' : 's-warning'); chip.textContent = co ? 'Có mạng' : 'Ngoại tuyến'; }
    const rs = phong(), da = rs.filter(r => { const rd = S.reading(bid, r.code, period()); return rd && rd.elecCurr != null; }).length;
    const cho = S.unsentReadings().cho;
    if (tk) tk.textContent = `Đã ghi ${da}/${rs.length} phòng · ${cho} chỉ số chờ gửi`;
    if (nut) {
      nut.disabled = !co;
      nut.textContent = co ? 'Gửi chỉ số lên máy chủ' : 'Chưa có mạng, chỉ số được giữ trong máy';
      nut.className = 'btn ' + (co ? 'btn-primary' : 'btn-outline') + ' off-sync';
    }
  }

  // Ghi một ô khi người dùng nhập xong (rời ô / Enter). Không ghi lúc đang gõ dở để số chưa gõ xong không bị lưu nhầm.
  function chot(inp) {
    const code = inp.dataset.code, tho = inp.value.trim(), rd0 = S.reading(bid, code, period());
    if (tho === '') {
      if (rd0 && rd0.elecCurr != null) { rd0.elecCurr = null; S.persist(); }
      veKetQua(code); capNhatTrangThai(); return;
    }
    if (!/^[\d.,\s]+$/.test(tho)) { veKetQua(code, 'Chỉ nhập chữ số. Chưa ghi số này.'); return; }
    const n = U.parseNum(tho), prev = S.elecPrevOf(bid, code, period());
    if (n == null || n > 99999999) { veKetQua(code, 'Số này không hợp lý. Chưa ghi.'); return; }
    if (n < prev) {
      veKetQua(code, `Nhỏ hơn kỳ trước (${U.number(prev)}). Chưa ghi. Nếu đồng hồ quay vòng hoặc vừa thay đồng hồ, hãy ghi khi có mạng.`);
      return;
    }
    const rd = S.readingFor(bid, code, period());
    rd.elecCurr = n; S.persist();
    inp.value = String(n);
    veKetQua(code); capNhatTrangThai();
  }

  HH.pages.offlineReadings = {
    capNhatTrangThai,
    render() {
      if (!bid || !S.building(bid)) bid = S.buildings[0] ? S.buildings[0].id : null;
      const anh = HH.offline.docAnh(), tuoi = HH.offline.tuoiAnh(anh);
      const khiNao = tuoi == null ? 'lần mở app gần nhất' : tuoi === 0 ? 'lần mở app hôm nay' : `lần mở app cách đây ${tuoi} ngày`;
      const cu = tuoi != null && tuoi > 14 ? ' Dữ liệu đã khá cũ, phòng mới thêm gần đây có thể chưa có trong danh sách.' : '';
      const chonToa = S.buildings.length > 1
        ? `<select class="select" id="offBld" aria-label="Chọn tòa nhà">${S.buildings.map(b => `<option value="${esc(b.id)}" ${b.id === bid ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`
        : `<b>${esc((S.building(bid) || {}).name || '')}</b>`;
      return `<div class="off-page">
        <header class="off-top">
          <img src="assets/logo-mark.svg" width="30" height="26" alt="">
          <div class="off-brand"><b>Happy Home</b><small>Ghi chỉ số điện</small></div>
          <span class="badge" id="offChip"></span>
        </header>
        <div class="alert alert-warning off-note"><div>Bạn đang mở app khi chưa vào được máy chủ. Số bạn ghi ở đây được <b>lưu trong điện thoại này</b> và gửi lên khi có mạng.
          Danh sách phòng lấy từ ${khiNao}.${cu}</div></div>
        <div class="off-bar">${chonToa}<span class="muted">Kỳ ${esc(S.periodLabel(period()))}</span></div>
        <div class="off-list" id="offList">${danhSach()}</div>
        <div class="off-foot">
          <div class="off-stat" id="offStat"></div>
          <button class="btn btn-outline off-sync" id="offSync" disabled></button>
        </div>
      </div>`;
    },
    mount() {
      const sel = document.getElementById('offBld');
      if (sel) sel.onchange = () => { bid = sel.value; document.getElementById('offList').innerHTML = danhSach(); noiO(); capNhatTrangThai(); };
      document.getElementById('offSync').onclick = guiLen;
      noiO(); capNhatTrangThai();
    },
  };

  // Thử nối máy chủ thật (điện thoại báo "có mạng" chưa chắc đã vào được); nối được thì tải lại: vào bình thường, hàng đợi tự gửi
  async function guiLen() {
    const nut = document.getElementById('offSync'); if (!nut || nut.disabled) return;
    nut.disabled = true; nut.textContent = 'Đang kết nối máy chủ...';
    let ok = false;
    try { const r = await HH.backend.loadKind('buildings'); ok = !r.error; } catch (e) { ok = false; }
    if (ok) { location.reload(); return; }
    HH.ui.toast('Chưa kết nối được máy chủ. Chỉ số vẫn được giữ trong máy, thử lại sau nhé.', { type: 'error', sticky: true });
    capNhatTrangThai();
  }

  function noiO() {
    const o = Array.from(document.querySelectorAll('.off-input'));
    o.forEach((inp, i) => {
      inp.onchange = () => chot(inp);
      inp.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault(); inp.blur();
        const next = o[i + 1]; if (next) { next.focus(); next.select(); }
      };
    });
  }
})();

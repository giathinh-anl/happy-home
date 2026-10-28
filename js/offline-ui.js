/* ============================================================
   Happy Home — Phần giao diện của việc ghi chỉ số khi mất mạng (phần tính toán ở js/offline.js)
   - đăng ký service worker (sw.js) để mở được app khi không có mạng và cài được như một ứng dụng
   - thanh trạng thái nhỏ: mất mạng / chỉ số chưa gửi được / chỉ số cần chủ trọ xem
   - hộp thoại xử lý chỉ số xung đột (máy chủ đã có số khác lúc mình ghi)
   - mở trang ghi chỉ số ngoại tuyến từ ảnh chụp khi không vào được máy chủ
   ============================================================ */
HH.offlineUI = (function () {
  const U = HH.util, S = HH.store, h = U.html, raw = U.raw;
  let guiLoi = false;                  // lần đẩy gần nhất lên máy chủ bị lỗi

  /* ---------- Service worker ---------- */
  function dangKy() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    // đợi trang tải xong rồi mới đăng ký, đừng tranh băng thông với lúc mở app
    const chay = () => navigator.serviceWorker.register('sw.js').catch((e) => console.info('Không bật được chế độ ngoại tuyến:', e && e.message));
    if (document.readyState === 'complete') chay(); else window.addEventListener('load', chay);
  }

  /* ---------- Thanh trạng thái ---------- */
  function mat() { return typeof navigator !== 'undefined' && navigator.onLine === false; }
  function capNhat() {
    const chip = document.getElementById('offChip');                 // trang ngoại tuyến có thanh riêng
    if (chip && HH.pages.offlineReadings && HH.pages.offlineReadings.capNhatTrangThai) HH.pages.offlineReadings.capNhatTrangThai();
    let el = document.getElementById('hhNet');
    const p = S.usingBackend() ? S.unsentReadings() : { cho: 0, xungDot: 0 };
    const hien = S.prefs.auth && !HH.offline.mode && (mat() || guiLoi || p.xungDot > 0);
    if (!hien) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'hhNet'; el.className = 'net-pill'; el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    let msg, nut = '', cls = 'warn';
    if (p.xungDot > 0) { msg = `${p.xungDot} chỉ số cần bạn xem lại`; nut = '<button class="btn btn-sm btn-primary" data-net="xem">Xem</button>'; }
    else if (mat()) { msg = 'Đang mất mạng' + (p.cho ? `, ${p.cho} chỉ số chưa gửi` : ''); cls = 'off'; }
    else { msg = p.cho ? `${p.cho} chỉ số chưa gửi được lên máy chủ` : 'Chưa lưu được lên máy chủ'; nut = '<button class="btn btn-sm btn-outline" data-net="lai">Thử lại</button>'; }
    el.className = 'net-pill ' + cls;
    el.innerHTML = `<span class="net-dot" aria-hidden="true"></span><span class="net-t">${U.esc(msg)}</span>${nut}`;
    const xem = el.querySelector('[data-net=xem]'); if (xem) xem.onclick = () => hoiXungDot();
    const lai = el.querySelector('[data-net=lai]');
    if (lai) lai.onclick = async () => {
      lai.disabled = true; lai.textContent = 'Đang gửi...';
      const r = await S.flush();
      if (r.ok) HH.ui.toast('Đã gửi lên máy chủ', { type: 'ok' });
      else { HH.ui.toast('Vẫn chưa gửi được, sẽ tự thử lại', { type: 'error' }); capNhat(); }
    };
  }
  function baoGui(ok) { guiLoi = !ok; capNhat(); }

  /* ---------- Sau khi đối chiếu hàng đợi với máy chủ (store.ganHangDoi) ---------- */
  function sauKhiGan(g) {
    setTimeout(async () => {
      if (g.apDung) {
        const r = await S.flush();
        HH.ui.toast(r.ok ? `Đã gửi ${g.apDung} chỉ số bạn ghi lúc chưa có mạng` : `${g.apDung} chỉ số ghi lúc chưa có mạng đang chờ gửi`,
          { type: r.ok ? 'ok' : undefined, sticky: true });
      }
      if (g.boQua) HH.ui.toast(`${g.boQua} chỉ số thuộc phòng không còn nữa nên đã bỏ`, { sticky: true });
      if (g.canXem) hoiXungDot();
      capNhat();
    }, 900);
  }

  /* ---------- Chỉ số cần chủ trọ quyết ---------- */
  const so = (v) => v == null ? 'chưa có' : U.number(v);
  const gio = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); };
  const tenToa = (bid) => { const b = S.building(bid); return b && S.buildings.length > 1 ? ` (${b.name})` : ''; };
  let dangMo = false;
  function hoiXungDot() {
    const ds = S.unresolvedReadings();
    if (!ds.length || dangMo) return;
    dangMo = true;
    const dong = ds.map((x, i) => {
      const it = x.item, sv = x.server;
      const lyDo = x.lyDo === 'nho-hon'
        ? `Bạn ghi <b>${so(it.elecCurr)}</b>, nhỏ hơn chỉ số kỳ trước (<b>${so(it.elecPrev)}</b>) nên chưa tự ghi.`
        : `Lúc ${gio(it.at)} bạn ghi <b>${so(it.elecCurr)}</b>. Từ đó máy chủ đã có số khác: <b>${so(sv && sv.elecCurr)}</b>${sv && sv.source === 'tenant' ? ' (khách tự gửi)' : ''}.`;
      return `<div class="off-cf" data-khoa="${U.esc(it.khoa)}">
        <div class="off-cf-h"><b>Phòng ${U.esc(it.roomCode)}</b>${U.esc(tenToa(it.buildingId))} · Kỳ ${U.esc(S.periodLabel(it.period))}</div>
        <p class="off-cf-d">${lyDo}</p>
        <label class="check"><input type="radio" name="cf${i}" value="giu" checked><span>Giữ số trên máy chủ (${so(sv && sv.elecCurr)})</span></label>
        <label class="check"><input type="radio" name="cf${i}" value="toi"><span>Dùng số của tôi (${so(it.elecCurr)})</span></label>
      </div>`;
    }).join('');
    HH.ui.modal({
      title: 'Chỉ số cần bạn xem lại',
      bodyHtml: `<p class="muted" style="margin-bottom:12px">Các chỉ số này bạn ghi lúc chưa gửi được lên máy chủ. Chưa chọn thì máy chủ giữ nguyên, không có gì bị ghi đè.</p>${dong}`,
      footHtml: '<button class="btn btn-outline" data-close>Để sau</button><span class="spacer"></span><button class="btn btn-primary" id="cfOk">Áp dụng lựa chọn</button>',
      onClose() { dangMo = false; capNhat(); },
      onMount(el, close) {
        el.querySelector('#cfOk').onclick = async () => {
          let toi = 0;
          el.querySelectorAll('.off-cf').forEach((box, i) => {
            const dung = box.querySelector(`input[name=cf${i}]:checked`).value === 'toi';
            if (S.resolveReading(box.dataset.khoa, dung) && dung) toi++;
          });
          close();
          if (toi) { const r = await S.flush(); HH.ui.toast(r.ok ? `Đã ghi ${toi} chỉ số theo số của bạn` : 'Đã chọn xong, đang chờ gửi lên máy chủ', { type: r.ok ? 'ok' : undefined }); }
          else HH.ui.toast('Đã giữ nguyên số trên máy chủ', { type: 'ok' });
          HH.router.render();
        };
      },
    });
  }

  /* ---------- Mở ngoại tuyến ---------- */
  // Gọi khi không vào được máy chủ: có ảnh chụp lần mở trước và tài khoản được ghi chỉ số thì mở trang ghi chỉ số ngoại tuyến.
  function thuMoNgoaiTuyen() {
    if (!S.usingBackend()) return false;
    const anh = HH.offline.docAnh(); if (!anh) return false;
    if (anh.role !== 'owner' && (anh.permissions || []).indexOf('readings') < 0) return false;
    S.enterOffline(anh);
    return true;
  }

  window.addEventListener('online', () => { capNhat(); if (!HH.offline.mode && S.usingBackend() && S.prefs.auth) S.flush().then(capNhat); });
  window.addEventListener('offline', capNhat);

  return { dangKy, capNhat, baoGui, sauKhiGan, hoiXungDot, thuMoNgoaiTuyen };
})();

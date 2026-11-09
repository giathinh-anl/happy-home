/* ============================================================
   Trang Trợ giúp + lớp phủ hướng dẫn làm quen từng bước

   Nội dung bài và luật chọn bước nằm ở js/help.js (thuần, có kiểm thử). Ở đây chỉ vẽ.
   Mọi chữ lấy từ dữ liệu đều đi qua U.esc hoặc textContent, không chèn HTML thô.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, H = HH.help, h = U.html, raw = U.raw;
  const esc = U.esc;

  const nguoiDung = () => ({ isOwner: S.isOwner(), can: (p) => S.can(p) });

  /* ============================ TRANG TRỢ GIÚP ============================ */
  function bidHienTai(ctx) { return (ctx && ctx.bid) || (S.buildings[0] || {}).id || null; }

  function baiHtml(b, bid, mo) {
    const link = H.duongDan(b.lienKet, bid);
    return `<details class="hp-bai"${mo ? ' open' : ''}><summary><span>${esc(b.tieuDe)}</span></summary>
      <ol class="hp-steps">${b.buoc.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      ${link ? `<a class="btn btn-outline btn-sm" href="${esc(link)}">${esc(b.lienKet.nhan)}</a>` : ''}</details>`;
  }
  function danhSachHtml(q, bid) {
    const kq = H.tim(q, nguoiDung());
    if (String(q || '').trim()) {
      if (!kq.length) return `<div class="card card-pad hp-trong"><b>Không có bài nào khớp "${esc(String(q).trim())}".</b>
        <p class="muted">Thử từ ngắn hơn (ví dụ "hóa đơn", "mã vào app"), hoặc hỏi Trợ lý ảo ở nút góc dưới bên phải.</p></div>`;
      return `<p class="muted hp-dem" role="status">${kq.length} bài khớp</p><div class="card hp-nhom">${kq.map((b, i) => baiHtml(b, bid, i === 0)).join('')}</div>`;
    }
    return H.NHOM.map((g) => {
      const bs = kq.filter((b) => b.nhom === g.ma);
      return bs.length ? `<h2 class="hp-h">${esc(g.ten)}</h2><div class="card hp-nhom">${bs.map((b) => baiHtml(b, bid, false)).join('')}</div>` : '';
    }).join('');
  }

  HH.pages.help = {
    render(ctx) {
      const bid = bidHienTai(ctx);
      return h`<div class="page-head">
        <div><div><div class="page-title-lg">Trợ giúp</div><div class="page-sub">Cách làm từng việc trong Happy Home. Gõ từ khóa để tìm nhanh.</div></div></div>
        <div class="page-actions"><button class="btn btn-primary" id="hpTour">${HH.ic('help', 16)} Xem hướng dẫn nhanh</button></div>
      </div>
      <div class="hp-search"><input class="input" id="hpQ" type="search" autocomplete="off" placeholder="Tìm: hóa đơn, mã vào app, nhắc nợ, đổi mật khẩu…" aria-label="Tìm trong trợ giúp"></div>
      <div id="hpList" aria-live="polite">${raw(danhSachHtml('', bid))}</div>
      <div class="card card-pad hp-cuoi"><b>Vẫn chưa thấy?</b> Hỏi <b>Trợ lý ảo</b> (nút ở góc dưới bên phải): trợ lý trả lời về số liệu của bạn như công nợ, phòng trống, hóa đơn. Còn lỗi hay góp ý thì báo người quản trị hệ thống của bạn.</div>`;
    },
    mount(ctx) {
      const bid = bidHienTai(ctx), q = document.getElementById('hpQ'), box = document.getElementById('hpList');
      q.oninput = () => { box.innerHTML = danhSachHtml(q.value, bid); };
      document.getElementById('hpTour').onclick = () => HH.tourUI.start();
    },
  };

  /* ============================ HƯỚNG DẪN TỪNG BƯỚC ============================ */
  HH.tourUI = (function () {
    let ov = null, st = null;                   // lớp phủ đang mở và trạng thái của nó

    const hien = (el) => !!(el && el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== 'hidden');
    // Cùng một bước có thể ứng với nút khác nhau trên máy tính và điện thoại: lấy phần tử đầu tiên đang hiện
    function timMucTieu(step) {
      for (const sel of step.mucTieu) {
        let ds = []; try { ds = Array.from(document.querySelectorAll(sel)); } catch (e) { /* bộ chọn hỏng thì bỏ qua */ }
        const el = ds.find(hien); if (el) return el;
      }
      return null;
    }

    function dongBo() {
      if (!ov) return;
      const step = st.buoc[st.i], el = timMucTieu(step);
      const the = ov.querySelector('.tour-card'), lo = ov.querySelector('.tour-hole');
      ov.querySelector('#tourSo').textContent = `Bước ${st.i + 1}/${st.buoc.length}`;
      ov.querySelector('#tourT').textContent = step.tieuDe;
      ov.querySelector('#tourD').textContent = step.noiDung;
      ov.querySelector('#tourBack').disabled = st.i === 0;
      ov.querySelector('#tourNext').textContent = st.i === st.buoc.length - 1 ? 'Xong' : 'Tiếp';
      const kn = { w: window.innerWidth, h: window.innerHeight };
      let rect = null;
      if (el) {
        const r = el.getBoundingClientRect(), P = 6;
        rect = { x: r.left - P, y: r.top - P, w: r.width + 2 * P, h: r.height + 2 * P };
        lo.style.cssText = `display:block;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`;
        ov.classList.remove('tour-nohole');
      } else { lo.style.display = 'none'; ov.classList.add('tour-nohole'); }
      the.style.width = Math.min(340, kn.w - 24) + 'px';
      const d = H.datThe(rect, { w: the.offsetWidth, h: the.offsetHeight }, kn);
      the.style.left = d.x + 'px'; the.style.top = d.y + 'px';
    }
    const veLai = () => { if (ov) { cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(dongBo); } };

    function toi(i) {
      st.i = i;
      const el = timMucTieu(st.buoc[i]);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      dongBo();
      ov.querySelector('#tourNext').focus();
    }
    function buocKe(huong) {
      const r = H.dich(st.i, huong, st.buoc.length);
      if (r.xong) { dong(); return; }
      toi(r.i);
    }
    function onKey(e) {
      if (!ov) return;
      if (e.key === 'Escape') { e.preventDefault(); dong(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); buocKe(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); buocKe(-1); }
      else if (e.key === 'Tab') {                                 // giữ phím Tab trong thẻ hướng dẫn
        const ds = Array.from(ov.querySelectorAll('button:not([disabled])'));
        if (!ds.length) return;
        const i = ds.indexOf(document.activeElement);
        e.preventDefault(); ds[(i + (e.shiftKey ? ds.length - 1 : 1)) % ds.length].focus();
      }
    }
    function dong() {
      if (!ov) return;
      cancelAnimationFrame(st.raf);
      window.removeEventListener('resize', veLai); window.removeEventListener('scroll', veLai, true);
      window.removeEventListener('hashchange', dong); document.removeEventListener('keydown', onKey, true);
      ov.remove(); ov = null;
      S.setPref('tourDaXem', 1);
      const t = st.truoc; st = null; if (t && t.focus && document.contains(t)) t.focus();
    }

    let cho = false;                                               // đang chờ trang tòa nhà dựng xong, đừng bắt đầu hai lần
    /* Các bước chỉ vào thanh mục của tòa nhà (Phòng, Khách thuê, Hóa đơn...), mà thanh đó chỉ có ở trang cấp tòa nhà. Đang ở trang
       cấp công ty (Tổng quan, Trợ giúp...) thì chuyển sang một trang của tòa đầu tiên trước, rồi mới chạy. */
    function start() {
      if (ov || cho) return;
      if (!document.getElementById('lzApp')) return;               // chỉ chạy khi đang ở trong khung điều hướng
      const goi = document.getElementById('tourGoiY'); if (goi) goi.remove();
      const b = S.buildings[0], duong = location.hash.replace(/^#/, '');
      const seg = S.can('rooms') ? 'units' : S.can('tenants') ? 'tenants' : S.can('invoices') ? 'invoices' : null;
      if (b && seg && duong.indexOf('/b/') !== 0) {
        cho = true; location.hash = '#/b/' + b.id + '/' + seg;
        setTimeout(() => { cho = false; chay(); }, 800);
        return;
      }
      chay();
    }
    function chay() {
      if (ov || !document.getElementById('lzApp')) return;
      st = { buoc: H.lapTour({ can: (p) => S.can(p) }), i: 0, raf: 0, truoc: document.activeElement };
      ov = document.createElement('div');
      ov.className = 'tour'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'tourT'); ov.setAttribute('aria-describedby', 'tourD');
      ov.innerHTML = `<div class="tour-hole" aria-hidden="true"></div>
        <div class="tour-card"><div class="tour-so" id="tourSo"></div><h3 id="tourT"></h3><p id="tourD"></p>
          <div class="tour-acts"><button type="button" class="btn btn-ghost btn-sm" id="tourSkip">Bỏ qua</button><span class="spacer"></span>
            <button type="button" class="btn btn-outline btn-sm" id="tourBack">Quay lại</button><button type="button" class="btn btn-primary btn-sm" id="tourNext">Tiếp</button></div></div>`;
      document.body.appendChild(ov);
      ov.querySelector('#tourSkip').onclick = dong;
      ov.querySelector('#tourBack').onclick = () => buocKe(-1);
      ov.querySelector('#tourNext').onclick = () => buocKe(1);
      window.addEventListener('resize', veLai); window.addEventListener('scroll', veLai, true);
      window.addEventListener('hashchange', dong); document.addEventListener('keydown', onKey, true);
      toi(0);
    }

    /* Gợi ý nhẹ lần đầu dùng: một thẻ nhỏ ở góc, không chặn thao tác. "Để sau" thì không hỏi lại (vẫn xem được trong Trợ giúp). */
    function goiY() {
      if (!S.prefs.auth || S.prefs.tourDaXem || ov || document.getElementById('tourGoiY') || !document.getElementById('lzApp')) return;
      const el = document.createElement('div');
      el.id = 'tourGoiY'; el.className = 'tour-goi'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Gợi ý hướng dẫn');
      el.innerHTML = `<b>Lần đầu dùng Happy Home?</b><p>Xem hướng dẫn nhanh khoảng một phút.</p>
        <div class="tour-acts"><button type="button" class="btn btn-ghost btn-sm" id="tourLater">Để sau</button><span class="spacer"></span><button type="button" class="btn btn-primary btn-sm" id="tourGo">Xem ngay</button></div>`;
      document.body.appendChild(el);
      el.querySelector('#tourGo').onclick = () => start();
      el.querySelector('#tourLater').onclick = () => { S.setPref('tourDaXem', 'de-sau'); el.remove(); };
    }

    return { start, goiY, dong };
  })();
})();

/* ============================================================
   Đọc chỉ số điện bằng giọng nói (trang Chỉ số điện → nút "Đọc chỉ số")

   Chủ trọ đi dọc hành lang vừa nhìn đồng hồ vừa đọc "phòng 101 điện 1250, phòng 102 điện 980". Trình duyệt đổi giọng thành chữ,
   js/voice.js hiểu chữ thành (phòng, chỉ số). KHÔNG có gì được lưu trước khi chủ trọ xem lại danh sách và bấm Ghi: giọng nói dễ nghe
   nhầm, mà sai một chữ số là sai tiền điện của khách. Số nào nhỏ hơn kỳ trước thì không cho ghi, cao bất thường hoặc ghi đè số đang có
   thì mặc định không tick.
   Không có micro / trình duyệt không hỗ trợ: gõ hoặc dán câu vào ô, kết quả như nhau.
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, V = HH.voice, h = U.html, raw = U.raw;

  function docChiSo(ctx) {
    const period = S.period();
    const rooms = S.roomsOf(ctx.bid).filter(r => r.status === 'occupied' || r.status === 'notice').sort((a, b) => a.code.localeCompare(b.code));
    const byCode = {}; rooms.forEach(r => { byCode[r.code] = r; });
    const nghe = V.hoTro();
    let hNghe = null, goc = '', rows = [];

    UI.modal({
      title: 'Đọc chỉ số bằng giọng nói', size: 'wide', onClose: () => { if (hNghe) hNghe.dung(); },
      bodyHtml: h`
        <p class="muted" style="margin-bottom:10px">Bấm <b>Bắt đầu nói</b> rồi đọc từng phòng, ví dụ <i>“phòng 101 điện 1250, phòng 102 điện 980”</i>.
          Bạn xem lại danh sách bên dưới, sửa nếu nghe nhầm, rồi mới bấm <b>Ghi</b>. Chưa bấm Ghi thì chưa lưu gì.</p>
        ${raw(nghe ? '' : `<div class="alert alert-warning" style="margin-bottom:10px"><span class="ic">${HH.ic('alert', 16)}</span>
          <div>Trình duyệt này không nghe được giọng nói (dùng Chrome, Edge hoặc Safari thì được). Bạn vẫn gõ hoặc dán câu vào ô bên dưới, hệ thống hiểu như nhau.</div></div>`)}
        <div class="vz-mic">
          ${raw(nghe ? `<button class="btn btn-primary" id="vzMic">${HH.icon('mic', 16)} <span id="vzMicTxt">Bắt đầu nói</span></button>` : '')}
          <span class="muted text-sm" id="vzTT"></span>
        </div>
        <div class="ip-err" id="vzErr" role="alert" hidden style="margin:8px 0"></div>
        <div class="field" style="margin-top:10px"><label>Chữ nghe được <span class="muted">(sửa được)</span></label>
          <textarea class="textarea" id="vzText" rows="2" placeholder="Chữ nghe được hiện ở đây. Bạn cũng gõ hoặc dán vào đây được."></textarea></div>
        <div id="vzKq" style="margin-top:6px"></div>
        <p class="muted text-xs" style="margin-top:10px">${nghe ? 'Trình duyệt gửi âm thanh tới dịch vụ nhận dạng giọng nói của hãng trình duyệt (Google với Chrome, Apple với Safari) để đổi thành chữ. Happy Home không ghi âm hay lưu âm thanh.' : ''}</p>`,
      footHtml: `<button class="btn btn-outline" data-close>Đóng</button><span class="spacer"></span><button class="btn btn-primary" id="vzGhi" disabled>Ghi vào 0 phòng</button>`,
      onMount(el, close) {
        const $ = (s) => el.querySelector(s);
        const ta = $('#vzText'), kq = $('#vzKq'), ghi = $('#vzGhi');

        const dongHtml = (r, i) => {
          const loi = r.loi;
          if (loi === 'khong-co-phong') return `<tr class="vz-bad"><td></td><td colspan="4"><b>Phòng ${U.esc(r.soPhong)}</b>: không có trong tòa này hoặc đang trống${r.chiSo != null ? ` (chỉ số nghe được: ${U.number(r.chiSo)})` : ''}</td><td></td></tr>`;
          if (loi === 'trung-phong') return `<tr class="vz-bad"><td></td><td colspan="4"><b>Phòng ${U.esc(r.soPhong)}</b>: có nhiều phòng cùng số, hãy nói rõ hơn</td><td></td></tr>`;
          if (loi === 'thieu-chi-so') return `<tr class="vz-bad"><td></td><td><b>${U.esc(r.phong)}</b><div class="muted text-xs">${U.esc(byCode[r.phong].tenantName || '')}</div></td><td colspan="3">Chưa nghe thấy chỉ số của phòng này</td><td></td></tr>`;
          const prev = S.elecPrevOf(ctx.bid, r.phong, period);
          return `<tr data-i="${i}"><td><input type="checkbox" data-ck="${i}" aria-label="Ghi phòng ${U.esc(r.phong)}"></td>
            <td><b>${U.esc(r.phong)}</b><div class="muted text-xs">${U.esc(byCode[r.phong].tenantName || '')}</div></td>
            <td class="num mono">${U.number(prev)} →</td>
            <td><input class="input mono vz-in" data-v="${i}" inputmode="numeric" value="${r.chiSo}" aria-label="Chỉ số phòng ${U.esc(r.phong)}"></td>
            <td class="num mono" data-use="${i}"></td><td class="vz-gc" data-gc="${i}"></td></tr>`;
        };
        // cập nhật trạng thái một dòng (tiêu thụ, ghi chú, được tick hay không) mà không vẽ lại để khỏi mất con trỏ khi đang sửa số
        const veDong = (i) => {
          const r = rows[i], tr = kq.querySelector(`tr[data-i="${i}"]`); if (!tr) return;
          const rd = S.reading(ctx.bid, r.phong, period);
          const d = V.danhGia({ chiSo: r.chiSo, truoc: S.elecPrevOf(ctx.bid, r.phong, period), trungBinh: rd && rd.elecAvg, hienCo: rd && rd.elecCurr != null ? rd.elecCurr : null });
          r.dg = d;
          const ck = tr.querySelector('[data-ck]');
          ck.disabled = d.loai === 'sai';
          if (d.loai === 'sai') ck.checked = false;
          r.tick = ck.checked;
          tr.querySelector('[data-use]').textContent = d.tieuThu == null ? '-' : U.number(d.tieuThu) + ' kWh';
          const gc = tr.querySelector('[data-gc]');
          gc.textContent = d.ghiChu; gc.className = 'vz-gc ' + (d.loai === 'sai' ? 'vz-red' : d.loai === 'canh-bao' ? 'vz-amber' : '');
          tr.classList.toggle('vz-bad', d.loai === 'sai');
        };
        const demGhi = () => {
          const n = rows.filter(r => r.dg && r.tick && r.dg.loai !== 'sai').length;
          ghi.disabled = n === 0; ghi.textContent = `Ghi vào ${n} phòng`;
        };
        // đọc lại toàn bộ câu nói
        const ve = () => {
          const ph = V.phanTichChiSo(ta.value, rooms.map(r => r.code));
          rows = ph.muc.map(m => ({ phong: m.phong, soPhong: m.soPhong, chiSo: m.chiSo, goc: m.goc, loi: m.loi, dg: null, tick: false }));
          if (!ta.value.trim()) { kq.innerHTML = ''; demGhi(); return; }
          if (!rows.length) { kq.innerHTML = `<div class="muted" style="padding:8px 0">Chưa hiểu được phòng nào. Hãy đọc theo mẫu: “phòng 101 điện 1250”.</div>`; demGhi(); return; }
          kq.innerHTML = `<div class="dt-wrap"><div class="dt-scroll" style="max-height:300px;overflow:auto"><table class="dt vz-tb"><thead><tr><th></th><th>Phòng</th><th class="num">Kỳ trước</th><th>Chỉ số mới</th><th class="num">Tiêu thụ</th><th>Ghi chú</th></tr></thead>
            <tbody>${rows.map(dongHtml).join('')}</tbody></table></div></div>
            ${ph.khongHieu.length ? `<p class="muted text-xs" style="margin-top:6px">Chưa hiểu đoạn: ${ph.khongHieu.map(x => '“' + U.esc(x) + '”').join(', ')}</p>` : ''}`;
          rows.forEach((r, i) => {
            if (r.loi) return;
            veDong(i);
            const ck = kq.querySelector(`[data-ck="${i}"]`);
            ck.checked = r.dg.loai === 'ok'; r.tick = ck.checked;       // cảnh báo thì mặc định KHÔNG tick: phải tự quyết
            ck.onchange = () => { r.tick = ck.checked; demGhi(); };
            kq.querySelector(`[data-v="${i}"]`).oninput = (e) => {
              const n = U.parseNum(e.target.value); r.chiSo = n; e.target.value = n == null ? '' : n;
              const truoc = r.tick; veDong(i);
              // sửa xong mà số đã hợp lệ và không có gì đáng ngại thì tick luôn: người dùng sửa là để ghi
              if (!truoc && r.dg.loai === 'ok') { const ck = kq.querySelector(`[data-ck="${i}"]`); ck.checked = true; r.tick = true; }
              demGhi();
            };
          });
          demGhi();
        };

        let tre; ta.addEventListener('input', () => { clearTimeout(tre); tre = setTimeout(ve, 250); });
        const loiBao = (msg) => { const e = $('#vzErr'); e.textContent = msg || ''; e.hidden = !msg; };
        const tt = (t) => { $('#vzTT').textContent = t || ''; };
        const veMic = (dangNghe) => {
          const b = $('#vzMic'); if (!b) return;
          b.classList.toggle('vz-live', dangNghe); $('#vzMicTxt').textContent = dangNghe ? 'Dừng' : (ta.value.trim() ? 'Nói tiếp' : 'Bắt đầu nói');
          tt(dangNghe ? 'Đang nghe... đọc từng phòng, ví dụ “phòng 101 điện 1250”' : '');
        };
        const mic = $('#vzMic');
        if (mic) mic.onclick = () => {
          if (hNghe) { hNghe.dung(); return; }
          loiBao(''); goc = ta.value.trim() ? ta.value.trim() + ' ' : '';
          hNghe = V.nghe({
            onChu: (t) => { ta.value = goc + t; ve(); },
            onKetThuc: () => { hNghe = null; veMic(false); },
            onLoi: (c) => { loiBao(c); },
          });
          veMic(!!hNghe);
        };

        ghi.onclick = () => {
          const ds = rows.filter(r => r.dg && r.tick && r.dg.loai !== 'sai');
          if (!ds.length) return;
          if (hNghe) hNghe.dung();
          ds.forEach(r => { const rd = S.readingFor(ctx.bid, r.phong, period); rd.elecCurr = r.chiSo; rd.approved = true; });
          S.persist();
          S.log('reading.voice', `Ghi ${ds.length} chỉ số điện bằng giọng nói`, ds.map(r => `${r.phong}=${r.chiSo}`).join(', '));
          close(); UI.toast(`Đã ghi chỉ số ${ds.length} phòng`, { type: 'ok' }); HH.router.render();
        };
        ve();
      },
    });
  }

  HH.voiceUI = { docChiSo };
})();

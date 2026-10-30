/* ============================================================
   Phần của chủ trọ: bật / tắt link giới thiệu công khai của một phòng, lấy link, mã QR, tin chia sẻ.
   Luật và chữ hiển thị ở js/listing.js (có kiểm thử); trang người ngoài xem ở phong/.
   Dùng trong hộp thoại phòng (js/pages/rooms.js).
   ============================================================ */
HH.listingUI = (function () {
  const U = HH.util, S = HH.store, UI = HH.ui, L = HH.listing;

  /** Khung rỗng đặt trong hộp thoại phòng; wire() điền nội dung vào #lsBody */
  const html = () => `<div class="field" style="margin-top:16px" id="lsBox"><label>Link giới thiệu công khai <span class="hint" style="font-weight:400">· gửi cho người cần thuê</span></label><div id="lsBody"></div></div>`;

  // Những việc nên làm trước khi gửi link cho người lạ (nói thẳng, không chặn)
  function goiY(ctx, r) {
    const b = S.building(ctx.bid) || {}, g = [];
    if (!(r.price > 0)) g.push('Phòng chưa có giá: người xem sẽ chỉ thấy "Liên hệ để biết giá".');
    if (!(r.photos || []).length) g.push('Chưa có ảnh phòng: tin có ảnh được xem nhiều hơn hẳn.');
    if (!String(r.description || '').trim()) g.push('Chưa có mô tả.');
    if (!L.chuanSdt(b.contactPhone)) g.push('Tòa nhà chưa có số điện thoại liên hệ hợp lệ (Cấu hình tòa nhà), người xem sẽ không gọi được.');
    if (r.status !== 'vacant') g.push(r.status === 'reserved' ? 'Phòng đang đặt cọc: trang sẽ ghi "Đã có người đặt cọc".' : 'Phòng đang có người ở: trang sẽ ghi "Đã có người thuê".');
    return g;
  }

  async function ve(ctx, r, body) {
    const luu = HH.backend && HH.backend.hasColumn ? await HH.backend.hasColumn('rooms', 'public_on') : true;
    const canh = luu ? '' : `<div class="alert alert-warning" style="margin-bottom:10px"><span class="ic">${HH.ic('alert', 16)}</span><div>Máy chủ chưa chạy <code>migration-public-rooms.sql</code> nên link này chưa mở được với người ngoài.</div></div>`;
    if (!r.publicOn) {
      body.innerHTML = `${canh}<p class="muted text-sm" style="margin:0 0 10px">Đang tắt. Bật lên để có đường link và mã QR gửi cho người cần thuê (Zalo, Facebook, dán trước nhà). Trang chỉ hiện số phòng, giá, diện tích, mô tả, ảnh, địa chỉ tòa nhà và số liên hệ. <b>Không hiện tên khách hay công nợ.</b></p>
        <button class="btn btn-outline" id="lsOn">${HH.ic('send', 16)} Bật link công khai</button>`;
      body.querySelector('#lsOn').onclick = () => { S.setRoomPublic(ctx.bid, r.code, true); UI.toast('Đã bật link công khai', { type: 'ok' }); ve(ctx, S.room(ctx.bid, r.code), body); };
      return;
    }
    const link = S.publicLink(ctx.bid, r.code), b = S.building(ctx.bid) || {};
    const y = goiY(ctx, r);
    const qr = HH.onboardingUI.qrSvg(link);
    body.innerHTML = `${canh}
      <div class="row-gap-2" style="margin-bottom:8px"><input class="input mono" id="lsLink" readonly value="${U.esc(link)}" style="flex:1" aria-label="Link công khai của phòng ${U.esc(r.code)}"></div>
      <div class="row-gap-2 wrap">
        <button class="btn btn-primary btn-sm" id="lsCopy">${HH.ic('copy', 16)} Sao chép link</button>
        <a class="btn btn-outline btn-sm" href="${U.esc(link)}" target="_blank" rel="noopener">Mở trang xem thử</a>
        <button class="btn btn-outline btn-sm" id="lsMsg">${HH.ic('chat', 16)} Chép tin chia sẻ</button>
        <button class="btn btn-outline btn-sm" id="lsOff" style="color:var(--danger)">Tắt link</button>
      </div>
      ${qr ? `<div class="row-gap-3" style="margin-top:12px;align-items:center"><div style="width:120px;height:120px;flex:0 0 120px" aria-label="Mã QR của link">${qr}</div>
        <div><button class="btn btn-outline btn-sm" id="lsQr">Tải mã QR</button><div class="muted text-xs" style="margin-top:6px">In ra dán trước nhà: người đi ngang quét là xem được phòng.</div></div></div>` : ''}
      ${y.length ? `<ul class="muted text-sm" style="margin:12px 0 0;padding-left:18px">${y.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="muted text-xs" style="margin:10px 0 0">Ai có link đều xem được; tắt link là hết xem được ngay. Link không có tên khách, công nợ hay hợp đồng.</p>`;
    body.querySelector('#lsCopy').onclick = () => HH.onboardingUI.chep(link, 'link phòng');
    body.querySelector('#lsMsg').onclick = () => HH.onboardingUI.chep(L.tinChiaSe(r, b, link, U.currency), 'tin chia sẻ');
    body.querySelector('#lsLink').onclick = (e) => e.target.select();
    const q = body.querySelector('#lsQr'); if (q) q.onclick = () => HH.onboardingUI.taiQr(link, `phong-${r.code}.png`);
    body.querySelector('#lsOff').onclick = () => { S.setRoomPublic(ctx.bid, r.code, false); UI.toast('Đã tắt link công khai', { type: 'ok' }); ve(ctx, S.room(ctx.bid, r.code), body); };
  }

  function wire(el, ctx, r) { if (S.isOwner()) ve(ctx, r, el.querySelector('#lsBody')); else { const b = el.querySelector('#lsBox'); if (b) b.remove(); } }
  return { html, wire };
})();

/* ============================================================
   Trang công khai giới thiệu phòng trống (không cần đăng nhập)

   Chủ trọ gửi link dạng  .../phong/#<mã>. Trang gọi hàm public_room(mã) (supabase/migration-public-rooms.sql), chỉ nhận về những gì chủ trọ đã nhập
   để đăng tin. Mọi chữ từ máy chủ đều qua textContent (không bao giờ qua innerHTML); ảnh qua HH.listing.anhHopLe (chỉ ảnh nhúng jpeg/png/webp).
   ============================================================ */
(function () {
  const L = HH.listing;
  const root = document.getElementById('pp');
  const cfg = window.HH_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && String(cfg.supabaseUrl).indexOf('YOUR-') === -1 && typeof supabase !== 'undefined');
  const client = enabled ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach((c) => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  const mount = (...nodes) => { root.replaceChildren(...nodes); window.scrollTo(0, 0); };
  const header = () => h('div', { class: 'pp-head' }, [h('img', { src: '../assets/logo-mark.svg', alt: '' }), h('b', { text: 'HAPPY HOME' })]);

  function ketThuc(o) {
    mount(header(), h('div', { class: 'pp-card pp-end' }, [
      h('div', { class: 'pp-ic', 'aria-hidden': 'true', text: '!' }), h('h1', { text: o.title }), ...(o.lines || []).map((t) => h('p', { text: t })), ...(o.extra || [])]));
  }

  const rpcMissing = (err) => { const s = ((err && err.message) || '').toLowerCase(); return s.includes('could not find the function') || (err && (err.code === '42883' || err.code === 'PGRST202')); };

  /* ---------- Ảnh: cuộn ngang, bấm để xem lớn ---------- */
  function phongAnh(anh, tieuDe) {
    if (!anh.length) return h('div', { class: 'pp-gal' }, [h('div', { class: 'pp-noimg', text: 'Chủ nhà chưa đăng ảnh. Hãy gọi để xem phòng.' })]);
    const strip = h('div', { class: 'pp-strip', role: 'list' }, anh.map((src, i) => h('button', { type: 'button', role: 'listitem', 'aria-label': `Xem ảnh ${i + 1} trên ${anh.length}`, onclick: () => phongTo(src, i + 1) },
      [h('img', { src, alt: `${tieuDe}, ảnh ${i + 1}`, loading: i ? 'lazy' : 'eager' })])));
    const dem = h('span', { class: 'pp-count', text: `1/${anh.length}` });
    if (anh.length > 1) strip.addEventListener('scroll', () => { dem.textContent = `${Math.min(anh.length, Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth)) + 1)}/${anh.length}`; }, { passive: true });
    return h('div', { class: 'pp-gal' }, [strip, anh.length > 1 ? dem : null]);
  }
  function phongTo(src, so) {
    const z = h('button', { type: 'button', class: 'pp-zoom', 'aria-label': 'Đóng ảnh', onclick: () => z.remove() }, [h('img', { src, alt: `Ảnh ${so} phóng to` })]);
    document.body.appendChild(z); z.focus();
    const dong = (e) => { if (e.key === 'Escape') { z.remove(); document.removeEventListener('keydown', dong); } };
    document.addEventListener('keydown', dong);
  }

  /* ---------- Chia sẻ: hộp chia sẻ của điện thoại, không có thì chép link ---------- */
  async function chiaSe(tieuDe, noiDung, nut) {
    const url = location.href;
    try { if (navigator.share) { await navigator.share({ title: tieuDe, text: noiDung, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); } catch (e) {
      const t = h('textarea', { 'aria-hidden': 'true' }); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove();
    }
    const cu = nut.textContent; nut.textContent = '✓'; setTimeout(() => { nut.textContent = cu; }, 1600);
  }

  /* ---------- Trang phòng ---------- */
  function hienPhong(d) {
    const p = d.room || {}, b = d.building || {}, lh = d.contact || {};
    const tt = L.trangThai(p.status), tieuDe = L.tieuDe(p, b);
    document.title = tieuDe + ' — Happy Home';
    const anh = L.anhHopLe(p.photos);
    const facts = L.dongThongTin(p).map((f) => h('div', { class: 'pp-fact' }, [h('b', { text: f.gia }), h('span', { text: f.nhan })]));
    const giaTxt = L.giaChu(p.price), coGia = giaTxt.indexOf('/tháng') > 0;
    const tienNghi = (Array.isArray(p.amenities) ? p.amenities : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 12).map((x) => x.trim().slice(0, 40));
    const mota = String(p.description || '').trim().slice(0, 1500).split(/\n+/).filter(Boolean);
    const ban = L.linkBanDo(b.address), goi = L.linkGoi(lh.phone), zalo = L.linkZalo(lh.phone);

    const khung = [header(), phongAnh(anh, tieuDe)];
    if (!tt.conTrong) khung.push(h('div', { class: 'pp-notice', role: 'status', text: tt.ma === 'da-coc'
      ? 'Phòng này đã có người đặt cọc. Bạn vẫn có thể liên hệ chủ nhà để hỏi phòng khác.' : 'Phòng này đã có người thuê. Bạn vẫn có thể liên hệ chủ nhà để hỏi phòng khác.' }));
    khung.push(h('div', { class: 'pp-card' }, [
      h('span', { class: 'pp-chip ' + tt.ma, text: tt.nhan }),
      h('h1', { text: 'Phòng ' + (p.code || '') }),
      b.name ? h('div', { class: 'pp-where', text: b.name + (p.typeLabel ? ' · ' + p.typeLabel : '') }) : null,
      h('div', { class: 'pp-price' }, coGia ? [giaTxt.replace('/tháng', ''), h('small', { text: '/tháng' })] : [h('small', { text: giaTxt })]),
      facts.length ? h('div', { class: 'pp-facts' }, facts) : null]));
    if (tienNghi.length) khung.push(h('div', { class: 'pp-card' }, [h('h2', { text: 'Tiện nghi' }), h('div', { class: 'pp-amen' }, tienNghi.map((x) => h('span', { text: x })))]));
    if (mota.length) khung.push(h('div', { class: 'pp-card pp-desc' }, [h('h2', { text: 'Mô tả' }), ...mota.map((t) => h('p', { text: t }))]));
    if (b.address) khung.push(h('div', { class: 'pp-card' }, [h('h2', { text: 'Địa chỉ' }), h('p', { class: 'pp-addr', text: b.address }),
      ban ? h('a', { class: 'pp-link', href: ban, target: '_blank', rel: 'noopener noreferrer', text: 'Xem trên bản đồ →' }) : null]));
    if (lh.name || lh.phone) khung.push(h('div', { class: 'pp-card' }, [h('h2', { text: 'Liên hệ chủ nhà' }),
      h('p', { class: 'pp-addr', text: [lh.name, L.sdtDep(lh.phone)].filter(Boolean).join(' · ') })]));

    const nutChiaSe = h('button', { type: 'button', class: 'pp-btn share', 'aria-label': 'Chia sẻ phòng này', text: '⤴', onclick: (e) => chiaSe(tieuDe, L.tinChiaSe(Object.assign({}, p), b, location.href), e.currentTarget) });
    const thanhLienHe = h('div', { class: 'pp-bar' }, [h('div', { class: 'pp-bar-in' }, goi
      ? [h('a', { class: 'pp-btn call' + (tt.conTrong ? '' : ' ghost'), href: goi, text: tt.conTrong ? 'Gọi ngay' : 'Gọi hỏi phòng khác' }), h('a', { class: 'pp-btn zalo', href: zalo, target: '_blank', rel: 'noopener noreferrer', text: 'Nhắn Zalo' }), nutChiaSe]
      : [h('div', { class: 'pp-nocontact', text: 'Chủ nhà chưa để lại số điện thoại.' }), nutChiaSe])]);
    mount(...khung, thanhLienHe);
  }

  /* ---------- Khởi động ---------- */
  async function boot() {
    const ma = location.hash.replace(/^#\/?/, '').trim();
    if (!L.slugHopLe(ma)) { ketThuc({ title: 'Link chưa đầy đủ', lines: ['Hãy mở đúng đường link chủ nhà đã gửi (bấm vào cả link, không bỏ sót chữ nào).'] }); return; }
    if (!enabled) { ketThuc({ title: 'Chưa mở được', lines: ['Trang này chưa được kết nối. Nhờ chủ nhà kiểm tra lại.'] }); return; }
    mount(header(), h('div', { class: 'pp-load' }, [h('div', { class: 'pp-spin', 'aria-hidden': 'true' }), h('p', { text: 'Đang mở phòng...' })]));
    let res;
    try { res = await client.rpc('public_room', { p_slug: ma }); } catch (e) { res = { error: { message: 'network' } }; }
    if (res.error) {
      const thieu = rpcMissing(res.error);
      ketThuc({ title: thieu ? 'Chức năng chưa được bật' : 'Không kết nối được', lines: [thieu ? 'Nhờ chủ nhà kiểm tra lại.' : 'Kiểm tra mạng rồi mở lại link này.'],
        extra: thieu ? [] : [h('button', { type: 'button', class: 'pp-btn call', text: 'Thử lại', onclick: boot })] });
      return;
    }
    if (!res.data || res.data.error || !res.data.room) { ketThuc({ title: 'Phòng này không còn được giới thiệu', lines: ['Link đã hết hiệu lực hoặc chủ nhà đã ngừng đăng.', 'Bạn nhờ chủ nhà gửi lại link mới nhé.'] }); return; }
    hienPhong(res.data);
  }
  window.addEventListener('hashchange', boot);
  boot();
})();

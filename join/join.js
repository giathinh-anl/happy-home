/* ============================================================
   Trang khách tự khai thông tin thuê phòng (không cần đăng nhập)

   Chủ trọ gửi link dạng  .../join/#t=<mã>. Mã nằm sau dấu # nên không bao giờ bị gửi lên máy chủ web hay ghi vào nhật ký truy cập.
   Khách chụp CCCD hai mặt, điền thông tin, gửi một lần. Máy chủ kiểm tra lại mọi trường (supabase/migration-onboarding.sql);
   luật bên này (js/onboarding.js) chỉ để báo lỗi tức thì cho khách.
   ============================================================ */
(function () {
  const O = HH.onboarding;
  const root = document.getElementById('jp');
  const cfg = window.HH_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && String(cfg.supabaseUrl).indexOf('YOUR-') === -1 && typeof supabase !== 'undefined');
  const client = enabled ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

  const TOKEN_KEY = 'hh_join_token', DRAFT_KEY = 'hh_join_draft';
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* trình duyệt chặn lưu: bỏ qua, chỉ mất tiện ích khôi phục */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const rpcMissing = (err) => { const s = ((err && err.message) || '').toLowerCase(); return s.includes('could not find the function') || (err && (err.code === '42883' || err.code === 'PGRST202')); };

  /* ---------- dựng giao diện bằng DOM (dữ liệu từ máy chủ luôn qua textContent, không qua innerHTML) ---------- */
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
  const header = () => h('div', { class: 'jp-head' }, [h('img', { src: '../assets/logo-mark.svg', alt: '' }), h('b', { text: 'HAPPY HOME' })]);

  function ketThuc(o) {
    mount(header(), h('div', { class: 'jp-card jp-end' + (o.bad ? ' bad' : '') }, [
      h('div', { class: 'jp-ic', 'aria-hidden': 'true', text: o.bad ? '!' : '✓' }), h('h1', { text: o.title }),
      ...(o.lines || []).map((t) => h('p', { text: t })), ...(o.extra || [])]));
  }
  const linkHetHan = () => ketThuc({ bad: true, title: 'Link không dùng được nữa',
    lines: ['Link này đã hết hạn, đã được dùng, hoặc chủ nhà đã thu hồi.', 'Nhờ chủ nhà gửi cho bạn link mới nhé.'] });

  /* ---------- nén ảnh: CCCD cần đọc rõ chữ nhưng không quá nặng (máy chủ giới hạn ~700.000 ký tự mỗi ảnh) ---------- */
  const GIOI_HAN = 650000;
  function docAnh(file, canh, chatLuong) {
    return new Promise((resolve, reject) => {
      const rd = new FileReader();
      rd.onerror = () => reject(new Error('doc'));
      rd.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('doc'));
        img.onload = () => {
          const tile = Math.min(1, canh / Math.max(img.width, img.height));
          const cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(img.width * tile)); cv.height = Math.max(1, Math.round(img.height * tile));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { resolve(cv.toDataURL('image/jpeg', chatLuong)); } catch (e) { reject(new Error('doc')); }
        };
        img.src = rd.result;
      };
      rd.readAsDataURL(file);
    });
  }
  async function nenAnh(file) {
    for (const [canh, q] of [[1400, 0.8], [1200, 0.72], [1000, 0.65], [900, 0.55]]) {
      const url = await docAnh(file, canh, q);
      if (url.length <= GIOI_HAN) return url;
    }
    throw new Error('nang');
  }

  /* Gõ liền chữ số, tự chèn dấu / : 05031998 -> 05/03/1998 (bàn phím số trên điện thoại, nhanh hơn cuộn bánh xe chọn năm) */
  function dinhDangNgay(s) {
    const d = String(s).replace(/\D/g, '').slice(0, 8);
    return d.length > 4 ? d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4) : d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  }

  /* ---------- biểu mẫu ---------- */
  const TEXT = [
    { k: 'fullName', label: 'Họ và tên', ph: 'Như trên CCCD', ac: 'name', hint: 'Viết có dấu, đúng như trên CCCD' },
    { k: 'phone', label: 'Số điện thoại', ph: '09xxxxxxxx', type: 'tel', ac: 'tel', im: 'tel' },
    { k: 'idNumber', label: 'Số CCCD', ph: '12 số', im: 'numeric', hint: 'CMND cũ thì nhập 9 số' },
    { k: 'dob', label: 'Ngày sinh', date: true, hint: 'Gõ liền 8 số, ví dụ 05031998 sẽ thành 05/03/1998' },
    { k: 'gender', seg: true, label: 'Giới tính' },
    { k: 'hometown', label: 'Quê quán', ph: 'VD: Bình Định' },
    { k: 'address', label: 'Địa chỉ thường trú', ph: 'Số nhà, đường, phường/xã, tỉnh/thành', ac: 'street-address' },
    { k: 'cccdIssueDate', label: 'Ngày cấp CCCD', date: true, opt: true, hint: 'Có ở mặt sau thẻ. Không nhớ thì bỏ qua, chủ nhà sẽ xem trên ảnh.' },
    { k: 'occupation', label: 'Nghề nghiệp', ph: 'VD: Nhân viên văn phòng', opt: true },
    { k: 'vehiclePlate', label: 'Biển số xe', ph: 'VD: 59X1-123.45', opt: true, hint: 'Nếu có gửi xe tại nhà' },
  ];

  function showForm(info, token) {
    const st = { front: null, back: null, gender: '', sending: false };
    const draft = (() => { try { return JSON.parse(store.get(DRAFT_KEY) || '{}'); } catch (e) { return {}; } })();
    st.gender = draft.gender === 'Nam' || draft.gender === 'Nữ' ? draft.gender : '';
    const errEl = {};
    const setErr = (k, msg) => {
      const e = errEl[k]; if (!e) return;
      e.hidden = !msg; e.textContent = msg || '';
      const inp = root.querySelector('[data-k="' + k + '"]'); if (inp) inp.classList.toggle('bad', !!msg);
      if (k === 'gender') segBox.classList.toggle('bad', !!msg);
      if (k === 'consent') consentBox.classList.toggle('bad', !!msg);
      if (k === 'front' || k === 'back') docs[k].box.classList.toggle('bad', !!msg);
    };
    const mkErr = (k) => (errEl[k] = h('div', { class: 'jp-err', role: 'alert', hidden: true }));

    // --- ảnh CCCD
    const docs = {};
    const mkDoc = (k, ten, goiY) => {
      const box = h('div', { class: 'jp-doc' });
      const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
      const lib = h('input', { type: 'file', accept: 'image/*', hidden: true });
      const ve = () => {
        box.classList.toggle('has', !!st[k]);
        box.replaceChildren(h('div', { class: 'jp-doc-t', text: ten }), h('div', { class: 'jp-doc-h', text: goiY }),
          ...(st[k] ? [h('img', { src: st[k], alt: 'Ảnh ' + ten.toLowerCase() })] : []),
          h('div', { class: 'jp-doc-act' }, st[k]
            ? [h('button', { type: 'button', class: 'jp-btn out', text: 'Chụp lại', onclick: () => cam.click() }), h('button', { type: 'button', class: 'jp-btn link', text: 'Chọn ảnh khác', onclick: () => lib.click() })]
            : [h('button', { type: 'button', class: 'jp-btn', text: 'Chụp ảnh', onclick: () => cam.click() }), h('button', { type: 'button', class: 'jp-btn link', text: 'Chọn từ thư viện', onclick: () => lib.click() })]),
          cam, lib, mkErr(k));
        errEl[k].hidden = true;
      };
      const nhan = async (f) => {
        if (!f) return;
        try { st[k] = await nenAnh(f); ve(); }
        catch (e) { ve(); setErr(k, e.message === 'nang' ? 'Ảnh quá nặng, hãy chụp lại gần hơn hoặc chọn ảnh khác' : 'Không đọc được ảnh này, thử chụp lại'); }
      };
      cam.onchange = () => { nhan(cam.files[0]); cam.value = ''; };
      lib.onchange = () => { nhan(lib.files[0]); lib.value = ''; };
      docs[k] = { box, ve }; ve();
      return box;
    };

    // --- ô nhập
    const segBox = h('div', { class: 'jp-seg' });
    const ve_gt = () => segBox.replaceChildren(...['Nam', 'Nữ'].map((g) => h('button', { type: 'button', text: g, 'aria-pressed': st.gender === g ? 'true' : 'false',
      onclick: () => { st.gender = g; ve_gt(); setErr('gender', ''); luuNhap(); } })));
    ve_gt();
    const fieldNodes = TEXT.map((f) => {
      if (f.seg) return h('div', { class: 'jp-f' }, [h('div', { class: 'jp-lab', text: f.label }), segBox, mkErr(f.k)]);
      const inp = h('input', { class: 'jp-in', 'data-k': f.k, id: 'f-' + f.k, type: f.type || 'text', placeholder: f.date ? 'dd/mm/yyyy' : (f.ph || ''), autocomplete: f.ac || 'off',
        inputmode: f.date ? 'numeric' : (f.im || false), maxlength: f.date ? '10' : '200', autocapitalize: f.k === 'vehiclePlate' ? 'characters' : false });
      if (f.date) inp.addEventListener('input', () => { const v = dinhDangNgay(inp.value); if (v !== inp.value) inp.value = v; });
      if (draft[f.k]) inp.value = draft[f.k];
      inp.addEventListener('input', () => { if (errEl[f.k] && !errEl[f.k].hidden) setErr(f.k, ''); luuNhap(); });
      inp.addEventListener('blur', () => { if (inp.value.trim() || f.k === 'fullName') kiemMot(f.k); });
      return h('div', { class: 'jp-f' }, [h('label', { for: 'f-' + f.k }, [f.label, f.opt ? h('span', { class: 'jp-opt', text: ' (không bắt buộc)' }) : null]), inp,
        f.hint ? h('div', { class: 'jp-hint', text: f.hint }) : null, mkErr(f.k)]);
    });

    const consent = h('input', { type: 'checkbox', id: 'f-consent' });
    const consentBox = h('label', { class: 'jp-consent', for: 'f-consent' }, [consent,
      h('span', { text: 'Tôi đồng ý cho chủ nhà sử dụng thông tin và ảnh CCCD trên để lập hợp đồng thuê và đăng ký tạm trú. Thông tin chỉ được gửi cho chủ nhà.' })]);
    consent.addEventListener('change', () => setErr('consent', ''));

    const topErr = h('div', { class: 'jp-top-err', role: 'alert', hidden: true });
    const send = h('button', { type: 'button', class: 'jp-btn block', text: 'Gửi cho chủ nhà' });

    const layDuLieu = () => {
      const d = { consent: consent.checked, gender: st.gender };
      TEXT.forEach((f) => { if (f.seg) return; d[f.k] = (root.querySelector('[data-k="' + f.k + '"]') || {}).value || ''; });
      return d;
    };
    function luuNhap() {
      const d = {}; TEXT.forEach((f) => { if (f.seg) return; const i = root.querySelector('[data-k="' + f.k + '"]'); if (i) d[f.k] = i.value; });
      d.gender = st.gender; store.set(DRAFT_KEY, JSON.stringify(d));       // không lưu ảnh; tab đóng là mất
    }
    function kiemMot(k) { const r = O.kiemHoSo(layDuLieu()); setErr(k, r.loi[k] || ''); return !r.loi[k]; }

    function hienLoi(loi) {
      ['front', 'back', ...TEXT.map((f) => f.k), 'consent'].forEach((k) => setErr(k, loi[k] || ''));
      const dau = ['front', 'back', ...TEXT.map((f) => f.k), 'consent'].find((k) => loi[k]);
      const n = Object.keys(loi).length;
      topErr.hidden = !n; topErr.textContent = n ? `Còn ${n} mục chưa đúng. Các mục cần sửa có chữ đỏ.` : '';
      if (dau) {
        const t = (dau === 'front' || dau === 'back') ? docs[dau].box : dau === 'consent' ? consentBox : dau === 'gender' ? segBox : root.querySelector('[data-k="' + dau + '"]');
        if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (t.focus && t.tagName === 'INPUT') t.focus({ preventScroll: true }); }
      }
    }

    send.onclick = async () => {
      if (st.sending) return;
      const r = O.kiemHoSo(layDuLieu());
      const loi = Object.assign({}, r.loi);
      if (!st.front) loi.front = 'Cần ảnh mặt trước CCCD';
      if (!st.back) loi.back = 'Cần ảnh mặt sau CCCD';
      if (Object.keys(loi).length) { hienLoi(loi); return; }
      hienLoi({});
      st.sending = true; send.disabled = true; send.textContent = 'Đang gửi...';
      let res;
      try { res = await client.rpc('invite_submit', { p_token: token, p_data: Object.assign({}, r.sach, { consent: true }), p_front: st.front, p_back: st.back }); }
      catch (e) { res = { error: { message: 'network' } }; }
      st.sending = false; send.disabled = false; send.textContent = 'Gửi cho chủ nhà';
      if (res.error) {
        topErr.hidden = false;
        topErr.textContent = rpcMissing(res.error) ? 'Chức năng này chưa được bật. Nhờ chủ nhà kiểm tra lại.' : 'Chưa gửi được, có thể do mạng yếu. Dữ liệu bạn nhập vẫn còn, bấm "Gửi cho chủ nhà" lần nữa.';
        topErr.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      const d = res.data || {};
      if (d.error === 'invalid') { store.del(TOKEN_KEY); store.del(DRAFT_KEY); linkHetHan(); return; }
      if (d.error === 'validation') { hienLoi(d.fields || {}); return; }
      store.del(TOKEN_KEY); store.del(DRAFT_KEY);
      const lienHe = info.contactPhone ? [h('p', {}, ['Cần hỏi gì, gọi chủ nhà: ', h('a', { href: 'tel:' + String(info.contactPhone).replace(/[^\d+]/g, ''), text: info.contactPhone })])] : [];
      ketThuc({ title: 'Đã gửi cho chủ nhà', lines: ['Chủ nhà sẽ xem thông tin và liên hệ với bạn qua số ' + r.sach.phone + '.', 'Bạn có thể đóng trang này.'], extra: lienHe });
    };

    mount(header(),
      h('div', { class: 'jp-hero' }, [h('h1', { text: info.roomCode ? 'Khai thông tin thuê phòng ' + info.roomCode : 'Khai thông tin thuê phòng' }),
        h('div', { class: 'jp-place', text: [info.buildingName, info.address].filter(Boolean).join(' · ') }),
        h('div', { class: 'jp-meta', text: 'Mất khoảng 3 phút. Chuẩn bị sẵn thẻ CCCD (căn cước công dân) của bạn.' })]),
      h('div', { class: 'jp-card' }, [h('h2', {}, [h('span', { class: 'jp-step', text: '1' }), 'Chụp CCCD']),
        h('p', { class: 'jp-sub', text: 'Chụp hai mặt của thẻ.' }),
        mkDoc('front', 'Mặt trước', 'Mặt có ảnh chân dung và họ tên'), mkDoc('back', 'Mặt sau', 'Mặt có ngày cấp và mã vạch'),
        h('p', { class: 'jp-tip', text: 'Đặt thẻ trên mặt phẳng, đủ sáng, thấy rõ cả 4 góc và đọc được chữ. Không chụp bị lóa.' })]),
      h('div', { class: 'jp-card' }, [h('h2', {}, [h('span', { class: 'jp-step', text: '2' }), 'Thông tin của bạn']),
        h('p', { class: 'jp-sub', text: 'Điền đúng như trên CCCD.' }), ...fieldNodes]),
      h('div', { class: 'jp-card' }, [h('h2', {}, [h('span', { class: 'jp-step', text: '3' }), 'Gửi cho chủ nhà']), consentBox, mkErr('consent'), h('div', { style: 'height:14px' }), topErr, send,
        h('p', { class: 'jp-note', text: 'Link này chỉ dùng được một lần. Gửi xong, link sẽ không mở lại được.' })]));
  }

  /* ---------- khởi động ---------- */
  async function boot() {
    let token = O.layToken(location.hash);
    if (token) {
      store.set(TOKEN_KEY, token);
      // gỡ mã khỏi thanh địa chỉ: người đứng cạnh hay ảnh chụp màn hình không lấy được link còn dùng được
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    } else token = store.get(TOKEN_KEY) || '';
    if (!token) { ketThuc({ bad: true, title: 'Link chưa đầy đủ', lines: ['Hãy mở đúng đường link chủ nhà đã gửi (bấm vào cả link, không bỏ sót phần cuối).'] }); return; }
    if (!enabled) { ketThuc({ bad: true, title: 'Chưa mở được', lines: ['Trang này chưa được kết nối. Nhờ chủ nhà kiểm tra lại.'] }); return; }
    let res;
    try { res = await client.rpc('invite_info', { p_token: token }); }
    catch (e) { res = { error: { message: 'network' } }; }
    if (res.error) {
      ketThuc({ bad: true, title: rpcMissing(res.error) ? 'Chức năng chưa được bật' : 'Không kết nối được',
        lines: [rpcMissing(res.error) ? 'Nhờ chủ nhà kiểm tra lại.' : 'Kiểm tra mạng rồi mở lại link này.'],
        extra: rpcMissing(res.error) ? [] : [h('button', { type: 'button', class: 'jp-btn', text: 'Thử lại', onclick: boot })] });
      return;
    }
    if (!res.data || res.data.error) { store.del(TOKEN_KEY); linkHetHan(); return; }
    showForm(res.data, token);
  }
  boot();
})();

/* ============================================================
   Happy Home — Phần chạy trong trình duyệt của "báo việc mới" (luật ở js/notify.js)
   - Hỏi máy chủ số việc đang chờ (HH.backend.demViec): 30 giây khi đang xem tab, 60 giây khi tab ở nền, lỗi thì giãn dần.
   - Số tăng: tải dữ liệu mới về (app.js truyền hàm taiLai), kêu "ting", báo nhỏ trong trang; tab ở nền thì hiện thông báo
     của máy tính nếu chủ trọ đã bật và trình duyệt đã cho phép.
   - Tiêu đề tab luôn có số việc đang chờ: "(3) Happy Home — ...".
   Cài đặt (mỗi thiết bị) ở Cài đặt chung, lưu trong prefs.baoViec.
   ============================================================ */
HH.baoViecUI = (function () {
  const N = HH.baoViec;
  const S = () => HH.store;
  const HET_GIO = 15000;
  let timer = null, truoc = null, loi = 0, goc = null, ac = null, taiLai = null, dangHoi = false, daBatDau = false, soLan = 0, daLamMoi = false;

  const bidHienTai = () => {
    const m = /^\/b\/([^/?]+)/.exec((HH.router && HH.router.current && HH.router.current()) || '');
    return m ? decodeURIComponent(m[1]) : ((S().buildings || [])[0] || {}).id;
  };
  const caiDat = () => N.caiDat(S().prefs.baoViec);
  function datTieuDe(n) {
    if (goc == null) goc = document.title;
    const t = N.tieuDe(goc, caiDat().tieuDe ? n : 0);
    if (document.title !== t) document.title = t;
  }

  // Trình duyệt chỉ cho phát tiếng sau khi người dùng đã bấm vào trang: mở bộ âm thanh ngay trong cú bấm / phím đầu tiên.
  function moAm() {
    try {
      if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); }
      if (ac && ac.state === 'suspended') ac.resume();
    } catch (e) { /* máy không có âm thanh */ }
  }
  // Hai nốt ngắn, nhỏ tiếng
  function ting() {
    if (!ac || ac.state !== 'running') return false;
    const t = ac.currentTime;
    [[880, 0], [1318.5, 0.13]].forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.16, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.38);
      o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + 0.42);
    });
    return true;
  }
  function hienManHinh(moi) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      const den = N.duongDen(moi, bidHienTai());
      const n = new Notification('Happy Home: có việc mới', { body: N.noiDung(moi), tag: 'hh-viec-moi', renotify: true, icon: 'assets/icon-192.png' });
      n.onclick = () => { try { window.focus(); } catch (e) {} HH.router.go(den); n.close(); };
      return true;
    } catch (e) { return false; }      // vài trình duyệt điện thoại chỉ cho hiện thông báo qua service worker: bỏ qua
  }
  function baoMoi(moi) {
    const c = caiDat(), dangXem = document.visibilityState === 'visible';
    if (taiLai) { try { taiLai(); } catch (e) { /* tải lại lỗi thì lần hỏi sau vẫn báo đúng số */ } }
    if (c.tieng) ting();
    if (dangXem) HH.ui.toast('Có ' + N.noiDung(moi), { type: 'info' });
    else if (c.manHinh) hienManHinh(moi);
  }

  function hen(ms) {
    clearTimeout(timer);
    timer = setTimeout(vong, ms != null ? ms : N.khoangCho(document.visibilityState === 'visible', loi));
  }
  async function vong() {
    timer = null;
    const st = S();
    if (dangHoi) { hen(); return; }
    if (!st.usingBackend() || !st.prefs.auth || (HH.offline && HH.offline.mode)) { truoc = null; datTieuDe(0); hen(); return; }
    const loai = N.loaiTheoQuyen({ chu: st.isOwner(), can: st.can });
    if (!loai.length) { datTieuDe(0); hen(); return; }
    // Một lần hỏi treo (mạng chập chờn, máy chủ không trả lời) thì sau 15 giây coi như lỗi, kẻo vòng hỏi đứng luôn
    dangHoi = true;
    const lan = ++soLan;
    let r, hetGio = null;
    try {
      r = await Promise.race([HH.backend.demViec(loai),
        new Promise((res) => { hetGio = setTimeout(() => res({ error: { message: 'Máy chủ không trả lời' } }), HET_GIO); })]);
    } catch (e) { r = { error: e }; }
    finally { clearTimeout(hetGio); }
    if (lan !== soLan) return;                    // đã có lần hỏi mới hơn (sau khi đăng xuất / vào lại)
    dangHoi = false;
    if (!r || r.error) { loi++; hen(); return; }
    loi = 0;
    const sau = N.chuanHoa(r.data), ss = N.soSanh(truoc, sau);
    if (!truoc && !daLamMoi) { daLamMoi = true; lamMoiDay(); }      // lần hỏi đầu sau khi vào: báo máy chủ máy này vẫn bật thông báo đẩy
    truoc = sau;
    datTieuDe(N.tong(sau));
    if (ss.coMoi) baoMoi(ss.moi);
    hen();
  }

  /** Bắt đầu hỏi (gọi một lần khi vào ứng dụng). o.taiLai = hàm tải dữ liệu mới về và vẽ lại trang. */
  function batDau(o) {
    if (o && o.taiLai) taiLai = o.taiLai;
    if (daBatDau) return;
    daBatDau = true;
    ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, moAm, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') hen(1500); });
    hen(3000);
  }
  /** Đăng xuất: quên số đếm cũ (người đăng nhập sau không bị báo nhầm), bỏ số trên tiêu đề. */
  function dungLai() { truoc = null; loi = 0; soLan++; dangHoi = false; datTieuDe(0); if (daBatDau) hen(); }   // lần hỏi đang dở (nếu có) bị bỏ, hẹn lần mới
  /** Xin quyền hiện thông báo của máy tính (phải gọi trong lúc người dùng bấm nút). Trả 'granted' | 'denied' | 'default' | 'khong-ho-tro'. */
  async function xinQuyen() {
    if (!('Notification' in window)) return 'khong-ho-tro';
    if (Notification.permission !== 'default') return Notification.permission;
    try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; }
  }
  const quyen = () => ('Notification' in window ? Notification.permission : 'khong-ho-tro');

  /* ---------- Thông báo đẩy kể cả khi đã đóng web (supabase/migration-owner-push.sql) ----------
     Máy chủ báo khi khách tạo việc mới; sw.js hiện thông báo và mở đúng trang khi bấm. Bật / tắt theo từng máy. */
  const VAPID = () => (window.HH_CONFIG && window.HH_CONFIG.vapidPublicKey) || '';
  async function dangKyDay() {
    try { const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null; return reg && reg.pushManager ? await reg.pushManager.getSubscription() : null; }
    catch (e) { return null; }
  }
  async function cheDoDay() {
    const coSW = 'serviceWorker' in navigator, coPush = 'PushManager' in window, coThongBao = 'Notification' in window, st = S();
    return N.cheDoDay({ chu: st.isOwner(), coMayChu: st.usingBackend(), coKhoa: !!VAPID(), coSW, coPush, coThongBao,
      quyen: coThongBao ? Notification.permission : 'default', daBat: coSW && coPush ? !!(await dangKyDay()) : false,
      ios: /iPhone|iPad|iPod/.test(navigator.userAgent), daCai: (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true });
  }
  // Gọi hàm máy chủ; lỗi thì ném câu tiếng Việt dễ hiểu
  async function goiMayChu(ten, doiSo) {
    let r;
    try { r = await HH.backend.rpc(ten, doiSo || {}); } catch (e) { throw new Error('Không kết nối được máy chủ. Thử lại sau.'); }
    const loi = r && r.error, d = r && r.data;
    if (loi) {
      const m = String(loi.message || '').toLowerCase();
      throw new Error(loi.code === 'PGRST202' || m.includes('could not find the function') ? 'Máy chủ chưa bật tính năng này (chưa chạy migration-owner-push.sql).' : 'Máy chủ báo lỗi: ' + (loi.message || ''));
    }
    if (d && d.error) throw new Error(d.error === 'auth' ? 'Phiên đăng nhập đã hết, hãy đăng nhập lại.' : 'Máy chủ không nhận máy này (' + d.error + ').');
    return d || {};
  }
  async function batDay() {
    if ((await xinQuyen()) !== 'granted') throw new Error('Cần cho phép thông báo thì mới bật được.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription(), moi = false;
    if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: N.khoaThanhByte(VAPID()) }); moi = true; }
    const j = sub.toJSON();
    try { await goiMayChu('owner_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys && j.keys.p256dh, p_auth: j.keys && j.keys.auth, p_ua: navigator.userAgent.slice(0, 200) }); }
    catch (e) { if (moi) { try { await sub.unsubscribe(); } catch (e2) { /* bỏ qua */ } } throw e; }   // máy chủ không nhận thì đừng để đăng ký lơ lửng
  }
  async function tatDay() {
    const sub = await dangKyDay(); if (!sub) return;
    try { await goiMayChu('owner_push_unsubscribe', { p_endpoint: sub.endpoint }); } catch (e) { /* máy cũ sẽ bị thay khi bật máy khác */ }
    try { await sub.unsubscribe(); } catch (e) { /* bỏ qua */ }
  }
  async function thuDay() { return goiMayChu('owner_push_test'); }
  // Mở web lên lại sau khi đã bật: gửi lại đăng ký (để máy chủ biết máy này còn dùng, không bị máy khác thay mất)
  async function lamMoiDay() {
    try { if ((await cheDoDay()) === 'dang-bat') { const j = (await dangKyDay()).toJSON(); await goiMayChu('owner_push_subscribe', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent.slice(0, 200) }); } }
    catch (e) { /* lần sau thử lại */ }
  }
  // Bấm vào thông báo khi web đang mở: sw.js gửi lệnh đi tới đúng trang (không tải lại cả web)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'go') { try { HH.router.go(N.duongTuThongBao(e.data.hash)); } catch (er) { /* bỏ qua */ } }
  });

  return { batDau, dungLai, xinQuyen, quyen, ting, moAm, hoiNgay: () => hen(0), capNhatTieuDe: () => datTieuDe(N.tong(truoc)),
    cheDoDay, batDay, tatDay, thuDay, lamMoiDay, _trangThai: () => ({ truoc, loi, coHen: !!timer }) };
})();

/* ============================================================
   Happy Home — Lớp backend Supabase
   - Bật khi có js/config.js hợp lệ + đã nạp SDK supabase-js.
   - Không có cấu hình -> enabled=false, app chạy chế độ demo (localStorage).
   ============================================================ */
HH.backend = (function () {
  const cfg = window.HH_CONFIG || {};
  const hasSDK = (typeof supabase !== 'undefined') && supabase && typeof supabase.createClient === 'function';
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey &&
    cfg.supabaseUrl.indexOf('YOUR-') === -1 && cfg.supabaseAnonKey.indexOf('YOUR-') === -1);
  const enabled = configured && hasSDK;

  let client = null;
  let ownerId = null;          // tài khoản đang đăng nhập
  /* Chủ của DỮ LIỆU. Nhân viên đăng nhập bằng tài khoản riêng nhưng làm trên dữ liệu của chủ trọ đã thêm họ.
     Lỗi cũ (thấy trên máy chủ thật 26/11): mọi dòng nhân viên lưu đều mang owner_id = tài khoản của NHÂN VIÊN, mà khóa là
     (owner_id, id), nên "sửa" một hóa đơn thật ra là tạo bản sao mang tên nhân viên; chủ trọ không bao giờ thấy việc nhân viên làm.
     Nay: nhân viên ghi với owner_id = chủ trọ, và chỉ tải dữ liệu của chủ trọ (bỏ qua các bản sao cũ). null = chính người đăng nhập. */
  let chuDuLieu = null;
  const chuGhi = () => chuDuLieu || ownerId;
  function datChuDuLieu(id) { chuDuLieu = id || null; }

  // key trong bộ nhớ (store) -> tên bảng trong DB
  const KINDS = {
    buildings: 'buildings', rooms: 'rooms', tenants: 'tenants', contracts: 'contracts',
    services: 'services', readings: 'readings', invoices: 'invoices', payments: 'payments',
    assets: 'assets', incidents: 'incidents', transactions: 'transactions', staff: 'staff',
    claims: 'payment_claims', renewals: 'renewal_requests', invoiceBatches: 'invoice_batches', bankTx: 'bank_transactions', auditLog: 'audit_log',
    supportMsgs: 'support_messages',
  };
  // field JS lệch quy tắc -> cột DB
  const ALIAS = {
    contracts: { start: 'start_date', end: 'end_date' },
    payments: { date: 'paid_date' },
    transactions: { date: 'tx_date' },
  };

  /** Nếu lỗi là "thiếu cột", trả về tên cột đó (để bỏ qua và thử lại).
      PostgREST: PGRST204 "Could not find the 'X' column of 'Y' in the schema cache" */
  function missingColumn(e) {
    if (!e) return null;
    const txt = (e.message || '') + ' ' + (e.details || '') + ' ' + (e.hint || '');
    const m = txt.match(/'([a-z0-9_]+)'\s+column|column\s+"([a-z0-9_]+)"/i);
    if (m) return m[1] || m[2];
    return null;
  }

  /** Bảng chưa được tạo (chưa chạy migration) -> coi như rỗng, không làm hỏng cả luồng.
      LƯU Ý: phải KHÔNG khớp lỗi thiếu cột (PGRST204) — lỗi đó cũng chứa "schema cache". */
  function isMissingTable(e) {
    if (!e) return false;
    if (missingColumn(e)) return false;              // là lỗi thiếu cột, không phải thiếu bảng
    const code = String(e.code || '').toLowerCase();
    const s = ((e.message || '') + ' ' + (e.details || '')).toLowerCase();
    return code === '42p01' || code === 'pgrst205' ||
      s.includes('could not find the table') || /relation .* does not exist/.test(s);
  }

  const toSnake = (s) => s.replace(/([A-Z])/g, (m) => '_' + m.toLowerCase());
  const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

  // Cột kiểu `date` (khóa JS). Chuỗi ISO của nửa đêm 1/10 giờ Việt Nam là "2026-09-30T17:00:00Z" và Postgres cắt lấy
  // 30/9: hạn đóng tiền, đầu kỳ hóa đơn lưu sớm một ngày. Nên ghi thẳng "năm-tháng-ngày" theo lịch địa phương (js/dates.js).
  const DATE_FIELDS = {
    rooms: ['contractEnd'], contracts: ['start', 'end'], invoices: ['periodStart', 'periodEnd', 'dueDate'],
    payments: ['date'], transactions: ['date'], assets: ['buyDate'], incidents: ['scheduledFor'],
  };

  // Cột do MÁY CHỦ ghi (supabase/migration-nightly.sql): trình duyệt đang mở lâu có bản cũ, gửi lại sẽ đè mất
  // incidents: sao và nhận xét do KHÁCH chấm qua app khách (migration-incident-rating.sql), máy chủ ghi
  const SERVER_FIELDS = { buildings: ['nightlyLastRun', 'nightlyLastNote'], incidents: ['rating', 'ratingNote', 'ratedAt'] };

  function jsToRow(kind, obj) {
    const alias = ALIAS[kind] || {};
    const dateKeys = DATE_FIELDS[kind] || [];
    const serverKeys = SERVER_FIELDS[kind] || [];
    const row = { owner_id: chuGhi(), updated_at: new Date().toISOString() };
    // Tài khoản nhận tiền của tòa chỉ CHỦ được ghi (DB chặn nhân viên, supabase/migration-bank-info.sql). Nhân viên lưu tòa nhà thì
    // đừng gửi lại cột này: bản trong máy họ có thể cũ hơn bản chủ vừa đổi, gửi lên là bị chặn và cả lần lưu hỏng.
    const laChu = !(HH.store && HH.store.isOwner) || HH.store.isOwner();
    Object.keys(obj).forEach((k) => {
      if (k === 'ownerId' || k === 'updatedAt' || serverKeys.indexOf(k) >= 0) return;
      if (kind === 'buildings' && k === 'bankInfo' && !laChu) return;
      let v = obj[k];
      if (v != null && v !== '' && dateKeys.indexOf(k) >= 0) v = HH.dates.chuoiNgay(v) || v;   // không đổi được thì để nguyên cho DB báo lỗi
      row[alias[k] || toSnake(k)] = v;
    });
    return row;
  }
  function rowToJs(kind, row) {
    const alias = ALIAS[kind] || {};
    const rev = {}; Object.keys(alias).forEach((k) => { rev[alias[k]] = k; });
    const o = {};
    Object.keys(row).forEach((col) => {
      if (col === 'owner_id' || col === 'updated_at') return;
      o[rev[col] || toCamel(col)] = row[col];
    });
    return o;
  }

  function init() {
    if (enabled && !client) {
      client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey,
        { auth: { persistSession: true, autoRefreshToken: true } });
    }
    return client;
  }

  /* ---------- Auth ---------- */
  async function signUp(email, password, fullName) {
    const { data, error } = await client.auth.signUp({
      email, password, options: { data: { full_name: fullName || email.split('@')[0] } },
    });
    if (!error && data.session) ownerId = data.user.id;
    return { data, error };
  }
  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.user) ownerId = data.user.id;
    return { data, error };
  }
  async function signOut() { try { await client.auth.signOut(); } catch (e) {} ownerId = null; chuDuLieu = null; }
  async function getSession() {
    const { data } = await client.auth.getSession();
    if (data.session) ownerId = data.session.user.id;
    return data.session;
  }
  function currentUserId() { return ownerId; }

  /** Email của phiên đang đăng nhập (rỗng nếu chưa có phiên hoặc chưa nối máy chủ) */
  async function currentEmail() {
    if (!enabled || !client) return '';
    try { const { data } = await client.auth.getSession(); return (data && data.session && data.session.user && data.session.user.email) || ''; } catch (e) { return ''; }
  }
  /** Đổi mật khẩu. Bắt đăng nhập lại bằng mật khẩu hiện tại trước (người ngồi nhầm máy đang mở sẵn app không đổi được mật khẩu của chủ),
      rồi mới đặt mật khẩu mới. Trả { ok: true } hoặc { error: 'sai-mat-khau-cu' | 'trung-mat-khau-cu' | 'khong-co-phien' | 'khong-co-may-chu' | 'khac', message }. */
  async function changePassword(cu, moi) {
    if (!enabled || !client) return { error: 'khong-co-may-chu' };
    const email = await currentEmail();
    if (!email) return { error: 'khong-co-phien' };
    const re = await client.auth.signInWithPassword({ email, password: cu });
    if (re.error) return { error: /invalid login|invalid credentials/i.test(re.error.message || '') ? 'sai-mat-khau-cu' : 'khac', message: re.error.message };
    const up = await client.auth.updateUser({ password: moi });
    if (up.error) return { error: /different from the old|same.*password/i.test(up.error.message || '') ? 'trung-mat-khau-cu' : 'khac', message: up.error.message };
    return { ok: true };
  }
  /** Lưu tên hiển thị vào hồ sơ đăng nhập (user_metadata.full_name), để đăng nhập lại không quay về tên cũ */
  async function updateDisplayName(name) {
    if (!enabled || !client) return { error: 'khong-co-may-chu' };
    try { const r = await client.auth.updateUser({ data: { full_name: name } }); return r.error ? { error: r.error.message } : { ok: true }; }
    catch (e) { return { error: String((e && e.message) || e) }; }
  }

  /** Tìm bản ghi nhân viên theo email đang đăng nhập (nếu người này được chủ trọ thêm vào) */
  async function findStaffByEmail(email) {
    if (!enabled || !email) return null;
    const { data, error } = await client.from('staff').select('*')
      .ilike('email', email).eq('status', 'active').limit(1);
    if (error) { if (!isMissingTable(error)) console.info('[staff lookup]', error.message); return null; }
    if (!data || !data[0]) return null;
    // rowToJs bỏ cột owner_id; ở đây CẦN nó: đó là chủ trọ mà nhân viên làm cho (ghi dữ liệu dưới tên chủ trọ này)
    return Object.assign(rowToJs('staff', data[0]), { ownerId: data[0].owner_id || null });
  }

  /* ---------- Dữ liệu ---------- */
  // Nhân viên: chỉ lấy dòng của chủ trọ (máy chủ còn cho họ thấy cả các bản sao cũ mang tên chính họ, xem chuDuLieu ở trên)
  const chiCuaChu = (q) => (chuDuLieu ? q.eq('owner_id', chuDuLieu) : q);
  // Trả về { data } khi thành công, hoặc { error } nếu tải lỗi (đã thử lại vài lần).
  // Không bao giờ trả dữ liệu trống một phần -> tránh nhầm "tài khoản rỗng" rồi tạo trùng.
  // opts.bo = các loại KHÔNG tải (để rỗng). Nhân viên không tải bankTx: giao dịch ngân hàng có cả tiền riêng của chủ trọ.
  async function loadAll(opts) {
    const bo = new Set((opts && opts.bo) || []);
    for (let attempt = 0; attempt < 3; attempt++) {
      const out = {}; let failedMsg = null;
      for (const kind of Object.keys(KINDS)) {
        if (bo.has(kind)) { out[kind] = []; continue; }
        const { data, error } = await chiCuaChu(client.from(KINDS[kind]).select('*'));
        if (error) {
          if (isMissingTable(error)) { out[kind] = []; continue; } // bảng chưa tạo -> rỗng
          failedMsg = '[load ' + kind + '] ' + error.message; break;
        }
        out[kind] = (data || []).map((r) => rowToJs(kind, r));
      }
      if (!failedMsg) { primeSig(out); return { data: out }; }
      console.warn('Tải dữ liệu lỗi (thử lại ' + (attempt + 1) + '/3):', failedMsg);
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    return { error: true };
  }
  /** Nạp lại MỘT bảng (dùng để hỏi tin nhắn mới mà không phải tải lại cả kho).
      Bảng chưa tạo thì trả mảng rỗng chứ không làm hỏng trang đang mở. */
  async function loadKind(kind) {
    if (!enabled || !KINDS[kind]) return { data: [] };
    const { data, error } = await chiCuaChu(client.from(KINDS[kind]).select('*'));
    if (error) {
      if (isMissingTable(error)) return { data: [], missing: true };
      return { error };
    }
    return { data: (data || []).map((r) => rowToJs(kind, r)) };
  }

  /* ---------- Ảnh trong chat (supabase/migration-chat-photos.sql) ----------
     Ảnh nằm ở bảng riêng, KHÔNG nằm trong support_messages: trang Hỏi đáp hỏi máy chủ mỗi 3,5 giây và tải cả bảng tin nhắn,
     ảnh vài trăm KB mỗi tấm cùng bảng thì mỗi lượt hỏi nặng thêm hàng MB. Tin chỉ ghi số ảnh (photo_count). */
  const ANH_CHAT = 'support_message_photos';
  /** Tải ảnh của các tin (tối đa 20 tin một lần). { data: { mãTin: [dataUrl, ...] } }, { missing: true } khi máy chủ chưa chạy migration, hoặc { error }. */
  async function loadSupportPhotos(ids) {
    if (!enabled || !Array.isArray(ids) || !ids.length) return { data: {} };
    const { data, error } = await client.from(ANH_CHAT).select('message_id, idx, data').in('message_id', ids.slice(0, 20)).order('idx');
    if (error) return isMissingTable(error) ? { data: {}, missing: true } : { error };
    const out = {};
    (data || []).forEach((r) => { (out[r.message_id] = out[r.message_id] || [])[r.idx] = r.data; });
    return { data: out };
  }
  /** Ghi ảnh của một tin (chủ trọ trả lời kèm ảnh). { ok: true }, { missing: true } hoặc { error } */
  async function saveSupportPhotos(messageId, photos) {
    if (!enabled || !Array.isArray(photos) || !photos.length) return { ok: true };
    const rows = photos.map((d, i) => ({ owner_id: chuGhi(), message_id: messageId, idx: i, data: d }));
    const { error } = await client.from(ANH_CHAT).upsert(rows, { onConflict: 'owner_id,message_id,idx' });
    if (error) return isMissingTable(error) ? { missing: true } : { error };
    return { ok: true };
  }

  /* ---------- Chỉ gửi những dòng THẬT SỰ đổi ----------
     Trước đây mỗi lần lưu là đẩy lại toàn bộ mọi bảng. Từ khi phòng có ảnh
     (mỗi tấm vài trăm KB nằm ngay trong dòng) thì mỗi lần bấm Lưu phải tải
     lên vài MB, trang như bị treo. Nhớ lại dấu vân của từng dòng đã gửi
     thành công, dòng nào y hệt thì bỏ qua. */
  const sentSig = new Map();
  const sigKey = (kind, o) => kind + '|' + o.id;
  /** Sau khi tải từ máy chủ về: đánh dấu mọi dòng là "đã khớp", để lần lưu
      đầu tiên không đẩy lại cả kho. */
  function primeSig(all) {
    sentSig.clear();
    Object.keys(all || {}).forEach((kind) => {
      (all[kind] || []).forEach((o) => { if (o && o.id) sentSig.set(sigKey(kind, o), JSON.stringify(o)); });
    });
  }

  async function saveMany(kind, arr) {
    if (!enabled || !arr || !arr.length) return { error: null };

    const todo = [], sigs = [];
    for (const o of arr) {
      if (!o || !o.id) continue;
      const sig = JSON.stringify(o);
      if (sentSig.get(sigKey(kind, o)) === sig) continue;     // không đổi -> khỏi gửi
      todo.push(o); sigs.push([sigKey(kind, o), sig]);
    }
    if (!todo.length) return { error: null };

    let rows = todo.map((o) => jsToRow(kind, o));
    // Thử lưu; nếu DB thiếu cột mới (chưa chạy migration) thì bỏ cột đó rồi thử lại
    for (let attempt = 0; attempt < 4; attempt++) {
      const { error } = await client.from(KINDS[kind]).upsert(rows, { onConflict: 'owner_id,id' });
      if (!error) { sigs.forEach(([k, s]) => sentSig.set(k, s)); return { error: null }; }
      if (isMissingTable(error)) { console.info('Bảng ' + kind + ' chưa tạo — bỏ qua đồng bộ (chạy migration để bật).'); return { error: null }; }
      const miss = missingColumn(error);
      if (miss) {
        console.info(`Cột "${miss}" chưa có trong bảng ${kind} — bỏ qua cột này (chạy migration để lưu đầy đủ).`);
        rows = rows.map(r => { const c = Object.assign({}, r); delete c[miss]; return c; });
        continue;
      }
      console.error('[save ' + kind + ']', error.message);
      return { error };
    }
    return { error: null };
  }
  async function saveOne(kind, obj) { return saveMany(kind, [obj]); }

  /** Máy chủ đã có cột này chưa? (chưa chạy migration thì chưa có)
      Dùng để báo thẳng cho người dùng thay vì âm thầm bỏ cột rồi mất dữ liệu.
      Chế độ demo (không nối máy chủ) coi như có, vì dữ liệu nằm trong máy. */
  const colCache = {};
  async function hasColumn(kind, col) {
    if (!enabled || !client) return true;
    const key = kind + '.' + col;
    if (key in colCache) return colCache[key];
    try {
      const { error } = await client.from(KINDS[kind]).select(col).limit(1);
      const gone = !!error && (String(error.code) === '42703' ||
        /does not exist|schema cache/i.test((error.message || '') + (error.details || '')));
      colCache[key] = !gone;
    } catch (e) { colCache[key] = true; }        // lỗi mạng thì đừng dọa người dùng
    return colCache[key];
  }
  async function deleteOne(kind, id) {
    if (!enabled) return;
    const { error } = await client.from(KINDS[kind]).delete().eq('owner_id', chuGhi()).eq('id', id);   // chỉ dòng của chủ dữ liệu
    if (error) console.error('[del ' + kind + ']', error.message);
  }
  async function deleteAll() {
    if (!enabled) return;
    const iv = await client.from('onboarding_invites').delete().neq('id', '__never__');          // lời mời khách tự khai không có khóa ngoại tới tòa nhà
    if (iv.error && !isMissingTable(iv.error)) console.error('[deleteAll invites]', iv.error.message);
    // tuần tự cho chắc chắn (tránh xóa sót do chạy song song)
    for (const kind of Object.keys(KINDS)) {
      const { error } = await client.from(KINDS[kind]).delete().neq('id', '__never__');
      if (error) console.error('[deleteAll ' + kind + ']', error.message);
    }
    // Ảnh trong chat nằm ở bảng riêng (không có cột id): xóa theo mã tin, không để sót ảnh của khách sau khi xóa sạch dữ liệu
    const ph = await client.from(ANH_CHAT).delete().neq('message_id', '__never__');
    if (ph.error && !isMissingTable(ph.error)) console.error('[deleteAll ảnh chat]', ph.error.message);
  }
  // Xóa toàn bộ dữ liệu của 1 tòa nhà
  async function deleteByBuilding(bid) {
    if (!enabled) return;
    const scoped = ['rooms', 'tenants', 'contracts', 'services', 'readings', 'invoices', 'payments', 'assets', 'incidents', 'transactions', 'renewals', 'invoiceBatches'];
    for (const kind of scoped) {
      const { error } = await client.from(KINDS[kind]).delete().eq('building_id', bid);
      if (error && !isMissingTable(error)) console.error('[delByBuilding ' + kind + ']', error.message);
    }
    // lời mời khách tự khai của tòa này (ảnh CCCD đi theo qua khóa ngoại); chưa chạy migration-onboarding.sql thì bảng chưa có, bỏ qua
    const iv = await client.from('onboarding_invites').delete().eq('building_id', bid);
    if (iv.error && !isMissingTable(iv.error)) console.error('[delByBuilding invites]', iv.error.message);
    const { error } = await client.from('buildings').delete().eq('id', bid);
    if (error) console.error('[delByBuilding buildings]', error.message);
  }

  /* Đếm việc đang chờ (js/notify.js, js/notify-ui.js): chỉ hỏi SỐ dòng (HEAD + count), không tải dữ liệu, nên hỏi 30 giây một lần vẫn nhẹ.
     loai = các mã trong HH.baoViec.MA. Trả { data: { mã: số | null } }; loại nào lỗi thì null (không báo nhầm), bảng chưa tạo thì 0. */
  const DEM_VIEC = {
    tinNhan: (q) => q.from('support_messages').select('id', { count: 'exact', head: true }).eq('sender', 'tenant').eq('read_by_staff', false),
    chuyenKhoan: (q) => q.from('payment_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    // tiền về tài khoản (SePay) chưa ghi thu: tăng lên là có tiền mới về -> web tải về và tự khớp hóa đơn ngay (chỉ chủ trọ)
    tienVe: (q) => q.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('handled', false).gt('amount', 0),
    suCo: (q) => q.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    giaHan: (q) => q.from('renewal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    chiSo: (q) => q.from('readings').select('id', { count: 'exact', head: true }).eq('source', 'tenant').eq('approved', false),
    // khách quên mã: bảng yêu cầu khóa kín, chỉ đọc qua hàm owner_code_requests (danh sách ngắn, chỉ yêu cầu còn mở)
    xinMa: async (q) => { const { data, error } = await q.rpc('owner_code_requests'); return { count: Array.isArray(data) ? data.length : 0, error }; },
  };
  // Loại đếm trên bảng có cột building_id: nhân viên chỉ được giao vài tòa thì chỉ đếm việc của các tòa đó
  const DEM_THEO_TOA = { tinNhan: 1, chuyenKhoan: 1, suCo: 1, giaHan: 1, chiSo: 1 };
  /** o.toa = mảng mã tòa (nhân viên bị giới hạn tòa) hoặc null (tất cả) */
  async function demViec(loai, o) {
    if (!enabled || !client) return { error: { message: 'Chưa kết nối máy chủ' } };
    const ds = (loai || []).filter((k) => DEM_VIEC[k]), out = {};
    const toa = o && Array.isArray(o.toa) ? o.toa : null;
    let mang = 0;
    await Promise.all(ds.map(async (k) => {
      try {
        let q = DEM_VIEC[k](client);
        if (chuDuLieu && q && typeof q.eq === 'function') q = q.eq('owner_id', chuDuLieu);
        if (toa && DEM_THEO_TOA[k] && q && typeof q.in === 'function') q = q.in('building_id', toa);
        const { count, error } = await q;
        out[k] = error ? (isMissingTable(error) ? 0 : null) : (count || 0);
        if (error && !isMissingTable(error) && /fetch|network/i.test(error.message || '')) mang++;
      } catch (e) { out[k] = null; mang++; }
    }));
    // mọi loại đều hỏng vì mạng thì báo lỗi để giãn nhịp hỏi
    return ds.length && mang === ds.length ? { error: { message: 'Mất mạng' } } : { data: out };
  }

  // Gọi 1 hàm RPC bất kỳ (dùng cho bank_hook_secret, tenant_*...)
  async function rpc(name, args) {
    if (!enabled) return { error: { message: 'Chưa kết nối máy chủ' } };
    return client.rpc(name, args || {});
  }

  /* Đăng tin lên Trang Facebook qua Edge Function fb-post.
     Mã truy cập Trang nằm ở máy chủ; trình duyệt chỉ gửi nội dung + ảnh,
     kèm phiên đăng nhập (supabase-js tự gắn) để máy chủ biết ai đang đăng. */
  async function postFacebook(payload) {
    if (!enabled) return { error: { message: 'Chưa kết nối máy chủ' } };
    const { data, error } = await client.functions.invoke('fb-post', { body: payload });
    if (!error) return { data };
    let msg = error.message || 'Không gửi được';
    const res = error.context;                     // Response khi hàm trả mã lỗi
    if (res && typeof res.json === 'function') {
      if (res.status === 404) msg = 'Máy chủ chưa bật chức năng đăng Facebook (chưa triển khai hàm fb-post, xem FACEBOOK_SETUP.md).';
      else { try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {} }
    } else if (/fetch|network|relay/i.test(msg)) {
      msg = 'Không gọi được máy chủ đăng Facebook. Kiểm tra mạng, hoặc hàm fb-post chưa được triển khai.';
    }
    return { error: { message: msg } };
  }

  return { enabled, init, signUp, signIn, signOut, getSession, currentUserId, currentEmail, changePassword, updateDisplayName, findStaffByEmail, datChuDuLieu,
    loadAll, loadKind, loadSupportPhotos, saveSupportPhotos, saveMany, saveOne, hasColumn, primeSig, deleteOne, deleteAll, deleteByBuilding, rpc, postFacebook, demViec,
    client: () => client, KINDS };
})();

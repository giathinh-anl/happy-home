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
  let ownerId = null;

  // key trong bộ nhớ (store) -> tên bảng trong DB
  const KINDS = {
    buildings: 'buildings', rooms: 'rooms', tenants: 'tenants', contracts: 'contracts',
    services: 'services', readings: 'readings', invoices: 'invoices', payments: 'payments',
    assets: 'assets', incidents: 'incidents', transactions: 'transactions', staff: 'staff',
    claims: 'payment_claims', bankTx: 'bank_transactions', auditLog: 'audit_log',
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

  function jsToRow(kind, obj) {
    const alias = ALIAS[kind] || {};
    const row = { owner_id: ownerId, updated_at: new Date().toISOString() };
    Object.keys(obj).forEach((k) => {
      if (k === 'ownerId' || k === 'updatedAt') return;
      row[alias[k] || toSnake(k)] = obj[k];
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
  async function signOut() { try { await client.auth.signOut(); } catch (e) {} ownerId = null; }
  async function getSession() {
    const { data } = await client.auth.getSession();
    if (data.session) ownerId = data.session.user.id;
    return data.session;
  }
  function currentUserId() { return ownerId; }

  /** Tìm bản ghi nhân viên theo email đang đăng nhập (nếu người này được chủ trọ thêm vào) */
  async function findStaffByEmail(email) {
    if (!enabled || !email) return null;
    const { data, error } = await client.from('staff').select('*')
      .ilike('email', email).eq('status', 'active').limit(1);
    if (error) { if (!isMissingTable(error)) console.info('[staff lookup]', error.message); return null; }
    return (data && data[0]) ? rowToJs('staff', data[0]) : null;
  }

  /* ---------- Dữ liệu ---------- */
  // Trả về { data } khi thành công, hoặc { error } nếu tải lỗi (đã thử lại vài lần).
  // Không bao giờ trả dữ liệu trống một phần -> tránh nhầm "tài khoản rỗng" rồi tạo trùng.
  async function loadAll() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const out = {}; let failedMsg = null;
      for (const kind of Object.keys(KINDS)) {
        const { data, error } = await client.from(KINDS[kind]).select('*');
        if (error) {
          if (isMissingTable(error)) { out[kind] = []; continue; } // bảng chưa tạo -> rỗng
          failedMsg = '[load ' + kind + '] ' + error.message; break;
        }
        out[kind] = (data || []).map((r) => rowToJs(kind, r));
      }
      if (!failedMsg) return { data: out };
      console.warn('Tải dữ liệu lỗi (thử lại ' + (attempt + 1) + '/3):', failedMsg);
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    return { error: true };
  }
  async function saveMany(kind, arr) {
    if (!enabled || !arr || !arr.length) return { error: null };
    let rows = arr.map((o) => jsToRow(kind, o));
    // Thử lưu; nếu DB thiếu cột mới (chưa chạy migration) thì bỏ cột đó rồi thử lại
    for (let attempt = 0; attempt < 4; attempt++) {
      const { error } = await client.from(KINDS[kind]).upsert(rows, { onConflict: 'owner_id,id' });
      if (!error) return { error: null };
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
    const { error } = await client.from(KINDS[kind]).delete().eq('id', id);
    if (error) console.error('[del ' + kind + ']', error.message);
  }
  async function deleteAll() {
    if (!enabled) return;
    // tuần tự cho chắc chắn (tránh xóa sót do chạy song song)
    for (const kind of Object.keys(KINDS)) {
      const { error } = await client.from(KINDS[kind]).delete().neq('id', '__never__');
      if (error) console.error('[deleteAll ' + kind + ']', error.message);
    }
  }
  // Xóa toàn bộ dữ liệu của 1 tòa nhà
  async function deleteByBuilding(bid) {
    if (!enabled) return;
    const scoped = ['rooms', 'tenants', 'contracts', 'services', 'readings', 'invoices', 'payments', 'assets', 'incidents', 'transactions'];
    for (const kind of scoped) {
      const { error } = await client.from(KINDS[kind]).delete().eq('building_id', bid);
      if (error && !isMissingTable(error)) console.error('[delByBuilding ' + kind + ']', error.message);
    }
    const { error } = await client.from('buildings').delete().eq('id', bid);
    if (error) console.error('[delByBuilding buildings]', error.message);
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

  return { enabled, init, signUp, signIn, signOut, getSession, currentUserId, findStaffByEmail,
    loadAll, saveMany, saveOne, hasColumn, deleteOne, deleteAll, deleteByBuilding, rpc, postFacebook,
    client: () => client, KINDS };
})();

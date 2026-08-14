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
    assets: 'assets', incidents: 'incidents', transactions: 'transactions', auditLog: 'audit_log',
  };
  // field JS lệch quy tắc -> cột DB
  const ALIAS = {
    contracts: { start: 'start_date', end: 'end_date' },
    payments: { date: 'paid_date' },
    transactions: { date: 'tx_date' },
  };

  // Bảng chưa được tạo (chưa chạy migration) -> coi như rỗng, không làm hỏng cả luồng
  function isMissingTable(e) {
    if (!e) return false;
    const s = ((e.message || '') + ' ' + (e.code || '') + ' ' + (e.details || '')).toLowerCase();
    return e.code === '42p01' || e.code === 'pgrst205' ||
      s.includes('does not exist') || s.includes('schema cache') || s.includes('could not find the table');
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
    const rows = arr.map((o) => jsToRow(kind, o));
    const { error } = await client.from(KINDS[kind]).upsert(rows, { onConflict: 'owner_id,id' });
    if (error) {
      if (isMissingTable(error)) { console.info('Bảng ' + kind + ' chưa tạo — bỏ qua đồng bộ (chạy migration để bật).'); return { error: null }; }
      console.error('[save ' + kind + ']', error.message);
    }
    return { error };
  }
  async function saveOne(kind, obj) { return saveMany(kind, [obj]); }
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

  return { enabled, init, signUp, signIn, signOut, getSession, currentUserId,
    loadAll, saveMany, saveOne, deleteOne, deleteAll, KINDS };
})();

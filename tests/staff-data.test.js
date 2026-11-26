/* Nhân viên làm trên dữ liệu của CHỦ TRỌ + chỉ thấy các tòa được giao.
   Lỗi thật (thấy trên máy chủ thật 26/11): dòng nhân viên lưu mang owner_id = tài khoản của nhân viên; khóa là (owner_id, id) nên
   "sửa" một hóa đơn thành bản sao mang tên nhân viên, chủ trọ không thấy (máy chủ có 5 sự cố, 3 hóa đơn, 9 dòng nhật ký như vậy).
   Chạy thật js/backend.js trong vm với máy chủ supabase giả ghi lại từng lời gọi.  Chạy:  node tests/staff-data.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

/* ---- supabase giả: mỗi truy vấn ghi lại chuỗi lời gọi ---- */
function moMay(duLieu) {
  const goi = [];
  const bang = (ten) => {
    const q = { ten, buoc: [], dk: [] };
    const b = {
      select(c, o) { q.buoc.push(['select', c, o || null]); return b; },
      eq(c, v) { q.buoc.push(['eq', c, v]); q.dk.push((r) => r[c] === v); return b; },
      in(c, v) { q.buoc.push(['in', c, v]); q.dk.push((r) => v.includes(r[c])); return b; },
      gt(c, v) { q.buoc.push(['gt', c, v]); return b; },
      ilike(c, v) { q.buoc.push(['ilike', c, v]); q.dk.push((r) => String(r[c]).toLowerCase() === String(v).toLowerCase()); return b; },
      limit(n) { q.buoc.push(['limit', n]); return b; },
      order() { return b; },
      neq() { return b; },
      delete() { q.buoc.push(['delete']); return b; },
      upsert(rows, o) { q.buoc.push(['upsert', rows, o]); return b; },
      insert(rows) { q.buoc.push(['insert', rows]); return b; },
      then(res, rej) {
        goi.push(q);
        const ins = q.buoc.find((s) => s[0] === 'insert');
        if (ins && ins[1].some((r) => (duLieu.__trung || []).includes(r.id || r.message_id))) {
          return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }).then(res, rej);
        }
        const rows = (duLieu[ten] || []).filter((r) => q.dk.every((f) => f(r)));
        const laDem = q.buoc.some((s) => s[0] === 'select' && s[2] && s[2].head);
        return Promise.resolve(laDem ? { count: rows.length, error: null } : { data: rows, error: null }).then(res, rej);
      },
    };
    return b;
  };
  const client = {
    from: bang,
    rpc: async () => ({ data: [], error: null }),
    auth: {
      signInWithPassword: async ({ email }) => ({ data: { user: { id: 'uid-' + email.split('@')[0] } }, error: null }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({}),
    },
  };
  const ctx = { window: { HH_CONFIG: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } }, console,
    supabase: { createClient: () => client },
    HH: { dates: { chuoiNgay: (v) => v }, store: { isOwner: () => false } } };
  ctx.window.HH = ctx.HH;
  vm.createContext(ctx);
  vm.runInContext(doc('js/backend.js'), ctx);
  ctx.HH.backend.init();
  return { B: ctx.HH.backend, goi };
}
const DU_LIEU = {
  invoices: [{ owner_id: 'uid-chu', id: 'HD-2611-001', building_id: 'b1' }, { owner_id: 'uid-nv', id: 'HD-2611-001', building_id: 'b1' }],   // dòng 2: bản sao cũ mang tên nhân viên
  staff: [{ owner_id: 'uid-chu', id: 'st1', email: 'nv@x.vn', status: 'active', building_ids: ['b3'], permissions: ['payments'] }],
  payment_claims: [{ owner_id: 'uid-chu', id: 'c1', building_id: 'b1', status: 'pending' }, { owner_id: 'uid-chu', id: 'c2', building_id: 'b3', status: 'pending' }],
};

test('tìm nhân viên theo email trả cả mã chủ trọ (ownerId) và phạm vi tòa', async () => {
  const { B } = moMay(DU_LIEU);
  const st = await B.findStaffByEmail('NV@x.vn');
  assert.strictEqual(st.ownerId, 'uid-chu');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.buildingIds)), ['b3']);
});
test('nhân viên LƯU: dòng mang owner_id của chủ trọ (không phải của nhân viên)', async () => {
  const { B, goi } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  await B.saveMany('invoices', [{ id: 'HD-2611-002', buildingId: 'b3', total: 1 }]);
  const up = goi.find((q) => q.ten === 'invoices' && q.buoc.some((s) => s[0] === 'upsert'));
  const rows = up.buoc.find((s) => s[0] === 'upsert')[1];
  assert.strictEqual(rows[0].owner_id, 'uid-chu');
  assert.strictEqual(B.currentUserId(), 'uid-nv', 'tài khoản đăng nhập vẫn là của nhân viên');
});
test('nhân viên TẢI: chỉ dòng của chủ trọ, bỏ các bản sao cũ mang tên nhân viên', async () => {
  const { B } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  const r = await B.loadKind('invoices');
  assert.strictEqual(r.data.length, 1);
  const all = await B.loadAll({ bo: ['bankTx'] });
  assert.strictEqual(all.data.invoices.length, 1);
});
test('nhân viên XÓA: chỉ xóa dòng của chủ trọ (có điều kiện owner_id)', async () => {
  const { B, goi } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  await B.deleteOne('invoices', 'HD-2611-001');
  const d = goi.find((q) => q.buoc.some((s) => s[0] === 'delete'));
  assert.ok(d.buoc.some((s) => s[0] === 'eq' && s[1] === 'owner_id' && s[2] === 'uid-chu'), JSON.stringify(d.buoc));
});
test('chủ trọ (không đặt chủ dữ liệu): ghi bằng tài khoản của mình, tải không thêm điều kiện', async () => {
  const { B, goi } = moMay(DU_LIEU);
  await B.signIn('chu@x.vn', 'x'); B.datChuDuLieu(null);
  await B.saveMany('invoices', [{ id: 'HD-2611-003', buildingId: 'b1' }]);
  const rows = goi.find((q) => q.buoc.some((s) => s[0] === 'upsert')).buoc.find((s) => s[0] === 'upsert')[1];
  assert.strictEqual(rows[0].owner_id, 'uid-chu');
  await B.loadKind('invoices');
  const tai = goi.filter((q) => q.ten === 'invoices' && q.buoc[0][0] === 'select').pop();
  assert.ok(!tai.buoc.some((s) => s[0] === 'eq'), 'chủ trọ tải không lọc thêm');
});
test('đăng xuất thì quên chủ dữ liệu (người đăng nhập sau, một chủ trọ khác, không ghi nhầm vào chủ cũ)', async () => {
  const { B, goi } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu'); await B.signOut();
  await B.signIn('khac@x.vn', 'x');
  await B.saveMany('invoices', [{ id: 'HD-2611-004', buildingId: 'b1' }]);
  const rows = goi.filter((q) => q.buoc.some((s) => s[0] === 'upsert')).pop().buoc.find((s) => s[0] === 'upsert')[1];
  assert.strictEqual(rows[0].owner_id, 'uid-khac');
});
test('đếm việc mới: nhân viên chỉ đếm việc của chủ và của các tòa được giao', async () => {
  const { B } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  const tatCa = await B.demViec(['chuyenKhoan']);
  const chiB3 = await B.demViec(['chuyenKhoan'], { toa: ['b3'] });
  assert.strictEqual(tatCa.data.chuyenKhoan, 2); assert.strictEqual(chiB3.data.chuyenKhoan, 1);
});

test('nhân viên lưu NHẬT KÝ bằng thêm thuần (máy chủ chỉ cho thêm); dòng đã có (trùng khóa) coi như xong; chủ trọ vẫn upsert', async () => {
  const { B, goi } = moMay(Object.assign({}, DU_LIEU, { __trung: ['lg-cu'] }));
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  const r = await B.saveMany('auditLog', [{ id: 'lg-moi', action: 'x' }, { id: 'lg-cu', action: 'y' }]);
  assert.strictEqual(r.error, null);
  const cac = goi.filter((q) => q.ten === 'audit_log');
  assert.ok(cac.every((q) => !q.buoc.some((s) => s[0] === 'upsert')), 'nhân viên không được upsert nhật ký');
  assert.ok(cac.some((q) => q.buoc.some((s) => s[0] === 'insert' && s[1].length === 1 && s[1][0].id === 'lg-moi')), 'dòng mới phải được thêm riêng sau khi gặp trùng');
  assert.strictEqual(cac.find((q) => q.buoc[0][0] === 'insert').buoc[0][1][0].owner_id, 'uid-chu');
  const m2 = moMay(DU_LIEU); await m2.B.signIn('chu@x.vn', 'x'); m2.B.datChuDuLieu(null);
  await m2.B.saveMany('auditLog', [{ id: 'lg-1', action: 'x' }]);
  assert.ok(m2.goi.some((q) => q.ten === 'audit_log' && q.buoc.some((s) => s[0] === 'upsert')), 'chủ trọ giữ upsert');
});
test('nhân viên gửi ẢNH trong tin nhắn bằng thêm thuần; chủ trọ vẫn upsert', async () => {
  const { B, goi } = moMay(DU_LIEU);
  await B.signIn('nv@x.vn', 'x'); B.datChuDuLieu('uid-chu');
  const r = await B.saveSupportPhotos('ms-1', ['data:image/jpeg;base64,AAAA']);
  assert.ok(r.ok);
  const q = goi.find((x) => x.ten === 'support_message_photos');
  assert.strictEqual(q.buoc[0][0], 'insert'); assert.strictEqual(q.buoc[0][1][0].owner_id, 'uid-chu');
  const m2 = moMay(DU_LIEU); await m2.B.signIn('chu@x.vn', 'x');
  await m2.B.saveSupportPhotos('ms-1', ['data:image/jpeg;base64,AAAA']);
  assert.strictEqual(m2.goi.find((x) => x.ten === 'support_message_photos').buoc[0][0], 'upsert');
});
test('tìm nhân viên: ưu tiên dòng đang làm; chỉ có dòng đã khóa thì trả dòng đó (để báo "bị khóa")', async () => {
  const khoa = { staff: [{ owner_id: 'uid-chu', id: 'st9', email: 'nv@x.vn', status: 'disabled', building_ids: [], permissions: [] }] };
  const a = moMay(khoa); assert.strictEqual((await a.B.findStaffByEmail('nv@x.vn')).status, 'disabled');
  const b = moMay({ staff: khoa.staff.concat([{ owner_id: 'uid-khac', id: 'st1', email: 'nv@x.vn', status: 'active', building_ids: [], permissions: [] }]) });
  const st = await b.B.findStaffByEmail('nv@x.vn'); assert.strictEqual(st.status, 'active'); assert.strictEqual(st.ownerId, 'uid-khac');
});

/* ---- phía store / giao diện (đối chiếu mã; hành vi thật đã bấm thử bằng trình duyệt) ---- */
const more = doc('js/pages/more.js'), auth = doc('js/pages/auth-dashboard.js'), notify = doc('js/notify.js');
test('nhân viên bị khóa: đăng nhập thì báo khóa và không cho vào (trừ khi email đó cũng là chủ trọ có tòa riêng)', () => {
  const k = store.slice(store.indexOf('async onSignedIn(user)'), store.indexOf('async onSignedIn(user)') + 1400);
  assert.match(k, /if \(st && st\.status !== 'active'\) \{/);
  assert.match(k, /if \(rieng\.data && rieng\.data\.length\) st = null;/);
  assert.match(k, /return 'locked';/);
  assert.match(auth, /if \(outcome === 'locked'\) \{ unlock\(\); showErr\('Tài khoản nhân viên của bạn đang bị chủ trọ khóa/);
  assert.match(app, /if \(kq === 'locked'\)/);
});
test('tải lại: nhân viên bị khóa / xóa thì đăng xuất ngay; đổi quyền hay tòa thì áp dụng ngay, TRƯỚC khi lọc theo tòa', () => {
  const k = store.slice(store.indexOf('async refreshFromServer()'), store.indexOf('/* ---------- Ngoại tuyến'));
  assert.match(k, /const toi = res0\.data\.staff\.find\(s => s\.id === prefs\.staffId\);/);
  assert.match(k, /if \(!toi \|\| toi\.status !== 'active'\) \{\s*api\.logout\(\);/);
  assert.ok(k.indexOf('prefs.buildingIds = t.slice()') < k.indexOf('locTheoToa(res0.data)'));
  assert.match(k, /\|\| doiQuyen, tuGhi \}/);
});
test('đánh số khi máy chủ đã chặn theo tòa: hỏi nv_ma_da_dung (chỉ mã) rồi gộp vào mã của tòa ẩn', () => {
  assert.match(store, /HH\.backend\.rpc\('nv_ma_da_dung', \{ p_owner: prefs\.ownerId \}\)/);
  assert.ok((store.match(/await napMaDaDung\(\);/g) || []).length >= 2, 'phải gọi cả lúc đăng nhập và lúc tải lại');
});
test('tin nhắn khách: nhân viên được báo (quyền Khách thuê); tin nhận thêm chỉ của tòa được giao', () => {
  assert.match(notify, /\{ ma: 'tinNhan', quyen: 'tenants', ten:/);
  assert.match(store, /rows\.forEach\(r => \{ if \(r && r\.id && !seen\.has\(r\.id\) && \(!co \|\| co\.has\(r\.buildingId\)\)\)/);
});
test('xóa tòa nhà: chỉ chủ trọ (nút chỉ hiện cho chủ, hàm xóa cũng chặn)', () => {
  assert.match(store, /async removeBuilding\(id\) \{\s*if \(!api\.isOwner\(\)\) return;/);
  assert.match(more, /\$\{raw\(laChu \? `<div class="card" style="border-color:#fecaca/);
  assert.match(more, /const xoaToa = document\.getElementById\('delBuilding'\);[^\n]*\n\s*if \(xoaToa\) xoaToa\.onclick/);
});
test('quyền liên quan tiền bạc / cấu hình ghi "Hạn chế" (không còn chữ "Nhạy cảm")', () => {
  assert.ok(!/Nhạy cảm/.test(more)); assert.match(more, />Hạn chế<\/span>/);
});
const store = doc('js/store.js'), app = doc('js/app.js'), nui = doc('js/notify-ui.js');
test('đăng nhập: nhân viên đặt chủ dữ liệu = chủ trọ, chủ trọ đặt null, TRƯỚC khi tải', () => {
  const i = store.indexOf('async onSignedIn(user)'), k = store.slice(i, i + 2600);
  assert.match(k, /prefs\.buildingIds = Array\.isArray\(st\.buildingIds\) \? st\.buildingIds\.slice\(\) : \[\];/);
  assert.match(k, /HH\.backend\.datChuDuLieu\(st \? st\.ownerId : null\)/);
  assert.ok(k.indexOf('datChuDuLieu') < k.indexOf('HH.backend.loadAll'));
  assert.match(k, /const res = \{ data: locTheoToa\(res0\.data\) \};/);
});
test('tải lại cũng lọc theo tòa; đánh số hóa đơn / phiếu thu tính cả mã của tòa bị ẩn', () => {
  const k = store.slice(store.indexOf('async refreshFromServer()'), store.indexOf('/* ---------- Ngoại tuyến'));
  assert.match(k, /const res = \{ data: locTheoToa\(res0\.data\) \};/);
  assert.match(store, /soLonNhat\(invoices\.map\(i => i\.id\)\.concat\(soAn\.hd\), pre\)/);
  assert.match(store, /soLonNhat\(payments\.map\(p => p\.receiptNo \|\| ''\)\.concat\(soAn\.pt\), pre \+ '-'\)/);
});
test('nhân viên không gửi bảng nhân viên / giao dịch ngân hàng lên máy chủ', () => {
  assert.match(store, /if \(prefs\.role !== 'owner' && \(k === 'staff' \|\| k === 'bankTx'\)\) continue;/);
});
test('mở đường dẫn tới tòa không được giao: về danh sách tòa (tòa đó không có trong máy); báo việc mới chỉ đếm tòa được giao', () => {
  assert.match(doc('js/router.js'), /if \(m\.params\.bid && !HH\.store\.building\(m\.params\.bid\)\) \{ location\.hash = '\/buildings'; return; \}/);
  assert.match(nui, /HH\.backend\.demViec\(loai, \{ toa: st\.phamViToa \? st\.phamViToa\(\) : null \}\)/);
});

/* ---- locTheoToa + soLonNhat chạy thật (cắt đúng đoạn mã trong store.js) ---- */
test('locTheoToa: chỉ giữ tòa được giao, nhớ mã hóa đơn / số phiếu thu của tòa bị ẩn; chủ trọ không lọc', () => {
  const dau = store.indexOf('  const phamViToa = ()'), cuoi = store.indexOf('  function replaceAll(data) {');
  const ctx = { prefs: { role: 'staff', buildingIds: ['b3'] } };
  vm.createContext(ctx);
  vm.runInContext(store.slice(dau, cuoi) + '\nthis.loc = locTheoToa; this.soAn = soAn; this.soLonNhat = soLonNhat;', ctx);
  const d = { buildings: [{ id: 'b1' }, { id: 'b3' }], invoices: [{ id: 'HD-2611-007', buildingId: 'b1' }, { id: 'HD-2611-002', buildingId: 'b3' }],
    payments: [{ id: 'p1', buildingId: 'b1', receiptNo: 'PT-2611-009' }, { id: 'p2', buildingId: 'b3', receiptNo: 'PT-2611-003' }],
    rooms: [{ id: 'r1', buildingId: 'b1' }, { id: 'r3', buildingId: 'b3' }], auditLog: [{ id: 'l1' }], staff: [{ id: 'st1' }] };
  const r = ctx.loc(d);
  assert.deepStrictEqual(r.buildings.map(x => x.id), ['b3']);
  assert.deepStrictEqual(r.invoices.map(x => x.id), ['HD-2611-002']);
  assert.deepStrictEqual(r.rooms.map(x => x.id), ['r3']);
  assert.strictEqual(r.auditLog.length, 0); assert.strictEqual(r.staff.length, 1);
  assert.deepStrictEqual(Array.from(ctx.soAn.hd), ['HD-2611-007']); assert.deepStrictEqual(Array.from(ctx.soAn.pt), ['PT-2611-009']);
  // mã kế tiếp phải vượt mã của tòa bị ẩn
  assert.strictEqual(ctx.soLonNhat(r.invoices.map(i => i.id).concat(ctx.soAn.hd), 'HD-2611-') + 1, 8);
  assert.strictEqual(ctx.soLonNhat(r.payments.map(p => p.receiptNo).concat(ctx.soAn.pt), 'PT-2611-') + 1, 10);
  ctx.prefs.role = 'owner';
  assert.strictEqual(ctx.loc(d), d, 'chủ trọ: không lọc');
  assert.strictEqual(ctx.soAn.hd.length, 0);
  ctx.prefs.role = 'staff'; ctx.prefs.buildingIds = [];
  assert.strictEqual(ctx.loc(d), d, 'nhân viên không giới hạn tòa: không lọc');
});
test('đã nâng phiên bản các tệp đổi', () => {
  const html = doc('index.html'), v = (f) => +new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=(\\d+)').exec(html)[1];
  assert.ok(v('js/backend.js') >= 120 && v('js/store.js') >= 121 && v('js/notify-ui.js') >= 3 && v('pages/more.js') >= 119 && v('js/notify.js') >= 6 && v('js/app.js') >= 116 && v('pages/auth-dashboard.js') >= 113);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

/* Link riêng cho nhân viên ("?nv") + chủ trọ tạo tài khoản đăng nhập cho nhân viên ngay.
   Lỗi bạn chủ trọ báo 27/11: chủ trọ và nhân viên dùng chung một link nên chung một phiên đăng nhập trong trình duyệt; bấm F5 là nhảy vai.
   Chạy thật js/backend.js trong vm với supabase giả.  Chạy:  node tests/staff-link.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

function moBackend(search, signUpKq) {
  const taoRa = [];
  const supabase = { createClient: (url, key, o) => { const c = { o, auth: {
    signUp: async (x) => { c.dangKy = x; return signUpKq || { data: { user: { identities: [{}] }, session: {} }, error: null }; },
    signOut: async () => { c.daThoat = true; }, getSession: async () => ({ data: { session: null } }) }, from: () => ({}) }; taoRa.push(c); return c; } };
  const ctx = { window: { HH_CONFIG: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } }, console, supabase,
    location: { search, href: 'https://giathinh-anl.github.io/happy-home/' + search + '#/b/b1/units' }, URL, HH: {} };
  ctx.window.HH = ctx.HH;
  vm.createContext(ctx);
  vm.runInContext(doc('js/backend.js'), ctx);
  ctx.HH.backend.init();
  return { B: ctx.HH.backend, taoRa };
}

test('link chủ trọ (không ?nv): phiên đăng nhập cất ở chỗ mặc định như cũ', () => {
  const { B, taoRa } = moBackend('');
  assert.strictEqual(B.LINK_NV, false);
  assert.strictEqual(taoRa[0].o.auth.storageKey, undefined);
});
test('link nhân viên (?nv): phiên đăng nhập cất ở khóa riêng, không đè phiên của chủ trọ', () => {
  for (const s of ['?nv', '?nv=1', '?a=2&nv']) {
    const { B, taoRa } = moBackend(s);
    assert.strictEqual(B.LINK_NV, true, s);
    assert.strictEqual(taoRa[0].o.auth.storageKey, 'hh-nhanvien-auth', s);
  }
  assert.strictEqual(moBackend('?nvx').B.LINK_NV, false, '?nvx không phải link nhân viên');
});
test('linkNhanVien(): đúng địa chỉ trang, thêm ?nv, mở thẳng trang đăng nhập', () => {
  const { B } = moBackend('');
  assert.strictEqual(B.linkNhanVien(), 'https://giathinh-anl.github.io/happy-home/?nv#/login');
});
test('cài đặt của web (vai trò, quyền...) cũng cất riêng ở link nhân viên', () => {
  const dong = doc('js/store.js').split('\n').find(l => l.includes('const PREFS_KEY'));
  assert.ok(dong.includes("/[?&]nv(?:[=&]|$)/.test(") && dong.includes("? 'hh_prefs_nv_v1' : 'hh_prefs_v1'"), dong);
});
test('tạo tài khoản nhân viên: dùng kết nối TẠM không lưu phiên (phiên chủ trọ không đổi), đăng ký đúng email / mật khẩu / tên', async () => {
  const { B, taoRa } = moBackend('');
  const r = await B.taoTaiKhoanNhanVien('nv@x.vn', 'matkhau123', 'Nhân Viên A');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r)), { ok: true });
  const tam = taoRa[1];
  assert.ok(tam && tam !== taoRa[0], 'phải là kết nối mới');
  assert.strictEqual(tam.o.auth.persistSession, false);
  assert.strictEqual(tam.dangKy.email, 'nv@x.vn'); assert.strictEqual(tam.dangKy.password, 'matkhau123');
  assert.strictEqual(tam.dangKy.options.data.full_name, 'Nhân Viên A');
  assert.ok(tam.daThoat, 'phải thoát phiên tạm');
});
test('tạo tài khoản: email đã có tài khoản / cần xác nhận email / mật khẩu yếu báo đúng', async () => {
  const a = moBackend('', { data: null, error: { message: 'User already registered' } });
  assert.ok((await a.B.taoTaiKhoanNhanVien('a@x.vn', 'matkhau123')).daCo);
  const b = moBackend('', { data: { user: { identities: [] }, session: null }, error: null });
  assert.ok((await b.B.taoTaiKhoanNhanVien('a@x.vn', 'matkhau123')).daCo, 'Supabase trả người dùng không danh tính khi email đã có');
  const c = moBackend('', { data: { user: { identities: [{}] }, session: null }, error: null });
  assert.ok((await c.B.taoTaiKhoanNhanVien('a@x.vn', 'matkhau123')).canXacNhan);
  const d = moBackend('', { data: null, error: { message: 'Password should be at least 6 characters' } });
  assert.match((await d.B.taoTaiKhoanNhanVien('a@x.vn', '1')).loi, /Mật khẩu/);
});
test('giao diện: hộp thêm nhân viên có "Mật khẩu ban đầu" (tối thiểu 8 ký tự); tạo lỗi thì chưa thêm nhân viên; trang nhóm có link nhân viên', () => {
  const m = doc('js/pages/more.js');
  assert.match(m, /id="nvPw" type="password" autocomplete="new-password"/);
  assert.match(m, /if \(pw && pw\.length < 8\) \{ baoPw\('Mật khẩu tối thiểu 8 ký tự'\)/);
  const k = m.slice(m.indexOf("tk = await HH.backend.taoTaiKhoanNhanVien"), m.indexOf("S.addStaff(Object.assign"));
  assert.match(k, /if \(tk\.loi\) \{[^}]*return; \}/, 'lỗi tạo tài khoản phải dừng trước khi thêm nhân viên');
  assert.match(m, /id="nvLink" readonly value="\$\{U\.esc\(HH\.backend\.linkNhanVien\(\)\)\}"/);
  assert.match(doc('js/pages/auth-dashboard.js'), /HH\.backend\.LINK_NV \? '<b>Trang dành cho nhân viên<\/b>/);
});
test('đã nâng phiên bản các tệp đổi', () => {
  const html = doc('index.html'), v = (f) => +new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=(\\d+)').exec(html)[1];
  assert.ok(v('js/backend.js') >= 122 && v('js/store.js') >= 123 && v('pages/more.js') >= 120 && v('pages/auth-dashboard.js') >= 114);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

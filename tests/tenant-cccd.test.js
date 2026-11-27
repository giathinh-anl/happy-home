/* Khách tự gửi ảnh CCCD từ app khách (Tài khoản → Giấy tờ tùy thân) + chủ trọ xem ảnh trong hồ sơ khách; bỏ hẳn điểm thưởng.
   Bạn chủ trọ báo 27/11: "úp CCCD của khách ... bên khách không có"; chủ trọ bảo xóa luôn điểm thưởng.
   Chạy:  node tests/tenant-cccd.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

function moBackend(kq) {
  const goi = [];
  const q = { _f: [], select(c) { goi.push(['select', c]); return q; }, eq(k, v) { goi.push(['eq', k, v]); return q; },
    then(res, rej) { return Promise.resolve(kq).then(res, rej); } };
  const supabase = { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) }, from: (b) => { goi.push(['from', b]); return q; } }) };
  const ctx = { window: { HH_CONFIG: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' } }, console, supabase,
    location: { search: '', href: 'https://x/' }, URL, HH: {} };
  ctx.window.HH = ctx.HH;
  vm.createContext(ctx);
  vm.runInContext(doc('js/backend.js'), ctx);
  ctx.HH.backend.init();
  return { B: ctx.HH.backend, goi };
}
const JS = (o) => JSON.parse(JSON.stringify(o));

test('chủ trọ tải ảnh CCCD của MỘT khách, đúng chủ dữ liệu, tách mặt trước / mặt sau', async () => {
  const { B, goi } = moBackend({ data: [{ kind: 'cccd_back', data: 'data:image/jpeg;base64,BB', created_at: '2026-11-27T03:00:00Z' },
    { kind: 'cccd_front', data: 'data:image/jpeg;base64,AA', created_at: '2026-11-26T03:00:00Z' }], error: null });
  B.datChuDuLieu('chu-1');
  const r = JS(await B.anhCccdKhach('tn1'));
  assert.deepStrictEqual(r.data.front, { data: 'data:image/jpeg;base64,AA', luc: '2026-11-26T03:00:00Z' });
  assert.strictEqual(r.data.back.data, 'data:image/jpeg;base64,BB');
  assert.deepStrictEqual(JS(goi), [['from', 'tenant_docs'], ['select', 'kind, data, created_at'], ['eq', 'owner_id', 'chu-1'], ['eq', 'tenant_id', 'tn1']]);
});
test('máy chủ chưa chạy migration: báo missing, không văng lỗi', async () => {
  const { B } = moBackend({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.tenant_docs' in the schema cache" } });
  assert.deepStrictEqual(JS(await B.anhCccdKhach('tn1')), { data: {}, missing: true });
  assert.deepStrictEqual(JS(await B.anhCccdKhach('')), { data: {} }, 'không có mã khách thì không gọi');
});
test('hồ sơ khách: chỗ ảnh CCCD có data-cccd, tải ảnh khi mở; chỉ nhận ảnh hợp lệ vào src', () => {
  const t = doc('js/pages/tenants.js');
  assert.match(t, /data-cccd="front">/); assert.match(t, /data-cccd="back">/);
  assert.match(t, /onMount\(el\) \{ if \(HH\.backend && HH\.backend\.enabled && HH\.backend\.anhCccdKhach\) hienAnhCccd\(el, t\); \}/);
  const h = t.slice(t.indexOf('async function hienAnhCccd'), t.indexOf('/* ---------------- Thêm khách thuê (OCR)'));
  assert.ok(h.indexOf("/^data:image\\/(jpeg|png|webp);base64,/.test(o.data)") > 0 && h.indexOf('/^data:image') < h.indexOf('<img src='), 'phải kiểm dạng ảnh trước khi đưa vào src');
});

/* ---- app khách ---- */
const tj = doc('tenant-app/js/tenant.js');
const sql = doc('supabase/migration-tenant-self.sql');
test('app khách: tải trạng thái đã nộp từ tenant_cccd_status cùng lúc với dữ liệu khác; hàm chưa có thì thôi hỏi', () => {
  assert.match(tj, /loadCccd\(\)\.then\(c => \{ if \(c\) data\.cccd = c; \}\)/);
  assert.match(tj, /client\.rpc\('tenant_cccd_status', \{ p_token: state\.token \}\)/);
  assert.match(tj, /if \(rpcMissing\(r\.error\)\) noCccd = true; return undefined;/);
});
test('app khách: màn Tài khoản có khung Giấy tờ tùy thân, hai mặt, mỗi mặt một nút chụp / chọn ảnh', () => {
  const a = tj.slice(tj.indexOf('function screenAccount'), tj.indexOf('function screenChangeCode'));
  assert.match(a, /<div class="t-card" id="cccdCard">\$\{cccdHtml\(\)\}<\/div>/);
  assert.match(a, /noiCccd\(\);/);
  assert.match(tj, /const MAT_CCCD = \[\['front', 'Mặt trước'\], \['back', 'Mặt sau'\]\];/);
  assert.match(tj, /<input type="file" accept="image\/\*" hidden data-cccd-in="\$\{k\}"/);
});
test('app khách: luật ảnh hợp lệ GIỐNG HỆT máy chủ, giới hạn cỡ nhỏ hơn của máy chủ', () => {
  const re = /const ANH_HOP_LE = \/(.+)\/;/.exec(tj)[1];
  assert.strictEqual(re, '^data:image\\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$');
  assert.ok(sql.includes("p_data !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'"));
  assert.ok(sql.includes('length(p_data) > 700000'));
  assert.match(tj, /d\.length <= 690000 && ANH_HOP_LE\.test\(d\)/);
});
test('app khách: gửi đúng tên mặt, gửi xong mới đánh dấu đã nộp, lỗi báo tiếng Việt', () => {
  const g = tj.slice(tj.indexOf('async function guiCccd'), tj.indexOf('/* ---------- màn hình: ĐỔI MÃ VÀO APP'));
  assert.match(g, /rpc\('tenant_upload_cccd', \{ p_kind: k === 'front' \? 'cccd_front' : 'cccd_back', p_data: d \}\)/);
  assert.ok(g.indexOf("if (!r.ok)") < g.indexOf('state.data.cccd = '), 'chỉ đánh dấu đã nộp khi máy chủ báo ok');
  assert.match(g, /NOT_ACTIVATED' \? 'Hệ thống chưa bật chức năng gửi CCCD/);
  ['bad_image', 'too_big', 'bad_kind'].forEach(k => assert.ok(new RegExp(k + ': \'').test(tj), 'thiếu câu báo ' + k));
});
test('máy chủ: hai hàm của khách cho anon gọi, bảng ảnh không cho anon đọc', () => {
  assert.match(sql, /grant execute on function public\.tenant_upload_cccd\(text, text, text\) to anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.tenant_cccd_status\(text\) to anon, authenticated;/);
  assert.match(sql, /revoke all on public\.tenant_docs from anon;/);
  assert.ok(!/\bdrop table\b|\bdelete from\b|\btruncate\b/i.test(sql), 'migration không được xóa dữ liệu');
});

/* ---- bỏ điểm thưởng ---- */
test('đã bỏ hẳn điểm thưởng: không còn tệp, không còn nút, không còn hàm trong store', () => {
  ['js/rewards.js', 'js/pages/rewards.js', 'tests/rewards.test.js'].forEach(f => assert.ok(!fs.existsSync(path.join(__dirname, '..', f)), 'còn ' + f));
  const html = doc('index.html');
  assert.ok(!/rewards\.js/.test(html));
  assert.ok(!/rewardsUI|tnReward|data-reward|Điểm thưởng/.test(doc('js/pages/tenants.js')));
  assert.ok(!/rewardConfig|rewardOf|redeemReward|HH\.rewards/.test(doc('js/store.js')));
  assert.ok(!/\.rw-/.test(doc('css/pages.css')));
  assert.ok(!/rewards/.test(doc('build-demo.py')));
});
test('đã nâng phiên bản các tệp đổi', () => {
  const html = doc('index.html'), v = (f) => +new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=(\\d+)').exec(html)[1];
  assert.ok(v('js/backend.js') >= 123 && v('js/store.js') >= 124 && v('pages/tenants.js') >= 120);
  const th = doc('tenant-app/index.html');
  assert.ok(+/tenant\.js\?v=(\d+)/.exec(th)[1] >= 57 && +/tenant\.css\?v=(\d+)/.exec(th)[1] >= 56);
  assert.ok(+/hh-tenant-v(\d+)/.exec(doc('tenant-app/sw.js'))[1] >= 38);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

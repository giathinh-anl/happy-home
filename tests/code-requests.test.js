/* Kiểm thử phần "khách quên mã, xin cấp lại mã vào app" phía web chủ trọ: khung riêng ở đầu trang Khách thuê,
   cấp mã xong thì yêu cầu tự hết, bỏ qua được, và thông báo đẩy khi khách vừa xin (đối chiếu mã nguồn; SQL ở tests/db/owner-push.test.py,
   phần chạy thật đã thử bằng trình duyệt).  Chạy:  node tests/code-requests.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const tn = doc('js/pages/tenants.js'), store = doc('js/store.js'), ta = doc('js/pages/tenant-access.js'), sql = doc('supabase/migration-owner-push.sql'), html = doc('index.html');

test('trang Khách thuê: khung khách quên mã chỉ cho chủ trọ, chỉ yêu cầu của đúng tòa, đứng trước mọi thứ khác', () => {
  assert.match(tn, /const xin = S\.isOwner\(\) && S\.codeRequests \? S\.codeRequests\(\)\.filter\(r => r\.buildingId === ctx\.bid\) : \[\];/);
  const i = tn.indexOf('${raw(xinHtml)}'), j = tn.indexOf('${raw(cho ?');
  assert.ok(i > 0 && i < j, 'khung xin mã phải đứng trước khung khách tự khai');
});
test('mỗi khách một nút "Cấp mã mới" mở đúng hộp cấp mã của khách đó, và nút "Bỏ qua"', () => {
  assert.match(tn, /data-xinma="\$\{U\.esc\(r\.tenantId\)\}">Cấp mã mới</);
  assert.match(tn, /data-boquama="\$\{U\.esc\(r\.tenantId\)\}">Bỏ qua</);
  assert.match(tn, /const t = S\.tenantById\(b\.dataset\.xinma\);[\s\S]{0,200}HH\.tenantAccess\.dialog\(ctx, t\);/);
  assert.match(tn, /await S\.boQuaYeuCauMa\(b\.dataset\.boquama\)/);
});
test('chữ lấy từ máy chủ (tên, phòng, giờ) đều qua U.esc', () => {
  const k = tn.slice(tn.indexOf('const xinHtml'), tn.indexOf("` : '';", tn.indexOf('const xinHtml')));
  assert.match(k, /U\.esc\(r\.name \|\| 'Khách'\)/); assert.match(k, /U\.esc\(r\.roomCode \|\| ''\)/); assert.match(k, /U\.esc\(luc\(r\.requestedAt\)\)/);
  assert.ok(!/\$\{r\.(name|roomCode|tenantId|requestedAt)\}/.test(k), 'còn chữ thô');
});
test('cấp mã (một khách hay cả tòa) xong thì yêu cầu của khách đó tự hết trong máy', () => {
  assert.match(ta, /if \(v && S\.xongYeuCauMa\) S\.xongYeuCauMa\(id\);/);
  assert.match(ta, /if \(S\.xongYeuCauMa\) S\.xongYeuCauMa\(c\.tenantId\);/);
  assert.match(store, /xongYeuCauMa\(tenantId\) \{ codeReqs = codeReqs\.filter\(r => r\.tenantId !== tenantId\); \}/);
});
test('bỏ qua: chỉ chủ trọ, gọi owner_dismiss_code_requests, máy chủ lỗi thì không xóa trong máy', () => {
  const k = store.slice(store.indexOf('async boQuaYeuCauMa'), store.indexOf('async boQuaYeuCauMa') + 700);
  assert.match(k, /if \(!usingBackend\(\) \|\| !api\.isOwner\(\)\) return \{ ok: false/);
  assert.match(k, /rpc\('owner_dismiss_code_requests', \{ p_tenant_id: tenantId \}\)/);
  assert.ok(k.indexOf("return { ok: false, loi: 'Máy chủ chưa bỏ") < k.indexOf('api.xongYeuCauMa(tenantId)'));
});
test('máy chủ: báo đẩy cho chủ trọ khi khách vừa xin cấp lại mã, mở trang Khách thuê của đúng tòa', () => {
  assert.match(sql, /create trigger owner_push_on_code_request after insert on public\.tenant_code_requests for each row execute function public\._owner_push_on_code_request\(\);/);
  const k = sql.slice(sql.indexOf('function public._owner_push_on_code_request'), sql.indexOf('drop trigger if exists owner_push_on_code_request'));
  assert.match(k, /if auth\.uid\(\) is not null then return null; end if;/);
  assert.match(k, /public\._owner_push_url\(v_t\.building_id, 'tenants'\)/);
  assert.match(sql, /revoke execute on function public\._owner_push_on_code_request\(\) from public, anon, authenticated;/);
});
test('đã nâng số phiên bản các tệp đổi', () => {
  assert.ok(+/js\/today\.js\?v=(\d+)/.exec(html)[1] >= 103 && +/pages\/tenants\.js\?v=(\d+)/.exec(html)[1] >= 118 && +/pages\/tenant-access\.js\?v=(\d+)/.exec(html)[1] >= 104);
  assert.ok(+/js\/store\.js\?v=(\d+)/.exec(html)[1] >= 118 && +/js\/backend\.js\?v=(\d+)/.exec(html)[1] >= 117 && +/js\/notify\.js\?v=(\d+)/.exec(html)[1] >= 3);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

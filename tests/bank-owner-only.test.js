/* Giao dịch ngân hàng (SePay gửi về MỌI khoản tiền vào tài khoản, kể cả tiền riêng của chủ trọ) CHỈ chủ trọ thấy;
   web đang mở thì tiền mới về được tự khớp hóa đơn ngay (trước đây chỉ khớp lúc mở web / đăng nhập).
   Phần quyền trên máy chủ thử bằng Postgres thật ở tests/db/bank-owner-only.test.py; phần giao diện đã bấm thử bằng trình duyệt.
   Chạy:  node tests/bank-owner-only.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const store = doc('js/store.js'), be = doc('js/backend.js'), more = doc('js/pages/more.js'), help = doc('js/help.js'), ai = doc('js/ai.js');
const sqlCu = doc('supabase/migration-bank-reconcile.sql'), sqlMoi = doc('supabase/migration-bank-owner-only.sql'), html = doc('index.html');
const boChuThichSql = (s) => s.replace(/--[^\n]*/g, '');

test('máy chủ: tệp sửa gỡ quy tắc bank_tx_staff, không xóa dữ liệu', () => {
  assert.match(sqlMoi, /drop policy if exists "bank_tx_staff" on public\.bank_transactions;/);
  const lenh = boChuThichSql(sqlMoi);
  assert.ok(!/\b(delete|truncate|drop table|update)\b/i.test(lenh), 'tệp sửa chỉ được gỡ quy tắc');
});
test('máy chủ: tệp cũ chạy lại không tạo lại quyền cho nhân viên', () => {
  const lenh = boChuThichSql(sqlCu);
  assert.ok(!/create policy "bank_tx_staff"/.test(lenh), 'migration-bank-reconcile.sql vẫn tạo bank_tx_staff');
  assert.match(lenh, /drop policy if exists "bank_tx_staff" on public\.bank_transactions;/);
  assert.match(lenh, /create policy "bank_tx_own" on public\.bank_transactions\s+for all using \(owner_id = auth\.uid\(\)\) with check \(owner_id = auth\.uid\(\)\);/);
});
test('web: nhân viên không tải bảng giao dịch ngân hàng (cả lúc vào lẫn lúc tải lại)', () => {
  assert.match(store, /const khongTai = \(\) => prefs\.role === 'owner' \? \[\] : \['bankTx'\];/);
  const lan = store.match(/HH\.backend\.loadAll\([^\n;]*\);/g) || [];
  assert.ok(lan.length >= 2 && lan.every(x => x === 'HH.backend.loadAll({ bo: khongTai() });'), 'mọi lần tải phải bỏ bankTx với nhân viên: ' + lan.join(', '));
  const k = be.slice(be.indexOf('async function loadAll(opts)'), be.indexOf('async function loadKind'));
  assert.match(k, /if \(bo\.has\(kind\)\) \{ out\[kind\] = \[\]; continue; \}/, 'loại bị bỏ phải không gọi máy chủ');
});
test('web: trang Khách chuyển khoản chỉ hiện tab và ô số liệu Đối soát ngân hàng cho chủ trọ', () => {
  const k = more.slice(more.indexOf('HH.pages.transfers = {'), more.indexOf('mount() {', more.indexOf('HH.pages.transfers = {')));
  assert.match(k, /const chu = S\.isOwner\(\);/);
  assert.match(k, /if \(!chu && trTab\.tab === 'bank'\) trTab\.tab = 'claims';/);
  assert.match(k, /const waiting = chu \? S\.unhandledBankTx\(\) : \[\];/);
  assert.match(k, /\$\{chu \? `<button data-trtab="bank"/);
  assert.match(k, /chu \? UI\.metricCard\(\{ label: 'Giao dịch NH chờ đối soát'/);
});
test('web: chỉ chủ trọ tự đối soát; trợ lý ảo và bài trợ giúp SePay không lộ cho nhân viên', () => {
  const k = store.slice(store.indexOf('autoReconcile(opts) {'), store.indexOf('autoReconcile(opts) {') + 300);
  assert.match(k, /if \(!api\.isOwner\(\)\) return out;/);
  assert.match(ai, /const bank = S\.unhandledBankTx && S\.isOwner\(\) \? S\.unhandledBankTx\(\) : \[\];/);
  assert.match(help, /id: 'nhan-tien-tu-dong'[^\n]*chuTro: true/);
});
test('tự động thật: tải lại lúc web đang mở cũng tự khớp hóa đơn và báo', () => {
  const k = store.slice(store.indexOf('async refreshFromServer()'), store.indexOf('/* ---------- Ngoại tuyến'));
  assert.match(k, /tuGhi = api\.autoReconcile\(\)\.done\.length/);
  assert.ok(k.indexOf('replaceAll(res.data)') < k.indexOf('api.autoReconcile()'), 'phải khớp SAU khi có dữ liệu mới');
  assert.ok(k.indexOf('api.autoReconcile()') < k.indexOf('await api.loadInvites()'), 'phải khớp TRƯỚC các lần hỏi máy chủ khác (chúng chậm/lỗi thì tiền về vẫn được ghi)');
  assert.match(k, /changed: before !== stamp\(\) \|\| !!gan \|\| tuGhi > 0/);
  assert.match(k, /bankTx\.length, bankTx\.filter\(t => t\.handled\)\.length/);
});
test('đã nâng phiên bản các tệp đổi', () => {
  const v = (f) => +new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=(\\d+)').exec(html)[1];
  assert.ok(v('js/backend.js') >= 118 && v('js/store.js') >= 119 && v('js/notify.js') >= 4 && v('pages/more.js') >= 117 && v('js/help.js') >= 116 && v('js/ai.js') >= 112);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

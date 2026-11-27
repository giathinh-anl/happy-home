/* Các lỗi bạn chủ trọ báo 27/11: tin nhân viên trả lời không tới khách, công nợ không khớp, nút tạm trú như hỏng, Zalo khi cấp mã,
   mất chữ đang gõ trong chat; trang Khách thuê ghi phòng / tòa. Phần máy chủ thử ở tests/db/chat-fix.test.py (Postgres thật);
   phần giao diện đã bấm thử bằng trình duyệt. Chạy:  node tests/fix-2711.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};
const tenant = doc('tenant-app/js/tenant.js'), store = doc('js/store.js'), backend = doc('js/backend.js'), support = doc('js/pages/support.js');
const rooms = doc('js/pages/rooms.js'), tenants = doc('js/pages/tenants.js'), access = doc('js/pages/tenant-access.js'), sql = doc('supabase/migration-chat-fix.sql');

test('app khách: hỏi tin nhân viên lùi mốc 10 phút (tin tới trễ / đồng hồ máy chậm không bị bỏ qua), tin đã hiện bỏ qua theo mã', () => {
  assert.match(tenant, /const moc = chat\.lastPull \? new Date\(Date\.parse\(chat\.lastPull\) - 10 \* 60000\)\.toISOString\(\) : null;/);
  assert.match(tenant, /rpc\('tenant_messages', \{ p_after: moc \}\)/);
  assert.match(tenant, /filter\(m => m\.sender === 'staff' && !chat\.seen\[m\.id\]\)/);
});
test('máy chủ: luôn trả tin nhân viên khách chưa đọc, trước khi đánh dấu đã đọc', () => {
  assert.match(sql, /or \(m\.sender = 'staff' and m\.read_by_tenant = false\)\);/);
  assert.ok(sql.indexOf('read_by_tenant = false));') < sql.indexOf('update public.support_messages'));
  assert.ok(!/\b(delete|drop|truncate)\b/i.test(sql.replace(/--[^\n]*/g, '')), 'tệp sửa không được xóa gì');
});
test('chat: chữ đang gõ không mất khi tin mới tới (app khách và trang Hỏi đáp)', () => {
  assert.match(tenant, /const cu = el\('chatIn'\), dangGo = cu \? cu\.value : '', dangTro = !!cu && document\.activeElement === cu;/);
  assert.match(tenant, /if \(dangGo\) \{ inp\.value = dangGo;/);
  assert.match(support, /const ta = document\.getElementById\('spText'\), dang = ta \? ta\.value : ''/);
  assert.match(support, /if \(ta2 && dang\) \{ ta2\.value = dang;/);
});
test('Hỏi đáp: gửi ngay, chỉ báo "Đã gửi" khi máy chủ nhận; bị từ chối thì báo đỏ kèm lý do', () => {
  assert.match(support, /const gui = await S\.guiTraLoi\(m\);\s*if \(gui\.loi\) UI\.toast\('Tin nhắn CHƯA tới khách: ' \+ gui\.loi, \{ type: 'danger', sticky: true \}\);\s*else UI\.toast\('Đã gửi cho khách'/);
  assert.match(store, /async guiTraLoi\(m\) \{[\s\S]{0,200}HH\.backend\.saveMany\('supportMsgs', \[m\]\)/);
});
test('nhân viên ghi nhật ký: bảng thiếu cột (audit_log không có updated_at) thì bỏ cột rồi thêm lại', () => {
  const k = backend.slice(backend.indexOf('async function chiThem'), backend.indexOf('async function chiThem') + 900);
  assert.match(k, /const thieu = !error \? null : missingColumn\(error\);/);
  assert.match(k, /delete c\[thieu\]/);
});
test('công nợ: thẻ tổng và nợ từng phòng cùng tính từ hóa đơn đã phát hành (bỏ nháp, đã hủy)', () => {
  const dau = store.indexOf('    roomDebt(r) {'), cuoi = store.indexOf('    roomsOf:', dau);
  const ctx = { invoices: [
    { buildingId: 'b1', roomCode: 'P1', status: 'issued', total: 100, paid: 30 },
    { buildingId: 'b1', roomCode: 'P1', status: 'draft', total: 500, paid: 0 },
    { buildingId: 'b1', roomCode: 'P2', status: 'overdue', total: 200, paid: 0 },
    { buildingId: 'b1', roomCode: 'P2', status: 'cancelled', total: 999, paid: 0 },
    { buildingId: 'b1', roomCode: 'P3', status: 'paid', total: 50, paid: 50 },
    { buildingId: 'b2', roomCode: 'P1', status: 'issued', total: 70, paid: 0 }], contracts: [], incidents: [] };
  vm.createContext(ctx);
  vm.runInContext('this.api = {' + store.slice(dau, cuoi) + '};', ctx);
  const tong = ctx.api.roomSummary('b1').debt;
  const cong = ['P1', 'P2', 'P3'].reduce((s, c) => s + ctx.api.roomDebt({ buildingId: 'b1', code: c }), 0);
  assert.strictEqual(tong, 270); assert.strictEqual(cong, 270);
  assert.ok(!/r\.debt/.test(rooms), 'trang Phòng còn dùng số room.debt ghi sẵn');
});
test('Khách thuê: ghi "Phòng số … · Tòa …" ở dòng khách, đầu nhóm, hộp chi tiết; tệp Excel có cột Tòa', () => {
  assert.match(tenants, /const noiO = \(t\) => \(t\.roomCode \? `Phòng số \$\{t\.roomCode\}` : 'Chưa gắn phòng'\) \+ \(tenToa\(t\.buildingId\) \? ` · Tòa \$\{tenToa\(t\.buildingId\)\}` : ''\);/);
  assert.match(tenants, /<label>Phòng \/ Tòa<\/label><div>\$\{noiO\(t\)\}/);
  assert.match(tenants, /\['Tòa', 'Phòng', 'Họ tên'/);
});
test('nút tạm trú: đúng tên "Chưa đăng ký tạm trú", bấm thì cuộn tới danh sách và báo đang lọc bao nhiêu khách', () => {
  assert.ok(!/Hết tạm trú\/Visa/.test(tenants.replace(/\/\*[\s\S]*?\*\//g, '')), 'nút còn tên cũ');
  assert.match(tenants, /Chưa đăng ký tạm trú/);
  assert.match(tenants, /Đang lọc \$\{noTamtruCua\(ctx\)\} khách chưa đăng ký tạm trú/);
});
test('cấp mã: có Nhắn SMS soạn sẵn tin mời và lời giải thích khi Zalo báo "tài khoản không tồn tại"', () => {
  assert.match(access, /href="sms:\$\{U\.esc\(String\(t\.phone\)\.replace\(\/\\D\/g, ''\)\)\}\?&body=\$\{encodeURIComponent\(msg\)\}"/);
  assert.match(access, /Tài khoản không tồn tại hoặc không cho phép tìm kiếm/);
});
test('đã nâng phiên bản các tệp đổi', () => {
  const html = doc('index.html'), th = doc('tenant-app/index.html'), v = (s, f) => +new RegExp(f.replace(/[./]/g, '\\$&') + '\\?v=(\\d+)').exec(s)[1];
  assert.ok(v(html, 'js/store.js') >= 122 && v(html, 'js/backend.js') >= 121 && v(html, 'pages/rooms.js') >= 103 && v(html, 'pages/tenants.js') >= 119 && v(html, 'pages/tenant-access.js') >= 106 && v(html, 'pages/support.js') >= 117);
  assert.ok(v(th, 'js/tenant.js') >= 56 && +/hh-tenant-v(\d+)/.exec(doc('tenant-app/sw.js'))[1] >= 37);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

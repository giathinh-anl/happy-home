/* Kiểm thử sao lưu và khôi phục dữ liệu (js/backup.js) và việc nối vào app. Dữ liệu ở đây đều là dữ liệu giả.
   Chạy:  node tests/backup.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const B = require('../js/backup.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};

const mau = () => ({
  buildings: [{ id: 'b1', name: 'Tòa Mẫu', bankInfo: { bank: 'MB' } }],
  rooms: [{ id: 'r1', buildingId: 'b1', code: 'P101' }, { id: 'r2', buildingId: 'b1', code: 'P102' }],
  tenants: [{ id: 't1', name: 'Khách Giả', idNumber: '000000000000', phone: '0900000000' }],
  contracts: [{ id: 'hd1', roomCode: 'P101', start: '2026-01-01', end: '2027-01-01', terms: [{ title: 'A', body: 'B' }] }],
  invoices: [{ id: 'HD-2611-001', lines: [{ label: 'Tiền phòng', amount: 3000000 }], total: 3000000, paid: 0 }],
  payments: [], staff: [{ id: 's1', email: 'nv@example.com' }], auditLog: [{ id: 'lg1', message: 'x' }],
  supportMsgs: [{ id: 'm1', body: 'chào' }], bankTx: [{ id: 'bt1' }], claims: [{ id: 'c1' }], renewals: [{ id: 'rn1' }],
});
const vongTron = (duLieu) => B.docBanSao(JSON.stringify(B.taoBanSao(duLieu, { taoLuc: '2026-11-25T02:30:00.000Z', nguoiTao: 'Chủ Giả' })));

/* ============================================================
   Tạo bản sao lưu
   ============================================================ */
test('taoBanSao: có định dạng, phiên bản, ngày tạo, người tạo, đếm đúng từng loại; mọi loại đều có mảng', () => {
  const b = B.taoBanSao(mau(), { taoLuc: '2026-11-25T02:30:00.000Z', nguoiTao: 'Chủ Giả', cheDo: 'may-chu' });
  assert.strictEqual(b.dinhDang, 'happy-home-sao-luu'); assert.strictEqual(b.phienBan, 1);
  assert.strictEqual(b.taoLuc, '2026-11-25T02:30:00.000Z'); assert.strictEqual(b.nguoiTao, 'Chủ Giả'); assert.strictEqual(b.cheDo, 'may-chu');
  assert.strictEqual(b.soLuong.rooms, 2); assert.strictEqual(b.soLuong.payments, 0); assert.strictEqual(b.soLuong.transactions, 0);
  B.LOAI.forEach((l) => assert.ok(Array.isArray(b.duLieu[l.ma]), l.ma));
});
test('taoBanSao: là bản CHÉP, sửa dữ liệu gốc sau đó không làm đổi bản sao lưu (kể cả mảng con)', () => {
  const d = mau(), b = B.taoBanSao(d, {});
  d.rooms[0].code = 'ĐÃ SỬA'; d.invoices[0].lines[0].amount = 1; d.contracts[0].terms.push({});
  assert.strictEqual(b.duLieu.rooms[0].code, 'P101'); assert.strictEqual(b.duLieu.invoices[0].lines[0].amount, 3000000);
  assert.strictEqual(b.duLieu.contracts[0].terms.length, 1);
});
test('taoBanSao: dữ liệu thiếu, null, sai kiểu không làm hỏng', () => {
  [null, undefined, {}, { rooms: 'abc' }, { rooms: [null, 5, 'x', { id: 'r9' }] }].forEach((d) => {
    const b = B.taoBanSao(d, null);
    assert.strictEqual(b.taoLuc, null); B.LOAI.forEach((l) => assert.ok(Array.isArray(b.duLieu[l.ma])));
  });
  assert.strictEqual(B.taoBanSao({ rooms: [null, 5, { id: 'r9' }] }).soLuong.rooms, 1);
});
test('tenTep: theo ngày giờ máy, có đuôi .json', () => {
  assert.strictEqual(B.tenTep(new Date(2026, 10, 5, 9, 3)), 'happy-home-sao-luu-2026-11-05-0903.json');
  assert.match(B.tenTep(new Date('xyz')), /^happy-home-sao-luu-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
});

/* ============================================================
   Đọc tệp
   ============================================================ */
test('docBanSao: đọc lại đúng bản vừa tạo (vòng tròn), giữ nguyên nội dung', () => {
  const r = vongTron(mau());
  assert.ok(r.ok); assert.deepStrictEqual(r.hong, {}); assert.deepStrictEqual(r.la, []);
  assert.deepStrictEqual(r.banSao.duLieu.contracts, mau().contracts);
  assert.strictEqual(r.banSao.taoLuc, '2026-11-25T02:30:00.000Z'); assert.strictEqual(r.banSao.nguoiTao, 'Chủ Giả');
});
test('docBanSao: tệp trống, không phải JSON, JSON khác app, thiếu phần dữ liệu, thiếu phiên bản thì báo lỗi dễ hiểu', () => {
  const sai = ['', '   ', 'abc', '{', '[]', '123', 'null', JSON.stringify({ a: 1 }), JSON.stringify({ dinhDang: 'khac', phienBan: 1, duLieu: {} }),
    JSON.stringify({ dinhDang: 'happy-home-sao-luu', phienBan: 1 }), JSON.stringify({ dinhDang: 'happy-home-sao-luu', phienBan: 1, duLieu: [] }),
    JSON.stringify({ dinhDang: 'happy-home-sao-luu', duLieu: {} }), JSON.stringify({ dinhDang: 'happy-home-sao-luu', phienBan: 'x', duLieu: {} })];
  sai.forEach((s) => { const r = B.docBanSao(s); assert.strictEqual(r.ok, false, s); assert.ok(r.loi && r.loi.length > 5, s); });
  [null, undefined, 5, {}].forEach((s) => assert.strictEqual(B.docBanSao(s).ok, false));
});
test('docBanSao: bản từ phiên bản app mới hơn thì nhắc tải lại trang', () => {
  const r = B.docBanSao(JSON.stringify({ dinhDang: 'happy-home-sao-luu', phienBan: 2, duLieu: {} }));
  assert.strictEqual(r.ok, false); assert.match(r.loi, /mới hơn/);
});
test('docBanSao: nhận tệp có BOM đầu tệp (lưu lại bằng Notepad)', () => {
  const s = '﻿' + JSON.stringify(B.taoBanSao(mau(), {}));
  assert.ok(B.docBanSao(s).ok);
});
test('docBanSao: tệp quá lớn bị từ chối trước khi đọc', () => {
  const r = B.docBanSao('x'.repeat(60 * 1024 * 1024 + 1));
  assert.strictEqual(r.ok, false); assert.match(r.loi, /quá lớn/);
});
test('docBanSao: bỏ mục không có mã, mã rỗng, mã trùng trong tệp, mục không phải đối tượng; đếm số mục bỏ', () => {
  const b = B.taoBanSao({}, {});
  b.duLieu.rooms = [{ id: 'r1' }, { id: '' }, { code: 'x' }, { id: 'r1', code: 'trùng' }, null, 'abc', { id: '   ' }, { id: 7 }];
  b.duLieu.tenants = 'không phải mảng';
  const r = B.docBanSao(JSON.stringify(b));
  assert.ok(r.ok); assert.deepStrictEqual(r.banSao.duLieu.rooms.map((x) => x.id), ['r1', 7]);
  assert.strictEqual(r.hong.rooms, 6); assert.strictEqual(r.hong.tenants, 1); assert.deepStrictEqual(r.banSao.duLieu.tenants, []);
});
test('docBanSao: loại dữ liệu lạ bị bỏ qua và được liệt kê; trường có tên lạ hoặc nguy hiểm bị bỏ', () => {
  const s = '{"dinhDang":"happy-home-sao-luu","phienBan":1,"duLieu":{"hackers":[{"id":"h"}],"rooms":[{"id":"r1","code":"P1","__proto__":{"isOwner":true},"constructor":1,"x y":2,"1abc":3,"' + 'a'.repeat(70) + '":4}]}}';
  const r = B.docBanSao(s);
  assert.ok(r.ok); assert.deepStrictEqual(r.la, ['hackers']); assert.strictEqual(r.banSao.duLieu.hackers, undefined);
  assert.deepStrictEqual(Object.keys(r.banSao.duLieu.rooms[0]), ['id', 'code']);
  assert.strictEqual(({}).isOwner, undefined, 'không được làm bẩn Object.prototype');
  assert.strictEqual(Object.getPrototypeOf(r.banSao.duLieu.rooms[0]), Object.prototype);
});
test('docBanSao: người tạo quá dài bị cắt, ngày tạo không phải chữ thì bỏ', () => {
  const b = B.taoBanSao({}, {}); b.nguoiTao = 'x'.repeat(500); b.taoLuc = { $gt: 1 };
  const r = B.docBanSao(JSON.stringify(b));
  assert.strictEqual(r.banSao.nguoiTao.length, 80); assert.strictEqual(r.banSao.taoLuc, null);
});

/* ============================================================
   So sánh và khôi phục: chỉ THÊM mục đã mất, không ghi đè, không xóa
   ============================================================ */
test('soSanh: đếm trong tệp / đang có / sẽ thêm theo mã; loại không khôi phục thì 0', () => {
  const r = vongTron(mau());
  const hienCo = mau(); hienCo.rooms = [{ id: 'r1', code: 'P101 ĐÃ SỬA' }]; hienCo.tenants = []; hienCo.staff = []; hienCo.auditLog = [];
  const ss = B.soSanh(hienCo, r.banSao), d = (ma) => ss.dong.find((x) => x.ma === ma);
  assert.deepStrictEqual([d('rooms').trongTep, d('rooms').daCo, d('rooms').thieu], [2, 1, 1]);
  assert.deepStrictEqual([d('tenants').thieu, d('contracts').thieu], [1, 0]);
  assert.strictEqual(d('staff').thieu, 0); assert.strictEqual(d('staff').khoiPhuc, false); assert.ok(d('staff').vi.length > 5);
  assert.strictEqual(d('auditLog').thieu, 0);
  assert.strictEqual(ss.tongThieu, 2);
});
test('mucCanThem: chỉ mục mất; mục đang có không bao giờ bị trả về (không ghi đè dù tệp khác đi)', () => {
  const r = vongTron(mau());
  const hienCo = mau(); hienCo.rooms = [{ id: 'r1', code: 'P101 ĐÃ SỬA' }]; hienCo.invoices = [];
  const them = B.mucCanThem(hienCo, r.banSao);
  assert.deepStrictEqual(Object.keys(them).sort(), ['invoices', 'rooms']);
  assert.deepStrictEqual(them.rooms.map((x) => x.id), ['r2']);
  assert.deepStrictEqual(them.invoices[0], mau().invoices[0]);
});
test('mucCanThem: không bao giờ thêm nhân viên, nhật ký, giao dịch ngân hàng, việc do khách gửi', () => {
  const r = vongTron(mau());
  const them = B.mucCanThem({}, r.banSao);
  ['staff', 'auditLog', 'bankTx', 'claims', 'renewals', 'supportMsgs'].forEach((k) => assert.strictEqual(them[k], undefined, k));
  assert.ok(them.buildings && them.rooms && them.tenants && them.contracts && them.invoices);
  B.LOAI.filter((l) => !l.khoiPhuc).forEach((l) => assert.ok(['staff', 'auditLog', 'bankTx', 'claims', 'renewals', 'supportMsgs'].includes(l.ma), l.ma));
});
test('mucCanThem: mã số và mã chữ cùng giá trị coi là một; đang có đủ thì không thêm gì', () => {
  const r = vongTron(mau());
  assert.deepStrictEqual(B.mucCanThem(mau(), r.banSao), {});
  assert.strictEqual(B.soSanh(mau(), r.banSao).tongThieu, 0);
  const b = B.taoBanSao({ rooms: [{ id: 7 }] }, {}), bs = B.docBanSao(JSON.stringify(b)).banSao;
  assert.deepStrictEqual(B.mucCanThem({ rooms: [{ id: '7' }] }, bs), {});
  assert.strictEqual(B.soSanh({ rooms: [{ id: '7' }] }, bs).tongThieu, 0);
  const bs2 = B.docBanSao(JSON.stringify(B.taoBanSao({ rooms: [{ id: '8' }] }, {}))).banSao;
  assert.strictEqual(B.soSanh({ rooms: [{ id: 8 }] }, bs2).tongThieu, 0);
  assert.deepStrictEqual(B.mucCanThem({ rooms: [{ id: 8 }] }, bs2), {});
});
test('mucCanThem: mục trả về là bản chép (sửa nó không đổi bản sao lưu)', () => {
  const r = vongTron(mau());
  const them = B.mucCanThem({}, r.banSao); them.contracts[0].terms[0].title = 'đổi';
  assert.strictEqual(r.banSao.duLieu.contracts[0].terms[0].title, 'A');
});
test('khôi phục rồi khôi phục lại cùng tệp thì lần hai không thêm gì (chạy lại nhiều lần được)', () => {
  const r = vongTron(mau()), hienCo = { rooms: [] };
  const them = B.mucCanThem(hienCo, r.banSao);
  Object.keys(them).forEach((k) => { hienCo[k] = (hienCo[k] || []).concat(them[k]); });
  assert.deepStrictEqual(B.mucCanThem(hienCo, r.banSao), {});
});
test('ngẫu nhiên 500 lần: sau khôi phục, mọi mã trong tệp (loại được khôi phục) đều có; không mục đang có nào bị đổi hay mất', () => {
  let hat = 7; const rnd = () => { hat = (hat * 1103515245 + 12345) % 2147483648; return hat / 2147483648; };
  for (let lan = 0; lan < 500; lan++) {
    const tep = {}, hienCo = {};
    B.LOAI.forEach((l) => {
      tep[l.ma] = []; hienCo[l.ma] = [];
      for (let i = 0; i < 6; i++) {
        if (rnd() < 0.6) tep[l.ma].push({ id: l.ma + i, v: 'tep' });
        if (rnd() < 0.5) hienCo[l.ma].push({ id: l.ma + i, v: 'dang-co' });
      }
    });
    const truoc = JSON.stringify(hienCo);
    const bs = B.docBanSao(JSON.stringify(B.taoBanSao(tep, {}))).banSao;
    const ss = B.soSanh(hienCo, bs), them = B.mucCanThem(hienCo, bs);
    const sau = JSON.parse(truoc);
    Object.keys(them).forEach((k) => { sau[k] = sau[k].concat(them[k]); });
    let n = 0;
    B.LOAI.forEach((l) => {
      const coSau = new Set(sau[l.ma].map((x) => x.id));
      if (l.khoiPhuc) tep[l.ma].forEach((x) => assert.ok(coSau.has(x.id), l.ma + ' thiếu ' + x.id));
      JSON.parse(truoc)[l.ma].forEach((x, i) => assert.deepStrictEqual(sau[l.ma][i], x));
      assert.strictEqual(new Set(sau[l.ma].map((x) => x.id)).size, sau[l.ma].length, 'trùng mã sau khôi phục');
      n += (them[l.ma] || []).length;
    });
    assert.strictEqual(n, ss.tongThieu);
  }
});

/* ============================================================
   Nối vào app: đối chiếu mã nguồn (phần chạy thật đã thử bằng trình duyệt)
   ============================================================ */
const html = doc('index.html'), store = doc('js/store.js'), more = doc('js/pages/more.js');
test('index.html nạp backup.js trước store.js', () => {
  const vt = (f) => html.indexOf('src="js/' + f);
  assert.ok(vt('backup.js') > 0 && vt('backup.js') < vt('store.js'));
});
test('danh sách loại trong backup.js khớp đúng các nhóm dữ liệu của store.js (thêm bảng mới mà quên sao lưu thì báo)', () => {
  const m = store.match(/const groups = \{([^}]+)\}/);
  const nhom = m[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
  assert.deepStrictEqual(B.LOAI.map((l) => l.ma).sort(), nhom);
});
test('chỉ chủ trọ: store kiểm isOwner ở cả tải và khôi phục; trang chỉ hiện thẻ sao lưu cho chủ', () => {
  const ham = (ten) => store.slice(store.indexOf(ten + '('), store.indexOf(ten + '(') + 400);
  assert.match(ham('banSaoLuu'), /if \(!api\.isOwner\(\)/);
  assert.match(ham('khoiPhucSaoLuu'), /if \(!api\.isOwner\(\)\)/);
  assert.match(more, /\$\{raw\(laChu \? saoLuuHtml\(\) : ''\)\}/);
});
test('khôi phục chỉ đẩy thêm vào mảng (push), không splice / gán lại / xóa; có ghi nhật ký cả lúc tải và lúc khôi phục', () => {
  const i = store.indexOf('khoiPhucSaoLuu('), ham = store.slice(i, store.indexOf('/* ---------- CHỐT SỔ THÁNG', i));
  assert.match(ham, /groups\[k\]\.push\(x\)/);
  assert.ok(!/splice|\.length = 0|replaceAll|deleteOne|deleteAll|groups\[k\] =/.test(ham), 'khôi phục không được xóa hay thay dữ liệu');
  assert.match(ham, /api\.log\('data\.restore'/);
  assert.match(store, /api\.log\('data\.export'/);
});
test('giao diện: cảnh báo tệp có CCCD; mọi chữ lấy từ tệp đều qua U.esc; ô chọn tệp chỉ nhận .json', () => {
  const i = more.indexOf('function saoLuuHtml'), ui = more.slice(i, more.indexOf('})();', i));
  assert.match(ui, /số CCCD/);
  assert.match(ui, /accept="application\/json,\.json"/);
  ['d.ten', 'd.vi', 'b.nguoiTao', 'kq.loi'].forEach((x) => { if (ui.includes(x)) assert.ok(!new RegExp('\\$\\{' + x.replace('.', '\\.') + '\\}').test(ui), x + ' chưa thoát HTML'); });
  assert.match(ui, /U\.esc\(d\.ten\)/); assert.match(ui, /U\.esc\(b\.nguoiTao\)/); assert.match(ui, /U\.esc\(d\.vi\)/);
  assert.match(ui, /loi\.textContent = r\.loi/);
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

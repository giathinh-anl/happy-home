/* Kiểm thử "báo việc mới" của web chủ trọ: luật (js/notify.js) và vòng hỏi máy chủ (js/notify-ui.js chạy trong môi trường giả:
   đồng hồ giả, máy chủ giả, tab ẩn / hiện giả). Chạy:  node tests/notify.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const N = require('../js/notify.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

/* ============================================================
   Luật
   ============================================================ */
test('loaiTheoQuyen: chủ trọ thấy cả 6 loại; nhân viên chỉ loại thuộc quyền, không bao giờ thấy tin nhắn hay khách xin mã', () => {
  assert.deepStrictEqual(N.loaiTheoQuyen({ chu: true }), ['tinNhan', 'xinMa', 'chuyenKhoan', 'suCo', 'giaHan', 'chiSo']);
  assert.deepStrictEqual(N.loaiTheoQuyen({ chu: false, can: (q) => q === 'payments' }), ['chuyenKhoan']);
  assert.deepStrictEqual(N.loaiTheoQuyen({ chu: false, can: () => true }), ['chuyenKhoan', 'suCo', 'giaHan', 'chiSo']);
  assert.deepStrictEqual(N.loaiTheoQuyen({ chu: false, can: () => false }), []);
  assert.deepStrictEqual(N.loaiTheoQuyen(null), []);
});
test('chuanHoa: số âm, chữ, NaN, thiếu thì null; số thực làm tròn xuống; loại lạ bị bỏ', () => {
  assert.deepStrictEqual(N.chuanHoa({ tinNhan: 3, chuyenKhoan: '2', suCo: -1, giaHan: 'abc', chiSo: 1.7, la: 9 }),
    { tinNhan: 3, xinMa: null, chuyenKhoan: 2, suCo: null, giaHan: null, chiSo: 1 });
  assert.deepStrictEqual(N.chuanHoa(null), { tinNhan: null, xinMa: null, chuyenKhoan: null, suCo: null, giaHan: null, chiSo: null });
  assert.strictEqual(N.chuanHoa({ tinNhan: Infinity }).tinNhan, null);
  assert.strictEqual(N.chuanHoa({ tinNhan: '' }).tinNhan, null);
});
test('tong: cộng các loại biết được, bỏ null', () => {
  assert.strictEqual(N.tong({ tinNhan: 2, chuyenKhoan: null, suCo: 1, giaHan: 0, chiSo: 4 }), 7);
  assert.strictEqual(N.tong(null), 0);
});
test('soSanh: chỉ số TĂNG là việc mới; giảm hay bằng thì không; lần đầu (chưa có số cũ) không báo', () => {
  const a = N.chuanHoa({ tinNhan: 1, chuyenKhoan: 2, suCo: 0, giaHan: 0, chiSo: 3 });
  assert.deepStrictEqual(N.soSanh(null, a), { moi: {}, tongMoi: 0, coMoi: false });
  const b = N.chuanHoa({ tinNhan: 3, chuyenKhoan: 1, suCo: 1, giaHan: 0, chiSo: 3 });
  assert.deepStrictEqual(N.soSanh(a, b), { moi: { tinNhan: 2, suCo: 1 }, tongMoi: 3, coMoi: true });
  assert.deepStrictEqual(N.soSanh(b, a).moi, { chuyenKhoan: 1 });           // tin nhắn, sự cố giảm thì thôi; chuyển khoản tăng 1->2 vẫn là mới
  const giam = N.chuanHoa({ tinNhan: 0, chuyenKhoan: 0, suCo: 0, giaHan: 0, chiSo: 1 });
  assert.strictEqual(N.soSanh(b, giam).coMoi, false);
  assert.strictEqual(N.soSanh(a, a).coMoi, false);
});
test('soSanh: loại đếm lỗi (null) ở lần trước hoặc lần này thì không báo cho loại đó', () => {
  const a = N.chuanHoa({ tinNhan: null, chuyenKhoan: 1 }), b = N.chuanHoa({ tinNhan: 5, chuyenKhoan: null });
  assert.strictEqual(N.soSanh(a, b).coMoi, false);
  const c = N.chuanHoa({ tinNhan: 5, chuyenKhoan: 2 });
  assert.deepStrictEqual(N.soSanh(b, c).moi, {});
  assert.deepStrictEqual(N.soSanh(a, c).moi, { chuyenKhoan: 1 });
});
test('noiDung: câu báo theo thứ tự loại, nối bằng dấu chấm giữa', () => {
  assert.strictEqual(N.noiDung({ suCo: 1, tinNhan: 2 }), '2 tin nhắn mới từ khách · 1 sự cố mới');
  assert.strictEqual(N.noiDung({ chuyenKhoan: 1 }), '1 khách báo đã chuyển khoản');
  assert.strictEqual(N.noiDung({ xinMa: 1, suCo: 2 }), '1 khách quên mã, xin cấp lại mã vào app · 2 sự cố mới');
  assert.strictEqual(N.duongDen({ xinMa: 1, suCo: 2 }, 'b2'), '/b/b2/tenants');
  assert.strictEqual(N.noiDung({}), ''); assert.strictEqual(N.noiDung(null), '');
});
test('duongDen: mở trang của loại ưu tiên cao nhất; mã tòa được mã hóa; không có tòa thì về trang chung', () => {
  assert.strictEqual(N.duongDen({ suCo: 1, tinNhan: 1 }, 'b1'), '/b/b1/support');
  assert.strictEqual(N.duongDen({ chuyenKhoan: 1 }, 'b1'), '/transfers');
  assert.strictEqual(N.duongDen({ chiSo: 2 }, 'b 1/x'), '/b/b%201%2Fx/readings');
  assert.strictEqual(N.duongDen({ giaHan: 1 }, null), '/dashboard');
  assert.strictEqual(N.duongDen({ chuyenKhoan: 1 }, null), '/transfers');
  assert.strictEqual(N.duongDen({}, 'b1'), '/dashboard');
});
test('duongDen: mọi trang trỏ tới đều là route có thật trong router.js', () => {
  const router = doc('js/router.js');
  N.LOAI.forEach((l) => {
    const p = l.duong(':bid');
    assert.ok(router.includes(`pat: '${p}'`), l.ma + ' -> ' + p);
  });
});
test('tieuDe: thêm "(n) " vào trước, quá 99 thì 99+, 0 thì bỏ; không chồng số khi gọi nhiều lần', () => {
  const g = 'Happy Home — Quản lý nhà cho thuê';
  assert.strictEqual(N.tieuDe(g, 3), '(3) ' + g);
  assert.strictEqual(N.tieuDe(g, 150), '(99+) ' + g);
  assert.strictEqual(N.tieuDe(g, 0), g); assert.strictEqual(N.tieuDe(g, -2), g); assert.strictEqual(N.tieuDe(g, 'x'), g);
  assert.strictEqual(N.tieuDe(N.tieuDe(g, 5), 2), '(2) ' + g);
  assert.strictEqual(N.tieuDe('(99+) ' + g, 0), g);
});
test('khoangCho: 30 giây khi đang xem, 60 giây ở nền; lỗi thì gấp đôi, tối đa 10 phút', () => {
  assert.strictEqual(N.khoangCho(true, 0), 30000); assert.strictEqual(N.khoangCho(false, 0), 60000);
  assert.strictEqual(N.khoangCho(true, 1), 60000); assert.strictEqual(N.khoangCho(true, 3), 240000);
  assert.strictEqual(N.khoangCho(true, 50), 600000); assert.strictEqual(N.khoangCho(false, 4), 600000);
  assert.strictEqual(N.khoangCho(true, -3), 30000); assert.strictEqual(N.khoangCho(true, 'x'), 30000);
});
test('caiDat: mặc định bật số trên tab và tiếng, tắt thông báo màn hình; giá trị không phải true/false thì dùng mặc định', () => {
  assert.deepStrictEqual(N.caiDat(null), { tieuDe: true, tieng: true, manHinh: false });
  assert.deepStrictEqual(N.caiDat({ tieuDe: false, tieng: 'yes', manHinh: true, la: 1 }), { tieuDe: false, tieng: true, manHinh: true });
  assert.deepStrictEqual(N.caiDat('hỏng'), { tieuDe: true, tieng: true, manHinh: false });
});

/* ============================================================
   Vòng hỏi máy chủ (js/notify-ui.js) trong môi trường giả
   ============================================================ */
function moiTruong(o) {
  const cfg = Object.assign({ chu: true, quyen: [], auth: true, backend: true, baoViec: null, quyenTB: 'granted' }, o || {});
  let idHen = 0; const hen = new Map();
  const ghi = { toast: [], thongBao: [], taiLai: 0, hoi: [], di: [], tieuDeQua: [] };
  const nghe = {};
  let traLoi = () => ({ data: {} });
  const document = { title: 'Happy Home — Quản lý nhà cho thuê', visibilityState: 'visible',
    addEventListener(t, f) { (nghe[t] = nghe[t] || []).push(f); } };
  function Notification(tieuDe, opt) { this.tieuDe = tieuDe; this.opt = opt; this.close = () => { this.dong = true; }; ghi.thongBao.push(this); }
  Notification.permission = cfg.quyenTB;
  Notification.requestPermission = async () => Notification.permission;
  const store = { prefs: { auth: cfg.auth, baoViec: cfg.baoViec }, buildings: [{ id: 'b1' }],
    usingBackend: () => cfg.backend, isOwner: () => cfg.chu, can: (q) => cfg.chu || cfg.quyen.includes(q) };
  const ctx = {
    document, Notification, console,
    setTimeout: (f, ms) => { const id = ++idHen; hen.set(id, { f, ms }); return id; },
    clearTimeout: (id) => { hen.delete(id); },
    HH: { baoViec: N, store, offline: { mode: false },
      backend: { demViec: async (loai) => { ghi.hoi.push(loai.slice()); return traLoi(loai); } },
      ui: { toast: (m) => ghi.toast.push(m) },
      router: { current: () => '/b/b1/units', go: (p) => ghi.di.push(p) } },
  };
  ctx.window = ctx;
  vm.runInNewContext(doc('js/notify-ui.js'), ctx);
  const UI = ctx.HH.baoViecUI;
  return {
    UI, ghi, document, store, Notification, cfg,
    datTraLoi(f) { traLoi = f; },
    dem(d) { traLoi = () => ({ data: d }); },
    henCuoi() { const ds = [...hen.values()]; return ds.length ? ds[ds.length - 1].ms : null; },
    soHen: () => hen.size,
    soNghe: (t) => (nghe[t] || []).length,
    async chay(ms) {                                // chạy việc đang hẹn (mới nhất, hoặc việc hẹn đúng ms), không chờ nó xong (có thể đang treo)
      const ds = [...hen.entries()].filter(([, h]) => ms == null || h.ms === ms); assert.ok(ds.length, 'không có việc nào đang hẹn' + (ms ? ' ' + ms : ''));
      const [id, h] = ds[ds.length - 1]; hen.delete(id);
      h.f();
      for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
    },
    phat(t) { (nghe[t] || []).forEach((f) => f()); },
  };
}
const du = (o) => Object.assign({ tinNhan: 0, xinMa: 0, chuyenKhoan: 0, suCo: 0, giaHan: 0, chiSo: 0 }, o);

test('chạy: hỏi lần đầu sau 3 giây; số việc có sẵn hiện trên tiêu đề nhưng KHÔNG báo việc mới', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  assert.strictEqual(m.henCuoi(), 3000);
  m.dem(du({ tinNhan: 2, suCo: 1 }));
  await m.chay();
  assert.deepStrictEqual(m.ghi.hoi[0], ['tinNhan', 'xinMa', 'chuyenKhoan', 'suCo', 'giaHan', 'chiSo']);
  assert.strictEqual(m.document.title, '(3) Happy Home — Quản lý nhà cho thuê');
  assert.deepStrictEqual(m.ghi.toast, []); assert.strictEqual(m.ghi.taiLai, 0);
  assert.strictEqual(m.henCuoi(), 30000);
});
test('chạy: có việc mới khi đang xem tab thì tải dữ liệu về, báo nhỏ trong trang, không hiện thông báo máy tính', async () => {
  const m = moiTruong({ baoViec: { manHinh: true } });
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ tinNhan: 1 })); await m.chay();
  m.dem(du({ tinNhan: 3, chuyenKhoan: 1 })); await m.chay();
  assert.strictEqual(m.ghi.taiLai, 1);
  assert.deepStrictEqual(m.ghi.toast, ['Có 2 tin nhắn mới từ khách · 1 khách báo đã chuyển khoản']);
  assert.strictEqual(m.ghi.thongBao.length, 0);
  assert.strictEqual(m.document.title, '(4) Happy Home — Quản lý nhà cho thuê');
});
test('chạy: tab ở nền thì hỏi 60 giây một lần; có việc mới thì hiện thông báo máy tính, bấm vào mở đúng trang', async () => {
  const m = moiTruong({ baoViec: { manHinh: true } });
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({})); await m.chay();
  m.document.visibilityState = 'hidden';
  m.dem(du({ suCo: 1 })); await m.chay();
  assert.strictEqual(m.henCuoi(), 60000);
  assert.strictEqual(m.ghi.toast.length, 0);
  assert.strictEqual(m.ghi.thongBao.length, 1);
  const tb = m.ghi.thongBao[0];
  assert.strictEqual(tb.opt.body, '1 sự cố mới'); assert.strictEqual(tb.opt.tag, 'hh-viec-moi');
  tb.onclick();
  assert.deepStrictEqual(m.ghi.di, ['/b/b1/incidents']); assert.ok(tb.dong);
});
test('chạy: chưa bật thông báo màn hình, hoặc trình duyệt chưa cho phép, thì không hiện', async () => {
  for (const [cai, quyen] of [[{ manHinh: false }, 'granted'], [{ manHinh: true }, 'denied'], [{ manHinh: true }, 'default']]) {
    const m = moiTruong({ baoViec: cai, quyenTB: quyen });
    m.UI.batDau({});
    m.document.visibilityState = 'hidden';
    m.dem(du({})); await m.chay();
    m.dem(du({ tinNhan: 1 })); await m.chay();
    assert.strictEqual(m.ghi.thongBao.length, 0, JSON.stringify(cai) + ' ' + quyen);
  }
});
test('chạy: số việc giảm (đã xử lý) thì chỉ giảm số trên tiêu đề, không báo; về 0 thì bỏ số', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ chuyenKhoan: 3 })); await m.chay();
  m.dem(du({ chuyenKhoan: 1 })); await m.chay();
  assert.strictEqual(m.document.title, '(1) Happy Home — Quản lý nhà cho thuê');
  m.dem(du({})); await m.chay();
  assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê');
  assert.strictEqual(m.ghi.taiLai, 0); assert.strictEqual(m.ghi.toast.length, 0);
});
test('chạy: lỗi mạng thì giãn nhịp (60s, 120s...), có lại thì về 30s và không báo nhầm việc cũ là mới', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ tinNhan: 2 })); await m.chay();
  m.datTraLoi(() => ({ error: { message: 'Mất mạng' } }));
  await m.chay(); assert.strictEqual(m.henCuoi(), 60000);
  await m.chay(); assert.strictEqual(m.henCuoi(), 120000);
  m.datTraLoi(() => { throw new Error('văng'); });
  await m.chay(); assert.strictEqual(m.henCuoi(), 240000);
  m.dem(du({ tinNhan: 2 })); await m.chay();
  assert.strictEqual(m.henCuoi(), 30000); assert.strictEqual(m.ghi.toast.length, 0);
});
test('chạy: máy chủ treo không trả lời thì sau 15 giây coi là lỗi và vẫn hỏi tiếp (vòng hỏi không đứng)', async () => {
  const m = moiTruong();
  m.UI.batDau({});
  m.datTraLoi(() => new Promise(() => {}));        // không bao giờ trả lời
  await m.chay(3000);
  assert.strictEqual(m.henCuoi(), 15000);
  await m.chay(15000);
  assert.strictEqual(m.henCuoi(), 60000, 'phải hẹn lần sau, giãn nhịp vì lỗi');
  m.dem(du({ tinNhan: 1 })); await m.chay(60000);
  assert.strictEqual(m.document.title, '(1) Happy Home — Quản lý nhà cho thuê');
});
test('chạy: đăng xuất đúng lúc đang hỏi thì kết quả cũ bị bỏ, vòng hỏi vẫn chạy tiếp', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  let traVe; m.datTraLoi(() => new Promise((r) => { traVe = r; }));
  await m.chay(3000);
  m.UI.dungLai();
  traVe({ data: du({ tinNhan: 5 }) }); for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê', 'không được hiện số của lần hỏi cũ');
  assert.ok([...Array(1)].length && m.henCuoi() != null, 'phải còn lần hỏi được hẹn');
  m.dem(du({ tinNhan: 1 })); await m.chay(30000);
  assert.strictEqual(m.ghi.toast.length, 0, 'lần hỏi đầu sau đăng xuất không báo');
  m.dem(du({ tinNhan: 2 })); await m.chay(30000);
  assert.strictEqual(m.ghi.toast.length, 1);
});
test('chạy: nhân viên chỉ được hỏi loại thuộc quyền; không quyền nào thì không hỏi máy chủ', async () => {
  const m = moiTruong({ chu: false, quyen: ['payments', 'incidents'] });
  m.UI.batDau({}); m.dem(du({})); await m.chay();
  assert.deepStrictEqual(m.ghi.hoi[0], ['chuyenKhoan', 'suCo']);
  const m2 = moiTruong({ chu: false, quyen: [] });
  m2.UI.batDau({}); await m2.chay();
  assert.strictEqual(m2.ghi.hoi.length, 0); assert.strictEqual(m2.soHen(), 1);
});
test('chạy: chưa đăng nhập, bản demo, hay đang mở ngoại tuyến thì không hỏi máy chủ và không có số trên tiêu đề', async () => {
  for (const o of [{ auth: false }, { backend: false }]) {
    const m = moiTruong(o); m.UI.batDau({}); await m.chay();
    assert.strictEqual(m.ghi.hoi.length, 0); assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê');
  }
});
test('chạy: đăng xuất rồi người khác đăng nhập thì lần hỏi đầu không bị coi là việc mới', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ tinNhan: 1 })); await m.chay();
  m.UI.dungLai();
  assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê');
  m.dem(du({ tinNhan: 9 })); await m.chay();
  assert.strictEqual(m.ghi.toast.length, 0); assert.strictEqual(m.ghi.taiLai, 0);
});
test('chạy: phiên hết hạn (không qua nút đăng xuất) rồi đăng nhập lại thì lần hỏi đầu cũng không bị coi là việc mới', async () => {
  const m = moiTruong();
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ tinNhan: 1 })); await m.chay();
  m.store.prefs.auth = false; await m.chay();
  assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê');
  m.store.prefs.auth = true; m.dem(du({ tinNhan: 6 })); await m.chay();
  assert.strictEqual(m.ghi.toast.length, 0); assert.strictEqual(m.document.title, '(6) Happy Home — Quản lý nhà cho thuê');
});
test('chạy: tắt "số trên tab" thì tiêu đề không có số nhưng vẫn báo việc mới', async () => {
  const m = moiTruong({ baoViec: { tieuDe: false } });
  m.UI.batDau({ taiLai: () => m.ghi.taiLai++ });
  m.dem(du({ tinNhan: 1 })); await m.chay();
  m.dem(du({ tinNhan: 2 })); await m.chay();
  assert.strictEqual(m.document.title, 'Happy Home — Quản lý nhà cho thuê');
  assert.strictEqual(m.ghi.toast.length, 1);
});
test('chạy: quay lại tab thì hỏi lại sau 1,5 giây; gọi batDau hai lần không sinh hai vòng hỏi', async () => {
  const m = moiTruong();
  m.UI.batDau({}); m.UI.batDau({});
  assert.strictEqual(m.soHen(), 1);
  assert.strictEqual(m.soNghe('visibilitychange'), 1); assert.strictEqual(m.soNghe('pointerdown'), 1);
  m.dem(du({})); await m.chay();
  m.document.visibilityState = 'visible'; m.phat('visibilitychange');
  assert.strictEqual(m.henCuoi(), 1500); assert.strictEqual(m.soHen(), 1);
});

/* ============================================================
   Nối vào app: đối chiếu mã nguồn
   ============================================================ */
const html = doc('index.html'), app = doc('js/app.js'), be = doc('js/backend.js'), more = doc('js/pages/more.js');
test('index.html nạp notify.js trước notify-ui.js, và cả hai trước app.js', () => {
  const vt = (f) => html.indexOf('src="js/' + f);
  assert.ok(vt('notify.js') > 0 && vt('notify.js') < vt('notify-ui.js') && vt('notify-ui.js') < vt('app.js'));
});
test('máy chủ: chỉ đếm (head: true), không tải dữ liệu; đủ 6 loại, đúng điều kiện chờ xử lý', () => {
  const i = be.indexOf('const DEM_VIEC'), k = be.slice(i, be.indexOf('async function demViec', i));
  N.MA.forEach((m) => assert.match(k, new RegExp(m + ': (async )?\\(q\\) =>'), m));
  assert.strictEqual((k.match(/head: true/g) || []).length, 5);
  assert.match(k, /xinMa: async \(q\) => \{ const \{ data, error \} = await q\.rpc\('owner_code_requests'\); return \{ count: Array\.isArray\(data\) \? data\.length : 0, error \}; \}/);
  assert.ok(!/select\('\*'\)/.test(k));
  assert.match(k, /eq\('sender', 'tenant'\)\.eq\('read_by_staff', false\)/);
  assert.match(k, /payment_claims'\)[^\n]*eq\('status', 'pending'\)/);
  assert.match(k, /incidents'\)[^\n]*eq\('status', 'open'\)/);
  assert.match(k, /eq\('source', 'tenant'\)\.eq\('approved', false\)/);
  assert.match(be, /rpc, postFacebook, demViec,/);
});
test('app.js: bắt đầu sau khi vào app, tải ngay khi có việc mới (bỏ qua nghỉ 60 giây), dừng khi đăng xuất', () => {
  assert.match(app, /HH\.baoViecUI\.batDau\(\{ taiLai: \(\) => pullServer\(false, null, true\) \}\)/);
  assert.match(app, /!manual && !ep && Date\.now\(\) - lastPull < 60000/);
  assert.match(app, /S\.logout\(\); if \(HH\.baoViecUI\) HH\.baoViecUI\.dungLai\(\);/);
});
test('app.js: tải dữ liệu mới về không vẽ lại trang khi đang điền biểu mẫu, đang mở hộp thoại hay đang gõ', () => {
  const i = app.indexOf('const dangDien'), k = app.slice(i, i + 400);
  ['tenants\\/new', 'contracts\\/new', 'contracts\\/scan', '\\/terminate', "querySelector('.overlay')", 'INPUT|TEXTAREA|SELECT', "closest('#app')"].forEach((x) => assert.ok(k.includes(x), x));
});
test('Cài đặt chung: có thẻ cài đặt (chỉ khi nối máy chủ), đủ 3 lựa chọn, xin quyền thông báo khi bấm', () => {
  assert.match(more, /\$\{raw\(backend \? baoViecHtml\(\) : ''\)\}/);
  ['tieuDe', 'tieng', 'manHinh'].forEach((k) => assert.match(more, new RegExp(`o\\('${k}'`)));
  assert.match(more, /await UIb\.xinQuyen\(\)/);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

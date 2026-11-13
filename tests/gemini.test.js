/* Kiểm thử vòng gọi AI (js/gemini.js): mô hình chính treo / quá tải / hết lượt thì chuyển sang mô hình dự phòng.
   Máy chủ AI được giả bằng fetch giả, không gọi mạng thật.
   Chạy:  node tests/gemini.test.js */
const assert = require('assert');

const kho = {};
global.localStorage = { getItem: (k) => (k in kho ? kho[k] : null), setItem: (k, v) => { kho[k] = String(v); }, removeItem: (k) => { delete kho[k]; } };
global.HH_CONFIG = { aiProxyUrl: 'https://may-chu-gia/functions/v1/ai', supabaseAnonKey: 'anon-cong-khai' };
const G = require('../js/gemini.js');
const T = G._thu;
T.CHO_LAI.splice(0, T.CHO_LAI.length, 5, 5);          // nghỉ giữa các lần thử lại: 5 ms thay cho 1,2 và 3 giây

const CHINH = 'gemini-3.8-flash', PHU = 'gemini-3.5-flash';
let goi = [];           // tên mô hình của từng lần gọi, theo thứ tự
let kich = {};          // { mô hình: 'ok' | 'treo' | số mã HTTP | 'mang' | hàm }
const tra = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
const TOT = { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
let tre = {};           // { mô hình: số ms máy chủ giả "xếp hàng" trước khi trả lời, để giả lỗi tới chậm }
global.fetch = async (url, opt) => {
  const req = JSON.parse(opt.body), m = req.model;
  goi.push(m);
  assert.strictEqual(url, global.HH_CONFIG.aiProxyUrl);
  assert.strictEqual(opt.headers.apikey, 'anon-cong-khai');
  let k = kich[m]; if (typeof k === 'function') k = k();
  if (k === 'treo') return new Promise((_, rej) => opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }));
  if (tre[m]) await new Promise((r) => setTimeout(r, tre[m]));
  if (k === 'mang') throw new TypeError('Failed to fetch');
  if (k === 'ok') return tra(200, TOT);
  if (k === 429) return tra(429, { error: { message: 'Please retry in 12m3.5s' } });
  if (k === 'saikhoa') return tra(400, { error: { message: 'API key not valid' } });
  return tra(k, { error: 'x' });
};
const dat = (c, p) => { goi = []; tre = {}; kich = { [CHINH]: c, [PHU]: p }; Object.keys(T.xau).forEach((k) => delete T.xau[k]); };
const doc = (timeout) => G.readDoc([{ mime: 'image/jpeg', data: 'QUJD' }], 'sys', 'user', { timeout: timeout || 60 });
const loi = async (p, ma) => { try { await p; } catch (e) { assert.strictEqual(e.message, ma); return; } assert.fail('đáng lẽ phải báo ' + ma); };

const ds = [];
const test = (ten, fn) => ds.push([ten, fn]);

test('cả hai mô hình ổn: chỉ gọi mô hình chính một lần', async () => {
  dat('ok', 'ok'); assert.deepStrictEqual(await doc(), { ok: true }); assert.deepStrictEqual(goi, [CHINH]);
});
test('mô hình chính TREO: hết giờ chờ thì sang mô hình dự phòng và đọc được (trước đây báo lỗi luôn)', async () => {
  dat('treo', 'ok'); const t0 = Date.now(); assert.deepStrictEqual(await doc(60), { ok: true });
  assert.deepStrictEqual(goi, [CHINH, PHU]); assert.ok(Date.now() - t0 < 1000);
});
test('sau khi mô hình chính treo, lần gọi kế đi THẲNG mô hình dự phòng (không bắt chờ lại)', async () => {
  dat('treo', 'ok'); await doc(60); goi = [];
  await doc(60); assert.deepStrictEqual(goi, [PHU]);
});
test('quá 5 phút thì thử lại mô hình chính trước', async () => {
  dat('treo', 'ok'); await doc(60);
  T.xau[CHINH] = Date.now() - T.TRANH_MS - 1000; kich[CHINH] = 'ok'; goi = [];
  await doc(60); assert.deepStrictEqual(goi, [CHINH]);
  assert.strictEqual(T.xau[CHINH], undefined, 'gọi được rồi thì bỏ dấu hỏng');
});
test('mô hình chính quá tải 503 liên tục: thử 3 lần rồi sang dự phòng', async () => {
  dat(503, 'ok'); assert.deepStrictEqual(await doc(), { ok: true }); assert.deepStrictEqual(goi, [CHINH, CHINH, CHINH, PHU]);
});
test('503 một lần rồi chạy lại: vẫn ở mô hình chính, không đánh dấu hỏng', async () => {
  let n = 0; dat(() => (++n === 1 ? 503 : 'ok'), 'ok');
  await doc(); assert.deepStrictEqual(goi, [CHINH, CHINH]); assert.strictEqual(T.xau[CHINH], undefined);
});
test('các mã 500, 502, 504 cũng là lỗi tạm: thử lại rồi sang dự phòng', async () => {
  for (const ma of [500, 502, 504]) { dat(ma, 'ok'); await doc(); assert.deepStrictEqual(goi, [CHINH, CHINH, CHINH, PHU], String(ma)); }
});
test('503 tới CHẬM (Google đã xếp hàng cả chục giây): không thử lại mô hình đó, sang thẳng dự phòng', async () => {
  const cu = T.CHAM.ms; T.CHAM.ms = 30;
  try { dat(503, 'ok'); tre[CHINH] = 60; assert.deepStrictEqual(await doc(), { ok: true }); assert.deepStrictEqual(goi, [CHINH, PHU]); assert.ok(T.xau[CHINH]); }
  finally { T.CHAM.ms = cu; }
});
test('503 chậm ở cả hai mô hình: mỗi mô hình đúng một lần rồi báo lỗi (không kéo dài thêm 3 + 3 lần)', async () => {
  const cu = T.CHAM.ms; T.CHAM.ms = 30;
  try { dat(503, 503); tre[CHINH] = 60; tre[PHU] = 60; await loi(doc(), 'AI_HTTP_503'); assert.deepStrictEqual(goi, [CHINH, PHU]); }
  finally { T.CHAM.ms = cu; }
});
test('503 tới nhanh (dưới ngưỡng chậm) vẫn thử lại như cũ', async () => {
  const cu = T.CHAM.ms; T.CHAM.ms = 500;
  try { dat(503, 'ok'); tre[CHINH] = 5; await doc(); assert.deepStrictEqual(goi, [CHINH, CHINH, CHINH, PHU]); }
  finally { T.CHAM.ms = cu; }
});
test('mô hình chính hết lượt (429): sang ngay dự phòng, không thử lại', async () => {
  dat(429, 'ok'); await doc(); assert.deepStrictEqual(goi, [CHINH, PHU]);
});
test('rớt mạng ở mô hình chính: thử lại rồi sang dự phòng', async () => {
  dat('mang', 'ok'); await doc(); assert.deepStrictEqual(goi, [CHINH, CHINH, CHINH, PHU]);
});
test('sai khóa: báo ngay, KHÔNG gọi mô hình dự phòng (mô hình nào cũng sai như nhau)', async () => {
  dat('saikhoa', 'ok'); await loi(doc(), 'AI_BAD_KEY'); assert.deepStrictEqual(goi, [CHINH]);
});
test('lỗi yêu cầu 400/403/404: báo ngay, không thử lại, không đổi mô hình', async () => {
  for (const ma of [400, 403, 404]) { dat(ma, 'ok'); await loi(doc(), 'AI_HTTP_' + ma); assert.deepStrictEqual(goi, [CHINH], String(ma)); }
});
test('cả hai mô hình treo: báo AI_TIMEOUT sau khi đã thử cả hai, mỗi mô hình một lần', async () => {
  dat('treo', 'treo'); await loi(doc(60), 'AI_TIMEOUT'); assert.deepStrictEqual(goi, [CHINH, PHU]);
});
test('cả hai quá tải: báo AI_HTTP_503 sau 3 + 3 lần', async () => {
  dat(503, 503); await loi(doc(), 'AI_HTTP_503'); assert.strictEqual(goi.length, 6); assert.deepStrictEqual(goi.slice(0, 3), [CHINH, CHINH, CHINH]);
});
test('cả hai hết lượt: báo AI_QUOTA, mỗi mô hình gọi một lần', async () => {
  dat(429, 429); await loi(doc(), 'AI_QUOTA'); assert.deepStrictEqual(goi, [CHINH, PHU]);
});
test('cả hai đều đang bị đánh dấu hỏng: vẫn thử (theo thứ tự gốc) chứ không bỏ cuộc', async () => {
  dat('ok', 'ok'); T.xau[CHINH] = Date.now(); T.xau[PHU] = Date.now();
  await doc(); assert.deepStrictEqual(goi, [CHINH]);
});
test('câu hỏi chữ (call) cũng chuyển mô hình khi mô hình chính treo', async () => {
  dat('treo', 'ok'); const r = await G.call('sys', 'hỏi', { timeout: 60 }); assert.strictEqual(r, '{"ok":true}'); assert.deepStrictEqual(goi, [CHINH, PHU]);
});
test('giới hạn chờ: còn dự phòng thì chờ khoảng nửa thời gian (không dưới 12 giây); hết dự phòng thì chờ đủ', async () => {
  assert.strictEqual(T.gioiHanCho(45000, true), 24750); assert.strictEqual(T.gioiHanCho(45000, false), 45000);
  assert.strictEqual(T.gioiHanCho(12000, true), 12000); assert.strictEqual(T.gioiHanCho(20000, true), 12000); assert.strictEqual(T.gioiHanCho(60, true), 60);
});
test('phân loại lỗi', async () => {
  assert.strictEqual(T.phanLoaiLoi('AI_TIMEOUT'), 'sang-mo-hinh-khac'); assert.strictEqual(T.phanLoaiLoi('AI_QUOTA'), 'sang-mo-hinh-khac');
  ['AI_HTTP_500', 'AI_HTTP_502', 'AI_HTTP_503', 'AI_HTTP_504', 'AI_NETWORK'].forEach((m) => assert.strictEqual(T.phanLoaiLoi(m), 'thu-lai', m));
  ['AI_BAD_KEY', 'AI_HTTP_400', 'AI_HTTP_404', 'AI_EMPTY', 'AI_BAD_JSON', '', undefined].forEach((m) => assert.strictEqual(T.phanLoaiLoi(m), 'bao-ngay', String(m)));
});
test('thứ tự thử: mô hình ổn trước, mô hình vừa hỏng sau; không làm mất mô hình nào', async () => {
  Object.keys(T.xau).forEach((k) => delete T.xau[k]); const now = Date.now();
  assert.deepStrictEqual(T.thuTuMoHinh([CHINH, PHU], now), [CHINH, PHU]);
  T.xau[CHINH] = now - 1000; assert.deepStrictEqual(T.thuTuMoHinh([CHINH, PHU], now), [PHU, CHINH]);
  T.xau[CHINH] = now - T.TRANH_MS - 1; assert.deepStrictEqual(T.thuTuMoHinh([CHINH, PHU], now), [CHINH, PHU]);
  delete T.xau[CHINH];
});
test('câu báo lỗi: treo và quá tải nói rõ là do máy chủ AI của Google và đã thử dự phòng', async () => {
  assert.ok(/Google/.test(G.errText('AI_TIMEOUT')) && /dự phòng/.test(G.errText('AI_TIMEOUT')));
  assert.ok(/quá tải/.test(G.errText('AI_HTTP_503')) && /quá tải/.test(G.errText('AI_HTTP_500')));
  assert.ok(G.errText('AI_HTTP_418')); assert.ok(G.errText('AI_NETWORK'));
});

(async () => {
  let ok = 0, hong = 0;
  for (const [ten, fn] of ds) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n')[0]); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

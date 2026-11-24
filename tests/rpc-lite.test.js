/* Kiểm thử hàm gọi máy chủ của app khách (tenant-app/js/rpc-lite.js) bằng fetch giả, và việc thay thư viện supabase-js.
   Trả lời phải giống supabase-js ở những chỗ tenant.js dựa vào: { data, error }, error.code giữ mã PostgREST, mất mạng không ném lỗi.
   Chạy:  node tests/rpc-lite.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = require('../tenant-app/js/rpc-lite.js');

const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let ok = 0, hong = 0;
const cho = [];
const test = (ten, fn) => cho.push([ten, fn]);

const URL0 = 'https://mau.example.co', KEY = 'khoa-cong-khai-mau';
/** fetch giả: ghi lại lệnh gọi, trả lời theo hàm traLoi(url, opt) -> { status, body } | Error để ném */
function gia(traLoi) {
  const log = [];
  const f = async (url, opt) => {
    log.push({ url, opt });
    const r = await traLoi(url, opt);
    if (r instanceof Error) throw r;
    const body = r.body === undefined ? '' : (typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => body };
  };
  return { f, log };
}
// Cùng cách nhận ra "máy chủ chưa có hàm" như tenant.js
const rpcMissing = (err) => { const s = ((err && err.message) || '').toLowerCase(); return s.includes('could not find the function') || s.includes('does not exist') || (err && (err.code === '42883' || err.code === 'PGRST202')); };

test('gọi đúng địa chỉ /rest/v1/rpc/<tên>, POST, gửi đối số dạng JSON, khóa công khai ở cả apikey và Authorization', async () => {
  const g = gia(() => ({ status: 200, body: { ok: 1 } }));
  const c = R.createClient(URL0 + '/', KEY, { fetch: g.f });
  const r = await c.rpc('tenant_data', { p_token: 'abc', p_n: 2 });
  assert.deepStrictEqual(r.data, { ok: 1 }); assert.strictEqual(r.error, null);
  const x = g.log[0];
  assert.strictEqual(x.url, URL0 + '/rest/v1/rpc/tenant_data');
  assert.strictEqual(x.opt.method, 'POST');
  assert.deepStrictEqual(JSON.parse(x.opt.body), { p_token: 'abc', p_n: 2 });
  assert.strictEqual(x.opt.headers.apikey, KEY); assert.strictEqual(x.opt.headers.Authorization, 'Bearer ' + KEY);
  assert.strictEqual(x.opt.headers['Content-Type'], 'application/json');
});
test('không có đối số thì gửi {}; địa chỉ có nhiều dấu / cuối vẫn đúng', async () => {
  const g = gia(() => ({ status: 200, body: [] }));
  await R.createClient(URL0 + '///', KEY, { fetch: g.f }).rpc('tenant_logout');
  assert.strictEqual(g.log[0].opt.body, '{}'); assert.strictEqual(g.log[0].url, URL0 + '/rest/v1/rpc/tenant_logout');
});
test('dữ liệu trả về: đối tượng, mảng, số, chữ, true/false giữ nguyên; "null" và 204 là null (tenant.js coi là hết phiên)', async () => {
  for (const [body, mong] of [[{ a: [1, { b: 'Tiếng Việt' }] }, { a: [1, { b: 'Tiếng Việt' }] }], [[1, 2], [1, 2]], [5, 5], ['"chữ"', 'chữ'], [false, false], ['null', null]]) {
    const g = gia(() => ({ status: 200, body }));
    const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('f');
    assert.deepStrictEqual(r.data, mong, JSON.stringify(body)); assert.strictEqual(r.error, null);
  }
  const g = gia(() => ({ status: 204 }));
  const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('f');
  assert.strictEqual(r.data, null); assert.strictEqual(r.error, null);
});
test('máy chủ chưa có hàm (404 PGRST202): error giữ code và message, tenant.js nhận ra là "chưa bật"', async () => {
  const g = gia(() => ({ status: 404, body: { code: 'PGRST202', message: 'Could not find the function public.tenant_bank(p_token) in the schema cache', details: 'Searched for...', hint: null } }));
  const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('tenant_bank', { p_token: 't' });
  assert.strictEqual(r.data, null); assert.strictEqual(r.error.code, 'PGRST202'); assert.strictEqual(r.status, 404);
  assert.ok(rpcMissing(r.error));
  assert.strictEqual(r.error.hint, '');
});
test('lỗi của hàm (ví dụ mã sai 400 / P0001) giữ nguyên lời nhắn của máy chủ, không bị coi là "chưa bật"', async () => {
  const g = gia(() => ({ status: 400, body: { code: 'P0001', message: 'SAI_MA', details: null, hint: null } }));
  const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('tenant_login', { p_phone: '0900000000', p_code: '000000' });
  assert.strictEqual(r.error.message, 'SAI_MA'); assert.strictEqual(r.error.code, 'P0001'); assert.ok(!rpcMissing(r.error));
});
test('lỗi không phải JSON (cổng mạng trả trang HTML 502) hay trống: vẫn có lời nhắn, không văng', async () => {
  for (const [st, body] of [[502, '<html>Bad gateway</html>'], [500, ''], [503, undefined]]) {
    const g = gia(() => ({ status: st, body }));
    const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('f');
    assert.strictEqual(r.data, null); assert.ok(r.error.message.length > 0, st); assert.strictEqual(r.error.code, ''); assert.strictEqual(r.status, st);
  }
});
test('mất mạng (fetch ném lỗi): KHÔNG ném ra ngoài mà trả error (như supabase-js), để tenant.js dùng bản đã lưu', async () => {
  const g = gia(() => new TypeError('Failed to fetch'));
  const r = await R.createClient(URL0, KEY, { fetch: g.f }).rpc('tenant_data', { p_token: 't' });
  assert.strictEqual(r.data, null); assert.match(r.error.message, /Failed to fetch/); assert.strictEqual(r.status, 0);
  assert.ok(!rpcMissing(r.error));
});
test('máy chủ không trả lời quá thời hạn: tự hủy và trả lỗi "không trả lời"', async () => {
  const g = gia((u, opt) => new Promise((res, rej) => { opt.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))); }));
  const t0 = Date.now();
  let canh;
  const r = await Promise.race([R.createClient(URL0, KEY, { fetch: g.f, hetGio: 60 }).rpc('tenant_data'),
    new Promise((res, rej) => { canh = setTimeout(() => rej(new Error('không tự hủy: chờ mãi')), 3000); })]);
  clearTimeout(canh);
  assert.ok(Date.now() - t0 < 2000); assert.strictEqual(r.data, null); assert.match(r.error.message, /không trả lời/);
});
test('đọc nội dung trả lời bị đứt giữa chừng cũng là lỗi mạng, không văng', async () => {
  const f = async () => ({ ok: true, status: 200, text: async () => { throw new TypeError('network error'); } });
  const r = await R.createClient(URL0, KEY, { fetch: f }).rpc('f');
  assert.strictEqual(r.data, null); assert.match(r.error.message, /network error/);
});
test('tên hàm lạ (có / , .. , chữ hoa, khoảng trắng) bị từ chối, không gửi đi đâu', async () => {
  const g = gia(() => ({ status: 200, body: 1 }));
  const c = R.createClient(URL0, KEY, { fetch: g.f });
  for (const ten of ['../auth/v1/user', 'a/b', 'Tenant_Data', 'a b', '', null, 'x'.repeat(70)]) {
    const r = await c.rpc(ten); assert.ok(r.error, String(ten)); assert.strictEqual(r.error.code, 'TEN_HAM');
  }
  assert.strictEqual(g.log.length, 0);
});
test('mỗi lần gọi là một lần fetch riêng; gọi song song không lẫn kết quả', async () => {
  const g = gia(async (u, opt) => { const a = JSON.parse(opt.body); await new Promise((r) => setTimeout(r, a.d)); return { status: 200, body: a.n }; });
  const c = R.createClient(URL0, KEY, { fetch: g.f });
  const kq = await Promise.all([c.rpc('f', { n: 1, d: 30 }), c.rpc('f', { n: 2, d: 5 }), c.rpc('f', { n: 3, d: 15 })]);
  assert.deepStrictEqual(kq.map((x) => x.data), [1, 2, 3]);
});

/* ============================================================
   Nối vào app khách: đối chiếu mã nguồn
   ============================================================ */
const h = doc('tenant-app/index.html'), t = doc('tenant-app/js/tenant.js'), sw = doc('tenant-app/sw.js');
test('index.html không còn tải supabase-js từ CDN, không còn thẻ tenant-app/js/config.js (404 trên bản chính)', () => {
  assert.ok(!/<script[^>]+supabase/.test(h), 'còn thẻ supabase-js');
  assert.ok(!/<script src="js\/config\.js/.test(h), 'còn thẻ js/config.js riêng của app khách');
  assert.ok(h.includes('src="../js/config.js'), 'phải còn cấu hình dùng chung');
});
test('index.html nạp rpc-lite.js sau cấu hình và trước tenant.js', () => {
  const a = h.indexOf('../js/config.js'), b = h.indexOf('js/rpc-lite.js?v='), c = h.indexOf('js/tenant.js?v=');
  assert.ok(a > 0 && a < b && b < c, [a, b, c].join(','));
});
test('tenant.js dùng HH.rpcLite, không còn gọi thẳng supabase.createClient; mọi chỗ gọi máy chủ đều qua client.rpc', () => {
  assert.match(t, /const RL = window\.HH && HH\.rpcLite;/);
  assert.match(t, /RL\.createClient\(cfg\.supabaseUrl, cfg\.supabaseAnonKey\)/);
  assert.ok(!/supabase\.createClient|typeof supabase/.test(t));
  assert.ok(!/client\.(from|auth|storage|functions|channel)\b/.test(t), 'app khách chỉ được dùng client.rpc');
});
test('phông chữ không chặn vẽ trang (media=print rồi đổi khi tải xong), có bản dự phòng khi tắt JavaScript', () => {
  const the = h.replace(/<noscript>[\s\S]*?<\/noscript>/g, '').match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/g) || [];
  assert.ok(the.length >= 2);
  the.forEach((x) => assert.match(x, /media="print" onload="this\.media='all'"/));
  assert.match(h, /<noscript><link href="https:\/\/fonts\.googleapis\.com/);
});
test('service worker lưu rpc-lite.js và cấu hình (mở lại được khi mất mạng), đã nâng tên bộ nhớ đệm', () => {
  assert.ok(sw.includes("'./js/rpc-lite.js'")); assert.ok(sw.includes("'../js/config.js'"));
  assert.ok(+/hh-tenant-v(\d+)/.exec(sw)[1] >= 31);
});

(async () => {
  for (const [ten, fn] of cho) {
    try { await fn(); ok++; console.log('  ok   ' + ten); }
    catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
  }
  console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
  process.exit(hong ? 1 : 0);
})();

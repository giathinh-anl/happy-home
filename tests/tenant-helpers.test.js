/* Kiểm thử các hàm thuần của app khách thuê (tenant-app/js/helpers.js).
   Chạy:  node tests/tenant-helpers.test.js */
const assert = require('assert');
const H = require('../tenant-app/js/helpers.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + e.message.split('\n')[0]); }
};

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';

console.log('Cài app về màn hình chính');
test('đã mở từ màn hình chính thì không gợi ý nữa', () => assert.strictEqual(H.installMode({ ua: IPHONE, standalone: true }), 'installed'));
test('Android có sẵn lời mời cài: cài một chạm', () => assert.strictEqual(H.installMode({ ua: ANDROID, promptReady: true }), 'prompt'));
test('iPhone: hướng dẫn tự bấm Chia sẻ', () => assert.strictEqual(H.installMode({ ua: IPHONE }), 'ios'));
test('iPad bật chế độ máy tính (UA Macintosh, có cảm ứng): vẫn là iOS', () => assert.strictEqual(H.installMode({ ua: MAC, maxTouch: 5 }), 'ios'));
test('Mac thật (không cảm ứng): không gợi ý', () => assert.strictEqual(H.installMode({ ua: MAC, maxTouch: 0 }), 'other'));
test('Windows: không gợi ý', () => assert.strictEqual(H.installMode({ ua: WIN }), 'other'));
test('Android chưa có lời mời (đã cài rồi hoặc trình duyệt khác): không gợi ý', () => assert.strictEqual(H.installMode({ ua: ANDROID }), 'other'));
test('thiếu hết thông tin vẫn không ném lỗi', () => assert.strictEqual(H.installMode(), 'other'));
test('đã cài thắng cả lời mời cài', () => assert.strictEqual(H.installMode({ standalone: true, promptReady: true }), 'installed'));

console.log('Tệp lịch .ics');
const INV = { id: 'HD2610001', period: '2026-10', dueDate: '2026-11-05', total: 5320000, paid: 320000 };
const NOW = new Date(Date.UTC(2026, 10, 3, 8, 30, 15));
const ics = (o, i) => H.buildIcs(i || INV, Object.assign({ room: 'P302', now: NOW }, o || {}));
test('là một lịch hợp lệ có đủ phần đầu và cuối', () => { const s = ics(); assert.ok(s.startsWith('BEGIN:VCALENDAR\r\n') && s.trimEnd().endsWith('END:VCALENDAR')); assert.ok(s.includes('BEGIN:VEVENT') && s.includes('END:VEVENT')); });
test('dòng nào cũng kết thúc bằng CRLF, không có LF trần', () => { const s = ics(); assert.ok(!/[^\r]\n/.test(s)); });
test('sự kiện cả ngày đúng ngày hạn, DTEND là ngày hôm sau', () => { const s = ics(); assert.ok(s.includes('DTSTART;VALUE=DATE:20261105')); assert.ok(s.includes('DTEND;VALUE=DATE:20261106')); });
test('hạn cuối tháng: ngày kết thúc sang tháng sau', () => assert.ok(ics({}, Object.assign({}, INV, { dueDate: '2026-10-31' })).includes('DTEND;VALUE=DATE:20261101')));
test('hạn cuối năm: ngày kết thúc sang năm sau', () => assert.ok(ics({}, Object.assign({}, INV, { dueDate: '2026-12-31' })).includes('DTEND;VALUE=DATE:20270101')));
test('hạn 28/2 năm nhuận: kết thúc 29/2', () => assert.ok(ics({}, Object.assign({}, INV, { dueDate: '2028-02-28' })).includes('DTEND;VALUE=DATE:20280229')));
test('có nhắc trước 1 ngày', () => assert.ok(ics().includes('TRIGGER:-P1D')));
test('tiêu đề có phòng và kỳ, mô tả có số còn nợ (đã trừ phần trả)', () => { const s = ics(); assert.ok(s.includes('SUMMARY:Đóng tiền phòng P302\\, T10/2026')); assert.ok(s.includes('5.000.000 ₫')); });
test('dấu phẩy, chấm phẩy, xuống dòng trong chữ được thoát đúng chuẩn', () => { const s = H.buildIcs(INV, { room: 'A;B,C\nD', now: NOW }); assert.ok(s.includes('A\\;B\\,C\\nD')); });
test('mã duy nhất theo hóa đơn, dấu thời gian theo giờ UTC', () => { const s = ics(); assert.ok(s.includes('UID:HD2610001@happyhome')); assert.ok(s.includes('DTSTAMP:20261103T083015Z')); });
test('không có hạn hoặc hạn sai dạng thì không tạo lịch', () => { assert.strictEqual(H.buildIcs(Object.assign({}, INV, { dueDate: '' })), null); assert.strictEqual(H.buildIcs(Object.assign({}, INV, { dueDate: 'abc' })), null); assert.strictEqual(H.buildIcs(null), null); });
test('hóa đơn đã trả đủ: còn phải đóng 0 ₫, không âm', () => assert.ok(ics({}, Object.assign({}, INV, { paid: 9e6 })).includes('Còn phải đóng 0 ₫')));

console.log('Chia sẻ hóa đơn');
const BANK = { name: 'MB Bank', account: '0912345678', holder: 'NGUYEN VAN A' };
test('còn nợ: có số tiền, hạn, tài khoản và nội dung', () => {
  const t = H.shareText(INV, { room: 'P302', building: 'Happy Home Quận 7', bank: BANK, content: 'HD2610001' });
  assert.ok(t.startsWith('Hóa đơn T10/2026, phòng P302 (Happy Home Quận 7)'));
  assert.ok(t.includes('Còn phải đóng: 5.000.000 ₫') && t.includes('Hạn: 05/11/2026') && t.includes('MB Bank 0912345678, NGUYEN VAN A') && t.includes('Nội dung: HD2610001'));
});
test('chủ nhà chưa khai tài khoản: không in dòng chuyển khoản (không bịa số)', () => { const t = H.shareText(INV, { room: 'P302', bank: null, content: 'HD2610001' }); assert.ok(!/Chuyển khoản|Nội dung/.test(t)); });
test('tài khoản rỗng cũng không in', () => assert.ok(!/Chuyển khoản/.test(H.shareText(INV, { bank: { name: 'MB', account: '' }, content: 'X' }))));
test('đã trả đủ: ghi "Đã thanh toán đủ", không có hạn và không có số tài khoản', () => {
  const t = H.shareText(Object.assign({}, INV, { paid: INV.total }), { bank: BANK, content: 'HD2610001' });
  assert.ok(t.includes('Đã thanh toán đủ: 5.320.000 ₫') && !/Hạn|Chuyển khoản/.test(t));
});
test('thiếu phòng và tòa vẫn ra tiêu đề gọn', () => assert.strictEqual(H.shareText(INV).split('\n')[0], 'Hóa đơn T10/2026'));

console.log('Bản lưu xem khi mất mạng');
const DATA = { tenant: { fullName: 'An', phone: '0901', roomCode: 'P1', idNumber: '079300001234', dob: '1998-05-12' }, invoices: [{ id: 'HD1' }] };
const T0 = new Date('2026-11-03T08:00:00Z');
test('bỏ số CCCD và ngày sinh, giữ phần còn lại', () => { const e = H.cacheEnvelope(DATA, '0901234567', T0); assert.ok(!('idNumber' in e.data.tenant) && !('dob' in e.data.tenant)); assert.strictEqual(e.data.tenant.fullName, 'An'); assert.strictEqual(e.data.invoices.length, 1); });
test('không làm hỏng dữ liệu gốc đang dùng', () => { H.cacheEnvelope(DATA, '0901234567', T0); assert.strictEqual(DATA.tenant.idNumber, '079300001234'); });
test('đọc lại đúng người trong hạn', () => { const r = H.readCache(JSON.stringify(H.cacheEnvelope(DATA, '0901234567', T0)), '0901234567', new Date('2026-11-03T08:45:00Z')); assert.strictEqual(r.ageMin, 45); assert.strictEqual(r.data.invoices[0].id, 'HD1'); });
test('số điện thoại khác (máy dùng chung) thì không đọc', () => assert.strictEqual(H.readCache(H.cacheEnvelope(DATA, '0901234567', T0), '0999999999', T0), null));
test('quá 30 ngày thì bỏ', () => assert.strictEqual(H.readCache(H.cacheEnvelope(DATA, '0901234567', T0), '0901234567', new Date('2026-12-04T08:00:00Z')), null));
test('đúng 30 ngày còn đọc được', () => assert.ok(H.readCache(H.cacheEnvelope(DATA, '0901234567', T0), '0901234567', new Date('2026-12-03T08:00:00Z'))));
test('đồng hồ máy lùi (ngày lưu ở tương lai) thì bỏ', () => assert.strictEqual(H.readCache(H.cacheEnvelope(DATA, '0901234567', new Date('2026-12-01T00:00:00Z')), '0901234567', T0), null));
test('chuỗi hỏng, rỗng, sai phiên bản: trả null, không ném lỗi', () => { assert.strictEqual(H.readCache('{xx', 'a', T0), null); assert.strictEqual(H.readCache(null, 'a', T0), null); assert.strictEqual(H.readCache({ v: 99, phone: 'a', savedAt: T0.toISOString(), data: {} }, 'a', T0), null); });
test('nhãn thời gian: vừa xong, phút, giờ, hôm qua, ngày', () => { assert.strictEqual(H.ageLabel(0), 'vừa xong'); assert.strictEqual(H.ageLabel(1), 'vừa xong'); assert.strictEqual(H.ageLabel(2), '2 phút trước'); assert.strictEqual(H.ageLabel(59), '59 phút trước'); assert.strictEqual(H.ageLabel(60), '1 giờ trước'); assert.strictEqual(H.ageLabel(23 * 60 + 59), '23 giờ trước'); assert.strictEqual(H.ageLabel(24 * 60), 'hôm qua'); assert.strictEqual(H.ageLabel(3 * 24 * 60), '3 ngày trước'); });

console.log('Mã vào app mới');
test('mã tốt', () => assert.strictEqual(H.codeProblem('482915'), null));
test('chưa đủ 6 số, nhiều hơn 6 số, có chữ, rỗng, null', () => { ['12345', '1234567', '12a456', '', null, undefined, '12 456'].forEach(c => assert.ok(H.codeProblem(c), String(c))); });
test('6 số giống nhau', () => { ['000000', '111111', '999999'].forEach(c => assert.ok(/giống nhau/.test(H.codeProblem(c)), c)); });
test('dãy tăng hoặc giảm liên tiếp', () => { ['123456', '234567', '456789', '654321', '987654', '012345'].forEach(c => assert.ok(/liên tiếp/.test(H.codeProblem(c)), c)); });
test('gần giống dãy nhưng không phải thì chấp nhận', () => { ['123457', '135791', '121212', '112233'].forEach(c => assert.strictEqual(H.codeProblem(c), null, c)); });
test('trùng 6 số cuối số điện thoại thì từ chối', () => assert.ok(/số điện thoại/.test(H.codeProblem('234567', '0901234567') === null ? '' : H.codeProblem('234567', '0901234567')) || /liên tiếp/.test(H.codeProblem('234567', '0901234567'))));
test('6 số cuối điện thoại (không phải dãy) bị từ chối', () => assert.ok(/số điện thoại/.test(H.codeProblem('482915', '0904482915'))));
test('mã khác 6 số cuối điện thoại thì qua', () => assert.strictEqual(H.codeProblem('482915', '0901234567'), null));
test('không có số điện thoại thì bỏ qua luật này', () => assert.strictEqual(H.codeProblem('482915', ''), null));

console.log('Soát số điện');
test('số hợp lệ lớn hơn kỳ trước: ổn', () => assert.strictEqual(H.meterCheck({ value: 1500, prev: 1310, avg: 180 }).level, 'ok'));
test('không có số kỳ trước: ổn', () => assert.strictEqual(H.meterCheck({ value: 1500 }).level, 'ok'));
test('rỗng, chữ, âm, số thập phân: lỗi, không gửi được', () => { ['', 'abc', -5, 12.5, null, undefined].forEach(v => assert.strictEqual(H.meterCheck({ value: v, prev: 100 }).level, 'error', String(v))); });
test('nhỏ hơn kỳ trước: cảnh báo, hỏi lại', () => { const r = H.meterCheck({ value: 1200, prev: 1310 }); assert.strictEqual(r.level, 'warn'); assert.ok(r.msg.includes('1310')); });
test('bằng đúng kỳ trước (không dùng điện): ổn', () => assert.strictEqual(H.meterCheck({ value: 1310, prev: 1310, avg: 180 }).level, 'ok'));
test('dùng gấp hơn 3 lần mức thường: cảnh báo', () => assert.strictEqual(H.meterCheck({ value: 1310 + 541, prev: 1310, avg: 180 }).level, 'warn'));
test('đúng 3 lần mức thường: chưa cảnh báo', () => assert.strictEqual(H.meterCheck({ value: 1310 + 540, prev: 1310, avg: 180 }).level, 'ok'));
test('không có mức thường thì không cảnh báo vọt cao', () => assert.strictEqual(H.meterCheck({ value: 99999, prev: 100, avg: 0 }).level, 'ok'));
test('số ở dạng chuỗi chữ số được chấp nhận', () => assert.strictEqual(H.meterCheck({ value: '1500', prev: '1310', avg: 180 }).level, 'ok'));

console.log('Đọc câu trả lời của AI');
test('JSON thuần', () => assert.deepStrictEqual(H.parseMeterAnswer('{"value": 12680, "confidence": "high"}'), { value: 12680, confidence: 'high' }));
test('bọc trong ```json', () => assert.deepStrictEqual(H.parseMeterAnswer('```json\n{"value":"01268","confidence":"medium"}\n```'), { value: 1268, confidence: 'medium' }));
test('có chữ thừa quanh JSON', () => assert.strictEqual(H.parseMeterAnswer('Kết quả: {"value": 4521, "confidence": "high"} cảm ơn').value, 4521));
test('số lẻ (chữ số đỏ) thì lấy phần nguyên', () => { assert.strictEqual(H.parseMeterAnswer('{"value":"12680.3","confidence":"high"}').value, 12680); assert.strictEqual(H.parseMeterAnswer('{"value":"12,5","confidence":"high"}').value, 12); });
test('AI không đọc được (value null): value null và độ chắc thấp', () => assert.deepStrictEqual(H.parseMeterAnswer('{"value": null, "confidence": "high"}'), { value: null, confidence: 'low' }));
test('không phải JSON, rỗng, null: không ném lỗi', () => { ['không thấy số', '', null, undefined, '{hỏng'].forEach(t => assert.deepStrictEqual(H.parseMeterAnswer(t), { value: null, confidence: 'low' }, String(t))); });
test('giá trị chữ hoặc quá dài bị loại', () => { assert.strictEqual(H.parseMeterAnswer('{"value":"abc","confidence":"high"}').value, null); assert.strictEqual(H.parseMeterAnswer('{"value":"123456789","confidence":"high"}').value, null); });
test('độ chắc lạ thì coi là thấp', () => assert.strictEqual(H.parseMeterAnswer('{"value":100,"confidence":"chắc chắn"}').confidence, 'low'));

console.log('Thông báo đẩy');
const PE = (o) => Object.assign({ hasKey: true, hasSW: true, hasPush: true, hasNotification: true, permission: 'default', subscribed: false }, o || {});
test('chưa có khóa VAPID: ẩn mục này', () => assert.strictEqual(H.pushMode(PE({ hasKey: false })), 'off-config'));
test('thiếu cấu hình thắng cả khi mọi thứ khác ổn', () => assert.strictEqual(H.pushMode({ hasKey: false, hasSW: true, hasPush: true, hasNotification: true, subscribed: true }), 'off-config'));
test('hỗ trợ đủ, chưa đăng ký: off', () => assert.strictEqual(H.pushMode(PE()), 'off'));
test('đã đăng ký: on', () => assert.strictEqual(H.pushMode(PE({ subscribed: true, permission: 'granted' })), 'on'));
test('khách đã chặn: denied (kể cả còn đăng ký cũ)', () => { assert.strictEqual(H.pushMode(PE({ permission: 'denied' })), 'denied'); assert.strictEqual(H.pushMode(PE({ permission: 'denied', subscribed: true })), 'denied'); });
test('iPhone chưa thêm vào màn hình chính (không có PushManager): bảo cài app trước', () => assert.strictEqual(H.pushMode(PE({ hasPush: false, ios: true, standalone: false })), 'need-install'));
test('iPhone đã cài và có API: dùng như bình thường', () => assert.strictEqual(H.pushMode(PE({ ios: true, standalone: true })), 'off'));
test('trình duyệt cũ không hỗ trợ (không phải iPhone): ẩn', () => { assert.strictEqual(H.pushMode(PE({ hasPush: false })), 'unsupported'); assert.strictEqual(H.pushMode(PE({ hasSW: false })), 'unsupported'); assert.strictEqual(H.pushMode(PE({ hasNotification: false })), 'unsupported'); });
test('iPhone đã cài nhưng vẫn thiếu API: không hiện, không bảo cài lại', () => assert.strictEqual(H.pushMode(PE({ hasPush: false, ios: true, standalone: true })), 'unsupported'));
test('thiếu hết thông tin: không ném lỗi', () => assert.strictEqual(H.pushMode(), 'off-config'));
test('đổi khóa VAPID base64 URL sang byte (65 byte, bắt đầu 0x04)', () => {
  const key = 'BEl62iUYgUivxIkv69yViEuiBIa-ib37J8YMdyi2d8T4xQ9Hl1QJOQkVMW_Z8ZLZNGpZW3Ma2V8_Y6M9gW3Zs5I';
  const b = H.urlBase64ToBytes(key); assert.ok(b instanceof Uint8Array && b.length === 65 && b[0] === 4, b.length + ' ' + b[0]);
});
test('ký tự - và _ được đổi đúng thành + và /', () => assert.deepStrictEqual(Array.from(H.urlBase64ToBytes('-_-_')), [251, 255, 191]));
test('khóa rỗng cho mảng rỗng, không ném lỗi', () => { assert.strictEqual(H.urlBase64ToBytes('').length, 0); assert.strictEqual(H.urlBase64ToBytes(null).length, 0); });

/* ---------- Dự báo điện tháng tới ---------- */
const K = (period, elec) => ({ period, label: 'T' + Number(period.slice(5)) + '/' + period.slice(0, 4), elec });
const DS = [K('2026-10', 120), K('2026-09', 100), K('2026-08', 80), K('2026-07', 500)];     // mới nhất trước
test('dự báo: trung bình 3 kỳ gần nhất (kỳ cũ hơn không tính) nhân đơn giá, ghi rõ kỳ tới', () => {
  const f = H.usageForecast(DS, 3500);
  assert.strictEqual(f.ok, true); assert.strictEqual(f.kwh, 100); assert.strictEqual(f.tien, 350000);
  assert.strictEqual(f.coSo, 3); assert.strictEqual(f.thang, '2026-11'); assert.strictEqual(f.nhan, 'T11/2026');
});
test('dự báo: so sánh kỳ mới nhất với kỳ trước (tăng, giảm, bằng nhau, kỳ trước bằng 0)', () => {
  const tang = H.usageForecast(DS, 3500); assert.strictEqual(tang.pct, 20); assert.strictEqual(tang.huong, 'tang'); assert.strictEqual(tang.moi, 120); assert.strictEqual(tang.truoc, 100);
  const giam = H.usageForecast([K('2026-10', 90), K('2026-09', 100)], 3500); assert.strictEqual(giam.pct, -10); assert.strictEqual(giam.huong, 'giam');
  const bang = H.usageForecast([K('2026-10', 100), K('2026-09', 100)], 3500); assert.strictEqual(bang.pct, 0); assert.strictEqual(bang.huong, 'dung');
  const khong = H.usageForecast([K('2026-10', 50), K('2026-09', 0)], 3500); assert.strictEqual(khong.pct, null); assert.strictEqual(khong.huong, 'dung');
});
test('dự báo: chỉ có 2 kỳ thì vẫn dự báo (trung bình 2 kỳ); dưới 2 kỳ thì từ chối', () => {
  const f = H.usageForecast([K('2026-10', 120), K('2026-09', 100)], 3500); assert.strictEqual(f.ok, true); assert.strictEqual(f.kwh, 110); assert.strictEqual(f.coSo, 2);
  assert.deepStrictEqual(H.usageForecast([K('2026-10', 120)], 3500), { ok: false, ly: 'chua-du', coSo: 1 });
  assert.strictEqual(H.usageForecast([], 3500).ok, false);
});
test('dự báo: trả nhãn kỳ mới nhất và kỳ trước (để màn hình nói đúng "tháng nào so với tháng nào")', () => {
  const f = H.usageForecast(DS, 3500); assert.strictEqual(f.moiNhan, 'T10/2026'); assert.strictEqual(f.truocNhan, 'T9/2026');
  const g = H.usageForecast([K('2026-10', 120), K('2026-09', null), K('2026-08', 100)], 3500); assert.strictEqual(g.truocNhan, 'T8/2026');
});
test('dự báo: tháng 12 sang tháng 1 năm sau', () => {
  const f = H.usageForecast([K('2026-12', 100), K('2026-11', 100)], 3500); assert.strictEqual(f.thang, '2027-01'); assert.strictEqual(f.nhan, 'T1/2027');
});
test('dự báo: kỳ không có số (elec null) bị bỏ qua, không kéo trung bình về 0', () => {
  const f = H.usageForecast([K('2026-10', 120), K('2026-09', null), K('2026-08', 100), K('2026-07', 80)], 3500);
  assert.strictEqual(f.kwh, 100); assert.strictEqual(f.coSo, 3); assert.strictEqual(f.truoc, 100);
});
test('dự báo: đơn giá thiếu hoặc không hợp lệ thì chỉ có kWh, không có tiền (không bịa)', () => {
  [null, undefined, 0, -5, NaN, 'abc'].forEach((g) => { const f = H.usageForecast(DS, g); assert.strictEqual(f.ok, true); assert.strictEqual(f.tien, null, String(g)); assert.strictEqual(f.kwh, 100); });
});
test('dự báo: dữ liệu hỏng (không phải mảng, phần tử null, kỳ sai dạng, số âm hoặc chữ) không ném lỗi và không bị tính', () => {
  assert.strictEqual(H.usageForecast(null, 3500).ok, false); assert.strictEqual(H.usageForecast('x', 3500).ok, false);
  const f = H.usageForecast([null, K('2026-10', 100), { period: 'xx', elec: 5 }, { period: '2026-09', elec: -4 }, { period: '2026-08', elec: '9' }, K('2026-07', 200)], 1000);
  assert.strictEqual(f.ok, true); assert.strictEqual(f.coSo, 2); assert.strictEqual(f.kwh, 150);
});
test('dự báo: làm tròn kWh và tiền về số nguyên', () => {
  const f = H.usageForecast([K('2026-10', 101), K('2026-09', 100)], 3333); assert.strictEqual(f.kwh, 101); assert.strictEqual(f.tien, 336633);
  const g = H.usageForecast([K('2026-10', 100), K('2026-09', 101), K('2026-08', 101)], 1); assert.strictEqual(g.kwh, 101);
});
test('dự báo: không sửa danh sách truyền vào', () => {
  const goc = JSON.stringify(DS); H.usageForecast(DS, 3500); assert.strictEqual(JSON.stringify(DS), goc);
});

/* ---------- Đọc số tiền thành chữ ---------- */
const CHU = { 0: 'không', 1: 'một', 5: 'năm', 10: 'mười', 11: 'mười một', 15: 'mười lăm', 20: 'hai mươi', 21: 'hai mươi mốt', 24: 'hai mươi bốn', 25: 'hai mươi lăm', 30: 'ba mươi',
  45: 'bốn mươi lăm', 99: 'chín mươi chín', 100: 'một trăm', 101: 'một trăm linh một', 105: 'một trăm linh năm', 110: 'một trăm mười', 111: 'một trăm mười một',
  115: 'một trăm mười lăm', 120: 'một trăm hai mươi', 121: 'một trăm hai mươi mốt', 205: 'hai trăm linh năm', 999: 'chín trăm chín mươi chín',
  1000: 'một nghìn', 1001: 'một nghìn không trăm linh một', 1005: 'một nghìn không trăm linh năm', 1010: 'một nghìn không trăm mười', 1100: 'một nghìn một trăm',
  1500: 'một nghìn năm trăm', 10000: 'mười nghìn', 15000: 'mười lăm nghìn', 21000: 'hai mươi mốt nghìn', 100000: 'một trăm nghìn', 123456: 'một trăm hai mươi ba nghìn bốn trăm năm mươi sáu',
  1000000: 'một triệu', 1000050: 'một triệu không trăm năm mươi', 2180000: 'hai triệu một trăm tám mươi nghìn', 3943000: 'ba triệu chín trăm bốn mươi ba nghìn',
  4149000: 'bốn triệu một trăm bốn mươi chín nghìn', 1000000000: 'một tỷ', 1500000000: 'một tỷ năm trăm triệu', 1000000001: 'một tỷ không trăm linh một' };
Object.keys(CHU).forEach((n) => test('đọc số ' + Number(n).toLocaleString('en-US') + ' thành chữ', () => assert.strictEqual(H.docSoThanhChu(Number(n)), CHU[n])));
test('đọc số lớn nhất hỗ trợ (999.999.999.999)', () => assert.strictEqual(H.docSoThanhChu(999999999999),
  'chín trăm chín mươi chín tỷ chín trăm chín mươi chín triệu chín trăm chín mươi chín nghìn chín trăm chín mươi chín'));
test('đọc số: làm tròn số lẻ, nhận chuỗi số; âm, NaN, rỗng, quá lớn trả chuỗi rỗng', () => {
  assert.strictEqual(H.docSoThanhChu(1000.4), 'một nghìn'); assert.strictEqual(H.docSoThanhChu('2180000'), 'hai triệu một trăm tám mươi nghìn');
  [-1, NaN, 'abc', undefined, 1e12, Infinity].forEach((v) => assert.strictEqual(H.docSoThanhChu(v), '', String(v)));
});
test('đọc số: không bao giờ ra "một mươi", "năm mươi lăm" sai (hàng đơn vị 5 sau hàng chục là "lăm"), hay "mươi một"', () => {
  for (let i = 0; i < 1000; i++) {
    const t = H.docSoThanhChu(i);
    assert.ok(t && !/một mươi|mươi một|mười mốt|linh lăm|không mươi/.test(t), i + ': ' + t);
    if (i % 100 >= 20 && i % 10 === 5) assert.ok(/lăm$/.test(t), i + ': ' + t);
    if (i % 100 >= 20 && i % 10 === 1) assert.ok(/mốt$/.test(t), i + ': ' + t);
  }
});

/* ---------- Biên lai ---------- */
const PAY = { id: 'pm-1', amount: 3943000, method: 'Chuyển khoản', date: '2026-11-05', invoiceId: 'HD2610001' };
test('biên lai: đủ trường, số tiền bằng chữ viết hoa chữ đầu và có "đồng"', () => {
  const b = H.bienLai(PAY, { khach: 'Nguyễn Văn A', phong: 'P101', toa: 'Happy Home Quận 7', ky: 'T10/2026' });
  assert.deepStrictEqual(b, { ma: 'pm-1', ngay: '2026-11-05', soTien: 3943000, soTienChu: 'Ba triệu chín trăm bốn mươi ba nghìn đồng', hinhThuc: 'Chuyển khoản',
    hoaDon: 'HD2610001', ky: 'T10/2026', khach: 'Nguyễn Văn A', phong: 'P101', toa: 'Happy Home Quận 7' });
});
test('biên lai: thiếu thông tin phụ thì để chuỗi rỗng, không ghi "undefined"', () => {
  const b = H.bienLai({ id: 7, amount: 1000 }); assert.strictEqual(b.ma, '7'); assert.strictEqual(b.khach, ''); assert.strictEqual(b.hinhThuc, ''); assert.strictEqual(b.ngay, null);
  assert.ok(!JSON.stringify(b).includes('undefined'));
});
test('biên lai: khoản không có thật (số tiền 0, âm, chữ, thiếu, không có dòng thanh toán) thì không lập', () => {
  [0, -5, 'abc', null, undefined, NaN].forEach((a) => assert.strictEqual(H.bienLai({ id: 'x', amount: a }, {}), null, String(a)));
  assert.strictEqual(H.bienLai(null, {}), null); assert.strictEqual(H.bienLai(undefined, {}), null);
});
test('biên lai: số tiền lẻ được làm tròn cả ở số lẫn chữ (hai nơi luôn khớp)', () => {
  const b = H.bienLai({ id: 'x', amount: 1999.6 }, {}); assert.strictEqual(b.soTien, 2000); assert.strictEqual(b.soTienChu, 'Hai nghìn đồng');
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

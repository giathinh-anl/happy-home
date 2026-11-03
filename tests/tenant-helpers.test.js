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

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

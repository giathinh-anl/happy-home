/* Tạo cặp khóa VAPID cho thông báo đẩy (Web Push). Chạy:  node tools/push/tao-khoa-vapid.js

   In hai dòng ra màn hình: khóa CÔNG KHAI (dán vào js/config.js, commit được) và khóa BÍ MẬT (chỉ đưa vào bí mật của Supabase:
   supabase secrets set VAPID_PRIVATE_KEY=...). Công cụ này KHÔNG ghi gì vào tệp. Khóa bí mật lộ ra thì ai cũng gửi được thông báo
   giả mạo tới khách của bạn: đừng dán vào chat, tệp dự án hay ảnh chụp màn hình. Mất khóa bí mật thì tạo lại cặp mới, khách bật thông báo lại một lần.
   Hàm taoKhoa() tách riêng để kiểm thử (tests/push-send.test.js). */
const { generateKeyPairSync } = require('crypto');

function taoKhoa() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' }), prv = privateKey.export({ format: 'jwk' });
  // khóa công khai dạng "không nén": 0x04 + X (32 byte) + Y (32 byte), base64 an toàn cho URL, đúng thứ trình duyệt cần
  const congKhai = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
  return { congKhai, biMat: prv.d };
}

module.exports = { taoKhoa };

if (require.main === module) {
  const k = taoKhoa();
  console.log('Khóa CÔNG KHAI (dán vào js/config.js, mục vapidPublicKey):');
  console.log(k.congKhai);
  console.log('\nKhóa BÍ MẬT (chỉ dán vào: supabase secrets set VAPID_PRIVATE_KEY=...). Đừng gửi cho ai, đừng lưu vào dự án:');
  console.log(k.biMat);
}

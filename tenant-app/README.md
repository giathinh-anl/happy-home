# Happy Home — App khách thuê (folder riêng)

Ứng dụng dành cho **khách thuê** (ưu tiên điện thoại), **tự chứa** — deploy độc lập được, tách khỏi app quản trị.

## Cách chạy
- Mở `tenant-app/index.html` bằng trình duyệt, hoặc chạy máy chủ tĩnh rồi vào `http://localhost:PORT/tenant-app/`.
- Cần `tenant-app/js/config.js` chứa URL + anon key Supabase (giống app quản trị). Copy từ `config.example.js`.

## Yêu cầu backend
Phải chạy **`supabase/migration-tenant-app.sql`** (ở repo gốc) một lần để bật các hàm RPC:
`tenant_data`, `tenant_create_incident`, `tenant_notify_paid`, `tenant_submit_reading`.

## Đăng nhập (demo)
Nhập **số điện thoại** của một khách thuê có trong hệ thống (xem ở app quản trị → Khách thuê) → mã OTP demo **`123456`**.

## Chức năng (Phần IV)
- Trang chủ: thẻ công nợ, truy cập nhanh, thông báo
- Hóa đơn: danh sách + chi tiết (căn cứ tính từng dòng)
- Thanh toán: QR + chuyển khoản thủ công (nút sao chép) + "Tôi đã chuyển khoản"
- Báo hỏng: gửi yêu cầu → theo dõi timeline (hiện trong "Sự cố phòng" của chủ trọ)
- Ghi chỉ số: khách tự ghi → chờ chủ trọ duyệt

## Tiện ích thêm
- Cài về màn hình chính (biểu tượng PNG, lối tắt), chế độ tối, xem bản đã lưu khi mất mạng
- Thanh toán: lưu ảnh QR, chia sẻ, thêm hạn vào lịch (.ics)
- Gửi chỉ số điện: AI điền sẵn số từ ảnh đồng hồ, app soát số trước khi gửi
- Đổi mã vào app, "Quên mã?" (cần `supabase/migration-tenant-code-self.sql`)
- Hàm thuần ở `js/helpers.js`, kiểm thử ở `tests/tenant-helpers.test.js`

## Cấu trúc
```
tenant-app/
  index.html
  css/  tokens.css · tenant.css
  js/   config.js (không commit) · config.example.js · helpers.js (hàm thuần) · tenant.js
```

Dùng chung 1 database Supabase với app quản trị: khách báo hỏng / tự ghi chỉ số → chủ trọ thấy ngay.

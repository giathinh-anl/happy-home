# Kết nối backend thật (Supabase)

Hướng dẫn biến Happy Home từ bản chạy-một-máy thành hệ thống **nhiều người dùng, đồng bộ nhiều thiết bị**: đăng nhập thật, dữ liệu lưu trên máy chủ.

> Phần **tạo project** chỉ bạn làm được (không thể tự động hóa). Mất ~5–10 phút. Phần code tích hợp do tôi làm.

---

## Bước 1 — Tạo project Supabase (miễn phí)

1. Vào https://supabase.com → **Start your project** → đăng nhập bằng GitHub/Google.
2. **New project**: đặt tên (vd `happy-home`), chọn **Region** gần VN (Singapore), đặt **Database Password** (lưu lại).
3. Đợi ~1–2 phút cho project khởi tạo xong.

## Bước 2 — Tạo bảng (database)

1. Trong project → menu trái → **SQL Editor** → **New query**.
2. Mở file [`supabase/schema.sql`](supabase/schema.sql) trong repo này, **copy toàn bộ**, dán vào ô SQL.
3. Bấm **Run**. Thấy "Success. No rows returned" là xong.
4. Kiểm tra: menu **Table Editor** sẽ thấy các bảng `buildings`, `rooms`, `tenants`, `invoices`, …

## Bước 3 — Bật đăng nhập bằng Email

1. Menu trái → **Authentication** → **Providers** → bật **Email** (thường bật sẵn).
2. **Authentication → Sign In / Providers → Email**: TẮT **Confirm email** (để đăng ký xong dùng được ngay, không phải mở mail xác nhận). *(Có thể bật lại sau khi triển khai thật.)*

## Bước 4 — Lấy khóa kết nối

1. Menu trái → **Project Settings** (⚙) → **API**.
2. Copy 2 giá trị:
   - **Project URL** → dạng `https://xxxx.supabase.co`
   - **anon public** key (mục *Project API keys*)

> ⚠️ Chỉ dùng **anon public**. KHÔNG dùng **service_role** ở phía web — nó bỏ qua bảo mật.

## Bước 5 — Điền vào app

1. Sao chép [`js/config.example.js`](js/config.example.js) thành `js/config.js`.
2. Dán **Project URL** và **anon key** vào.
3. (Tôi sẽ thêm `<script src="js/config.js">` và code tích hợp ở bước lập trình.)

---

## Bạn muốn tôi làm phần tích hợp thế nào?

Sau khi bạn xong Bước 1–4, chọn 1 trong 2:

- **A. Bạn tự giữ khóa (riêng tư hơn):** làm xong Bước 5, tôi đưa code tích hợp; bạn chỉ việc tải lại trang.
- **B. Gửi tôi làm & kiểm thử giúp:** dán **Project URL** + **anon public key** vào khung chat. Hai giá trị này *được thiết kế để công khai* (đã có Row Level Security bảo vệ), nên an toàn để chia sẻ. Tôi sẽ nối, chạy thử đăng ký/đăng nhập/thêm–sửa–xóa và xác nhận hoạt động.

---

## Kiến trúc tích hợp (tôi sẽ dựng)

- **Giữ nguyên toàn bộ giao diện & luồng nghiệp vụ hiện tại.** Chỉ thay lớp lưu trữ.
- **Đăng nhập thật:** trang Đăng nhập gọi Supabase Auth (email/mật khẩu, có Đăng ký). Phiên đăng nhập do Supabase quản lý, giữ qua các lần mở lại.
- **Tải dữ liệu:** sau khi đăng nhập, app tải toàn bộ dữ liệu của bạn từ Supabase vào bộ nhớ (giống mô hình hiện tại) → mọi trang chạy nhanh, không phải sửa.
- **Ghi xuyên suốt (write-through):** mỗi thao tác (thêm/sửa/xóa phòng, khách, hợp đồng, hóa đơn, thanh toán…) vừa cập nhật màn hình vừa ghi lên Supabase → mở máy khác thấy cùng dữ liệu.
- **Bảo mật:** Row Level Security đảm bảo mỗi tài khoản chỉ thấy dữ liệu của mình.
- **Lần đầu trống:** app tạo sẵn dữ liệu mẫu và đẩy lên, để bạn có cái xem ngay (có thể xóa sau).
- **Không cấu hình → vẫn chạy demo:** thiếu `js/config.js` thì app tự chạy chế độ localStorage như hiện nay, không lỗi.

## Chi phí
Gói **Free** của Supabase đủ cho giai đoạn này (500MB DB, 50k người dùng hoạt động/tháng). Không cần thẻ.

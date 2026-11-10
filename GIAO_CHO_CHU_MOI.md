# Giao Happy Home cho một chủ trọ mới

Hệ thống hiện chạy cho **một chủ trọ**. Dữ liệu (phòng, khách, hóa đơn, tiền về) gắn với **một tài khoản đăng nhập**, và hàm nhận tiền ngân hàng chỉ giữ **một mã bí mật**. Muốn giao cho người khác, làm các việc dưới đây. Mục nào ghi "chưa thử" là mình chưa chạy thật, nên làm xong hãy kiểm lại.

## Cách A (nhanh): giữ nguyên hệ thống, chuyển quyền cho người mới

### 1. Tài khoản đăng nhập app
- Dữ liệu nằm ở tài khoản **chutro@happyhome.vn**. Người mới cần đăng nhập được tài khoản này, hoặc bạn đổi nó sang email của họ: Supabase → **Authentication → Users** → chọn tài khoản → đổi email và đặt mật khẩu mới.
- **Mật khẩu không được là `demo1234`.** Chuỗi này (và địa chỉ chutro) có trong mã nguồn công khai; nếu tài khoản thật đang dùng mật khẩu đó thì ai đọc mã cũng vào được. Đổi ngay nếu đúng.
- Khi nào bàn giao chính thức: vào app → **Tài khoản → Xóa toàn bộ dữ liệu** (gõ `XOA HET`) để bỏ dữ liệu mẫu; tài khoản trở về trống như mới.

### 2. Nhận tiền tự động (SePay)
- Người mới tự đăng ký SePay, liên kết **ngân hàng của họ**, rồi thêm webhook:
  - URL: `https://xkfpwqzmqwhjqwyeyodr.supabase.co/functions/v1/bank-webhook`
  - Loại giao dịch: chỉ tiền vào, định dạng JSON
  - Xác thực: **API Key** = mã lấy trong app: *Khách chuyển khoản → Đối soát ngân hàng → Nối ngân hàng → Tạo secret → Chép*. Đây là mã **đã có sẵn** của tài khoản chủ trọ, nút chỉ hiện lại, không đổi mã.
- Bạn xóa webhook bên SePay của bạn để tiền của bạn không còn đổ vào app.
- Nếu muốn **đổi mã bí mật** (nghi bị lộ): phải đổi cùng lúc ở hai nơi, bảng `bank_hooks` trong Supabase và biến `BANK_WEBHOOK_SECRET` của hàm `bank-webhook`, rồi dán mã mới vào SePay. Chỉ đổi một nơi thì SePay bị 401.

### 3. Số tài khoản hiện cho khách (VietQR, tin nhắc nợ)
- Chủ trọ mới tự nhập trong app: **Cấu hình tòa nhà → Tài khoản nhận tiền** (mỗi tòa một tài khoản). Không phải sửa mã, không phải đẩy lên GitHub. Dùng nút **Xem thử mã QR** để quét kiểm tra tên chủ tài khoản trước khi lưu.
- Cần đã chạy `supabase/migration-bank-info.sql` trên Supabase (một lần; hệ thống hiện tại đã chạy ngày 10/11/2026). Chưa chạy thì tài khoản nhập trong app chỉ lưu tạm trong máy và khách chưa thấy.
- Cách cũ (mục `bank` trong `js/config.js`) vẫn chạy, và là phương án dự phòng cho tòa chưa nhập. Tệp này công khai; sau khi giao xong nên bỏ mục `bank` cũ của bạn đi để số của bạn không còn hiện cho khách của người mới.
- Chưa có tài khoản nào (cả hai nơi) thì app khách tự ẩn số tài khoản và mã QR, không hiện số bịa.

### 4. Các khóa gắn với cá nhân bạn (người mới thay bằng của họ)
Supabase → **Edge Functions → Secrets**:
- `VAPID_SUBJECT` (đang là `mailto:` email của bạn, dùng làm liên hệ cho thông báo đẩy): đổi sang email người mới.
- `GEMINI_API_KEY` (trợ lý AI và đọc số điện): người mới tạo khóa của họ.
- `FB_*` (đăng bài Facebook, nếu dùng): của trang Facebook nào thì người đó cấp.
- Các biến `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SECRET`, `BANK_WEBHOOK_SECRET` là của hệ thống, giữ nguyên trừ khi cần đổi như mục 2.

### 5. Chuyển quyền sở hữu (chưa thử)
- **GitHub:** repo `happy-home` → Settings → Transfer ownership (hoặc thêm họ làm Owner). Địa chỉ web sẽ đổi theo tên người dùng mới.
- **Supabase:** Organization → thêm họ làm **Owner**, hoặc chuyển project sang organization của họ.
- Sau khi chuyển, bạn nhớ gỡ các khóa cá nhân của bạn khỏi trình duyệt và dịch vụ.

## Cách B: người mới dựng hệ thống riêng
Họ tạo Supabase và GitHub Pages của họ, rồi làm theo `BACKEND_SETUP.md` và các mục trong `README.md` (chạy các tệp SQL trong thư mục `supabase/`, triển khai các hàm trong `supabase/functions/`, điền `js/config.js`). Tốn công hơn, nhưng không dính gì tới tài khoản của bạn. Nhớ đổi URL webhook ở SePay sang địa chỉ Supabase của họ.

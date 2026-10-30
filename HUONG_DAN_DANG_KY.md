# Việc cần bạn đăng ký ở ngoài (và tôi sẽ nối vào app)

Các mục dưới đây cần **tài khoản đứng tên bạn** (ngân hàng, Zalo, nhà cung cấp tin nhắn). Tôi không đăng ký thay và không bao giờ nhập mật khẩu, mã OTP hay thông tin ngân hàng của bạn. Bạn đăng ký xong, báo tôi, tôi làm phần kết nối.

Giá và điều kiện của các dịch vụ này **hay đổi**; những gì ghi dưới đây lấy từ tài liệu công khai lúc viết (30/10/2026), chỗ nào chưa kiểm chứng được tôi ghi rõ. Luôn đối chiếu trang chính thức trước khi trả tiền.

## Thứ tự nên làm

| # | Việc | Vì sao | Mất bao lâu |
|---|---|---|---|
| 1 | **Đối soát ngân hàng tự động** (SePay hoặc Casso) | Lợi nhất: khách chuyển khoản là app tự ghi thu, hết cảnh đối chiếu tay | Vài giờ, gần như làm ngay được |
| 2 | **Zalo OA** (và ZNS nếu muốn tự gửi tin) | Duyệt mất vài ngày nên nộp sớm; chưa cần thì có thể chờ | Chờ duyệt khoảng 7 ngày |
| 3 | SMS (nhà cung cấp tin nhắn) | Chỉ cần nếu muốn nhắc nợ qua SMS | Tùy nhà cung cấp |
| 4 | Zalo Mini App | Không gấp; app khách thuê đã cài được như ứng dụng | Làm sau cùng |

Hiện app **đã soạn sẵn tin nhắc nợ** và mở Zalo cá nhân để bạn bấm gửi (miễn phí). Mục 2 và 3 chỉ cần khi bạn muốn **tự gửi hàng loạt**.

---

## 1. Đối soát ngân hàng tự động: SePay hoặc Casso

Ngân hàng không mở API cho tài khoản cá nhân, nên phải qua một dịch vụ đọc biến động số dư. Chọn **một** trong hai (không cần cả hai).

### Bạn chuẩn bị
- Tài khoản ngân hàng **chính chủ bạn**, đang dùng nhận tiền phòng.
- Điện thoại nhận mã OTP của ngân hàng, và app ngân hàng đăng nhập sẵn (mỗi ngân hàng liên kết một kiểu).
- Email để đăng ký dịch vụ.

### Các bước (SePay)
1. Đăng ký tài khoản ở trang quản trị SePay (my.sepay.vn).
2. Thêm / liên kết tài khoản ngân hàng theo hướng dẫn trên màn hình (tùy ngân hàng; thường cần OTP).
3. **Dừng ở đây và báo tôi.** Tôi cần tạo trước đường link nhận (webhook) và mã bí mật, rồi đưa lại cho bạn.
4. Khi có link và mã, bạn vào **Webhooks → Thêm webhook** và điền:
   - **URL:** đường link tôi đưa (dạng `https://<mã-dự-án>.supabase.co/functions/v1/bank-webhook`)
   - **Loại giao dịch:** chỉ tiền vào
   - **Kiểu xác thực:** *API Key*, dán **mã bí mật** tôi đưa (SePay gửi kèm trong header `Authorization: Apikey <mã>`; app đã nhận kiểu này)
   - Hoặc cách đơn giản hơn: dán link có đuôi `?key=<mã>` và chọn không xác thực
5. Bấm **Gửi thử** (trên dòng webhook) xem báo *Thành công*, rồi chuyển thử 10.000 ₫ vào tài khoản để xem giao dịch hiện trong app (**Khách chuyển khoản → Đối soát ngân hàng**).
6. SePay có **môi trường thử** (my.dev.sepay.vn) với giao dịch giả, không cần chuyển tiền thật.

### Các bước (Casso)
1. Đăng ký tại casso.vn, liên kết tài khoản ngân hàng cá nhân qua Casso Flow (cần OTP gửi về điện thoại; tài liệu nêu ACB có thể lấy OTP trong app ngân hàng).
2. **Lưu ý VietinBank:** liên kết qua Cas ID sẽ **hủy dịch vụ SMS biến động số dư** của chính ngân hàng.
3. Báo tôi như SePay để nhận link và mã.
4. Tạo webhook, chọn **bản V1** (gắn khóa bảo mật vào HTTP header; app nhận header `secure-token`), hoặc dán link có đuôi `?key=<mã>`. Bản V2 dùng chữ ký số, app **chưa hỗ trợ**.
5. Casso gọi lại trong 24 giờ nếu lỗi rồi **tạm dừng** webhook, nên báo tôi nếu thấy trạng thái *PAUSED*.

### Bạn gửi tôi
- Tên dịch vụ đã chọn, và "đã nối ngân hàng xong".
- Thông tin để hiện trên tin nhắc nợ và mã VietQR (không phải mật khẩu): **tên ngân hàng, số tài khoản, tên chủ tài khoản**. Tôi điền vào `js/config.js` (mục `bank`). Số tài khoản nhận tiền vốn là thông tin khách phải biết, nhưng tệp này nằm trên web công khai, nên chỉ điền khi bạn đồng ý.
- **Không** gửi mật khẩu, OTP, hay mã bí mật của SePay/Casso qua tin nhắn.

### Tôi làm
Kiểm và chạy `migration-bank-reconcile.sql` (nếu chưa chạy), tạo mã bí mật trong app, triển khai hàm `bank-webhook` và đặt biến môi trường trên Supabase (qua trang Supabase trong Chrome của bạn, chỉ khi bạn đồng ý), đưa bạn link + mã, rồi cùng thử một giao dịch.

**Bảo mật:** hàm nhận webhook **bắt buộc có đúng mã bí mật**; không có mã là từ chối. (Bản cũ có lỗ hổng: nếu yêu cầu không kèm gì thì vẫn nhận, nên ai biết link có thể bơm giao dịch giả; đã vá, có kiểm thử.)

**Giá:** chưa tra được bảng giá hiện hành của SePay lẫn Casso (kết quả tìm không có). Xem thẳng trang giá của hai bên.

---

## 2. Zalo OA và ZNS (tin nhắn tự động qua Zalo)

**Zalo OA** là tài khoản "Zalo chính thức" của nhà trọ. **ZNS** là tin nhắn tiện ích gửi tới số điện thoại khách theo **mẫu đã được Zalo duyệt** (ví dụ: nhắc đóng tiền, xác nhận đã thu).

### Bạn chuẩn bị
- **Giấy đăng ký kinh doanh** (doanh nghiệp hoặc hộ kinh doanh). Theo hướng dẫn của eSMS, OA xác thực dành cho doanh nghiệp / hộ kinh doanh, và thông tin khai phải **khớp với giấy**. Nếu bạn chưa có giấy phép kinh doanh thì mục này khó làm; app vẫn có cách nhắc nợ qua Zalo cá nhân.
- Tài khoản Zalo cá nhân của người đại diện.

### Các bước
1. Vào trang tạo OA của Zalo (oa.zalo.me), tạo OA **loại Doanh nghiệp**, điền thông tin.
2. **Xác thực trong vòng 14 ngày** sau khi tạo (nếu không đăng ký bị hủy). Nộp giấy tờ; thường có kết quả khoảng **7 ngày**.
3. Sau khi OA được xác thực, đăng ký dùng **ZNS** và tạo **mẫu tin** (template). Mẫu phải là tin chăm sóc khách hàng (không quảng cáo) và được Zalo duyệt từng mẫu. Các mẫu tôi đề nghị: *nhắc đóng tiền phòng*, *xác nhận đã thu tiền*, *thông báo hóa đơn mới*.
4. Nạp tiền vào tài khoản ZNS. **Giá:** một bảng giá bên thứ ba ghi khoảng 250 đến 360 ₫ mỗi tin (chưa rõ ngày áp dụng, **chưa xác minh với Zalo**). Đối chiếu bảng giá hiện hành trong trang quản trị OA.

### Bạn gửi tôi
- "OA đã xác thực", **mã mẫu tin (template ID)** đã được duyệt và các biến trong mẫu.
- Việc cấp quyền cho ứng dụng gọi API (mã truy cập OA) làm trong trang quản trị Zalo; tôi hướng dẫn từng bước lúc đó. Mã này là bí mật, **không dán vào chat**, sẽ cất ở biến môi trường Supabase.

### Tôi làm
Hàng đợi thông báo (gửi, thử lại khi lỗi, lịch sử gửi), nối ZNS, soạn nội dung theo mẫu đã duyệt. Tôi **không thử được trên Zalo thật** nếu bạn không đưa tài khoản thử, nên bước gửi thật phải có bạn cùng kiểm.

---

## 3. SMS

Dùng khi muốn nhắc nợ qua SMS cho khách không dùng Zalo. Nhà cung cấp phổ biến: eSMS, SpeedSMS, VietGuys (tôi **chưa so sánh giá**). Tin SMS có tên hiển thị (brandname) thường cần **đăng ký brandname và mẫu tin** với nhà cung cấp, kèm giấy tờ; điều kiện cụ thể thay đổi theo từng bên, hỏi trực tiếp họ.

App khách thuê hiện đăng nhập bằng **mã 6 số do chủ trọ cấp** nên **không cần SMS OTP**. Mục này để sau.

---

## 4. Zalo Mini App

App khách thuê hiện **cài được như ứng dụng** trên điện thoại. Mini App là bản chạy bên trong Zalo.
- Đăng ký nhà phát triển tại developers.zalo.me; theo bài viết bên thứ ba, Zalo **không thu phí đăng ký, phát hành** (cần xác minh lại).
- Điều kiện duyệt (cá nhân hay doanh nghiệp) tôi **chưa xác minh được**.
- Giao diện phải thử trên Zalo thật; tôi chỉ làm được phần máy chủ (liên kết Zalo với khách, kiểm mã). **Làm sau cùng**, khi mục 1 và 2 chạy ổn.

---

## Nhắc thêm (không cần tài khoản ngoài)
- Khi vào dùng thật: **cấp mã vào app cho khách** (Khách thuê → Mã vào app). Khách không vào được app nếu chưa có mã.
- Khi chốt "final": bạn nói, tôi xóa hết dữ liệu mẫu (hoặc bạn tự bấm *Tài khoản → Xóa toàn bộ dữ liệu*, gõ `XOA HET`).

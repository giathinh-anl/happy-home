# Bật đăng tin tự động lên Facebook

Sau khi cài xong: vào **Đăng tin → Xem & đăng → Đăng lên Facebook → Xác nhận đăng**, bài đăng
(nội dung + tối đa 10 ảnh phòng) lên ngay **Trang Facebook (Fanpage)** của bạn.

> **Giới hạn của Facebook, không phải của app:** chỉ đăng tự động được lên **Trang** bạn quản trị.
> Facebook đã tắt API đăng lên **trang cá nhân** và vào **nhóm**. Với nhóm, dùng nút
> **Chép và mở Facebook** rồi dán.

Cách hoạt động: trình duyệt gửi nội dung + ảnh tới hàm máy chủ `supabase/functions/fb-post`.
Mã truy cập Trang chỉ nằm trên máy chủ Supabase (như mật khẩu của Trang), **không bao giờ** đặt
trong `js/config.js`.

---

## Bước 1. Tạo ứng dụng Facebook (1 lần)

1. Vào <https://developers.facebook.com/apps> → **Tạo ứng dụng**.
2. Trường hợp sử dụng: chọn **Quản lý mọi thứ trên Trang của bạn** (Manage everything on your Page).
   Nếu giao diện hỏi loại ứng dụng thì chọn **Doanh nghiệp** (Business).
3. Đặt tên (VD: *Happy Home*), bấm tạo. Để ứng dụng ở chế độ **Phát triển** là đủ,
   vì chỉ bạn (quản trị viên) dùng, không cần gửi Facebook duyệt.

## Bước 2. Lấy mã truy cập Trang không hết hạn

1. Mở **Graph API Explorer**: <https://developers.facebook.com/tools/explorer>
2. Góc phải: chọn ứng dụng vừa tạo → **Get User Access Token**, tick 3 quyền:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` → **Generate Access Token**,
   đăng nhập, chọn đúng Trang, đồng ý.
3. Đổi sang mã dài hạn: mở <https://developers.facebook.com/tools/debug/accesstoken>, dán mã vừa có
   → **Debug** → **Extend Access Token** → chép mã dài hạn.
4. Quay lại Graph API Explorer, dán mã dài hạn vào ô Access Token, gõ truy vấn `me/accounts` → **Submit**.
   Trong kết quả, tìm Trang của bạn và chép 2 giá trị:
   - `id` → đây là **FB_PAGE_ID**
   - `access_token` → đây là **FB_PAGE_TOKEN** (mã Trang lấy theo cách này không tự hết hạn,
     trừ khi bạn đổi mật khẩu Facebook hoặc gỡ quyền của ứng dụng)

## Bước 3. Đưa hàm `fb-post` lên Supabase

**Cách A: bằng trang web Supabase (không cần cài gì)**

1. Supabase → dự án → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Tên hàm: `fb-post`. Xóa mã mẫu, dán toàn bộ nội dung tệp `supabase/functions/fb-post/index.ts` → **Deploy**.
3. **Edge Functions → Secrets** (Manage secrets), thêm 3 dòng:

   | Tên | Giá trị |
   |---|---|
   | `FB_PAGE_ID` | id Trang ở bước 2 |
   | `FB_PAGE_TOKEN` | access_token Trang ở bước 2 |
   | `FB_ALLOWED_EMAILS` | email được phép đăng, cách nhau dấu phẩy. VD: `chutro@gmail.com,nhanvien@gmail.com` |

**Cách B: bằng Supabase CLI**

```bash
supabase link --project-ref <project-ref>
supabase secrets set FB_PAGE_ID=... FB_PAGE_TOKEN=... FB_ALLOWED_EMAILS=chutro@gmail.com
supabase functions deploy fb-post
```

`FB_ALLOWED_EMAILS` là bắt buộc: web cho phép tự đăng ký tài khoản, nên chỉ những email trong danh
sách này mới được đăng lên Trang của bạn.

## Bước 4. (Tùy chọn) Tên Trang trong khung xem trước

Thêm vào `js/config.js`:

```js
fbPageName: 'Happy Home - Phòng trọ Quận 7',
```

## Bước 5. Thử

Đăng nhập web quản trị bằng email có trong `FB_ALLOWED_EMAILS` → **Đăng tin** → chọn phòng →
**Xem & đăng** → **Đăng lên Facebook** → xem trước → **Xác nhận đăng**. Đăng xong có nút **Xem bài**.

## Lỗi thường gặp

| Thông báo | Cách xử lý |
|---|---|
| Máy chủ chưa bật chức năng đăng Facebook | Chưa làm bước 3 (hàm `fb-post` chưa được triển khai) |
| Mã truy cập Trang đã hết hạn hoặc bị thu hồi | Làm lại bước 2, cập nhật `FB_PAGE_TOKEN` |
| Mã truy cập thiếu quyền pages_manage_posts | Bước 2.2 chưa tick đủ 3 quyền; tạo lại mã |
| Tài khoản … chưa được phép đăng | Thêm email đó vào `FB_ALLOWED_EMAILS` |
| Facebook tạm chặn vì nghi spam | Đăng quá nhiều bài giống nhau; đợi rồi thử lại, sửa nội dung cho khác nhau |

**An toàn:** `FB_PAGE_TOKEN` có quyền đăng bài thay Trang. Không gửi cho ai, không dán vào mã nguồn.
Nếu lỡ lộ: Facebook → Cài đặt → Bảo mật và đăng nhập → **Tiện ích tích hợp cho doanh nghiệp** → gỡ ứng
dụng, rồi làm lại bước 2.

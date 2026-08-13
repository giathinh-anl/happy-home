# Happy Home — Hệ thống quản lý nhà cho thuê (bản quản trị)

Ứng dụng web quản trị (admin) dựng theo tài liệu đặc tả, **giao diện phỏng theo LOZIDO**
(nav xanh lá ngang trên cùng + hàng thẻ module), **không cần cài đặt gì** —
chạy bằng HTML/CSS/JS thuần trong trình duyệt.

## Cách chạy

**Cách 1 — Mở trực tiếp (đơn giản nhất):**
Nhấp đúp vào `index.html`, hoặc kéo file thả vào cửa sổ trình duyệt (Chrome / Edge / Firefox).

**Cách 2 — Chạy qua máy chủ tĩnh (khuyến nghị nếu gặp lỗi CORS ở một số trình duyệt):**

```bash
python -m http.server 8777
```

Rồi mở `http://localhost:8777/index.html`.

## Đăng nhập (bản demo)

- Nhập **email hợp lệ bất kỳ** và **mật khẩu bất kỳ** (hoặc bấm *Điền nhanh*).
- Chọn vai trò để thấy khác biệt phân quyền:
  - **Chủ trọ** — thấy toàn bộ (tài chính, cấu hình, thu chi, đổi trạng thái phòng, hủy hóa đơn…).
  - **Nhân viên vận hành** — ẩn dữ liệu tài chính và các mục ngoài phạm vi.
- Đổi vai trò bất cứ lúc nào ở ô **Tài khoản** (góc phải thanh nav xanh).

## Bố cục kiểu LOZIDO
- **Thanh nav xanh trên cùng**: Quản lý nhà · Tổng báo cáo · Khách chuyển khoản · Đăng tin · Môi giới · Công ty/nhóm · Cài đặt chung · Thông báo · Tài khoản · Đăng xuất.
- **Hàng thẻ module** (theo tòa nhà): Quản lý phòng · Hóa đơn · Dịch vụ · Hợp đồng · Tài sản · Khách thuê · **Thêm** (Chỉ số điện nước, Thanh toán & công nợ, Thu chi, Khóa thông minh, Cấu hình).
- **Thẻ chọn tòa nhà** (đổi nhanh giữa các tòa) + banner "Tòa nhà thử nghiệm".
- **Trang phòng**: 4 thẻ tổng hợp (Tổng tiền khách nợ / Tổng tiền cọc / Cọc giữ chỗ / Sự cố phòng), chip lọc có badge số, **Ẩn/Hiện cột**, Xuất excel, chế độ Sơ đồ ⇄ Bảng.
- **Khách thuê**: gộp theo phòng, cột Khóa thông minh (TTLock), CCCD (số/ngày cấp/nơi cấp/ảnh 2 mặt), Xe (biển số), lọc tạm trú & giấy tờ.
- **Tài sản**: modal "Thêm mới tài sản" với lưới chọn icon, giá trị, số lượng, đơn vị.

## Tính năng đã dựng

| Nhóm | Màn hình |
|---|---|
| Xác thực | Đăng nhập (kiểm tra email khi rời ô, trạng thái chờ, dải lỗi) |
| Công ty | Tổng quan (thẻ chỉ số, biểu đồ doanh thu, "Cần xử lý", bảng tòa nhà) · Tòa nhà · Nhật ký hệ thống |
| Phòng | Sơ đồ theo tầng + chế độ bảng · tooltip · **tạo phòng hàng loạt** (2 bước, phát hiện trùng mã) · **đổi trạng thái** (DangerDialog, máy trạng thái) |
| Khách thuê | Danh sách · **thêm bằng nhận diện CCCD** (mô phỏng OCR, chỉ báo độ tin cậy, phát hiện trùng, lối nhập thủ công) |
| Hợp đồng | Danh sách · **lập hợp đồng 5 bước** (Phòng → Khách → Điều khoản → Dịch vụ → Bàn giao → xác nhận) · lưu nháp · **trả phòng & thanh lý** (kiểm kê tài sản, quyết toán cọc) |
| Điện nước | **Ghi chỉ số** nhập nhanh (Tab/Enter xuống dòng, tính tiêu thụ tức thì, cảnh báo bất thường, chỉ số khách tự ghi chờ duyệt, xử lý quay vòng đồng hồ) |
| Hóa đơn | Danh sách + 4 thẻ chỉ số + chọn kỳ · **sinh hóa đơn hàng loạt** (kiểm tra điều kiện) · **phát hành** (tiến trình từng bước) · **chi tiết hóa đơn** (căn cứ tính từng dòng, lịch sử thanh toán, dải "đã chỉnh sửa") · **hủy hóa đơn** (DangerDialog) |
| Thanh toán | **Ghi nhận thanh toán** với **phân bổ tự động** (trả trước kỳ cũ nhất) · trang công nợ |
| Khác | Dịch vụ & đơn giá · Tài sản (khấu hao, giá trị còn lại) |

### Thành phần dùng chung (theo Phần II đặc tả)
`MetricCard`, `StatusBadge` (bảng quy ước màu §1.2), `DataTable` (tìm/lọc/sắp xếp/phân trang/chọn hàng loạt/trạng thái rỗng/skeleton), `PeriodSelector`, `DangerDialog` (bắt buộc nhập lý do ≥10 ký tự), toast, modal, menu.

### Chi tiết kỹ thuật
- Số tiền & chỉ số: font mono, `tabular-nums`, định dạng `1.250.000 ₫`.
- Trạng thái tải (skeleton / spinner trong nút / thanh tiến trình), phản hồi lạc quan, thông báo lỗi bằng ngôn ngữ nghiệp vụ.
- Phím tắt: `/` tìm kiếm · `n` tạo mới · `Esc` đóng · `?` bảng phím tắt.
- Phân quyền sinh menu theo vai trò; chặn truy cập route ngoài phạm vi.
- Responsive: thanh bên thành ngăn kéo trên màn hình hẹp.

## Cấu trúc mã nguồn

```
index.html            # nạp toàn bộ CSS/JS
css/
  tokens.css          # biến thiết kế (màu, chữ, khoảng cách) — §1.2–1.4
  base.css            # reset + tiện ích
  layout.css          # khung + thanh bên 2 tầng — §1.5
  components.css      # thành phần dùng chung — Phần II
  pages.css           # style riêng từng màn hình
js/
  utils.js            # định dạng tiền/số/ngày, tag template html
  store.js            # dữ liệu giả lập + trạng thái + truy vấn/đột biến
  components.js       # MetricCard, StatusBadge, DataTable, DangerDialog...
  router.js           # điều hướng theo hash (#/...)
  app.js              # khung, thanh bên, phân quyền, phím tắt, boot
  pages/
    auth-dashboard.js # đăng nhập, tổng quan, tòa nhà, nhật ký
    rooms.js          # phòng (sơ đồ/bảng), tạo hàng loạt, đổi trạng thái
    tenants.js        # khách thuê + OCR
    contracts.js      # hợp đồng, lập mới 5 bước, thanh lý
    billing.js        # chỉ số, hóa đơn, chi tiết, thanh toán
    misc.js           # dịch vụ, tài sản
```

## Giới hạn của bản demo

- **Dữ liệu giả lập trong bộ nhớ**, tạo lại mỗi lần tải trang. Các thao tác (đổi trạng thái, ghi thanh toán, hủy hóa đơn, ký/thanh lý hợp đồng) có hiệu lực trong phiên nhưng **không lưu vĩnh viễn** (chưa nối máy chủ). Chỉ tùy chọn giao diện (vai trò, chế độ xem) được lưu vào `localStorage`.
- **OCR CCCD được mô phỏng** (không gọi dịch vụ thật) — điền sẵn dữ liệu mẫu kèm độ tin cậy để minh họa luồng.
- Một số màn hình phụ (Báo cáo, Sổ kế toán, Nhân sự, Cấu hình, Khóa thông minh, Thu chi) hiện là trang giữ chỗ.
- **Chưa dựng** phần IV (ứng dụng khách thuê) và phần V (trợ lý ảo) theo lựa chọn phạm vi "chỉ app quản trị". Có thể bổ sung ở bước sau.

## Bước tiếp theo gợi ý
Nối API thật (thay `js/store.js` bằng lớp gọi máy chủ), thêm ứng dụng khách thuê (Phần IV), trợ lý ảo (Phần V), và các màn hình phụ còn giữ chỗ.

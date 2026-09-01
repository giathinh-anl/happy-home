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
| Công ty | **Tổng quan** (4 thẻ KPI có xu hướng, dòng tiền 6 kỳ, vòng cung tiến độ thu, 3 biểu đồ tròn, tiêu thụ điện nước, hiệu suất từng tòa, chi phí theo hạng mục, phiếu thu gần đây, top công nợ, việc cần xử lý) · Tòa nhà · Nhật ký hệ thống |
| Phòng | Sơ đồ theo tầng + chế độ bảng · tooltip · **tạo phòng hàng loạt** (2 bước, phát hiện trùng mã) · **đổi trạng thái** (DangerDialog, máy trạng thái) |
| Khách thuê | Danh sách · **thêm bằng nhận diện CCCD** (mô phỏng OCR, chỉ báo độ tin cậy, phát hiện trùng, lối nhập thủ công) |
| Hợp đồng | Danh sách · **lập hợp đồng 5 bước** (Phòng → Khách → Điều khoản → Dịch vụ → Bàn giao → xác nhận) · lưu nháp · **trả phòng & thanh lý** (kiểm kê tài sản, quyết toán cọc) |
| Điện nước | **Ghi chỉ số** nhập nhanh (Tab/Enter xuống dòng, tính tiêu thụ tức thì, cảnh báo bất thường, chỉ số khách tự ghi chờ duyệt, xử lý quay vòng đồng hồ) |
| Hóa đơn | Danh sách + 4 thẻ chỉ số + chọn kỳ · **sinh hóa đơn hàng loạt** (kiểm tra điều kiện) · **phát hành** (tiến trình từng bước) · **chi tiết hóa đơn** (căn cứ tính từng dòng, lịch sử thanh toán, dải "đã chỉnh sửa") · **hủy hóa đơn** (DangerDialog) |
| Thanh toán | **Ghi nhận thanh toán** với **phân bổ tự động** (trả trước kỳ cũ nhất) · trang công nợ |
| Khác | Dịch vụ & đơn giá · Tài sản (khấu hao, giá trị còn lại) |
| Trợ lý ảo | **Chat AI** ở cả web quản trị và app khách thuê — luật từ khóa trả lời miễn phí, Gemini Flash chỉ dùng cho câu hỏi phức tạp |

### Thành phần dùng chung (theo Phần II đặc tả)
`MetricCard`, `StatusBadge` (bảng quy ước màu §1.2), `DataTable` (tìm/lọc/sắp xếp/phân trang/chọn hàng loạt/trạng thái rỗng/skeleton), `PeriodSelector`, `DangerDialog` (bắt buộc nhập lý do ≥10 ký tự), toast, modal, menu.

### Chi tiết kỹ thuật
- Số tiền & chỉ số: font mono, `tabular-nums`, định dạng `1.250.000 ₫`.
- Trạng thái tải (skeleton / spinner trong nút / thanh tiến trình), phản hồi lạc quan, thông báo lỗi bằng ngôn ngữ nghiệp vụ.
- Phím tắt: `/` tìm kiếm · `n` tạo mới · `Esc` đóng · `?` bảng phím tắt.
- Phân quyền sinh menu theo vai trò; chặn truy cập route ngoài phạm vi.
- Responsive: thanh bên thành ngăn kéo trên màn hình hẹp.

## Trợ lý ảo (AI)

Trợ lý chạy theo **3 tầng**, thiết kế để **không bao giờ để mô hình tự nghĩ ra số liệu**:

| Tầng | Chạy khi nào | Chi phí | Cách hoạt động |
|---|---|---|---|
| 1. Luật từ khóa | Luôn luôn, ưu tiên đầu | 0 đ | Nhận diện ý định bằng từ khóa, code truy vấn dữ liệu thật rồi ghép vào câu mẫu |
| 2. Gemini Flash | Chỉ khi tầng 1 không hiểu | Gói miễn phí (~1.500 lượt/ngày) | (a) mô hình **chỉ phân loại ý định**, trả JSON, không có số, (b) code lấy **số thật**, (c) mô hình **soạn lời văn từ số đó** |
| 3. Trả lời trung thực | Khi cả hai tầng đều không xử lý được | 0 đ | Nói thẳng là chưa hỗ trợ; app khách còn tự chuyển câu hỏi cho chủ nhà |

Nhờ vậy: câu hỏi lặp đi lặp lại (*"tháng này đóng bao nhiêu"*) **không tốn lượt gọi API**, và mọi con số hiển thị đều lấy từ cơ sở dữ liệu chứ không phải do mô hình đoán.

**Bật Gemini** (tùy chọn — không bật thì tầng 1 và 3 vẫn chạy bình thường):

1. Lấy khóa miễn phí tại <https://aistudio.google.com/apikey>.
2. Cách an toàn (nên dùng khi công khai web): triển khai `supabase/functions/ai` rồi điền `aiProxyUrl` vào `js/config.js`. Khóa nằm ở máy chủ, trình duyệt không thấy.
3. Cách nhanh (chỉ chạy thử ở máy cá nhân): điền thẳng `geminiApiKey` vào `js/config.js`. **Lưu ý: ai mở trình duyệt cũng đọc được khóa này.**

Xem hướng dẫn đầy đủ trong `js/config.example.js` và `supabase/functions/ai/index.ts`.
Trạng thái trợ lý (đang chạy tầng nào, còn bao nhiêu lượt) xem ở **Cài đặt chung → Trợ lý ảo (AI)**.

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
  icons.js            # bộ icon SVG dùng chung
  charts.js           # biểu đồ SVG thuần: donut, cột, vùng, tiến độ, vòng cung
  gemini.js           # cầu nối Gemini Flash (phân loại ý định + soạn lời), đếm hạn mức, cache
  ai.js               # bộ ý định của chủ trọ: mỗi ý định tự lấy số thật từ store
  assistant.js        # khung chat nổi ở góc màn hình
  store.js            # dữ liệu + trạng thái + truy vấn/đột biến/phân tích dashboard
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

## Lưu dữ liệu & thao tác thật

- **Dữ liệu được lưu bền trong trình duyệt** (`localStorage`). Mọi thao tác đều **giữ lại sau khi tải lại trang**: thêm/sửa/xóa dịch vụ, tạo phòng hàng loạt, thêm khách thuê, ký & thanh lý hợp đồng, ghi chỉ số, sinh/phát hành/hủy hóa đơn, ghi nhận thanh toán, thêm tài sản, thêm tòa nhà, kết nối/ngắt khóa TTLock…
- **Xuất Excel thật**: các nút *Xuất excel* (phòng, khách thuê, dịch vụ, tài sản, hóa đơn) tải xuống **file CSV** mở được bằng Excel (có dấu tiếng Việt).
- **Khôi phục dữ liệu mẫu**: ô **Tài khoản → Khôi phục dữ liệu mẫu** để xóa hết thay đổi và về dữ liệu ban đầu.

## Còn là mô phỏng (chưa nối máy chủ thật)

- **OCR CCCD** được mô phỏng (điền sẵn dữ liệu mẫu kèm độ tin cậy) — chưa gọi dịch vụ nhận diện thật.
- Dữ liệu chỉ nằm **trên trình duyệt này**; chưa đồng bộ nhiều thiết bị / nhiều người dùng (cần backend + database).
- Một vài màn hình phụ (Tổng báo cáo, Khách chuyển khoản, Đăng tin, Công ty/nhóm, Khóa thông minh, Thu chi) hiện là trang giữ chỗ.

## Bước tiếp theo để thành "bản chính" thật
Muốn nhiều người dùng chung + đồng bộ nhiều máy thì cần **máy chủ + cơ sở dữ liệu**: thay `js/store.js` bằng lớp gọi API thật (đăng nhập/JWT, REST/GraphQL), thêm OCR thật và cổng thanh toán. Giao diện & luồng nghiệp vụ hiện tại dùng lại được gần như nguyên vẹn.

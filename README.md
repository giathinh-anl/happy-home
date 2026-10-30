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

## Mở web (không cần tải mã về)

**https://giathinh-anl.github.io/happy-home/** — trang chủ trọ
**https://giathinh-anl.github.io/happy-home/tenant-app/** — app khách thuê

Mở là dùng được ngay trên điện thoại lẫn máy tính, dùng chung dữ liệu thật,
không phải tải mã nguồn hay chép tệp cấu hình.

## Tải mã về chạy ở máy mình

`js/config.js` (địa chỉ Supabase + khóa `anon`) **đã nằm sẵn trong kho mã**, nên
tải về là chạy được ngay, không phải xin ai tệp cấu hình nữa. Khóa `anon` an toàn
khi nằm trong trình duyệt vì đã có Row Level Security chặn theo từng người dùng —
nhưng **tuyệt đối không** đặt `service_role key` vào đây.

Ai tải mã về từ trước ngày 26/09/2026 thì `git pull` (hoặc tải lại bản zip) để có tệp này.

Vào không được thì đọc đúng dòng báo lỗi:

- *“Chưa kết nối máy chủ: thiếu tệp js/config.js”* — bản mã cũ, `git pull` lại.
- *“Số điện thoại hoặc mã chưa đúng”* — khách chưa được cấp mã vào app, hoặc nhập sai.
  Chủ trọ vào **Khách thuê → Mã vào app** để cấp (xem mục *Đăng nhập app khách thuê* bên dưới).
  Số lạ và mã sai cố ý báo y hệt nhau.
- *“Nhập sai nhiều lần nên số này tạm bị khóa”* — sai 5 lần liên tiếp thì khóa 15 phút;
  chủ trọ cấp lại mã là mở khóa ngay.
- *“Hệ thống chưa được cập nhật để dùng mã vào app”* — chủ dự án cần chạy
  `supabase/migration-tenant-auth.sql` trong Supabase → SQL Editor.
- *“Không kết nối được máy chủ”* — sai URL/khóa trong `config.js`, hoặc mất mạng.

## Chốt sổ tháng

Trang Hóa đơn → **Chốt sổ tháng** thay cho "Sinh hóa đơn" cũ. Mở ra là **xem trước toàn bộ phòng đang thuê** rồi mới tạo hóa đơn:

| Tình trạng | Ý nghĩa | Chọn sẵn? |
|---|---|---|
| Sẵn sàng | đủ chỉ số, tiêu thụ bình thường | có |
| Nên xem lại | điện cao gấp hơn 3 lần mức thường của phòng, hoặc bằng 0 | có, kèm ghi chú |
| Thiếu chỉ số / Chỉ số giảm | chưa ghi, hoặc nhỏ hơn kỳ trước mà chưa xử lý quay vòng / thay đồng hồ | **bị chặn** |
| Đã có hóa đơn / Ngoài kỳ | đã chốt rồi, hoặc hợp đồng chưa bắt đầu / đã hết trước kỳ | bỏ qua |

Chọn bớt phòng được, thấy sẵn tổng tiền dự kiến. Bấm tạo thì ra các hóa đơn **nháp** gom thành một **đợt** (khách chưa thấy gì). Từ đó: **Phát hành cả đợt** (khách xem được trong app), hoặc **Hoàn tác đợt**: nháp bị xóa hẳn, hóa đơn đã phát hành mà chưa thu thì bị hủy, hóa đơn đã có thu tiền được **giữ nguyên** và báo rõ. Chốt sổ lại được cho các phòng đã hoàn tác. Các đợt hiện ở đầu trang Hóa đơn. Mã phân loại ở `js/closing.js` (thuần, có kiểm thử); cần chạy `supabase/migration-invoice-batches.sql` để danh sách đợt còn sau khi tải lại trang.

Hai lỗi có sẵn được sửa cùng đợt: **mã hóa đơn** trước đây lấy "số hóa đơn đang có + 1" nên sau khi xóa nháp có thể trùng mã một hóa đơn khác (phát hành hoặc thu tiền rơi nhầm hóa đơn kia), giờ lấy số lớn nhất + 1; và `tenant_data` trả cả **hóa đơn nháp** cho khách, giờ chỉ trả hóa đơn đã duyệt (chạy lại `migration-tenant-auth.sql`, an toàn khi chạy lại).

## Nhập liệu bằng giọng nói tiếng Việt

- **Trang Chỉ số điện → nút Đọc chỉ số:** vừa đi dọc hành lang vừa đọc "phòng 101 điện 1250, phòng 102 điện 980". Trình duyệt đổi giọng thành chữ, `js/voice.js` hiểu chữ thành (phòng, chỉ số): nhận cả số viết bằng chữ ("một nghìn hai trăm năm mươi"), đọc từng số ("một không một" = 101), số viết 1.250 hoặc 1 250, nhiều phòng một câu, tiếng ậm ừ xen giữa.
- **Giọng nói dễ nghe nhầm nên không bao giờ ghi thẳng.** Danh sách "nghe được" hiện ra để xem lại và sửa số ngay trong bảng; chưa bấm *Ghi* thì chưa lưu gì. Số nhỏ hơn kỳ trước không cho ghi (hay là nghe thiếu chữ số); cao hơn 3 lần mức thường hoặc ghi đè số đang có thì mặc định không tick, phải tự quyết; phòng không có trong tòa thì báo rõ. Mỗi lần ghi có dòng trong nhật ký hoạt động.
- **Trợ lý ảo có nút micro:** nói câu hỏi, nói xong tự gửi (trợ lý chỉ tra cứu nên gửi luôn an toàn).
- Không có micro hoặc trình duyệt không hỗ trợ (Firefox): vẫn gõ hoặc dán câu vào ô, kết quả như nhau. Chrome, Edge, Android và Safari thì dùng được.
- **Quyền riêng tư:** nhận dạng giọng nói do trình duyệt làm, âm thanh được gửi tới dịch vụ của hãng trình duyệt (Google với Chrome, Apple với Safari). Happy Home không ghi âm hay lưu âm thanh; hộp thoại có ghi chú này cho người dùng thấy.
- 87 ca kiểm thử `tests/voice.test.js` (số bằng chữ, nhiều cách đọc, các câu sai, đánh giá chỉ số, micro giả), thử phá 47 chỗ đều bị bắt. Khi thử phát hiện một lỗi thật: từ nối như "là" từng bị bỏ qua giữa hai cụm số bằng chữ nên có thể ghép "phòng một không một là một nghìn hai trăm" thành số sai; nay từ nối ngắt cụm số, chỉ tiếng ậm ừ mới được bỏ qua.

## Tài khoản mới bắt đầu trống

- **Trước đây** lần đầu đăng nhập, app tự đẩy cả bộ dữ liệu mẫu (vài tòa nhà, hàng trăm khách, hóa đơn giả) lên máy chủ của chính chủ trọ, rồi chủ trọ phải tự dọn. Với một sản phẩm bán cho chủ trọ thật thì đó là lỗi: dữ liệu giả lẫn vào sổ sách thật.
- **Nay** chủ trọ mới thấy màn hình **Chào mừng** với 4 bước (thêm tòa nhà → tạo phòng → thêm khách và hợp đồng → ghi chỉ số, phát hành hóa đơn) và nút **Thêm tòa nhà đầu tiên**. Không có gì được ghi lên máy chủ cho tới khi chủ trọ tự làm.
- **Muốn xem thử** thì bấm **Nạp dữ liệu mẫu để xem thử** (có hộp thoại giải thích đây là dữ liệu giả). Chỉ hiện khi tài khoản hoàn toàn trống và chỉ chủ trọ thấy.
- **Dọn dữ liệu:** *Tài khoản → Xóa toàn bộ dữ liệu* (trước đây tên là "Khôi phục dữ liệu mẫu" nhưng thực ra xóa sạch trên máy chủ). Nay nói đúng sự thật, bắt gõ **XOA HET** để xác nhận, xóa luôn lời mời khách tự khai còn sót, ảnh chụp và hàng đợi ngoại tuyến; xong tài khoản về trống như mới. Bản demo (không máy chủ) vẫn là "Khôi phục dữ liệu mẫu".
- Chủ trọ đang có dữ liệu thì không thấy gì khác. Nhân viên của tài khoản trống chỉ thấy "Chủ trọ chưa tạo tòa nhà nào".
- Sửa kèm: thanh tab điện thoại không còn tạo đường dẫn `#/b/null/...` khi chưa có tòa nhà; đường dẫn tới tòa nhà không còn tồn tại thì quay về danh sách thay vì hiện lỗi trang.
- Dữ liệu mẫu đã được kiểm với đúng các luật của `migration-constraints.sql` (0 vi phạm trên 7 bảng) nên nạp vào tài khoản thật không bị DB từ chối.

## Trang công khai giới thiệu phòng trống

Để người cần thuê xem phòng mà không phải đăng nhập hay hỏi qua lại: mỗi phòng có thể có **một đường link và mã QR** riêng.

- **Chủ trọ bật ở hộp thoại phòng** (Phòng → bấm vào phòng → *Link giới thiệu công khai* → *Bật link công khai*). Mặc định tắt. Bật xong có: ô link (sao chép), nút *Mở trang xem thử*, *Chép tin chia sẻ* (soạn sẵn giá, diện tích, địa chỉ, link để dán Zalo / Facebook), **mã QR** tải về in dán trước nhà. Tắt lúc nào cũng được, hết xem được ngay; bật lại thì dùng đúng link cũ (mã được giữ).
- **Người ngoài mở link** `.../phong/#<mã>` thấy trang làm cho điện thoại: ảnh cuộn ngang (bấm xem lớn), giá, diện tích, tầng, số người, tiện nghi, mô tả, địa chỉ kèm link bản đồ, và thanh dính đáy **Gọi ngay / Nhắn Zalo / Chia sẻ**. Phòng đã có người thuê hoặc đặt cọc thì trang nói rõ và đổi nút thành "Gọi hỏi phòng khác".
- **Chỉ lộ đúng những gì chủ trọ đã nhập để đăng tin:** số phòng, giá, diện tích, mô tả, tiện nghi, tối đa 5 ảnh, tên + địa chỉ tòa nhà, tên + số điện thoại liên hệ. **Không có** tên khách, công nợ, hợp đồng, chỉ số. Trạng thái chỉ có 3 loại, nên phòng sắp trả phòng hay đang dọn đều hiện "đã có người thuê", không lộ chi tiết.
- **Người lạ chỉ gọi được đúng một hàm** `public_room(mã)` (`supabase/migration-public-rooms.sql`); bảng phòng vẫn khóa kín. Mã là 16 ký tự ngẫu nhiên khó đoán (36¹⁶ khả năng); mã sai dạng, mã không có và phòng chưa bật công khai đều trả y hệt nhau ("không còn được giới thiệu"), không dò được mã nào tồn tại. Mã là chuỗi sau dấu `#` nên không gửi lên máy chủ web, trang đặt `noindex`.
- **An toàn nội dung:** chữ từ máy chủ luôn qua `textContent` (không bao giờ `innerHTML`), ảnh chỉ nhận ảnh nhúng jpeg/png/webp (chặn đường dẫn ngoài, svg, `javascript:`), số điện thoại sai dạng thì không tạo nút gọi. Đã thử với mô tả chứa `<script>`, `onerror`, ảnh `javascript:`: không chạy gì.
- **Giới hạn nói thẳng:** vì trang là tĩnh (GitHub Pages) nên khi dán link vào Zalo / Facebook chỉ ra thẻ xem trước **chung** của Happy Home, chưa có ảnh và giá từng phòng (hai nơi đó không chạy JavaScript). Muốn thẻ riêng cho từng phòng cần thêm một hàm máy chủ trả HTML riêng; chưa làm.
- **Cần chạy một lần** `supabase/migration-public-rooms.sql` (thêm cột `rooms.public_on`, `rooms.public_slug` và hàm `public_room`; chạy lại được, không đụng dữ liệu có sẵn; cần `migration-room-photos.sql` trước). Chưa chạy thì hộp thoại phòng báo rõ và link chưa mở được với người ngoài.
- `js/listing.js` thuần (mã ngẫu nhiên không thiên vị, link, số điện thoại, ảnh, trạng thái, tin chia sẻ): 36 ca `tests/listing.test.js`, thử phá 46 chỗ đều bị bắt. `tests/db/public-room.test.py`: 57 ca trên Postgres thật (danh sách trắng đúng các trường, không lộ khách / công nợ / chủ sở hữu, mã yếu, hai chủ trọ cùng mã tòa, vai anon không đọc được bảng, chạy lại), thử phá 36 chỗ đều bị bắt (loại hai kiểu phá tương đương: chỉ mục duy nhất vẫn cho nhiều NULL, thứ tự ảnh đã có ở truy vấn con). Khi thử phá phát hiện bài test từng chưa bắt được truy vấn thiếu điều kiện chủ sở hữu của tòa nhà (hai chủ trọ cùng mã `b1`): đã bổ sung.

## Cài như ứng dụng + ghi chỉ số khi mất mạng

Hầm để xe, tầng hầm đồng hồ điện thường mất sóng. Trước đây đang ghi chỉ số mà mất mạng thì lần lưu lỗi mà không ai biết, tải lại trang là mất sạch số vừa ghi.

- **Cài lên màn hình chính** (Chrome / Edge / Android: *Cài ứng dụng* hoặc *Thêm vào màn hình chính*; iPhone: *Chia sẻ → Thêm vào MH chính*): `manifest.webmanifest` + `sw.js` (service worker) + biểu tượng `assets/icon-192.png`, `icon-512.png`. Mở như một app riêng, không có thanh địa chỉ.
- **Mở được khi không có mạng:** `sw.js` lưu trang và các tệp của nó, ưu tiên mạng (có mạng luôn là bản mới nhất, không cần nhớ xóa bộ nhớ đệm), mạng đứt hoặc chậm quá 5 giây thì lấy bản đã lưu. Không lưu lệnh gọi Supabase, app khách thuê và trang khách tự khai.
- **Số ghi lúc chưa gửi được không mất:** mỗi lần lưu, những chỉ số máy chủ chưa nhận được ghi ngay vào một hàng đợi trong máy (`localStorage`). Mạng chập chờn thì có thanh nhỏ "N chỉ số chưa gửi được" kèm nút *Thử lại*, app tự thử lại thưa dần. Tải lại trang hay đóng app cũng không mất.
- **Mở app khi hoàn toàn không có mạng:** vào trang riêng *Ghi chỉ số điện* làm cho điện thoại (ô số to, từng phòng một thẻ). Danh sách phòng lấy từ ảnh chụp lần mở app trước, chỉ có tên tòa, mã phòng, tên khách và chỉ số vài kỳ gần nhất (không CCCD, số điện thoại, ngày sinh, địa chỉ, hóa đơn, ảnh); xóa khi đăng xuất. Chỉ trang này chạy ngoại tuyến, các trang khác cần mạng. Số gõ chữ, hoặc nhỏ hơn kỳ trước thì từ chối ngay và nói rõ lý do (xử lý quay vòng / thay đồng hồ làm khi có mạng). Nhân viên chỉ vào được nếu có quyền *Ghi chỉ số*.
- **Có mạng lại thì đối chiếu, không bao giờ ghi đè âm thầm:** máy chủ chưa đổi kể từ lúc ghi thì áp dụng; máy chủ đã có số khác (khách tự gửi, nhân viên khác ghi) thì hiện hộp thoại *Chỉ số cần bạn xem lại*, mặc định *Giữ số trên máy chủ*, chủ trọ chọn từng phòng. Chưa quyết thì còn nguyên cho lần sau. Số bằng đúng số máy chủ thì bỏ qua êm.
- **Đăng xuất khi còn chỉ số chưa gửi:** app thử gửi nốt; vẫn không được thì hỏi, vì đăng xuất là bỏ chúng.
- **Sửa lỗi kèm theo:** hàm lưu ngay (`flush`) trước đây luôn báo thành công kể cả khi máy chủ từ chối; nay báo đúng.
- Chỉ bảo vệ **chỉ số điện** (số mới và phần bù quay vòng). Sửa phòng, khách, hóa đơn... lúc mất mạng vẫn cần mạng như cũ.
- 63 ca kiểm thử `tests/offline.test.js` (chữ ký chỉ số, hàng đợi, đối chiếu, ảnh chụp không lộ dữ liệu riêng, bộ nhớ hỏng/đầy), thử phá 60 chỗ đều bị bắt. Thử như người dùng thật cả ở Chrome thật: tắt hẳn máy chủ web, app vẫn mở từ bộ nhớ đệm, ghi số, bật lại thì số lên máy chủ. Khi thử phát hiện: ảnh chụp cũ hơn lần gửi thành công gần nhất làm phòng đã ghi hiện trống (nay làm mới sau mỗi lần gửi thành công), chữ "Đã có mạng" gây hiểu nhầm khi mạng chập chờn (nay thử nối máy chủ thật trước khi tải lại), thanh trạng thái bị nút trợ lý đè.

## Gia hạn hợp đồng có phụ lục

- **Mỗi lần gia hạn để lại dấu vết:** trước đây gia hạn chỉ sửa thẳng hợp đồng (đổi ngày hết hạn, giá), không còn biết giá cũ, gia hạn từ ngày nào. Nay mỗi lần ghi một dòng *lịch sử gia hạn* (từ ngày, đến ngày, số tháng, giá cũ → giá mới, người làm) và trang chi tiết hợp đồng có thẻ **Lịch sử gia hạn**.
- **Phụ lục để hai bên ký:** gia hạn xong (cả khi chủ trọ gia hạn trực tiếp, lẫn khi chấp nhận khách xin gia hạn từ app khách) app hỏi *Lập phụ lục để hai bên ký?*. Phụ lục là văn bản ngắn theo mẫu: số `PL01/<mã hợp đồng>`, căn cứ hợp đồng gốc, hai bên, 5 điều (thời hạn gia hạn, giá thuê giữ nguyên hoặc điều chỉnh, tiền cọc tiếp tục giữ, các điều khoản khác giữ nguyên, hiệu lực và số bản), khung ký. Mở cửa sổ in; chọn **Lưu dưới dạng PDF** nếu muốn gửi file. In lại lúc nào cũng được từ thẻ lịch sử.
- **Hạn mới tính đúng:** còn hiệu lực thì cộng từ ngày hết hạn, đã hết hạn (hoặc hết đúng hôm nay) thì cộng từ hôm nay. Sửa một lỗi thật tìm thấy khi làm: cộng tháng bằng `Date.setMonth` bị **tràn sang tháng sau** (hết hạn 31/8 gia hạn 6 tháng ra 3/3 thay vì 28/2; ảnh hưởng cả lúc lập hợp đồng mới có ngày bắt đầu 29–31). Nay `HH.dates.themThang` kẹp về cuối tháng.
- **Cần chạy một lần** `supabase/migration-renewal-history.sql` (thêm cột `contracts.renewal_history`, chạy lại nhiều lần được, không đụng dữ liệu có sẵn). Chưa chạy thì gia hạn vẫn bình thường, chỉ lịch sử không lưu lên máy chủ; app báo ngay hộp thoại sau khi gia hạn để chủ trọ in phụ lục liền.
- `js/renewal.js` thuần: 41 ca kiểm thử `tests/renewal.test.js` (hạn còn / hết / hết đúng hôm nay, tràn tháng, giá, lịch sử, nội dung phụ lục) + 15 ca cộng tháng trong `tests/dates.test.js` (thử ở ba múi giờ), thử phá 35 chỗ đều bị bắt. `tests/db/renewal-history.test.py`: 8 ca cho cột mới. Thử như người dùng thật: gõ giá quá thấp bị chặn kèm lý do, đổi giá và giữ giá, in lại từ lịch sử sau khi tải lại trang.

## Ràng buộc dữ liệu ở tầng DB

- **Lưới an toàn cuối cùng** sau `js/validate.js`: `supabase/migration-constraints.sql` chặn số âm (giá phòng, giá thuê, tiền cọc, đơn giá dịch vụ, chỉ số điện, đã thu, thanh toán), hợp đồng kết thúc trước khi bắt đầu, cuối kỳ hóa đơn trước đầu kỳ, kỳ không đúng dạng năm-tháng, ngày chốt ngoài 1–31, CCCD không phải 9 hoặc 12 số, số điện thoại không phải số di động 10 số (nhận +84, khoảng trắng, dấu chấm, gạch, ngoặc, đúng như luật ở app). Lỗi trả mã `23514` kèm lời nhắn tiếng Việt.
- **Không đụng dữ liệu cũ.** Dùng trigger thay vì `CHECK` (kể cả `NOT VALID`), vì `CHECK` kiểm cả dòng mỗi lần sửa dòng đó, mà app luôn lưu nguyên dòng: một dòng cũ lỡ có số âm sẽ không sửa được cả trạng thái phòng. Trigger chỉ kiểm khi **thêm dòng mới** hoặc khi **cột đó thật sự đổi giá trị** so với bản đang có. Quan trọng: app lưu bằng `upsert` (`INSERT … ON CONFLICT DO UPDATE`), mà trigger `BEFORE INSERT` luôn coi đó là dòng mới nên trigger phải tra bản đang có rồi so sánh; lỗi này lộ ra ngay ở lần thử đầu.
- **Chạy lúc nào cũng được, không xóa không sửa dòng nào.** `supabase/audit-du-lieu.sql` (chỉ đọc, chỉ đếm, không in CCCD hay số điện thoại) cho biết dữ liệu hiện có đang vi phạm luật nào bao nhiêu dòng, để chủ trọ biết có cần dọn không.
- Không ràng buộc: tổng tiền hóa đơn, trạng thái (danh sách giá trị), ngày sinh (cột kiểu chữ, nhiều dạng) vì chưa chắc mọi luồng hợp lệ đều tuân theo; thêm sau khi có dữ liệu thật để đối chiếu.
- 135 ca kiểm thử `tests/db/constraints.test.py` trên Postgres thật: dòng cũ bẩn chèn TRƯỚC khi cài (như trên Supabase thật), đường upsert của app, vai `authenticated`, chạy lại nhiều lần; thử phá 48 chỗ đều bị bắt.

## Khách tự khai thông tin qua link / mã QR

Trang **Khách thuê → Mời khách khai** (chỉ chủ trọ): chọn phòng (phòng trống xếp lên trước) và thời hạn (24 giờ, 3 ngày, 7 ngày) rồi bấm *Tạo link*. Ra một **đường link kèm mã QR** để chép, chia sẻ qua Zalo / tin nhắn hoặc tải mã QR về in. Khách mở link trên điện thoại, **chụp CCCD hai mặt và tự điền thông tin** (khoảng 3 phút, không cài gì, không cần tài khoản). Hồ sơ về trang *Khách thuê* và mục *Hôm nay cần làm gì* chờ chủ trọ duyệt.

**Duyệt** = mở lại đúng biểu mẫu *Thêm khách thuê* đã điền sẵn (kèm toàn bộ kiểm tra dữ liệu và tìm trùng CCCD / số điện thoại), ảnh CCCD hai mặt hiện bên cạnh, bấm vào để phóng to đối chiếu. Lưu là tạo khách thuê, gắn vào phòng, người đầu tiên của phòng là đại diện. Cũng có *Từ chối* (ghi lý do), *Thu hồi* link chưa dùng, *Xóa ảnh CCCD* khi không cần giữ.

**Bảo mật** (CCCD là dữ liệu nhạy cảm), tất cả kiểm thử trên Postgres thật trong `tests/db/onboarding.test.py` (87 ca, thử phá 31 chỗ, bắt cả 31):

- Token ngẫu nhiên 144 bit nằm sau dấu `#` của link nên không bao giờ gửi lên máy chủ web hay vào nhật ký truy cập; trang khách còn gỡ nó khỏi thanh địa chỉ. Máy chủ chỉ lưu **băm** của token: link hiện đúng một lần lúc tạo, chủ trọ cũng không xem lại được.
- Hết hạn và **dùng đúng một lần**: gửi xong là link chết. Link sai, hết hạn, đã dùng, đã thu hồi đều trả cùng một câu "không hợp lệ", không dò ra được link nào còn sống.
- Khách (không đăng nhập) không đọc được bảng nào, chỉ có hai hàm: xem tên phòng và tòa, và gửi hồ sơ. **Máy chủ kiểm tra lại mọi trường** (tên, số điện thoại, CCCD, ngày thật, giới tính, ký tự `<` `>`, ảnh phải là JPG / PNG / WebP và không quá lớn), chỉ nhận đúng các trường cần, bỏ trường lạ.
- Ảnh CCCD nằm ở bảng riêng, chỉ chủ trọ của lời mời đọc được (RLS), không tải theo mỗi lần mở danh sách. Cột băm token không ai đọc được, kể cả chủ trọ.
- Tự dọn mỗi đêm (`pg_cron`): ảnh của hồ sơ bị từ chối / thu hồi / hết hạn quá 30 ngày; dữ liệu khai của hồ sơ đã duyệt quá 30 ngày (hồ sơ khách đã nằm ở bảng khách thuê). Khách phải tick đồng ý cho chủ nhà dùng thông tin.
- Mã QR tạo ngay trên máy bằng thư viện `js/vendor/qrcode.js` (qrcode-generator của Kazuhiko Arase, giấy phép MIT, nguyên bản không sửa), **không** đưa link cho dịch vụ QR bên ngoài.

**Bật bằng cách:** chạy `supabase/migration-onboarding.sql` trong Supabase → SQL Editor (một lần, chạy lại an toàn). Trang khách ở `join/` (cùng chỗ với web quản trị), dùng chung `js/config.js`. Chưa chạy migration thì nút vẫn hiện nhưng báo rõ phải chạy tệp nào.

Chưa có: tự đọc chữ trên ảnh CCCD (OCR) cho khách (khóa API của AI không được để lộ ra trang công khai, nên chủ trọ vẫn tự đối chiếu bằng mắt), một link chỉ cho một người (phòng ở nhiều người thì tạo mỗi người một link), gửi link thẳng qua Zalo / SMS (cần tài khoản dịch vụ ngoài, hiện chép tin nhắn mời hoặc dùng nút Chia sẻ trên điện thoại).

Khi thử bằng thao tác thật tôi còn sửa: ô ngày sinh đổi từ bánh xe chọn ngày (phải vuốt về năm 1998 rất lâu) sang gõ số, tự chèn dấu `/`; danh sách lời mời tự nhảy tới tab còn việc khi dữ liệu mới về; biểu mẫu thêm khách không bị vẽ lại giữa chừng khi web tự đồng bộ (trước đây mất những gì vừa gõ).

## Báo hỏng có theo dõi tiến độ

Trang **Sự cố & sửa chữa** không còn chỉ là ba trạng thái. Bấm vào một sự cố (hoặc menu "⋯ → Tiến độ & cập nhật") để xem **dòng thời gian** và cập nhật:

- **Hẹn thợ:** ngày hẹn (có nút *Hôm nay / Ngày mai / Ngày kia*), tên thợ, số điện thoại thợ. **Bắt đầu xử lý**, **Ghi chú**, **Đã sửa xong** (kèm chi phí và ai chịu, ô tiền tự chèn dấu chấm), **Mở lại**. Lỗi nhập hiện ngay trong hộp thoại, tô đỏ đúng ô cần sửa.
- Mỗi cập nhật có ô **"Cho khách thấy trong app"**: tick thì khách đọc được mốc và ghi chú kèm theo; ghi chú mặc định là **nội bộ**. **Chi phí, ghi chú nội bộ và tên người thao tác không bao giờ gửi cho khách**: máy chủ lọc trong hàm `tenant_incident_updates` (có kiểm thử trên Postgres thật; thử phá 11 chỗ, bộ thử bắt 10, chỗ còn lại là quyền cấp thừa vì Supabase đã mặc định cấp).
- Bảng sự cố hiện thợ, lịch hẹn, số ngày mở (đỏ khi quá 7 ngày) và chi phí khi đã xong; thẻ **Chi phí sửa 30 ngày** (phần chủ trọ chịu). "Hôm nay cần làm gì" có thêm mục *sự cố hẹn thợ hôm nay / ngày mai*.
- **App khách thuê:** màn *Yêu cầu sửa chữa* hiện khung **"Thợ đến ngày mai"** kèm tên thợ và số bấm gọi được, ba bước có ngày thật của từng bước (trước đây cả ba bước đều hiện ngày báo), và danh sách *Cập nhật từ chủ nhà*. Thông báo ở trang chủ chạm vào là tới đúng màn chi tiết.
- Sự cố cũ không có lịch sử vẫn xem được: dựng lại các mốc từ ngày báo, trạng thái và ngày hoàn tất.

**Bật bằng cách:** chạy `supabase/migration-incident-tracking.sql` trong Supabase → SQL Editor (một lần, chạy lại an toàn). Chưa chạy thì web vẫn dùng được nhưng tiến độ chỉ nằm trong bộ nhớ trình duyệt và app khách chưa thấy tiến độ. Luật cập nhật ở `js/progress.js` (thuần, có kiểm thử).

Khi thử giao diện, tôi thao tác bằng chuột và bàn phím như người dùng thật và sửa những chỗ vướng: thông báo lỗi bị nút "Trợ lý" che (nay thông báo nổi cao hơn nút và lỗi trong hộp thoại hiện ngay tại chỗ), nút "Trợ lý" che hộp thoại trên màn hình hẹp (nay tự ẩn khi mở hộp thoại), thông báo trên app khách không bấm được, và app khách ẩn nhầm các cập nhật công khai.

## Chạy ban đêm: tự ghi phí trễ hạn, tự báo nhắc nợ

Trang **Nhắc nợ → Phí trễ hạn** có thêm mục *Tự động mỗi đêm (0 giờ 05)*, **mặc định tắt**, bật riêng cho từng tòa:

- **Tự ghi phí trễ hạn vào hóa đơn:** máy chủ tính lại mỗi đêm theo đúng luật ở `js/reminders.js` (miễn N ngày đầu, X ₫/ngày, trần 10% tiền gốc, không tính phí chồng phí) rồi ghi dòng "Phí trễ hạn" vào hóa đơn còn nợ. **Chỉ tăng, không bao giờ tự giảm.** Hóa đơn chủ trọ đã tự ghi hoặc miễn phí bằng tay thì được khóa (`late_fee_locked`): đêm sau hệ thống không ghi lại, nên miễn phí cho một khách là miễn thật.
- **Tự báo nhắc nợ vào app khách thuê:** khách thấy thông báo ở trang chủ app khi sắp đến hạn (còn 0 đến 3 ngày), quá hạn 1 đến 3 ngày, 4 đến 7 ngày và từ 8 ngày (mức khẩn nhắc lại mỗi tuần). Mỗi hóa đơn mỗi mức chỉ một thông báo, chạy lại không gửi trùng. **Không gửi Zalo hay SMS** (cần tài khoản dịch vụ ngoài): chủ trọ vẫn nhắc bằng tay ở trang này.
- Mỗi đêm còn đổi trạng thái hóa đơn còn nợ sang "Quá hạn" theo ngày, như web vẫn làm mỗi lần mở, để app khách không hiện trạng thái cũ.
- Nút **Chạy ngay** làm đúng việc của lần chạy đêm theo cài đặt đã lưu (có hỏi lại trước khi chạy). Hộp thoại hiện *Lần chạy gần nhất* ghi rõ đã làm gì. Việc đã làm cũng ghi vào nhật ký hoạt động.

**Bật bằng cách:** chạy `supabase/migration-nightly.sql` trong Supabase → SQL Editor (một lần, chạy lại an toàn). Giờ chạy tự động dùng **pg_cron**: nếu tệp báo chưa bật được, vào Database → Extensions bật `pg_cron` rồi chạy lại tệp. Chưa có pg_cron thì nút *Chạy ngay* vẫn dùng được. Ngày tính theo giờ Việt Nam (UTC+7).

Hạn chế cần biết: web quản trị tự tải lại dữ liệu từ máy chủ mỗi 2 phút và khi quay lại tab, nên phí máy chủ ghi ban đêm hiện ra sau tối đa 2 phút; nếu chủ trọ để tab cũ rất lâu rồi sửa đúng hóa đơn đó thì bản cũ có thể đè mất dòng phí (đêm sau tự ghi lại).

Luật tính nằm ở hai nơi (JS để xem trước, SQL để chạy đêm) nên có bộ thử riêng trên Postgres thật: `tests/db/nightly.test.py` (75 ca, lấy lại các ca của `tests/reminders.test.js`). Đã thử phá 27 chỗ của migration, bộ thử bắt được 25; hai chỗ còn lại là biến thể tương đương (thứ tự `case` và lớp quyền thừa vì RLS đã chặn).

## Ngày lưu đúng (không lệch một ngày)

Ngày trong hóa đơn, hợp đồng, phiếu thu là **ngày lịch**, không phải một thời điểm. Bản cũ ghi nửa đêm 1/10 giờ Việt Nam thành chuỗi UTC `2026-09-30T17:00:00Z`; cột `date` của Postgres cắt lấy `30/9`, nên hạn đóng tiền và đầu kỳ hóa đơn bị lưu **sớm một ngày** (hạn 5 thành 4, đầu kỳ ngày cuối tháng trước). Phiếu thu ghi lúc 0 đến 7 giờ sáng cũng rơi về hôm trước. Đã sửa ở gốc:

- `js/dates.js` (thuần, có kiểm thử, thử ở nhiều múi giờ): đổi ngày sang `YYYY-MM-DD` theo lịch địa phương, đọc `YYYY-MM-DD` đúng ngày ở mọi múi giờ, và tính số ngày chênh theo ngày lịch (hạn 5/10, lúc 20:00 ngày 5/10 là "còn 0 ngày", chưa quá hạn).
- `js/backend.js`: mọi cột kiểu `date` (hóa đơn, hợp đồng, phiếu thu, sổ thu chi, tài sản, phòng) đều qua bước đổi này trước khi gửi lên máy chủ.
- `U.fmtDate` / `U.daysBetween` và app khách thuê dùng cùng quy tắc.

**Dữ liệu cũ đã lưu lệch cần sửa một lần:** chạy `supabase/repair-invoice-dates.sql` trong Supabase → SQL Editor (có bước xem trước, chạy lại an toàn, chỉ dịch hóa đơn có đầu kỳ rơi vào ngày cuối tháng và không đụng hóa đơn đã đúng). Có kiểm thử trên Postgres thật: `tests/db/repair-dates.test.py`.

## Hôm nay cần làm gì

Trang Tổng quan có khối **Hôm nay cần làm gì**: việc của chủ trọ gom theo **từng tòa nhà** và theo **quyền** của người đang dùng (nhân viên chỉ thấy việc thuộc quyền mình), xếp theo mức gấp:

- **Gấp (đỏ):** hợp đồng đã quá hạn hoặc còn dưới 7 ngày, phòng đã quá hạn từ 4 ngày trở lên cần nhắc nợ, sự cố mở quá 7 ngày.
- **Nên làm hôm nay (vàng):** phòng quá hạn nhẹ cần nhắc, phiếu chuyển khoản chờ duyệt, khách xin gia hạn, chốt sổ khi đã đủ chỉ số (hoặc từ ngày 25), hóa đơn nháp chờ phát hành, câu khách hỏi chưa trả lời, chưa ghi chỉ số (từ ngày 25).
- **Sắp tới (xanh):** phòng sắp đến hạn đóng tiền, hợp đồng hết hạn trong 30 ngày, phí trễ hạn chưa ghi, khách chưa có mã vào app.

Mỗi việc có nút làm ngay đi thẳng tới đúng chỗ (có sẵn bộ lọc; nút *Chốt sổ* mở thẳng bước xem trước) và nút **Hoãn**: ẩn việc đó đến hết hôm nay, **tự hiện lại** nếu việc nặng thêm (gấp hơn hoặc nhiều phòng hơn lúc hoãn). Việc đã hoãn xem và hiện lại được. Danh sách việc hoãn lưu theo trình duyệt. Xếp thứ tự và hoãn ở `js/today.js` (thuần, có kiểm thử), dựng việc thô ở `S.todayItems()`.

## Đăng nhập app khách thuê

Trước đây app khách thuê chỉ cần số điện thoại: ai biết một số là đọc được cả hồ sơ khách (CCCD, ngày sinh, hóa đơn, bạn cùng phòng) và gửi thay khách, còn OTP chỉ là mã cố định kiểm tra ngay trong trình duyệt. Giờ đăng nhập được kiểm ở **máy chủ**:

1. **Chủ trọ cấp mã.** Trang Khách thuê: nút *Mã vào app* cấp hàng loạt cho cả tòa (danh sách chép / tải Excel / in), hoặc menu ⋯ của từng khách. Mã 6 số ngẫu nhiên, hiện **một lần duy nhất**; máy chủ chỉ lưu bản băm (bcrypt) nên chủ trọ cũng không xem lại được. Quên thì cấp mã mới. Chỉ **chủ** cấp được, nhân viên thì không.
2. **Khách nhập số điện thoại + mã.** Hàm `tenant_login` kiểm ở máy chủ, đúng thì trả một token ngẫu nhiên (hiệu lực 30 ngày, lưu băm sha256). Mọi hàm `tenant_*` khác nhận token thay cho số điện thoại; các hàm cũ nhận số điện thoại đã bị **xóa**. Dữ liệu của khách chỉ được tải *sau* khi vào được (trước đây tải ngay khi nhập số).
3. **Chống đoán mã.** Sai 5 lần liên tiếp thì khóa số đó 15 phút (kể cả mã đúng cũng bị từ chối trong lúc khóa). Số lạ và mã sai báo y hệt nhau nên không dò được số nào có trong hệ thống.
4. **Thu hồi.** Cấp mã mới, hoặc *Thu hồi quyền vào app* (khách đã trả phòng, mất điện thoại), sẽ đăng xuất khách khỏi mọi thiết bị. Khách tự đăng xuất thì phiên bị xóa trên máy chủ.
5. Nhiều chủ trọ có thể trùng số điện thoại của khách; mã quyết định đúng người nên không lẫn dữ liệu giữa hai chủ trọ.

**Thứ tự triển khai** (làm liền nhau, vì giữa hai bước khách chưa vào được app): (a) đưa bản web và app khách mới lên (đã có trên GitHub Pages); (b) chạy `supabase/migration-tenant-auth.sql` trong Supabase → SQL Editor; (c) vào Khách thuê → *Mã vào app* → cấp mã cho cả tòa rồi gửi cho từng khách. Khách hiện có chưa có mã nên chưa vào được app cho tới bước (c).

Giới hạn: mã 6 số được bảo vệ bằng khóa 15 phút sau 5 lần sai, không có SMS xác thực số điện thoại (cần nhà cung cấp SMS, chưa làm). Mã tới tay khách qua kênh chủ trọ tự chọn (Zalo, tin nhắn, nói trực tiếp).

## Đăng nhập (bản demo)

- Nhập **email hợp lệ bất kỳ** và **mật khẩu bất kỳ** (hoặc bấm *Điền nhanh*).
- Chọn vai trò để thấy khác biệt phân quyền:
  - **Chủ trọ** — thấy toàn bộ (tài chính, cấu hình, thu chi, đổi trạng thái phòng, hủy hóa đơn…).
  - **Nhân viên vận hành** — ẩn dữ liệu tài chính và các mục ngoài phạm vi.
- Đổi vai trò bất cứ lúc nào ở ô **Tài khoản** (góc phải thanh nav xanh).


## Tính năng đã dựng

| Nhóm | Màn hình |
|---|---|
| Xác thực | Đăng nhập (kiểm tra email khi rời ô, trạng thái chờ, dải lỗi) |
| Công ty | **Tổng quan** (4 thẻ KPI có xu hướng, dòng tiền 6 kỳ, vòng cung tiến độ thu, 3 biểu đồ tròn, tiêu thụ điện nước, hiệu suất từng tòa, chi phí theo hạng mục, phiếu thu gần đây, top công nợ, việc cần xử lý) · Tòa nhà · Nhật ký hệ thống |
| Phòng | Sơ đồ theo tầng + chế độ bảng · tooltip · **tạo phòng hàng loạt** (2 bước, phát hiện trùng mã) · **đổi trạng thái** (DangerDialog, máy trạng thái) |
| Khách thuê | Danh sách · **thêm bằng ảnh CCCD**: Gemini đọc chữ trên thẻ rồi điền sẵn họ tên, số CCCD, ngày sinh, quê quán, thường trú; ảnh mặt sau cho ngày cấp; ô nào chữ mờ thì gắn cờ độ tin cậy thấp; đọc không được thì để trống chứ không điền bừa · **bắt điền đủ 8 ô** (kiểm cả định dạng) mới cho lưu · **điểm thanh toán** của từng phòng (xem mục dưới) |
| Hợp đồng | Danh sách · **lập hợp đồng 5 bước** (Phòng → Khách → Điều khoản → Dịch vụ → Bàn giao → xác nhận) · lưu nháp · **trả phòng & thanh lý** (kiểm kê tài sản, quyết toán cọc) |
| Điện nước | **Ghi chỉ số** nhập nhanh (Tab/Enter xuống dòng, tính tiêu thụ tức thì, cảnh báo bất thường, chỉ số khách tự ghi chờ duyệt, xử lý quay vòng đồng hồ) |
| Hóa đơn | Danh sách + 4 thẻ chỉ số + chọn kỳ · **sinh hóa đơn hàng loạt** (kiểm tra điều kiện) · **phát hành** (tiến trình từng bước) · **chi tiết hóa đơn** (căn cứ tính từng dòng, lịch sử thanh toán, dải "đã chỉnh sửa") · **hủy hóa đơn** (DangerDialog) |
| Thanh toán | **Ghi nhận thanh toán** với **phân bổ tự động** (trả trước kỳ cũ nhất) · trang công nợ |
| Khác | Dịch vụ & đơn giá · Tài sản (khấu hao, giá trị còn lại) |
| Trợ lý ảo | **Chat AI** ở cả web quản trị và app khách thuê — luật từ khóa trả lời miễn phí, Gemini Flash chỉ dùng cho câu hỏi phức tạp |
| Thu tiền tự động | **Đối soát ngân hàng**: mã VietQR điền sẵn nội dung, tiền về là tự khớp hóa đơn và xóa công nợ (webhook SePay/Casso, dán sao kê, hoặc duyệt phiếu khách báo) |

### Thành phần dùng chung (theo Phần II đặc tả)
`MetricCard`, `StatusBadge` (bảng quy ước màu §1.2), `DataTable` (tìm/lọc/sắp xếp/phân trang/chọn hàng loạt/trạng thái rỗng/skeleton), `PeriodSelector`, `DangerDialog` (bắt buộc nhập lý do ≥10 ký tự), toast, modal, menu.

### Chi tiết kỹ thuật
- Số tiền & chỉ số: font mono, `tabular-nums`, định dạng `1.250.000 ₫`.
- Trạng thái tải (skeleton / spinner trong nút / thanh tiến trình), phản hồi lạc quan, thông báo lỗi bằng ngôn ngữ nghiệp vụ.
- Phím tắt: `/` tìm kiếm · `n` tạo mới · `Esc` đóng · `?` bảng phím tắt.
- Phân quyền sinh menu theo vai trò; chặn truy cập route ngoài phạm vi.
- Responsive: thanh bên thành ngăn kéo trên màn hình hẹp.

## Điểm thanh toán

Mỗi phòng có một **điểm thanh toán** hiện trên trang Khách thuê (huy hiệu cạnh tên phòng) kèm bộ lọc **Hay trả trễ**, để chủ trọ biết nhắc ai trước. Luật đơn giản, giải thích được, không dùng AI:

| Hóa đơn | Điểm |
|---|---|
| Trả đủ, đúng hoặc trước hạn | 1,00 |
| Trả đủ nhưng trễ *d* ngày | 1 − 0,7 × min(*d*, 30) / 30 (trễ 5 ngày ≈ 0,88; từ 30 ngày trở lên = 0,30) |
| Quá hạn, đã trả một phần | 0,25 |
| Quá hạn, chưa trả đồng nào | 0 |
| Chưa tới hạn, hoặc trả đủ mà không có phiếu thu ghi ngày | không tính |

Điểm = trung bình có trọng số × 100, hóa đơn mới nặng hơn (mỗi kỳ lùi về trước nhân 0,85) nên khách sửa được thói quen thì điểm lên lại. Hạng: ≥ 90 Xuất sắc · ≥ 75 Tốt · ≥ 50 Trung bình · còn lại Cần nhắc. Dưới 3 hóa đơn được chấm thì ghi **tạm tính**. Tính theo **hợp đồng đang hiệu lực** để điểm của khách cũ không dồn sang khách mới. Mã nằm ở `js/scoring.js`, rê chuột vào huy hiệu để xem lời giải thích từng phòng.

## Điểm thưởng cho khách đóng tiền đúng hạn

Khác với **điểm thanh toán** ở trên (thước đo để chủ trọ biết ai hay trễ), đây là chương trình **thưởng cho khách** để khuyến khích đóng đúng hạn, đỡ phải nhắc nợ. **Mặc định tắt**; bật ở *Khách thuê → Điểm thưởng* (chủ trọ).

- **Luật (đọc là hiểu):** mỗi hóa đơn đóng đủ đúng hạn hoặc trước hạn được 10 điểm; đóng đúng hạn 3 tháng liền thưởng thêm 20 điểm (lặp lại ở 6, 9... tháng liền); đóng trễ hoặc quá hạn chưa trả đủ thì chuỗi về 0, điểm đã có vẫn giữ. Hóa đơn chưa tới hạn, hoặc đã trả đủ nhưng không có phiếu thu ghi ngày, thì chưa tính (không đoán). Mọi con số chỉnh được trong cài đặt (điểm mỗi hóa đơn, độ dài chuỗi, điểm thưởng chuỗi, tỉ lệ đổi, bậc đổi, tối đa % mỗi hóa đơn).
- **Đổi điểm thành tiền giảm** vào MỘT hóa đơn chưa thu: mặc định 100 điểm = 100.000 ₫, theo bậc 100 điểm, tối đa 50% số còn phải thu của hóa đơn đó (không bao giờ giảm hết). Hóa đơn thêm một dòng "Thưởng đóng tiền đúng hạn (N điểm)" số âm nên khách thấy ngay trong app, phí trễ hạn tự tính trên số đã giảm, nhật ký ghi lại.
- **Điểm không lưu riêng nên không bao giờ lệch:** tính lại từ hóa đơn + phiếu thu của hợp đồng đang hiệu lực (khách đổi thì điểm không dồn sang người sau), trừ điểm đã đổi (các dòng thưởng trên hóa đơn). Hủy hóa đơn đã giảm thì điểm tự trả lại. Chỉ tính hóa đơn có hạn từ **ngày bắt đầu** của chương trình (mặc định hôm nay), nên bật lên không tặng ngược điểm cho quá khứ; muốn tính cả quá khứ thì lùi ngày bắt đầu.
- **Ở trang Khách thuê:** huy hiệu ✨ số điểm cạnh điểm thanh toán của từng phòng; bấm vào để xem sổ điểm (từng khoản cộng, tiến độ tới lần thưởng chuỗi kế), đổi điểm vào hóa đơn đang chờ thu (có xem trước số tiền giảm), và **soạn sẵn tin nhắn báo điểm** để sao chép gửi Zalo / SMS.
- **Cần chạy một lần** `supabase/migration-rewards.sql` (thêm cột `buildings.reward_config`, chạy lại được, không đụng dữ liệu có sẵn). Chưa chạy thì chương trình vẫn dùng được nhưng cài đặt chỉ lưu tạm trong máy; hộp thoại cài đặt báo rõ.
- Chưa có: khách xem điểm của mình trong app khách thuê (cần thêm vào hàm `tenant_data` phía máy chủ). Hiện chủ trọ báo bằng tin nhắn soạn sẵn; khoản giảm đã hiện trong hóa đơn của khách.
- `js/rewards.js` thuần: 62 ca kiểm thử `tests/rewards.test.js` (cấu hình, chuỗi, thứ tự dữ liệu, ngày bắt đầu, đổi điểm, tin nhắn, ghép với `js/scoring.js` thật), thử phá 60 chỗ đều bị bắt. Khi viết kiểm thử phát hiện một lỗi thật: hóa đơn thiếu ngày hạn làm hàm tính điểm văng `Invalid time value`. Thử như người dùng thật: gõ sai cấu hình không lưu được, đổi sai bậc / vượt số dư bị chặn kèm lý do, đổi đúng thì hóa đơn giảm cả trên máy chủ.

## Nhắc nợ nhiều cấp + phí trễ hạn

Trang **Nhắc nợ** (menu Thêm, hoặc nút trên trang Thanh toán & công nợ) gom các phòng sắp đến hạn hoặc đã quá hạn và soạn sẵn tin nhắc theo bốn mức, giọng văn nặng dần:

| Mức | Khi nào | Giọng |
|---|---|---|
| Sắp đến hạn | còn 0–3 ngày tới hạn | nhắc lịch sự, không nói đến phạt |
| Nhắc nhẹ | quá hạn 1–3 ngày | nêu số ngày trễ, xin chuyển trong hôm nay |
| Có phí | quá hạn 4–7 ngày | báo quy định phí trễ hạn và số phí tạm tính (nếu đã bật phí) |
| Khẩn | quá hạn từ 8 ngày | tổng cần trả, đề nghị trả ngay, nhắc điều khoản hợp đồng |

Hệ thống **chỉ soạn, không tự gửi**: chủ trọ đọc, sửa trong ô tin nhắn rồi bấm **Chép tin**, **Zalo** (tự chép tin, mở cuộc trò chuyện) hoặc **SMS**. Mỗi lần nhắc được ghi vào nhật ký, trang sẽ hiện *"Đã nhắc hôm qua (nhắc nhẹ)"*, và báo *nên nhắc mức cao hơn* khi khách trễ thêm sang mức mới. Tin có số tài khoản khi `js/config.js` khai báo `bank: { name, account, holder }`; chưa khai báo thì **không bịa số tài khoản**, hộp soạn tin có cảnh báo.

**Phí trễ hạn** do chủ trọ bật ở nút *Phí trễ hạn*, **mặc định tắt**: miễn *N* ngày đầu (mặc định 3), sau đó *X* ₫ mỗi ngày, tổng không quá **10% tiền hóa đơn** (trần cố định trong mã). Phí tính trên tiền gốc nên không tính chồng lên phí đã ghi. Phí chỉ là *tạm tính* cho tới khi chủ trọ bấm **Ghi phí vào hóa đơn** (có hộp xác nhận); lúc đó hóa đơn có thêm dòng "Phí trễ hạn", khách thấy trong app, và gỡ lại được từng hóa đơn. Phí là số chụp tại thời điểm ghi, không tự tăng theo ngày; muốn cập nhật thì ghi lại (thay dòng cũ, không cộng dồn). Chỉ thu khi hợp đồng thuê đã ghi điều khoản này. Chính sách lưu trên tòa nhà, cần chạy `supabase/migration-late-fee.sql` để lưu lên máy chủ (chưa chạy thì app báo khi lưu và cài đặt mất khi tải lại). Mã tính toán ở `js/reminders.js`, giao diện ở `js/pages/reminders.js`.

## Kiểm tra dữ liệu nhập

Mọi biểu mẫu nhập tiền, ngày, danh tính đều kiểm ngay tại ô: gõ xong rời ô là hiện lỗi đỏ ngay dưới ô sai, sửa tới đâu xóa báo tới đó, bấm Lưu mà còn sai thì cuộn tới ô sai đầu tiên. Luật nằm ở `js/validate.js` (thuần, có kiểm thử), phần gắn vào ô ở `UI.formRules` trong `js/components.js`. Đã áp cho: ghi thanh toán, gia hạn và sửa hợp đồng, lập hợp đồng 5 bước, quét hợp đồng giấy, trả phòng, tạo khách thuê (cả trong hợp đồng), xe của khách, dịch vụ, tài sản trong kho, sự cố, tạo phòng hàng loạt, tòa nhà, thu chi, nhân viên.

Các luật đáng nói:
- **Tiền** đọc chuỗi thô: chỉ nhận chữ số và dấu nhóm nghìn. Trước đây `U.parseNum` bỏ hết ký tự lạ nên `-5` thành 5 và `1,5` thành 15 mà không báo gì. Giá thuê phải từ 100.000 ₫ đến 500 triệu để bắt gõ nhầm thừa/thiếu số 0.
- **Ghi thanh toán** không cho nhập quá công nợ. Trước đây phần dư hiện là "chuyển kỳ sau" nhưng thực tế bị bỏ, vì hệ thống chưa có sổ tiền thừa.
- **Ngày** phải có thật (chặn 31/02), không ở tương lai khi là ngày thu/chi, ngày kết thúc phải sau ngày bắt đầu.
- **Số điện thoại** là khóa đăng nhập app khách thuê nên không được trùng người khác (cùng CCCD thì là cùng một người); `+84` và khoảng trắng được chuẩn hóa về `0xxxxxxxxx`. **Biển số xe** không được trùng xe khác.
- **Diện tích** đọc đúng `20,5` (trước đây thành 205).

## Chia hóa đơn cho người ở + xin gia hạn từ app khách

**Chia hóa đơn phòng ghép.** Trang chi tiết hóa đơn (phòng có từ 2 người ở) có thêm khối *Chia cho N người ở*: mỗi người một phần, kèm nút chép tin nhắn có sẵn số tiền, số tài khoản và nội dung chuyển khoản, và nút mở Zalo. App khách thuê cho người đại diện thấy cùng khối này để nhắc bạn cùng phòng. Mỗi dòng của hóa đơn chia riêng, số đồng dư chia theo "phần dư lớn nhất" nên tổng các phần **luôn đúng bằng hóa đơn** (kể cả phí trễ hạn). Hệ thống vẫn ghi thu theo **cả phòng**: phần của từng người chỉ là cách chia để họ tự thỏa thuận, không phải sổ nợ riêng, và mọi người chuyển cùng một nội dung nên tiền tự khớp vào đúng hóa đơn. Mã ở `js/split.js` (thuần, có kiểm thử), dùng chung cho cả hai app.

**Xin gia hạn hợp đồng.** Khi hợp đồng còn tối đa 90 ngày (hoặc đã quá hạn), **người đại diện hợp đồng** thấy nút *Xin gia hạn* trong app khách thuê: chọn 3 / 6 / 12 / 24 tháng, nhắn thêm nếu muốn, gửi. Đây là **yêu cầu**, không tự gia hạn. Chủ trọ thấy khối *N khách xin gia hạn hợp đồng* ở đầu trang Hợp đồng (và trong thông báo), bấm **Chấp nhận** (có thể đổi giá thuê mới) thì hợp đồng gia hạn thật, hoặc **Từ chối** kèm lý do để khách đọc trong app. Cần chạy `supabase/migration-renewal.sql` một lần; chưa chạy thì app khách báo "chủ nhà cần chạy SQL" khi bấm gửi, web quản trị vẫn dùng bình thường. Chưa có bước ký OTP: chủ trọ chấp nhận trên hệ thống là xác nhận.

**Tài khoản nhận tiền.** Bản chạy thật (đã nối Supabase) mà `js/config.js` chưa khai báo `bank` thì app khách **không hiện số tài khoản mẫu và mã QR** (chỉ hiện nội dung chuyển khoản kèm lời nhắn hỏi chủ nhà), và tin nhắc nợ không có dòng số tài khoản. Trước đây app dùng số mẫu `0912345678` và vẽ cả mã VietQR cho số đó, khách chuyển theo là mất tiền. Bản demo không nối máy chủ vẫn dùng số mẫu cho đẹp.

## Thu tiền chuyển khoản tự động

Câu hỏi thường gặp: *"khách chuyển khoản xong thì công nợ tự xóa được không?"* — được, nhưng cần
giải quyết hai việc tách bạch:

**1. Làm sao biết giao dịch này của hóa đơn nào?**
App sinh mã **VietQR thật** trong app khách thuê, điền sẵn số tiền và nội dung dạng
`HD2608013` (mã hóa đơn, bỏ dấu gạch). Khách quét bằng app ngân hàng bất kỳ là nội dung luôn đúng.
Nếu khách gõ tay, bộ dò vẫn tìm được theo thứ tự: mã hóa đơn → mã phòng + kỳ → mã phòng + số tiền →
số tiền duy nhất. Không chắc thì **không đoán** — đẩy sang cho chủ trọ chọn tay.

**2. Làm sao biết tiền đã về?**
Ngân hàng Việt Nam không mở API cho tài khoản cá nhân, nên có 3 đường, dùng chung một bộ dò:

| Cách | Độ tự động | Cần gì |
|---|---|---|
| Webhook **SePay** / **Casso** | Tiền về là tự ghi thu | Chạy `migration-bank-reconcile.sql`, triển khai `functions/bank-webhook`, dán webhook vào SePay/Casso (đều có gói miễn phí) |
| **Dán sao kê** | Đối soát cả tháng trong vài giây | Không cần gì — copy các dòng tiền vào rồi dán |
| **Khách tự báo** | Chủ trọ bấm duyệt | Không cần gì — có sẵn |

Mọi khoản thu đều sinh **phiếu thu có số**, ghi vào nhật ký, và có chống ghi trùng theo mã giao dịch
ngân hàng. Xem ở **Khách chuyển khoản → Đối soát ngân hàng**.

**Webhook bắt buộc có mã bí mật.** Hàm `bank-webhook` từ chối (401) mọi lời gọi không mang đúng mã, nhận mã từ header `Authorization: Apikey <mã>` (SePay), header `secure-token` (Casso V1) hoặc `?key=<mã>` trên link. Bản cũ chỉ kiểm khi lời gọi có kèm header `Authorization`, nên yêu cầu không kèm gì vẫn lọt: ai biết link đều bơm được giao dịch "tiền vào" giả để app tự xóa công nợ. Đã vá; phần kiểm mã tách ở `supabase/functions/bank-webhook/auth.ts`, 21 ca `tests/bank-webhook-auth.test.js`, thử phá 13 chỗ (chỉ còn một kiểu tương đương, chỉ khác thời gian chạy). Các bước đăng ký SePay / Casso / Zalo OA / SMS: xem `HUONG_DAN_DANG_KY.md`.

## Trợ lý ảo (AI)

Trợ lý chạy theo **3 tầng**, thiết kế để **không bao giờ để mô hình tự nghĩ ra số liệu**:

| Tầng | Chạy khi nào | Chi phí | Cách hoạt động |
|---|---|---|---|
| 1. Luật từ khóa | Luôn luôn, ưu tiên đầu | 0 đ | Nhận diện ý định bằng từ khóa, code truy vấn dữ liệu thật rồi ghép vào câu mẫu |
| 2. Gemini Flash | Chỉ khi tầng 1 không hiểu | Gói miễn phí (~1.500 lượt/ngày) | (a) mô hình **chỉ phân loại ý định**, trả JSON, không có số, (b) code lấy **số thật**, (c) mô hình **soạn lời văn từ số đó** |
| 3. Trả lời trung thực | Khi cả hai tầng đều không xử lý được | 0 đ | Nói thẳng là chưa hỗ trợ; app khách còn tự chuyển câu hỏi cho chủ nhà |

Nhờ vậy: câu hỏi lặp đi lặp lại (*"tháng này đóng bao nhiêu"*) **không tốn lượt gọi API**, và mọi con số hiển thị đều lấy từ cơ sở dữ liệu chứ không phải do mô hình đoán.

**Tầng 1 hiểu được gì** (`js/nlu.js`, dùng chung cho 2 app, không gọi mạng):

| Loại | Ví dụ |
|---|---|
| Tháng | *tháng này · tháng trước · 2 tháng trước · tháng 7 · T7/2026 · tháng này năm ngoái* |
| Khoảng thời gian | *6 tháng gần đây · nửa năm · cả năm* |
| Tòa nhà / phòng / khách | *Gò Vấp · Q7 · phòng P101 · phòng 205 · khách tên Linh · số điện thoại* |
| Hỏi nối tiếp | *Phòng P101 thế nào?* → *còn nợ bao nhiêu?* → *còn P102 thì sao?* |
| Gõ sai / không dấu | *doanh thuu thang nay · phong nao dang no* |

Khi không chắc, bot **hỏi lại** thay vì đoán (mã phòng có ở nhiều tòa, nhiều khách trùng tên, phòng không tồn tại),
và luôn ghi dòng *"Hiểu là: …"* mỗi khi dùng lại ngữ cảnh của câu trước để người dùng kịp sửa.

**Trợ lý quản trị** còn: so sánh 2 kỳ, biểu đồ xu hướng, soạn sẵn tin nhắc nợ (chép / mở Zalo — không tự gửi).
**Trợ lý khách thuê** còn: giải thích *vì sao tháng này tiền cao hơn* bằng số thật từng khoản, trích đúng điều khoản
hợp đồng theo câu hỏi, theo dõi tiến độ sửa chữa, và **hỏi trước** khi chuyển câu hỏi lạ cho chủ nhà.

**Bật Gemini** (tùy chọn — không bật thì tầng 1 và 3 vẫn chạy bình thường):

1. Lấy khóa miễn phí tại <https://aistudio.google.com/apikey>.
2. Cách an toàn (nên dùng khi công khai web): triển khai `supabase/functions/ai` rồi điền `aiProxyUrl` vào `js/config.js`. Khóa nằm ở máy chủ, trình duyệt không thấy.
3. Cách nhanh (chỉ chạy thử ở máy cá nhân): điền thẳng `geminiApiKey` vào `js/config.js`. **Lưu ý: ai mở trình duyệt cũng đọc được khóa này.**

Xem hướng dẫn đầy đủ trong `js/config.example.js` và `supabase/functions/ai/index.ts`.
Trạng thái trợ lý (đang chạy tầng nào, còn bao nhiêu lượt) xem ở **Cài đặt chung → Trợ lý ảo (AI)**.

## Cấu trúc mã nguồn

```
index.html            # nạp toàn bộ CSS/JS
sw.js                 # service worker: mở được khi mất mạng, ưu tiên mạng (xem mục "Cài như ứng dụng")
manifest.webmanifest  # khai báo để cài lên màn hình chính, biểu tượng ở assets/icon-*.png
css/
  tokens.css          # biến thiết kế (màu, chữ, khoảng cách) — §1.2–1.4
  base.css            # reset + tiện ích
  layout.css          # khung + thanh bên 2 tầng — §1.5
  components.css      # thành phần dùng chung — Phần II
  pages.css           # style riêng từng màn hình
  mobile.css          # giao diện điện thoại: bảng thành thẻ, nút đủ to, số tiền không gãy dòng
js/
  utils.js            # định dạng tiền/số/ngày, tag template html
  scoring.js          # điểm thanh toán của hợp đồng (không đụng DOM, có kiểm thử)
  reminders.js        # mức nhắc nợ, phí trễ hạn, soạn tin (không đụng DOM, có kiểm thử)
  validate.js         # luật kiểm tra dữ liệu nhập: tiền, ngày, sđt, CCCD, biển số (không đụng DOM, có kiểm thử)
  split.js            # chia hóa đơn cho người ở, dùng chung với app khách (không đụng DOM, có kiểm thử)
  closing.js          # phân loại phòng khi chốt sổ tháng (không đụng DOM, có kiểm thử)
  today.js            # xếp thứ tự và hoãn việc "Hôm nay cần làm gì" (không đụng DOM, có kiểm thử)
  dates.js            # ngày theo lịch: ghi cột date không lệch múi giờ, đếm ngày quá hạn (không đụng DOM, có kiểm thử)
  progress.js         # tiến độ xử lý sự cố: dòng thời gian, hẹn thợ, chi phí (không đụng DOM, có kiểm thử)
  voice.js            # hiểu câu nói tiếng Việt thành phòng + chỉ số, nghe bằng micro (phần hiểu không đụng DOM, có kiểm thử)
  listing.js          # trang công khai giới thiệu phòng: mã ngẫu nhiên, link, số điện thoại, ảnh, tin chia sẻ (không đụng DOM, có kiểm thử)
  rewards.js          # điểm thưởng đóng tiền đúng hạn: luật điểm, chuỗi, đổi điểm, tin nhắn (không đụng DOM, có kiểm thử)
  renewal.js          # gia hạn hợp đồng: tính hạn mới, lịch sử, nội dung phụ lục (không đụng DOM, có kiểm thử)
  offline.js          # hàng đợi chỉ số chưa gửi, đối chiếu với máy chủ, ảnh chụp ngoại tuyến (không đụng DOM, có kiểm thử)
  offline-ui.js       # đăng ký service worker, thanh trạng thái mạng, hộp thoại chỉ số xung đột, mở ngoại tuyến
  onboarding.js       # khách tự khai qua link: kiểm hồ sơ, trạng thái, token, tin nhắn mời (không đụng DOM, có kiểm thử)
  vendor/qrcode.js    # thư viện tạo mã QR (MIT), tạo ngay trên máy
  icons.js            # bộ icon SVG dùng chung
  charts.js           # biểu đồ SVG thuần: donut, cột, vùng, tiến độ, vòng cung
  nlu.js              # hiểu câu tiếng Việt: chấm điểm ý định, bóc tháng/tòa/phòng, nhớ ngữ cảnh
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
    tenants.js        # khách thuê + đọc ảnh CCCD + điểm thanh toán
    tenant-access.js  # chủ trọ cấp / thu hồi mã vào app khách thuê
    support.js        # hỏi đáp khách thuê (nhân viên trả lời tin khách nhắn)
    contracts.js      # hợp đồng, lập mới 5 bước, thanh lý
    billing.js        # chỉ số, hóa đơn, chi tiết, thanh toán
    reminders.js      # trang Nhắc nợ + chính sách phí trễ hạn
    misc.js           # dịch vụ, tài sản
tests/
  scoring.test.js     # kiểm thử luật điểm: node tests/scoring.test.js
  reminders.test.js   # kiểm thử nhắc nợ + phí: node tests/reminders.test.js
  validate.test.js    # kiểm thử luật nhập liệu: node tests/validate.test.js
  split.test.js       # kiểm thử chia hóa đơn: node tests/split.test.js
  closing.test.js     # kiểm thử phân loại chốt sổ: node tests/closing.test.js
  today.test.js       # kiểm thử việc hôm nay: node tests/today.test.js
  dates.test.js       # kiểm thử ngày lịch: node tests/dates.test.js
  progress.test.js    # kiểm thử tiến độ sự cố: node tests/progress.test.js
  onboarding.test.js  # kiểm thử khách tự khai: node tests/onboarding.test.js
  voice.test.js       # kiểm thử giọng nói: node tests/voice.test.js
  offline.test.js     # kiểm thử ghi chỉ số ngoại tuyến: node tests/offline.test.js
  renewal.test.js     # kiểm thử gia hạn hợp đồng: node tests/renewal.test.js
  rewards.test.js     # kiểm thử điểm thưởng: node tests/rewards.test.js
  listing.test.js     # kiểm thử trang công khai phòng: node tests/listing.test.js
  bank-webhook-auth.test.js  # kiểm thử kiểm mã webhook ngân hàng (cần node 22.18+): node tests/bank-webhook-auth.test.js
```

## Kiểm thử

```bash
node tests/scoring.test.js
node tests/reminders.test.js
node tests/validate.test.js
node tests/split.test.js
node tests/closing.test.js
node tests/today.test.js
node tests/dates.test.js
node tests/progress.test.js
node tests/onboarding.test.js
node tests/voice.test.js
node tests/offline.test.js
node tests/renewal.test.js
node tests/rewards.test.js
node tests/listing.test.js
node tests/bank-webhook-auth.test.js
```

Không cần cài gì thêm cho các bộ trên. Hiện có kiểm thử cho luật điểm thanh toán (20 ca), nhắc nợ + phí trễ hạn (42 ca: phân mức, trần 10%, không cộng dồn phí, soạn tin) luật nhập liệu (29 ca) chia hóa đơn (27 ca) và phân loại chốt sổ (23 ca) và việc hôm nay (23 ca) và ngày lịch (35 ca) và tiến độ sự cố (45 ca) và khách tự khai (66 ca) và giọng nói (87 ca) và ghi chỉ số ngoại tuyến (63 ca) và gia hạn hợp đồng (41 ca) và điểm thưởng (62 ca) và trang công khai phòng (36 ca); cả mười bốn đã thử phá luật để chắc bộ kiểm thử bắt được lỗi. Các phần tính tiền hóa đơn và dò ý trợ lý ảo chưa có.

**Kiểm thử cơ sở dữ liệu.** Các tệp `supabase/*.sql` được thử trên một Postgres thật chạy tại máy (không cần tài khoản Supabase), kèm bản giả của lớp `auth` và `pgcrypto`:

```bash
python -m venv .venv-db
.venv-db/Scripts/pip install pgserver "psycopg[binary]"
.venv-db/Scripts/python tests/db/tenant-auth.test.py
.venv-db/Scripts/python tests/db/repair-dates.test.py
.venv-db/Scripts/python tests/db/nightly.test.py
.venv-db/Scripts/python tests/db/incident-tracking.test.py
.venv-db/Scripts/python tests/db/onboarding.test.py
.venv-db/Scripts/python tests/db/constraints.test.py
.venv-db/Scripts/python tests/db/renewal-history.test.py
.venv-db/Scripts/python tests/db/public-room.test.py
```

Nạp lần lượt schema và mọi migration theo thứ tự, rồi thử đăng nhập khách bằng các vai `anon` / `authenticated` như PostgREST: 44 ca (mã sai, khóa 15 phút, cấp lại mã, phiên hết hạn, thu hồi, hai chủ trọ trùng số điện thoại, anon không đọc được bảng mã, các hàm nghiệp vụ dùng token). Đã thử phá 11 chỗ của migration (bỏ khóa, bỏ kiểm mã, bỏ đăng xuất phiên, lộ hóa đơn chủ khác...) và bộ thử bắt được cả 11. Hạn chế: `pgcrypto` thật (bcrypt, sha256) không có trong bản Postgres nhúng nên được giả bằng md5; độ mạnh mật mã do `pgcrypto` của Supabase bảo đảm, phần thử ở đây là logic (khớp mã, token, khóa).

## Lưu dữ liệu & thao tác thật

- **Dữ liệu được lưu bền trong trình duyệt** (`localStorage`). Mọi thao tác đều **giữ lại sau khi tải lại trang**: thêm/sửa/xóa dịch vụ, tạo phòng hàng loạt, thêm khách thuê, ký & thanh lý hợp đồng, ghi chỉ số, sinh/phát hành/hủy hóa đơn, ghi nhận thanh toán, thêm tài sản, thêm tòa nhà, kết nối/ngắt khóa TTLock…
- **Xuất Excel thật**: các nút *Xuất excel* (phòng, khách thuê, dịch vụ, tài sản, hóa đơn) tải xuống **file CSV** mở được bằng Excel (có dấu tiếng Việt).
- **Khôi phục dữ liệu mẫu**: ô **Tài khoản → Khôi phục dữ liệu mẫu** để xóa hết thay đổi và về dữ liệu ban đầu.

## Còn là mô phỏng (chưa nối máy chủ thật)

- **SMS OTP cho app khách thuê**: chưa có. Đăng nhập dùng mã vào app do chủ trọ cấp (xem mục *Đăng nhập app khách thuê*).
- Dữ liệu chỉ nằm **trên trình duyệt này**; chưa đồng bộ nhiều thiết bị / nhiều người dùng (cần backend + database).
- **Khóa thông minh** là màn hình mô phỏng, chưa nối khóa thật. Ba trang **Báo cáo, Sổ kế toán, Nhân sự & phân quyền** vẫn là trang giữ chỗ.

## Bước tiếp theo để thành "bản chính" thật
Muốn nhiều người dùng chung + đồng bộ nhiều máy thì cần **máy chủ + cơ sở dữ liệu**: thay `js/store.js` bằng lớp gọi API thật (đăng nhập/JWT, REST/GraphQL), thêm OCR thật và cổng thanh toán. Giao diện & luồng nghiệp vụ hiện tại dùng lại được gần như nguyên vẹn.

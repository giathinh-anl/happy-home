/* ============================================================
   Happy Home — Trung tâm trợ giúp (bài hướng dẫn, tìm kiếm) và hướng dẫn làm quen từng bước (tour)

   Thuần, không đụng DOM (tests/help.test.js). Giao diện nằm ở js/pages/help.js.

   Tên nút, tên mục trong các bài là tên THẬT trong giao diện. Bài kiểm thử đối chiếu: mọi đường dẫn phải là một route có thật
   trong js/router.js, mọi quyền phải có trong danh sách quyền của js/store.js, nên đổi tên route hay quyền mà quên sửa bài thì báo hỏng.
   ============================================================ */
(function (root) {
  const NHOM = [
    { ma: 'bat-dau', ten: 'Bắt đầu' },
    { ma: 'thu-tien', ten: 'Thu tiền' },
    { ma: 'khach', ten: 'Khách thuê' },
    { ma: 'tai-khoan', ten: 'Tài khoản và bảo mật' },
  ];

  /* lienKet.duong: route trong js/router.js, ':bid' được thay bằng tòa nhà đang xem. quyen: quyền cần có để dùng được tính năng
     (không có quyền thì bài ẩn khỏi danh sách). chuTro: chỉ chủ trọ làm được. */
  const BAI = [
    { id: 'bat-dau', nhom: 'bat-dau', tieuDe: 'Từ tài khoản trống đến hóa đơn đầu tiên',
      tuKhoa: 'moi bat dau lam quen huong dan nhap mon dau tien',
      buoc: ['Thêm tòa nhà: vào Quản lý nhà, bấm Thêm tòa nhà, nhập tên và địa chỉ.',
        'Tạo phòng hàng loạt: nhập số tầng, số phòng mỗi tầng và giá thuê, app tạo cả dãy phòng.',
        'Thêm khách thuê và lập hợp đồng, hoặc bấm Mời khách khai để khách tự nhập thông tin.',
        'Mỗi tháng: ghi chỉ số điện, chốt sổ rồi phát hành hóa đơn.',
        'Nhập tài khoản nhận tiền của tòa (Cấu hình tòa nhà) để khách thấy mã VietQR.'],
      lienKet: { nhan: 'Mở Quản lý nhà', duong: '/buildings' } },
    { id: 'tao-phong', nhom: 'bat-dau', tieuDe: 'Tạo phòng hàng loạt', quyen: 'rooms',
      tuKhoa: 'phong tang tao nhieu hang loat gia thue day phong',
      buoc: ['Vào mục Phòng của tòa nhà.', 'Bấm Tạo phòng hàng loạt.',
        'Nhập số tầng, số phòng mỗi tầng và giá thuê. App cho xem trước danh sách mã phòng và báo nếu có mã trùng.',
        'Xác nhận để tạo. Mỗi phòng sau đó vẫn mở ra sửa được.'],
      lienKet: { nhan: 'Mở Phòng', duong: '/b/:bid/units' } },
    { id: 'them-khach', nhom: 'bat-dau', tieuDe: 'Thêm khách thuê (nhập tay hoặc đọc từ ảnh CCCD)', quyen: 'tenants',
      tuKhoa: 'khach thue cccd can cuoc quet anh ocr ho so them moi',
      buoc: ['Vào Khách thuê, bấm Thêm khách thuê.',
        'Chụp hoặc chọn ảnh CCCD (mặt trước và mặt sau): app đọc chữ và điền sẵn các ô. Ô nào chữ mờ thì gắn cờ để bạn kiểm; đọc không được thì để trống chứ không điền bừa. Cần trợ lý AI đã bật.',
        'Đối chiếu từng ô với ảnh, điền đủ các ô bắt buộc rồi lưu.'],
      lienKet: { nhan: 'Mở Khách thuê', duong: '/b/:bid/tenants' } },
    { id: 'khach-tu-khai', nhom: 'bat-dau', tieuDe: 'Để khách tự khai thông tin qua link hoặc mã QR', quyen: 'tenants', chuTro: true,
      tuKhoa: 'khach tu khai moi link ma qr duyet ho so',
      buoc: ['Vào Khách thuê, bấm Mời khách khai.',
        'Gửi link hoặc cho khách quét mã QR. Khách tự nhập họ tên, số CCCD, ngày sinh, quê quán và chụp CCCD.',
        'Khi khách khai xong, trang Khách thuê và mục "Hôm nay cần làm gì" báo có hồ sơ chờ duyệt.',
        'Bấm Xem và duyệt, đối chiếu từng ô với ảnh CCCD (bấm vào ảnh để phóng to) rồi duyệt. Thông tin do khách gõ nên có thể sai chính tả.'],
      lienKet: { nhan: 'Mở Khách thuê', duong: '/b/:bid/tenants' } },
    { id: 'lap-hop-dong', nhom: 'bat-dau', tieuDe: 'Lập hợp đồng', quyen: 'contracts',
      tuKhoa: 'hop dong thue lap moi gia han thanh ly quet giay',
      buoc: ['Vào Hợp đồng, bấm Lập hợp đồng.',
        'Làm lần lượt 5 bước: Phòng, Khách, Điều khoản, Dịch vụ, Bàn giao, rồi xác nhận.',
        'Đã có hợp đồng giấy thì dùng Quét hợp đồng giấy để tạo từ bản quét.',
        'Hợp đồng sắp hết hạn hoặc đã quá hạn được nhắc ở "Hôm nay cần làm gì".'],
      lienKet: { nhan: 'Mở Hợp đồng', duong: '/b/:bid/contracts' } },

    { id: 'ghi-chi-so', nhom: 'thu-tien', tieuDe: 'Ghi chỉ số điện nước', quyen: 'readings',
      tuKhoa: 'chi so dien nuoc ghi so cong to tieu thu bat thuong ngoai tuyen mat mang',
      buoc: ['Mở Thêm, chọn Chỉ số điện (trên điện thoại: Menu, rồi Chỉ số điện).',
        'Nhập chỉ số mới của từng phòng, dùng Tab hoặc Enter để xuống dòng. App tính ngay số tiêu thụ và cảnh báo số bất thường.',
        'Khách cũng tự gửi chỉ số từ app khách; chỉ số khách gửi chờ bạn duyệt.',
        'Nơi mất sóng vẫn ghi được; chỉ số ghi lúc ngoại tuyến tự gửi lên khi có mạng.'],
      lienKet: { nhan: 'Mở Chỉ số điện', duong: '/b/:bid/readings' } },
    { id: 'chot-so-phat-hanh', nhom: 'thu-tien', tieuDe: 'Chốt sổ và phát hành hóa đơn hàng tháng', quyen: 'invoices',
      tuKhoa: 'hoa don chot so phat hanh thang ky tao sinh',
      buoc: ['Vào Hóa đơn, bấm Chốt sổ tháng.',
        'Xem trước các hóa đơn: phòng nào chưa đủ điều kiện (ví dụ thiếu chỉ số) thì được báo để xử lý; các phòng còn lại vẫn chốt được ngay.',
        'Bấm Phát hành tất cả. Mỗi hóa đơn có nội dung chuyển khoản riêng (dạng HD2611001) để khách chuyển và app tự nhận ra.'],
      lienKet: { nhan: 'Mở Hóa đơn', duong: '/b/:bid/invoices' } },
    { id: 'ghi-thanh-toan', nhom: 'thu-tien', tieuDe: 'Ghi nhận khoản khách đã trả', quyen: 'payments',
      tuKhoa: 'thanh toan thu tien phieu thu cong no tra truoc phan bo',
      buoc: ['Mở hóa đơn của phòng, bấm Ghi nhận thanh toán, nhập số tiền và hình thức.',
        'Nếu khách trả gộp hoặc trả dư, app tự phân bổ vào kỳ cũ nhất trước.',
        'Mỗi lần ghi sinh một phiếu thu có số và được ghi vào nhật ký hệ thống.'],
      lienKet: { nhan: 'Mở Thanh toán và công nợ', duong: '/b/:bid/payments' } },
    { id: 'tai-khoan-nhan-tien', nhom: 'thu-tien', tieuDe: 'Nhập tài khoản nhận tiền của tòa', quyen: 'settings', chuTro: true,
      tuKhoa: 'ngan hang so tai khoan vietqr qr nhan tien chu tai khoan mb',
      buoc: ['Vào Cấu hình tòa nhà (Thêm, rồi Cấu hình tòa nhà), khung Tài khoản nhận tiền.',
        'Chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản. Bấm Xem thử mã QR rồi quét bằng app ngân hàng của bạn: màn hình phải hiện đúng tên chủ tài khoản (đừng bấm chuyển tiền).',
        'Bấm Lưu tài khoản. Khách thấy tài khoản này trong app khách, ở mã VietQR và trong tin nhắc nợ. Mỗi tòa có thể một tài khoản riêng.',
        'Nếu trang báo "Máy chủ chưa chạy migration-bank-info.sql", nhờ người quản trị hệ thống chạy tệp đó một lần.'],
      lienKet: { nhan: 'Mở Cấu hình tòa nhà', duong: '/b/:bid/config' } },
    { id: 'nhan-tien-tu-dong', nhom: 'thu-tien', tieuDe: 'Nhận tiền tự động (SePay)', quyen: 'payments',
      tuKhoa: 'sepay casso doi soat ngan hang tu dong webhook tien ve khop hoa don',
      buoc: ['Đăng ký tài khoản SePay (my.sepay.vn) và liên kết ngân hàng của bạn.',
        'Trong app: Khách chuyển khoản, Đối soát ngân hàng, Nối ngân hàng, bấm Tạo secret rồi Chép. Mã đã có sẵn thì nút chỉ hiện lại mã, không tạo mã mới.',
        'Trong SePay: Webhooks, Thêm webhook. Dán đường link hiện trong hộp Nối ngân hàng, chọn chỉ Tiền vào, kiểu xác thực API Key và dán mã vừa chép.',
        'Bấm Gửi thử. Tiền khách chuyển về sẽ hiện ở Đối soát ngân hàng và tự khớp hóa đơn theo nội dung chuyển khoản.',
        'Phần cài đặt trên máy chủ do người quản trị hệ thống làm một lần.'],
      lienKet: { nhan: 'Mở Khách chuyển khoản', duong: '/transfers' } },
    { id: 'nhac-no', nhom: 'thu-tien', tieuDe: 'Nhắc nợ khách', quyen: 'payments',
      tuKhoa: 'nhac no qua han tin nhan zalo sms phi tre han soan',
      buoc: ['Mở Thêm, chọn Nhắc nợ.',
        'Chọn phòng, bấm Soạn tin: app soạn sẵn tin theo mức quá hạn, kèm số tài khoản và nội dung chuyển khoản.',
        'App chỉ soạn, không tự gửi: bạn chép tin gửi qua Zalo hoặc SMS rồi bấm Đã nhắc trực tiếp để biết phòng nào đã nhắc.'],
      lienKet: { nhan: 'Mở Nhắc nợ', duong: '/b/:bid/reminders' } },

    { id: 'ma-vao-app', nhom: 'khach', tieuDe: 'Cấp mã vào app cho khách thuê', quyen: 'tenants', chuTro: true,
      tuKhoa: 'ma vao app khach thue dang nhap 6 so quen ma thu hoi',
      buoc: ['Vào Khách thuê, bấm Mã vào app để cấp cho cả tòa, hoặc mở dấu ba chấm của một khách và chọn Mã vào app khách.',
        'Gửi mã 6 số cho khách. Khách vào app khách thuê bằng số điện thoại đã khai cùng mã này.',
        'Khách tự đổi mã được; bấm Quên mã thì chủ trọ nhận việc cấp lại mã.',
        'Khách trả phòng hoặc mất điện thoại: bấm Thu hồi quyền vào app trong cùng hộp thoại.'],
      lienKet: { nhan: 'Mở Khách thuê', duong: '/b/:bid/tenants' } },
    { id: 'hoi-dap', nhom: 'khach', tieuDe: 'Trả lời câu hỏi của khách', quyen: 'tenants',
      tuKhoa: 'hoi dap tin nhan chat khach nhan tra loi',
      buoc: ['Khách nhắn từ app khách khi trợ lý ảo không trả lời được.',
        'Mở Thêm, chọn Hỏi đáp khách thuê để đọc và trả lời.',
        'Câu chưa trả lời hiện trong "Hôm nay cần làm gì" và có số đếm ở menu.'],
      lienKet: { nhan: 'Mở Hỏi đáp khách thuê', duong: '/b/:bid/support' } },
    { id: 'su-co', nhom: 'khach', tieuDe: 'Xử lý sự cố khách báo', quyen: 'incidents',
      tuKhoa: 'su co hong sua chua tho hen tien do cham sao danh gia',
      buoc: ['Khách báo hỏng trong app khách (kèm ảnh). Mở Thêm, chọn Sự cố phòng để xem.',
        'Cập nhật tiến độ (đã nhận, hẹn thợ, hoàn tất): khách xem được tiến độ ngay trong app.',
        'Sửa xong, khách có thể chấm sao và để lại nhận xét; chủ trọ thấy sao trong danh sách sự cố.'],
      lienKet: { nhan: 'Mở Sự cố phòng', duong: '/b/:bid/incidents' } },
    { id: 'app-khach', nhom: 'khach', tieuDe: 'Khách cài app lên điện thoại và bật thông báo',
      tuKhoa: 'app khach cai dat man hinh chinh thong bao iphone android pwa',
      buoc: ['Khách mở đường link app khách thuê trên điện thoại và đăng nhập bằng số điện thoại cùng mã vào app.',
        'Android: bấm menu trình duyệt rồi Cài đặt ứng dụng (hoặc Thêm vào màn hình chính). iPhone: bấm Chia sẻ rồi Thêm vào MH chính.',
        'Sau khi cài, khách vào mục Thông báo trong app để bật thông báo. iPhone chỉ nhận thông báo sau khi đã thêm app vào màn hình chính.']},

    { id: 'nhan-vien', nhom: 'tai-khoan', tieuDe: 'Thêm nhân viên và phân quyền', chuTro: true,
      tuKhoa: 'nhan vien phan quyen them email quyen quan ly nhom cong ty',
      buoc: ['Vào Công ty/nhóm, thêm nhân viên bằng email và chọn các quyền.',
        'Nhân viên mở trang đăng nhập, bấm "Chưa có tài khoản? Đăng ký", dùng đúng email đó và tự đặt mật khẩu. Hệ thống tự cấp đúng quyền.',
        'Nhân viên không đổi được tài khoản nhận tiền và không xóa được toàn bộ dữ liệu.'],
      lienKet: { nhan: 'Mở Công ty/nhóm', duong: '/group' } },
    { id: 'doi-mat-khau', nhom: 'tai-khoan', tieuDe: 'Đổi mật khẩu và ảnh đại diện',
      tuKhoa: 'mat khau doi anh dai dien avatar ho so ten hien thi cai dat',
      buoc: ['Vào Cài đặt chung (thanh trên cùng).',
        'Đổi mật khẩu: nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự, có cả chữ và số, không dùng mật khẩu dễ đoán).',
        'Đổi ảnh: chọn ảnh JPG, PNG hoặc WebP, app tự cắt vuông. Ảnh lưu trên thiết bị này.'],
      lienKet: { nhan: 'Mở Cài đặt chung', duong: '/config' } },
    { id: 'xoa-du-lieu-mau', nhom: 'tai-khoan', tieuDe: 'Xóa dữ liệu mẫu để bắt đầu dùng thật', chuTro: true,
      tuKhoa: 'xoa du lieu mau thu nghiem bat dau that reset xoa het',
      buoc: ['Vào Cài đặt chung, bấm Xóa toàn bộ dữ liệu.',
        'Gõ đúng chữ xác nhận. Việc này xóa hết tòa nhà, phòng, khách, hóa đơn của tài khoản trên máy chủ và KHÔNG hoàn tác được; tài khoản đăng nhập vẫn còn và trở về trống như mới.'],
      lienKet: { nhan: 'Mở Cài đặt chung', duong: '/config' } },
  ];

  /* ---------- Tìm kiếm ---------- */
  const gon = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  /** Bài người dùng đang dùng được: ẩn bài thiếu quyền, và bài chỉ dành cho chủ trọ khi người dùng không phải chủ.
      ai = { can(perm) -> bool, isOwner -> bool } (mặc định: thấy hết). */
  function hienDuoc(bai, ai) {
    const a = ai || {};
    if (bai.chuTro && a.isOwner === false) return false;
    if (bai.quyen && typeof a.can === 'function' && !a.can(bai.quyen)) return false;
    return true;
  }

  /** Tìm bài theo từ khóa: bỏ dấu, không phân biệt hoa thường, mọi từ trong câu hỏi đều phải xuất hiện (tiêu đề, từ khóa hoặc nội dung).
      Điểm: tiêu đề 4, từ khóa 2, nội dung 1 cho mỗi từ. Rỗng thì trả hết (đúng thứ tự soạn). */
  function tim(q, ai) {
    const ds = BAI.filter((b) => hienDuoc(b, ai));
    const tu = gon(q).split(' ').filter(Boolean);
    if (!tu.length) return ds.slice();
    const kq = [];
    ds.forEach((b, i) => {
      const t = gon(b.tieuDe), k = gon(b.tuKhoa), n = gon(b.buoc.join(' '));
      let diem = 0, du = true;
      tu.forEach((w) => {
        const d = (t.indexOf(w) >= 0 ? 4 : 0) + (k.indexOf(w) >= 0 ? 2 : 0) + (n.indexOf(w) >= 0 ? 1 : 0);
        if (!d) du = false; diem += d;
      });
      if (du) kq.push({ b, diem, i });
    });
    return kq.sort((x, y) => y.diem - x.diem || x.i - y.i).map((x) => x.b);
  }

  /** Đổi ':bid' trong đường dẫn thành tòa nhà đang xem; không có tòa nhà thì trả null (bài không dẫn tới được trang đó). */
  function duongDan(lienKet, bid) {
    if (!lienKet || !lienKet.duong) return null;
    if (lienKet.duong.indexOf(':bid') >= 0) return bid ? '#' + lienKet.duong.replace(':bid', encodeURIComponent(bid)) : null;
    return '#' + lienKet.duong;
  }

  /* ---------- Hướng dẫn làm quen từng bước ---------- */
  /* mucTieu: danh sách bộ chọn CSS, lấy phần tử ĐẦU TIÊN đang hiện (cùng một bước có thể ứng với nút khác nhau trên máy tính và điện thoại).
     Không có phần tử nào đang hiện thì thẻ hướng dẫn nằm giữa màn hình, không làm sáng chỗ nào. quyen: bước ẩn nếu không có quyền. */
  const BUOC_TOUR = [
    { id: 'chao', tieuDe: 'Chào mừng đến Happy Home', noiDung: 'Mình đi nhanh qua các khu chính trong khoảng một phút. Bấm Tiếp để xem, hoặc Bỏ qua bất cứ lúc nào; muốn xem lại thì vào Trợ giúp.', mucTieu: [] },
    { id: 'toa-nha', tieuDe: 'Tòa nhà đang quản lý', noiDung: 'Đây là tòa nhà bạn đang làm việc. Bấm vào để đổi sang tòa khác hoặc thêm tòa mới.', mucTieu: ['#bCard', '#bCardM'] },
    { id: 'phong', tieuDe: 'Phòng', quyen: 'rooms', noiDung: 'Sơ đồ phòng theo tầng, trạng thái từng phòng (trống, đang thuê, sắp trả) và tạo phòng hàng loạt.', mucTieu: ['a.mb-item[href$="/units"]', 'a[href$="/units"]'] },
    { id: 'khach', tieuDe: 'Khách thuê', quyen: 'tenants', noiDung: 'Hồ sơ khách, đọc nhanh từ ảnh CCCD, mời khách tự khai, cấp mã vào app cho khách.', mucTieu: ['a.mb-item[href$="/tenants"]', 'a[href$="/tenants"]'] },
    { id: 'hoa-don', tieuDe: 'Hóa đơn', quyen: 'invoices', noiDung: 'Mỗi tháng chốt sổ rồi phát hành hóa đơn cho cả tòa. Ghi nhận khoản khách đã trả cũng ở đây.', mucTieu: ['a.mb-item[href$="/invoices"]', 'a[href$="/invoices"]'] },
    { id: 'them', tieuDe: 'Các mục khác', noiDung: 'Chỉ số điện, nhắc nợ, hỏi đáp khách, sự cố, thu chi và cấu hình tòa nhà nằm trong mục này.', mucTieu: ['#moreBtn', '#mMenu'] },
    { id: 'tong-bao-cao', tieuDe: 'Tổng báo cáo và việc hôm nay', quyen: 'reports', noiDung: 'Doanh thu, công nợ và danh sách "Hôm nay cần làm gì": việc nào gấp thì ở trên.', mucTieu: ['a[href="#/dashboard"]'] },
    { id: 'chuyen-khoan', tieuDe: 'Khách chuyển khoản', quyen: 'payments', noiDung: 'Duyệt phiếu khách báo đã chuyển, và đối soát tiền về từ ngân hàng.', mucTieu: ['a[href="#/transfers"]'] },
    { id: 'chuong', tieuDe: 'Thông báo', noiDung: 'Chuông báo hợp đồng sắp hết hạn, khách xin gia hạn, sự cố mới. Số trên chuông là số việc đang chờ.', mucTieu: ['a[href="#/noti"]'] },
    { id: 'tai-khoan', tieuDe: 'Tài khoản của bạn', noiDung: 'Menu này có tên và vai trò của bạn, đăng xuất, và (với chủ trọ) quản lý nhân viên. Ảnh đại diện, đổi mật khẩu nằm ở Cài đặt chung.', mucTieu: ['[data-act="account"]'] },
    { id: 'xong', tieuDe: 'Xong rồi', noiDung: 'Cần xem lại hay tra cách làm một việc: mở Trợ giúp từ menu Tài khoản. Nút Trợ lý ở góc dưới trả lời nhanh các câu hỏi về số liệu của bạn.', mucTieu: [] },
  ];

  /** Danh sách bước cho một người dùng: bỏ bước thiếu quyền. ai = { can(perm) }. Luôn còn ít nhất bước đầu và bước cuối. */
  function lapTour(ai) {
    const a = ai || {};
    return BUOC_TOUR.filter((s) => !s.quyen || typeof a.can !== 'function' || a.can(s.quyen));
  }
  /** Bước kế tiếp / trước, kẹp trong [0, tong-1]. Trả { i, xong } — xong = true khi bấm Tiếp ở bước cuối. */
  function dich(i, huong, tong) {
    const n = Math.max(0, (tong | 0) - 1), cur = Math.min(Math.max(i | 0, 0), n);
    if (huong > 0) return cur >= n ? { i: n, xong: true } : { i: cur + 1, xong: false };
    return { i: Math.max(cur - 1, 0), xong: false };
  }
  /** Đặt thẻ hướng dẫn gần phần tử được chỉ: ưu tiên bên dưới, không đủ chỗ thì bên trên, không đủ cả hai thì giữa màn hình;
      luôn nằm trọn trong khung nhìn (cách mép lề px). rect = { x, y, w, h } của phần tử hoặc null; the = { w, h }; kn = { w, h }. */
  function datThe(rect, the, kn, le, khoang) {
    const L = le == null ? 12 : le, G = khoang == null ? 12 : khoang;
    const rongThe = Math.min(the.w, Math.max(kn.w - 2 * L, 120));
    const kep = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    if (!rect) return { x: Math.round((kn.w - rongThe) / 2), y: Math.max(L, Math.round((kn.h - the.h) / 2)), w: rongThe, cho: 'giua' };
    const x = kep(Math.round(rect.x + rect.w / 2 - rongThe / 2), L, Math.max(L, kn.w - rongThe - L));
    const duoi = rect.y + rect.h + G, tren = rect.y - G - the.h;
    if (duoi + the.h + L <= kn.h) return { x, y: duoi, w: rongThe, cho: 'duoi' };
    if (tren >= L) return { x, y: tren, w: rongThe, cho: 'tren' };
    return { x, y: Math.max(L, Math.round((kn.h - the.h) / 2)), w: rongThe, cho: 'giua' };
  }

  const api = { NHOM, BAI, BUOC_TOUR, gon, hienDuoc, tim, duongDan, lapTour, dich, datThe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.help = api; }
})(typeof window !== 'undefined' ? window : globalThis);

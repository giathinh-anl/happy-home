/* ============================================================
   Happy Home — Sao lưu và khôi phục dữ liệu (không đụng DOM, có kiểm thử: tests/backup.test.js)

   Vì sao có tệp này: dữ liệu chỉ nằm trên máy chủ (hoặc trình duyệt ở chế độ demo). Lỡ tay xóa một tòa, một hợp đồng,
   hay muốn giữ một bản riêng phòng khi mất tài khoản, trước đây không có cách nào lấy ra. Nay chủ trọ tải được một tệp JSON
   chứa toàn bộ dữ liệu, và khôi phục lại từ tệp đó.

   Khôi phục theo cách AN TOÀN: chỉ THÊM những mục có trong tệp mà hiện không còn (so theo mã), KHÔNG ghi đè mục đang có,
   KHÔNG xóa gì. Nhờ vậy khôi phục một bản cũ không làm mất những gì đã sửa sau ngày sao lưu.

   Không khôi phục từ tệp (chỉ có trong bản tải về để tra cứu):
   - Nhân viên: thêm lại một nhân viên đã bị xóa là CẤP LẠI QUYỀN cho người đó, việc này phải làm tay ở Công ty / nhóm.
   - Nhật ký thao tác: là dấu vết của những việc đã làm; nạp từ tệp thì ai cũng sửa tệp rồi "viết lại lịch sử" được.
   - Giao dịch ngân hàng, báo đã chuyển khoản, xin gia hạn, tin nhắn hỗ trợ: do ngân hàng hoặc khách thuê gửi lên, không phải chủ trọ tạo.
   ============================================================ */
(function (root) {
  const DINH_DANG = 'happy-home-sao-luu';
  const PHIEN_BAN = 1;
  const GIOI_HAN_BYTE = 60 * 1024 * 1024;          // tệp lớn hơn thế này gần như chắc chắn không phải bản sao lưu của app

  // Thứ tự = thứ tự hiện ở bảng xem trước và thứ tự ghi (tòa trước phòng, phòng trước hợp đồng...)
  const LOAI = [
    { ma: 'buildings', ten: 'Tòa nhà', khoiPhuc: true },
    { ma: 'rooms', ten: 'Phòng', khoiPhuc: true },
    { ma: 'services', ten: 'Dịch vụ', khoiPhuc: true },
    { ma: 'tenants', ten: 'Khách thuê', khoiPhuc: true },
    { ma: 'contracts', ten: 'Hợp đồng', khoiPhuc: true },
    { ma: 'readings', ten: 'Chỉ số điện nước', khoiPhuc: true },
    { ma: 'invoiceBatches', ten: 'Đợt chốt sổ', khoiPhuc: true },
    { ma: 'invoices', ten: 'Hóa đơn', khoiPhuc: true },
    { ma: 'payments', ten: 'Phiếu thu', khoiPhuc: true },
    { ma: 'assets', ten: 'Tài sản', khoiPhuc: true },
    { ma: 'incidents', ten: 'Sự cố', khoiPhuc: true },
    { ma: 'transactions', ten: 'Thu chi', khoiPhuc: true },
    { ma: 'staff', ten: 'Nhân viên', khoiPhuc: false, vi: 'thêm lại nhân viên là cấp lại quyền, hãy làm tay ở Công ty / nhóm' },
    { ma: 'auditLog', ten: 'Nhật ký thao tác', khoiPhuc: false, vi: 'nhật ký không được viết lại từ tệp' },
    { ma: 'bankTx', ten: 'Giao dịch ngân hàng', khoiPhuc: false, vi: 'do ngân hàng gửi lên' },
    { ma: 'claims', ten: 'Khách báo đã chuyển khoản', khoiPhuc: false, vi: 'do khách thuê gửi lên' },
    { ma: 'renewals', ten: 'Khách xin gia hạn', khoiPhuc: false, vi: 'do khách thuê gửi lên' },
    { ma: 'supportMsgs', ten: 'Tin nhắn hỗ trợ', khoiPhuc: false, vi: 'do khách thuê gửi lên' },
  ];
  const THEO_MA = {}; LOAI.forEach((l) => { THEO_MA[l.ma] = l; });

  const TEN_TRUONG = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const CAM = new Set(['__proto__', 'constructor', 'prototype']);
  const laDoiTuong = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const maHopLe = (id) => (typeof id === 'string' && id.trim() !== '' && id.length <= 200) || (typeof id === 'number' && isFinite(id));

  /** Chép một mục, chỉ giữ những trường có tên đàng hoàng (tệp có thể bị sửa tay: "__proto__", tên cột lạ...). Giá trị giữ nguyên dạng JSON. */
  function sachMuc(x) {
    const o = {};
    Object.keys(x).forEach((k) => {
      if (CAM.has(k) || !TEN_TRUONG.test(k)) return;
      const v = x[k];
      if (v === undefined || typeof v === 'function') return;
      o[k] = v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v));
    });
    return o;
  }

  /** Dựng bản sao lưu từ dữ liệu đang có. duLieu = { buildings: [...], rooms: [...], ... }; meta = { taoLuc (chuỗi ISO), nguoiTao, cheDo }. */
  function taoBanSao(duLieu, meta) {
    const m = meta || {}, d = duLieu || {}, ra = {}, soLuong = {};
    LOAI.forEach((l) => {
      const arr = Array.isArray(d[l.ma]) ? d[l.ma].filter(laDoiTuong).map(sachMuc) : [];
      ra[l.ma] = arr; soLuong[l.ma] = arr.length;
    });
    return { dinhDang: DINH_DANG, phienBan: PHIEN_BAN, taoLuc: m.taoLuc || null, nguoiTao: m.nguoiTao || null, cheDo: m.cheDo || null, soLuong, duLieu: ra };
  }

  /** Tên tệp tải về: happy-home-sao-luu-2026-11-25-0930.json (ngày giờ máy người dùng). */
  function tenTep(ngay) {
    const d = ngay instanceof Date && !isNaN(ngay) ? ngay : new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${DINH_DANG}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
  }

  /** Đọc nội dung tệp người dùng chọn. Trả { ok:false, loi } hoặc { ok:true, banSao, hong: { loai: số mục bỏ vì hỏng }, la: [loại lạ bị bỏ qua] }. */
  function docBanSao(chuoi) {
    if (typeof chuoi !== 'string' || !chuoi.trim()) return { ok: false, loi: 'Tệp trống.' };
    if (chuoi.length > GIOI_HAN_BYTE) return { ok: false, loi: 'Tệp quá lớn, không phải bản sao lưu của Happy Home.' };
    let x;
    try { x = JSON.parse(chuoi.charCodeAt(0) === 0xFEFF ? chuoi.slice(1) : chuoi); }
    catch (e) { return { ok: false, loi: 'Không đọc được tệp. Hãy chọn đúng tệp .json đã tải từ nút "Tải bản sao lưu".' }; }
    if (!laDoiTuong(x) || x.dinhDang !== DINH_DANG) return { ok: false, loi: 'Tệp này không phải bản sao lưu của Happy Home.' };
    if (!(Number(x.phienBan) >= 1)) return { ok: false, loi: 'Bản sao lưu thiếu số phiên bản, có thể đã bị sửa.' };
    if (Number(x.phienBan) > PHIEN_BAN) return { ok: false, loi: 'Bản sao lưu được tạo từ phiên bản app mới hơn. Hãy tải lại trang (Ctrl + F5) rồi thử lại.' };
    if (!laDoiTuong(x.duLieu)) return { ok: false, loi: 'Bản sao lưu không có phần dữ liệu.' };
    const duLieu = {}, hong = {}, la = Object.keys(x.duLieu).filter((k) => !THEO_MA[k]);
    LOAI.forEach((l) => {
      const v = x.duLieu[l.ma];
      if (v == null) { duLieu[l.ma] = []; return; }
      if (!Array.isArray(v)) { duLieu[l.ma] = []; hong[l.ma] = 1; return; }
      const tot = [], daThay = new Set(); let n = 0;
      v.forEach((it) => {
        if (!laDoiTuong(it) || !maHopLe(it.id) || daThay.has(String(it.id))) { n++; return; }   // không có mã, hoặc trùng mã trong cùng tệp
        daThay.add(String(it.id)); tot.push(sachMuc(it));
      });
      duLieu[l.ma] = tot; if (n) hong[l.ma] = n;
    });
    const banSao = { dinhDang: DINH_DANG, phienBan: Number(x.phienBan), taoLuc: typeof x.taoLuc === 'string' ? x.taoLuc : null,
      nguoiTao: typeof x.nguoiTao === 'string' ? x.nguoiTao.slice(0, 80) : null, duLieu };
    return { ok: true, banSao, hong, la };
  }

  /** So bản sao lưu với dữ liệu đang có, theo mã của từng mục.
      Trả { dong: [{ ma, ten, khoiPhuc, vi, trongTep, daCo, thieu }], tongThieu } — thieu = số mục có trong tệp mà hiện không còn (chỉ tính loại được khôi phục). */
  function soSanh(hienCo, banSao) {
    const h = hienCo || {}, b = (banSao && banSao.duLieu) || {};
    let tongThieu = 0;
    const dong = LOAI.map((l) => {
      const co = new Set((Array.isArray(h[l.ma]) ? h[l.ma] : []).map((x) => String(x && x.id)));
      const tep = Array.isArray(b[l.ma]) ? b[l.ma] : [];
      const thieu = tep.filter((x) => !co.has(String(x.id))).length;
      if (l.khoiPhuc) tongThieu += thieu;
      return { ma: l.ma, ten: l.ten, khoiPhuc: l.khoiPhuc, vi: l.vi || '', trongTep: tep.length, daCo: tep.length - thieu, thieu: l.khoiPhuc ? thieu : 0 };
    });
    return { dong, tongThieu };
  }

  /** Những mục sẽ được THÊM khi khôi phục: { loai: [mục] }, chỉ loại được khôi phục, chỉ mục mà mã chưa có. Mục đang có không bao giờ nằm ở đây. */
  function mucCanThem(hienCo, banSao) {
    const h = hienCo || {}, b = (banSao && banSao.duLieu) || {}, ra = {};
    LOAI.filter((l) => l.khoiPhuc).forEach((l) => {
      const co = new Set((Array.isArray(h[l.ma]) ? h[l.ma] : []).map((x) => String(x && x.id)));
      const them = (Array.isArray(b[l.ma]) ? b[l.ma] : []).filter((x) => laDoiTuong(x) && maHopLe(x.id) && !co.has(String(x.id))).map(sachMuc);
      if (them.length) ra[l.ma] = them;
    });
    return ra;
  }

  const api = { DINH_DANG, PHIEN_BAN, LOAI, taoBanSao, tenTep, docBanSao, soSanh, mucCanThem, sachMuc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.backup = api; }
})(typeof window !== 'undefined' ? window : globalThis);

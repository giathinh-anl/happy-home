/* ============================================================
   Happy Home — Hồ sơ và cài đặt cá nhân: luật đổi mật khẩu, nhóm việc hiện ở "Hôm nay cần làm gì", ảnh đại diện

   Thuần, không đụng DOM và không gọi store (tests/account.test.js). Giao diện nằm ở trang Cài đặt (js/pages/more.js).
   ============================================================ */
(function (root) {
  /* ---------- Mật khẩu ---------- */
  // Mật khẩu hay bị đoán trước. So sánh sau khi bỏ khoảng trắng, đổi chữ thường. "demo1234" nằm trong mã nguồn công khai nên luôn bị từ chối.
  const MAT_KHAU_YEU = ['12345678', '123456789', '1234567890', '11111111', '00000000', 'password', 'password1', 'matkhau', 'matkhau123', 'demo1234',
    'admin123', 'admin1234', 'qwerty123', 'qwertyuiop', 'iloveyou', 'happyhome', 'happyhome1', 'happyhome123', 'abc12345', 'abcd1234', 'a1234567', '1q2w3e4r'];
  const TOI_THIEU = 8, TOI_DA = 72;          // 72: giới hạn của bcrypt mà Supabase dùng, dài hơn bị cắt âm thầm

  const gon = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/\s+/g, '');
  const coChu = (s) => /[A-Za-zÀ-ỹ]/.test(s);
  const coSo = (s) => /[0-9]/.test(s);

  /** Điểm 0 đến 4 để vẽ thanh độ mạnh. Mật khẩu hay bị đoán thì luôn 0. */
  function doManh(mk) {
    const s = String(mk == null ? '' : mk);
    if (!s || MAT_KHAU_YEU.indexOf(gon(s)) >= 0) return { diem: 0, nhan: s ? 'Rất yếu' : '' };
    let d = 0;
    if (s.length >= TOI_THIEU) d++;
    if (s.length >= 12) d++;
    if (/[a-zà-ỹ]/.test(s) && /[A-ZÀ-Ỹ]/.test(s)) d++;
    if (coChu(s) && coSo(s)) d++;
    if (/[^A-Za-zÀ-ỹ0-9\s]/.test(s) && d < 4) d++;
    d = Math.min(d, 4);
    if (s.length < TOI_THIEU) d = Math.min(d, 1);
    return { diem: d, nhan: ['Rất yếu', 'Yếu', 'Tạm được', 'Khá', 'Mạnh'][d] };
  }

  /** { cu, moi, nhapLai, email } -> { ok, loi: { cu?, moi?, nhapLai? } }. Mỗi ô một câu báo lỗi tiếng Việt. */
  function kiemMatKhau(d) {
    const x = d || {}, loi = {};
    const cu = String(x.cu == null ? '' : x.cu), moi = String(x.moi == null ? '' : x.moi), lai = String(x.nhapLai == null ? '' : x.nhapLai);
    if (!cu) loi.cu = 'Nhập mật khẩu hiện tại';
    if (!moi) loi.moi = 'Nhập mật khẩu mới';
    else if (moi.length < TOI_THIEU) loi.moi = `Mật khẩu mới tối thiểu ${TOI_THIEU} ký tự`;
    else if (moi.length > TOI_DA) loi.moi = `Mật khẩu mới tối đa ${TOI_DA} ký tự`;
    else if (!coChu(moi) || !coSo(moi)) loi.moi = 'Mật khẩu mới cần có cả chữ và số';
    else if (moi === cu) loi.moi = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    else if (MAT_KHAU_YEU.indexOf(gon(moi)) >= 0) loi.moi = 'Mật khẩu này quá dễ đoán, chọn mật khẩu khác';
    else {
      const dau = gon(String(x.email || '').split('@')[0]);
      if (dau.length >= 4 && gon(moi).indexOf(dau) >= 0) loi.moi = 'Mật khẩu không nên chứa tên đăng nhập (phần trước @ của email)';
    }
    if (!lai) loi.nhapLai = 'Nhập lại mật khẩu mới';
    else if (!loi.moi && lai !== moi) loi.nhapLai = 'Hai lần nhập mật khẩu mới chưa giống nhau';
    return { ok: Object.keys(loi).length === 0, loi };
  }

  /* ---------- Việc hiện ở "Hôm nay cần làm gì" ---------- */
  // Mỗi việc trong todayItems có một mã loại; gom thành vài nhóm để người dùng tắt cả nhóm. Việc có mã lạ luôn được giữ lại (không để mất việc vì quên khai báo).
  const NHOM_VIEC = [
    { ma: 'tien',    ten: 'Tiền và công nợ',     mo: 'Nhắc nợ, phí trễ hạn, phiếu chuyển khoản chờ duyệt', loai: ['nhacno', 'saphan', 'phitre', 'chuyenkhoan'] },
    { ma: 'hopdong', ten: 'Hợp đồng',            mo: 'Hợp đồng sắp hết hạn hoặc đã quá hạn, khách xin gia hạn', loai: ['hdhet', 'hdgap', 'hdsap', 'xingiahan'] },
    { ma: 'suco',    ten: 'Sự cố phòng',         mo: 'Sự cố đang mở và lịch hẹn thợ', loai: ['suco', 'suco-hen'] },
    { ma: 'dien',    ten: 'Điện nước và hóa đơn', mo: 'Ghi chỉ số, chốt sổ, hóa đơn nháp chưa phát hành', loai: ['chiso', 'chotso', 'nhap'] },
    { ma: 'khach',   ten: 'Khách thuê',          mo: 'Khách tự khai thông tin, xin cấp lại mã, chưa có mã vào app', loai: ['khaitin', 'xinma', 'mavaoapp'] },
    { ma: 'hoidap',  ten: 'Hỏi đáp của khách',   mo: 'Câu khách nhắn mà chưa được trả lời', loai: ['hoidap'] },
  ];
  const nhomCua = (loai) => { const n = NHOM_VIEC.find((g) => g.loai.indexOf(loai) >= 0); return n ? n.ma : null; };
  /** Danh sách mã nhóm hợp lệ, không trùng. Đầu vào hỏng (null, chuỗi, mã lạ) thì bỏ. */
  function chuanHoaAn(arr) {
    const hop = NHOM_VIEC.map((g) => g.ma);
    return Array.isArray(arr) ? arr.filter((m, i) => hop.indexOf(m) >= 0 && arr.indexOf(m) === i) : [];
  }
  /** Bỏ các việc thuộc nhóm đã tắt. an = danh sách mã nhóm bị tắt. Không sửa mảng truyền vào. */
  function loc(items, an) {
    const tat = chuanHoaAn(an);
    if (!tat.length) return (items || []).slice();
    return (items || []).filter((it) => { const g = nhomCua(it && it.loai); return !g || tat.indexOf(g) < 0; });
  }

  /* ---------- Ảnh đại diện ---------- */
  const ANH_TOI_DA_BYTE = 8 * 1024 * 1024;     // ảnh chụp điện thoại có thể vài MB; nhỏ lại ngay trên máy trước khi lưu
  const AVATAR_CANH = 160;                      // cạnh ảnh lưu (px), cắt vuông giữa ảnh
  const AVATAR_TOI_DA_KY_TU = 45000;            // chuỗi data URL tối đa (khoảng 33 KB ảnh)
  const LOAI_ANH = ['image/jpeg', 'image/png', 'image/webp'];

  /** Chọn tệp ảnh: trả câu báo lỗi, rỗng nếu dùng được. file = { type, size } */
  function kiemTepAnh(file) {
    if (!file) return 'Chưa chọn ảnh';
    if (LOAI_ANH.indexOf(file.type) < 0) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP';
    if (!(file.size > 0)) return 'Tệp ảnh trống';
    if (file.size > ANH_TOI_DA_BYTE) return 'Ảnh quá lớn (tối đa 8 MB)';
    return '';
  }
  /** Chuỗi ảnh đã nhỏ lại có hợp lệ để lưu và đưa vào trang không (chặn mọi thứ không phải ảnh base64). */
  function avatarHopLe(s) {
    return typeof s === 'string' && s.length <= AVATAR_TOI_DA_KY_TU && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
  }
  /** Hình học cắt vuông giữa ảnh rồi thu về canh x canh: { sx, sy, sw, sh, dw, dh } cho drawImage. Ảnh nhỏ hơn canh thì giữ nguyên cỡ (không phóng to). */
  function cat(w, h, canh) {
    const c = canh || AVATAR_CANH;
    if (!(w > 0) || !(h > 0)) return null;
    const s = Math.min(w, h), d = Math.min(c, s);
    return { sx: Math.round((w - s) / 2), sy: Math.round((h - s) / 2), sw: s, sh: s, dw: d, dh: d };
  }

  const api = { MAT_KHAU_YEU, TOI_THIEU, TOI_DA, doManh, kiemMatKhau, NHOM_VIEC, nhomCua, chuanHoaAn, loc,
    kiemTepAnh, avatarHopLe, cat, AVATAR_CANH, AVATAR_TOI_DA_KY_TU, ANH_TOI_DA_BYTE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.account = api; }
})(typeof window !== 'undefined' ? window : globalThis);

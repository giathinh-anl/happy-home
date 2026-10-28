/* ============================================================
   Happy Home — Khách tự khai thông tin qua link / mã QR

   Không đụng DOM nên chạy kiểm thử được bằng node (tests/onboarding.test.js).
   Dùng chung cho trang khai của khách (join/) và màn duyệt của chủ trọ.

   Máy chủ (supabase/migration-onboarding.sql) kiểm tra lại mọi trường; luật ở đây để báo lỗi tức thì cho khách,
   nên PHẢI khớp luật bên SQL (có ca kiểm thử đối chiếu cả hai phía).
   ============================================================ */
(function (root) {
  const V = (typeof module !== 'undefined' && module.exports) ? require('./validate.js') : root.HH.validate;

  const TRUONG = ['fullName', 'phone', 'idNumber', 'dob', 'gender', 'hometown', 'address', 'cccdIssueDate', 'occupation', 'vehiclePlate'];
  const gon = (s) => String(s == null ? '' : s).trim();
  const COKYTU = /[<>]/;

  /**
   * Kiểm tra và chuẩn hóa hồ sơ khách khai. d = { fullName, phone, idNumber, dob (dd/mm/yyyy), gender, hometown, address,
   * cccdIssueDate?, occupation?, vehiclePlate?, consent }, homNay để thử. Trả { ok, loi: { trường: câu báo }, sach }.
   */
  function kiemHoSo(d, homNay) {
    const x = d || {}, loi = {};
    const ten = gon(x.fullName).replace(/\s+/g, ' ');
    const tenLoi = V.hoTen(ten) || (ten.length > 80 ? 'Họ tên quá dài' : '') || (COKYTU.test(ten) ? 'Họ tên có ký tự không hợp lệ' : '');
    if (tenLoi) loi.fullName = tenLoi;

    const sdt = V.chuanSdt(x.phone);
    if (V.sdt(sdt)) loi.phone = V.sdt(sdt);

    const cccd = String(x.idNumber == null ? '' : x.idNumber);       // V.cccd tự bỏ khoảng trắng và dấu chấm
    if (V.cccd(cccd)) loi.idNumber = V.cccd(cccd);

    // máy chủ chỉ nhận dd/mm/yyyy (V.ngayHopLe nhận cả yyyy-mm-dd)
    const dobLoi = !V.ngayDMY(x.dob) ? 'Nhập ngày sinh dạng dd/mm/yyyy, phải là ngày có thật'
      : V.ngayHopLe(x.dob, { ten: 'ngày sinh', namMin: 1900, khongTuongLai: true, homNay });
    if (dobLoi) loi.dob = dobLoi;

    const gt = /^nam$/i.test(gon(x.gender)) ? 'Nam' : /^(nữ|nu)$/i.test(gon(x.gender)) ? 'Nữ' : '';
    if (!gt) loi.gender = 'Chọn Nam hoặc Nữ';

    const que = gon(x.hometown), dia = gon(x.address);
    if (que.length < 2 || que.length > 200) loi.hometown = 'Nhập quê quán';
    else if (COKYTU.test(que)) loi.hometown = 'Quê quán có ký tự không hợp lệ';
    if (dia.length < 2 || dia.length > 200) loi.address = 'Nhập địa chỉ thường trú';
    else if (COKYTU.test(dia)) loi.address = 'Địa chỉ có ký tự không hợp lệ';

    const cap = gon(x.cccdIssueDate);
    if (cap) {
      const l = !V.ngayDMY(cap) || V.ngayHopLe(cap, { ten: 'ngày cấp', namMin: 1900, khongTuongLai: true, homNay });
      if (l) loi.cccdIssueDate = 'Nhập ngày cấp dạng dd/mm/yyyy, phải là ngày có thật và không ở tương lai';
    }

    const nghe = gon(x.occupation);
    if (nghe.length > 80) loi.occupation = 'Nghề nghiệp quá dài';
    else if (COKYTU.test(nghe)) loi.occupation = 'Nghề nghiệp có ký tự không hợp lệ';

    const bien = V.chuanBienSo(x.vehiclePlate);
    if (bien && V.bienSo(bien)) loi.vehiclePlate = V.bienSo(bien);

    if (x.consent !== true && x.consent !== 'true') loi.consent = 'Cần đồng ý cho chủ nhà dùng thông tin này';

    const sach = { fullName: ten, phone: sdt, idNumber: cccd.replace(/\D/g, ''), dob: gon(x.dob), gender: gt, hometown: que, address: dia };
    if (cap) sach.cccdIssueDate = cap;
    if (nghe) sach.occupation = nghe;
    if (bien) sach.vehiclePlate = bien;
    return { ok: Object.keys(loi).length === 0, loi, sach };
  }

  const TT = {
    'cho-khai': { nhan: 'Chờ khách khai', tone: 'info' },
    'het-han': { nhan: 'Hết hạn', tone: 'neutral' },
    'cho-duyet': { nhan: 'Chờ duyệt', tone: 'warning' },
    'da-duyet': { nhan: 'Đã duyệt', tone: 'success' },
    'tu-choi': { nhan: 'Đã từ chối', tone: 'danger' },
    'thu-hoi': { nhan: 'Đã thu hồi', tone: 'neutral' },
  };
  /** Trạng thái hiển thị của một lời mời. Chờ khai mà quá hạn thì là "hết hạn" (cột status trên máy chủ vẫn là pending). */
  function trangThai(inv, homNay) {
    const hn = (homNay ? new Date(homNay) : new Date()).getTime();
    let ma;
    switch (inv && inv.status) {
      case 'submitted': ma = 'cho-duyet'; break;
      case 'approved': ma = 'da-duyet'; break;
      case 'rejected': ma = 'tu-choi'; break;
      case 'revoked': ma = 'thu-hoi'; break;
      default: ma = (inv && inv.expiresAt && new Date(inv.expiresAt).getTime() <= hn) ? 'het-han' : 'cho-khai';
    }
    return Object.assign({ ma }, TT[ma]);
  }

  /** "còn 2 giờ 15 phút", "còn 3 ngày", "đã hết hạn" */
  function conLai(expiresAt, homNay) {
    const ms = new Date(expiresAt).getTime() - (homNay ? new Date(homNay) : new Date()).getTime();
    if (isNaN(ms)) return '';
    if (ms <= 0) return 'đã hết hạn';
    const phut = Math.ceil(ms / 60000);
    if (phut < 60) return `còn ${phut} phút`;
    const gio = Math.floor(phut / 60);
    if (gio < 48) return `còn ${gio} giờ${phut % 60 ? ' ' + (phut % 60) + ' phút' : ''}`;
    return `còn ${Math.floor(gio / 24)} ngày`;
  }

  const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
  /** Đọc token từ phần # của link: "#t=XXXX". Token nằm sau dấu # nên không bao giờ bị gửi lên máy chủ web hay lưu vào nhật ký truy cập. */
  function layToken(hash) {
    const m = /^#?t=([^&]+)/.exec(String(hash || ''));
    return m && TOKEN_RE.test(m[1]) ? m[1] : '';
  }
  /** Link khách mở. base là địa chỉ thư mục chứa index.html của web quản trị (có dấu / cuối). */
  function linkMoi(base, token) {
    return String(base || '').replace(/[^/]*$/, '') + 'join/#t=' + token;
  }

  const gioDMY = (iso) => {
    const d = new Date(iso); if (isNaN(d)) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} ngày ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  };
  /** Tin nhắn mẫu chủ trọ gửi kèm link. o = { ten, phong, tenToa, link, hetHan } */
  function tinNhan(o) {
    const x = o || {};
    return [`Chào ${x.ten ? x.ten : 'anh/chị'}, ${x.tenToa ? x.tenToa : 'chủ nhà'} nhờ anh/chị tự khai thông tin thuê${x.phong ? ' phòng ' + x.phong : ' phòng'} qua link này:`,
      x.link,
      `Anh/chị chuẩn bị CCCD để chụp 2 mặt, điền khoảng 3 phút trên điện thoại, không cần cài gì. Link chỉ dùng được một lần và hết hạn lúc ${gioDMY(x.hetHan)}.`].join('\n');
  }

  /** Dữ liệu khách khai -> dạng biểu mẫu thêm khách của chủ trọ ({ khóa: { value, confidence } }). Khách tự gõ nên tin cậy cao,
      nhưng chủ trọ vẫn phải đối chiếu với ảnh. */
  function choBieuMau(sd) {
    const s = sd || {}, f = (v) => ({ value: v == null ? '' : String(v), confidence: 1 });
    return { fullName: f(s.fullName), idNumber: f(s.idNumber), dateOfBirth: f(s.dob), gender: f(s.gender), hometown: f(s.hometown), address: f(s.address) };
  }

  /** Hồ sơ khai có trùng người đã có không (cùng CCCD hoặc cùng số điện thoại). tenants: mảng { id, idNumber, phone, fullName, roomCode } */
  function trungNguoi(sd, tenants) {
    const s = sd || {}, ds = tenants || [];
    const idn = String(s.idNumber || '').replace(/\D/g, ''), ph = V.chuanSdt(s.phone);
    return {
      theoCccd: (idn && ds.find((t) => String(t.idNumber || '').replace(/\D/g, '') === idn)) || null,
      theoSdt: (ph && ds.find((t) => V.chuanSdt(t.phone) === ph && String(t.idNumber || '').replace(/\D/g, '') !== idn)) || null,
    };
  }

  const api = { TRUONG, kiemHoSo, trangThai, conLai, layToken, linkMoi, tinNhan, choBieuMau, trungNguoi };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.onboarding = api; }
})(typeof window !== 'undefined' ? window : globalThis);

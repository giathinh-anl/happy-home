/* ============================================================
   Happy Home — Ảnh đính kèm trong chat khách <-> nhân viên: luật ảnh, bậc nén, tóm tắt tin

   Thuần, không đụng DOM (tests/chat-photos.test.js). Dùng chung cho web chủ trọ (js/pages/support.js) và app khách (tenant-app/js/tenant.js).
   Giới hạn PHẢI khớp supabase/migration-chat-photos.sql (hàm _chat_photos_hop_le và các ràng buộc của bảng ảnh); bài kiểm thử đối chiếu cả hai tệp.
   ============================================================ */
(function (root) {
  const MAX_ANH = 3;                   // ảnh mỗi tin
  const MAX_MOI_ANH = 300000;          // ký tự của một data URL (khoảng 220 KB ảnh)
  const MAX_TONG = 700000;             // tổng ký tự của các ảnh trong một tin
  const DANG_ANH = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;     // không SVG: SVG chạy được mã

  /* Bậc nén: thử từ ảnh to, đẹp tới ảnh nhỏ cho tới khi vừa MAX_MOI_ANH. Ảnh chụp điện thoại thường vừa ngay ở bậc đầu. */
  const BAC_NEN = [{ canh: 1000, chatLuong: 0.7 }, { canh: 800, chatLuong: 0.6 }, { canh: 640, chatLuong: 0.5 }, { canh: 480, chatLuong: 0.45 }];

  const hopLe = (s) => typeof s === 'string' && s.length <= MAX_MOI_ANH && DANG_ANH.test(s);

  /** Kiểm danh sách ảnh sắp gửi. Trả { ok, anh, loi }: anh là bản sạch (chỉ chuỗi hợp lệ), loi là câu báo tiếng Việt khi không ok. */
  function kiem(ds) {
    if (ds == null) return { ok: true, anh: [], loi: '' };
    if (!Array.isArray(ds)) return { ok: false, anh: [], loi: 'Danh sách ảnh không hợp lệ' };
    if (ds.length > MAX_ANH) return { ok: false, anh: [], loi: `Mỗi tin gửi tối đa ${MAX_ANH} ảnh` };
    let tong = 0;
    for (const s of ds) {
      if (typeof s !== 'string' || !DANG_ANH.test(s)) return { ok: false, anh: [], loi: 'Có ảnh không hợp lệ, hãy chọn lại ảnh JPG, PNG hoặc WebP' };
      if (s.length > MAX_MOI_ANH) return { ok: false, anh: [], loi: 'Có ảnh quá nặng, hãy chọn ảnh khác' };
      tong += s.length;
    }
    if (tong > MAX_TONG) return { ok: false, anh: [], loi: 'Các ảnh cùng nặng quá, hãy bớt một ảnh' };
    return { ok: true, anh: ds.slice(), loi: '' };
  }

  /** Thêm ảnh mới vào danh sách đang chọn, cắt ở MAX_ANH. Chuỗi không hợp lệ bị bỏ. Trả { anh, thua } (thua = số ảnh bị bỏ vì quá giới hạn). */
  function them(hienCo, moi) {
    const co = (Array.isArray(hienCo) ? hienCo : []).filter(hopLe).slice(0, MAX_ANH);
    const them = (Array.isArray(moi) ? moi : []).filter(hopLe);
    const cho = MAX_ANH - co.length;
    return { anh: co.concat(them.slice(0, cho)), thua: Math.max(0, them.length - cho) };
  }

  /** Bỏ ảnh ở vị trí i (ngoài khoảng thì giữ nguyên). Không sửa mảng truyền vào. */
  const bo = (ds, i) => { const a = Array.isArray(ds) ? ds.slice() : []; if (Number.isInteger(i) && i >= 0 && i < a.length) a.splice(i, 1); return a; };

  const nhanAnh = (n) => `${Math.max(0, n | 0)} ảnh`;

  /** Dòng xem trước của một tin trong danh sách cuộc trò chuyện: chữ, kèm "[2 ảnh]" nếu có ảnh; chỉ ảnh thì chỉ "[2 ảnh]". */
  function tomTat(m, toiDa) {
    const x = m || {}, n = Math.max(0, Number(x.photoCount) | 0), chu = String(x.body == null ? '' : x.body).trim();
    const s = chu + (n ? (chu ? ' ' : '') + '[' + nhanAnh(n) + ']' : '');
    const t = toiDa > 0 ? toiDa : 70;
    return s.length > t ? s.slice(0, t - 1) + '…' : s;
  }

  /** Tin có gì để hiện không (chữ hoặc ảnh)? Dùng để không vẽ bong bóng rỗng. */
  const coNoiDung = (m) => !!m && (String(m.body == null ? '' : m.body).trim() !== '' || (Number(m.photoCount) | 0) > 0);

  const api = { MAX_ANH, MAX_MOI_ANH, MAX_TONG, BAC_NEN, hopLe, kiem, them, bo, nhanAnh, tomTat, coNoiDung };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.chatPhotos = api; }
})(typeof window !== 'undefined' ? window : globalThis);

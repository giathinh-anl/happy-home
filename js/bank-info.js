/* ============================================================
   Happy Home — Tài khoản nhận tiền của từng tòa nhà

   Thuần, không đụng DOM và không gọi store (tests/bank-info.test.js).
   Chủ trọ nhập trong Cấu hình tòa nhà → lưu ở buildings.bank_info (supabase/migration-bank-info.sql), dạng
     { name: 'MB Bank', bin: '970422', account: '0123456789', holder: 'NGUYEN VAN A' }
   Khách thấy đúng tài khoản của tòa mình ở app khách (hàm tenant_bank); tin nhắc nợ cũng lấy từ đây.
   Chưa nhập thì dùng mục bank trong js/config.js như cũ (tương thích bản cũ), chưa có cả hai thì KHÔNG hiện số nào:
   khách chuyển vào số bịa là mất tiền thật.

   Mã ngân hàng (bin) theo chuẩn NAPAS, đối chiếu với danh sách công khai của VietQR (api.vietqr.io/v2/banks) ngày 7/11/2026.
   Sai bin là mã QR trỏ sang ngân hàng khác, nên danh sách chỉ lấy từ nguồn đó, không gõ tay.
   ============================================================ */
(function (root) {
  /* Ngân hàng phổ biến xếp trước, còn lại theo chữ cái. Ví điện tử (MoMo, ZaloPay...) không đưa vào: đây là tài khoản ngân hàng. */
  const NGAN_HANG = [
    { ten: 'MB Bank', bin: '970422' },
    { ten: 'Vietcombank', bin: '970436' },
    { ten: 'Techcombank', bin: '970407' },
    { ten: 'BIDV', bin: '970418' },
    { ten: 'VietinBank', bin: '970415' },
    { ten: 'Agribank', bin: '970405' },
    { ten: 'ACB', bin: '970416' },
    { ten: 'VPBank', bin: '970432' },
    { ten: 'TPBank', bin: '970423' },
    { ten: 'Sacombank', bin: '970403' },
    { ten: 'ABBANK', bin: '970425' },
    { ten: 'BacABank', bin: '970409' },
    { ten: 'BaoVietBank', bin: '970438' },
    { ten: 'CAKE', bin: '546034' },
    { ten: 'CBBank', bin: '970444' },
    { ten: 'CIMB', bin: '422589' },
    { ten: 'COOPBANK', bin: '970446' },
    { ten: 'Eximbank', bin: '970431' },
    { ten: 'HDBank', bin: '970437' },
    { ten: 'IndovinaBank', bin: '970434' },
    { ten: 'KBank', bin: '668888' },
    { ten: 'KienLongBank', bin: '970452' },
    { ten: 'KookminHCM', bin: '970463' },
    { ten: 'KookminHN', bin: '970462' },
    { ten: 'LPBank', bin: '970449' },
    { ten: 'MBV', bin: '970414' },
    { ten: 'MSB', bin: '970426' },
    { ten: 'NCB', bin: '970419' },
    { ten: 'NamABank', bin: '970428' },
    { ten: 'OCB', bin: '970448' },
    { ten: 'PGBank', bin: '970430' },
    { ten: 'PVcomBank', bin: '970412' },
    { ten: 'SCB', bin: '970429' },
    { ten: 'SHB', bin: '970443' },
    { ten: 'SaigonBank', bin: '970400' },
    { ten: 'SeABank', bin: '970440' },
    { ten: 'ShinhanBank', bin: '970424' },
    { ten: 'Timo', bin: '963388' },
    { ten: 'Ubank', bin: '546035' },
    { ten: 'VIB', bin: '970441' },
    { ten: 'VietABank', bin: '970427' },
    { ten: 'VietBank', bin: '970433' },
    { ten: 'VietCapitalBank', bin: '970454' },
    { ten: 'Woori', bin: '970457' },
  ];

  const theoBin = (bin) => NGAN_HANG.find((b) => b.bin === String(bin || '')) || null;
  const gon = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  /** Bản cũ chỉ khai tên ngân hàng (không có bin): tìm theo tên, bỏ dấu, khoảng trắng và chữ hoa/thường ("MB Bank" = "MBBank"). */
  const theoTen = (ten) => { const k = gon(ten); return k ? (NGAN_HANG.find((b) => gon(b.ten) === k) || null) : null; };

  /** Tên chủ tài khoản: ngân hàng ghi chữ in hoa không dấu, nên đổi sẵn cho khớp. */
  const chuanHoaTen = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  /** Số tài khoản: bỏ khoảng trắng và dấu gạch (người ta hay gõ "0123 456 789"). */
  const chuanHoaSo = (s) => String(s == null ? '' : s).replace(/[\s.\-]/g, '');

  /** Trả chuỗi báo lỗi tiếng Việt, rỗng nếu hợp lệ. Nhận dữ liệu thô từ ô nhập: { bin, account, holder }. */
  function kiemTra(raw) {
    const r = raw || {};
    if (!theoBin(r.bin)) return 'Chọn ngân hàng trong danh sách';
    const so = chuanHoaSo(r.account);
    if (!so) return 'Nhập số tài khoản';
    if (!/^[0-9]{6,19}$/.test(so)) return 'Số tài khoản chỉ gồm chữ số, từ 6 đến 19 số';
    const ten = chuanHoaTen(r.holder);
    if (!ten) return 'Nhập tên chủ tài khoản';
    if (!/^[A-Z ]{3,50}$/.test(ten)) return 'Tên chủ tài khoản chỉ gồm chữ cái, 3 đến 50 ký tự';
    return '';
  }

  /** Dạng lưu vào DB (đã chuẩn hóa), hoặc null nếu không hợp lệ / để trống. */
  function chuanHoa(raw) {
    if (!raw || kiemTra(raw)) return null;
    const nh = theoBin(raw.bin);
    return { name: nh.ten, bin: nh.bin, account: chuanHoaSo(raw.account), holder: chuanHoaTen(raw.holder) };
  }

  /** Tài khoản dùng cho một tòa: của tòa nếu hợp lệ, không thì mục bank trong js/config.js (bản cũ), không thì null.
      nguon: 'toa' | 'tep'. Không bao giờ trả số "mẫu". */
  function uuTien(bankInfoCuaToa, cfg) {
    const t = chuanHoa(bankInfoCuaToa);
    if (t) return Object.assign({ nguon: 'toa' }, t);
    const b = (cfg && cfg.bank) || null;
    if (b && chuanHoaSo(b.account)) {
      const nh = theoBin(b.bin) || theoTen(b.name);
      return { nguon: 'tep', name: (nh && nh.ten) || String(b.name || ''), bin: (nh && nh.bin) || String(b.bin || ''),
        account: chuanHoaSo(b.account), holder: chuanHoaTen(b.holder) };
    }
    return null;
  }

  /** Địa chỉ ảnh mã VietQR (img.vietqr.io): quét bằng app ngân hàng là tự điền số tiền và nội dung. Thiếu bin hoặc số thì trả rỗng. */
  function vietQrUrl(tk, soTien, noiDung) {
    if (!tk || !tk.bin || !tk.account) return '';
    return 'https://img.vietqr.io/image/' + encodeURIComponent(tk.bin) + '-' + encodeURIComponent(tk.account) + '-compact2.png'
      + '?amount=' + encodeURIComponent(Math.max(0, Math.round(Number(soTien) || 0)))
      + '&addInfo=' + encodeURIComponent(noiDung || '')
      + '&accountName=' + encodeURIComponent(tk.holder || '');
  }

  const api = { NGAN_HANG, theoBin, theoTen, chuanHoaTen, chuanHoaSo, kiemTra, chuanHoa, uuTien, vietQrUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.bankInfo = api; }
})(typeof window !== 'undefined' ? window : globalThis);

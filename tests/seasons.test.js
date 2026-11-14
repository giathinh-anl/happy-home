/* Kiểm thử giao diện theo mùa và lễ (js/seasons.js).
   Chạy:  node tests/seasons.test.js */
const assert = require('assert');
const S = require('../js/seasons.js');

let ok = 0, hong = 0;
const test = (ten, fn) => {
  try { fn(); ok++; console.log('  ok   ' + ten); }
  catch (e) { hong++; console.log(' HONG  ' + ten + '\n         ' + String(e.message).split('\n').slice(0, 3).join(' | ')); }
};

/** Thời điểm h giờ ngày d/m/y theo GIỜ VIỆT NAM, dạng mili-giây */
const vn = (y, m, d, h) => Date.UTC(y, m - 1, d, (h == null ? 12 : h) - 7, 0, 0);
const chon = (y, m, d, h) => S.chon(vn(y, m, d, h));
const gd = (y, m, d) => chon(y, m, d).giaoDien;
const fmt = (jd) => { const x = S.ngayTuJd(jd); return x.d + '/' + x.m + '/' + x.y; };

/* ============================================================
   Ngày theo giờ Việt Nam
   ============================================================ */
test('ngayVN: lấy ngày theo giờ Việt Nam, không theo múi giờ của máy', () => {
  assert.deepStrictEqual(S.ngayVN(Date.UTC(2026, 1, 16, 16, 59, 59)), { d: 16, m: 2, y: 2026, gio: 23 });
  assert.deepStrictEqual(S.ngayVN(Date.UTC(2026, 1, 16, 17, 0, 0)), { d: 17, m: 2, y: 2026, gio: 0 });
  assert.deepStrictEqual(S.ngayVN(new Date(Date.UTC(2026, 11, 31, 17, 0, 0))), { d: 1, m: 1, y: 2027, gio: 0 });   // nhận cả Date, qua năm mới
  assert.deepStrictEqual(S.ngayVN(Date.UTC(2028, 1, 28, 17, 0, 0)), { d: 29, m: 2, y: 2028, gio: 0 });             // năm nhuận
});
test('msDenNuaDem: còn bao lâu tới nửa đêm giờ Việt Nam', () => {
  assert.strictEqual(S.msDenNuaDem(Date.UTC(2026, 1, 16, 16, 59, 30)), 30000);          // 23:59:30 VN
  assert.strictEqual(S.msDenNuaDem(Date.UTC(2026, 1, 16, 17, 0, 0)), 86400000);         // đúng 00:00 VN: còn trọn một ngày
  assert.strictEqual(S.msDenNuaDem(vn(2026, 5, 5, 12)), 12 * 3600000);
  assert.strictEqual(S.msDenNuaDem(vn(2026, 5, 5, 0)), 86400000);
});
test('số ngày Julius: mốc 1/1/2000 và đổi qua lại đúng với mọi ngày 1900 tới 2100', () => {
  assert.strictEqual(S.jdTuNgay(1, 1, 2000), 2451545);
  let jd = S.jdTuNgay(1, 1, 1900);
  for (let y = 1900; y <= 2100; y++) for (let m = 1; m <= 12; m++) {
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (let d = 1; d <= dim; d++, jd++) {
      assert.strictEqual(S.jdTuNgay(d, m, y), jd, d + '/' + m + '/' + y);
      const x = S.ngayTuJd(jd);
      assert.ok(x.d === d && x.m === m && x.y === y, 'đổi ngược ' + jd);
    }
  }
});

/* ============================================================
   Âm lịch
   ============================================================ */
test('mùng 1 Tết 2015-2029 khớp ngày đã công bố', () => {
  const tet = { 2015: '19/2/2015', 2016: '8/2/2016', 2017: '28/1/2017', 2018: '16/2/2018', 2019: '5/2/2019', 2020: '25/1/2020', 2021: '12/2/2021',
    2022: '1/2/2022', 2023: '22/1/2023', 2024: '10/2/2024', 2025: '29/1/2025', 2026: '17/2/2026', 2027: '6/2/2027', 2028: '26/1/2028', 2029: '13/2/2029' };
  for (const y of Object.keys(tet)) assert.strictEqual(fmt(S.tetJd(+y)), tet[y], 'Tết ' + y);
});
test('Tết 2030 là 2/2 ở Việt Nam (trăng mới lúc 23 giờ 9 phút 2/2 giờ Việt Nam), trong khi Trung Quốc ăn Tết 3/2', () => {
  assert.strictEqual(fmt(S.tetJd(2030)), '2/2/2030');
  assert.strictEqual(S.amLich(3, 2, 2030).d, 2, 'ngày 3/2 là mùng 2 Tết');
  assert.strictEqual(S.amLich(2, 2, 2030, 8).d, 30, 'cùng ngày 2/2: lịch Trung Quốc (múi giờ 8) vẫn là 30 tháng Chạp');
});
test('rằm tháng 8 (Tết Trung thu) 2023-2028', () => {
  const tt = { 2023: '29/9/2023', 2024: '17/9/2024', 2025: '6/10/2025', 2026: '25/9/2026', 2027: '15/9/2027', 2028: '3/10/2028' };
  for (const y of Object.keys(tt)) assert.strictEqual(fmt(S.trungThuJd(+y)), tt[y], 'Trung thu ' + y);
});
test('amLich: Tết là mùng 1 tháng 1, ngày trước đó là cuối tháng Chạp, năm âm đúng', () => {
  assert.deepStrictEqual(S.amLich(17, 2, 2026), { d: 1, m: 1, y: 2026, nhuan: false });
  const truoc = S.amLich(16, 2, 2026);
  assert.ok(truoc.m === 12 && truoc.d >= 29 && truoc.y === 2025, JSON.stringify(truoc));
  assert.deepStrictEqual(S.amLich(6, 10, 2025), { d: 15, m: 8, y: 2025, nhuan: false });
  assert.strictEqual(S.amLich(1, 1, 2026).m, 11);
});
test('tháng nhuận: 2023 nhuận tháng 2, 2025 nhuận tháng 6', () => {
  const dem = (y) => { const m = new Set(); for (let jd = S.jdTuNgay(1, 1, y); jd < S.jdTuNgay(1, 1, y + 1); jd++) { const x = S.ngayTuJd(jd), a = S.amLich(x.d, x.m, x.y); if (a.nhuan) m.add(a.m); } return [...m]; };
  assert.deepStrictEqual(dem(2023), [2]);
  assert.deepStrictEqual(dem(2025), [6]);
  assert.deepStrictEqual(dem(2026), []);
});
test('ngày âm luôn từ 1 tới 30, liên tục, đủ tháng, ở cả múi giờ 7 và 8 (1990-2060)', () => {
  for (const tz of [7, 8]) {
    let prev = null;
    for (let jd = S.jdTuNgay(1, 1, 1990); jd <= S.jdTuNgay(31, 12, 2060); jd++) {
      const x = S.ngayTuJd(jd), a = S.amLich(x.d, x.m, x.y, tz), ngay = x.d + '/' + x.m + '/' + x.y + ' tz' + tz;
      assert.ok(a.d >= 1 && a.d <= 30 && a.m >= 1 && a.m <= 12, 'ngoài khoảng ' + ngay + ' ' + JSON.stringify(a));
      if (prev) {
        if (a.d === prev.d + 1) assert.ok(a.m === prev.m && a.nhuan === prev.nhuan && a.y === prev.y, 'đổi tháng giữa chừng ' + ngay);
        else {
          assert.strictEqual(a.d, 1, 'nhảy ngày ' + ngay);
          assert.ok(prev.d >= 29, 'tháng ngắn quá ' + ngay);
          const nhuanTiep = prev.m === a.m && !prev.nhuan && a.nhuan, thangTiep = a.m === (prev.m % 12) + 1 && !a.nhuan;
          assert.ok(nhuanTiep || thangTiep, 'sai thứ tự tháng ' + ngay + ' ' + JSON.stringify(prev) + ' -> ' + JSON.stringify(a));
        }
      }
      prev = a;
    }
  }
});
test('đối chiếu từng lần trăng mới 2001-2040 với lịch âm của Intl: chỉ được lệch khi trăng mới nằm sát nửa đêm (trong 15 phút)', () => {
  let fc;
  try { fc = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' }); fc.formatToParts(new Date()); }
  catch (e) { console.log('         (bỏ qua: Intl của máy này không có lịch Trung Quốc)'); return; }
  const icuNgay = (jd) => { const x = S.ngayTuJd(jd); return +fc.formatToParts(new Date(Date.UTC(x.y, x.m - 1, x.d, 5))).find((p) => p.type === 'day').value; };
  // giờ UTC của trăng mới thứ k: múi giờ nhỏ nhất làm ngày trăng mới nhảy sang ngày kế
  const gioUtc = (k) => { const co = S.trangMoi(k, 0); let lo = 0, hi = 24; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (S.trangMoi(k, mid) > co) hi = mid; else lo = mid; } return 24 - hi; };
  const kTu = Math.round((S.jdTuNgay(1, 1, 2001) - 2415021.076998695) / 29.530588853), kDen = Math.round((S.jdTuNgay(31, 12, 2040) - 2415021.076998695) / 29.530588853);
  let soThang = 0, lech = 0;
  for (let k = kTu; k <= kDen; k++) {
    const batDau = S.trangMoi(k, 8);
    let icu = null;
    for (const jd of [batDau - 1, batDau, batDau + 1]) if (icuNgay(jd) === 1) icu = jd;
    soThang++;
    assert.notStrictEqual(icu, null, 'Intl không có mùng 1 gần ' + fmt(batDau));
    if (icu !== batDau) {
      lech++;
      const phutCach = Math.min(Math.abs((gioUtc(k) + 8) % 24), Math.abs(24 - ((gioUtc(k) + 8) % 24))) * 60;   // cách nửa đêm giờ Trung Quốc
      assert.ok(phutCach <= 15, 'tháng bắt đầu ' + fmt(batDau) + ' lệch Intl nhưng trăng mới cách nửa đêm ' + phutCach.toFixed(0) + ' phút');
    }
  }
  assert.ok(soThang > 480, 'số tháng đối chiếu ' + soThang);
  assert.ok(lech <= 8, 'lệch quá nhiều: ' + lech + '/' + soThang);
});

/* ============================================================
   Chọn mùa / lễ theo ngày
   ============================================================ */
test('Tết 2026 (mùng 1 là 17/2): cửa sổ từ khoảng 16 tháng Chạp tới rằm tháng Giêng, lời đếm ngược đúng', () => {
  assert.strictEqual(gd(2026, 2, 1), 'xuan');
  let r = chon(2026, 2, 2); assert.strictEqual(r.giaoDien, 'tet'); assert.strictEqual(r.dong, 'Còn 15 ngày nữa là Tết'); assert.strictEqual(r.conLai, 15);
  r = chon(2026, 2, 10); assert.strictEqual(r.dong, 'Còn 7 ngày nữa là Tết');
  r = chon(2026, 2, 16); assert.strictEqual(r.dong, 'Hôm nay là Giao thừa'); assert.strictEqual(r.conLai, 1);
  r = chon(2026, 2, 17); assert.ok(r.dong.startsWith('Mùng 1 Tết'), r.dong); assert.strictEqual(r.conLai, 0);
  assert.ok(chon(2026, 2, 18).dong.startsWith('Mùng 2 Tết'));
  assert.ok(chon(2026, 2, 26).dong.startsWith('Mùng 10 Tết'));
  assert.strictEqual(chon(2026, 2, 27).dong, 'Năm mới an khang, vạn sự như ý');
  assert.strictEqual(chon(2026, 3, 2).dong, 'Năm mới an khang, vạn sự như ý');
  assert.ok(chon(2026, 3, 3).dong.startsWith('Rằm tháng Giêng'));
  assert.strictEqual(gd(2026, 3, 3), 'tet');
  assert.strictEqual(gd(2026, 3, 4), 'xuan');
});
test('đúng 30 ngày Tết mỗi năm, ở năm nào cũng vậy (2020-2040)', () => {
  for (let y = 2020; y <= 2040; y++) {
    let n = 0;
    for (let jd = S.jdTuNgay(1, 1, y); jd < S.jdTuNgay(1, 1, y + 1); jd++) { const x = S.ngayTuJd(jd); if (chon(x.y, x.m, x.d).giaoDien === 'tet') n++; }
    assert.strictEqual(n, 30, 'năm ' + y + ' có ' + n + ' ngày Tết');
  }
});
test('Tết thắng Valentine khi hai cửa sổ chồng nhau; năm Tết sớm thì Valentine vẫn có', () => {
  assert.strictEqual(gd(2026, 2, 14), 'tet');                       // Tết 17/2: 14/2 còn 3 ngày nữa
  assert.strictEqual(gd(2025, 2, 12), 'tet');                       // Tết 29/1/2025: 12/2 là rằm tháng Giêng
  assert.strictEqual(chon(2025, 2, 13).dong, 'Ngày mai là Valentine');
  assert.strictEqual(chon(2025, 2, 14).giaoDien, 'tinhYeu');
  assert.ok(chon(2025, 2, 14).dong.startsWith('Valentine'));
  assert.strictEqual(gd(2025, 2, 15), 'xuan');
  assert.strictEqual(gd(2028, 2, 12), 'tinhYeu');                   // Tết 26/1/2028 đã qua rằm
});
test('Trung thu 2025 (rằm 6/10): từ mùng 8 tháng 8 tới rằm', () => {
  assert.strictEqual(gd(2025, 9, 28), 'thu');
  let r = chon(2025, 9, 29); assert.strictEqual(r.giaoDien, 'trungThu'); assert.strictEqual(r.dong, 'Còn 7 ngày nữa là Tết Trung thu');
  assert.strictEqual(chon(2025, 10, 5).dong, 'Ngày mai là Tết Trung thu');
  r = chon(2025, 10, 6); assert.strictEqual(r.giaoDien, 'trungThu'); assert.ok(r.dong.startsWith('Tết Trung thu'));
  assert.strictEqual(gd(2025, 10, 7), 'thu');
});
test('Giáng sinh và năm mới dương lịch', () => {
  assert.strictEqual(gd(2025, 12, 13), 'dong');
  assert.strictEqual(chon(2025, 12, 14).dong, 'Còn 11 ngày nữa là Giáng sinh');
  assert.strictEqual(gd(2025, 12, 14), 'noel');
  assert.ok(chon(2025, 12, 24).dong.startsWith('Đêm Noel'));
  assert.strictEqual(chon(2025, 12, 25).dong, 'Giáng sinh an lành!');
  assert.strictEqual(gd(2025, 12, 26), 'noel');
  assert.strictEqual(gd(2025, 12, 27), 'dong');
  assert.strictEqual(chon(2025, 12, 28).giaoDien, 'namMoi'); assert.strictEqual(chon(2025, 12, 28).dong, 'Còn 4 ngày nữa là năm mới 2026');
  assert.strictEqual(chon(2025, 12, 31).dong, 'Ngày mai là năm mới 2026');
  assert.strictEqual(chon(2026, 1, 1).dong, 'Chúc mừng năm mới 2026!');
  assert.strictEqual(chon(2026, 1, 2).giaoDien, 'namMoi');
  assert.strictEqual(gd(2026, 1, 3), 'dong');
});
test('30/4 - 1/5, Quốc khánh 2/9, 8/3, 20/10, Halloween', () => {
  assert.strictEqual(gd(2026, 4, 26), 'xuan');
  assert.strictEqual(chon(2026, 4, 27).dong, 'Còn 3 ngày nữa là 30/4'); assert.strictEqual(gd(2026, 4, 27), 'co');
  assert.strictEqual(chon(2026, 4, 29).dong, 'Ngày mai là 30/4');
  assert.ok(chon(2026, 4, 30).dong.startsWith('Mừng 30/4'));
  assert.ok(chon(2026, 5, 1).dong.startsWith('Mừng 1/5')); assert.strictEqual(gd(2026, 5, 1), 'co');
  assert.strictEqual(gd(2026, 5, 2), 'ha');
  assert.strictEqual(gd(2026, 8, 27), 'thu');
  assert.strictEqual(chon(2026, 8, 28).dong, 'Còn 5 ngày nữa là Quốc khánh 2/9'); assert.strictEqual(gd(2026, 8, 28), 'co');
  assert.strictEqual(chon(2026, 9, 1).dong, 'Ngày mai là Quốc khánh 2/9');
  assert.strictEqual(chon(2026, 9, 2).dong, 'Mừng Quốc khánh 2/9!');
  assert.strictEqual(gd(2026, 9, 3), 'thu');
  assert.strictEqual(gd(2026, 3, 5), 'xuan');
  assert.strictEqual(chon(2026, 3, 6).dong, 'Còn 2 ngày nữa là 8/3'); assert.strictEqual(gd(2026, 3, 6), 'hoa');
  assert.ok(chon(2026, 3, 8).dong.startsWith('8/3')); assert.strictEqual(gd(2026, 3, 9), 'xuan');
  assert.strictEqual(gd(2026, 10, 17), 'thu');
  assert.strictEqual(chon(2026, 10, 18).dong, 'Còn 2 ngày nữa là 20/10'); assert.strictEqual(gd(2026, 10, 18), 'hoa');
  assert.ok(chon(2026, 10, 20).dong.startsWith('20/10')); assert.strictEqual(gd(2026, 10, 21), 'thu');
  assert.strictEqual(gd(2026, 10, 26), 'thu');
  assert.strictEqual(chon(2026, 10, 27).dong, 'Còn 4 ngày nữa là Halloween'); assert.strictEqual(gd(2026, 10, 27), 'halloween');
  assert.strictEqual(chon(2026, 10, 31).dong, 'Halloween vui vẻ!');
  assert.strictEqual(gd(2026, 11, 1), 'dong');
});
test('các mùa theo tháng dương lịch: xuân 2-4, hạ 5-7, thu 8-10, đông 11-1', () => {
  assert.strictEqual(gd(2026, 1, 10), 'dong'); assert.strictEqual(gd(2026, 4, 10), 'xuan'); assert.strictEqual(gd(2026, 6, 15), 'ha');
  assert.strictEqual(gd(2026, 7, 31), 'ha'); assert.strictEqual(gd(2026, 8, 10), 'thu'); assert.strictEqual(gd(2026, 10, 8), 'thu');
  assert.strictEqual(gd(2026, 11, 13), 'dong'); assert.strictEqual(gd(2026, 12, 10), 'dong');
  const r = chon(2026, 6, 15); assert.strictEqual(r.loai, 'mua'); assert.strictEqual(r.conLai, null); assert.strictEqual(r.ten, 'Mùa hè');
  assert.strictEqual(chon(2026, 2, 17).loai, 'le');
});
test('đổi ngày đúng lúc nửa đêm giờ Việt Nam, không theo giờ UTC', () => {
  assert.strictEqual(S.chon(Date.UTC(2026, 1, 16, 16, 59, 59)).dong, 'Hôm nay là Giao thừa');     // 23:59:59 ngày 16/2 giờ VN
  assert.ok(S.chon(Date.UTC(2026, 1, 16, 17, 0, 0)).dong.startsWith('Mùng 1 Tết'));                // 00:00:00 ngày 17/2 giờ VN
  assert.strictEqual(S.chon(vn(2026, 4, 30, 0)).conLai, 0); assert.strictEqual(S.chon(vn(2026, 4, 30, 23)).conLai, 0);
  assert.ok(S.chon(new Date(vn(2026, 12, 31, 23))).dong.includes('2027'));                         // nhận Date; 31/12: ngày mai là năm 2027
  assert.ok(S.chon().id, 'không đối số thì dùng bây giờ');
});
test('độ dài từng cửa sổ trong một năm không chồng nhau (2028)', () => {
  const dem = {};
  for (let jd = S.jdTuNgay(1, 1, 2028); jd < S.jdTuNgay(1, 1, 2029); jd++) { const x = S.ngayTuJd(jd), r = chon(x.y, x.m, x.d); dem[r.id] = (dem[r.id] || 0) + 1; }
  assert.strictEqual(dem.tet, 30); assert.strictEqual(dem.trungThu, 8); assert.strictEqual(dem.noel, 13); assert.strictEqual(dem.namMoi, 6);
  assert.strictEqual(dem.thongNhat, 5); assert.strictEqual(dem.quocKhanh, 6); assert.strictEqual(dem.quocTePhuNu, 3); assert.strictEqual(dem.phuNuVN, 3);
  assert.strictEqual(dem.tinhYeu, 3); assert.strictEqual(dem.halloween, 5);
  assert.strictEqual(Object.keys(dem).length, 14, JSON.stringify(dem));     // 10 lễ + 4 mùa
  assert.strictEqual(Object.values(dem).reduce((a, b) => a + b, 0), 366);
});
test('mọi ngày 2020-2040 đều ra kết quả hợp lệ, không nhấp nháy, và đủ 12 bộ theo lịch đều có lúc xuất hiện (bộ Sinh nhật là riêng từng người)', () => {
  const thay = {}; const thay2 = new Set();
  let truoc = null, doi = 0, nam = 2020;
  for (let jd = S.jdTuNgay(1, 1, 2020); jd < S.jdTuNgay(1, 1, 2041); jd++) {
    const x = S.ngayTuJd(jd), r = chon(x.y, x.m, x.d);
    assert.ok(S.GIAO_DIEN[r.giaoDien], 'giao diện lạ ' + r.giaoDien);
    assert.ok(r.loai === 'le' || r.loai === 'mua');
    assert.strictEqual(r.loai, S.GIAO_DIEN[r.giaoDien].loai, r.id);
    assert.ok(typeof r.dong === 'string' && r.dong.length > 3 && typeof r.ten === 'string' && r.ten.length > 1);
    assert.ok(r.conLai === null || (Number.isInteger(r.conLai) && r.conLai >= 0 && r.conLai <= 31), 'conLai ' + r.conLai + ' ' + r.id);
    if (x.y !== nam) { assert.ok(doi <= 40, 'năm ' + nam + ' đổi ' + doi + ' lần'); doi = 0; nam = x.y; }
    if (truoc !== null && truoc !== r.giaoDien) doi++;
    truoc = r.giaoDien; thay2.add(r.giaoDien); thay[r.id] = 1;
  }
  assert.deepStrictEqual([...thay2].sort(), S.DANH_SACH.filter((id) => !S.GIAO_DIEN[id].rieng).sort());
});
test('bộ Sinh nhật: riêng từng người, thắng mọi lễ và mọi mùa trong cả năm, có tên người đó, không có thì gọi "bạn"', () => {
  assert.deepStrictEqual(S.DANH_SACH.filter((id) => S.GIAO_DIEN[id].rieng), ['sinhNhat']);
  for (let jd = S.jdTuNgay(1, 1, 2026); jd < S.jdTuNgay(1, 1, 2028); jd++) {
    const x = S.ngayTuJd(jd), r = S.chon(vn(x.y, x.m, x.d), { sinhNhat: { ten: 'An' } });
    assert.strictEqual(r.giaoDien, 'sinhNhat', x.d + '/' + x.m + '/' + x.y);
    assert.strictEqual(r.dong, 'Chúc mừng sinh nhật, An!'); assert.strictEqual(r.conLai, 0); assert.strictEqual(r.loai, 'le'); assert.strictEqual(r.id, 'sinhNhat');
  }
  assert.strictEqual(S.chon(vn(2026, 2, 17), { sinhNhat: { ten: 'An' } }).giaoDien, 'sinhNhat', 'trùng mùng 1 Tết vẫn là sinh nhật');
  assert.strictEqual(S.chon(vn(2026, 2, 17)).giaoDien, 'tet'); assert.strictEqual(S.chon(vn(2026, 2, 17), {}).giaoDien, 'tet');
  assert.strictEqual(S.chon(vn(2026, 2, 17), { sinhNhat: null }).giaoDien, 'tet'); assert.strictEqual(S.chon(vn(2026, 6, 15), undefined).giaoDien, 'ha');
  assert.strictEqual(S.dongSinhNhat(''), 'Chúc mừng sinh nhật, bạn!'); assert.strictEqual(S.dongSinhNhat(null), 'Chúc mừng sinh nhật, bạn!'); assert.strictEqual(S.dongSinhNhat('  Mẫu '), 'Chúc mừng sinh nhật, Mẫu!');
  assert.strictEqual(S.chon(vn(2026, 6, 15), { sinhNhat: {} }).dong, 'Chúc mừng sinh nhật, bạn!');
  assert.strictEqual(S.xemThu('sinhNhat').dong, 'Chúc mừng sinh nhật!'); assert.strictEqual(S.xemThu('sinhNhat', 'An').dong, 'Chúc mừng sinh nhật, An!');
  assert.strictEqual(S.xemThu('tet', 'An').dong, S.GIAO_DIEN.tet.dongMau, 'tên chỉ dùng cho bộ Sinh nhật');
});

/* ============================================================
   Bảng màu: mọi bộ, cả sáng và tối, chữ vẫn đọc được
   ============================================================ */
const HEX = /^#[0-9A-F]{6}$/;
const RGBA = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 0?\.\d+\)$/;
const INK = { sang: { ink: '#142120', ink2: '#455654', ink3: '#687876', bg0: '#F1F4F3', surface: '#FDFEFE' },
  toi: { ink: '#E8F1EF', ink2: '#AFC2BF', ink3: '#86A09C', bg0: '#0C1514', surface: '#142120' } };       // đúng như tokens.css / tenant.css
test('bangMau: đủ biến, đúng dạng màu, id lạ trả null', () => {
  assert.strictEqual(S.bangMau('khongco', false), null);
  assert.strictEqual(S.TEN_BIEN.length, new Set(S.TEN_BIEN).size);
  for (const id of S.DANH_SACH) for (const toi of [false, true]) {
    const b = S.bangMau(id, toi), nhan = id + (toi ? ' tối' : ' sáng');
    assert.deepStrictEqual(Object.keys(b.vars).sort(), S.TEN_BIEN.slice().sort(), nhan);
    for (const k of S.TEN_BIEN) assert.ok(HEX.test(b.vars[k]) || RGBA.test(b.vars[k]), nhan + ' ' + k + ' = ' + b.vars[k]);
    assert.ok(HEX.test(b.themeColor), nhan);
    assert.strictEqual(b.vars['--teal-500'], S.GIAO_DIEN[id][toi ? 'toi' : 'sang'].c.toUpperCase(), nhan + ': màu nút phải đúng màu đã khai báo của bộ');
  }
});
test('bộ giao diện: tên, tên ngắn, dòng mẫu đủ; DANH_SACH khớp đúng các bộ; mọi lễ trỏ tới bộ có thật', () => {
  assert.deepStrictEqual(S.DANH_SACH.slice().sort(), Object.keys(S.GIAO_DIEN).sort());
  assert.strictEqual(new Set(S.DANH_SACH).size, S.DANH_SACH.length);
  const ten = new Set();
  for (const id of S.DANH_SACH) {
    const g = S.GIAO_DIEN[id];
    assert.ok(g.ten && g.ngan && g.dongMau && (g.loai === 'le' || g.loai === 'mua'), id);
    assert.ok(HEX.test(g.sang.c) && HEX.test(g.sang.phu) && HEX.test(g.toi.c) && HEX.test(g.toi.phu), id);
    assert.ok(!ten.has(g.ngan), 'trùng tên ngắn ' + g.ngan); ten.add(g.ngan);
    assert.strictEqual(S.xemThu(id).giaoDien, id);
  }
  for (const sk of S.SU_KIEN) assert.ok(S.GIAO_DIEN[sk.giaoDien], sk.id);
  assert.strictEqual(S.xemThu('khongco'), null);
});
test('trộn màu và độ tương phản theo WCAG', () => {
  assert.strictEqual(S.mix('#000000', '#FFFFFF', 0), '#000000'); assert.strictEqual(S.mix('#000000', '#FFFFFF', 1), '#FFFFFF');
  assert.strictEqual(S.mix('#FF0000', '#0000FF', 0.5), '#800080');
  assert.strictEqual(S.doSang('#FFFFFF'), 1); assert.strictEqual(S.doSang('#000000'), 0);
  assert.ok(Math.abs(S.tuongPhan('#000000', '#FFFFFF') - 21) < 1e-9);
  assert.strictEqual(S.tuongPhan('#123456', '#123456'), 1);
  assert.ok(Math.abs(S.tuongPhan('#777777', '#FFFFFF') - 4.48) < 0.02);        // giá trị tham chiếu của WCAG
});
test('chế độ sáng: chữ trắng trên nút, chữ trên nền nhạt, chữ thường trên nền pha màu đều đủ độ tương phản', () => {
  const base = S.tuongPhan(INK.sang.ink3, INK.sang.bg0);                          // chữ mờ hiện tại trên nền hiện tại (khoảng 4,2)
  for (const id of S.DANH_SACH) {
    const v = S.bangMau(id, false).vars, n = id + ' sáng', W = '#FFFFFF';
    assert.ok(S.tuongPhan(W, v['--teal-500']) >= 4.5, n + ' trắng trên nút 500: ' + S.tuongPhan(W, v['--teal-500']).toFixed(2));
    assert.ok(S.tuongPhan(W, v['--teal-600']) >= 4.5, n + ' trắng trên nút 600');
    assert.ok(S.tuongPhan(v['--teal-700'], v['--teal-50']) >= 7, n + ' chữ 700 trên nền 50: ' + S.tuongPhan(v['--teal-700'], v['--teal-50']).toFixed(2));
    assert.ok(S.tuongPhan(v['--teal-700'], v['--bg']) >= 7, n + ' liên kết 700 trên nền');
    assert.ok(S.tuongPhan(v['--teal-600'], v['--surface']) >= 4.5, n + ' nhãn tab 600 trên thẻ');
    assert.ok(S.tuongPhan(INK.sang.ink, v['--surface']) >= 12 && S.tuongPhan(INK.sang.ink2, v['--surface']) >= 6 && S.tuongPhan(v['--ink-3'], v['--surface']) >= base - 0.06, n + ' chữ trên thẻ');
    assert.ok(S.doSang(v['--surface']) > 0.9, n + ' thẻ phải gần trắng');
    assert.ok(S.tuongPhan(INK.sang.ink, v['--bg']) >= 12, n + ' chữ chính trên nền');
    assert.ok(S.tuongPhan(INK.sang.ink2, v['--bg']) >= 6, n + ' chữ phụ trên nền');
    assert.ok(S.tuongPhan(v['--ink-3'], v['--bg']) >= base - 0.06, n + ' chữ mờ trên nền: ' + S.tuongPhan(v['--ink-3'], v['--bg']).toFixed(2));
    assert.ok(S.tuongPhan(v['--ink-3'], INK.sang.ink3) < 1.3, n + ' chữ mờ đổi quá tay');
    assert.ok(S.tuongPhan(INK.sang.ink, v['--sz-h1']) >= 10 && S.tuongPhan(INK.sang.ink, v['--sz-h2']) >= 10, n + ' chữ trong lời chào');
    // trên nền lời chào (nhuộm đậm hơn nền app) dòng phụ dùng --ink-2 chứ không dùng chữ mờ --ink-3
    assert.ok(S.tuongPhan(INK.sang.ink2, v['--sz-h1']) >= 5.5 && S.tuongPhan(INK.sang.ink2, v['--sz-h2']) >= 5.5, n + ' chữ phụ trong lời chào: ' + S.tuongPhan(INK.sang.ink2, v['--sz-h2']).toFixed(2));
    assert.ok(S.tuongPhan(v['--teal-700'], S.mix(v['--sz-h2'], W, 0.74)) >= 7, n + ' chữ ruy băng');
  }
});
test('chế độ tối: chữ trắng trên nút, chữ sáng trên nền tối pha màu đều đủ độ tương phản', () => {
  const base = S.tuongPhan(INK.toi.ink3, INK.toi.bg0);
  for (const id of S.DANH_SACH) {
    const v = S.bangMau(id, true).vars, n = id + ' tối', W = '#FFFFFF';
    assert.ok(S.tuongPhan(W, v['--teal-500']) >= 3, n + ' trắng trên nút 500: ' + S.tuongPhan(W, v['--teal-500']).toFixed(2));
    assert.ok(S.tuongPhan(W, v['--teal-600']) >= 3.8, n + ' trắng trên nút 600: ' + S.tuongPhan(W, v['--teal-600']).toFixed(2));
    assert.ok(S.tuongPhan(v['--teal-700'], v['--teal-50']) >= 7, n + ' chữ 700 trên nền 50: ' + S.tuongPhan(v['--teal-700'], v['--teal-50']).toFixed(2));
    assert.ok(S.tuongPhan(v['--teal-700'], v['--bg']) >= 7, n + ' liên kết trên nền');
    assert.ok(S.tuongPhan(INK.toi.ink, v['--bg']) >= 12, n + ' chữ chính trên nền');
    assert.ok(S.tuongPhan(INK.toi.ink, v['--surface']) >= 12 && S.tuongPhan(v['--teal-700'], v['--surface']) >= 7 && S.tuongPhan(INK.toi.ink2, v['--surface']) >= 7, n + ' chữ trên thẻ');
    assert.ok(S.tuongPhan(v['--ink-3'], v['--surface']) >= S.tuongPhan(INK.toi.ink3, INK.toi.surface) - 0.1, n + ' chữ mờ trên thẻ: ' + S.tuongPhan(v['--ink-3'], v['--surface']).toFixed(2));
    assert.ok(S.doSang(v['--surface']) < 0.03, n + ' thẻ phải tối');
    assert.ok(S.tuongPhan(INK.toi.ink2, v['--bg']) >= 7, n + ' chữ phụ trên nền');
    assert.ok(S.tuongPhan(v['--ink-3'], v['--bg']) >= base - 0.06, n + ' chữ mờ trên nền: ' + S.tuongPhan(v['--ink-3'], v['--bg']).toFixed(2));
    assert.ok(S.tuongPhan(v['--ink-3'], INK.toi.ink3) < 1.3, n + ' chữ mờ đổi quá tay');
    assert.ok(S.tuongPhan(INK.toi.ink, v['--sz-h1']) >= 10 && S.tuongPhan(INK.toi.ink, v['--sz-h2']) >= 10, n + ' chữ trong lời chào');
    assert.ok(S.tuongPhan(INK.toi.ink2, v['--sz-h1']) >= 7 && S.tuongPhan(INK.toi.ink2, v['--sz-h2']) >= 7, n + ' chữ phụ trong lời chào');
    assert.ok(S.tuongPhan(v['--teal-700'], S.mix(v['--sz-h2'], '#0C1514', 0.5)) >= 6, n + ' chữ ruy băng');
  }
});
test('sáng và tối thật sự khác nhau, và các bộ khác nhau thật sự khác nhau (không có hai mùa trùng màu nút)', () => {
  const nut = new Set();
  for (const id of S.DANH_SACH) {
    const s = S.bangMau(id, false).vars, t = S.bangMau(id, true).vars;
    assert.notStrictEqual(s['--bg'], t['--bg'], id);
    assert.ok(S.doSang(s['--bg']) > 0.7 && S.doSang(t['--bg']) < 0.1, id + ' nền sáng phải sáng, nền tối phải tối');
    assert.ok(!nut.has(s['--teal-500']), 'trùng màu nút ' + id); nut.add(s['--teal-500']);
  }
});

console.log('\n' + ok + ' đạt, ' + hong + ' hỏng');
process.exit(hong ? 1 : 0);

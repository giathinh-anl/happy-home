/* ============================================================
   Happy Home — Kho dữ liệu giả lập + trạng thái ứng dụng
   Dữ liệu sinh trong bộ nhớ (reset khi tải lại trang).
   Chỉ lưu tùy chọn giao diện (vai trò, kỳ, chế độ xem, đăng nhập) vào localStorage.
   ============================================================ */
HH.store = (function () {
  const U = HH.util;

  /* ---------- Danh mục tĩnh ---------- */
  const ROOM_TYPES = {
    studio: { label: 'Phòng đơn', price: 3200000, area: 18, max: 2 },
    double: { label: 'Phòng đôi', price: 3500000, area: 22, max: 2 },
    deluxe: { label: 'Phòng cao cấp', price: 3800000, area: 26, max: 3 },
  };

  const FIRST_NAMES = ['An', 'Bình', 'Cường', 'Dung', 'Giang', 'Hà', 'Hùng', 'Khánh', 'Lan',
    'Minh', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Trang', 'Tuấn', 'Vy', 'Yến', 'Đạt'];
  const SURNAMES = ['Nguyễn Văn', 'Trần Thị', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Đặng', 'Bùi', 'Đỗ'];
  // Bộ tên theo giới tính để tên nhất quán
  const SURNAMES_M = ['Nguyễn Văn', 'Trần Quốc', 'Lê Minh', 'Phạm Hữu', 'Hoàng Anh', 'Vũ Đình', 'Đặng Bá', 'Bùi Xuân'];
  const SURNAMES_F = ['Nguyễn Thị', 'Trần Thị', 'Lê Thị', 'Phạm Thị', 'Hoàng Thị', 'Vũ Thị', 'Đặng Thị', 'Bùi Thị'];
  const FIRST_M = ['An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Khánh', 'Minh', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Tuấn', 'Đạt', 'Hải', 'Long'];
  const FIRST_F = ['Dung', 'Giang', 'Hà', 'Lan', 'Oanh', 'Trang', 'Vy', 'Yến', 'Thảo', 'Ngọc', 'Linh', 'Hương', 'Mai', 'Nhi', 'Vân'];

  function pick(arr, i) { return arr[i % arr.length]; }

  /* ---------- Bộ sinh dữ liệu ---------- */
  let seq = 1;
  let personSeq = 100; // định danh riêng cho từng khách thuê (tránh trùng tên)
  function makeBuilding(id, name, address, floors, perFloor) {
    return { id, name, address, floors, perFloor };
  }

  const buildings = [
    makeBuilding('b1', 'Happy Home Quận 7', '123 Nguyễn Thị Thập, Quận 7, TP.HCM', 4, 6),
    makeBuilding('b2', 'Happy Home Gò Vấp', '45 Quang Trung, Gò Vấp, TP.HCM', 3, 6),
    makeBuilding('b3', 'Happy Home Bình Thạnh', '78 Điện Biên Phủ, Bình Thạnh, TP.HCM', 3, 5),
  ];

  const rooms = [];
  const tenants = [];
  const contracts = [];
  const services = [];
  const readings = [];
  const invoices = [];
  const payments = [];
  const assets = [];
  const incidents = [];
  const transactions = [];
  const staff = [];
  const claims = [];
  const bankTx = [];          // giao dịch ngân hàng nhận qua webhook / dán sao kê
  const auditLog = [];

  const CUR_PERIOD = '2026-08';
  const PREV_PERIOD = '2026-07';

  // trạng thái phòng theo tỉ lệ để trông thật
  const STATUS_CYCLE = ['occupied', 'occupied', 'occupied', 'occupied', 'occupied',
    'occupied', 'vacant', 'occupied', 'reserved', 'occupied',
    'occupied', 'notice', 'occupied', 'occupied', 'cleaning', 'occupied'];

  buildings.forEach((b, bi) => {
    // dịch vụ tòa nhà
    services.push(
      { id: U.uid('sv'), buildingId: b.id, name: 'Điện', method: 'per_kwh', unit: 2000, unitLabel: '₫/kWh' },
      { id: U.uid('sv'), buildingId: b.id, name: 'Nước', method: 'per_person', unit: 75000, unitLabel: '₫/người' },
      { id: U.uid('sv'), buildingId: b.id, name: 'Phí rác', method: 'flat', unit: 30000, unitLabel: '₫/tháng' },
      { id: U.uid('sv'), buildingId: b.id, name: 'Internet', method: 'flat', unit: 40000, unitLabel: '₫/tháng' },
    );

    // kho tài sản của tòa nhà (chưa chuyển vào phòng nào)
    assets.push(
      { id: 'KHO-ML-' + bi, buildingId: b.id, roomCode: null, name: 'Máy lạnh', icon: '❄️',
        buyPrice: 8000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good', quantity: 3, unit: 'Cái' },
      { id: 'KHO-TL-' + bi, buildingId: b.id, roomCode: null, name: 'Tủ lạnh', icon: '🧊',
        buyPrice: 5000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good', quantity: 2, unit: 'Cái' },
      { id: 'KHO-GI-' + bi, buildingId: b.id, roomCode: null, name: 'Giường', icon: '🛏️',
        buyPrice: 2500000, buyDate: '2024-06-01', lifeMonths: 84, condition: 'good', quantity: 5, unit: 'Cái' },
      { id: 'KHO-TU-' + bi, buildingId: b.id, roomCode: null, name: 'Tủ quần áo', icon: '🗄️',
        buyPrice: 1800000, buyDate: '2024-06-01', lifeMonths: 84, condition: 'good', quantity: 4, unit: 'Cái' },
    );

    const typeKeys = Object.keys(ROOM_TYPES);
    let n = 0;
    for (let f = 1; f <= b.floors; f++) {
      for (let r = 1; r <= b.perFloor; r++) {
        const type = pick(typeKeys, (f + r));
        const t = ROOM_TYPES[type];
        const code = 'P' + f + String(r).padStart(2, '0');
        let status = STATUS_CYCLE[(bi * 7 + n) % STATUS_CYCLE.length];
        const room = {
          id: U.uid('rm'), buildingId: b.id, code, floor: f, type,
          typeLabel: t.label, area: t.area, price: t.price, maxOccupants: t.max,
          status, tenantName: null, tenantId: null, contractId: null,
          contractEnd: null, debt: 0, holdingDeposit: 0,
        };
        rooms.push(room);
        n++;
        if (status === 'reserved') { room.holdingDeposit = Math.round(t.price * 0.5);
          room.tenantName = pick(SURNAMES, bi + n) + ' ' + pick(FIRST_NAMES, n * 5); }

        if (status === 'occupied' || status === 'notice') {
          const occCount = 1 + (seq % 3); // 1..3 khách/phòng
          function mkTenant(rep) {
            const s = personSeq++;
            const female = s % 2 === 0;
            return {
              id: U.uid('tn'), buildingId: b.id, roomCode: code,
              fullName: `${pick(female ? SURNAMES_F : SURNAMES_M, s)} ${pick(female ? FIRST_F : FIRST_M, s)}`,
              idNumber: '079' + String(200000000 + s * 1373).slice(0, 9),
              dob: `${String((s % 27) + 1).padStart(2, '0')}/${String((s % 12) + 1).padStart(2, '0')}/199${s % 9}`,
              gender: female ? 'Nữ' : 'Nam',
              hometown: pick(['TP.HCM', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Nghệ An'], s),
              phone: '09' + String(10000000 + s * 111117).slice(0, 8),
              occupation: pick(['Nhân viên văn phòng', 'Kế toán', 'Kỹ sư', 'Giáo viên', 'Sinh viên', 'Kinh doanh tự do', 'Công nhân', 'Lập trình viên'], s),
              address: pick(['45/7 Đường Khách Thuê, TP.HCM', '12 Lê Lợi, Q.1, TP.HCM', '88 Trần Hưng Đạo, TP.HCM'], s),
              cccdIssueDate: `${String((s % 27) + 1).padStart(2, '0')}/0${(s % 9) + 1}/202${(s % 4) + 1}`,
              cccdIssuePlace: 'Cục CSQLHC về TTXH',
              cccdFront: s % 3 !== 0, cccdBack: s % 4 !== 0,
              vehiclePlate: s % 3 === 0 ? null : '59' + String.fromCharCode(65 + s % 26) + '1-' + String(10000 + s * 7).slice(0, 5),
              ttlock: s % 3 === 0, tamtru: s % 5 !== 0,
              occupants: 1, isRep: rep,
            };
          }
          const tenant = mkTenant(true);
          const full = tenant.fullName;
          tenant.occupants = occCount;
          tenants.push(tenant);
          for (let k = 1; k < occCount; k++) tenants.push(mkTenant(false));
          const monthsAgo = 2 + (seq % 10); // bắt đầu 2..11 tháng trước
          const start = U.addMonths(U.today(), -monthsAgo);
          const end = U.addMonths(start, 12); // còn 1..10 tháng -> phần lớn còn hiệu lực
          const debt = (n % 4 === 0) ? (1000000 + (seq % 3) * 400000) : (n % 7 === 0 ? 2180000 : 0);
          const contract = {
            id: U.uid('hd'), buildingId: b.id, roomCode: code, roomType: type,
            tenantName: full, tenantId: tenant.id, rent: t.price, deposit: t.price,
            start: start.toISOString(), end: end.toISOString(),
            billingDay: 1, dueDays: 5, cycle: 'monthly',
            status: status === 'notice' ? 'terminating' : 'active', debt,
          };
          // sắp hết hạn
          if (U.daysBetween(U.today(), end) <= 30 && U.daysBetween(U.today(), end) >= 0) contract.expiringSoon = true;
          contracts.push(contract);
          room.tenantName = full; room.tenantId = tenant.id; room.contractId = contract.id;
          room.contractEnd = end.toISOString(); room.debt = debt;

          // tài sản trong phòng
          assets.push(
            { id: 'ML-' + String(100 + seq).slice(1), buildingId: b.id, roomCode: code, name: 'Máy lạnh', icon: '❄️',
              buyPrice: 8000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good', quantity: 1, unit: 'Cái' },
            { id: 'TL-' + String(100 + seq).slice(1), buildingId: b.id, roomCode: code, name: 'Tủ lạnh', icon: '🧊',
              buyPrice: 5000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good', quantity: 1, unit: 'Cái' },
          );

          // chỉ số kỳ trước (đã có) + kỳ này (một phần)
          const elecPrev = 8000 + seq * 210;
          const hasCurrent = !((bi === 0) && (n % 4 === 0)); // vài phòng tòa 1 chưa ghi -> "18/24"
          const elecUse = 150 + (seq * 37) % 120;
          const reading = {
            id: U.uid('rd'), buildingId: b.id, roomCode: code, period: CUR_PERIOD,
            elecPrev, elecCurr: hasCurrent ? elecPrev + elecUse : null,
            elecPhoto: hasCurrent,
            elecAvg: 190, // trung bình 3 kỳ (để tính bất thường)
            source: (n % 9 === 0) ? 'tenant' : 'staff',
            approved: (n % 9 === 0) ? false : true,
          };
          // 1 phòng có tiêu thụ bất thường
          if (bi === 0 && n === 3) { reading.elecCurr = elecPrev + 790; }
          readings.push(reading);

          // hóa đơn kỳ trước (đã thanh toán phần lớn) + kỳ này
          [PREV_PERIOD, CUR_PERIOD].forEach((per, idx) => {
            if (per === CUR_PERIOD && !hasCurrent) return; // chưa đủ chỉ số -> chưa có HĐ kỳ này
            const inv = buildInvoice(b.id, room, contract, tenant, per, reading, idx);
            invoices.push(inv);
          });
          seq++; // mỗi khách thuê một danh tính khác nhau
        }
      }
    }
  });

  // Sự cố phòng (mẫu)
  const occRooms = rooms.filter(r => r.status === 'occupied');
  [['Điện', 'Chập điện ổ cắm phòng tắm'], ['Nước', 'Rò rỉ ống nước bồn rửa'], ['Máy lạnh', 'Máy lạnh không mát']]
    .forEach((it, i) => { const r = occRooms[i * 4]; if (r) incidents.push({
      id: U.uid('sc'), buildingId: r.buildingId, roomCode: r.code, category: it[0], title: it[1],
      status: i === 0 ? 'processing' : 'open', createdAt: new Date(2026, 7, 6 + i).toISOString() }); });

  function buildInvoice(bid, room, contract, tenant, period, reading, idx) {
    const [y, m] = period.split('-').map(Number);
    const periodStart = new Date(y, m - 1, 1);
    const periodEnd = new Date(y, m, 0);
    const dueDate = new Date(y, m, 5);
    const elecUse = (reading.elecCurr || reading.elecPrev + 200) - reading.elecPrev;
    const water = services.find(s => s.buildingId === bid && s.method === 'per_person');
    const elec = services.find(s => s.buildingId === bid && s.method === 'per_kwh');
    const occ = tenant.occupants || 2;
    const lines = [
      { label: 'Tiền phòng', amount: contract.rent,
        meta: `Trọn kỳ, ${periodEnd.getDate()}/${periodEnd.getDate()} ngày` },
      { label: 'Tiền điện', amount: elecUse * elec.unit, type: 'elec',
        meta: `Chỉ số ${U.number(reading.elecPrev)} → ${U.number(reading.elecCurr || reading.elecPrev + elecUse)} · ${U.number(elecUse)} kWh × ${U.number(elec.unit)} ₫` },
      { label: 'Tiền nước', amount: occ * water.unit,
        meta: `${occ} người × ${U.number(water.unit)} ₫/người` },
      { label: 'Phí rác', amount: 30000, meta: 'Cố định theo tháng' },
      { label: 'Phí internet', amount: 40000, meta: 'Cố định theo tháng' },
    ];
    const total = lines.reduce((s, l) => s + l.amount, 0);

    // trạng thái + đã trả — băm mã phòng để trạng thái phân bố đều
    let status, paid;
    let hsh = 0; for (let k = 0; k < room.code.length; k++) hsh = (hsh * 31 + room.code.charCodeAt(k)) & 0xffff;
    const roll = (hsh + (period === CUR_PERIOD ? 4 : 0)) % 10;
    if (period === PREV_PERIOD) {
      // kỳ trước: gần như đã thu hết, chỉ còn vài khoản
      if (roll < 8) { status = 'paid'; paid = total; }
      else if (roll < 9) { status = 'partial'; paid = Math.round(total * 0.5); }
      else { status = 'overdue'; paid = 0; }
    } else {
      // kỳ này: phần lớn đã thu, còn lại đang chờ / trả một phần / quá hạn
      if (roll < 5) { status = 'paid'; paid = total; }
      else if (roll < 7) { status = 'issued'; paid = 0; }
      else if (roll < 9) { status = 'partial'; paid = Math.round(total * 0.45); }
      else { status = 'overdue'; paid = 0; }
    }
    const num = String(1 + (invoices.length % 900)).padStart(3, '0');
    const inv = {
      id: `HD-${period.slice(2, 4)}${String(m).padStart(2, '0')}-${num}`,
      buildingId: bid, roomCode: room.code, contractId: contract.id, tenantId: tenant.id,
      tenantName: tenant.fullName, period,
      periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(),
      dueDate: dueDate.toISOString(), lines, total, paid, status,
      edited: false, editedAt: null, editedBy: null,
    };
    if (period === CUR_PERIOD && room.floor === 2 && room.code.endsWith('01')) {
      inv.edited = true; inv.editedAt = '2026-08-08'; inv.editedBy = 'Nguyễn Văn A';
    }
    if (status === 'paid' || status === 'partial') {
      payments.push({
        id: U.uid('pm'), invoiceId: inv.id, buildingId: bid, contractId: contract.id,
        roomCode: room.code, tenantName: tenant.fullName,
        receiptNo: `PT-${period.slice(2, 4)}${String(m).padStart(2, '0')}-${num}`,
        date: new Date(y, m, 3).toISOString(), method: 'Chuyển khoản', amount: paid,
        note: `${room.code} ${period}`,
      });
    }
    return inv;
  }

  /* ---------- Lưu bền dữ liệu ---------- */
  const DATA_KEY = 'hh_data_v2';
  const groups = { buildings, rooms, tenants, contracts, services, readings, invoices, payments, assets, incidents, transactions, staff, claims, bankTx, auditLog };
  const usingBackend = () => !!(HH.backend && HH.backend.enabled);

  let syncTimer = null;
  function persist() {
    if (usingBackend()) { clearTimeout(syncTimer); syncTimer = setTimeout(syncAll, 350); return; }
    try { localStorage.setItem(DATA_KEY, JSON.stringify(groups)); } catch (e) {}
  }
  async function syncAll() {
    if (!usingBackend()) return;
    for (const k of Object.keys(groups)) { await HH.backend.saveMany(k, groups[k]); }
  }
  function replaceAll(data) {
    Object.keys(groups).forEach(k => { groups[k].length = 0; (data[k] || []).forEach(x => groups[k].push(x)); });
  }
  function loadPersisted() {
    try {
      const rawStr = localStorage.getItem(DATA_KEY); if (!rawStr) return false;
      const snap = JSON.parse(rawStr);
      replaceAll(snap);
      return true;
    } catch (e) { return false; }
  }
  // Chế độ demo: lưu localStorage. Chế độ backend: nạp khi đăng nhập (bên dưới).
  if (!usingBackend()) { if (!loadPersisted()) persist(); setTimeout(() => { if (api.refreshExpiryFlags()) persist(); }, 0); }

  /* ---------- Trạng thái ứng dụng ---------- */
  const PREFS_KEY = 'hh_prefs_v1';
  const defaultPrefs = { auth: false, role: 'owner', userName: 'Nguyễn Văn A',
    period: CUR_PERIOD, roomView: 'map' };
  let prefs = Object.assign({}, defaultPrefs);
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY)); if (p) prefs = Object.assign(prefs, p); } catch (e) {}
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------- Điều khoản hợp đồng mẫu (chuẩn thuê nhà VN) ---------- */
  const DEFAULT_TERMS = [
    { title: 'Mục đích thuê', body: 'Bên B thuê phòng của Bên A để làm nơi ở. Không sử dụng vào mục đích khác nếu không có sự đồng ý bằng văn bản của Bên A.' },
    { title: 'Tiền thuê và thanh toán', body: 'Tiền thuê được thanh toán hàng tháng theo kỳ ghi trong hợp đồng. Quá hạn thanh toán {dueDays} ngày, Bên A có quyền nhắc nhở và áp dụng biện pháp theo thỏa thuận.' },
    { title: 'Tiền đặt cọc', body: 'Bên B đặt cọc {deposit} để bảo đảm thực hiện hợp đồng. Tiền cọc được hoàn trả khi kết thúc hợp đồng sau khi trừ các khoản còn nợ và chi phí hư hỏng (nếu có).' },
    { title: 'Chi phí dịch vụ', body: 'Tiền điện, nước và các dịch vụ khác được tính theo chỉ số thực tế hoặc đơn giá niêm yết tại thời điểm sử dụng, thanh toán cùng kỳ tiền thuê.' },
    { title: 'Quyền và nghĩa vụ của Bên A (bên cho thuê)', body: 'Bàn giao phòng đúng hiện trạng thỏa thuận; bảo đảm quyền sử dụng ổn định cho Bên B; sửa chữa hư hỏng do kết cấu công trình hoặc hao mòn tự nhiên.' },
    { title: 'Quyền và nghĩa vụ của Bên B (bên thuê)', body: 'Thanh toán đầy đủ, đúng hạn; giữ gìn tài sản trong phòng; không tự ý sửa chữa, cải tạo khi chưa được đồng ý; không chuyển nhượng lại phòng cho người khác.' },
    { title: 'Sử dụng tài sản trong phòng', body: 'Bên B có trách nhiệm bảo quản tài sản đã nhận bàn giao. Hư hỏng do lỗi của Bên B thì Bên B bồi thường theo giá trị còn lại của tài sản.' },
    { title: 'An ninh, trật tự và phòng cháy chữa cháy', body: 'Bên B tuân thủ nội quy nhà trọ, giữ gìn an ninh trật tự, vệ sinh chung, chấp hành quy định về phòng cháy chữa cháy và đăng ký tạm trú theo quy định pháp luật.' },
    { title: 'Chấm dứt hợp đồng trước hạn', body: 'Bên muốn chấm dứt hợp đồng trước hạn phải báo trước ít nhất 30 ngày. Trường hợp Bên B tự ý chấm dứt không báo trước, Bên A có quyền khấu trừ tiền cọc theo thỏa thuận.' },
    { title: 'Điều khoản chung', body: 'Hai bên cam kết thực hiện đúng các điều khoản. Mọi thay đổi phải được lập thành văn bản có chữ ký hai bên. Tranh chấp được giải quyết trên tinh thần thương lượng, nếu không được thì đưa ra cơ quan có thẩm quyền.' },
  ];

  function shiftPeriod(period, delta) {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  // Dựng hóa đơn nháp từ hợp đồng + chỉ số + dịch vụ (dùng khi sinh hóa đơn thật)
  function runtimeInvoice(bid, contract, reading, period, svcs) {
    const [y, m] = period.split('-').map(Number);
    const periodStart = new Date(y, m - 1, 1);
    const periodEnd = new Date(y, m, 0);
    const dueDate = new Date(y, m, contract.dueDays || 5);
    const elec = svcs.find(s => s.method === 'per_kwh');
    const water = svcs.find(s => s.method === 'per_person');
    const flats = svcs.filter(s => s.method === 'flat');
    const roomTenants = tenants.filter(t => t.buildingId === bid && t.roomCode === contract.roomCode);
    const occ = Math.max(1, roomTenants.length);
    const lines = [{ label: 'Tiền phòng', amount: contract.rent, meta: `Trọn kỳ, ${periodEnd.getDate()}/${periodEnd.getDate()} ngày` }];
    if (elec && reading.elecCurr != null) {
      const use = api.consumptionOf(reading, 'elec') || 0;
      const extra = reading.elecExtra || 0;
      lines.push({ label: 'Tiền điện', amount: use * elec.unit, type: 'elec',
        meta: `Chỉ số ${U.number(reading.elecPrev)} → ${U.number(reading.elecCurr)}`
          + (extra ? ` (+${U.number(extra)} bù đồng hồ)` : '')
          + ` · ${U.number(use)} kWh × ${U.number(elec.unit)} ₫` });
    }
    if (water) lines.push({ label: 'Tiền nước', amount: occ * water.unit, meta: `${occ} người × ${U.number(water.unit)} ₫/người` });
    flats.forEach(f => lines.push({ label: f.name, amount: f.unit, meta: 'Cố định theo tháng' }));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const num = String(invoices.filter(i => i.period === period).length + 1).padStart(3, '0');
    const rep = roomTenants.find(t => t.isRep) || roomTenants[0] || {};
    return {
      id: `HD-${period.slice(2, 4)}${String(m).padStart(2, '0')}-${num}`,
      buildingId: bid, roomCode: contract.roomCode, contractId: contract.id, tenantId: rep.id || contract.tenantId,
      tenantName: contract.tenantName, period,
      periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), dueDate: dueDate.toISOString(),
      lines, total, paid: 0, status: 'draft', edited: false, editedAt: null, editedBy: null,
    };
  }

  /* ---------- Truy vấn ---------- */
  /* ---------- Phân quyền ---------- */
  // Danh sách quyền theo module (dùng cho màn hình phân quyền nhân viên)
  const PERMISSIONS = [
    { key: 'rooms', label: 'Quản lý phòng', desc: 'Xem & sửa phòng, đổi trạng thái' },
    { key: 'tenants', label: 'Khách thuê', desc: 'Hồ sơ khách, xe, tạm trú' },
    { key: 'contracts', label: 'Hợp đồng', desc: 'Lập, gia hạn, thanh lý hợp đồng' },
    { key: 'readings', label: 'Ghi chỉ số', desc: 'Nhập & duyệt chỉ số điện nước' },
    { key: 'invoices', label: 'Hóa đơn', desc: 'Sinh, phát hành, hủy hóa đơn' },
    { key: 'payments', label: 'Thanh toán & công nợ', desc: 'Ghi nhận thanh toán' },
    { key: 'services', label: 'Dịch vụ & đơn giá', desc: 'Sửa đơn giá dịch vụ' },
    { key: 'assets', label: 'Tài sản', desc: 'Quản lý tài sản theo phòng' },
    { key: 'incidents', label: 'Sự cố', desc: 'Xử lý yêu cầu sửa chữa' },
    { key: 'expenses', label: 'Thu chi', desc: 'Sổ thu chi tòa nhà', sensitive: true },
    { key: 'reports', label: 'Báo cáo & tổng quan', desc: 'Xem doanh thu, công nợ', sensitive: true },
    { key: 'settings', label: 'Cấu hình', desc: 'Cấu hình tòa nhà, công ty', sensitive: true },
  ];
  const DEFAULT_STAFF_PERMS = ['rooms', 'tenants', 'readings', 'incidents'];

  const api = {
    ROOM_TYPES, CUR_PERIOD, PREV_PERIOD, DEFAULT_TERMS, PERMISSIONS, DEFAULT_STAFF_PERMS,
    // Điều khoản của 1 hợp đồng (dùng mẫu nếu chưa tùy chỉnh), đã thay biến {deposit},{dueDays}
    termsOf(c) {
      const list = (c && c.terms && c.terms.length) ? c.terms : DEFAULT_TERMS;
      return list.map(t => ({
        title: t.title,
        body: (t.body || '')
          .replace('{deposit}', U.currency(c ? c.deposit : 0))
          .replace('{dueDays}', c ? (c.dueDays || 5) : 5)
          .replace('{rent}', U.currency(c ? c.rent : 0)),
      }));
    },
    prefs,
    setPref(k, v) { prefs[k] = v; savePrefs(); },
    usingBackend,
    login(role) { prefs.auth = true; prefs.role = role || 'owner';
      prefs.permissions = role === 'staff' ? DEFAULT_STAFF_PERMS.slice() : null;
      prefs.userName = role === 'staff' ? 'Trần Thị Vận Hành' : 'Nguyễn Văn A'; savePrefs(); },
    logout() { prefs.auth = false; savePrefs(); if (usingBackend()) HH.backend.signOut(); },
    isOwner() { return prefs.role === 'owner'; },

    /* ---------- Nhân viên & quyền ---------- */
    staff,
    staffList: () => staff.slice(),
    staffById: (id) => staff.find(s => s.id === id),
    addStaff(s) { staff.push(s); persist(); return s; },
    updateStaff(id, patch) { const s = staff.find(x => x.id === id); if (s) { Object.assign(s, patch); persist(); } return s; },
    removeStaff(id) {
      const i = staff.findIndex(x => x.id === id);
      if (i >= 0) { const s = staff[i]; staff.splice(i, 1); api.log('staff.remove', `Xóa nhân viên ${s.email}`); persist();
        if (usingBackend()) HH.backend.deleteOne('staff', id); }
    },
    // Quyền của người đang đăng nhập: chủ trọ = tất cả; nhân viên = theo cấu hình
    myPermissions() {
      if (prefs.role === 'owner') return PERMISSIONS.map(p => p.key);
      return prefs.permissions || [];
    },
    can(key) {
      if (prefs.role === 'owner') return true;
      return (prefs.permissions || []).indexOf(key) >= 0;
    },
    myStaffRecord() { return prefs.staffId ? staff.find(s => s.id === prefs.staffId) : null; },

    // ----- Kỳ (tháng) đang xem -----
    period: () => prefs.period || CUR_PERIOD,
    setPeriod(p) { prefs.period = p; savePrefs(); },
    prevPeriodOf(p) { const [y, m] = p.split('-').map(Number); const d = new Date(y, m - 2, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },
    periodLabel(p) { const a = (p || '').split('-'); return 'T' + Number(a[1]) + '/' + a[0]; },
    periodsWithData() {
      const s = new Set(); invoices.forEach(i => s.add(i.period)); readings.forEach(r => s.add(r.period)); return s;
    },

    // Sau khi Supabase xác thực xong: nạp dữ liệu của người dùng (hoặc đẩy dữ liệu mẫu nếu trống)
    async onSignedIn(user) {
      const email = (user && user.email) || '';
      // Nếu email này được chủ trọ thêm làm nhân viên -> vào với vai trò & quyền tương ứng
      let st = null;
      try { st = await HH.backend.findStaffByEmail(email); } catch (e) {}
      if (st) {
        prefs.role = 'staff'; prefs.staffId = st.id; prefs.ownerId = st.ownerId || null;
        prefs.permissions = Array.isArray(st.permissions) ? st.permissions : DEFAULT_STAFF_PERMS;
        prefs.userName = st.fullName || email;
      } else {
        prefs.role = 'owner'; prefs.staffId = null; prefs.ownerId = null; prefs.permissions = null;
        prefs.userName = (user && (user.user_metadata && user.user_metadata.full_name)) || email || 'Chủ trọ';
      }
      const res = await HH.backend.loadAll();
      if (res.error) { prefs.auth = false; savePrefs(); return 'error'; } // không nạp được -> KHÔNG tạo trùng
      const total = Object.values(res.data).reduce((s, a) => s + a.length, 0);
      prefs.auth = true; savePrefs();
      // Nhân viên không tạo dữ liệu mẫu — chỉ dùng dữ liệu của chủ trọ
      if (total === 0 && st) { replaceAll(res.data); return 'loaded'; }
      if (total === 0) { api.refreshExpiryFlags(); await syncAll(); return 'seeded'; }  // tài khoản mới: đẩy dữ liệu mẫu
      replaceAll(res.data);
      // cập nhật cờ sắp hết hạn & trạng thái quá hạn theo ngày hiện tại
      const c1 = api.refreshExpiryFlags(), c2 = api.refreshInvoiceStatus();
      if (c1 || c2) persist();
      // Tiền ngân hàng về lúc chưa mở app -> khớp hóa đơn & xóa công nợ ngay khi vào
      try {
        const r = api.autoReconcile();
        if (r.done.length) setTimeout(() => HH.ui && HH.ui.toast(
          `Tự động ghi thu ${r.done.length} giao dịch chuyển khoản mới`, { type: 'ok', sticky: true }), 900);
      } catch (e) { console.info('Đối soát tự động bỏ qua:', e && e.message); }
      return 'loaded';
    },

    /* Đẩy ngay những thay đổi đang chờ lên máy chủ rồi mới trả về.
       Dùng khi màn hình cần biết "đã lưu xong chưa" để báo cho người dùng,
       thay vì bấm Lưu xong không thấy gì rồi tưởng trang bị treo. */
    async flush() {
      if (!usingBackend()) return { ok: true, demo: true };
      clearTimeout(syncTimer); syncTimer = null;
      try { await syncAll(); return { ok: true }; }
      catch (e) { return { ok: false, message: e && e.message }; }
    },

    /* Tải lại dữ liệu từ máy chủ.
       Khách gửi chỉ số, báo hỏng hay báo chuyển khoản trong lúc web đang mở thì
       phải tải lại mới thấy (dữ liệu chỉ nạp một lần lúc đăng nhập). */
    async refreshFromServer() {
      if (!usingBackend()) return { ok: false, reason: 'demo' };
      const stamp = () => JSON.stringify([incidents.length, claims.length, readings.length,
        invoices.length, payments.length, tenants.length,
        incidents.map(x => x.status).join(''), claims.map(x => x.status).join('')]);
      const before = stamp();
      const res = await HH.backend.loadAll();
      if (res.error) return { ok: false, reason: 'error' };
      replaceAll(res.data);
      api.refreshExpiryFlags(); api.refreshInvoiceStatus();
      return { ok: true, changed: before !== stamp() };
    },

    buildings, services, assets, auditLog, incidents,
    incidentsOf: (bid) => incidents.filter(x => x.buildingId === bid && x.status !== 'done'),
    allIncidentsOf: (bid) => incidents.filter(x => x.buildingId === bid),
    incident: (id) => incidents.find(x => x.id === id),
    updateIncident(id, patch) { const x = incidents.find(i => i.id === id); if (x) { Object.assign(x, patch); persist(); } return x; },
    removeIncident(id) {
      const i = incidents.findIndex(x => x.id === id);
      if (i >= 0) { incidents.splice(i, 1); persist(); if (usingBackend()) HH.backend.deleteOne('incidents', id); }
    },

    /* ---------- Phiếu khách báo đã chuyển khoản ---------- */
    claims,
    claimsOf: (bid, status) => claims.filter(c => (!bid || c.buildingId === bid) && (!status || c.status === status)),
    claim: (id) => claims.find(c => c.id === id),
    updateClaim(id, patch) { const c = claims.find(x => x.id === id); if (c) { Object.assign(c, patch); persist(); } return c; },
    pendingClaimCount: (bid) => claims.filter(c => c.status === 'pending' && (!bid || c.buildingId === bid)).length,
    building: (id) => buildings.find(b => b.id === id),

    // Trung tâm thông báo (tính từ dữ liệu hiện có)
    notifications() {
      const list = [];
      buildings.forEach(b => {
        const overdue = invoices.filter(i => i.buildingId === b.id && i.status === 'overdue');
        if (overdue.length) list.push({ icon: HH.ic('receipt', 16), tone: 'danger', title: `${overdue.length} hóa đơn quá hạn`,
          sub: b.name, href: `#/b/${b.id}/invoices?status=overdue` });
        const expired = api.expiringContracts(b.id, -1);
        if (expired.length) list.push({ icon: HH.ic('alert', 16), tone: 'danger', title: `${expired.length} hợp đồng ĐÃ QUÁ HẠN`,
          sub: b.name + ' · cần gia hạn hoặc thanh lý ngay', href: `#/b/${b.id}/contracts?filter=expired` });
        const urgent = api.expiringContracts(b.id, 7).filter(c => api.daysToExpiry(c) >= 0);
        if (urgent.length) list.push({ icon: HH.ic('flame', 16), tone: 'danger', title: `${urgent.length} hợp đồng hết hạn trong 7 ngày`,
          sub: b.name + ' · ' + urgent.map(c => c.roomCode).join(', '), href: `#/b/${b.id}/contracts?filter=urgent` });
        const soon = api.expiringContracts(b.id, 30).filter(c => api.daysToExpiry(c) > 7);
        if (soon.length) list.push({ icon: HH.ic('file', 16), tone: 'warning', title: `${soon.length} hợp đồng sắp hết hạn (30 ngày)`,
          sub: b.name + ' · ' + soon.map(c => c.roomCode).join(', '), href: `#/b/${b.id}/contracts?filter=soon` });
        const occ = rooms.filter(r => r.buildingId === b.id && (r.status === 'occupied' || r.status === 'notice'));
        const pending = occ.filter(r => { const rd = api.reading(b.id, r.code, CUR_PERIOD); return !(rd && rd.elecCurr != null); });
        if (pending.length) list.push({ icon: HH.ic('gauge', 16), tone: 'info', title: `${pending.length} phòng chưa ghi chỉ số kỳ này`,
          sub: b.name, href: `#/b/${b.id}/readings` });
        const inc = incidents.filter(x => x.buildingId === b.id && x.status !== 'done');
        if (inc.length) list.push({ icon: HH.ic('wrench', 16), tone: 'purple', title: `${inc.length} sự cố phòng đang mở`,
          sub: b.name, href: `#/b/${b.id}/incidents` });
      });
      return list;
    },
    notificationCount() { return api.notifications().length; },

    // Tổng hợp cho 4 thẻ trang phòng (kiểu LOZIDO)
    roomSummary(bid) {
      const rs = rooms.filter(r => r.buildingId === bid);
      const debt = invoices.filter(i => i.buildingId === bid && i.status !== 'cancelled')
        .reduce((s, i) => s + (i.total - i.paid), 0);
      const deposit = contracts.filter(c => c.buildingId === bid && (c.status === 'active' || c.status === 'terminating'))
        .reduce((s, c) => s + (c.deposit || 0), 0);
      const holding = rs.filter(r => r.status === 'reserved').reduce((s, r) => s + (r.holdingDeposit || 0), 0);
      const incident = incidents.filter(x => x.buildingId === bid && x.status !== 'done').length;
      return { debt, deposit, holding, incident };
    },
    roomsOf: (bid) => rooms.filter(r => r.buildingId === bid),
    room: (bid, code) => rooms.find(r => r.buildingId === bid && r.code === code),
    tenantsOf: (bid) => tenants.filter(t => t.buildingId === bid),
    tenantById: (id) => tenants.find(t => t.id === id),
    tenantByIdNumber: (idn) => tenants.find(t => t.idNumber === idn),
    contractsOf: (bid) => contracts.filter(c => c.buildingId === bid),
    contract: (id) => contracts.find(c => c.id === id),
    servicesOf: (bid) => services.filter(s => s.buildingId === bid),
    assetsOf: (bid, code) => assets.filter(a => a.buildingId === bid && (!code || a.roomCode === code)),
    readingsOf: (bid, period) => readings.filter(r => r.buildingId === bid && r.period === period),
    reading: (bid, code, period) => readings.find(r => r.buildingId === bid && r.roomCode === code && r.period === period),
    invoicesOf: (bid, period) => invoices.filter(i => i.buildingId === bid && (!period || i.period === period)),
    invoice: (id) => invoices.find(i => i.id === id),
    invoicesForContract: (cid) => invoices.filter(i => i.contractId === cid),
    paymentsOf: (invId) => payments.filter(p => p.invoiceId === invId),

    /* ---------- Tổng hợp dashboard (theo kỳ đang chọn) ---------- */
    dashboardSummary() {
      const per = api.period();
      const bstats = buildings.map(b => {
        const rs = rooms.filter(r => r.buildingId === b.id);
        const occRooms = rs.filter(r => r.status === 'occupied' || r.status === 'notice').length;
        const invs = invoices.filter(i => i.buildingId === b.id && i.period === per);
        const revenue = invs.reduce((s, i) => s + i.paid, 0);
        const debt = invoices.filter(i => i.buildingId === b.id && i.status !== 'cancelled').reduce((s, i) => s + (i.total - i.paid), 0);
        return { id: b.id, name: b.name, unitCount: rs.length,
          occupancyRate: rs.length ? occRooms / rs.length : 0, revenue, debt };
      });
      const totalRooms = rooms.length;
      const occ = rooms.filter(r => r.status === 'occupied' || r.status === 'notice').length;
      const revenue = bstats.reduce((s, x) => s + x.revenue, 0);
      const debt = bstats.reduce((s, x) => s + x.debt, 0);
      const cost = transactions.filter(t => t.kind === 'expense' && (t.date || '').slice(0, 7) === per).reduce((s, t) => s + t.amount, 0);
      const overdue = invoices.filter(i => i.status === 'overdue').length;
      const expiring = api.expiringContracts(null, 30).length;
      const expiredCount = api.expiringContracts(null, -1).length;
      const occRoomsAll = rooms.filter(r => r.status === 'occupied' || r.status === 'notice');
      const pendingReadings = occRoomsAll.filter(r => { const rd = api.reading(r.buildingId, r.code, per); return !(rd && rd.elecCurr != null); }).length;
      // Doanh thu 6 kỳ gần nhất (thu thật theo từng tháng)
      const revenueHistory = [];
      for (let k = 5; k >= 0; k--) {
        const mp = shiftPeriod(per, -k);
        const amt = invoices.filter(i => i.period === mp).reduce((s, i) => s + i.paid, 0);
        revenueHistory.push({ period: 'T' + Number(mp.split('-')[1]), amount: amt });
      }
      return {
        period: per, occupancyRate: totalRooms ? occ / totalRooms : 0, occupancyTrend: 0.03,
        revenue, revenueTrend: 0.12, outstandingDebt: debt, debtTrend: -0.05,
        operatingCost: cost, costTrend: 0.08,
        revenueHistory,
        alerts: { expiringContracts: expiring, expiredContracts: expiredCount, overdueInvoices: overdue, pendingReadings },
        buildings: bstats,
      };
    },

    /* ---------- Phân tích chi tiết (Tổng quan + trợ lý ảo) ----------
       opts.period     : kỳ cần xem "YYYY-MM" (mặc định: kỳ đang chọn)
       opts.buildingId : chỉ tính 1 tòa (mặc định: toàn công ty)
       opts.months     : số kỳ của chuỗi xu hướng (mặc định 6) */
    dashboardAnalytics(opts) {
      opts = opts || {};
      const per = opts.period || api.period(), prev = api.prevPeriodOf(per);
      const bid = opts.buildingId || null;
      const nMonths = Math.max(2, Math.min(24, opts.months || 6));
      const inB = (x) => !bid || x.buildingId === bid;
      const INV = invoices.filter(inB), TX = transactions.filter(inB), ROOMS = rooms.filter(inB);
      const RD = readings.filter(inB), PAY = payments.filter(inB);
      const BLD = bid ? buildings.filter(b => b.id === bid) : buildings;

      const invPer = (p) => INV.filter(i => i.period === p && i.status !== 'cancelled');
      const paidIn = (p) => invPer(p).reduce((s, i) => s + i.paid, 0);
      const billedIn = (p) => invPer(p).reduce((s, i) => s + i.total, 0);
      const costIn = (p) => TX.filter(t => t.kind === 'expense' && (t.date || '').slice(0, 7) === p)
        .reduce((s, t) => s + t.amount, 0);
      const otherIncomeIn = (p) => TX.filter(t => t.kind === 'income' && (t.date || '').slice(0, 7) === p)
        .reduce((s, t) => s + t.amount, 0);

      // ----- Xu hướng thật (so với kỳ trước) -----
      const rev = paidIn(per), revPrev = paidIn(prev);
      const cost = costIn(per), costPrev = costIn(prev);
      const billed = billedIn(per), billedPrev = billedIn(prev);
      const debt = INV.filter(i => i.status !== 'cancelled' && i.status !== 'draft')
        .reduce((s, i) => s + (i.total - i.paid), 0);
      const debtPrev = invPer(prev).reduce((s, i) => s + (i.total - i.paid), 0);
      const profit = rev + otherIncomeIn(per) - cost;
      const profitPrev = revPrev + otherIncomeIn(prev) - costPrev;
      const trend = (now, before) => (before > 0 ? (now - before) / before : (now > 0 ? 1 : 0));

      // ----- Chuỗi n kỳ: thu vào / chi ra / phát hành -----
      const series = [];
      for (let k = nMonths - 1; k >= 0; k--) {
        const mp = shiftPeriod(per, -k);
        series.push({ period: mp, label: 'T' + Number(mp.split('-')[1]),
          revenue: paidIn(mp), cost: costIn(mp), billed: billedIn(mp),
          invoices: invPer(mp).length });
      }

      // ----- Cơ cấu hóa đơn kỳ này (theo dòng hóa đơn) -----
      const mixMap = { 'Tiền phòng': 0, 'Tiền điện': 0, 'Tiền nước': 0, 'Dịch vụ khác': 0 };
      invPer(per).forEach(i => (i.lines || []).forEach(l => {
        const k = mixMap[l.label] != null ? l.label : 'Dịch vụ khác';
        mixMap[k] += l.amount || 0;
      }));
      const revenueMix = Object.keys(mixMap).map(k => ({ label: k, value: mixMap[k] }));

      // ----- Cơ cấu chi phí kỳ này -----
      const eMap = {};
      TX.filter(t => t.kind === 'expense' && (t.date || '').slice(0, 7) === per)
        .forEach(t => { const c = t.category || 'Chi khác'; eMap[c] = (eMap[c] || 0) + t.amount; });
      const expenseMix = Object.keys(eMap).map(k => ({ label: k, value: eMap[k] }))
        .sort((a, b) => b.value - a.value);

      // ----- Trạng thái phòng (hiện tại) -----
      const cnt = (st) => ROOMS.filter(r => r.status === st).length;
      const roomMix = [
        { label: 'Đang thuê', value: cnt('occupied'), color: '#22c55e' },
        { label: 'Báo trả', value: cnt('notice'), color: '#f59e0b' },
        { label: 'Đã cọc giữ', value: cnt('reserved'), color: '#3b82f6' },
        { label: 'Trống', value: cnt('vacant'), color: '#94a3b8' },
        { label: 'Bảo trì', value: cnt('maintenance'), color: '#ef4444' },
      ].filter(x => x.value > 0);

      // ----- Trạng thái hóa đơn kỳ này -----
      const ist = (st) => INV.filter(i => i.period === per && i.status === st).length;
      const invoiceMix = [
        { label: 'Đã thu đủ', value: ist('paid'), color: '#22c55e' },
        { label: 'Thu một phần', value: ist('partial'), color: '#3b82f6' },
        { label: 'Chờ thu', value: ist('issued'), color: '#f59e0b' },
        { label: 'Quá hạn', value: ist('overdue'), color: '#ef4444' },
        { label: 'Nháp', value: ist('draft'), color: '#94a3b8' },
      ].filter(x => x.value > 0);

      // ----- Tỉ lệ thu theo từng tòa -----
      const byBuilding = BLD.map(b => {
        const iv = INV.filter(i => i.buildingId === b.id && i.period === per && i.status !== 'cancelled' && i.status !== 'draft');
        const t = iv.reduce((s, i) => s + i.total, 0), p = iv.reduce((s, i) => s + i.paid, 0);
        const rs = ROOMS.filter(r => r.buildingId === b.id);
        const occ = rs.filter(r => r.status === 'occupied' || r.status === 'notice').length;
        return { id: b.id, name: b.name, billed: t, collected: p, rooms: rs.length, occupied: occ,
          vacant: rs.filter(r => r.status === 'vacant').length,
          occupancy: rs.length ? occ / rs.length : 0 };
      });

      // ----- Phiếu thu gần đây (bổ sung phòng/khách từ hóa đơn nếu phiếu cũ chưa có) -----
      const recent = PAY.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 6)
        .map(p => {
          if (p.roomCode && p.tenantName) return p;
          const iv = api.invoice(p.invoiceId) || {};
          return Object.assign({}, p, { roomCode: p.roomCode || iv.roomCode, tenantName: p.tenantName || iv.tenantName });
        });

      // ----- Phòng nợ nhiều nhất -----
      const debtMap = {};
      INV.filter(i => i.status !== 'cancelled' && i.status !== 'draft' && i.total > i.paid).forEach(i => {
        const k = i.buildingId + '|' + i.roomCode;
        if (!debtMap[k]) {
          const b = buildings.find(x => x.id === i.buildingId);
          debtMap[k] = { buildingId: i.buildingId, buildingName: (b && b.name) || '',
            roomCode: i.roomCode, tenantName: i.tenantName, amount: 0, n: 0 };
        }
        debtMap[k].amount += i.total - i.paid; debtMap[k].n++;
      });
      const allDebtors = Object.values(debtMap).sort((a, b) => b.amount - a.amount);
      const topDebtors = allDebtors.slice(0, 5);

      // ----- Tiêu thụ điện kỳ này -----
      const rdPer = RD.filter(r => r.period === per);
      const elecKwh = rdPer.reduce((s, r) => s + Math.max(0, api.consumptionOf(r, 'elec') || 0), 0);

      const totalRooms = ROOMS.length;
      const occAll = ROOMS.filter(r => r.status === 'occupied' || r.status === 'notice').length;

      return {
        period: per, prevPeriod: prev, buildingId: bid,
        hasData: invPer(per).length > 0 || rdPer.length > 0 || costIn(per) > 0,
        kpi: {
          revenue: rev, revenueTrend: trend(rev, revPrev), revenuePrev: revPrev,
          billed, billedPrev, collectRate: billed > 0 ? rev / billed : 0,
          collectRatePrev: billedPrev > 0 ? revPrev / billedPrev : 0,
          cost, costTrend: trend(cost, costPrev), costPrev,
          profit, profitTrend: trend(profit, profitPrev), profitPrev,
          debt, debtTrend: trend(debt, debtPrev),
          occupancy: totalRooms ? occAll / totalRooms : 0,
          occupiedRooms: occAll, totalRooms,
          invoices: invPer(per).length, invoicesPrev: invPer(prev).length,
        },
        series, revenueMix, expenseMix, roomMix, invoiceMix, byBuilding,
        recentPayments: recent, topDebtors, allDebtors, debtorCount: allDebtors.length,
        usage: { elecKwh, roomsRead: rdPer.length },
      };
    },

    /* ---------- Đột biến ---------- */
    persist, syncAll,
    async resetData() {
      if (usingBackend()) { await HH.backend.deleteAll(); location.reload(); return; }
      try { localStorage.removeItem(DATA_KEY); } catch (e) {} location.reload();
    },

    // Thêm mới (đẩy vào MẢNG GỐC rồi lưu bền)
    addRoom(r) { rooms.push(r); persist(); return r; },
    updateRoom(bid, code, patch) { const r = api.room(bid, code); if (r) { Object.assign(r, patch); persist(); } return r; },
    addTenant(t) { tenants.push(t); persist(); return t; },
    updateTenant(id, patch) { const t = tenants.find(x => x.id === id); if (t) { Object.assign(t, patch); persist(); } return t; },

    /* ---------- Xe của khách thuê ---------- */
    // Trả về mảng xe chuẩn hóa (tương thích dữ liệu cũ chỉ có vehiclePlate)
    vehiclesOf(t) {
      if (!t) return [];
      if (Array.isArray(t.vehicles) && t.vehicles.length) return t.vehicles;
      if (t.vehiclePlate) return [{ plate: t.vehiclePlate, type: 'Xe máy', brand: '', color: '', note: '' }];
      return [];
    },
    addVehicle(tenantId, v) {
      const t = api.tenantById(tenantId); if (!t) return null;
      const list = api.vehiclesOf(t).slice();
      list.push(Object.assign({ plate: '', type: 'Xe máy', brand: '', color: '', note: '' }, v));
      t.vehicles = list; t.vehiclePlate = list[0] ? list[0].plate : null;
      api.log('vehicle.add', `Thêm xe ${v.plate} cho ${t.fullName}`);
      persist(); return list;
    },
    updateVehicle(tenantId, idx, v) {
      const t = api.tenantById(tenantId); if (!t) return null;
      const list = api.vehiclesOf(t).slice();
      if (!list[idx]) return null;
      list[idx] = Object.assign({}, list[idx], v);
      t.vehicles = list; t.vehiclePlate = list[0] ? list[0].plate : null;
      persist(); return list;
    },
    removeVehicle(tenantId, idx) {
      const t = api.tenantById(tenantId); if (!t) return null;
      const list = api.vehiclesOf(t).slice();
      const gone = list.splice(idx, 1)[0];
      t.vehicles = list; t.vehiclePlate = list[0] ? list[0].plate : null;
      if (gone) api.log('vehicle.remove', `Xóa xe ${gone.plate} của ${t.fullName}`);
      persist(); return list;
    },
    // Tất cả xe trong tòa nhà (để thống kê/tra cứu)
    vehiclesOfBuilding(bid) {
      const out = [];
      tenants.filter(t => t.buildingId === bid).forEach(t =>
        api.vehiclesOf(t).forEach((v, i) => out.push(Object.assign({}, v, {
          tenantId: t.id, tenantName: t.fullName, roomCode: t.roomCode, index: i }))));
      return out;
    },
    removeTenant(id) {
      const i = tenants.findIndex(x => x.id === id);
      if (i >= 0) { const t = tenants[i]; tenants.splice(i, 1); api.log('tenant.remove', `Xóa khách thuê ${t.fullName}`); persist();
        if (usingBackend()) HH.backend.deleteOne('tenants', id); }
    },
    addContract(c) { contracts.push(c); persist(); return c; },
    updateContract(id, patch) { const c = contracts.find(x => x.id === id); if (c) { Object.assign(c, patch); persist(); } return c; },

    /* ---------- Hợp đồng: hạn & nhắc nhở ---------- */
    // Số ngày còn lại (âm = đã quá hạn). null nếu không có ngày kết thúc.
    daysToExpiry(c) { return (c && c.end) ? U.daysBetween(U.today(), c.end) : null; },
    // Tình trạng hạn: 'expired' | 'urgent' (≤7n) | 'soon' (≤30n) | 'watch' (≤60n) | 'ok'
    expiryLevel(c) {
      if (!c || c.status === 'terminated' || !c.end) return 'ok';
      const d = api.daysToExpiry(c);
      if (d < 0) return 'expired';
      if (d <= 7) return 'urgent';
      if (d <= 30) return 'soon';
      if (d <= 60) return 'watch';
      return 'ok';
    },
    // Hợp đồng cần nhắc (mọi tòa hoặc 1 tòa): quá hạn + sắp hết hạn trong `days` ngày
    expiringContracts(bid, days) {
      days = days == null ? 30 : days;
      return contracts.filter(c => {
        // gồm cả hợp đồng đã quá hạn (status 'expired') vì đây là nhóm cần xử lý gấp nhất
        if (c.status !== 'active' && c.status !== 'terminating' && c.status !== 'expired') return false;
        if (bid && c.buildingId !== bid) return false;
        const d = api.daysToExpiry(c);
        return d != null && d <= days;
      }).sort((a, b) => api.daysToExpiry(a) - api.daysToExpiry(b));
    },
    // Cập nhật cờ expiringSoon cho toàn bộ hợp đồng (gọi sau khi nạp dữ liệu)
    refreshExpiryFlags() {
      let changed = false;
      contracts.forEach(c => {
        const lvl = api.expiryLevel(c);
        const soon = (lvl === 'soon' || lvl === 'urgent');
        if (c.expiringSoon !== soon) { c.expiringSoon = soon; changed = true; }
        if (lvl === 'expired' && c.status === 'active') { c.status = 'expired'; changed = true; }
      });
      return changed;
    },
    // Gia hạn hợp đồng thêm N tháng
    renewContract(id, months, newRent) {
      const c = contracts.find(x => x.id === id); if (!c) return null;
      const base = new Date(c.end) > U.today() ? new Date(c.end) : U.today();
      c.end = U.addMonths(base, months).toISOString();
      c.status = 'active';
      if (newRent) c.rent = newRent;
      c.renewCount = (c.renewCount || 0) + 1;
      c.renewedAt = new Date().toISOString();
      api.refreshExpiryFlags();
      const room = api.room(c.buildingId, c.roomCode);
      if (room) room.contractEnd = c.end;
      api.log('contract.renew', `Gia hạn hợp đồng ${c.roomCode} thêm ${months} tháng → ${U.fmtDate(c.end)}`);
      persist();
      return c;
    },
    addAsset(a) { assets.push(a); persist(); return a; },

    /* ---------- Kho tài sản (mỗi tòa một kho) ----------
       Mỗi dòng assets là "một loại tài sản đang ở một chỗ": roomCode rỗng là
       trong kho, có roomCode là đang ở phòng đó. Cùng tên thì cùng giá. */
    assetKindRows: (bid, name) => assets.filter(a => a.buildingId === bid
      && (a.name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase()),

    // Nhập thêm vào kho (gộp vào dòng kho sẵn có, chưa có thì tạo mới)
    stockAsset(bid, item) {
      const rows = api.assetKindRows(bid, item.name);
      const inStock = rows.find(a => !a.roomCode);
      if (inStock) inStock.quantity = (inStock.quantity || 0) + (item.quantity || 1);
      else assets.push(Object.assign({
        id: U.uid('TS').toUpperCase(), buildingId: bid, roomCode: null, condition: 'good',
        unit: 'Cái', lifeMonths: 60, buyDate: U.today().toISOString(), quantity: 1,
      }, item));
      // cùng tên thì cùng giá, cùng hình, cùng đơn vị
      api.assetKindRows(bid, item.name).forEach(a => {
        if (item.buyPrice) a.buyPrice = item.buyPrice;
        if (item.icon) a.icon = item.icon;
        if (item.unit) a.unit = item.unit;
        if (item.lifeMonths) a.lifeMonths = item.lifeMonths;
      });
      persist();
    },

    // Chuyển số lượng giữa kho (null) và phòng
    moveAssetQty(bid, name, from, to, qty) {
      qty = Math.max(1, Math.round(qty || 0));
      const rows = api.assetKindRows(bid, name);
      const sample = rows[0];
      if (!sample) return { ok: false };
      const src = rows.filter(a => (a.roomCode || null) === (from || null));
      if (src.reduce((s, a) => s + (a.quantity || 0), 0) < qty) return { ok: false };
      let left = qty;
      src.forEach(a => { if (left <= 0) return; const take = Math.min(left, a.quantity || 0); a.quantity -= take; left -= take; });
      const dst = rows.find(a => (a.roomCode || null) === (to || null));
      if (dst) dst.quantity = (dst.quantity || 0) + qty;
      else assets.push({ id: U.uid('TS').toUpperCase(), buildingId: bid, roomCode: to || null,
        icon: sample.icon, name: sample.name, buyPrice: sample.buyPrice || 0,
        buyDate: sample.buyDate || U.today().toISOString(), lifeMonths: sample.lifeMonths || 60,
        condition: 'good', quantity: qty, unit: sample.unit || 'Cái' });
      // dọn các dòng còn 0 món
      for (let i = assets.length - 1; i >= 0; i--) {
        if (assets[i].buildingId === bid && (assets[i].quantity || 0) <= 0) {
          const id = assets[i].id; assets.splice(i, 1);
          if (usingBackend()) HH.backend.deleteOne('assets', id);
        }
      }
      persist();
      return { ok: true };
    },

    // Sửa tên / giá / hình cho MỌI món cùng tên
    updateAssetKind(bid, name, patch) { api.assetKindRows(bid, name).forEach(a => Object.assign(a, patch)); persist(); },
    removeAssetKind(bid, name) { api.assetKindRows(bid, name).map(a => a.id).forEach(id => api.removeAsset(id)); },
    asset: (id) => assets.find(a => a.id === id),
    updateAsset(id, patch) { const a = assets.find(x => x.id === id); if (a) { Object.assign(a, patch); persist(); } return a; },
    removeAsset(id) {
      const i = assets.findIndex(x => x.id === id);
      if (i >= 0) { const a = assets[i]; assets.splice(i, 1); api.log('asset.remove', `Xóa tài sản ${a.name}`); persist();
        if (usingBackend()) HH.backend.deleteOne('assets', id); }
    },
    addBuilding(b) { buildings.push(b); persist(); return b; },
    updateBuilding(id, patch) { const b = buildings.find(x => x.id === id); if (b) { Object.assign(b, patch); persist(); } return b; },
    // Xóa tòa nhà + toàn bộ dữ liệu liên quan
    async removeBuilding(id) {
      const b = buildings.find(x => x.id === id); if (!b) return;
      const scoped = [rooms, tenants, contracts, services, readings, invoices, assets, incidents, transactions];
      scoped.forEach(arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].buildingId === id) arr.splice(i, 1); });
      for (let i = payments.length - 1; i >= 0; i--) if (payments[i].buildingId === id) payments.splice(i, 1);
      const bi = buildings.findIndex(x => x.id === id); if (bi >= 0) buildings.splice(bi, 1);
      api.log('building.remove', `Xóa tòa nhà ${b.name}`);
      if (usingBackend()) await HH.backend.deleteByBuilding(id);
      persist();
    },

    // Tiêu thụ thực tế của 1 kỳ: (chỉ số này - chỉ số trước) + phần bù (quay vòng / thay đồng hồ)
    consumptionOf(rd, kind) {
      if (!rd) return null;
      const curr = rd[kind + 'Curr'], prev = rd[kind + 'Prev'];
      if (curr == null || prev == null) return null;
      return Math.max(0, curr - prev) + (rd[kind + 'Extra'] || 0);
    },

    // ----- Ghi chỉ số theo kỳ: lấy hoặc tạo bản ghi cho (phòng, kỳ) -----
    readingFor(bid, code, period) {
      let rd = readings.find(r => r.buildingId === bid && r.roomCode === code && r.period === period);
      if (rd) return rd;
      const prev = readings.find(r => r.buildingId === bid && r.roomCode === code && r.period === api.prevPeriodOf(period));
      rd = { id: U.uid('rd'), buildingId: bid, roomCode: code, period,
        elecPrev: prev ? (prev.elecCurr != null ? prev.elecCurr : prev.elecPrev) : 0,
        elecCurr: null, elecPhoto: false,
        elecAvg: prev ? prev.elecAvg || 190 : 190, source: 'staff', approved: true };
      readings.push(rd);
      return rd;
    },

    // ----- Sinh hóa đơn thật cho kỳ đang chọn -----
    generateInvoices(bid, period) {
      const svcs = services.filter(s => s.buildingId === bid);
      const cs = contracts.filter(c => c.buildingId === bid && (c.status === 'active' || c.status === 'terminating'));
      const created = [], skipped = [];
      cs.forEach(c => {
        if (invoices.find(i => i.buildingId === bid && i.contractId === c.id && i.period === period)) return;
        const rd = readings.find(r => r.buildingId === bid && r.roomCode === c.roomCode && r.period === period);
        if (!rd || rd.elecCurr == null) { skipped.push(c.roomCode); return; }
        const inv = runtimeInvoice(bid, c, rd, period, svcs);
        invoices.push(inv); created.push(inv); // đẩy ngay để mã HĐ kế tiếp tăng đúng
      });
      if (created.length) { api.log('invoice.generate', `Sinh ${created.length} hóa đơn kỳ ${api.periodLabel(period)}`); persist(); }
      return { created, skipped };
    },
    transactionsOf: (bid) => transactions.filter(t => t.buildingId === bid),
    addTransaction(t) { transactions.push(t); persist(); return t; },
    removeTransaction(id) { const i = transactions.findIndex(x => x.id === id); if (i >= 0) { transactions.splice(i, 1); persist();
      if (usingBackend()) HH.backend.deleteOne('transactions', id); } },
    paymentsAll: () => payments.slice(),
    addIncident(x) { incidents.push(x); persist(); return x; },
    addService(s) { services.push(s); persist(); return s; },
    updateService(id, patch) { const s = services.find(x => x.id === id); if (s) { Object.assign(s, patch); persist(); } return s; },
    removeService(id) { const i = services.findIndex(x => x.id === id); if (i >= 0) { const s = services[i]; services.splice(i, 1); persist(); api.log('service.remove', `Xóa dịch vụ ${s.name}`);
      if (usingBackend()) HH.backend.deleteOne('services', id); } },

    setRoomStatus(bid, code, status, reason) {
      const r = api.room(bid, code);
      if (!r) return;
      const old = r.status; r.status = status;
      api.log('room.status', `Đổi trạng thái phòng ${code}: ${old} → ${status}`, reason);
      persist();
    },
    cancelInvoice(id, reason) {
      const inv = api.invoice(id); if (!inv) return;
      inv.status = 'cancelled';
      api.log('invoice.cancel', `Hủy hóa đơn ${id}`, reason);
      persist();
    },
    /* ---------- THU TIỀN ---------- */
    // Sinh số phiếu thu: PT-YYMM-NNN
    nextReceiptNo(date) {
      const d = date ? new Date(date) : new Date();
      const pre = `PT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
      const n = payments.filter(p => (p.receiptNo || '').startsWith(pre)).length + 1;
      return `${pre}-${String(n).padStart(3, '0')}`;
    },
    // Ghi nhận 1 khoản thu cho 1 hóa đơn; trả về phiếu thu vừa tạo
    recordPayment(invId, amount, method, date, note, receiptNo) {
      const inv = api.invoice(invId); if (!inv) return null;
      const before = inv.paid;
      inv.paid = Math.min(inv.total, inv.paid + amount);
      inv.status = inv.paid >= inv.total ? 'paid' : 'partial';
      const p = { id: U.uid('pm'), receiptNo: receiptNo || api.nextReceiptNo(date),
        invoiceId: invId, buildingId: inv.buildingId, contractId: inv.contractId,
        roomCode: inv.roomCode, tenantName: inv.tenantName,
        date, method, amount: inv.paid - before, note, createdBy: prefs.userName,
        createdAt: new Date().toISOString() };
      payments.push(p);
      api.log('payment.record', `Thu ${U.currency(p.amount)} cho ${invId} (${p.receiptNo})`);
      persist();
      return p;
    },
    // Hoàn tác phiếu thu (ghi nhầm) — trả lại công nợ cho hóa đơn
    deletePayment(payId, reason) {
      const i = payments.findIndex(p => p.id === payId); if (i < 0) return;
      const p = payments[i];
      const inv = api.invoice(p.invoiceId);
      if (inv) {
        inv.paid = Math.max(0, inv.paid - p.amount);
        inv.status = inv.paid <= 0 ? (api.isOverdue(inv) ? 'overdue' : 'issued')
          : (inv.paid >= inv.total ? 'paid' : 'partial');
      }
      payments.splice(i, 1);
      api.log('payment.delete', `Hủy phiếu thu ${p.receiptNo || p.id} (${U.currency(p.amount)})`, reason);
      persist();
      if (usingBackend()) HH.backend.deleteOne('payments', payId);
    },
    /* ============================================================
       ĐỐI SOÁT NGÂN HÀNG — tự động xóa công nợ khi tiền về
       ------------------------------------------------------------
       Một giao dịch ngân hàng chỉ có 3 thứ: SỐ TIỀN, NỘI DUNG, NGÀY.
       Muốn tự động thì NỘI DUNG phải nhận ra được hóa đơn. App sinh sẵn
       nội dung dạng "HD2608013" trong mã VietQR nên khách chỉ cần quét là đúng.
       Nếu khách gõ tay thì vẫn dò được theo mã phòng + kỳ.
       ============================================================ */
    bankTx,
    // Chuẩn hóa nội dung chuyển khoản: bỏ dấu, viết hoa, bỏ ký tự lạ
    normContent(s) {
      return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    },
    // Nội dung nên dùng cho 1 hóa đơn (đưa vào VietQR / hướng dẫn khách)
    transferContent(inv) { return inv ? String(inv.id).replace(/[^A-Za-z0-9]/g, '') : ''; },

    /** Dò 1 giao dịch về đúng hóa đơn.
     *  Trả về { status, invoice, reason, candidates } —
     *  status: 'matched' (chắc chắn) | 'ambiguous' (nhiều khả năng) | 'unmatched' */
    matchTransfer(tx) {
      const content = api.normContent(tx.content);
      const amount = Math.round(+tx.amount || 0);
      const open = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'draft' && i.total > i.paid);
      if (!open.length) return { status: 'unmatched', reason: 'Không còn hóa đơn nào chưa thu' };

      // 1) Khớp thẳng mã hóa đơn (chắc chắn nhất) — "HD2608013"
      const byId = open.find(i => content.includes(api.transferContent(i).toUpperCase()));
      if (byId) return { status: 'matched', invoice: byId, reason: 'Khớp mã hóa đơn trong nội dung' };

      // 2) Khớp mã phòng (+ kỳ nếu có) — "P405 T8 2026", "P405082026"
      const codes = new Set(open.map(i => (i.roomCode || '').toUpperCase()).filter(Boolean));
      const hit = [...codes].filter(c => new RegExp('(^| )' + c + '($| |[0-9])').test(content));
      if (hit.length === 1) {
        let list = open.filter(i => (i.roomCode || '').toUpperCase() === hit[0]);
        // Có nói rõ kỳ nào không? chấp nhận T8, 082026, 2026 08, 2608
        const per = list.find(i => {
          const [y, m] = i.period.split('-');
          const forms = ['T' + Number(m), m + y, y + ' ' + m, y.slice(2) + m];
          return forms.some(f => content.replace(/ /g, '').includes(f.replace(/ /g, '')));
        });
        if (per) list = [per];
        if (list.length === 1) return { status: 'matched', invoice: list[0],
          reason: per ? 'Khớp mã phòng và kỳ' : 'Khớp mã phòng, chỉ còn 1 hóa đơn chưa thu' };
        // nhiều hóa đơn của cùng phòng -> ưu tiên cái khớp đúng số tiền
        const exact = list.filter(i => i.total - i.paid === amount);
        if (exact.length === 1) return { status: 'matched', invoice: exact[0], reason: 'Khớp mã phòng và số tiền' };
        // không rõ kỳ -> trả cũ nhất trước (đúng nguyên tắc phân bổ)
        const oldest = list.slice().sort((a, b) => a.period.localeCompare(b.period))[0];
        return { status: 'ambiguous', invoice: oldest, candidates: list,
          reason: `Phòng ${hit[0]} còn ${list.length} hóa đơn chưa thu, cần chọn kỳ` };
      }
      if (hit.length > 1) return { status: 'ambiguous', candidates: open.filter(i => hit.includes((i.roomCode || '').toUpperCase())),
        reason: 'Nội dung nhắc tới nhiều phòng' };

      // 3) Không có mã nào — thử khớp duy nhất theo số tiền
      const byAmount = open.filter(i => i.total - i.paid === amount);
      if (byAmount.length === 1) return { status: 'matched', invoice: byAmount[0],
        reason: 'Chỉ có đúng 1 hóa đơn có số tiền này' };
      if (byAmount.length > 1) return { status: 'ambiguous', candidates: byAmount,
        reason: `${byAmount.length} hóa đơn cùng số tiền, không rõ của ai` };

      return { status: 'unmatched', reason: 'Nội dung không có mã phòng/mã hóa đơn' };
    },

    /** Ghi thu cho 1 giao dịch đã khớp. Chống ghi trùng bằng mã giao dịch ngân hàng. */
    applyTransfer(tx, invoiceId) {
      const ref = tx.ref || tx.id;
      if (ref && payments.some(p => p.bankRef === ref)) return { skipped: true, reason: 'Giao dịch này đã ghi thu rồi' };
      const inv = api.invoice(invoiceId || (tx.invoiceId));
      if (!inv) return { skipped: true, reason: 'Không tìm thấy hóa đơn' };
      const remain = inv.total - inv.paid;
      if (remain <= 0) return { skipped: true, reason: 'Hóa đơn đã thu đủ' };
      const amount = Math.min(remain, Math.round(+tx.amount || 0));
      if (amount <= 0) return { skipped: true, reason: 'Số tiền không hợp lệ' };
      const p = api.recordPayment(inv.id, amount, 'Chuyển khoản',
        tx.date || new Date().toISOString(), tx.content || 'Đối soát tự động từ ngân hàng');
      if (p) { p.bankRef = ref || null; p.auto = true; persist(); }
      return { payment: p, invoice: inv, over: Math.max(0, Math.round(+tx.amount || 0) - amount) };
    },

    /** Quét các giao dịch ngân hàng chưa xử lý và tự ghi thu những cái khớp chắc chắn.
     *  Chạy khi mở app (nếu chủ trọ đã bật) hoặc bấm tay ở trang Đối soát. */
    autoReconcile(opts) {
      opts = opts || {};
      const out = { done: [], review: [], skipped: [] };
      bankTx.filter(t => !t.handled && (+t.amount > 0)).forEach(t => {
        const m = api.matchTransfer(t);
        if (m.status !== 'matched') { t.matchNote = m.reason; out.review.push({ tx: t, match: m }); return; }
        if (opts.dryRun) { out.done.push({ tx: t, match: m }); return; }
        const r = api.applyTransfer(t, m.invoice.id);
        if (r.payment) {
          t.handled = true; t.invoiceId = m.invoice.id; t.paymentId = r.payment.id; t.matchNote = m.reason;
          api.log('bank.auto', `Tự động ghi thu ${U.currency(r.payment.amount)} cho ${m.invoice.id} (${m.reason})`);
          out.done.push({ tx: t, match: m, payment: r.payment });
        } else { t.matchNote = r.reason; out.skipped.push({ tx: t, reason: r.reason }); }
      });
      if (!opts.dryRun && (out.done.length || out.review.length)) persist();
      return out;
    },

    addBankTx(t) {
      const ref = t.ref || t.id;
      if (ref && bankTx.some(x => (x.ref || x.id) === ref)) return null;   // đã có
      const row = Object.assign({ id: U.uid('bt'), handled: false, createdAt: new Date().toISOString() }, t);
      bankTx.push(row); persist(); return row;
    },
    removeBankTx(id) {
      const i = bankTx.findIndex(x => x.id === id);
      if (i >= 0) { bankTx.splice(i, 1); persist(); if (usingBackend()) HH.backend.deleteOne('bankTx', id); }
    },
    unhandledBankTx: () => bankTx.filter(t => !t.handled),

    /** Đọc sao kê dán vào (CSV hoặc văn bản thô, mỗi dòng 1 giao dịch).
     *  Quan trọng: KHÔNG được nhầm mã hóa đơn "HD2608013" hay mã phòng "P102"
     *  là số tiền — nếu nhầm thì mất luôn thông tin để dò. Vì vậy chỉ coi là
     *  số tiền khi cả cụm chữ đó là số (có dấu phân cách nghìn hoặc ≥ 4 chữ số). */
    parseStatement(text) {
      const out = [];
      // Số có phân cách nghìn, hoặc số trần ≥ 5 chữ số (để "2026" còn nằm lại
      // trong nội dung mà dò kỳ, chứ không bị hiểu nhầm là số tiền).
      const isAmountToken = (tk) => /^\d{1,3}([.,]\d{3})+$/.test(tk) || /^\d{5,}$/.test(tk);
      const isDateToken = (tk) => /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(tk) || /^\d{4}-\d{2}-\d{2}$/.test(tk);

      String(text || '').split(/\r?\n/).forEach((line, idx) => {
        const raw = line.trim();
        if (!raw || /^(ngay|ngày|date|stt|no\b|so du|số dư)/i.test(raw)) return;   // bỏ dòng tiêu đề

        const tokens = raw.split(/[\s;,\t|]+/).filter(Boolean);
        let amount = 0, date = null;
        const rest = [];
        tokens.forEach(tk => {
          // bỏ dấu +/- và đuôi tiền tệ dính vào ("3.943.000VND")
          const clean = tk.replace(/^[+\-]/, '').replace(/(vnd|vnđ|đ|d)$/i, '');
          if (isDateToken(clean)) {
            const a = clean.split(/[/-]/).map(Number);
            date = clean.includes('-') && clean.indexOf('-') === 4
              ? new Date(a[0], a[1] - 1, a[2]).toISOString()
              : new Date(a[2], a[1] - 1, a[0]).toISOString();
            return;
          }
          if (isAmountToken(clean)) {
            const n = Math.round(U.parseNum(clean));
            if (n >= 1000) { amount = Math.max(amount, n); return; }   // là số tiền -> bỏ khỏi nội dung
          }
          rest.push(tk);                                              // giữ nguyên để còn dò mã
        });
        if (amount < 1000) return;                                    // dòng không có số tiền -> bỏ qua

        const content = rest.join(' ').replace(/\s+/g, ' ').trim();
        out.push({ ref: 'paste-' + Date.now() + '-' + idx, amount,
          date: date || new Date().toISOString(), content, source: 'paste' });
      });
      return out;
    },

    isOverdue(inv) { return inv && inv.dueDate && U.daysBetween(U.today(), inv.dueDate) < 0 && (inv.total - inv.paid) > 0; },
    // Cập nhật trạng thái quá hạn theo ngày hiện tại
    refreshInvoiceStatus() {
      let changed = false;
      invoices.forEach(i => {
        if (i.status === 'cancelled' || i.status === 'draft' || i.status === 'paid') return;
        const should = api.isOverdue(i) ? 'overdue' : (i.paid > 0 ? 'partial' : 'issued');
        if (i.status !== should) { i.status = should; changed = true; }
      });
      return changed;
    },
    paymentsOfBuilding: (bid, period) => payments.filter(p =>
      p.buildingId === bid && (!period || (p.date || '').slice(0, 7) === period)),
    payment: (id) => payments.find(p => p.id === id),

    issueInvoices(ids) {
      let n = 0;
      ids.forEach(id => { const i = api.invoice(id);
        if (i && (i.status === 'draft')) { i.status = api.isOverdue(i) ? 'overdue' : 'issued'; n++; } });
      api.log('invoice.issue', `Phát hành ${n} hóa đơn`);
      persist();
      return n;
    },
    log(action, message, reason) {
      auditLog.unshift({ id: U.uid('lg'), at: new Date().toISOString(),
        actor: prefs.userName, action, message, reason: reason || null });
    },
  };
  api.prefs = prefs;
  return api;
})();

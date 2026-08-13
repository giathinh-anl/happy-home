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
            { id: 'ML-' + String(100 + seq).slice(1), buildingId: b.id, roomCode: code, name: 'Máy lạnh',
              buyPrice: 8000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good' },
            { id: 'TL-' + String(100 + seq).slice(1), buildingId: b.id, roomCode: code, name: 'Tủ lạnh',
              buyPrice: 5000000, buyDate: '2024-06-01', lifeMonths: 60, condition: 'good' },
          );

          // chỉ số kỳ trước (đã có) + kỳ này (một phần)
          const elecPrev = 8000 + seq * 210;
          const waterPrev = 40 + seq * 3;
          const hasCurrent = !((bi === 0) && (n % 4 === 0)); // vài phòng tòa 1 chưa ghi -> "18/24"
          const elecUse = 150 + (seq * 37) % 120;
          const waterUse = 3 + (seq % 4);
          const reading = {
            buildingId: b.id, roomCode: code, period: CUR_PERIOD,
            elecPrev, elecCurr: hasCurrent ? elecPrev + elecUse : null,
            waterPrev, waterCurr: hasCurrent ? waterPrev + waterUse : null,
            elecPhoto: hasCurrent, waterPhoto: hasCurrent,
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
        date: new Date(y, m, 3).toISOString(), method: 'Chuyển khoản', amount: paid,
        note: `${room.code} ${period}`,
      });
    }
    return inv;
  }

  /* ---------- Trạng thái ứng dụng ---------- */
  const PREFS_KEY = 'hh_prefs_v1';
  const defaultPrefs = { auth: false, role: 'owner', userName: 'Nguyễn Văn A',
    period: CUR_PERIOD, roomView: 'map' };
  let prefs = Object.assign({}, defaultPrefs);
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY)); if (p) prefs = Object.assign(prefs, p); } catch (e) {}
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} }

  /* ---------- Truy vấn ---------- */
  const api = {
    ROOM_TYPES, CUR_PERIOD, PREV_PERIOD,
    prefs,
    setPref(k, v) { prefs[k] = v; savePrefs(); },
    login(role) { prefs.auth = true; prefs.role = role || 'owner';
      prefs.userName = role === 'staff' ? 'Trần Thị Vận Hành' : 'Nguyễn Văn A'; savePrefs(); },
    logout() { prefs.auth = false; savePrefs(); },
    isOwner() { return prefs.role === 'owner'; },

    buildings, services, assets, auditLog, incidents,
    incidentsOf: (bid) => incidents.filter(x => x.buildingId === bid && x.status !== 'done'),
    building: (id) => buildings.find(b => b.id === id),

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

    /* ---------- Tổng hợp dashboard ---------- */
    dashboardSummary() {
      const bstats = buildings.map(b => {
        const rs = rooms.filter(r => r.buildingId === b.id);
        const occ = rs.filter(r => r.status === 'occupied' || r.status === 'notice').length;
        const invs = invoices.filter(i => i.buildingId === b.id && i.period === CUR_PERIOD);
        const revenue = invs.reduce((s, i) => s + i.paid, 0);
        const debt = invoices.filter(i => i.buildingId === b.id).reduce((s, i) => s + (i.total - i.paid), 0);
        return { id: b.id, name: b.name, unitCount: rs.length,
          occupancyRate: occ / rs.length, revenue, debt };
      });
      const totalRooms = rooms.length;
      const occ = rooms.filter(r => r.status === 'occupied' || r.status === 'notice').length;
      const revenue = bstats.reduce((s, x) => s + x.revenue, 0);
      const debt = bstats.reduce((s, x) => s + x.debt, 0);
      const overdue = invoices.filter(i => i.status === 'overdue').length;
      const expiring = contracts.filter(c => c.expiringSoon).length;
      const pendingReadings = rooms.filter(r =>
        (r.status === 'occupied' || r.status === 'notice')).length -
        readings.filter(r => r.period === CUR_PERIOD && r.elecCurr != null).length;
      return {
        occupancyRate: occ / totalRooms, occupancyTrend: 0.03,
        revenue, revenueTrend: 0.12, outstandingDebt: debt, debtTrend: -0.05,
        operatingCost: 12100000, costTrend: 0.08,
        revenueHistory: [
          { period: 'T3', amount: Math.round(revenue * 0.83) }, { period: 'T4', amount: Math.round(revenue * 0.86) },
          { period: 'T5', amount: Math.round(revenue * 0.9) }, { period: 'T6', amount: Math.round(revenue * 0.93) },
          { period: 'T7', amount: Math.round(revenue * 0.96) }, { period: 'T8', amount: revenue },
        ],
        alerts: { expiringContracts: expiring || 3, overdueInvoices: overdue, pendingReadings: Math.max(pendingReadings, 0) },
        buildings: bstats,
      };
    },

    /* ---------- Đột biến ---------- */
    setRoomStatus(bid, code, status, reason) {
      const r = api.room(bid, code);
      if (!r) return;
      const old = r.status; r.status = status;
      api.log('room.status', `Đổi trạng thái phòng ${code}: ${old} → ${status}`, reason);
    },
    cancelInvoice(id, reason) {
      const inv = api.invoice(id); if (!inv) return;
      inv.status = 'cancelled';
      api.log('invoice.cancel', `Hủy hóa đơn ${id}`, reason);
    },
    recordPayment(invId, amount, method, date, note) {
      const inv = api.invoice(invId); if (!inv) return;
      inv.paid = Math.min(inv.total, inv.paid + amount);
      inv.status = inv.paid >= inv.total ? 'paid' : 'partial';
      payments.push({ id: U.uid('pm'), invoiceId: invId, buildingId: inv.buildingId,
        contractId: inv.contractId, date, method, amount, note });
      api.log('payment.record', `Ghi nhận thanh toán ${U.currency(amount)} cho ${invId}`);
    },
    issueInvoices(ids) {
      ids.forEach(id => { const i = api.invoice(id); if (i && i.status === 'draft') i.status = 'issued'; });
      api.log('invoice.issue', `Phát hành ${ids.length} hóa đơn`);
    },
    log(action, message, reason) {
      auditLog.unshift({ id: U.uid('lg'), at: new Date().toISOString(),
        actor: prefs.userName, action, message, reason: reason || null });
    },
  };
  api.prefs = prefs;
  return api;
})();

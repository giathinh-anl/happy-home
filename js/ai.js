/* ============================================================
   Happy Home — Trợ lý AI cho CHỦ TRỌ / NHÂN VIÊN (web quản trị)
   ------------------------------------------------------------
   Kiến trúc lai (rẻ + chính xác):
     Tầng 1 — LUẬT TỪ KHÓA: câu hỏi hay gặp được nhận diện bằng từ khóa,
              code truy vấn dữ liệu thật rồi ghép vào câu mẫu. Miễn phí, tức thì.
     Tầng 2 — GEMINI FLASH: chỉ khi Tầng 1 không nhận ra ý định.
              (a) mô hình phân loại ý định  -> chỉ trả JSON, không có số
              (b) code lấy số thật từ HH.store
              (c) mô hình soạn lời văn TỪ số thật đó
     Tầng 3 — TRẢ LỜI TRUNG THỰC: chưa hỗ trợ, gợi ý màn hình liên quan.

   Trợ lý CHỈ ĐỌC dữ liệu. Không sửa hóa đơn, không ghi thu, không xóa.
   Phạm vi dữ liệu luôn giới hạn theo quyền của người đang đăng nhập.
   ============================================================ */
HH.ai = (function () {
  const U = HH.util, S = HH.store;
  const G = () => window.HHGemini;

  const norm = (s) => (s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
  const has = (t, arr) => arr.some(k => t.includes(k));
  const money = (n) => U.currency(n || 0);
  const pct = (n) => U.percent(n || 0);

  /* Chỉ trả về những tòa nhà người dùng được xem */
  const myBuildings = () => S.buildings;
  const firstBid = () => (myBuildings()[0] || {}).id || '';

  /* ---------- Trích tên phòng trong câu hỏi: "phòng p101", "P.204", "204" ---------- */
  function findRoom(text) {
    const t = (text || '').toUpperCase();
    for (const b of myBuildings()) {
      for (const r of S.roomsOf(b.id)) {
        const code = r.code.toUpperCase();
        if (t.includes(code)) return { room: r, building: b };
      }
    }
    const m = t.match(/\b([A-Z]?\s?\d{3,4})\b/);
    if (m) {
      const want = m[1].replace(/\s/g, '');
      for (const b of myBuildings()) {
        const r = S.roomsOf(b.id).find(x => x.code.toUpperCase().replace(/[^A-Z0-9]/g, '').endsWith(want));
        if (r) return { room: r, building: b };
      }
    }
    return null;
  }

  function findTenant(text) {
    const t = norm(text);
    let best = null;
    myBuildings().forEach(b => S.tenantsOf(b.id).forEach(x => {
      const n = norm(x.fullName);
      if (!n) return;
      if (t.includes(n)) { if (!best || n.length > norm(best.fullName).length) best = x; return; }
      // khớp theo số điện thoại
      if (x.phone && t.replace(/\D/g, '').includes(x.phone.replace(/\D/g, '')) && x.phone.length >= 9) best = best || x;
    }));
    return best;
  }

  const ROOM_ST = { occupied: 'đang cho thuê', vacant: 'còn trống', reserved: 'đã có khách cọc giữ',
    notice: 'khách đã báo trả', maintenance: 'đang bảo trì' };

  /* ============================================================
     BỘ Ý ĐỊNH — mỗi ý định tự lấy SỐ THẬT rồi trả về { facts, html }
     `facts` là dữ liệu thô đưa cho Gemini soạn lời (không bao giờ để mô hình tự nghĩ số).
     ============================================================ */
  const I = {};

  I.revenue = {
    desc: 'Doanh thu / tiền đã thu được trong kỳ',
    kw: ['doanh thu', 'thu duoc bao nhieu', 'tien thu', 'da thu bao nhieu', 'thu bao nhieu', 'tong thu'],
    run() {
      const a = S.dashboardAnalytics(), k = a.kpi;
      const facts = { kỳ: S.periodLabel(a.period), đã_thu: money(k.revenue), đã_phát_hành: money(k.billed),
        còn_phải_thu: money(Math.max(0, k.billed - k.revenue)), tỷ_lệ_thu: pct(k.collectRate),
        so_với_kỳ_trước: (k.revenueTrend >= 0 ? '+' : '') + pct(k.revenueTrend) };
      return { facts, html: `Kỳ <b>${S.periodLabel(a.period)}</b> đã thu <b>${money(k.revenue)}</b>
        trên tổng phát hành ${money(k.billed)} (đạt <b>${pct(k.collectRate)}</b>).<br>
        Còn phải thu: <b>${money(Math.max(0, k.billed - k.revenue))}</b>.`,
        actions: [{ label: 'Xem hóa đơn', go: `#/b/${firstBid()}/invoices` }] };
    },
  };

  I.debt = {
    desc: 'Tổng công nợ, ai còn nợ, phòng nào nợ nhiều nhất',
    kw: ['cong no', 'con no', 'no bao nhieu', 'ai no', 'no nhieu nhat', 'chua dong tien', 'chua thanh toan'],
    run() {
      const a = S.dashboardAnalytics();
      const top = a.topDebtors;
      const facts = { tổng_công_nợ: money(a.kpi.debt), số_phòng_còn_nợ: a.debtorCount,
        danh_sách_nợ_nhiều_nhất: top.map(t => ({ phòng: t.roomCode, tòa: t.buildingName,
          khách: t.tenantName, số_tiền: money(t.amount), số_hóa_đơn: t.n })) };
      if (!top.length) return { facts, html: 'Hiện <b>không còn khoản công nợ nào</b> ✓' };
      return { facts, html: `Tổng công nợ đang là <b>${money(a.kpi.debt)}</b> ở <b>${a.debtorCount}</b> phòng.<br>
        Nợ nhiều nhất:<br>${top.slice(0, 5).map(t =>
          `• <b>${U.esc(t.roomCode)}</b> (${U.esc(t.buildingName)}) — ${money(t.amount)} · ${U.esc(t.tenantName || '')}`).join('<br>')}`,
        actions: [{ label: 'Xem công nợ', go: `#/b/${firstBid()}/payments` }] };
    },
  };

  I.occupancy = {
    desc: 'Tỷ lệ lấp đầy, số phòng trống, phòng nào đang trống',
    kw: ['lap day', 'phong trong', 'con phong nao', 'trong bao nhieu', 'bao nhieu phong', 'con trong'],
    run() {
      const a = S.dashboardAnalytics();
      const vacant = [];
      myBuildings().forEach(b => S.roomsOf(b.id).filter(r => r.status === 'vacant')
        .forEach(r => vacant.push({ phòng: r.code, tòa: b.name, giá: money(r.price), tầng: r.floor })));
      const facts = { tỷ_lệ_lấp_đầy: pct(a.kpi.occupancy), đang_thuê: a.kpi.occupiedRooms,
        tổng_phòng: a.kpi.totalRooms, số_phòng_trống: vacant.length, danh_sách_phòng_trống: vacant.slice(0, 12) };
      return { facts, html: `Tỷ lệ lấp đầy <b>${pct(a.kpi.occupancy)}</b> (${a.kpi.occupiedRooms}/${a.kpi.totalRooms} phòng).<br>
        Đang trống <b>${vacant.length}</b> phòng${vacant.length ? ': ' + vacant.slice(0, 10).map(v =>
          `<b>${U.esc(v.phòng)}</b> (${U.esc(v.tòa)}, ${v.giá})`).join(', ') : ''}.`,
        actions: vacant.length ? [{ label: 'Đăng tin cho thuê', go: `#/post` }] : [] };
    },
  };

  I.overdue = {
    desc: 'Hóa đơn quá hạn thanh toán',
    kw: ['qua han', 'tre han', 'hoa don qua han', 'chua tra dung han'],
    run() {
      const list = [];
      let sum = 0;
      myBuildings().forEach(b => S.invoicesOf(b.id).filter(i => i.status === 'overdue')
        .forEach(i => { sum += i.total - i.paid;
          list.push({ mã: i.id, phòng: i.roomCode, tòa: b.name, khách: i.tenantName,
            còn_nợ: money(i.total - i.paid), hạn: U.fmtDate(i.dueDate),
            trễ_ngày: Math.abs(U.daysBetween(U.today(), i.dueDate)) }); }));
      list.sort((a, b) => b.trễ_ngày - a.trễ_ngày);
      const facts = { số_hóa_đơn_quá_hạn: list.length, tổng_tiền: money(sum), danh_sách: list.slice(0, 10) };
      if (!list.length) return { facts, html: 'Không có hóa đơn nào quá hạn ✓' };
      return { facts, html: `Có <b>${list.length}</b> hóa đơn quá hạn:<br>${list.slice(0, 8).map(x =>
        `• <b>${U.esc(x.phòng)}</b> — ${x.còn_nợ} · trễ ${x.trễ_ngày} ngày · ${U.esc(x.khách || '')}`).join('<br>')}`,
        actions: [{ label: 'Xem danh sách', go: `#/b/${firstBid()}/invoices?status=overdue` }] };
    },
  };

  I.expiring = {
    desc: 'Hợp đồng sắp hết hạn hoặc đã hết hạn',
    kw: ['het han', 'sap het', 'gia han', 'hop dong sap', 'hop dong het'],
    run() {
      const soon = S.expiringContracts(null, 30);
      const facts = { số_hợp_đồng_sắp_hết_hạn_30_ngày: soon.length,
        danh_sách: soon.map(c => ({ phòng: c.roomCode, khách: c.tenantName,
          ngày_hết_hạn: U.fmtDate(c.end), còn_lại_ngày: S.daysToExpiry(c) })).slice(0, 12) };
      if (!soon.length) return { facts, html: 'Không có hợp đồng nào sắp hết hạn trong 30 ngày tới ✓' };
      return { facts, html: `<b>${soon.length}</b> hợp đồng cần chú ý:<br>${soon.slice(0, 8).map(c => {
        const d = S.daysToExpiry(c);
        return `• <b>${U.esc(c.roomCode)}</b> — ${U.esc(c.tenantName || '')} · ${d < 0
          ? `<span style="color:var(--danger)">đã quá hạn ${Math.abs(d)} ngày</span>` : `còn ${d} ngày`} (${U.fmtDate(c.end)})`;
      }).join('<br>')}`, actions: [{ label: 'Xem hợp đồng', go: `#/b/${firstBid()}/contracts?filter=soon` }] };
    },
  };

  I.readings = {
    desc: 'Phòng chưa ghi chỉ số điện nước kỳ này',
    kw: ['chi so', 'ghi dien', 'ghi nuoc', 'chua ghi', 'chot so', 'cong to'],
    run() {
      const per = S.period(), miss = [];
      myBuildings().forEach(b => S.roomsOf(b.id)
        .filter(r => r.status === 'occupied' || r.status === 'notice')
        .forEach(r => { const rd = S.reading(b.id, r.code, per);
          if (!(rd && rd.elecCurr != null)) miss.push({ phòng: r.code, tòa: b.name }); }));
      const a = S.dashboardAnalytics();
      const facts = { kỳ: S.periodLabel(per), số_phòng_chưa_ghi: miss.length, danh_sách: miss.slice(0, 20),
        điện_đã_ghi_kWh: Math.round(a.usage.elecKwh), nước_đã_ghi_m3: Math.round(a.usage.waterM3) };
      if (!miss.length) return { facts, html: `Tất cả phòng đã ghi chỉ số kỳ <b>${S.periodLabel(per)}</b> ✓` };
      return { facts, html: `Còn <b>${miss.length}</b> phòng chưa ghi chỉ số kỳ ${S.periodLabel(per)}:<br>
        ${miss.slice(0, 15).map(x => `<b>${U.esc(x.phòng)}</b>`).join(', ')}`,
        actions: [{ label: 'Ghi chỉ số', go: `#/b/${firstBid()}/readings` }] };
    },
  };

  I.incidents = {
    desc: 'Sự cố, yêu cầu sửa chữa của khách',
    kw: ['su co', 'sua chua', 'bao hong', 'hu hong', 'bao tri', 'yeu cau sua'],
    run() {
      const open = S.incidents.filter(x => x.status !== 'done');
      const facts = { số_sự_cố_đang_mở: open.length,
        danh_sách: open.slice(0, 10).map(x => ({ phòng: x.roomCode, loại: x.category,
          nội_dung: x.title, trạng_thái: x.status })) };
      if (!open.length) return { facts, html: 'Không còn sự cố nào đang mở ✓' };
      return { facts, html: `Đang có <b>${open.length}</b> sự cố:<br>${open.slice(0, 8).map(x =>
        `• <b>${U.esc(x.roomCode || '')}</b> — ${U.esc(x.title || x.category || '')}`).join('<br>')}`,
        actions: [{ label: 'Quản lý sự cố', go: `#/b/${firstBid()}/incidents` }] };
    },
  };

  I.room = {
    desc: 'Thông tin một phòng cụ thể (giá, khách đang ở, công nợ, tài sản)',
    params: 'roomCode (mã phòng, ví dụ P101)',
    kw: [],
    run(p, text) {
      const f = (p && p.roomCode ? matchRoomCode(p.roomCode) : null) || findRoom(text);
      if (!f) return { facts: { lỗi: 'không tìm thấy phòng' },
        html: 'Em không tìm thấy phòng đó. Anh/chị cho em mã phòng cụ thể nhé (ví dụ <b>P101</b>).' };
      const { room, building } = f;
      const ct = S.contractsOf(building.id).find(c => c.roomCode === room.code && c.status === 'active');
      const invs = S.invoicesOf(building.id).filter(i => i.roomCode === room.code && i.status !== 'cancelled');
      const debt = invs.reduce((s, i) => s + (i.total - i.paid), 0);
      const assets = S.assetsOf(building.id, room.code);
      const facts = { phòng: room.code, tòa: building.name, tầng: room.floor,
        trạng_thái: ROOM_ST[room.status] || room.status, giá_thuê: money(room.price),
        diện_tích: room.area ? room.area + ' m²' : null,
        khách_đang_ở: ct ? ct.tenantName : null,
        hợp_đồng: ct ? { từ: U.fmtDate(ct.start), đến: U.fmtDate(ct.end),
          còn_lại_ngày: S.daysToExpiry(ct), tiền_cọc: money(ct.deposit) } : null,
        công_nợ: money(debt), số_tài_sản: assets.length,
        tài_sản: assets.slice(0, 10).map(a => a.name) };
      return { facts, html: `<b>Phòng ${U.esc(room.code)}</b> · ${U.esc(building.name)}<br>
        Trạng thái: <b>${ROOM_ST[room.status] || room.status}</b> · Giá ${money(room.price)}${room.area ? ' · ' + room.area + ' m²' : ''}<br>
        ${ct ? `Khách: <b>${U.esc(ct.tenantName)}</b> · HĐ đến ${U.fmtDate(ct.end)} (còn ${S.daysToExpiry(ct)} ngày)<br>` : ''}
        Công nợ: <b>${money(debt)}</b> · Tài sản: ${assets.length} món`,
        actions: [{ label: 'Mở phòng ' + room.code, go: `#/b/${building.id}/units` }] };
    },
  };

  I.tenant = {
    desc: 'Thông tin một khách thuê cụ thể (theo tên hoặc số điện thoại)',
    params: 'name (tên khách) hoặc phone',
    kw: [],
    run(p, text) {
      const t = findTenant((p && (p.name || p.phone)) || text);
      if (!t) return { facts: { lỗi: 'không tìm thấy khách' },
        html: 'Em chưa tìm thấy khách nào khớp. Anh/chị cho em tên đầy đủ hoặc số điện thoại nhé.' };
      const b = S.building(t.buildingId) || {};
      const ct = S.contractsOf(t.buildingId).find(c => c.tenantId === t.id && c.status === 'active');
      const invs = S.invoicesOf(t.buildingId).filter(i => i.tenantId === t.id && i.status !== 'cancelled');
      const debt = invs.reduce((s, i) => s + (i.total - i.paid), 0);
      const facts = { họ_tên: t.fullName, điện_thoại: t.phone, phòng: t.roomCode || (ct && ct.roomCode) || null,
        tòa: b.name, công_nợ: money(debt), số_hóa_đơn: invs.length,
        xe: S.vehiclesOf(t).map(v => v.plate),
        hợp_đồng: ct ? { từ: U.fmtDate(ct.start), đến: U.fmtDate(ct.end), tiền_thuê: money(ct.rent) } : null };
      return { facts, html: `<b>${U.esc(t.fullName)}</b>${t.phone ? ' · ' + U.esc(t.phone) : ''}<br>
        Phòng <b>${U.esc(t.roomCode || (ct && ct.roomCode) || '—')}</b> · ${U.esc(b.name || '')}<br>
        Công nợ: <b>${money(debt)}</b>${ct ? ` · HĐ đến ${U.fmtDate(ct.end)}` : ''}`,
        actions: [{ label: 'Xem khách thuê', go: `#/b/${t.buildingId}/tenants` }] };
    },
  };

  I.expense = {
    desc: 'Chi phí vận hành, các khoản chi trong kỳ',
    kw: ['chi phi', 'khoan chi', 'chi bao nhieu', 'chi tieu', 'tien chi'],
    run() {
      const a = S.dashboardAnalytics();
      const facts = { kỳ: S.periodLabel(a.period), tổng_chi: money(a.kpi.cost),
        so_với_kỳ_trước: (a.kpi.costTrend >= 0 ? '+' : '') + pct(a.kpi.costTrend),
        theo_hạng_mục: a.expenseMix.map(x => ({ hạng_mục: x.label, số_tiền: money(x.value) })) };
      if (!a.expenseMix.length) return { facts, html: `Kỳ <b>${S.periodLabel(a.period)}</b> chưa ghi khoản chi nào.`,
        actions: [{ label: 'Ghi khoản chi', go: `#/b/${firstBid()}/expenses` }] };
      return { facts, html: `Chi phí kỳ <b>${S.periodLabel(a.period)}</b>: <b>${money(a.kpi.cost)}</b><br>
        ${a.expenseMix.slice(0, 6).map(x => `• ${U.esc(x.label)}: ${money(x.value)}`).join('<br>')}`,
        actions: [{ label: 'Xem thu chi', go: `#/b/${firstBid()}/expenses` }] };
    },
  };

  I.profit = {
    desc: 'Lợi nhuận, chênh lệch thu chi',
    kw: ['loi nhuan', 'lai bao nhieu', 'lai lo', 'chenh lech thu chi', 'con lai bao nhieu'],
    run() {
      const a = S.dashboardAnalytics(), k = a.kpi;
      const facts = { kỳ: S.periodLabel(a.period), đã_thu: money(k.revenue), chi_phí: money(k.cost),
        lợi_nhuận: money(k.profit), so_với_kỳ_trước: (k.profitTrend >= 0 ? '+' : '') + pct(k.profitTrend) };
      return { facts, html: `Kỳ <b>${S.periodLabel(a.period)}</b>: thu <b>${money(k.revenue)}</b> −
        chi <b>${money(k.cost)}</b> = lợi nhuận <b>${money(k.profit)}</b>.` };
    },
  };

  I.claims = {
    desc: 'Phiếu khách báo đã chuyển khoản, chờ duyệt',
    kw: ['chuyen khoan', 'bao da chuyen', 'cho duyet', 'xac nhan chuyen'],
    run() {
      const list = S.claimsOf(null, 'pending');
      const facts = { số_phiếu_chờ_duyệt: list.length,
        danh_sách: list.slice(0, 10).map(c => ({ phòng: c.roomCode, số_tiền: money(c.amount), ngày: U.fmtDate(c.createdAt) })) };
      if (!list.length) return { facts, html: 'Không có phiếu chuyển khoản nào chờ duyệt ✓' };
      return { facts, html: `Có <b>${list.length}</b> phiếu khách báo chuyển khoản đang chờ duyệt.`,
        actions: [{ label: 'Duyệt ngay', go: `#/transfers`, solid: true }] };
    },
  };

  I.usage = {
    desc: 'Tiêu thụ điện nước trong kỳ',
    kw: ['tieu thu', 'bao nhieu kwh', 'bao nhieu khoi', 'dien nuoc thang', 'so dien', 'so nuoc'],
    run() {
      const a = S.dashboardAnalytics();
      const facts = { kỳ: S.periodLabel(a.period), điện_kWh: Math.round(a.usage.elecKwh),
        nước_m3: Math.round(a.usage.waterM3), số_phòng_đã_ghi: a.usage.roomsRead, số_phòng_đang_thuê: a.kpi.occupiedRooms };
      return { facts, html: `Kỳ <b>${S.periodLabel(a.period)}</b>: điện <b>${U.number(Math.round(a.usage.elecKwh))} kWh</b>,
        nước <b>${U.number(Math.round(a.usage.waterM3))} m³</b> (đã ghi ${a.usage.roomsRead}/${a.kpi.occupiedRooms} phòng).`,
        actions: [{ label: 'Xem chỉ số', go: `#/b/${firstBid()}/readings` }] };
    },
  };

  I.buildings = {
    desc: 'So sánh tình hình giữa các tòa nhà',
    kw: ['toa nha', 'co so', 'chi nhanh', 'so sanh toa', 'toa nao'],
    run() {
      const a = S.dashboardAnalytics();
      const facts = { danh_sách_tòa: a.byBuilding.map(b => ({ tên: b.name, số_phòng: b.rooms,
        lấp_đầy: pct(b.occupancy), phát_hành: money(b.billed), đã_thu: money(b.collected) })) };
      return { facts, html: a.byBuilding.map(b =>
        `• <b>${U.esc(b.name)}</b> — ${b.rooms} phòng · lấp đầy ${pct(b.occupancy)} · đã thu ${money(b.collected)}/${money(b.billed)}`).join('<br>'),
        actions: [{ label: 'Xem tòa nhà', go: '#/buildings' }] };
    },
  };

  I.todo = {
    desc: 'Hôm nay cần làm gì, việc cần xử lý, tổng hợp nhanh',
    kw: ['can lam gi', 'viec can', 'can xu ly', 'hom nay can', 'hom nay co gi', 'tinh hinh chung',
      'tom tat', 'tong quan', 'bao cao nhanh', 'viec ton dong'],
    run() {
      const d = S.dashboardSummary(), a = S.dashboardAnalytics();
      const items = [];
      if (d.alerts.expiredContracts) items.push(`${d.alerts.expiredContracts} hợp đồng đã quá hạn`);
      if (d.alerts.expiringContracts) items.push(`${d.alerts.expiringContracts} hợp đồng sắp hết hạn`);
      if (d.alerts.overdueInvoices) items.push(`${d.alerts.overdueInvoices} hóa đơn quá hạn`);
      if (d.alerts.pendingReadings) items.push(`${d.alerts.pendingReadings} phòng chưa ghi chỉ số`);
      const pc = S.pendingClaimCount(); if (pc) items.push(`${pc} phiếu chuyển khoản chờ duyệt`);
      const inc = S.incidents.filter(x => x.status !== 'done').length; if (inc) items.push(`${inc} sự cố đang mở`);
      const facts = { kỳ: S.periodLabel(a.period), đã_thu: money(a.kpi.revenue), công_nợ: money(a.kpi.debt),
        tỷ_lệ_lấp_đầy: pct(a.kpi.occupancy), việc_cần_làm: items };
      return { facts, html: `Kỳ <b>${S.periodLabel(a.period)}</b>: đã thu <b>${money(a.kpi.revenue)}</b> ·
        công nợ <b>${money(a.kpi.debt)}</b> · lấp đầy <b>${pct(a.kpi.occupancy)}</b>.<br>
        ${items.length ? 'Cần xử lý:<br>' + items.map(x => '• ' + x).join('<br>') : 'Không có việc gì tồn đọng ✓'}`,
        actions: [{ label: 'Mở tổng quan', go: '#/dashboard' }] };
    },
  };

  I.help = {
    desc: 'Hỏi trợ lý làm được gì',
    kw: ['giup gi', 'giup duoc gi', 'ho tro gi', 'lam duoc gi', 'lam duoc nhung gi',
      'huong dan', 'ban la ai', 'em la ai', 'tro ly'],
    run() {
      return { facts: {}, html: `Em tra cứu số liệu thật trong hệ thống. Anh/chị có thể hỏi:<br>
        • <i>Tháng này thu được bao nhiêu?</i><br>
        • <i>Phòng nào còn nợ nhiều nhất?</i><br>
        • <i>Còn phòng trống không?</i><br>
        • <i>Hợp đồng nào sắp hết hạn?</i><br>
        • <i>Phòng P101 thế nào?</i><br>
        • <i>Hôm nay cần xử lý gì?</i>` };
    },
  };

  function matchRoomCode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!c) return null;
    for (const b of myBuildings()) {
      const r = S.roomsOf(b.id).find(x => x.code.toUpperCase().replace(/[^A-Z0-9]/g, '') === c);
      if (r) return { room: r, building: b };
    }
    return null;
  }

  /* Danh sách gửi cho Gemini để phân loại (chỉ tên + mô tả, KHÔNG kèm dữ liệu) */
  const INTENT_LIST = Object.keys(I).map(k => ({ key: k, desc: I[k].desc, params: I[k].params }));

  /* ---------- TẦNG 1: luật từ khóa ---------- */
  function ruleMatch(text) {
    const t = norm(text);
    if (has(t, ['xin chao', 'hello', 'chao em', 'chao ban']) && t.length < 22) return 'greet';
    for (const key of Object.keys(I)) {
      if ((I[key].kw || []).some(k => t.includes(k))) return key;
    }
    // hỏi trực tiếp về 1 phòng: "phòng p101", "p101 sao rồi"
    if (/\bphong\b/.test(t) && findRoom(text)) return 'room';
    return null;
  }

  /* ---------- Đầu vào chính ---------- */
  async function ask(text) {
    const q = (text || '').trim();
    if (!q) return { html: 'Anh/chị nhập câu hỏi giúp em ạ.', source: 'rule' };

    const key = ruleMatch(q);
    if (key === 'greet') {
      return { source: 'rule', html: `Chào anh/chị <b>${U.esc((S.prefs && S.prefs.userName) || '')}</b>! Em tra cứu số liệu thật trong hệ thống.
        Anh/chị muốn xem gì ạ?`, actions: [{ label: 'Hôm nay cần làm gì?', send: 'Hôm nay cần xử lý gì?' },
          { label: 'Doanh thu kỳ này', send: 'Tháng này thu được bao nhiêu?' }] };
    }
    if (key) {
      const r = I[key].run({}, q);
      return { source: 'rule', intent: key, html: r.html, actions: r.actions, facts: r.facts };
    }

    /* ---------- TẦNG 2: Gemini ---------- */
    if (!G() || !G().configured()) return notSupported(q);

    const ck = 'a|' + norm(q);
    const cached = G().cacheGet(ck);

    try {
      const cls = cached || await G().classify(q, INTENT_LIST);
      if (!cached) G().cacheSet(ck, cls);
      if (cls.intent === 'unknown' || !I[cls.intent] || cls.confidence < 0.35) return notSupported(q);

      // Code lấy SỐ THẬT — mô hình không được chạm vào bước này
      const r = I[cls.intent].run(cls.params || {}, q);
      let html, source = 'ai';
      try {
        const composed = await G().compose(q, r.facts, 'Xưng "em", gọi người dùng là "anh/chị". Người hỏi là chủ trọ hoặc nhân viên quản lý.');
        html = composed.replace(/```[a-z]*|```/g, '').trim();
      } catch (e) {
        html = r.html; source = 'rule';   // soạn lời lỗi thì vẫn trả câu mẫu có số thật
      }
      return { source, intent: cls.intent, html, actions: r.actions, facts: r.facts };
    } catch (e) {
      const code = e.message || '';
      if (code === 'AI_QUOTA' || code === 'AI_BAD_KEY' || code === 'AI_NOT_CONFIGURED') {
        return { source: 'error', html: G().errText(code) + '<br>Em vẫn trả lời được các câu hỏi thường gặp ạ.' };
      }
      return notSupported(q);
    }
  }

  function notSupported() {
    return { source: 'fallback', html: `Câu này em chưa tra được ạ. Em đang hỗ trợ: doanh thu, công nợ,
      phòng trống, hóa đơn quá hạn, hợp đồng sắp hết hạn, chỉ số điện nước, sự cố, thông tin phòng và khách thuê.`,
      actions: [{ label: 'Em làm được gì?', send: 'Bạn giúp được gì?' }] };
  }

  const SUGGESTIONS = [
    'Hôm nay cần xử lý gì?',
    'Tháng này thu được bao nhiêu?',
    'Phòng nào còn nợ nhiều nhất?',
    'Còn phòng trống không?',
    'Hợp đồng nào sắp hết hạn?',
    'Chi phí tháng này bao nhiêu?',
  ];

  return { ask, SUGGESTIONS, INTENT_LIST, ruleMatch, intents: I };
})();

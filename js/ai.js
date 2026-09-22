/* ============================================================
   Happy Home — Trợ lý AI cho CHỦ TRỌ / NHÂN VIÊN (web quản trị)
   ------------------------------------------------------------
   Kiến trúc lai (rẻ + chính xác):
     Tầng 1 — HIỂU CÂU TẠI CHỖ (js/nlu.js): chấm điểm ý định, bóc kỳ / tòa /
              phòng / khách trong câu, nhớ ngữ cảnh để hiểu câu hỏi nối tiếp.
              Code truy vấn dữ liệu thật rồi trả lời. Miễn phí, tức thì.
     Tầng 2 — GEMINI FLASH: chỉ khi tầng 1 không nhận ra ý định.
              (a) mô hình phân loại ý định + tham số -> chỉ JSON, không có số
              (b) code KIỂM TRA lại tham số rồi lấy số thật từ HH.store
              (c) mô hình soạn lời văn TỪ số thật đó
     Tầng 3 — TRẢ LỜI TRUNG THỰC: chưa hỗ trợ thì nói thẳng, gợi ý câu khác.

   Trợ lý CHỈ ĐỌC dữ liệu. Không sửa hóa đơn, không ghi thu, không xóa,
   không tự gửi tin nhắn — tin nhắc nợ chỉ được soạn sẵn để người dùng chép.
   ============================================================ */
HH.ai = (function () {
  const U = HH.util, S = HH.store, N = window.HHNLU;
  const G = () => window.HHGemini;
  const ctx = N.createContext();

  const esc = U.esc;
  const money = (n) => U.currency(n || 0);
  const pct = (n) => U.percent(n || 0);
  const plabel = (p) => S.periodLabel(p);
  const firstBid = () => (S.buildings[0] || {}).id || '';
  const bOf = (id) => S.building(id) || {};

  /* Tên ngắn của tòa: bỏ phần mọi tòa đều có ("Happy Home") */
  function shortName(b) {
    if (!b || !b.name) return '';
    const all = S.buildings.map((x) => N.toks(x.name));
    const common = all.length > 1 ? all[0].filter((w) => all.every((l) => l.includes(w))) : [];
    const words = b.name.split(/\s+/).filter((w) => !common.includes(N.norm(w)));
    return words.join(' ') || b.name;
  }

  const ROOM_ST = { occupied: 'đang cho thuê', vacant: 'còn trống', reserved: 'đã có khách cọc giữ',
    notice: 'khách đã báo trả', maintenance: 'đang bảo trì', cleaning: 'đang dọn' };

  const unpaid = (i) => i.status !== 'cancelled' && i.status !== 'draft' && i.total > i.paid;
  const lateDays = (i) => { const d = U.daysBetween(U.today(), i.dueDate); return d < 0 ? -d : 0; };
  // Kỳ so sánh không có số liệu thì nói thẳng, không ghi "tăng 100%" cho có
  const pctChange = (now, before) => {
    if (!before) return now ? 'mới có' : 'không đổi';
    const r = (now - before) / before;
    if (r === 0) return 'không đổi';
    if (Math.abs(r) < 0.01) return (r > 0 ? 'nhích lên ' : 'giảm nhẹ ') + (Math.abs(r) * 100).toFixed(1).replace('.', ',') + '%';
    return (r > 0 ? 'tăng ' : 'giảm ') + pct(Math.abs(r));
  };
  const vsText = (now, before, basePer) => before
    ? `${pctChange(now, before)} so với ${plabel(basePer)}`
    : `chưa so được vì ${plabel(basePer)} chưa có số liệu`;

  /* Tài khoản nhận tiền dùng trong tin nhắc nợ (giống app khách thuê) */
  const BANK = Object.assign({ name: 'MB Bank', account: '0912345678', holder: 'CTY HAPPY HOME' },
    (window.HH_CONFIG && window.HH_CONFIG.bank) || {});

  /* ============================================================
     BÓC THAM SỐ TỪ CÂU HỎI
     ============================================================ */
  const allRoomCodes = () => [...new Set(S.buildings.flatMap((b) => S.roomsOf(b.id).map((r) => r.code)))];

  // Mã phòng có thể trùng giữa các tòa (P101 ở cả 3 tòa) -> trả mọi khả năng
  function roomCandidates(code, bid) {
    const c = String(code).toUpperCase();
    const out = [];
    S.buildings.forEach((b) => {
      if (bid && b.id !== bid) return;
      const r = S.roomsOf(b.id).find((x) => x.code.toUpperCase() === c);
      if (r) out.push({ code: r.code, buildingId: b.id });
    });
    return out;
  }

  // Tìm khách theo tên đầy đủ, tên gọi ("Linh"), hoặc số điện thoại
  function tenantCandidates(text) {
    const t = ' ' + N.norm(text) + ' ';
    const digits = String(text || '').replace(/\D/g, '');
    const all = S.buildings.flatMap((b) => S.tenantsOf(b.id));
    if (digits.length >= 9) {
      const byPhone = all.filter((x) => x.phone && x.phone.replace(/\D/g, '').endsWith(digits.slice(-9)));
      if (byPhone.length) return byPhone;
    }
    const full = all.filter((x) => x.fullName && t.includes(' ' + N.norm(x.fullName) + ' '));
    if (full.length) return full;
    // "khách tên Linh", "chị Thị Linh", "anh Minh" -> thử 2 chữ cuối trước, rồi 1 chữ
    const m = t.match(/ (?:khach ten|nguoi ten|ten la|ten|khach|chi|anh|co|chu|ong|ba) ([a-z]+)(?: ([a-z]+))? /);
    if (m) {
      const byLast = (words) => all.filter((x) => N.toks(x.fullName).slice(-words.length).join(' ') === words.join(' '));
      let hit = m[2] ? byLast([m[1], m[2]]) : [];
      if (!hit.length) hit = byLast([m[1]]);
      if (hit.length) return hit;
    }
    return [];
  }

  function parseSlots(text) {
    const p = N.extractPeriod(text, S.period());
    const roomCodes = N.extractRooms(text, allRoomCodes());
    // Có nhắc tới một mã phòng nhưng không phòng nào khớp ("phòng 999", "P999")
    let unknownRoom = null;
    if (!roomCodes.length) {
      const m = N.norm(text).match(/\bphong ([a-z]?\d{2,4}[a-z]?)\b/) || String(text).match(/\b([Pp]\d{3,4})\b/);
      if (m) unknownRoom = m[1].toUpperCase();
    }
    return {
      period: p ? p.period : null,
      months: N.extractMonths(text),
      buildingId: N.extractBuilding(text, S.buildings),
      roomCodes, unknownRoom,
      tenants: tenantCandidates(text),
    };
  }

  /* Mô tả phạm vi đang trả lời — hiện cho người dùng biết bot đã hiểu gì */
  function scopeText(sl) {
    const parts = [];
    if (sl.room) parts.push('Phòng ' + sl.room.code + (S.buildings.length > 1 ? ' · ' + shortName(bOf(sl.room.buildingId)) : ''));
    else if (sl.tenantId) { const t = S.tenantById(sl.tenantId); if (t) parts.push(t.fullName); }
    else if (sl.buildingId) parts.push(shortName(bOf(sl.buildingId)));
    if (sl.period) parts.push(plabel(sl.period));
    if (sl.months) parts.push(sl.months + ' tháng');
    return parts.join(' · ');
  }

  /* Danh sách hóa đơn theo phạm vi */
  function invoicesIn(sl) {
    let list = S.buildings.flatMap((b) => S.invoicesOf(b.id));
    if (sl.room) list = list.filter((i) => i.buildingId === sl.room.buildingId && i.roomCode === sl.room.code);
    else if (sl.tenantId) {
      const t = S.tenantById(sl.tenantId);
      list = list.filter((i) => i.tenantId === sl.tenantId
        || (t && i.buildingId === t.buildingId && i.roomCode === t.roomCode));
    } else if (sl.buildingId) list = list.filter((i) => i.buildingId === sl.buildingId);
    return list;
  }

  const where = (sl) => sl.buildingId ? ' ở <b>' + esc(shortName(bOf(sl.buildingId))) + '</b>' : '';
  const bidFor = (sl) => sl.buildingId || (sl.room && sl.room.buildingId) || firstBid();

  /* Kỳ gần nhất có dữ liệu (để gợi ý khi người dùng hỏi kỳ trống) */
  function nearestPeriodWithData() {
    const set = [...S.periodsWithData()].sort();
    return set.length ? set[set.length - 1] : null;
  }

  /* ============================================================
     BỘ Ý ĐỊNH — mỗi ý định tự lấy SỐ THẬT, trả về:
       html     câu trả lời (số thật)
       facts    dữ liệu thô cho Gemini soạn lời (không bao giờ để mô hình tự nghĩ số)
       actions  nút bấm   · suggest  câu hỏi gợi ý tiếp theo
       table / chart      phần hiển thị giàu hơn trong khung chat
     ============================================================ */
  const I = {};

  I.revenue = {
    desc: 'Doanh thu / tiền đã thu được trong một kỳ', uses: 'period, building',
    kw: ['doanh thu', 'thu duoc', 'da thu', 'tien thu', 'tong thu', 'thu bao nhieu', 'tien vao', 'thu tien duoc'],
    weak: ['thu'], neg: ['chi phi', 'thu chi', 'loi nhuan'],
    run(sl) {
      const per = sl.period || S.period();
      const a = S.dashboardAnalytics({ period: per, buildingId: sl.buildingId }), k = a.kpi;
      const facts = { kỳ: plabel(per), phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        có_dữ_liệu: a.hasData, đã_thu: money(k.revenue), đã_phát_hành: money(k.billed),
        còn_phải_thu: money(Math.max(0, k.billed - k.revenue)), tỷ_lệ_thu: pct(k.collectRate),
        kỳ_trước: plabel(a.prevPeriod), đã_thu_kỳ_trước: money(k.revenuePrev),
        so_với_kỳ_trước: pctChange(k.revenue, k.revenuePrev) };
      if (!k.invoices) {
        const near = nearestPeriodWithData();
        return { facts, html: `Kỳ <b>${plabel(per)}</b>${where(sl)} chưa có hóa đơn nào nên chưa có doanh thu.`,
          suggest: near && near !== per ? [`Doanh thu ${plabel(near)}`] : ['Doanh thu 6 tháng gần đây'] };
      }
      return { facts,
        html: `Kỳ <b>${plabel(per)}</b>${where(sl)} đã thu <b>${money(k.revenue)}</b>
          / ${money(k.billed)} phát hành (<b>${pct(k.collectRate)}</b>).<br>
          Còn phải thu <b>${money(Math.max(0, k.billed - k.revenue))}</b> ·
          ${vsText(k.revenue, k.revenuePrev, a.prevPeriod)}.`,
        actions: [{ label: 'Xem hóa đơn', go: `#/b/${bidFor(sl)}/invoices` }],
        suggest: ['So với tháng trước', 'Doanh thu 6 tháng gần đây', 'Phòng nào còn nợ nhiều nhất?'] };
    },
  };

  I.compare = {
    desc: 'So sánh kỳ này với kỳ trước (tăng/giảm doanh thu, chi phí, lợi nhuận)', uses: 'period, building',
    kw: ['so voi', 'so sanh', 'tang hay giam', 'tang giam', 'bien dong', 'hon thang truoc', 'kem thang truoc', 'khac gi thang truoc'],
    neg: ['so sanh toa', 'so sanh cac toa', 'giua cac toa', 'so voi toa'],
    run(sl) {
      const per = sl.period || S.period();
      const base = sl.basePeriod && sl.basePeriod !== per ? sl.basePeriod : S.prevPeriodOf(per);
      const k1 = S.dashboardAnalytics({ period: per, buildingId: sl.buildingId }).kpi;
      const k0 = S.dashboardAnalytics({ period: base, buildingId: sl.buildingId }).kpi;
      const p0 = plabel(base), p1 = plabel(per);
      const rows = [
        ['Phát hành', k0.billed, k1.billed, money],
        ['Đã thu', k0.revenue, k1.revenue, money],
        ['Chi phí', k0.cost, k1.cost, money],
        ['Lợi nhuận', k0.profit, k1.profit, money],
        ['Số hóa đơn', k0.invoices, k1.invoices, (n) => String(n)],
      ];
      const facts = { kỳ_gốc: p0, kỳ_so: p1, phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        kỳ_gốc_có_dữ_liệu: k0.invoices > 0, kỳ_so_có_dữ_liệu: k1.invoices > 0,
        chỉ_số: rows.map((r) => ({ tên: r[0], [p0]: r[3](r[1]), [p1]: r[3](r[2]), thay_đổi: pctChange(r[2], r[1]) })),
        tỷ_lệ_thu: { [p0]: pct(k0.collectRate), [p1]: pct(k1.collectRate) } };
      const missing = [!k0.invoices && p0, !k1.invoices && p1].filter(Boolean);
      const lead = missing.length
        ? `<b>${missing.join('</b> và <b>')}</b>${where(sl)} chưa có hóa đơn nào nên chưa so được đầy đủ.`
        : `<b>${p1}</b> so với <b>${p0}</b>${where(sl)}: đã thu ${pctChange(k1.revenue, k0.revenue)},
           lợi nhuận ${pctChange(k1.profit, k0.profit)}, tỷ lệ thu ${pct(k0.collectRate)} → <b>${pct(k1.collectRate)}</b>.`;
      return { facts, html: lead,
        table: { head: ['', p0, p1, 'Thay đổi'], num: [1, 2],
          rows: rows.map((r) => [r[0], r[3](r[1]), r[3](r[2]), pctChange(r[2], r[1])]) },
        suggest: missing.length ? ['Doanh thu 6 tháng gần đây'] : ['Doanh thu 6 tháng gần đây', `Chi phí ${p1}`, 'Phòng nào còn nợ nhiều nhất?'] };
    },
  };

  I.trend = {
    desc: 'Xu hướng doanh thu nhiều tháng, biểu đồ theo tháng', uses: 'months, period, building',
    kw: ['xu huong', 'bieu do', 'cac thang', 'tung thang', 'qua cac thang', 'thang gan day', 'thang qua', 'nua nam', 'ca nam', 'theo thang'],
    run(sl) {
      const months = sl.months || 6;
      const a = S.dashboardAnalytics({ period: sl.period || S.period(), buildingId: sl.buildingId, months });
      const s = a.series;
      const withData = s.filter((x) => x.invoices > 0);
      const total = s.reduce((t, x) => t + x.revenue, 0);
      const best = withData.slice().sort((x, y) => y.revenue - x.revenue)[0];
      const facts = { số_tháng: months, phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        theo_tháng: s.map((x) => ({ kỳ: plabel(x.period), đã_thu: money(x.revenue), chi_phí: money(x.cost),
          có_hóa_đơn: x.invoices > 0 })),
        tổng_đã_thu: money(total), số_tháng_có_dữ_liệu: withData.length,
        tháng_cao_nhất: best ? plabel(best.period) : null };
      const note = withData.length < s.length
        ? `<br><span class="as-muted">${s.length - withData.length}/${s.length} tháng chưa có hóa đơn trên hệ thống.</span>` : '';
      return { facts,
        html: `Doanh thu <b>${months} tháng</b> gần nhất${where(sl)}: tổng <b>${money(total)}</b>`
          + (best ? `, cao nhất <b>${plabel(best.period)}</b> (${money(best.revenue)})` : '') + '.' + note,
        chart: { data: s.map((x) => ({ label: x.label, value: x.revenue })) },
        suggest: ['So với tháng trước', 'Chi phí tháng này', 'Lợi nhuận tháng này'] };
    },
  };

  I.debt = {
    desc: 'Công nợ: tổng nợ, ai/phòng nào còn nợ, một phòng hoặc một khách còn nợ bao nhiêu', uses: 'building, room, tenant',
    entity: true,
    kw: ['cong no', 'con no', 'dang no', 'no bao nhieu', 'ai no', 'no nhieu', 'chua dong', 'chua tra', 'chua thanh toan',
      'no tien', 'thieu tien', 'con thieu', 'chua dong tien'],
    neg: ['nhac no', 'doi no', 'soan tin', 'nhan tin'],
    run(sl) {
      const list = invoicesIn(sl).filter(unpaid).sort((x, y) => x.period.localeCompare(y.period));
      const sum = list.reduce((t, i) => t + i.total - i.paid, 0);

      if (sl.room || sl.tenantId) {
        const who = sl.room ? 'Phòng <b>' + esc(sl.room.code) + '</b>' : '<b>' + esc((S.tenantById(sl.tenantId) || {}).fullName || '') + '</b>';
        const facts = { đối_tượng: scopeText(sl), tổng_còn_nợ: money(sum),
          hóa_đơn: list.map((i) => ({ kỳ: plabel(i.period), còn_nợ: money(i.total - i.paid), hạn: U.fmtDate(i.dueDate), trễ_ngày: lateDays(i) })) };
        if (!list.length) return { facts, html: `${who} đã thanh toán đủ, không còn nợ ✓`,
          suggest: ['Phòng nào còn nợ nhiều nhất?'] };
        const code = sl.room ? sl.room.code : (list[0] && list[0].roomCode);
        return { facts,
          html: `${who} còn nợ <b>${money(sum)}</b> (${list.length} hóa đơn).`,
          table: { head: ['Kỳ', 'Còn nợ', 'Hạn'], num: [1],
            rows: list.map((i) => [plabel(i.period), money(i.total - i.paid),
              U.fmtDate(i.dueDate) + (lateDays(i) ? ` · trễ ${lateDays(i)}n` : '')]) },
          actions: [{ label: 'Soạn tin nhắc nợ', send: `Soạn tin nhắc nợ phòng ${code}`, solid: true },
            { label: 'Xem hóa đơn', go: `#/b/${bidFor(sl)}/invoices` }],
          suggest: ['Phòng nào còn nợ nhiều nhất?'] };
      }

      const a = S.dashboardAnalytics({ buildingId: sl.buildingId });
      const top = a.topDebtors;
      const facts = { phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        tổng_công_nợ: money(a.kpi.debt), số_phòng_còn_nợ: a.debtorCount,
        nợ_nhiều_nhất: top.map((t) => ({ phòng: t.roomCode, tòa: t.buildingName, khách: t.tenantName,
          số_tiền: money(t.amount), số_hóa_đơn: t.n })) };
      if (!top.length) return { facts, html: `Không còn khoản công nợ nào${where(sl)} ✓` };
      return { facts,
        html: `Công nợ${where(sl)}: <b>${money(a.kpi.debt)}</b> ở <b>${a.debtorCount}</b> phòng. Nợ nhiều nhất:`,
        table: { head: ['Phòng', 'Khách', 'Còn nợ'], num: [2],
          rows: top.map((t) => [t.roomCode + (sl.buildingId ? '' : ' · ' + shortName(bOf(t.buildingId))),
            t.tenantName || '', money(t.amount)]) },
        actions: [{ label: 'Nhắc nợ các phòng quá hạn', send: 'Soạn tin nhắc nợ các phòng quá hạn', solid: true },
          { label: 'Xem công nợ', go: `#/b/${bidFor(sl)}/payments` }],
        suggest: [`Phòng ${top[0].roomCode} ${shortName(bOf(top[0].buildingId))} còn nợ bao nhiêu?`, 'Hóa đơn nào quá hạn?'] };
    },
  };

  I.remind = {
    desc: 'Soạn sẵn tin nhắn nhắc khách đóng tiền (không tự gửi)', uses: 'room, tenant, building',
    entity: true,
    kw: ['nhac no', 'nhac nho', 'doi no', 'doi tien', 'soan tin', 'tin nhan', 'nhan tin', 'nhac dong tien', 'nhac tien', 'nhac khach'],
    run(sl) {
      let list = invoicesIn(sl).filter(unpaid);
      const scoped = !!(sl.room || sl.tenantId);
      if (!scoped) list = list.filter((i) => i.status === 'overdue' || lateDays(i) > 0);
      if (!list.length) return { facts: {}, html: scoped
        ? `${esc(scopeText(sl))} không còn khoản nào cần nhắc ✓`
        : `Không có phòng nào quá hạn${where(sl)}, chưa cần nhắc ai ✓` };

      // gom theo phòng
      const groups = {};
      list.forEach((i) => { const k = i.buildingId + '|' + i.roomCode; (groups[k] = groups[k] || []).push(i); });
      const msgs = Object.values(groups).slice(0, 8).map((invs) => {
        invs.sort((x, y) => x.period.localeCompare(y.period));
        const first = invs[0];
        const tenant = S.tenantById(first.tenantId) || {};
        const sum = invs.reduce((t, i) => t + i.total - i.paid, 0);
        const late = Math.max(...invs.map(lateDays));
        const lines = invs.map((i) => `- ${plabel(i.period)}: ${money(i.total - i.paid)} (nội dung CK: ${S.transferContent(i)})`);
        const text = [
          `Chào anh/chị ${first.tenantName || ''}, Happy Home xin nhắc phòng ${first.roomCode} còn ${money(sum)} chưa thanh toán`
            + (late ? `, đã trễ hạn ${late} ngày.` : `, hạn ${U.fmtDate(first.dueDate)}.`),
          ...lines,
          `Anh/chị chuyển khoản giúp em: ${BANK.name} - STK ${BANK.account} - ${BANK.holder}.`,
          `Ghi đúng nội dung ở trên thì hệ thống tự cập nhật. Cảm ơn anh/chị!`,
        ].join('\n');
        return { room: first.roomCode, buildingId: first.buildingId, tenant: first.tenantName,
          phone: tenant.phone || '', sum, late, text };
      });

      const blocks = msgs.map((m, idx) => `<div class="as-msgcard">
          <div class="as-msgcard-h"><b>Phòng ${esc(m.room)}</b>${S.buildings.length > 1 ? ' · ' + esc(shortName(bOf(m.buildingId))) : ''}
            <span>${money(m.sum)}${m.late ? ' · trễ ' + m.late + 'n' : ''}</span></div>
          <pre>${esc(m.text)}</pre>
          <div class="as-acts">
            <button class="as-act solid" data-copyidx="${idx}">Chép tin</button>
            ${m.phone ? `<a class="as-act" href="https://zalo.me/${esc(m.phone.replace(/\D/g, ''))}" target="_blank" rel="noopener">Mở Zalo ${esc(m.phone)}</a>` : ''}
          </div></div>`).join('');

      return { facts: { số_tin: msgs.length },
        html: (scoped ? 'Tin nhắc nợ đã soạn sẵn. Kiểm tra rồi chép gửi khách:'
          : `Có <b>${Object.keys(groups).length}</b> phòng quá hạn${where(sl)}. Tin nhắc đã soạn sẵn:`)
          + blocks + `<div class="as-muted" style="margin-top:6px">Em chỉ soạn sẵn, không tự gửi cho khách.</div>`,
        copies: msgs.map((m) => m.text),
        actions: msgs.length > 1 ? [{ label: 'Chép tất cả', copy: msgs.map((m) => m.text).join('\n\n----------\n\n') }] : [],
        suggest: ['Phòng nào còn nợ nhiều nhất?'] };
    },
  };

  I.occupancy = {
    desc: 'Tỷ lệ lấp đầy, phòng trống, còn phòng nào cho thuê', uses: 'building',
    kw: ['lap day', 'phong trong', 'con trong', 'trong bao nhieu', 'con phong', 'phong nao trong', 'cho thue duoc',
      'ti le thue', 'ty le thue', 'con cho'],
    run(sl) {
      const a = S.dashboardAnalytics({ buildingId: sl.buildingId });
      const vacant = S.buildings.filter((b) => !sl.buildingId || b.id === sl.buildingId)
        .flatMap((b) => S.roomsOf(b.id).filter((r) => r.status === 'vacant').map((r) => ({ r, b })));
      const facts = { phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        tỷ_lệ_lấp_đầy: pct(a.kpi.occupancy), đang_thuê: a.kpi.occupiedRooms, tổng_phòng: a.kpi.totalRooms,
        số_phòng_trống: vacant.length,
        phòng_trống: vacant.slice(0, 15).map(({ r, b }) => ({ phòng: r.code, tòa: b.name, loại: r.typeLabel, giá: money(r.price) })),
        theo_tòa: a.byBuilding.map((b) => ({ tòa: b.name, lấp_đầy: pct(b.occupancy), trống: b.vacant })) };
      return { facts,
        html: `Lấp đầy${where(sl)} <b>${pct(a.kpi.occupancy)}</b> (${a.kpi.occupiedRooms}/${a.kpi.totalRooms} phòng) ·
          còn trống <b>${vacant.length}</b> phòng${vacant.length ? ':' : '.'}`,
        table: vacant.length ? { head: ['Phòng', 'Loại', 'Giá'], num: [2],
          rows: vacant.slice(0, 10).map(({ r, b }) => [r.code + (sl.buildingId ? '' : ' · ' + shortName(b)), r.typeLabel || '', money(r.price)]) } : null,
        actions: vacant.length ? [{ label: 'Đăng tin cho thuê', go: '#/post', solid: true }] : [],
        suggest: sl.buildingId ? ['So sánh các tòa nhà'] : S.buildings.slice(0, 2).map((b) => `${shortName(b)} còn phòng trống không?`) };
    },
  };

  I.overdue = {
    desc: 'Hóa đơn quá hạn thanh toán', uses: 'building, room',
    kw: ['qua han', 'tre han', 'tre hen', 'den han', 'het han thanh toan', 'chua dong dung han'],
    neg: ['hop dong'],
    run(sl) {
      const list = invoicesIn(sl).filter((i) => i.status === 'overdue')
        .sort((x, y) => lateDays(y) - lateDays(x));
      const sum = list.reduce((t, i) => t + i.total - i.paid, 0);
      const facts = { phạm_vi: scopeText(sl) || 'toàn công ty', số_hóa_đơn_quá_hạn: list.length, tổng_tiền: money(sum),
        danh_sách: list.slice(0, 10).map((i) => ({ phòng: i.roomCode, khách: i.tenantName, kỳ: plabel(i.period),
          còn_nợ: money(i.total - i.paid), trễ_ngày: lateDays(i) })) };
      if (!list.length) return { facts, html: `Không có hóa đơn nào quá hạn${where(sl)} ✓` };
      return { facts,
        html: `<b>${list.length}</b> hóa đơn quá hạn${where(sl)}, tổng <b>${money(sum)}</b>:`,
        table: { head: ['Phòng', 'Kỳ', 'Còn nợ', 'Trễ'], num: [2, 3],
          rows: list.slice(0, 8).map((i) => [i.roomCode, plabel(i.period), money(i.total - i.paid), lateDays(i) + ' ngày']) },
        actions: [{ label: 'Soạn tin nhắc nợ', send: 'Soạn tin nhắc nợ các phòng quá hạn' + (sl.buildingId ? ' ' + shortName(bOf(sl.buildingId)) : ''), solid: true },
          { label: 'Xem danh sách', go: `#/b/${bidFor(sl)}/invoices?status=overdue` }] };
    },
  };

  I.expiring = {
    desc: 'Hợp đồng sắp hết hạn / đã hết hạn / ngày hết hạn của một phòng', uses: 'building, room',
    entity: true,
    kw: ['het han', 'sap het', 'gia han', 'hop dong sap', 'hop dong het', 'hop dong qua han', 'tra phong', 'bao tra', 'ket thuc hop dong'],
    weak: ['hop dong'],
    run(sl) {
      if (sl.room || sl.tenantId) {
        const all = S.buildings.flatMap((b) => S.contractsOf(b.id));
        const c = all.find((x) => (x.status === 'active' || x.status === 'terminating') && (sl.room
          ? x.buildingId === sl.room.buildingId && x.roomCode === sl.room.code : x.tenantId === sl.tenantId));
        if (!c) return { facts: { đối_tượng: scopeText(sl) }, html: `${esc(scopeText(sl))} hiện không có hợp đồng đang hiệu lực.` };
        const d = S.daysToExpiry(c);
        return { facts: { phòng: c.roomCode, khách: c.tenantName, từ: U.fmtDate(c.start), đến: U.fmtDate(c.end), còn_lại_ngày: d,
          giá_thuê: money(c.rent), tiền_cọc: money(c.deposit) },
          html: `Hợp đồng phòng <b>${esc(c.roomCode)}</b> (${esc(c.tenantName || '')}) hết hạn <b>${U.fmtDate(c.end)}</b>, `
            + (d < 0 ? `<span class="as-bad">đã quá hạn ${-d} ngày</span>` : `còn <b>${d}</b> ngày`) + '.',
          actions: [{ label: 'Mở hợp đồng', go: `#/b/${c.buildingId}/contracts/${c.id}` }] };
      }
      const soon = S.expiringContracts(sl.buildingId || null, 30)
        .sort((x, y) => S.daysToExpiry(x) - S.daysToExpiry(y));
      const facts = { phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty', số_hợp_đồng: soon.length,
        danh_sách: soon.slice(0, 12).map((c) => ({ phòng: c.roomCode, khách: c.tenantName, hết_hạn: U.fmtDate(c.end), còn_lại_ngày: S.daysToExpiry(c) })) };
      if (!soon.length) return { facts, html: `Không có hợp đồng nào hết hạn trong 30 ngày tới${where(sl)} ✓` };
      return { facts,
        html: `<b>${soon.length}</b> hợp đồng cần chú ý${where(sl)}:`,
        table: { head: ['Phòng', 'Khách', 'Hết hạn'],
          rows: soon.slice(0, 8).map((c) => { const d = S.daysToExpiry(c);
            return [c.roomCode, c.tenantName || '', U.fmtDate(c.end) + (d < 0 ? `, quá ${-d} ngày` : `, còn ${d} ngày`)]; }) },
        actions: [{ label: 'Xem hợp đồng', go: `#/b/${bidFor(sl)}/contracts?filter=soon` }] };
    },
  };

  I.readings = {
    desc: 'Phòng chưa ghi chỉ số điện trong kỳ', uses: 'period, building',
    kw: ['chi so', 'ghi dien', 'ghi nuoc', 'chua ghi', 'chot so', 'cong to', 'dong ho dien', 'dong ho nuoc'],
    run(sl) {
      const per = sl.period || S.period(), miss = [];
      S.buildings.filter((b) => !sl.buildingId || b.id === sl.buildingId).forEach((b) => S.roomsOf(b.id)
        .filter((r) => r.status === 'occupied' || r.status === 'notice')
        .forEach((r) => { const rd = S.reading(b.id, r.code, per);
          if (!(rd && rd.elecCurr != null)) miss.push({ code: r.code, b }); }));
      const facts = { kỳ: plabel(per), phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        số_phòng_chưa_ghi: miss.length, danh_sách: miss.slice(0, 20).map((x) => x.code + ' · ' + x.b.name) };
      if (!miss.length) return { facts, html: `Tất cả phòng${where(sl)} đã ghi chỉ số kỳ <b>${plabel(per)}</b> ✓`,
        suggest: [`Tiêu thụ điện ${plabel(per)}`] };
      return { facts,
        html: `Còn <b>${miss.length}</b> phòng${where(sl)} chưa ghi chỉ số kỳ ${plabel(per)}: `
          + miss.slice(0, 15).map((x) => `<b>${esc(x.code)}</b>` + (sl.buildingId ? '' : ` <span class="as-muted">${esc(shortName(x.b))}</span>`)).join(', '),
        actions: [{ label: 'Ghi chỉ số', go: `#/b/${sl.buildingId || miss[0].b.id}/readings`, solid: true }] };
    },
  };

  I.usage = {
    desc: 'Tiêu thụ điện (kWh) trong kỳ', uses: 'period, building, room',
    kw: ['tieu thu', 'bao nhieu kwh', 'so kwh', 'bao nhieu khoi', 'so khoi', 'dien nuoc', 'xai bao nhieu', 'dung bao nhieu dien', 'so dien', 'so nuoc'],
    neg: ['chua ghi', 'ghi chi so'],
    run(sl) {
      const per = sl.period || S.period();
      if (sl.room) {
        const rd = S.reading(sl.room.buildingId, sl.room.code, per);
        const e = rd ? S.consumptionOf(rd, 'elec') : null;
        const facts = { phòng: sl.room.code, kỳ: plabel(per), điện_kWh: e };
        if (!rd || e == null) return { facts, html: `Phòng <b>${esc(sl.room.code)}</b> chưa có chỉ số kỳ ${plabel(per)}.` };
        return { facts, html: `Phòng <b>${esc(sl.room.code)}</b> kỳ ${plabel(per)}: điện <b>${U.number(Math.round(e))} kWh</b>`
          + '.' };
      }
      const a = S.dashboardAnalytics({ period: per, buildingId: sl.buildingId });
      const facts = { kỳ: plabel(per), phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        điện_kWh: Math.round(a.usage.elecKwh),
        số_phòng_đã_ghi: a.usage.roomsRead, số_phòng_đang_thuê: a.kpi.occupiedRooms };
      if (!a.usage.roomsRead) return { facts, html: `Kỳ <b>${plabel(per)}</b>${where(sl)} chưa có chỉ số điện nào.` };
      return { facts,
        html: `Kỳ <b>${plabel(per)}</b>${where(sl)}: điện <b>${U.number(Math.round(a.usage.elecKwh))} kWh</b>,
          (đã ghi ${a.usage.roomsRead}/${a.kpi.occupiedRooms} phòng).`,
        actions: [{ label: 'Xem chỉ số', go: `#/b/${bidFor(sl)}/readings` }] };
    },
  };

  I.incidents = {
    desc: 'Sự cố, yêu cầu sửa chữa của khách', uses: 'building, room',
    entity: true,
    kw: ['su co', 'sua chua', 'bao hong', 'hu hong', 'bi hong', 'bao tri', 'yeu cau sua', 'hong hoc', 'can sua'],
    run(sl) {
      let open = S.incidents.filter((x) => x.status !== 'done');
      if (sl.room) open = open.filter((x) => x.buildingId === sl.room.buildingId && x.roomCode === sl.room.code);
      else if (sl.buildingId) open = open.filter((x) => x.buildingId === sl.buildingId);
      const facts = { phạm_vi: scopeText(sl) || 'toàn công ty', số_sự_cố_đang_mở: open.length,
        danh_sách: open.slice(0, 10).map((x) => ({ phòng: x.roomCode, loại: x.category, nội_dung: x.title, trạng_thái: x.status })) };
      if (!open.length) return { facts, html: `Không còn sự cố nào đang mở${sl.room ? ' ở phòng ' + esc(sl.room.code) : where(sl)} ✓` };
      return { facts,
        html: `Đang có <b>${open.length}</b> sự cố${where(sl)}:`,
        table: { head: ['Phòng', 'Nội dung'], rows: open.slice(0, 8).map((x) => [x.roomCode || '', x.title || x.category || '']) },
        actions: [{ label: 'Quản lý sự cố', go: `#/b/${bidFor(sl)}/incidents` }] };
    },
  };

  I.expense = {
    desc: 'Chi phí vận hành, các khoản chi trong kỳ', uses: 'period, building',
    kw: ['chi phi', 'khoan chi', 'chi bao nhieu', 'chi tieu', 'tien chi', 'da chi', 'chi ra', 'tong chi'],
    run(sl) {
      const per = sl.period || S.period();
      const a = S.dashboardAnalytics({ period: per, buildingId: sl.buildingId });
      const facts = { kỳ: plabel(per), phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        tổng_chi: money(a.kpi.cost), kỳ_trước: money(a.kpi.costPrev),
        theo_hạng_mục: a.expenseMix.map((x) => ({ hạng_mục: x.label, số_tiền: money(x.value) })) };
      if (!a.expenseMix.length) return { facts, html: `Kỳ <b>${plabel(per)}</b>${where(sl)} chưa ghi khoản chi nào.`,
        actions: [{ label: 'Ghi khoản chi', go: `#/b/${bidFor(sl)}/expenses` }] };
      return { facts,
        html: `Chi phí kỳ <b>${plabel(per)}</b>${where(sl)}: <b>${money(a.kpi.cost)}</b> (${pctChange(a.kpi.cost, a.kpi.costPrev)} so với kỳ trước).`,
        table: { head: ['Hạng mục', 'Số tiền'], num: [1], rows: a.expenseMix.slice(0, 8).map((x) => [x.label, money(x.value)]) },
        actions: [{ label: 'Xem thu chi', go: `#/b/${bidFor(sl)}/expenses` }] };
    },
  };

  I.profit = {
    desc: 'Lợi nhuận, lãi lỗ, chênh lệch thu chi trong kỳ', uses: 'period, building',
    kw: ['loi nhuan', 'lai bao nhieu', 'lai lo', 'lo lai', 'chenh lech thu chi', 'lai duoc', 'loi duoc', 'con lai bao nhieu', 'thu chi'],
    run(sl) {
      const per = sl.period || S.period();
      const a = S.dashboardAnalytics({ period: per, buildingId: sl.buildingId }), k = a.kpi;
      const facts = { kỳ: plabel(per), phạm_vi: sl.buildingId ? bOf(sl.buildingId).name : 'toàn công ty',
        đã_thu: money(k.revenue), chi_phí: money(k.cost), lợi_nhuận: money(k.profit),
        lợi_nhuận_kỳ_trước: money(k.profitPrev), so_với_kỳ_trước: pctChange(k.profit, k.profitPrev) };
      return { facts,
        html: `Kỳ <b>${plabel(per)}</b>${where(sl)}: thu <b>${money(k.revenue)}</b> − chi <b>${money(k.cost)}</b>
          = lợi nhuận <b class="${k.profit < 0 ? 'as-bad' : ''}">${money(k.profit)}</b> (${pctChange(k.profit, k.profitPrev)} so với ${plabel(a.prevPeriod)}).`
          + (k.cost === 0 ? '<br><span class="as-muted">Kỳ này chưa ghi khoản chi nào nên lợi nhuận đang bằng doanh thu.</span>' : ''),
        suggest: ['So với tháng trước', 'Chi phí tháng này'] };
    },
  };

  I.claims = {
    desc: 'Phiếu khách báo đã chuyển khoản, giao dịch ngân hàng chờ đối soát', uses: 'building',
    kw: ['bao chuyen khoan', 'bao da chuyen', 'cho duyet', 'xac nhan chuyen', 'phieu chuyen khoan', 'khach chuyen khoan', 'chuyen khoan', 'doi soat'],
    run(sl) {
      const list = S.claimsOf(sl.buildingId || null, 'pending');
      const bank = S.unhandledBankTx ? S.unhandledBankTx() : [];
      const facts = { số_phiếu_chờ_duyệt: list.length, giao_dịch_ngân_hàng_chờ: bank.length,
        danh_sách: list.slice(0, 10).map((c) => ({ phòng: c.roomCode, số_tiền: money(c.amount), ngày: U.fmtDate(c.createdAt) })) };
      if (!list.length && !bank.length) return { facts, html: 'Không có phiếu chuyển khoản hay giao dịch nào chờ đối soát ✓' };
      return { facts,
        html: [list.length ? `<b>${list.length}</b> phiếu khách báo đã chuyển khoản` : '',
          bank.length ? `<b>${bank.length}</b> giao dịch ngân hàng chưa khớp` : ''].filter(Boolean).join(', ') + ' đang chờ bạn xử lý.',
        actions: [{ label: 'Mở đối soát', go: '#/transfers', solid: true }] };
    },
  };

  I.buildings = {
    desc: 'So sánh tình hình giữa các tòa nhà', uses: 'period',
    kw: ['cac toa', 'toa nao', 'so sanh toa', 'so sanh cac toa', 'giua cac toa', 'tung toa', 'chi nhanh', 'co so nao', 'toa nha nao'],
    run(sl) {
      const per = sl.period || S.period();
      const a = S.dashboardAnalytics({ period: per });
      const facts = { kỳ: plabel(per), danh_sách_tòa: a.byBuilding.map((b) => ({ tên: b.name, số_phòng: b.rooms,
        lấp_đầy: pct(b.occupancy), phòng_trống: b.vacant, phát_hành: money(b.billed), đã_thu: money(b.collected),
        tỷ_lệ_thu: pct(b.billed ? b.collected / b.billed : 0) })) };
      return { facts,
        html: `Các tòa nhà kỳ <b>${plabel(per)}</b>:`,
        table: { head: ['Tòa', 'Lấp đầy', 'Trống', 'Đã thu'], num: [1, 2, 3],
          rows: a.byBuilding.map((b) => [shortName(b), pct(b.occupancy), String(b.vacant), money(b.collected)]) },
        actions: [{ label: 'Xem tòa nhà', go: '#/buildings' }] };
    },
  };

  I.room = {
    desc: 'Thông tin một phòng cụ thể (giá, khách đang ở, công nợ, tài sản)', uses: 'room',
    entity: true, kw: ['thong tin phong', 'phong nay the nao'],
    run(sl) {
      if (!sl.room) return { facts: {}, html: 'Anh/chị cho em mã phòng cụ thể nhé (ví dụ <b>P101</b>).' };
      const b = bOf(sl.room.buildingId);
      const room = S.room(sl.room.buildingId, sl.room.code);
      if (!room) return { facts: {}, html: 'Em không tìm thấy phòng đó.' };
      const ct = S.contractsOf(b.id).find((c) => c.roomCode === room.code && (c.status === 'active' || c.status === 'terminating'));
      const debtList = S.invoicesOf(b.id).filter((i) => i.roomCode === room.code && unpaid(i));
      const debt = debtList.reduce((s, i) => s + (i.total - i.paid), 0);
      const assets = S.assetsOf(b.id, room.code);
      const openInc = S.incidents.filter((x) => x.buildingId === b.id && x.roomCode === room.code && x.status !== 'done').length;
      const facts = { phòng: room.code, tòa: b.name, tầng: room.floor, trạng_thái: ROOM_ST[room.status] || room.status,
        giá_thuê: money(room.price), diện_tích: room.area ? room.area + ' m²' : null,
        khách_đang_ở: ct ? ct.tenantName : null,
        hợp_đồng: ct ? { từ: U.fmtDate(ct.start), đến: U.fmtDate(ct.end), còn_lại_ngày: S.daysToExpiry(ct), tiền_cọc: money(ct.deposit) } : null,
        công_nợ: money(debt), số_tài_sản: assets.length, tài_sản: assets.slice(0, 10).map((x) => x.name), sự_cố_đang_mở: openInc };
      return { facts,
        html: `<b>Phòng ${esc(room.code)}</b> · ${esc(b.name)}: <b>${ROOM_ST[room.status] || esc(room.status)}</b>`,
        table: { head: ['', ''], kv: true, rows: [
          ['Giá thuê', money(room.price) + (room.area ? ' · ' + room.area + ' m²' : '')],
          ct ? ['Khách', ct.tenantName || ''] : null,
          ct ? ['Hợp đồng', 'đến ' + U.fmtDate(ct.end) + ' (còn ' + S.daysToExpiry(ct) + ' ngày)'] : null,
          ['Công nợ', debt ? money(debt) + ' · ' + debtList.length + ' hóa đơn' : 'không nợ'],
          ['Tài sản', assets.length ? assets.map((x) => x.name).slice(0, 4).join(', ') : 'chưa có'],
          openInc ? ['Sự cố', openInc + ' đang mở'] : null,
        ].filter(Boolean) },
        actions: [{ label: 'Mở sơ đồ phòng', go: `#/b/${b.id}/units` }]
          .concat(debt ? [{ label: 'Soạn tin nhắc nợ', send: `Soạn tin nhắc nợ phòng ${room.code} ${shortName(b)}` }] : []),
        suggest: debt ? ['Còn nợ những kỳ nào?', 'Hợp đồng phòng này hết hạn khi nào?']
          : ['Hợp đồng phòng này hết hạn khi nào?', 'Phòng này có sự cố gì không?'] };
    },
  };

  I.tenant = {
    desc: 'Thông tin một khách thuê cụ thể (theo tên hoặc số điện thoại)', uses: 'tenant',
    entity: true, kw: ['thong tin khach', 'khach ten', 'nguoi thue ten', 'so dien thoai cua'],
    run(sl) {
      const t = sl.tenantId && S.tenantById(sl.tenantId);
      if (!t) return { facts: {}, html: 'Em chưa tìm thấy khách nào khớp. Anh/chị cho em tên đầy đủ hoặc số điện thoại nhé.' };
      const b = bOf(t.buildingId);
      const ct = S.contractsOf(t.buildingId).find((c) => c.tenantId === t.id && c.status === 'active');
      const invs = S.invoicesOf(t.buildingId).filter((i) => (i.tenantId === t.id || i.roomCode === t.roomCode) && unpaid(i));
      const debt = invs.reduce((s, i) => s + (i.total - i.paid), 0);
      const plates = S.vehiclesOf(t).map((v) => v.plate).filter(Boolean);
      const facts = { họ_tên: t.fullName, điện_thoại: t.phone, phòng: t.roomCode || (ct && ct.roomCode) || null, tòa: b.name,
        công_nợ: money(debt), xe: plates, hợp_đồng: ct ? { từ: U.fmtDate(ct.start), đến: U.fmtDate(ct.end), tiền_thuê: money(ct.rent) } : null };
      return { facts,
        html: `<b>${esc(t.fullName)}</b>, phòng <b>${esc(t.roomCode || (ct && ct.roomCode) || 'chưa gắn phòng')}</b> · ${esc(shortName(b))}`,
        table: { head: ['', ''], kv: true, rows: [
          ['Điện thoại', t.phone || 'chưa có'],
          ['Công nợ', debt ? money(debt) : 'không nợ'],
          ct ? ['Hợp đồng', U.fmtDate(ct.start) + ' → ' + U.fmtDate(ct.end)] : null,
          plates.length ? ['Xe', plates.join(', ')] : null,
        ].filter(Boolean) },
        actions: [{ label: 'Xem khách thuê', go: `#/b/${t.buildingId}/tenants` }]
          .concat(t.phone ? [{ label: 'Mở Zalo', href: 'https://zalo.me/' + t.phone.replace(/\D/g, '') }] : []) };
    },
  };

  I.todo = {
    desc: 'Hôm nay cần làm gì, việc tồn đọng, tổng hợp nhanh', uses: 'building',
    kw: ['can lam gi', 'viec can', 'can xu ly', 'hom nay can', 'hom nay co gi', 'tinh hinh chung', 'tom tat',
      'tong quan', 'bao cao nhanh', 'viec ton dong', 'co gi moi', 'co gi can'],
    run(sl) {
      const bid = sl.buildingId || null;
      const a = S.dashboardAnalytics({ buildingId: bid });
      const per = S.period();
      const inB = (x) => !bid || x.buildingId === bid;
      const items = [];
      const expired = S.expiringContracts(bid, -1).length;
      const soon = S.expiringContracts(bid, 30).filter((c) => S.daysToExpiry(c) >= 0).length;
      const overdue = S.buildings.flatMap((b) => S.invoicesOf(b.id)).filter((i) => inB(i) && i.status === 'overdue').length;
      const noRead = S.buildings.filter((b) => !bid || b.id === bid).reduce((n, b) => n + S.roomsOf(b.id)
        .filter((r) => (r.status === 'occupied' || r.status === 'notice'))
        .filter((r) => { const rd = S.reading(b.id, r.code, per); return !(rd && rd.elecCurr != null); }).length, 0);
      const claims = S.claimsOf(bid, 'pending').length;
      const inc = S.incidents.filter((x) => inB(x) && x.status !== 'done').length;
      if (expired) items.push([`${expired} hợp đồng đã quá hạn`, `#/b/${bid || firstBid()}/contracts?filter=expired`]);
      if (overdue) items.push([`${overdue} hóa đơn quá hạn`, `#/b/${bid || firstBid()}/invoices?status=overdue`]);
      if (claims) items.push([`${claims} phiếu chuyển khoản chờ duyệt`, '#/transfers']);
      if (inc) items.push([`${inc} sự cố đang mở`, `#/b/${bid || firstBid()}/incidents`]);
      if (soon) items.push([`${soon} hợp đồng sắp hết hạn (30 ngày)`, `#/b/${bid || firstBid()}/contracts?filter=soon`]);
      if (noRead) items.push([`${noRead} phòng chưa ghi chỉ số`, `#/b/${bid || firstBid()}/readings`]);
      const facts = { kỳ: plabel(per), phạm_vi: bid ? bOf(bid).name : 'toàn công ty', đã_thu: money(a.kpi.revenue),
        công_nợ: money(a.kpi.debt), tỷ_lệ_lấp_đầy: pct(a.kpi.occupancy), việc_cần_làm: items.map((x) => x[0]) };
      return { facts,
        html: `Kỳ <b>${plabel(per)}</b>${where(sl)}: đã thu <b>${money(a.kpi.revenue)}</b> · công nợ <b>${money(a.kpi.debt)}</b>
          · lấp đầy <b>${pct(a.kpi.occupancy)}</b>.<br>`
          + (items.length ? 'Việc cần xử lý, xếp theo mức gấp:' : 'Không có việc gì tồn đọng ✓'),
        actions: items.map((x, i) => ({ label: x[0], go: x[1], solid: i === 0 })),
        suggest: overdue ? ['Soạn tin nhắc nợ các phòng quá hạn', 'Phòng nào còn nợ nhiều nhất?'] : ['Doanh thu 6 tháng gần đây'] };
    },
  };

  I.help = {
    desc: 'Hỏi trợ lý làm được gì',
    kw: ['giup gi', 'giup duoc gi', 'ho tro gi', 'lam duoc gi', 'lam duoc nhung gi', 'huong dan', 'ban la ai', 'em la ai', 'hoi duoc gi'],
    run() {
      return { facts: {},
        html: `Em đọc <b>số liệu thật</b> trong hệ thống và hiểu được <b>tháng</b>, <b>tòa nhà</b>, <b>phòng</b>, <b>tên khách</b>
          trong câu hỏi. Hỏi nối tiếp cũng được, em nhớ đang nói về phòng/tháng nào.`,
        table: { head: ['Thử hỏi', ''], kv: true, rows: [
          ['Doanh thu', 'Tháng trước thu được bao nhiêu? · Doanh thu 6 tháng'],
          ['So sánh', 'So với tháng trước thì sao?'],
          ['Công nợ', 'Gò Vấp ai còn nợ? · Phòng P101 còn nợ bao nhiêu?'],
          ['Nhắc nợ', 'Soạn tin nhắc nợ các phòng quá hạn'],
          ['Phòng', 'Còn phòng trống không? · P205 thế nào?'],
          ['Hỏi tiếp', '…rồi hỏi “còn P102 thì sao?”'],
        ] },
        suggest: ['Hôm nay cần xử lý gì?', 'Tháng trước thu được bao nhiêu?'] };
    },
  };

  /* Tên ngắn của từng ý định — để nói cho người dùng biết bot đã hiểu gì */
  const LABEL = { revenue: 'doanh thu', compare: 'so sánh kỳ', trend: 'xu hướng doanh thu', debt: 'công nợ',
    remind: 'soạn tin nhắc nợ', occupancy: 'phòng trống', overdue: 'hóa đơn quá hạn', expiring: 'hợp đồng',
    readings: 'ghi chỉ số', usage: 'điện', incidents: 'sự cố', expense: 'chi phí', profit: 'lợi nhuận',
    claims: 'chuyển khoản', buildings: 'các tòa nhà', room: 'thông tin phòng', tenant: 'thông tin khách',
    todo: 'việc cần làm', help: 'hướng dẫn' };

  /* Danh sách gửi cho Gemini để phân loại (chỉ tên + mô tả + tham số, KHÔNG kèm dữ liệu) */
  const INTENT_LIST = Object.keys(I).map((k) => ({ key: k, desc: I[k].desc, params: I[k].uses }));

  /* ============================================================
     HIỂU CÂU HỎI (tầng 1)
     ============================================================ */
  const GREET = /^(xin chao|chao|hello|hi|alo|chao em|chao ban)( (em|ban|bot|tro ly|anh|chi))?$/;
  const MIN_SCORE = 2;   // 1 cụm 2 chữ gõ sai nhẹ là đủ; 1 từ gợi ý lẻ thì chưa đủ

  /** Trả { intent, slots, carried[] } hoặc { clarify } hoặc null (không hiểu) */
  function understand(q, forced) {
    const sl = parseSlots(q);
    const ranked = N.score(q, I);
    let intent = forced || (ranked[0] && ranked[0].score >= MIN_SCORE ? ranked[0].key : null);
    const last = ctx.get();
    const follow = N.looksFollowUp(q);
    const back = N.refersBack(q);
    const whole = N.asksWhole(q);
    const hasSlot = !!(sl.period || sl.months || sl.buildingId || sl.roomCodes.length || sl.tenants.length);
    const carried = [];
    const lastIsEntity = !!(last && I[last.intent] && I[last.intent].entity);

    // Nhắc một phòng không tồn tại -> nói thẳng, không lặng lẽ trả số của cả công ty
    if (sl.unknownRoom) return { clarify: 'noroom', code: sl.unknownRoom, intent: intent || 'room', q };

    // Hỏi nhiều tháng thì là xem xu hướng, dù dùng chữ "doanh thu"
    if (sl.months && (!intent || intent === 'revenue')) intent = 'trend';

    if (!intent) {
      const namesOne = sl.roomCodes.length || sl.tenants.length === 1;
      if (namesOne) {
        // "còn P102 thì sao?" sau câu hỏi về công nợ -> công nợ của P102
        // "Phòng P101 thế nào?" (câu mới) -> thông tin phòng
        if (lastIsEntity && (follow || back)) { intent = last.intent; carried.push('hỏi tiếp'); }
        else intent = sl.roomCodes.length ? 'room' : 'tenant';
      } else if (last && (hasSlot || follow || back)) {
        intent = last.intent; carried.push('hỏi tiếp');
      }
    }
    if (!intent) return null;

    const slots = { period: sl.period, months: sl.months, buildingId: sl.buildingId,
      basePeriod: null, room: null, tenantId: null };

    // So sánh: "tháng 8 so với tháng 6" -> vế trước là kỳ xem, vế sau là kỳ gốc
    if (intent === 'compare') {
      const parts = N.norm(q).split(/\bso voi\b/);
      if (parts.length > 1) {
        const subj = N.extractPeriod(parts[0], S.period());
        const base = N.extractPeriod(parts.slice(1).join(' '), S.period());
        slots.period = subj ? subj.period : (last && last.slots.period) || null;
        if (!subj && slots.period) carried.push(plabel(slots.period));
        if (base) slots.basePeriod = base.how === 'prev' && slots.period ? S.prevPeriodOf(slots.period) : base.period;
      }
    }

    // Phòng: mã có thể trùng giữa các tòa -> dùng tòa đang nói, hoặc hỏi lại
    if (sl.roomCodes.length) {
      const code = sl.roomCodes[0];
      const hintB = sl.buildingId
        || (last && last.slots.room && last.slots.room.buildingId)
        || (last && last.slots.buildingId)
        || (ctx.recall('room') && ctx.recall('room').code === code && ctx.recall('room').buildingId)
        || ctx.recall('building') || null;
      let cands = roomCandidates(code, sl.buildingId || null);
      if (cands.length > 1 && hintB) {
        const same = cands.find((c) => c.buildingId === hintB);
        if (same) { cands = [same]; if (!sl.buildingId) carried.push(shortName(bOf(hintB))); }
      }
      if (cands.length > 1) return { clarify: 'room', code, cands, intent, q };
      if (!cands.length) return { clarify: 'noroom', code, intent, q };
      slots.room = cands[0]; slots.buildingId = null;
    } else if (sl.tenants.length > 1 && (intent === 'tenant' || I[intent].entity)) {
      return { clarify: 'tenant', cands: sl.tenants.slice(0, 5), intent, q };
    } else if (sl.tenants.length === 1 && I[intent].entity) {
      slots.tenantId = sl.tenants[0].id;
    }

    // Kế thừa từ câu trước — chỉ khi câu này trông như hỏi tiếp
    if (last) {
      const cont = carried.includes('hỏi tiếp') || follow || back;
      if (!slots.period && last.slots.period && cont && intent !== 'compare') {
        slots.period = last.slots.period; carried.push(plabel(slots.period));
      }
      if (!slots.buildingId && !slots.room && last.slots.buildingId && cont && !whole) {
        slots.buildingId = last.slots.buildingId; carried.push(shortName(bOf(slots.buildingId)));
      }
      if (!slots.room && !slots.tenantId && I[intent].entity && !whole && cont) {
        if (last.slots.room) { slots.room = last.slots.room; carried.push('Phòng ' + slots.room.code); }
        else if (last.slots.tenantId) {
          slots.tenantId = last.slots.tenantId;
          carried.push((S.tenantById(slots.tenantId) || {}).fullName || 'khách');
        }
      }
      if (!slots.months && last.slots.months && intent === 'trend' && cont) slots.months = last.slots.months;
    }
    if (intent === 'room' && !slots.room) return null;
    if (intent === 'tenant' && !slots.tenantId) return null;
    return { intent, slots, carried };
  }

  function clarifyReply(c) {
    ctx.set(c.intent, {});
    if (c.clarify === 'noroom') {
      return { source: 'rule', intent: c.intent,
        html: `Em không thấy phòng <b>${esc(c.code)}</b> ở tòa nào. Anh/chị kiểm tra lại mã phòng giúp em.`,
        actions: [{ label: 'Mở sơ đồ phòng', go: `#/b/${firstBid()}/units` }] };
    }
    if (c.clarify === 'room') {
      return { source: 'rule', intent: c.intent,
        html: `Mã <b>${esc(c.code)}</b> có ở ${c.cands.length} tòa. Anh/chị hỏi phòng ở tòa nào ạ?`,
        actions: c.cands.map((x) => ({ label: shortName(bOf(x.buildingId)),
          send: `${c.q.replace(/\?+\s*$/, '')} ${shortName(bOf(x.buildingId))}`.trim() })) };
    }
    return { source: 'rule', intent: c.intent,
      html: `Có <b>${c.cands.length}</b> khách trùng tên. Anh/chị chọn giúp em:`,
      actions: c.cands.map((t) => ({ label: `${t.fullName} · ${t.roomCode || ''}`, send: `${c.q.replace(/\?+\s*$/, '')} ${t.phone || t.fullName}` })) };
  }

  function pack(intent, slots, r, source, carried) {
    ctx.set(intent, slots);
    if (slots.room) ctx.remember('room', slots.room);
    if (slots.buildingId) ctx.remember('building', slots.buildingId);
    else if (slots.room) ctx.remember('building', slots.room.buildingId);
    const scope = scopeText(slots);
    return { source, intent, html: r.html, facts: r.facts, actions: r.actions || [],
      table: r.table || null, chart: r.chart || null, copies: r.copies || null,
      suggest: r.suggest || null, scope,
      // Có kế thừa ngữ cảnh -> nói rõ đã hiểu câu hỏi thành gì, để người dùng kịp sửa
      note: carried && carried.length ? `Hiểu là: ${LABEL[intent] || intent}${scope ? ' · ' + scope : ''}` : '' };
  }

  /* ---------- Đầu vào chính ---------- */
  async function ask(text) {
    const q = (text || '').trim();
    if (!q) return { html: 'Anh/chị nhập câu hỏi giúp em ạ.', source: 'rule' };

    if (GREET.test(N.norm(q))) {
      return { source: 'rule', html: `Chào anh/chị <b>${esc((S.prefs && S.prefs.userName) || '')}</b>! Anh/chị muốn xem gì ạ?`,
        suggest: ['Hôm nay cần xử lý gì?', 'Tháng trước thu được bao nhiêu?', 'Còn phòng trống không?'] };
    }

    const u = understand(q);
    if (u && u.clarify) return clarifyReply(u);
    if (u) return pack(u.intent, u.slots, I[u.intent].run(u.slots, q), 'rule', u.carried);

    /* ---------- TẦNG 2: Gemini ---------- */
    if (!G() || !G().configured()) return notSupported();
    const last = ctx.get();
    const context = last ? `Câu trước đang hỏi "${last.intent}" về: ${scopeText(last.slots) || 'toàn công ty'}.` : '';
    const ck = 'a|' + N.norm(q) + '|' + (last ? last.intent + scopeText(last.slots) : '');

    try {
      const cached = G().cacheGet(ck);
      const cls = cached || await G().classify(q, INTENT_LIST, {
        context, today: S.period(),
        buildings: S.buildings.map((b) => b.name),
      });
      if (!cached) G().cacheSet(ck, cls);
      if (cls.intent === 'unknown' || !I[cls.intent] || cls.confidence < 0.35) return notSupported();

      // Code KIỂM TRA lại tham số mô hình đưa — không tin mù quáng
      const p = cls.params || {};
      const hint = [p.period, p.building, p.roomCode, p.name, p.months ? p.months + ' tháng gần đây' : ''].filter(Boolean).join(' ');
      if (p.period && /^\d{4}-\d{2}$/.test(p.period)) {
        const [y, m] = p.period.split('-').map(Number);
        if (y < 2000 || y > 2100 || m < 1 || m > 12) delete p.period;
      }
      const v = understand(q + ' ' + hint, cls.intent);
      if (v && v.clarify) return clarifyReply(v);
      if (!v) return notSupported();
      if (p.period && /^\d{4}-\d{2}$/.test(p.period) && !v.slots.period) v.slots.period = p.period;

      const r = I[v.intent].run(v.slots, q);
      let html = r.html, source = 'ai';
      // Câu có bảng / biểu đồ / tin soạn sẵn: giữ nguyên câu mẫu, chỉ thay lời dẫn
      try {
        const composed = await G().compose(q, r.facts,
          'Xưng "em", gọi người dùng là "anh/chị". Người hỏi là chủ trọ hoặc nhân viên quản lý.'
          + (r.table || r.chart ? ' Chỉ viết 1 đến 2 câu tóm tắt, vì bảng chi tiết sẽ hiện ngay bên dưới.' : ''));
        if (!r.copies) html = composed.replace(/```[a-z]*|```/g, '').trim();
        else source = 'rule';
      } catch (e) { source = 'rule'; }
      return pack(v.intent, v.slots, Object.assign({}, r, { html }), source, v.carried);
    } catch (e) {
      const code = e.message || '';
      if (code === 'AI_QUOTA' || code === 'AI_BAD_KEY' || code === 'AI_NOT_CONFIGURED') {
        return { source: 'error', html: G().errText(code) + '<br>Em vẫn trả lời được các câu hỏi thường gặp ạ.' };
      }
      return notSupported();
    }
  }

  function notSupported() {
    return { source: 'fallback',
      html: `Câu này em chưa hiểu ạ. Em tra được doanh thu, công nợ, phòng trống, hóa đơn quá hạn, hợp đồng,
        chỉ số điện, sự cố, chi phí, lợi nhuận, theo <b>tháng</b>, <b>tòa</b> hoặc <b>phòng</b>.`,
      suggest: ['Em làm được gì?', 'Hôm nay cần xử lý gì?'] };
  }

  const SUGGESTIONS = [
    'Hôm nay cần xử lý gì?',
    'Tháng trước thu được bao nhiêu?',
    'Phòng nào còn nợ nhiều nhất?',
    'Còn phòng trống không?',
    'Doanh thu 6 tháng gần đây',
    'Soạn tin nhắc nợ các phòng quá hạn',
  ];

  return { ask, understand, SUGGESTIONS, INTENT_LIST, intents: I, context: ctx, scopeText };
})();

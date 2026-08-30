/* ============================================================
   Trang: Hồ sơ khách thuê + thêm bằng nhận diện CCCD (§3.4)
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, h = U.html, raw = U.raw;

  let tnSearch = '', tnFilter = null;
  const TN_FILTERS = [
    { key: 'tamtru',   label: 'Đã đăng ký tạm trú',  tone: 'success', test: t => t.tamtru },
    { key: 'notamtru', label: 'Chưa đăng ký tạm trú', tone: 'warning', test: t => !t.tamtru },
    { key: 'docs',     label: 'Khách đã nộp giấy tờ', tone: 'success', test: t => t.cccdFront && t.cccdBack },
    { key: 'nodocs',   label: 'Khách chưa nộp giấy tờ', tone: 'danger', test: t => !(t.cccdFront && t.cccdBack) },
  ];

  const VEH_TYPES = ['Xe máy', 'Ô tô', 'Xe đạp', 'Xe điện', 'Khác'];
  const vehIcon = (type) => ({ 'Xe máy': '🏍️', 'Ô tô': '🚗', 'Xe đạp': '🚲', 'Xe điện': '🛵' }[type] || '🚗');

  function tenantRow(t) {
    const doc = (ok, label) => ok ? `<span class="tn-doc-ok">✓ ${label}</span>` : `<span class="tn-doc-miss">✗ ${label}</span>`;
    return `<tr>
      <td><div class="row-gap-2 tn-name">
        <span class="avatar" style="width:32px;height:32px;flex:0 0 32px;font-size:12px">${U.initials(t.fullName)}</span>
        <div><b>${t.fullName}</b><div class="muted text-xs mono">${t.roomCode}</div>
          <div class="tn-badges">${t.isRep ? '<span class="tn-tag rep">Đại diện hợp đồng</span>' : ''}
            <span class="tn-tag warn">${t.ttlock ? 'Đã kết nối' : 'Chưa kết nối'}</span></div></div></div></td>
      <td><span class="tn-ttlock ${t.ttlock ? 'on' : ''}">${t.ttlock ? 'Đã kết nối TTLock' : 'Chưa kết nối TTLock'}</span></td>
      <td class="mono b">${t.phone}</td>
      <td class="mono">${t.dob}</td>
      <td>${t.gender}</td>
      <td class="tn-cell-lines tn-cell-addr"><div class="ln"><span class="k">Địa chỉ:</span>${U.esc(t.address)}</div>
        <div class="ln"><span class="k">Nghề nghiệp:</span>${U.esc(t.occupation)}</div></td>
      <td class="tn-cell-lines tn-cell-cccd">
        <div class="ln"><span class="k">Số CCCD:</span><b class="mono">${t.idNumber}</b></div>
        <div class="ln"><span class="k">Ngày cấp:</span><span class="mono">${t.cccdIssueDate}</span></div>
        <div class="ln"><span class="k">Nơi cấp:</span>${t.cccdIssuePlace}</div>
        <div class="ln"><span class="k">Hình:</span>${doc(t.cccdFront, 'Mặt trước')} | ${doc(t.cccdBack, 'Mặt sau')}</div></td>
      <td>${(() => { const vs = S.vehiclesOf(t); return vs.length
        ? vs.map(v => `<div style="margin-bottom:2px"><span class="veh-chip">${vehIcon(v.type)} <b class="mono">${U.esc(v.plate || '—')}</b></span></div>`).join('')
        : '<span class="faint">Chưa có</span>'; })()}</td>
      <td class="col-actions"><button class="kebab" data-tn="${t.id}" aria-label="Thao tác">⋯</button></td>
    </tr>`;
  }

  const tnPage = { page: 1, size: 8 };   // phân trang theo PHÒNG (mỗi trang N phòng)

  function filteredTenants(ctx) {
    let list = S.tenantsOf(ctx.bid);
    const f = TN_FILTERS.find(x => x.key === tnFilter);
    if (f) list = list.filter(f.test);
    if (tnSearch) { const q = tnSearch.toLowerCase();
      list = list.filter(t => (t.fullName || '').toLowerCase().includes(q) || (t.phone || '').includes(q)); }
    return list;
  }

  function renderGroups(ctx) {
    const list = filteredTenants(ctx);
    if (list.length === 0) return { body: `<tr><td colspan="9"><div class="empty"><div class="ic">👤</div><h4>Không có khách thuê phù hợp</h4><p class="muted">Thử đổi từ khóa hoặc bộ lọc.</p></div></td></tr>`, pg: null };
    const rooms = [...new Set(list.map(t => t.roomCode || '(chưa gắn phòng)'))].sort();
    const pg = UI.paginate(rooms, tnPage, { unit: 'phòng', sizes: [8, 16, 32] });
    const body = pg.items.map(rc => {
      const grp = list.filter(t => (t.roomCode || '(chưa gắn phòng)') === rc);
      return `<tr class="tenant-group-head"><td colspan="9">${U.esc(rc)} <span class="cnt">(${grp.length}) khách thuê</span></td></tr>`
        + grp.map(tenantRow).join('');
    }).join('');
    return { body, pg };
  }

  function tnChips(ctx) {
    const all = S.tenantsOf(ctx.bid);
    return TN_FILTERS.map(f => {
      const n = all.filter(f.test).length;
      const on = tnFilter === f.key;
      return `<button class="lz-chip ${on ? 'on' : ''}" data-tnfilter="${f.key}">
        <span class="lz-chip-box">${on ? '✓' : ''}</span>${f.label}
        <span class="lz-chip-cnt s-${f.tone}">${n}</span></button>`;
    }).join('');
  }

  HH.pages.tenants = {
    render(ctx) {
      const total = S.tenantsOf(ctx.bid).length;
      const noTamtru = S.tenantsOf(ctx.bid).filter(t => !t.tamtru).length;
      const g = renderGroups(ctx); ctx._g = g;
      return h`
        <div class="page-head">
          <div><div class="page-title-lg">Khách thuê</div>
            <div class="page-sub">${ctx.building.name} · ${total} người đang ở</div></div>
          <div class="page-actions">
            <button class="btn btn-outline" id="tnTamtru">${raw(HH.icon('clock', 16))} Hết tạm trú/Visa
              ${raw(noTamtru ? `<span class="cnt-badge">${noTamtru}</span>` : '')}</button>
            <button class="btn btn-outline" id="tnExport">${raw(HH.icon('sheet', 16))} Xuất Excel</button>
            <button class="btn btn-primary" data-primary-new>${raw(HH.icon('plus', 16))} Thêm khách thuê</button>
          </div>
        </div>
        <div class="between wrap" style="gap:12px;margin-bottom:16px">
          <div class="lz-chips" style="margin-bottom:0">${raw(HH.icon('filter', 16))}${raw(tnChips(ctx))}</div>
          <div class="dt-search" style="max-width:290px"><span class="ic">${raw(HH.icon('search', 16))}</span>
            <input class="input" id="tnSearch" placeholder="Tìm tên hoặc số điện thoại..." value="${tnSearch}"></div>
        </div>
        <div class="dt-wrap"><div class="dt-scroll"><table class="dt">
          <thead><tr>
            <th>Tên khách thuê</th><th>Khóa thông minh</th><th>Số điện thoại</th>
            <th>Ngày sinh</th><th>Giới tính</th><th>Địa chỉ & Nghề nghiệp</th>
            <th>Thông tin CCCD</th><th>Xe</th><th></th>
          </tr></thead>
          <tbody id="tnBody">${raw(g.body)}</tbody>
        </table></div></div>
        <div id="tnPg">${raw(g.pg ? g.pg.html : '')}</div>`;
    },
    mount(ctx) {
      const wirePg = () => { const g = ctx._g; if (g && g.pg) g.pg.attach(document, () => { HH.router.render(); }); };
      wirePg();
      document.querySelector('[data-primary-new]').onclick = () => HH.router.go(`/b/${ctx.bid}/tenants/new`);
      document.getElementById('tnExport').onclick = () => {
        U.downloadCSV(`khach-thue-${ctx.bid}.csv`,
          ['Phòng', 'Họ tên', 'Đại diện', 'SĐT', 'Ngày sinh', 'Giới tính', 'Nghề nghiệp', 'Địa chỉ', 'Số CCCD', 'Ngày cấp', 'Nơi cấp', 'Biển số xe', 'TTLock', 'Tạm trú'],
          S.tenantsOf(ctx.bid).map(t => [t.roomCode, t.fullName, t.isRep ? 'x' : '', t.phone, t.dob, t.gender,
            t.occupation, t.address, t.idNumber, t.cccdIssueDate, t.cccdIssuePlace,
            S.vehiclesOf(t).map(v => `${v.plate}${v.type ? ' (' + v.type + ')' : ''}`).join('; '),
            t.ttlock ? 'Đã kết nối' : 'Chưa', t.tamtru ? 'Đã ĐK' : 'Chưa']));
        UI.toast('Đã tải file Excel (CSV) khách thuê', { type: 'ok' });
      };
      const tt = document.getElementById('tnTamtru');
      if (tt) tt.onclick = () => { tnFilter = tnFilter === 'notamtru' ? null : 'notamtru'; tnPage.page = 1; HH.router.render(); };
      const refresh = () => {
        tnPage.page = 1;
        const g = renderGroups(ctx); ctx._g = g;
        document.getElementById('tnBody').innerHTML = g.body;
        document.getElementById('tnPg').innerHTML = g.pg ? g.pg.html : '';
        wireRows(ctx); wirePg();
      };
      document.querySelectorAll('[data-tnfilter]').forEach(b => b.onclick = () => {
        tnFilter = (tnFilter === b.dataset.tnfilter) ? null : b.dataset.tnfilter; tnPage.page = 1; HH.router.render();
      });
      const s = document.getElementById('tnSearch');
      s.addEventListener('input', U.debounce(() => { tnSearch = s.value; refresh(); }, 180));
      wireRows(ctx);
    },
  };

  function wireRows(ctx) {
    document.querySelectorAll('[data-tn]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const t = S.tenantById(b.dataset.tn);
      UI.openMenu(b, [
        { icon: '👁', label: 'Xem hồ sơ', onClick: () => showTenant(t) },
        { icon: '🏍️', label: `Quản lý xe (${S.vehiclesOf(t).length})`, onClick: () => vehicleDialog(t) },
        { icon: '🔐', label: t.ttlock ? 'Ngắt kết nối khóa' : 'Kết nối khóa TTLock', onClick: () => { t.ttlock = !t.ttlock; S.persist(); UI.toast(t.ttlock ? 'Đã kết nối khóa' : 'Đã ngắt kết nối', { type: 'ok' }); HH.router.render(); } },
        { icon: '📋', label: t.tamtru ? 'Đã đăng ký tạm trú' : 'Đánh dấu đã đăng ký tạm trú', onClick: () => { t.tamtru = !t.tamtru; S.persist(); UI.toast(t.tamtru ? 'Đã đánh dấu đăng ký tạm trú' : 'Đã bỏ đánh dấu', { type: 'ok' }); HH.router.render(); } },
      ]);
    });
  }

  /* ---------------- QUẢN LÝ XE ---------------- */
  function vehicleDialog(t) {
    const draw = (el) => {
      const list = S.vehiclesOf(t);
      el.querySelector('[data-vlist]').innerHTML = list.length ? list.map((v, i) => `
        <div class="card" style="box-shadow:none;margin-bottom:10px"><div class="card-pad" style="padding:12px">
          <div class="between" style="margin-bottom:8px">
            <b>${vehIcon(v.type)} ${U.esc(v.type || 'Xe')}</b>
            <button class="kebab" data-delveh="${i}" title="Xóa xe">✕</button></div>
          <div class="grid-2">
            <div class="field"><label>Biển số</label><input class="input mono" data-v="${i}" data-f="plate" value="${U.esc(v.plate || '')}" placeholder="59A1-12345"></div>
            <div class="field"><label>Loại xe</label><select class="select" data-v="${i}" data-f="type">
              ${VEH_TYPES.map(x => `<option ${v.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="field"><label>Hãng / model</label><input class="input" data-v="${i}" data-f="brand" value="${U.esc(v.brand || '')}" placeholder="VD: Honda Vision"></div>
            <div class="field"><label>Màu xe</label><input class="input" data-v="${i}" data-f="color" value="${U.esc(v.color || '')}" placeholder="VD: Đen"></div>
          </div>
          <div class="field" style="margin-top:10px"><label>Ghi chú</label><input class="input" data-v="${i}" data-f="note" value="${U.esc(v.note || '')}" placeholder="VD: gửi hầm B1"></div>
        </div></div>`).join('')
        : `<div class="empty" style="padding:24px"><div class="ic">🏍️</div><h4>Chưa đăng ký xe nào</h4>
            <p class="muted">Thêm xe để quản lý chỗ để xe và phí gửi xe.</p></div>`;
      el.querySelectorAll('[data-delveh]').forEach(b => b.onclick = () => {
        S.removeVehicle(t.id, +b.dataset.delveh); UI.toast('Đã xóa xe', { type: 'ok' }); draw(el);
      });
      el.querySelectorAll('[data-v]').forEach(inp => inp.onchange = () => {
        S.updateVehicle(t.id, +inp.dataset.v, { [inp.dataset.f]: inp.value.trim() });
      });
    };
    UI.modal({
      title: `Xe của ${t.fullName}`, size: 'wide',
      bodyHtml: `<p class="muted" style="margin-bottom:12px">Phòng <b>${U.esc(t.roomCode || '—')}</b> · thay đổi được lưu ngay khi rời ô nhập.</p>
        <div data-vlist></div>
        <button class="btn btn-outline" id="addVeh">＋ Thêm xe</button>`,
      footHtml: `<span class="spacer"></span><button class="btn btn-primary" data-close>Xong</button>`,
      onMount(el, close) {
        draw(el);
        el.querySelector('#addVeh').onclick = () => {
          S.addVehicle(t.id, { plate: '', type: 'Xe máy' });
          draw(el);
          const first = el.querySelector('[data-f="plate"]'); if (first) first.focus();
        };
      },
      onClose() { HH.router.render(); },
    });
  }

  function showTenant(t) {
    UI.modal({ title: t.fullName, size: 'wide', bodyHtml: h`
      <div class="row-gap-2" style="margin-bottom:14px">
        ${raw(t.isRep ? '<span class="tn-tag rep">Đại diện hợp đồng</span>' : '')}
        <span class="tn-ttlock ${raw(t.ttlock ? 'on' : '')}">${t.ttlock ? 'Đã kết nối TTLock' : 'Chưa kết nối TTLock'}</span>
        <span class="badge ${raw(t.tamtru ? 's-success' : 's-warning')}"><span class="dot"></span>${t.tamtru ? 'Đã đăng ký tạm trú' : 'Chưa đăng ký tạm trú'}</span>
      </div>
      <div class="grid-2">
        <div class="field"><label>Số CCCD</label><div class="mono b">${t.idNumber}</div></div>
        <div class="field"><label>Ngày sinh</label><div class="mono">${t.dob}</div></div>
        <div class="field"><label>Giới tính</label><div>${t.gender}</div></div>
        <div class="field"><label>Điện thoại</label><div class="mono">${t.phone}</div></div>
        <div class="field"><label>Ngày cấp CCCD</label><div class="mono">${t.cccdIssueDate}</div></div>
        <div class="field"><label>Nơi cấp</label><div>${t.cccdIssuePlace}</div></div>
        <div class="field"><label>Nghề nghiệp</label><div>${t.occupation}</div></div>
        <div class="field"><label>Phòng</label><div>${t.roomCode || '—'}</div></div>
        <div class="field"><label>Địa chỉ thường trú</label><div>${t.address}</div></div>
        <div class="field"><label>Xe đã đăng ký</label><div>${raw(S.vehiclesOf(t).length
          ? S.vehiclesOf(t).map(v => `<div class="mono">${vehIcon(v.type)} <b>${U.esc(v.plate || '—')}</b>${v.brand ? ' · ' + U.esc(v.brand) : ''}${v.color ? ' · ' + U.esc(v.color) : ''}</div>`).join('')
          : '<span class="faint">Chưa có</span>')}</div></div>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <div class="ocr-img" style="min-height:140px">${raw(t.cccdFront ? 'Ảnh CCCD mặt trước' : '<span style="color:var(--danger)">Chưa có ảnh mặt trước</span>')}</div>
        <div class="ocr-img" style="min-height:140px">${raw(t.cccdBack ? 'Ảnh CCCD mặt sau' : '<span style="color:var(--danger)">Chưa có ảnh mặt sau</span>')}</div>
      </div>`, footHtml: `<span class="spacer"></span><button class="btn btn-outline" data-close>Đóng</button>` });
  }

  /* ---------------- Thêm khách thuê (OCR) ---------------- */
  const OCR_FIELDS = [
    { key: 'fullName', label: 'Họ và tên' },
    { key: 'idNumber', label: 'Số CCCD' },
    { key: 'dateOfBirth', label: 'Ngày sinh' },
    { key: 'gender', label: 'Giới tính' },
    { key: 'hometown', label: 'Quê quán' },
    { key: 'address', label: 'Địa chỉ thường trú' },
  ];

  HH.pages.tenantNew = {
    render(ctx) {
      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/tenants">← Khách thuê</a>
          <div class="page-title">Thêm khách thuê</div></div></div>
        <div class="card card-pad" id="ocrCard">
          <div class="ocr-drop" id="ocrDrop">
            <div class="big-ic">📷</div>
            <h3 style="margin:8px 0">Chụp hoặc tải ảnh căn cước công dân</h3>
            <p class="muted">Hệ thống tự nhận diện và điền sẵn thông tin</p>
            <div style="margin-top:16px" class="row-gap-2" style="justify-content:center">
              <label class="btn btn-primary">Chọn ảnh mặt trước<input type="file" accept="image/*" id="ocrFile" hidden></label>
            </div>
            <p class="muted text-sm" style="margin-top:12px">Hoặc kéo thả ảnh vào đây</p>
          </div>
          <div class="center" style="margin-top:16px"><a href="#" id="manualLink">Hoặc nhập thủ công →</a></div>
        </div>`;
    },
    mount(ctx) {
      const file = document.getElementById('ocrFile');
      const drop = document.getElementById('ocrDrop');
      file.onchange = () => { if (file.files[0]) startOcr(ctx, file.files[0]); };
      ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--brand-500)'; }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = ''; }));
      drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) startOcr(ctx, e.dataTransfer.files[0]); });
      document.getElementById('manualLink').onclick = (e) => { e.preventDefault(); showForm(ctx, blankData(), null); };
    },
  };

  function blankData() {
    const d = {}; OCR_FIELDS.forEach(f => d[f.key] = { value: '', confidence: 1 }); return d;
  }

  function startOcr(ctx, fileObj) {
    const card = document.getElementById('ocrCard');
    const reader = new FileReader();
    reader.onload = () => {
      card.innerHTML = h`<div class="ocr-split">
        <div class="ocr-img"><img src="${raw(reader.result)}" alt="CCCD" style="width:100%;object-fit:cover"></div>
        <div><div class="b" style="margin-bottom:8px">Đang nhận diện...</div>
          <div class="progress-track"><div class="progress-fill" id="ocrProg" style="width:8%"></div></div>
          <p class="muted text-sm" style="margin-top:8px">Đang trích xuất thông tin từ ảnh giấy tờ</p></div></div>`;
      let p = 8; const prog = document.getElementById('ocrProg');
      const timer = setInterval(() => { p = Math.min(100, p + 12 + Math.random() * 12); prog.style.width = p + '%';
        if (p >= 100) { clearInterval(timer); setTimeout(() => showForm(ctx, mockOcr(), reader.result), 250); } }, 160);
    };
    reader.readAsDataURL(fileObj);
  }

  function mockOcr() {
    // Giả lập kết quả OCR — vài trường độ tin cậy thấp để minh họa
    return {
      fullName: { value: 'NGUYỄN VĂN AN', confidence: 0.98 },
      idNumber: { value: '079201001234', confidence: 0.95 },
      dateOfBirth: { value: '15/03/1992', confidence: 0.62 },
      gender: { value: 'Nam', confidence: 0.99 },
      hometown: { value: 'Hà Nội', confidence: 0.91 },
      address: { value: 'Số 12, P. Tân Phú, Quận 7, TP.HCM', confidence: 0.74 },
    };
  }

  function showForm(ctx, data, imgUrl) {
    const card = document.getElementById('ocrCard');
    const existing = data.idNumber && data.idNumber.value ? S.tenantByIdNumber(data.idNumber.value.replace(/\s/g, '')) : null;
    const fieldsHtml = OCR_FIELDS.map(f => {
      const d = data[f.key] || { value: '', confidence: 1 };
      const low = d.confidence < 0.8;
      const conf = low ? '<span class="conf warn" title="Độ tin cậy thấp">⚠</span>' : (d.value ? '<span class="conf ok">✓</span>' : '');
      return h`<div class="field ocr-field ${raw(low ? 'low' : '')}">
        <label>${f.label}</label>
        <input class="input" data-k="${f.key}" value="${d.value}">
        ${raw(conf)}
        ${raw(low ? '<span class="hint" style="color:var(--warning)">Độ tin cậy thấp, vui lòng kiểm tra</span>' : '')}
      </div>`;
    }).join('');

    const dupAlert = existing ? `<div class="alert alert-purple" style="margin-bottom:16px"><span class="ic">ℹ</span>
      <div>Khách thuê này đã có hồ sơ từ hợp đồng trước (${existing.fullName}).
      <button class="btn btn-sm btn-outline" id="reuseBtn" style="margin-left:8px">Dùng lại hồ sơ cũ</button></div></div>` : '';

    const imgPane = imgUrl
      ? `<div class="ocr-img"><img src="${imgUrl}" style="width:100%"><button class="btn btn-sm btn-outline" style="position:absolute;bottom:8px;left:8px">🔍 Phóng to</button></div>`
      : `<div class="ocr-img" style="min-height:220px">Nhập thủ công<br>(không có ảnh)</div>`;

    card.innerHTML = h`
      ${raw(dupAlert)}
      <div class="ocr-split">
        <div>${raw(imgPane)}</div>
        <div><div class="grid-2">${raw(fieldsHtml)}</div>
          <div class="grid-2" style="margin-top:12px">
            <div class="field"><label>Điện thoại</label><input class="input mono" data-k="phone" placeholder="09xxxxxxxx"></div>
            <div class="field"><label>Ở phòng (tùy chọn)</label>
              <select class="select" data-k="roomCode">
                <option value="">— Chưa gắn phòng —</option>
                ${raw(S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code))
                  .map(r => `<option value="${r.code}">${r.code} · ${U.esc(r.typeLabel)}${r.tenantName ? ' (đang có khách)' : ''}</option>`).join(''))}
              </select>
              <span class="hint">Chọn phòng để khách hiện trong danh sách phòng đó</span></div>
          </div>
        </div>
      </div>
      <div class="between" style="margin-top:20px">
        <a href="#/b/${ctx.bid}/tenants">Hủy</a>
        <button class="btn btn-primary" id="saveTenant">Lưu hồ sơ khách thuê</button>
      </div>`;

    if (existing) document.getElementById('reuseBtn').onclick = () => {
      UI.toast(`Đã dùng lại hồ sơ ${existing.fullName}`, { type: 'ok' }); HH.router.go(`/b/${ctx.bid}/tenants`);
    };
    document.getElementById('saveTenant').onclick = (e) => {
      const btn = e.currentTarget;
      const get = (k) => (card.querySelector(`[data-k="${k}"]`) || {}).value || '';
      if (!get('fullName').trim() || !get('idNumber').trim()) {
        UI.toast('Vui lòng nhập họ tên và số CCCD', { type: 'error' }); return;
      }
      btn.classList.add('loading');
      setTimeout(() => {
        S.addTenant({
          id: U.uid('tn'), buildingId: ctx.bid, roomCode: get('roomCode').trim() || null,
          fullName: get('fullName').trim(), idNumber: get('idNumber').replace(/\s/g, ''),
          dob: get('dateOfBirth'), gender: get('gender'), hometown: get('hometown'),
          phone: get('phone'), occupation: get('occupation') || '', address: get('address') || '',
          cccdIssueDate: '', cccdIssuePlace: get('cccdIssuePlace') || 'Cục CSQLHC về TTXH',
          cccdFront: true, cccdBack: !!get('backUploaded'), vehiclePlate: null,
          ttlock: false, tamtru: false, occupants: 1, isRep: false,
        });
        S.log('tenant.create', `Thêm khách thuê ${get('fullName')}`);
        UI.toast('Đã lưu hồ sơ khách thuê', { type: 'ok' });
        HH.router.go(`/b/${ctx.bid}/tenants`);
      }, 500);
    };
  }
})();

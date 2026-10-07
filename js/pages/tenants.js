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
  const vehIcon = (type) => ({ 'Xe máy': HH.ic('car', 16), 'Ô tô': HH.ic('car', 16), 'Xe đạp': HH.ic('car', 16), 'Xe điện': HH.ic('car', 16) }[type] || HH.ic('car', 16));

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
        ? vs.map(v => `<div style="margin-bottom:2px"><span class="veh-chip">${vehIcon(v.type)} <b class="mono">${U.esc(v.plate || 'chưa có biển số')}</b></span></div>`).join('')
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
    if (list.length === 0) return { body: `<tr><td colspan="9"><div class="empty"><div class="ic">${HH.ic('user', 30)}</div><h4>Không có khách thuê phù hợp</h4><p class="muted">Thử đổi từ khóa hoặc bộ lọc.</p></div></td></tr>`, pg: null };
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
        { icon: HH.ic('eye', 16), label: 'Xem hồ sơ', onClick: () => showTenant(t) },
        { icon: HH.ic('car', 16), label: `Quản lý xe (${S.vehiclesOf(t).length})`, onClick: () => vehicleDialog(t) },
        { icon: HH.ic('lock', 16), label: t.ttlock ? 'Ngắt kết nối khóa' : 'Kết nối khóa TTLock', onClick: () => { t.ttlock = !t.ttlock; S.persist(); UI.toast(t.ttlock ? 'Đã kết nối khóa' : 'Đã ngắt kết nối', { type: 'ok' }); HH.router.render(); } },
        { icon: HH.ic('copy', 16), label: t.tamtru ? 'Đã đăng ký tạm trú' : 'Đánh dấu đã đăng ký tạm trú', onClick: () => { t.tamtru = !t.tamtru; S.persist(); UI.toast(t.tamtru ? 'Đã đánh dấu đăng ký tạm trú' : 'Đã bỏ đánh dấu', { type: 'ok' }); HH.router.render(); } },
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
        : `<div class="empty" style="padding:24px"><div class="ic">${HH.ic('car', 30)}</div><h4>Chưa đăng ký xe nào</h4>
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
      bodyHtml: `<p class="muted" style="margin-bottom:12px">Phòng <b>${U.esc(t.roomCode || 'chưa có')}</b> · thay đổi được lưu ngay khi rời ô nhập.</p>
        <div data-vlist></div>
        <button class="btn btn-outline" id="addVeh">${HH.ic('plus', 16)} Thêm xe</button>`,
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
        <div class="field"><label>Phòng</label><div>${t.roomCode || 'chưa gắn phòng'}</div></div>
        <div class="field"><label>Địa chỉ thường trú</label><div>${t.address}</div></div>
        <div class="field"><label>Xe đã đăng ký</label><div>${raw(S.vehiclesOf(t).length
          ? S.vehiclesOf(t).map(v => `<div class="mono">${vehIcon(v.type)} <b>${U.esc(v.plate || 'chưa có biển số')}</b>${v.brand ? ', ' + U.esc(v.brand) : ''}${v.color ? ', ' + U.esc(v.color) : ''}</div>`).join('')
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

  const G = () => window.HHGemini;

  HH.pages.tenantNew = {
    render(ctx) {
      const aiOn = !!(G() && G().configured());
      return h`<div class="page-head">
        <div><a class="back-link" href="#/b/${ctx.bid}/tenants">← Khách thuê</a>
          <div class="page-title">Thêm khách thuê</div></div></div>
        ${raw(aiOn ? '' : `<div class="alert alert-warning" style="margin-bottom:16px"><span class="ic">${HH.ic('alert', 16)}</span>
          <div><b>Chưa bật trợ lý AI</b> nên chưa đọc được ảnh căn cước. Bạn vẫn nhập tay được bên dưới.
          Bật bằng cách điền <span class="code">aiProxyUrl</span> hoặc <span class="code">geminiApiKey</span> trong js/config.js.</div></div>`)}
        <div class="card card-pad" id="ocrCard">
          <div class="ocr-drop" id="ocrDrop">
            <div class="big-ic">${HH.ic('camera', 30)}</div>
            <h3 style="margin:8px 0">Chụp, tải hoặc dán ảnh căn cước công dân</h3>
            <p class="muted">${aiOn ? 'Hệ thống đọc chữ trên ảnh rồi điền sẵn, mọi ô vẫn sửa được' : 'Bật trợ lý AI thì ảnh sẽ được đọc tự động'}</p>
            <div style="margin-top:16px" class="row-gap-2 wrap" style="justify-content:center">
              <label class="btn btn-primary">${raw(HH.ic('upload', 16))} Chọn ảnh mặt trước<input type="file" accept="image/*" id="ocrFile" hidden></label>
              <label class="btn btn-outline">${raw(HH.ic('camera', 16))} Chụp ảnh<input type="file" accept="image/*" capture="environment" id="ocrCam" hidden></label>
            </div>
            <p class="muted text-sm" style="margin-top:12px">Hoặc kéo thả ảnh vào đây, hoặc bấm vào khung rồi dán bằng <kbd>Ctrl</kbd>+<kbd>V</kbd></p>
          </div>
          <div class="center" style="margin-top:16px"><a href="#" id="manualLink">Hoặc nhập thủ công →</a></div>
        </div>`;
    },
    mount(ctx) {
      const file = document.getElementById('ocrFile');
      const cam = document.getElementById('ocrCam');
      const drop = document.getElementById('ocrDrop');
      file.onchange = () => { if (file.files[0]) startOcr(ctx, file.files[0]); };
      cam.onchange = () => { if (cam.files[0]) startOcr(ctx, cam.files[0]); };
      ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = 'var(--brand-500)'; }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = ''; }));
      drop.addEventListener('drop', e => { if (e.dataTransfer.files[0]) startOcr(ctx, e.dataTransfer.files[0]); });
      // Dán ảnh từ bộ nhớ tạm (chụp màn hình CCCD rồi Ctrl+V).
      // Router không gọi unmount, nên listener tự tháo khi khung đã rời khỏi trang.
      if (pasteHandler) document.removeEventListener('paste', pasteHandler);
      pasteHandler = (e) => {
        if (!document.getElementById('ocrDrop')) {       // đã sang trang khác
          document.removeEventListener('paste', pasteHandler); pasteHandler = null; return;
        }
        const items = (e.clipboardData && e.clipboardData.items) || [];
        for (const it of items) {
          if (it.kind === 'file' && String(it.type || '').startsWith('image/')) {
            const f = it.getAsFile();
            if (f) { e.preventDefault(); startOcr(ctx, f); return; }
          }
        }
      };
      document.addEventListener('paste', pasteHandler);
      document.getElementById('manualLink').onclick = (e) => { e.preventDefault(); showForm(ctx, blankData(), null); };
    },
  };
  let pasteHandler = null;

  function blankData() {
    const d = {}; OCR_FIELDS.forEach(f => d[f.key] = { value: '', confidence: 1 }); return d;
  }

  /* ---------- Đọc ảnh căn cước bằng AI ----------
     Mô hình chỉ ĐỌC chữ in trên thẻ, không suy đoán; ô nào không thấy thì để null.
     Đọc không được thì mở biểu mẫu trống kèm lý do — KHÔNG điền dữ liệu bịa,
     vì hồ sơ khách thuê sai tên hay sai số CCCD là sai cả hợp đồng về sau. */
  const CCCD_SYS = `Bạn là công cụ đọc thẻ Căn cước công dân / Chứng minh nhân dân Việt Nam từ ảnh.
NHIỆM VỤ: đọc CHÍNH XÁC chữ in trên thẻ và trả về JSON. TUYỆT ĐỐI KHÔNG suy đoán, không tự bịa.
Ô nào trên ảnh không thấy hoặc không đọc được thì để null. Chỉ trả JSON, không giải thích.
Định dạng:
{"fullName":"họ và tên"|null,"idNumber":"số thẻ, chỉ chữ số"|null,
"dateOfBirth":"dd/mm/yyyy"|null,"gender":"Nam"|"Nữ"|null,
"hometown":"quê quán"|null,"address":"nơi thường trú"|null,
"issueDate":"dd/mm/yyyy ngày cấp"|null,
"isIdCard":true|false,
"confidence":{"tên_trường":0..1}}
QUY TẮC:
- fullName: in hoa đúng như trên thẻ, giữ nguyên dấu tiếng Việt.
- idNumber: chỉ giữ chữ số, bỏ khoảng trắng. Thẻ CCCD có 12 số, CMND cũ có 9 số.
- gender: thẻ ghi "Nam"/"Nữ" (hoặc Sex: M/F) thì trả đúng "Nam" hoặc "Nữ".
- hometown là "Quê quán", address là "Nơi thường trú" — đừng lẫn hai ô này.
- isIdCard: false nếu ảnh KHÔNG phải thẻ căn cước/chứng minh (ảnh khác, ảnh mờ không thấy chữ).
- confidence: mức chắc chắn của từng ô bạn đọc được (1 là chữ rõ, 0.5 là mờ phải đoán hình chữ).`;

  /* Mặt sau thẻ: ngày cấp, nơi cấp và đặc điểm nhận dạng nằm ở đây, mặt trước
     không có. Đó là lý do ô "Ngày cấp CCCD" trống khi chỉ đưa mặt trước. */
  const CCCD_SAU_SYS = `Bạn là công cụ đọc MẶT SAU thẻ Căn cước công dân / Chứng minh nhân dân Việt Nam.
NHIỆM VỤ: đọc CHÍNH XÁC chữ in trên thẻ và trả về JSON. TUYỆT ĐỐI KHÔNG suy đoán, không bịa.
Ô nào không thấy thì để null. Chỉ trả JSON, không giải thích.
Định dạng:
{"issueDate":"dd/mm/yyyy ngày cấp thẻ"|null,
"issuePlace":"nơi cấp / cơ quan cấp"|null,
"isBackSide":true|false,
"confidence":{"tên_trường":0..1}}
QUY TẮC:
- Mặt sau thẻ chip thường chỉ ghi ngày tháng năm cấp ở góc phải, dạng "Ngày, tháng, năm"
  hoặc chỉ có số ngày tháng năm — lấy đúng ngày đó cho issueDate.
- issuePlace: nếu thấy dòng "CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI"
  thì trả "Cục CSQLHC về TTXH".
- isBackSide: false nếu ảnh là MẶT TRƯỚC (có ảnh chân dung, họ tên, ngày sinh) hoặc không phải thẻ.`;

  /** Đọc mặt sau rồi điền thẳng vào ô trên biểu mẫu, không vẽ lại cả trang
      để chữ người dùng đã gõ không bị mất. */
  async function docMatSau(fileObj, btn) {
    const card = document.getElementById('ocrCard');
    const o = (k) => card.querySelector(`[data-k="${k}"]`);
    const bao = card.querySelector('#backMsg');
    const dataUrl = await U.fileToDataUrl(fileObj);

    anhSau = dataUrl;
    veAnhSau();

    if (!(G() && G().configured())) {
      if (bao) bao.innerHTML = `<span class="hint">Đã lưu ảnh mặt sau. Chưa bật trợ lý AI nên ngày cấp phải nhập tay.</span>`;
      return;
    }
    if (btn) btn.classList.add('loading');
    if (bao) bao.innerHTML = `<span class="hint">Đang đọc mặt sau...</span>`;
    try {
      const out = await G().readDoc([{ mime: fileObj.type || 'image/jpeg', data: String(dataUrl).split(',')[1] }],
        CCCD_SAU_SYS, 'Đọc mặt sau thẻ căn cước trong ảnh này và trả JSON theo đúng định dạng đã nêu.');
      if (out && out.isBackSide === false) {
        if (bao) bao.innerHTML = `<span class="err">Ảnh này trông như mặt trước. Chụp mặt sau (mặt có ngày cấp) giúp em.</span>`;
      } else if (out && (out.issueDate || out.issuePlace)) {
        if (out.issueDate && o('cccdIssueDate')) { o('cccdIssueDate').value = out.issueDate; kiemMot(o('cccdIssueDate')); }
        if (out.issuePlace) noiCap = out.issuePlace;
        if (bao) bao.innerHTML = `<span class="hint" style="color:var(--success)">Đã đọc mặt sau${out.issueDate ? ', ngày cấp ' + U.esc(out.issueDate) : ''}.</span>`;
      } else {
        if (bao) bao.innerHTML = `<span class="hint">Đã lưu ảnh, nhưng không đọc được ngày cấp. Nhập tay giúp em.</span>`;
      }
    } catch (e) {
      if (bao) bao.innerHTML = `<span class="err">${U.esc(G().errText(e.message))}</span>`;
    }
    if (btn) btn.classList.remove('loading');
  }

  function veAnhSau() {
    const box = document.getElementById('backBox');
    if (!box) return;
    box.innerHTML = anhSau
      ? `<img src="${anhSau}" alt="Mặt sau CCCD" style="width:100%;display:block">
         <button class="btn btn-sm btn-outline" id="backRedo" style="position:absolute;bottom:8px;left:8px">${HH.ic('refresh', 16)} Chọn lại</button>`
      : `<div class="center" style="padding:16px">
           <div class="muted text-sm" style="margin-bottom:8px">Chưa có ảnh mặt sau</div>
           <label class="btn btn-outline btn-sm">${HH.ic('upload', 16)} Chọn ảnh mặt sau
             <input type="file" accept="image/*" id="backFile" hidden></label>
         </div>`;
    noiBackFile();
  }
  function noiBackFile() {
    const card = document.getElementById('ocrCard');
    if (!card) return;
    const f = card.querySelector('#backFile');
    if (f) f.onchange = () => { if (f.files[0]) docMatSau(f.files[0], null); };
    const redo = card.querySelector('#backRedo');
    if (redo) redo.onclick = () => { anhSau = null; veAnhSau(); };
  }

  function startOcr(ctx, fileObj) {
    const card = document.getElementById('ocrCard');
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const aiOn = !!(G() && G().configured());
      if (!aiOn) {
        UI.toast('Chưa bật trợ lý AI nên không đọc được ảnh, mời nhập tay', { type: 'warn' });
        showForm(ctx, blankData(), dataUrl, 'Chưa bật trợ lý AI nên ảnh chưa được đọc. Nhập tay giúp em nhé.');
        return;
      }
      card.innerHTML = h`<div class="ocr-split">
        <div class="ocr-img"><img src="${raw(dataUrl)}" alt="CCCD" style="width:100%;object-fit:cover"></div>
        <div><div class="b" style="margin-bottom:8px">Đang đọc thẻ căn cước...</div>
          <div class="progress-track"><div class="progress-fill" id="ocrProg" style="width:10%"></div></div>
          <p class="muted text-sm" style="margin-top:8px">Đang đọc chữ trên ảnh, mất khoảng 5 tới 20 giây.</p></div></div>`;
      // thanh tiến trình bò dần tới 90% rồi chờ kết quả thật
      let p = 10; const prog = document.getElementById('ocrProg');
      const timer = setInterval(() => { p = Math.min(90, p + 6); if (prog) prog.style.width = p + '%'; }, 400);

      let out = null, errMsg = '';
      try {
        const mime = (fileObj && fileObj.type) || 'image/jpeg';
        out = await G().readDoc([{ mime, data: String(dataUrl).split(',')[1] }], CCCD_SYS,
          'Đọc thẻ căn cước công dân trong ảnh này và trả JSON theo đúng định dạng đã nêu.');
      } catch (e) {
        errMsg = G().errText(e.message);
      }
      clearInterval(timer);
      if (prog) prog.style.width = '100%';

      if (!out) {
        showForm(ctx, blankData(), dataUrl, errMsg || 'Chưa đọc được ảnh. Nhập tay giúp em nhé.');
        return;
      }
      if (out.isIdCard === false) {
        showForm(ctx, blankData(), dataUrl,
          'Ảnh này không giống thẻ căn cước nên em chưa đọc được. Chụp lại cho rõ mặt trước, hoặc nhập tay.');
        return;
      }
      showForm(ctx, fromAi(out), dataUrl, '', out.issueDate || '');
    };
    reader.readAsDataURL(fileObj);
  }

  /** Kết quả AI -> dạng { khóa: {value, confidence} } mà biểu mẫu đang dùng */
  function fromAi(out) {
    const conf = out.confidence || {};
    const d = {};
    OCR_FIELDS.forEach(f => {
      let v = out[f.key];
      if (f.key === 'idNumber' && v) v = String(v).replace(/\D/g, '');
      d[f.key] = { value: v == null ? '' : String(v), confidence: v == null ? 0 : (+conf[f.key] || 0.75) };
    });
    return d;
  }

  /* ============================================================
     RÀNG BUỘC: phải điền đủ mới lưu được
     Hồ sơ khách thuê là căn cứ cho hợp đồng, tạm trú và hóa đơn sau này.
     Thiếu một ô là về sau phải đi hỏi lại khách, nên chặn ngay từ đây.
     Báo lỗi ngay dưới từng ô chứ không chỉ hiện một dòng chung, để biết
     đúng ô nào đang thiếu.
     ============================================================ */
  let anhSau = null;                       // ảnh mặt sau đã chọn
  let noiCap = '';                         // nơi cấp đọc được từ mặt sau

  /** dd/mm/yyyy có phải ngày có thật không (chặn 31/02, 45/13...) */
  function ngayThat(s) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim());
    if (!m) return null;
    const d = +m[1], th = +m[2], n = +m[3];
    const dt = new Date(n, th - 1, d);
    if (dt.getDate() !== d || dt.getMonth() !== th - 1 || dt.getFullYear() !== n) return null;
    return dt;
  }

  const BAT_BUOC = [
    { k: 'fullName', ten: 'Họ và tên', kiem: (v) => {
        if (v.trim().split(/\s+/).length < 2) return 'Nhập đủ họ và tên';
        if (/\d/.test(v)) return 'Họ tên không có chữ số';
      } },
    { k: 'idNumber', ten: 'Số CCCD', kiem: (v) => {
        const s = v.replace(/\D/g, '');
        if (s.length !== 12 && s.length !== 9) return 'CCCD có 12 số, CMND cũ có 9 số';
      } },
    { k: 'dateOfBirth', ten: 'Ngày sinh', kiem: (v) => {
        const d = ngayThat(v);
        if (!d) return 'Nhập dạng dd/mm/yyyy';
        if (d > new Date()) return 'Ngày sinh không thể ở tương lai';
        if (new Date().getFullYear() - d.getFullYear() > 120) return 'Năm sinh không hợp lý';
      } },
    { k: 'gender', ten: 'Giới tính', kiem: (v) => {
        if (!/^(nam|nữ|nu)$/i.test(v.trim())) return 'Chỉ nhận "Nam" hoặc "Nữ"';
      } },
    { k: 'hometown', ten: 'Quê quán' },
    { k: 'address', ten: 'Địa chỉ thường trú' },
    { k: 'cccdIssueDate', ten: 'Ngày cấp CCCD', kiem: (v) => {
        const d = ngayThat(v);
        if (!d) return 'Nhập dạng dd/mm/yyyy, có ở mặt sau thẻ';
        if (d > new Date()) return 'Ngày cấp không thể ở tương lai';
      } },
    { k: 'phone', ten: 'Điện thoại', kiem: (v) => {
        const s = v.replace(/\s|\./g, '');
        if (!/^0\d{9}$/.test(s)) return 'Số di động 10 chữ số, bắt đầu bằng 0';
      } },
  ];

  /** Kiểm một ô, gắn/bỏ báo lỗi ngay dưới ô đó. Trả về lời báo lỗi hoặc '' */
  function kiemMot(el) {
    if (!el) return '';
    const r = BAT_BUOC.find(x => x.k === el.dataset.k);
    if (!r) return '';
    const v = el.value || '';
    let loi = '';
    if (!v.trim()) loi = `Chưa nhập ${r.ten}`;      // giữ nguyên hoa thường, "CCCD" viết thường trông cẩu thả
    else if (r.kiem) loi = r.kiem(v) || '';

    const o = el.closest('.field');
    if (o) {
      let bao = o.querySelector('.err-msg');
      if (loi) {
        el.style.borderColor = 'var(--danger)';
        if (!bao) { bao = document.createElement('span'); bao.className = 'err err-msg'; o.appendChild(bao); }
        bao.textContent = loi;
      } else {
        el.style.borderColor = '';
        if (bao) bao.remove();
      }
    }
    return loi;
  }

  /** Kiểm cả biểu mẫu. Trả về ô đầu tiên bị sai (null nếu sạch) */
  function kiemHet(card) {
    let dau = null;
    BAT_BUOC.forEach(r => {
      const el = card.querySelector(`[data-k="${r.k}"]`);
      if (kiemMot(el) && !dau) dau = el;
    });
    return dau;
  }

  // Phòng truyền qua đường dẫn: #/b/<bid>/tenants/new?room=P101
  function roomFromUrl() {
    const m = /[?&]room=([^&]+)/.exec(HH.router.current() || '');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function showForm(ctx, data, imgUrl, warn, issueDate) {
    const card = document.getElementById('ocrCard');
    const preRoom = roomFromUrl();
    const existing = data.idNumber && data.idNumber.value ? S.tenantByIdNumber(data.idNumber.value.replace(/\s/g, '')) : null;
    const readCount = OCR_FIELDS.filter(f => (data[f.key] || {}).value).length;
    const fieldsHtml = OCR_FIELDS.map(f => {
      const d = data[f.key] || { value: '', confidence: 1 };
      const low = d.confidence < 0.8;
      const conf = low ? '<span class="conf warn" title="Độ tin cậy thấp">' + HH.ic('alert', 16) + '</span>' : (d.value ? '<span class="conf ok">✓</span>' : '');
      return h`<div class="field ocr-field ${raw(low ? 'low' : '')}">
        <label>${f.label} <span style="color:var(--danger)">*</span></label>
        <input class="input" data-k="${f.key}" value="${d.value}">
        ${raw(conf)}
        ${raw(low ? '<span class="hint" style="color:var(--warning)">Độ tin cậy thấp, vui lòng kiểm tra</span>' : '')}
      </div>`;
    }).join('');

    const dupAlert = existing ? `<div class="alert alert-purple" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
      <div>Khách thuê này đã có hồ sơ từ hợp đồng trước (${existing.fullName}).
      <button class="btn btn-sm btn-outline" id="reuseBtn" style="margin-left:8px">Dùng lại hồ sơ cũ</button></div></div>` : '';

    // Đọc được thì nói rõ là phải kiểm tra lại; không đọc được thì nói thẳng lý do
    const readAlert = warn
      ? `<div class="alert alert-warning" style="margin-bottom:16px"><span class="ic">${HH.ic('alert', 16)}</span>
          <div>${U.esc(warn)}</div></div>`
      : (readCount ? `<div class="alert alert-info" style="margin-bottom:16px"><span class="ic">${HH.ic('info', 16)}</span>
          <div>Đã đọc được <b>${readCount}/${OCR_FIELDS.length}</b> ô từ ảnh. Ô nào có dấu <b>độ tin cậy thấp</b> là chữ mờ,
          <b>đối chiếu lại với thẻ</b> trước khi lưu.</div></div>` : '');

    const imgPane = imgUrl
      ? `<div class="ocr-img"><img src="${imgUrl}" style="width:100%"><span class="ocr-tag">Mặt trước</span></div>`
      : `<div class="ocr-img" style="min-height:190px">Nhập thủ công<br>(không có ảnh)</div>`;

    card.innerHTML = h`
      ${raw(dupAlert)}
      ${raw(readAlert)}
      <div class="ocr-split">
        <div>${raw(imgPane)}
          <div class="ocr-img" id="backBox" style="margin-top:10px;min-height:120px"></div>
          <div id="backMsg" style="margin-top:6px"></div>
          <p class="muted text-xs" style="margin-top:6px">Ngày cấp nằm ở <b>mặt sau</b> thẻ. Thêm ảnh mặt sau là tự điền.</p>
        </div>
        <div><div class="grid-2">${raw(fieldsHtml)}</div>
          <div class="grid-2" style="margin-top:12px">
            <div class="field"><label>Ngày cấp CCCD <span style="color:var(--danger)">*</span></label><input class="input mono" data-k="cccdIssueDate" value="${issueDate || ''}" placeholder="dd/mm/yyyy"></div>
            <div class="field"><label>Điện thoại <span style="color:var(--danger)">*</span></label><input class="input mono" data-k="phone" placeholder="09xxxxxxxx"></div>
            <div class="field"><label>Ở phòng (tùy chọn)</label>
              <select class="select" data-k="roomCode">
                <option value="">Chưa gắn phòng</option>
                ${raw(S.roomsOf(ctx.bid).slice().sort((a, b) => a.code.localeCompare(b.code))
                  .map(r => `<option value="${r.code}" ${r.code === preRoom ? 'selected' : ''}>${r.code} · ${U.esc(r.typeLabel)}${r.tenantName ? ' (đang có khách)' : ''}</option>`).join(''))}
              </select>
              <span class="hint">Chọn phòng để khách hiện trong danh sách phòng đó</span></div>
          </div>
        </div>
      </div>
      <p class="muted text-xs" style="margin-top:14px">Ô có dấu <span style="color:var(--danger)">*</span> là bắt buộc.</p>
      <div class="between" style="margin-top:8px">
        <a href="#/b/${ctx.bid}/tenants">Hủy</a>
        <button class="btn btn-primary" id="saveTenant">Lưu hồ sơ khách thuê</button>
      </div>`;

    anhSau = null; noiCap = '';
    veAnhSau();

    // Gõ xong rời khỏi ô thì kiểm luôn ô đó; ô đang báo lỗi thì sửa tới đâu xóa báo tới đó
    BAT_BUOC.forEach(r => {
      const el = card.querySelector(`[data-k="${r.k}"]`);
      if (!el) return;
      el.addEventListener('blur', () => kiemMot(el));
      el.addEventListener('input', () => { if (el.closest('.field').querySelector('.err-msg')) kiemMot(el); });
    });

    if (existing) document.getElementById('reuseBtn').onclick = () => {
      UI.toast(`Đã dùng lại hồ sơ ${existing.fullName}`, { type: 'ok' }); HH.router.go(`/b/${ctx.bid}/tenants`);
    };
    document.getElementById('saveTenant').onclick = (e) => {
      const btn = e.currentTarget;
      const get = (k) => (card.querySelector(`[data-k="${k}"]`) || {}).value || '';
      const sai = kiemHet(card);
      if (sai) {
        sai.focus();
        sai.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const thieu = BAT_BUOC.filter(r => {
          const el = card.querySelector(`[data-k="${r.k}"]`);
          return el && el.closest('.field').querySelector('.err-msg');
        }).length;
        UI.toast(`Còn ${thieu} ô chưa đúng hoặc chưa điền`, { type: 'error' });
        return;
      }
      btn.classList.add('loading');
      setTimeout(() => {
        const room = get('roomCode').trim() || null;
        // Người đầu tiên của phòng là đại diện hợp đồng (app khách thuê đăng nhập theo số này)
        const isFirst = !!room && !S.tenantsOf(ctx.bid).some(t => t.roomCode === room);
        S.addTenant({
          id: U.uid('tn'), buildingId: ctx.bid, roomCode: room,
          fullName: get('fullName').trim(), idNumber: get('idNumber').replace(/\D/g, ''),
          dob: get('dateOfBirth').trim(), gender: /^nam$/i.test(get('gender').trim()) ? 'Nam' : 'Nữ',
          hometown: get('hometown').trim(),
          phone: get('phone').replace(/\s|\./g, ''), occupation: get('occupation') || '',
          address: get('address').trim(),
          cccdIssueDate: get('cccdIssueDate').trim(), cccdIssuePlace: noiCap || 'Cục CSQLHC về TTXH',
          cccdFront: !!imgUrl, cccdBack: !!anhSau, vehiclePlate: null,
          ttlock: false, tamtru: false, occupants: 1, isRep: isFirst,
        });
        // Phòng chưa ghi tên khách thì lấy tên người đầu tiên cho khớp danh sách phòng
        if (isFirst) { const rm = S.room(ctx.bid, room); if (rm && !rm.tenantName) S.updateRoom(ctx.bid, room, { tenantName: get('fullName').trim() }); }
        S.log('tenant.create', `Thêm khách thuê ${get('fullName')}${room ? ' vào phòng ' + room : ''}`);
        UI.toast(room ? `Đã thêm ${get('fullName')} vào phòng ${room}` : 'Đã lưu hồ sơ khách thuê', { type: 'ok' });
        HH.router.go(room ? `/b/${ctx.bid}/tenants?room=${encodeURIComponent(room)}` : `/b/${ctx.bid}/tenants`);
      }, 500);
    };
  }
})();

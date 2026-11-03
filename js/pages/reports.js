/* ============================================================
   Trang Báo cáo tháng: xem, in ra PDF, xuất Excel (số liệu và bản in ở js/report.js)
   ============================================================ */
(function () {
  const U = HH.util, S = HH.store, UI = HH.ui, R = HH.report, h = U.html, raw = U.raw;

  let phamVi = '';          // '' = toàn công ty, còn lại là mã một tòa

  function dungBaoCao() {
    if (phamVi && !S.building(phamVi)) phamVi = '';
    const toa = phamVi ? S.building(phamVi) : null;
    const dsToa = toa ? [toa] : S.buildings;
    const no = [];
    dsToa.forEach(b => S.invoicesOf(b.id).forEach(i => {
      if (i.status !== 'cancelled' && i.status !== 'draft' && i.total > i.paid) no.push(i);
    }));
    const tenToa = {}; S.buildings.forEach(b => { tenToa[b.id] = b.name; });
    return R.lap({
      a: S.dashboardAnalytics({ buildingId: phamVi || null }), no, tenToa,
      homNay: U.dateKey(U.today()), phamVi: toa ? toa.name : 'Toàn công ty', tien: U.currency,
    });
  }
  const dinhDang = () => ({ esc: U.esc, tien: U.currency, phanTram: U.percent, logo: U.asset('logo-mark.svg') });

  HH.pages.reports = {
    render() {
      if (!S.buildings.length) {
        return h`<div class="page-head"><div><h1 class="page-title">Báo cáo tháng</h1></div></div>
          <div class="card"><div class="stub"><div class="big-ic">${HH.ic('chart', 30)}</div>
            <h3>Chưa có tòa nhà nào</h3><p class="muted">Thêm tòa nhà và phát hành hóa đơn đầu tiên thì báo cáo sẽ có số liệu.</p>
            <a class="btn btn-primary" href="#/buildings">Về Quản lý nhà</a></div></div>`;
      }
      const m = dungBaoCao();
      const chonToa = S.buildings.length > 1
        ? `<select class="select" id="rpScope" aria-label="Phạm vi báo cáo" style="max-width:220px">
            <option value="">Toàn công ty</option>
            ${S.buildings.map(b => `<option value="${U.esc(b.id)}" ${b.id === phamVi ? 'selected' : ''}>${U.esc(b.name)}</option>`).join('')}</select>` : '';
      return h`<div class="page-head">
          <div><h1 class="page-title">Báo cáo tháng</h1>
            <div class="page-sub">${m.phamVi}, ${m.nhanKy}. Xem trước đúng như bản in.</div></div>
          <div class="page-actions">
            ${raw(chonToa)}
            <button class="btn btn-outline" id="rpCsv">${HH.ic('download', 16)} Xuất Excel</button>
            <button class="btn btn-primary" id="rpPrint">${HH.ic('print', 16)} In / Lưu PDF</button>
          </div>
        </div>
        <div id="periodSel" style="margin-bottom:16px"></div>
        ${raw(m.coDuLieu ? '' : `<div class="card" style="margin-bottom:16px"><div class="card-pad"><p class="muted" style="margin:0">Kỳ này chưa có hóa đơn, chỉ số hay khoản chi nào nên các con số bên dưới đều bằng 0. Chọn tháng khác ở dải tháng phía trên.</p></div></div>`)}
        <div class="bct-wrap"><style>${raw(R.css)}</style>${raw(R.html(m, dinhDang()))}</div>`;
    },
    mount() {
      const psel = document.getElementById('periodSel');
      if (!psel) return;                       // chưa có tòa nhà: trang chỉ hiện lời nhắn, không có dải tháng
      const opt = { value: S.period(), pending: S.periodsWithData(), onChange: (p) => { S.setPeriod(p); HH.router.render(); } };
      psel.innerHTML = UI.periodSelector(opt);
      UI.attachPeriod(psel.querySelector('[data-period-root]'), opt);

      const sc = document.getElementById('rpScope');
      if (sc) sc.onchange = () => { phamVi = sc.value; HH.router.render(); };

      const csv = document.getElementById('rpCsv');
      if (csv) csv.onclick = () => {
        const m = dungBaoCao(), r = R.csv(m);
        U.downloadCSV(`bao-cao-thang-${m.ky}${phamVi ? '-' + phamVi : ''}.csv`, r[0], r.slice(1));
        UI.toast('Đã tải báo cáo (CSV, mở bằng Excel)', { type: 'ok' });
      };

      const pr = document.getElementById('rpPrint');
      if (pr) pr.onclick = () => {
        const m = dungBaoCao();
        const win = window.open('', '_blank', 'width=860,height=1000');
        if (!win) { UI.toast('Trình duyệt chặn cửa sổ in. Hãy cho phép popup.', { type: 'error' }); return; }
        win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bao cao ${U.esc(m.ky)}</title>
          <style>${R.css}body{margin:0;padding:16px}@page{size:A4;margin:14mm}</style></head><body>${R.html(m, dinhDang())}
          <script>window.onload=function(){window.print()}<\/script></body></html>`);
        win.document.close();
      };
    },
  };
})();

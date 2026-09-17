/* ============================================================
   Happy Home — Biểu đồ SVG thuần (không dùng thư viện ngoài)
   HH.chart.donut / bars / area / progress / gauge
   ============================================================ */
HH.chart = (function () {
  const U = HH.util;
  const PALETTE = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#ec4899', '#64748b'];

  const esc = U.esc;
  const money = (n) => U.currency(n);

  /** Biểu đồ tròn (donut) — data: [{label, value, color?}] */
  function donut(data, opt) {
    opt = opt || {};
    const size = opt.size || 190, sw = opt.stroke || 26;
    const r = (size - sw) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
    const total = data.reduce((s, d) => s + (d.value || 0), 0);
    let off = 0;
    const arcs = total <= 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--neutral-200)" stroke-width="${sw}"/>`
      : data.filter(d => d.value > 0).map((d, i) => {
          const frac = d.value / total, len = C * frac;
          const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
            stroke="${d.color || PALETTE[i % PALETTE.length]}" stroke-width="${sw}"
            stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"
            transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt">
            <title>${esc(d.label)}: ${esc(opt.fmt ? opt.fmt(d.value) : money(d.value))}</title></circle>`;
          off += len; return el;
        }).join('');
    const center = opt.centerLabel !== false ? `
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11"
        fill="var(--neutral-400)" font-weight="600">${esc(opt.centerTitle || 'Tổng')}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="15" font-weight="700"
        fill="var(--neutral-900)" font-family="var(--font-mono)">${esc(opt.centerValue || (opt.fmt ? opt.fmt(total) : money(total)))}</text>` : '';
    const legend = data.map((d, i) => `<div class="ch-leg">
      <span class="ch-dot" style="background:${d.color || PALETTE[i % PALETTE.length]}"></span>
      <span class="ch-leg-l">${esc(d.label)}</span>
      <span class="ch-leg-v">${esc(opt.fmt ? opt.fmt(d.value) : money(d.value))}</span>
      <span class="ch-leg-p">${total > 0 ? Math.round(d.value / total * 100) : 0}%</span></div>`).join('');
    return `<div class="ch-donut-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ch-donut">${arcs}${center}</svg>
      <div class="ch-legend">${legend}</div></div>`;
  }

  /** Biểu đồ cột — data: [{label, value, sub?}] */
  function bars(data, opt) {
    opt = opt || {};
    const max = Math.max(1, ...data.map(d => d.value || 0));
    const h = opt.height || 150;
    return `<div class="ch-bars" style="height:${h}px">${data.map((d, i) => {
      const pct = Math.max(2, Math.round((d.value || 0) / max * 100));
      const hl = opt.highlightLast && i === data.length - 1;
      return `<div class="ch-bar-col" title="${esc(d.label)}: ${esc(opt.fmt ? opt.fmt(d.value) : money(d.value))}">
        <div class="ch-bar-v">${esc(opt.shortFmt ? opt.shortFmt(d.value) : '')}</div>
        <div class="ch-bar-track"><div class="ch-bar ${hl ? 'hl' : ''}" style="height:${pct}%;${d.color ? 'background:' + d.color : ''}"></div></div>
        <div class="ch-bar-l">${esc(d.label)}</div></div>`;
    }).join('')}</div>`;
  }

  /** Biểu đồ đường/vùng — points: [{label, value}] */
  function area(points, opt) {
    opt = opt || {};
    const w = 100, h = 34, pad = 2;
    const vals = points.map(p => p.value || 0);
    const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
    const n = points.length || 1;
    const x = (i) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
    const y = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const fill = `${line} L${w},${h} L0,${h} Z`;
    const color = opt.color || 'var(--brand-500)';
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<div class="ch-area">
      <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${opt.height || 70}px">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        <path d="${fill}" fill="url(#${id})"/>
        <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6"
          vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
      <div class="ch-area-x">${points.map(p => `<span>${esc(p.label)}</span>`).join('')}</div></div>`;
  }

  /** Thanh tiến độ có nhãn — items: [{label, value, max, sub, color}] */
  function progress(items, opt) {
    opt = opt || {};
    return `<div class="ch-prog">${items.map((it, i) => {
      const pct = it.max > 0 ? Math.min(100, Math.round(it.value / it.max * 100)) : 0;
      const color = it.color || PALETTE[i % PALETTE.length];
      return `<div class="ch-prog-row">
        <div class="ch-prog-top"><span class="ch-prog-l">${esc(it.label)}</span>
          <span class="ch-prog-p">${pct}%</span></div>
        <div class="ch-prog-track"><div class="ch-prog-fill" style="width:${pct}%;background:${color}"></div></div>
        ${it.sub ? `<div class="ch-prog-sub">${esc(it.sub)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  /** Vòng cung tỉ lệ (gauge) 0..1 */
  function gauge(ratio, opt) {
    opt = opt || {};
    const size = opt.size || 130, sw = 12, r = (size - sw) / 2, cx = size / 2, cy = size / 2;
    const C = Math.PI * r;                       // nửa vòng
    const p = Math.max(0, Math.min(1, ratio || 0));
    const color = opt.color || (p >= .85 ? 'var(--success)' : p >= .6 ? 'var(--brand-500)' : 'var(--warning)');
    return `<div class="ch-gauge">
      <svg viewBox="0 0 ${size} ${size / 2 + 12}" width="${size}" height="${size / 2 + 12}">
        <path d="M ${sw / 2} ${cy} A ${r} ${r} 0 0 1 ${size - sw / 2} ${cy}" fill="none"
          stroke="var(--neutral-200)" stroke-width="${sw}" stroke-linecap="round"/>
        <path d="M ${sw / 2} ${cy} A ${r} ${r} 0 0 1 ${size - sw / 2} ${cy}" fill="none"
          stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
          stroke-dasharray="${C * p} ${C}"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="22" font-weight="700"
          fill="var(--neutral-900)" font-family="var(--font-mono)">${Math.round(p * 100)}%</text>
      </svg>
      ${opt.label ? `<div class="ch-gauge-l">${esc(opt.label)}</div>` : ''}</div>`;
  }

  return { donut, bars, area, progress, gauge, PALETTE };
})();

/* ============================================================
   Happy Home — Tiện ích chung
   ============================================================ */
window.HH = window.HH || {};

HH.util = (function () {
  const viNum = new Intl.NumberFormat('vi-VN');

  /** 1250000 -> "1.250.000 ₫" (dấu chấm nghìn, ký hiệu đồng ở cuối) */
  function currency(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return viNum.format(Math.round(n)) + ' ₫';
  }
  /** Rút gọn cho thẻ chỉ số: > 1 tỷ -> "1,25 tỷ ₫" */
  function currencyShort(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    if (Math.abs(n) >= 1e9) {
      return (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ ₫';
    }
    return currency(n);
  }
  /** Số thường (chỉ số điện nước): 12450 -> "12.450" */
  function number(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return viNum.format(n);
  }
  function percent(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Math.round(n * 100) + '%';
  }
  /** Bỏ mọi ký tự không phải số -> Number */
  function parseNum(s) {
    if (typeof s === 'number') return s;
    const cleaned = String(s).replace(/[^\d]/g, '');
    return cleaned === '' ? null : parseInt(cleaned, 10);
  }

  /* ---- Ngày ---- */
  const pad = (x) => String(x).padStart(2, '0');
  function fmtDate(d) {
    const x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x)) return '—';
    return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
  }
  function addMonths(d, m) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
  function today() { return new Date('2026-08-12'); } // ngày hệ thống theo ngữ cảnh

  /* ---- HTML ---- */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  /** Tag template `html` -> nối chuỗi, tự escape giá trị ${...} trừ khi là mảng/HTML thô qua raw() */
  function html(strings, ...vals) {
    return strings.reduce((acc, s, i) => {
      let v = vals[i - 1];
      if (Array.isArray(v)) v = v.join('');
      else if (v && v.__raw) v = v.value;
      else v = esc(v);
      return acc + (i ? v : '') + s;
    });
  }
  function raw(value) { return { __raw: true, value }; }

  function initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function uid(prefix) { return (prefix || 'id') + '-' + Math.random().toString(36).slice(2, 8); }

  function debounce(fn, ms) {
    let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  /** Xuất CSV thật (mở được bằng Excel). headers: [], rows: [][] */
  function downloadCSV(filename, headers, rows) {
    const escCell = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(escCell).join(',')]
      .concat(rows.map(r => r.map(escCell).join(',')));
    // BOM để Excel đọc đúng tiếng Việt
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { currency, currencyShort, number, percent, parseNum, fmtDate, addMonths,
           daysBetween, today, esc, html, raw, initials, uid, debounce, downloadCSV };
})();

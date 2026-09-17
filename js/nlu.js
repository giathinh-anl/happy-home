/* ============================================================
   Happy Home — Bộ hiểu câu hỏi tiếng Việt (dùng chung 2 app)
   ------------------------------------------------------------
   Không gọi mạng, không tốn phí. Làm 3 việc:
     1. Chấm điểm ý định (thay cho "gặp từ khóa đầu tiên là chọn"),
        có chịu lỗi gõ sai 1 ký tự và gõ không dấu.
     2. Bóc THAM SỐ trong câu: kỳ (tháng này / tháng trước / tháng 7 / T7/2026),
        khoảng thời gian (6 tháng gần đây), tòa nhà, mã phòng.
     3. Nhớ NGỮ CẢNH để hiểu câu hỏi nối tiếp:
        "Phòng P101 thế nào?" -> "còn nợ bao nhiêu?" -> "còn P102 thì sao?"
   ============================================================ */
(function (root) {
  /* ---------- Chuẩn hóa ---------- */
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9/\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const toks = (s) => norm(s).split(' ').filter(Boolean);

  function lev(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }
  // Âm tiết tiếng Việt rất ngắn ("no", "nu") -> phải khớp đúng; từ dài hơn cho sai 1 ký tự
  function tokenMatch(a, b) {
    if (a === b) return 2;                       // khớp đúng
    const mn = Math.min(a.length, b.length), mx = Math.max(a.length, b.length);
    if (mn >= 3 && mx >= 4 && lev(a, b) <= 1) return 1;   // gõ sai nhẹ
    if (mn >= 7 && lev(a, b) <= 2) return 1;
    return 0;
  }
  /** Tìm cụm từ trong câu. Trả 2 = đúng hoàn toàn, 1 = gần đúng, 0 = không có */
  function phraseIn(textToks, phrase) {
    const p = phrase.split(' ');
    let best = 0;
    for (let i = 0; i + p.length <= textToks.length; i++) {
      let q = 2;
      for (let k = 0; k < p.length; k++) {
        const m = tokenMatch(textToks[i + k], p[k]);
        if (!m) { q = 0; break; }
        if (m < q) q = m;
      }
      if (q > best) best = q;
      if (best === 2) break;
    }
    return best;
  }

  /** Chấm điểm mọi ý định. defs = { key: { kw:[cụm mạnh], weak:[từ gợi ý], neg:[cụm loại trừ] } } */
  function score(text, defs) {
    const t = toks(text);
    const out = [];
    Object.keys(defs).forEach((key) => {
      const d = defs[key];
      if (!d) return;
      if ((d.neg || []).some((p) => phraseIn(t, p) === 2)) return;
      let s = 0;
      (d.kw || []).forEach((p) => {
        const m = phraseIn(t, p);
        const len = p.split(' ').length;
        if (m === 2) s += 3 + len * 0.5;          // cụm dài càng cụ thể càng nhiều điểm
        else if (m === 1) s += 1.5 + len * 0.25;  // gõ sai -> nửa điểm
      });
      (d.weak || []).forEach((w) => { if (phraseIn(t, w) === 2) s += 1; });
      if (s > 0) out.push({ key, score: Math.round(s * 100) / 100 });
    });
    return out.sort((a, b) => b.score - a.score);
  }

  /* ---------- Kỳ (tháng) ---------- */
  const MONTH_WORDS = {
    'gieng': 1, 'mot': 1, 'hai': 2, 'ba': 3, 'bon': 4, 'tu': 4, 'nam': 5, 'sau': 6,
    'bay': 7, 'tam': 8, 'chin': 9, 'muoi': 10, 'muoi mot': 11, 'muoi hai': 12, 'chap': 12,
  };
  const NUM_WORDS = { 'mot': 1, 'hai': 2, 'ba': 3, 'bon': 4, 'nam': 5, 'sau': 6, 'bay': 7,
    'tam': 8, 'chin': 9, 'muoi': 10, 'muoi hai': 12 };

  function shift(per, delta) {
    const [y, m] = per.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  const mk = (y, m) => y + '-' + String(m).padStart(2, '0');
  const label = (per) => { const [y, m] = per.split('-'); return 'T' + Number(m) + '/' + y; };

  /** Bóc kỳ trong câu. cur = kỳ hiện tại "YYYY-MM". Trả {period, label, how} hoặc null */
  function extractPeriod(text, cur) {
    const t = ' ' + norm(text) + ' ';
    const [cy, cm] = cur.split('-').map(Number);

    // "T7/2026", "7/2026", "07-2026", "2026-07"
    let m = t.match(/\b(?:t|thang\s*)?(\d{1,2})[/-](\d{4})\b/);
    if (m && +m[1] >= 1 && +m[1] <= 12) return { period: mk(+m[2], +m[1]), how: 'exact' };
    m = t.match(/\b(\d{4})[/-](\d{1,2})\b/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return { period: mk(+m[1], +m[2]), how: 'exact' };

    // tương đối
    if (/ (thang|ky) nay nam (ngoai|truoc|roi) /.test(t)) return { period: shift(cur, -12), how: 'lastyear' };
    if (/ (thang|ky) (nay|hien tai) /.test(t)) return { period: cur, how: 'this' };
    m = t.match(/ (\d+|hai|ba|bon|nam|sau) thang truoc /);
    if (m) {
      const n = /\d/.test(m[1]) ? +m[1] : NUM_WORDS[m[1]];
      if (n) return { period: shift(cur, -n), how: 'ago' };
    }
    if (/ (thang|ky) (truoc|roi|vua roi|vua qua) /.test(t)) return { period: shift(cur, -1), how: 'prev' };
    if (/ (thang|ky) (sau|toi) /.test(t)) return { period: shift(cur, 1), how: 'next' };

    // "tháng 7", "t7", "tháng bảy" (+ năm nếu có)
    let mon = null;
    m = t.match(/ (?:thang|t) ?(\d{1,2}) /);
    if (m && +m[1] >= 1 && +m[1] <= 12) mon = +m[1];
    if (!mon) {
      m = t.match(/ thang (muoi mot|muoi hai|gieng|chap|mot|hai|ba|bon|tu|nam|sau|bay|tam|chin|muoi)(?= )/);
      // "tháng năm 2026" là tháng 5; "tháng này năm..." đã xử lý ở trên
      if (m) mon = MONTH_WORDS[m[1]];
    }
    if (mon) {
      let y = cy;
      const ym = t.match(/ nam (\d{4}) /);
      if (ym) y = +ym[1];
      else if (/ nam (ngoai|truoc|roi) /.test(t)) y = cy - 1;
      else if (mon > cm) y = cy - 1;               // hỏi số liệu: tháng 12 lúc đang T8 -> tháng 12 năm ngoái
      return { period: mk(y, mon), how: 'month' };
    }
    return null;
  }

  /** "6 tháng gần đây", "3 tháng qua", "nửa năm", "cả năm" -> số tháng */
  function extractMonths(text) {
    const t = ' ' + norm(text) + ' ';
    let m = t.match(/ (\d{1,2}|hai|ba|bon|nam|sau|bay|tam|chin|muoi|muoi hai) thang (gan day|qua|vua qua|gan nhat|lien tiep|nay) /);
    if (m) return Math.min(24, /\d/.test(m[1]) ? +m[1] : NUM_WORDS[m[1]]);
    if (/ nua nam /.test(t)) return 6;
    if (/ (ca nam|mot nam|12 thang|nam nay) /.test(t)) return 12;
    if (/ (quy|3 thang) /.test(t)) return 3;
    return null;
  }

  /* ---------- Tòa nhà ---------- */
  /** buildings = [{id, name}] -> id của tòa được nhắc tới (hoặc null) */
  function extractBuilding(text, buildings) {
    if (!buildings || !buildings.length) return null;
    const t = ' ' + norm(text).replace(/\bq\.?\s?(\d+)\b/g, 'quan $1') + ' ';
    // bỏ những từ mà tòa nào cũng có ("happy home") -> còn lại phần phân biệt
    const lists = buildings.map((b) => toks(b.name));
    const common = lists.length > 1 ? lists[0].filter((w) => lists.every((l) => l.includes(w))) : [];
    let hit = null, hitLen = 0;
    buildings.forEach((b, i) => {
      const key = lists[i].filter((w) => !common.includes(w)).join(' ');
      if (key && t.includes(' ' + key + ' ') && key.length > hitLen) { hit = b.id; hitLen = key.length; }
    });
    return hit;
  }

  /* ---------- Mã phòng ---------- */
  /** codes = ['P101', ...] -> mọi mã phòng xuất hiện trong câu ("phòng 101" cũng được) */
  function extractRooms(text, codes) {
    const up = ' ' + String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ') + ' ';
    const set = [...new Set(codes.map((c) => String(c).toUpperCase()))];
    const found = set.filter((c) => up.includes(' ' + c.replace(/[^A-Z0-9]/g, '') + ' '));
    if (found.length) return found;
    // "phòng 101" -> tìm mã kết thúc bằng 101
    const m = norm(text).match(/\bphong (\d{2,4})\b/);
    if (m) return set.filter((c) => c.replace(/[^0-9]/g, '') === m[1]);
    return [];
  }

  /* ---------- Câu hỏi nối tiếp ---------- */
  // "còn P102 thì sao?", "vậy tháng trước?", "thế Gò Vấp?", "so với tháng trước"
  // Lưu ý: "Phòng P101 thế nào?" là câu hỏi MỚI, không phải nối tiếp -> không bắt "thế nào"
  function looksFollowUp(text) {
    const t = norm(text);
    return /^(con|the con|vay con|vay|the|con o|con cua|con voi|so voi|con ben|ben|o)\b/.test(t)
      || /\bthi sao$/.test(t)
      || t.split(' ').length <= 3;
  }
  // "phòng đó", "khách này", "họ" -> đang nói tiếp về đối tượng cũ
  // (không bắt "này" đứng một mình vì "tháng này" không phải nói về phòng cũ)
  const refersBack = (text) =>
    /\b(phong|khach|nguoi|hop dong|hoa don|ban) (do|nay|ay|kia|vua roi)\b/.test(norm(text))
    || /(^| )(ho|chi ay|anh ay|ban ay)( |$)/.test(norm(text));
  // hỏi TỔNG -> không được gắn vào phòng đang nói
  const asksWhole = (text) => /\b(tat ca|tong|toan bo|cac phong|phong nao|ai|nhung ai|he thong|moi phong|bao nhieu phong)\b/.test(norm(text));

  /** Bộ nhớ hội thoại ngắn hạn (hết hạn sau 15 phút không hỏi).
   *  - last: câu hỏi ngay trước (ý định + tham số) -> để hiểu "còn ... thì sao?"
   *  - mem : đối tượng nhắc gần đây (phòng, tòa) -> để đoán đúng khi mã phòng trùng giữa các tòa */
  function createContext(ttlMs) {
    const ttl = ttlMs || 15 * 60 * 1000;
    let last = null;
    let mem = {};
    const fresh = (x) => x && Date.now() - x.at < ttl;
    return {
      get() { return fresh(last) ? last : null; },
      set(intent, slots) { last = { intent, slots: Object.assign({}, slots), at: Date.now() }; },
      remember(kind, val) { if (val) mem[kind] = { val, at: Date.now() }; },
      recall(kind) { return fresh(mem[kind]) ? mem[kind].val : null; },
      clear() { last = null; mem = {}; },
      load(o) {
        if (!o) return;
        if (o.last && fresh(o.last)) last = o.last;
        if (o.mem && typeof o.mem === 'object') mem = o.mem;
      },
      dump() { return { last, mem }; },
    };
  }

  root.HHNLU = {
    norm, toks, lev, score, phraseIn,
    extractPeriod, extractMonths, extractBuilding, extractRooms,
    looksFollowUp, refersBack, asksWhole, createContext,
    shiftPeriod: shift, periodLabel: label,
  };
})(window);

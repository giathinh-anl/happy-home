/* ============================================================
   Happy Home — Gọi hàm máy chủ (RPC của Supabase/PostgREST) cho app khách thuê. Có kiểm thử: tests/rpc-lite.test.js

   Vì sao có tệp này: app khách chỉ dùng đúng một việc của thư viện supabase-js là gọi hàm RPC (khách vào bằng mã, không đăng nhập
   tài khoản Supabase). Thư viện đó nặng chừng 50 KB nén, tải từ CDN ở một tên miền khác trước khi app chạy được: trên mạng 4G chậm
   là thêm cả giây chờ màn hình trắng. Tệp này làm đúng việc đó bằng fetch, vài chục dòng, cùng chỗ với app.

   Trả lời giống supabase-js để tenant.js không phải đổi cách dùng:
   - client.rpc(tên, đối số) -> { data, error } ; error = { message, code, details, hint } (code giữ nguyên mã của PostgREST, ví dụ PGRST202
     khi máy chủ chưa có hàm). Mất mạng / quá giờ cũng KHÔNG ném lỗi mà trả error (giống supabase-js), để tenant.js dùng bản đã lưu.
   - Luôn gửi khóa công khai (anon) làm Authorization: app khách không dùng phiên đăng nhập Supabase. (supabase-js thì đọc phiên
     của web chủ trọ nếu cùng trình duyệt có người đang đăng nhập web chủ trọ, vì hai app cùng một địa chỉ gốc.)
   ============================================================ */
(function (root) {
  'use strict';
  const TEN_HAM = /^[a-z_][a-z0-9_]{0,62}$/;
  const HET_GIO = 20000;            // hầm xe, thang máy: chờ quá 20 giây thì coi như mất mạng, dùng bản đã lưu

  function createClient(url, key, opt) {
    const o = opt || {};
    const goc = String(url || '').replace(/\/+$/, '') + '/rest/v1/rpc/';
    const goi = o.fetch || (typeof fetch === 'function' ? fetch.bind(root) : null);
    const hetGio = o.hetGio || HET_GIO;
    const loiMang = (e) => ({ data: null, status: 0,
      error: { message: (e && e.name ? e.name + ': ' : '') + ((e && e.message) || String(e || 'Lỗi mạng')), code: '', details: '', hint: '' } });

    async function rpc(fn, args) {
      if (typeof fn !== 'string' || !TEN_HAM.test(fn)) return { data: null, status: 0, error: { message: 'Tên hàm không hợp lệ: ' + String(fn).slice(0, 40), code: 'TEN_HAM', details: '', hint: '' } };
      if (!goi) return loiMang(new Error('Trình duyệt không hỗ trợ fetch'));
      const ac = typeof AbortController === 'function' ? new AbortController() : null;
      const hen = ac ? setTimeout(() => ac.abort(), hetGio) : null;
      let res, text = '';
      try {
        res = await goi(goc + fn, {
          method: 'POST',
          headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(args || {}),
          signal: ac ? ac.signal : undefined,
        });
        text = await res.text();
      } catch (e) {
        return loiMang(e && e.name === 'AbortError' ? Object.assign(new Error('Máy chủ không trả lời'), { name: 'TimeoutError' }) : e);
      } finally { if (hen) clearTimeout(hen); }
      let body = null;
      if (text) { try { body = JSON.parse(text); } catch (e) { body = text; } }
      if (res.ok) return { data: body, error: null, status: res.status };          // 204 / nội dung trống thì body = null
      const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
      return { data: null, status: res.status, error: {
        message: String(b.message || (typeof body === 'string' && body ? body.slice(0, 300) : 'Máy chủ báo lỗi ' + res.status)),
        code: b.code != null ? String(b.code) : '', details: b.details || '', hint: b.hint || '' } };
    }
    return { rpc };
  }

  const api = { createClient };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.HH = root.HH || {}; root.HH.rpcLite = api; }
})(typeof window !== 'undefined' ? window : globalThis);

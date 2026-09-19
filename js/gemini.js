/* ============================================================
   Happy Home — Cầu nối Gemini Flash (dùng chung cho web quản trị & app khách)
   ------------------------------------------------------------
   NGUYÊN TẮC (rất quan trọng):
   Mô hình KHÔNG được tự nghĩ ra số liệu.
     1) Mô hình chỉ PHÂN LOẠI Ý ĐỊNH của câu hỏi  -> classify()
     2) Code truy vấn cơ sở dữ liệu lấy SỐ THẬT
     3) Mô hình chỉ SOẠN CÂU TRẢ LỜI từ số thật đó -> compose()
   Câu hỏi lặp lại nhiều đã có luật từ khóa trả lời sẵn (miễn phí, không gọi API).

   CẤU HÌNH (js/config.js — tệp này KHÔNG đẩy lên GitHub):
     window.HH_CONFIG = {
       aiProxyUrl: 'https://<project>.supabase.co/functions/v1/ai',  // KHUYẾN NGHỊ
       geminiApiKey: 'AIza...',        // chỉ dùng khi chạy thử ở máy cá nhân
       geminiModel: 'gemini-2.0-flash' // tùy chọn
     }
   Đặt khóa thẳng trong trình duyệt là AI AI XEM CŨNG THẤY. Khi đưa web cho người
   khác dùng, hãy dùng aiProxyUrl (xem supabase/functions/ai/index.ts).
   ============================================================ */
(function (root) {
  const CFG = () => root.HH_CONFIG || {};
  const MODEL = () => CFG().geminiModel || 'gemini-2.0-flash';
  const ENDPOINT = (m) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

  const QUOTA_KEY = 'hh_ai_quota';       // đếm số lượt gọi trong ngày (gói miễn phí ~1.500/ngày)
  const CACHE_KEY = 'hh_ai_cache';       // nhớ câu trả lời của những câu hỏi giống hệt nhau
  const DAILY_LIMIT = 1200;              // chừa biên an toàn dưới hạn mức miễn phí
  const CACHE_MAX = 60;

  /* ---------- Bộ đếm hạn mức theo ngày ---------- */
  function quota() {
    const today = new Date().toISOString().slice(0, 10);
    let q = { day: today, n: 0 };
    try { const raw = JSON.parse(localStorage.getItem(QUOTA_KEY) || 'null'); if (raw && raw.day === today) q = raw; } catch (e) {}
    return q;
  }
  function bumpQuota() {
    const q = quota(); q.n++;
    try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch (e) {}
    return q.n;
  }

  /* ---------- Bộ nhớ đệm câu trả lời ---------- */
  function cacheGet(k) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      const hit = c[k];
      if (hit && Date.now() - hit.t < 6 * 3600 * 1000) return hit.v;   // dùng lại trong 6 giờ
    } catch (e) {}
    return null;
  }
  function cacheSet(k, v) {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      c[k] = { v, t: Date.now() };
      const keys = Object.keys(c);
      if (keys.length > CACHE_MAX) {
        keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - CACHE_MAX).forEach(x => delete c[x]);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch (e) {}
  }

  /* ---------- Gọi mô hình ---------- */
  const configured = () => !!(CFG().aiProxyUrl || CFG().geminiApiKey);
  const viaProxy = () => !!CFG().aiProxyUrl;

  async function call(systemText, userText, opt) {
    opt = opt || {};
    if (!configured()) throw new Error('AI_NOT_CONFIGURED');
    if (quota().n >= DAILY_LIMIT) throw new Error('AI_QUOTA');

    const body = {
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      systemInstruction: { parts: [{ text: systemText }] },
      generationConfig: {
        temperature: opt.temperature != null ? opt.temperature : 0.2,
        maxOutputTokens: opt.maxTokens || 500,
        ...(opt.json ? { responseMimeType: 'application/json' } : {}),
      },
      safetySettings: [],
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opt.timeout || 12000);
    let res;
    try {
      if (viaProxy()) {
        res = await fetch(CFG().aiProxyUrl, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: MODEL(), body }),
        });
      } else {
        res = await fetch(ENDPOINT(MODEL()) + '?key=' + encodeURIComponent(CFG().geminiApiKey), {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e.name === 'AbortError' ? 'AI_TIMEOUT' : 'AI_NETWORK');
    }
    clearTimeout(timer);
    bumpQuota();

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      if (res.status === 429) throw new Error('AI_QUOTA');
      if (res.status === 400 && /API key/i.test(txt)) throw new Error('AI_BAD_KEY');
      throw new Error('AI_HTTP_' + res.status);
    }
    const data = await res.json();
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map(p => p.text || '').join('').trim();
    if (!text) throw new Error('AI_EMPTY');
    return text;
  }

  /* ---------- BƯỚC 1: phân loại ý định (chỉ trả JSON, không có số liệu) ---------- */
  const CLASSIFY_SYS = `Bạn là bộ phân loại ý định cho phần mềm quản lý nhà cho thuê tiếng Việt.
Nhiệm vụ DUY NHẤT: đọc câu hỏi và chọn 1 ý định trong danh sách được cung cấp.
TUYỆT ĐỐI KHÔNG trả lời câu hỏi, KHÔNG đưa ra bất kỳ số liệu kinh doanh nào.
Chỉ trả về JSON đúng dạng:
{"intent":"<mã ý định>","params":{"period":"YYYY-MM"|null,"months":số|null,"building":"tên tòa"|null,"roomCode":"mã phòng"|null,"name":"tên khách"|null},"confidence":0..1}
Quy tắc tham số:
- Chỉ điền thứ người dùng THỰC SỰ nói ra (hoặc nói tiếp theo NGỮ CẢNH). Không nói thì để null, không tự bịa.
- "period": đổi "tháng trước", "tháng 7"... sang YYYY-MM dựa vào KỲ HIỆN TẠI.
- "building": chỉ dùng tên có trong danh sách tòa nhà.
- Câu hỏi nối tiếp ("còn cái kia thì sao?") thì giữ ý định trong NGỮ CẢNH.
Nếu không khớp ý định nào, trả {"intent":"unknown","params":{},"confidence":0}`;

  async function classify(question, intents, extra) {
    extra = extra || {};
    const list = intents.map(i => `- ${i.key}: ${i.desc}${i.params ? ' | tham số: ' + i.params : ''}`).join('\n');
    const head = [
      extra.today ? `KỲ HIỆN TẠI: ${extra.today}` : '',
      extra.buildings && extra.buildings.length ? `TÒA NHÀ: ${extra.buildings.join('; ')}` : '',
      extra.context ? `NGỮ CẢNH: ${extra.context}` : '',
    ].filter(Boolean).join('\n');
    const raw = await call(CLASSIFY_SYS,
      `${head ? head + '\n\n' : ''}DANH SÁCH Ý ĐỊNH:\n${list}\n\nCÂU HỎI: "${question}"`,
      { json: true, temperature: 0, maxTokens: 200 });
    try {
      const o = JSON.parse(raw);
      return { intent: o.intent || 'unknown', params: o.params || {}, confidence: +o.confidence || 0 };
    } catch (e) { return { intent: 'unknown', params: {}, confidence: 0 }; }
  }

  /* ---------- BƯỚC 2: soạn câu trả lời TỪ dữ liệu thật ---------- */
  const COMPOSE_SYS = `Bạn là trợ lý của hệ thống quản lý nhà cho thuê "Happy Home", nói tiếng Việt.
QUY TẮC BẮT BUỘC:
1. Chỉ dùng số liệu có trong phần DỮ LIỆU. Tuyệt đối KHÔNG bịa, KHÔNG ước lượng, KHÔNG suy diễn thêm con số.
2. Nếu DỮ LIỆU không đủ để trả lời, hãy nói thẳng là chưa có thông tin đó, không đoán.
3. Trả lời ngắn gọn 1 đến 4 câu, KHÔNG dùng dấu gạch dài, lịch sự, tự nhiên như người Việt nói chuyện.
4. Giữ nguyên định dạng số tiền đã cho sẵn trong DỮ LIỆU (ví dụ "2.180.000 ₫"), không tự đổi đơn vị.
5. Không dùng Markdown. Có thể dùng thẻ <b> để nhấn mạnh và <br> để xuống dòng.`;

  async function compose(question, facts, persona) {
    return call(COMPOSE_SYS + (persona ? '\n6. ' + persona : ''),
      `DỮ LIỆU (đã lấy từ cơ sở dữ liệu, là số thật):\n${JSON.stringify(facts, null, 1)}\n\nCÂU HỎI CỦA NGƯỜI DÙNG: "${question}"\n\nHãy trả lời câu hỏi dựa đúng vào DỮ LIỆU trên.`,
      { temperature: 0.35, maxTokens: 420 });
  }

  /* ---------- Thông điệp lỗi thân thiện ---------- */
  function errText(code) {
    switch (code) {
      case 'AI_NOT_CONFIGURED': return 'Trợ lý AI chưa được cấu hình khóa Gemini.';
      case 'AI_QUOTA': return 'Hôm nay đã dùng hết lượt hỏi AI miễn phí. Mai thử lại giúp em ạ.';
      case 'AI_TIMEOUT': return 'Máy chủ AI phản hồi chậm quá. Anh/chị thử lại giúp em nhé.';
      case 'AI_NETWORK': return 'Không kết nối được máy chủ AI. Kiểm tra mạng giúp em ạ.';
      case 'AI_BAD_KEY': return 'Khóa Gemini không hợp lệ.';
      default: return 'Trợ lý AI đang bận. Anh/chị thử lại sau ít phút nhé.';
    }
  }

  root.HHGemini = {
    configured, viaProxy, classify, compose, call, errText,
    cacheGet, cacheSet,
    quotaUsed: () => quota().n, quotaLimit: DAILY_LIMIT,
    model: MODEL,
  };
})(window);

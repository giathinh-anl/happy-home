/* ============================================================
   Cấu hình kết nối Supabase.
   1) Sao chép file này thành  js/config.js
   2) Điền URL và anon key lấy từ: Supabase → Project Settings → API
   3) Thêm dòng  <script src="js/config.js"></script>  vào index.html
      (đặt TRƯỚC các script khác của app — xem BACKEND_SETUP.md)

   Lưu ý an toàn:
   - "anon public key" được thiết kế để nhúng vào code phía trình duyệt,
     an toàn khi công khai vì đã có Row Level Security bảo vệ theo từng người dùng.
   - TUYỆT ĐỐI KHÔNG dùng "service_role key" ở phía trình duyệt.
   - Nếu KHÔNG có file config.js, app vẫn chạy ở chế độ demo (lưu localStorage).
   ============================================================ */
window.HH_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseAnonKey: 'YOUR-ANON-PUBLIC-KEY',
};

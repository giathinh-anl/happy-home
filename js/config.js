/* Cấu hình kết nối Supabase (khóa anon public — an toàn nhúng ở trình duyệt vì đã có RLS). */
window.HH_CONFIG = {
  supabaseUrl: 'https://xkfpwqzmqwhjqwyeyodr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrZnB3cXptcXdoanF3eWV5b2RyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDAzNzQsImV4cCI6MjEwMjE3NjM3NH0.daZm0h8K82PPv3OuMEAw62LAThNTmuEVt3ITMKsWR9U',

  /* Trợ lý AI: khóa Gemini nằm trên máy chủ (Edge Function "ai", bí mật
     GEMINI_API_KEY), trình duyệt chỉ gọi tới địa chỉ này nên commit được.
     TUYỆT ĐỐI không đặt geminiApiKey ở đây: tệp này có lên GitHub. */
  aiProxyUrl: 'https://xkfpwqzmqwhjqwyeyodr.supabase.co/functions/v1/ai',
};

# Supabase

browser.ts dùng URL và publishable/anon key, khôi phục session hoặc đăng nhập ẩn danh. server.ts dùng secret/service_role key trong module server-only và xác minh Bearer token bằng getUser.

Chạy migrations/001_wolf_lobby.sql rồi migrations/002_wolf_engine.sql. 001 tạo sảnh chờ/RPC/RLS; 002 thêm game public/private, bot thử, CAS, heartbeat và rematch. Chỉ snapshot public được phát qua Realtime, state bí mật chỉ API server đọc.

Hướng dẫn cấu hình đầy đủ: HUONG-DAN-SUPABASE.txt ở gốc project.

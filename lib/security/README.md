# Quyền truy cập 0.3.0

Client dùng public key và token người dùng. API server xác minh token qua auth.getUser, kiểm tra thành viên và quyền chủ phòng. Bảng wolf_game_secrets bật RLS, không cấp quyền cho anon/authenticated và không nằm trong publication Realtime. Client chỉ nhận snapshot public cùng dữ liệu riêng của chính mình.

SUPABASE_SECRET_KEY (hoặc SUPABASE_SERVICE_ROLE_KEY legacy) chỉ được đọc từ module server-only; không dùng tiền tố NEXT_PUBLIC_. RPC start/commit chỉ service_role được execute, kiểm tra actor và host ở lúc commit. CAS, game_id, phase seq và nonce ngăn cập nhật cũ/trùng. Bot không phải tài khoản Auth và không thể làm host.

Chưa có chống lạm dụng/rate limit và dọn phòng hết hạn cho quy mô công khai lớn. Không coi fixture QA là kiểm thử trên hạ tầng Supabase/Vercel của người dùng.

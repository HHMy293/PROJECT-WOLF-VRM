# Project WOLF 0.4.0

Nâng cấp từ 0.3.4: tổng kết từng vòng, highlight phe thắng, chat realtime có emoji/sticker và sửa bốn lỗi giao diện đã xác minh. Source giữ nguyên các vai, ảnh nền và luật hiện có.

**Cập nhật:** đọc `docs/CAP-NHAT-0.4.0.md`. Chạy duy nhất migration `supabase/migrations/003_wolf_chat.sql` vào Supabase đang dùng, giữ `.env.local`/`.vercel`, rồi `npm ci`, `npm run typecheck`, `npm run build` và `npx vercel --prod`.

**Lưu ý:** lịch sử chỉ mở khi kết thúc ván. Không có kỹ năng hồi sinh người đã chết; bình Cứu cứu nạn nhân bị cắn trong đêm hiện tại. Ván cũ không thể khôi phục phần hành động chưa từng được lưu. Chat người sống khóa ban đêm; kênh người chết bị RLS tách khỏi người sống. UI chat hiện 100 tin gần nhất; dữ liệu giữ trong database.

Kiểm tra mới: `docs/QA-0.4.0-history-chat.json`, `docs/QA-0.4.0-production.json`, `docs/KIEM-THU-0.4.0.md`. Chưa triển khai vào tài khoản của người dùng.

---


Game Ma Sói tiếng Việt, Next.js 15, React 19, Supabase Auth/Postgres/Realtime. Giao diện Dark Fantasy responsive, font tiếng Việt local, chuyển cảnh, lá bài 3D và âm thanh tùy chọn. Demo prototype vẫn là chế độ riêng.

## Chạy

Đọc HUONG-DAN-SUPABASE.txt. Chạy migrations 001 rồi 002, bật anonymous sign-in và cấu hình ba biến trong .env.example thành .env.local. Nếu đã dùng bản lobby 0.2, chỉ cần chạy thêm 002.

```sh
npm ci
npm run dev
```

Production: `npm run build` rồi `npm start`, hoặc deploy Next.js lên Vercel. Không dùng static export/output directory out. Không commit .env.local.

## Trận online

Phòng 6–12 người, preset bộ thẻ tự đổi theo số chỗ, chủ phòng tùy chỉnh trước trận. Chế độ bot thử giúp hai người thật chơi cùng bot. Bot được gắn nhãn, tự sẵn sàng và chọn hành động đơn giản.

Server chia vai, xử lý Bảo Vệ → Sói → Tiên Tri → Phù Thủy, Thợ Săn, thảo luận, bỏ phiếu kín, bỏ phiếu phụ khi hòa và thắng/thua. Chủ phòng chuyển sớm mọi giai đoạn có đồng hồ và cộng 30 giây (tối đa 120 giây/lượt), kể cả đã chết. Lượt kỹ năng/bỏ phiếu có xác nhận trước khi skip. Reload khôi phục trận; chơi lại về sảnh chờ.

API xác thực token bằng Supabase getUser, kiểm tra membership và quyền host. State bí mật nằm trong bảng riêng không cho client đọc; snapshot public không chứa vai đang sống hoặc mục tiêu phiếu chưa công bố. CAS theo version ngăn ghi đè đồng thời; game ID/lượt/nonce ngăn hành động cũ và gửi lặp. Secret key chỉ được dùng trong module server-only.

## Kiểm chứng và giới hạn

Xem docs/VERIFICATION.md và các báo cáo QA-engine/QA-real-game. Đã kiểm thử production cục bộ với Auth/Postgres/Realtime fixture và hai trình duyệt độc lập; chưa kiểm thử triển khai trên tài khoản người dùng.

Đồng bộ game mỗi 2 giây và khi Realtime báo thay đổi. Deadline được lưu trên server, xử lý khi API được gọi. Nếu tất cả client đóng, trận bắt kịp deadline ở lần kết nối sau; chưa có scheduler nền độc lập. Bot không trò chuyện. Chưa có chống spam/rate limit và dọn phòng hết hạn cho quy mô công khai lớn.

## Nâng cấp 0.3.3

Đọc docs/CAP-NHAT-0.3.3.txt để xem thời gian từng vai và hướng dẫn cập nhật. Thời gian xử lý kỹ năng tăng lên 45–120 giây theo vai/chế độ; đồng hồ và quyền host được kiểm tra trên server. Không có migration mới khi đã dùng SQL 001/002.

## Nâng cấp 0.3.4

Giao diện Phù Thủy tự chọn đúng nạn nhân cho Cứu, hỗ trợ click nạn nhân và xác nhận riêng Cứu/Độc. Trong trận dừng hiệu ứng nền/sương/hạt liên tục, đồng hồ cập nhật 1 Hz, bỏ layout animation roster và giữ snapshot khi revision không đổi. Ảnh nền gốc được bảo toàn. Đọc docs/CAP-NHAT-0.3.4.txt; chưa có vai mới.

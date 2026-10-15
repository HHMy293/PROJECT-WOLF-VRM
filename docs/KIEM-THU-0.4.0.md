# WOLF 0.4.0 — Kiểm tra bản nâng cấp

Source nền: PROJECT-WOLF-Phase-1-source.zip, phiên bản lưu 11, package 0.3.4. File ZIP có đúng định danh bản lưu và kích thước; engine đang làm việc đối chiếu trùng byte với bản đó trước khi chỉnh sửa. Nâng cấp được thực hiện trên source cục bộ; không thay dữ liệu hoặc cấu hình tài khoản production của người dùng.

## Kết quả

- TypeScript: đạt.
- Next.js production build: đạt với cấu hình fixture cục bộ.
- Regression engine: 23 nhóm kiểm tra luật, gồm 30 ván người + bot mô phỏng kết thúc; đạt (`QA-engine-rules.json`).
- SQL 001/002 regression: 12 nhóm RLS/CAS/start/rematch/host; đạt (`QA-engine-db.json`).
- Lịch sử và chat SQL 003: 8 nhóm assertions; đạt (`QA-0.4.0-history-chat.json`). Xác minh lịch sử đêm không ra public khi chơi, từng phiếu/vote phụ, Cứu không hồi sinh, Bảo Vệ không chặn Độc, Thợ Săn, tương thích state cũ, winner cả phe, quyền đọc chat, không giả mạo sender/channel, nonce, khoảng cách gửi 2s, quota 60/10 phút, rerun SQL và rematch giữ dữ liệu.
- UI/API/realtime: 8 nhóm kiểm tra production cục bộ; đạt (`QA-0.4.0-production.json`). Hai BrowserContext/auth token độc lập, không dùng hai tab chung danh tính. Gửi chữ và sticker được qua Next/Supabase gateway mô phỏng giao thức Phoenix, RLS PostgreSQL chạy thật ở PGlite.
- Chat hồn ma không hiển thị ở trình duyệt người sống; cuối trận đọc được. Tin HTML hiển thị như văn bản. Rematch gỡ chat và giữ các hàng dữ liệu đã lưu.
- Che thẻ nhận vai: tên vai/phe không còn trong text DOM của mặt thẻ khi che; aria-hidden được kiểm tra. Thanh vòng/lượt vẫn hiện khi che kỹ năng.
- Mute header/footer thống nhất, lưu sau reload.
- Sảnh 12 chỗ: 1366×668, scrollHeight 672 px (4 px cuộn), không tràn ngang. QR mở modal.
- Màn chơi 12 chỗ: 1366×768, scrollHeight 768 px, không tràn ngang. Phần chat/kỹ năng dài cuộn nội bộ.
- Mobile 390×844: không tràn ngang trong kịch bản kiểm tra; cho phép cuộn dọc và chat nằm dưới phần trận.
- Tổng kết: highlight 11 người phe Làng ở fixture 1 Sói + 11 Làng, bao gồm người đã chết; lọc vòng, tải JSON và chơi lại đều qua giao diện.
- Ảnh nền gốc: đọc/giải mã PNG thành công, kích thước 1672×941, 2.343.687 byte; giữ nguyên nội dung ảnh.

## Giới hạn

Chưa chạy SQL hoặc deploy vào Vercel/Supabase của người dùng. Gateway realtime là fixture cục bộ, không thay thế managed Supabase. Các ca UI dùng sửa state fixture để cô lập Phù Thủy, ngày, người chết và kết thúc; không dùng kết quả đó để tuyên bố đã chơi đầy đủ tất cả vai qua UI. Luật được kiểm tra riêng ở engine.

Không đo FPS/hiệu năng trên laptop thật của người dùng, không thử 12 người thật qua Internet, không stress production, chưa kiểm Firefox/Safari hoặc screen reader thật. Kiểm tra mobile là smoke test, không bảo đảm mọi tên dài/zoom. Tổng kết cuối trận có thể cần cuộn; lịch sử được giới hạn vùng cuộn và lọc theo vòng.

Lịch sử các ván cũ không được lưu từng hành động không thể khôi phục. State cũ được chấp nhận và có thông báo lịch sử thiếu phần trước cập nhật. Bản này không thêm vai hồi sinh hoặc sửa luật Cứu/Độc.

Bộ test production có thể in HTTP 409 khi fixture chuyển sequence hoặc mở rematch trong lúc polling còn chờ; đó là kiểm tra với state thay đổi có chủ đích. Không coi log này là chứng nhận mọi tranh chấp/mất mạng ở production đã được giải quyết.

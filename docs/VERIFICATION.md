# Bản 0.3.4 — Phù Thủy và giảm tải giao diện (09/10/2026)

- Typecheck đạt; QA-engine-rules.json tiếp tục đạt 23 nhóm và 30 trận.
- QA-witch-production.json: Next production API + SDK Supabase thật + Auth/Postgres/Realtime fixture cục bộ; Cứu tự đánh dấu nạn nhân, click thẻ nạn nhân, chặn chọn người khác, POST save thành công, không dùng lại bình, chọn Độc và xác nhận thành công. Giai đoạn/vai/nạn nhân được sắp xếp trong DB fixture; không có backdoor trong app.
- Ảnh gốc được giải mã trên trình duyệt 1672×941, nền không bị thay; trong trận animation nền tắt và sương không render. Giữ hiệu ứng trang chủ, lật thẻ/chuyển cảnh.
- Đồng hồ cập nhật 1 lần/giây thay vì 4; giữ snapshot khi revision không đổi; bỏ Motion layout measurement ở roster. Không đổi polling 2 giây hoặc server progression.
- Đây là giảm tải có thể xác minh bằng code và DOM, chưa đo FPS/độ trễ trên máy và hạ tầng hosted của người dùng. Không tuyên bố đã hết mọi lag mạng.
- Không có migration mới, không thêm vai mới; 6 loại thẻ hiện hữu giữ nguyên luật.

---

# Bản 0.3.3 — thời gian và điều khiển lượt (09/10/2026)

- QA-engine-rules.json: 23 nhóm, 30 trận; thời gian kỹ năng mới, skip/gia hạn mọi giai đoạn, giới hạn 120 giây/lượt, reset giới hạn, nonce idempotent, host đã chết, phiếu đã chốt và Thợ Săn không bắn khi skip. Luật cũ tiếp tục đạt.
- QA-pack-production.json: Next API/SDK Supabase thật với fixture Auth/Postgres/Phoenix; host +30 giây qua UI đồng bộ khách, khách không thể skip, mở/hủy xác nhận không đổi lượt, hai Sói chia sẻ/đổi/chốt mục tiêu, riêng tư, reload, vote, skip thảo luận và rematch.
- Quyền host của skip_phase/extend_phase được kiểm tra cả engine lẫn RPC commit hiện có, tránh host cũ ghi khi chuyển host. Không sửa SQL; trường gia hạn tùy chọn tương thích state JSON cũ.
- Bố cục 1366×668 và mobile 390×844 kiểm tra bằng trình duyệt production cục bộ. Bảng riêng dài có cuộn nội bộ; xác nhận skip có thể tăng chiều cao và không cắt nội dung.
- Typecheck, production build và kiểm tra bundle không chứa secret: đạt.
- Chưa kiểm thử trực tiếp Supabase/Vercel hosted của người dùng. Các báo cáo bên dưới mô tả phiên bản lịch sử, thời gian 0.3.3 thay thế thời gian cũ.

---

# Bản 0.3.2 — phối hợp Sói và bố cục (08/10/2026)

- QA-engine-rules.json: 19 nhóm, 30 trận; đề xuất riêng/phiếu chốt, đổi trước đóng, bot Sói phối hợp, Sói chết không nhận kế hoạch, A/A/B cắn A. Các giới hạn kỹ năng và thắng/thua tiếp tục đạt.
- QA-pack-production.json: hai Sói thật trong Auth/Postgres/Realtime fixture cục bộ; chia sẻ đề xuất, đổi, chốt cùng mục tiêu; riêng tư, reload, bỏ phiếu, skip, kết quả, rematch. Vai được sắp xếp bằng DB fixture để tái hiện, không có API chỉnh vai trong production.
- Kiểm tra 1366×668 (laptop 1366×768 trừ thanh trình duyệt), form tham gia và 12 người; bảng riêng vẫn có cuộn nội bộ. Mobile 390×844 tiếp tục thao tác được.
- Typecheck và clean production build: đạt.
- Không có SQL mới; state JSON hỗ trợ kế hoạch Sói tùy chọn để tương thích dữ liệu cũ. Nên thử bằng trận mới.
- Chưa kiểm thử Supabase/Vercel hosted của người dùng hoặc mọi trình duyệt/zoom. Không tuyên bố tất cả lỗi hạ tầng đã được xử lý.

---

# Bản 0.3.1 — riêng tư, laptop và đồng bộ (08/10/2026)

- Typecheck/build đạt. Kiểm thử luật và 30 trận bot vẫn đạt.
- Production fixture hai phiên độc lập: ẩn/hiện bảng riêng, Esc, chọn thẻ thật và POST xác nhận phiếu thành công, reload, host skip và rematch đạt; báo cáo QA-real-game-production.json.
- Kiểm tra bố cục 1366×668 (laptop 1366×768 trừ thanh trình duyệt) và mobile 390×844. Phần kỹ năng dài cuộn trong panel, không cắt nút hành động. Chưa kiểm tra mọi vai và 12 người trên laptop thật.
- Timeout API 12 giây, nút đồng bộ lại, bỏ response có revision cũ trước khi cập nhật đồng hồ. Không tự gửi lại hành động để tránh thao tác không rõ kết quả.
- Mặc định che bảng vai trò/kỹ năng; tự che khi đổi lượt, blur, visibilitychange, Esc. Demo có nút che bảng và blur/Esc.
- Lượt đêm quick: Bảo Vệ 20s, Sói 25s, Tiên Tri 20s, Phù Thủy 30s; classic gấp đôi. Hoàn thành sớm vẫn chuyển lượt sớm, bỏ qua vai không có người sống.
- Ảnh người dùng thuộc màn hình demo; chưa có log lỗi cụ thể của triển khai hosted. Không kết luận đã sửa mọi lỗi mạng/Supabase của người dùng từ kiểm thử fixture.

---

# Kiểm tra bản 0.3.0 — engine thật và bot thử (07/10/2026)

- TypeScript và build Next.js production: đạt.
- QA-engine-rules.json: 15 nhóm luật và 30 trận chạy đến kết thúc; vai riêng, kỹ năng, hòa phiếu, chuỗi Thợ Săn, winner, quyền host, nonce và lượt cũ.
- QA-engine-db.json: 12 nhóm kiểm tra migrations chạy lại, RLS/privileges, bot/sẵn sàng, start/CAS, actor/host, nối lại, rematch, heartbeat và chống game cũ ghi đè game mới.
- QA-real-game.json và QA-real-game-production.json: hai người thật mô phỏng bằng hai phiên Auth/browser độc lập + bốn bot, start/API/private roles, từ chối token/quyền sai, reload, kết thúc thảo luận, thắng/thua và rematch.
- Kiểm tra giao diện desktop và mobile bằng Chromium; ảnh preview-real-game-desktop.png và preview-real-game-mobile.png.
- Fixture dùng PGlite, Auth HTTP và Phoenix Realtime cục bộ. Test rút ngắn deadline bằng thao tác DB chỉ trong fixture QA; source production không có API rút ngắn deadline để test.
- Chưa kiểm thử end-to-end trên Supabase/Vercel của người dùng, Safari/Firefox hoặc thiết bị thật.
- Engine xử lý deadline khi API được gọi; chưa có scheduler nền độc lập. Bot đơn giản, không trò chuyện. Chưa có chống spam/rate limit và dọn phòng hết hạn cho quy mô lớn.
- Báo cáo lobby 0.2 và prototype bên dưới là lịch sử kiểm thử, không phải chứng cứ riêng cho engine.

---

# Kiểm tra Phase 1

Ngày: 07/10/2026. Kiểm tra trên bản production tĩnh bằng Chromium headless.

- `npm run build`: thành công, Next.js 15.5.27; không lỗi TypeScript.
- `npm run typecheck`: thành công.
- Tạo phòng 6 người mặc định, lobby, role reveal 3D, hành động Tiên Tri, refresh giữ kết quả: đạt.
- Đêm, sáng công bố Trang, thảo luận, vote, vote phụ hòa lần nữa không loại ai: đạt.
- Vòng hai, bỏ phiếu loại Linh, Thợ Săn chọn Không bắn, hai màn hình chiến thắng: đạt.
- Mất kết nối mô phỏng và khôi phục: đạt.
- Sáu vai: màn đêm hiển thị đúng loại kỹ năng; Dân Làng/Thợ Săn chờ: đạt.
- Ma Sói không chọn Minh đồng đội; Tiên Tri không soi mình; Bảo Vệ có thể bảo vệ mình, không lặp mục tiêu đêm sau; không tự vote; Phù Thủy khóa bình thứ hai sau xác nhận: đạt.
- Không có pageerror trong luồng chính.
- Trang chủ chụp ở 1440×900 và 390×844; màn đêm kiểm tra tràn ngang 390px cho sáu vai; kết thúc kiểm tra tràn ngang ở 390/768/1280/1440px: đạt.
- Thiết lập `prefers-reduced-motion` đã được áp dụng trong CSS và Motion; chưa kiểm tra bằng người dùng thật.

Ảnh: preview-desktop.png, preview-lobby.png, preview-night.png, preview-mobile.png.
Chi tiết tự động: QA.json và QA-roles.json.

Đây là kiểm tra frontend và kịch bản mock, không kiểm chứng gameplay nhiều người, bảo mật, RLS hay Realtime. Chưa kiểm tra thủ công trên Safari/Firefox hoặc thiết bị thật. Role artwork hiện là icon riêng và card thiết kế; chưa có tranh nhân vật riêng cho sáu role.

## Bản sửa font tiếng Việt
Noto Serif và Be Vietnam Pro tải thành công trên Chromium. Kiểm tra tiêu đề tiếng Việt, font body, ảnh Home/Lobby và tràn ngang Home 390/768/1280/1440px: đạt. Build production thành công. Chưa kiểm tra trực tiếp trên máy Windows của người dùng.

## Chủ phòng kết thúc thảo luận sớm
Build thành công. Kiểm tra Chromium: host skip mở vote ngay với timer mới, người khác không thấy nút, nút không hiện ban đêm, host đã chết vẫn skip, countdown hết giờ vẫn chuyển vote, không tràn ngang ở 390px: đạt. Kết quả: QA-skip-discussion.json.

## Preset bộ thẻ
Build thành công. Chromium kiểm tra chính xác preset 6–12 theo đặc tả; đổi 12 người nạp 12 thẻ; chỉnh và giữ cấu hình khi join; khôi phục mặc định; cảnh báo dư thẻ và vô hiệu lưu; bắt đầu đủ 12 người: đạt. Kết quả QA-role-presets.json.

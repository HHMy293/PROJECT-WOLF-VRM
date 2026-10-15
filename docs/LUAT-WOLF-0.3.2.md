# Luật WOLF 0.3.2

Các luật dưới đây là biến thể được dùng trong source, không phải tuyên bố mọi bản Ma Sói đều có cùng luật.

| Vai | Kỹ năng và giới hạn |
| --- | --- |
| Ma Sói | Mỗi Sói còn sống có một phiếu cắn. Đề xuất riêng được chia sẻ trong bầy; đề xuất chưa xác nhận không tính phiếu. Có thể đề xuất lại để mở phiếu đã chốt trước khi lượt đóng, sau đó phải xác nhận lại. Người ngoài phe Sói có số phiếu xác nhận cao nhất duy nhất bị cắn. Hòa hoặc không có phiếu: không cắn. Bỏ qua/hết giờ chưa chốt không có phiếu. |
| Bảo Vệ | Bảo vệ người còn sống, được tự bảo vệ; không cùng mục tiêu hai đêm liên tiếp. Bỏ qua đêm thì đêm sau chọn lại được. Chỉ chặn cắn, không chặn độc. |
| Tiên Tri | Soi người còn sống khác mình, biết Sói/không phải Sói; không biết chính xác các vai phe Làng. Lưu kết quả riêng từng đêm; người khác không đọc được. |
| Phù Thủy | Một Cứu, một Độc cả ván; tối đa một bình mỗi đêm. Cứu đúng mục tiêu cắn, có thể tự cứu. Độc chỉ người còn sống khác mình. Cứu/Bảo Vệ không ngăn Độc; Cứu không hồi sinh người đã chết. |
| Thợ Săn | Chết do cắn/độc/phiếu đều có một lượt bắn người còn sống khác mình. Một phát cả ván. Bỏ qua/hết giờ không bắn. Chuỗi Thợ Săn xử lý hết mới xét thắng. |
| Dân Làng | Không hành động đêm; thảo luận và bỏ phiếu ban ngày. |

Đêm xử lý Bảo Vệ → Sói → Tiên Tri → Phù Thủy, rồi cùng công bố người chết. Bot Sói xem kế hoạch riêng của bầy để phối hợp, không đọc thông tin kỹ năng phe khác. Người chết không hành động, ngoại trừ Thợ Săn đúng lượt; Sói chết không xem lựa chọn mới của bầy.

Phiếu ban ngày: người sống, không tự vote, số phiếu cao nhất duy nhất bị loại. Hòa top thì bỏ phiếu phụ chỉ nhóm hòa, tiếp tục hòa thì không loại ai. Mục tiêu phiếu kín, công bố khi đóng lượt. Chọn thẻ chưa đồng nghĩa xác nhận.

Làng thắng khi hết Sói; Sói thắng khi Sói sống >= số người phe Làng sống. Sau xử lý phát súng mới xét thắng. Chủ phòng không quyết định người chết, chỉ được kết thúc thảo luận sớm và mở ván mới.

Ví dụ Sói:
- Hai Sói chốt A/A: cắn A.
- Hai Sói chốt A/B: hòa, không cắn.
- Ba Sói chốt A/A/B: cắn A, không yêu cầu đồng thuận tất cả.
- Chỉ một Sói chốt A, các Sói khác bỏ qua/hết giờ: cắn A.
- Chỉ đề xuất, không ai xác nhận: không cắn.

# PROJECT WOLF 0.4.0 — Hướng dẫn cập nhật bản hoàn chỉnh

Bản này nâng cấp từ source 0.3.4 đang sử dụng. Gói ZIP chứa toàn bộ source trong thư mục `project-wolf` và file hướng dẫn này. Chỉ cần tải **PROJECT-WOLF-0.4.0-Hoan-chinh.zip**, không phải ghép các bản vá cũ.

## 1. Những gì đã bổ sung

- Tổng kết sau trận: lịch sử từng vòng, từng người, từng lượt bỏ phiếu chính/phụ; phiếu cắn của từng Sói, mục tiêu Bảo Vệ/Tiên Tri, bình Cứu/Độc, người bị bắn kéo theo. Người bỏ qua hoặc chưa xác nhận khi hết giờ/Skip có dòng riêng.
- Phân biệt mục tiêu được cắn với người thực sự chết: có thể được Bảo Vệ hoặc bình Cứu cứu, nhưng Độc vẫn có tác dụng theo luật cũ. Hành động đã xác nhận mới được ghi là phiếu hợp lệ.
- Lịch sử chi tiết chỉ hiển thị sau khi ván kết thúc; lọc theo vòng và tải JSON để giữ bản tổng kết trước khi chơi lại. Dữ liệu lịch sử nằm trong trạng thái ván đã lưu, không bị xóa khi rematch.
- Highlight toàn bộ người thuộc phe thắng, kể cả người đã hy sinh; người sống sót có trạng thái riêng. Không chỉ đánh dấu người còn sống.
- Chat realtime bên trái trên laptop/PC, có chọn emoji và 8 sticker biểu cảm dạng emoji lớn. Tin nhắn tối đa 500 ký tự, gửi cách nhau ít nhất 2 giây, tối đa 60 tin/người/10 phút. UI hiển thị 100 tin gần nhất; các tin trước vẫn được lưu.
- Chat người sống tạm khóa trong đêm/nhận vai. Người chết chỉ gửi vào kênh hồn ma; người sống không được đọc kênh đó. Cuối ván, mọi người có thể đọc và trò chuyện chung. Người chết vẫn đọc được chat công khai trước đó. Bot không tự gửi chat.
- Hướng dẫn chọn mục tiêu nói rõ phải mở vai trò/kỹ năng trước; không chỉ bảo chọn khi thẻ còn bị khóa.
- Sảnh thu gọn, luật mở rộng thu gọn mặc định, QR mở trong hộp thoại.
- Che vai đầy đủ ở màn nhận vai: khi che, tên vai/phe không còn nằm trong nội dung thẻ ẩn cho trình đọc màn hình. Trong trận, bảng kỹ năng riêng được gỡ khi che; thanh vòng/lượt luôn hiện.
- Mute ở header và trong trận dùng chung trạng thái; lựa chọn được lưu trên trình duyệt sau reload/rematch. Nhạc nền cũng tuân theo mute.
- Giữ ảnh nền ngôi làng/mặt trăng, 6 loại vai hiện có, luật 0.3.4, Skip và gia hạn +30 giây.

**Bình Cứu không phải hồi sinh.** Bản hiện có không có vai hồi sinh người đã chết; không thêm luật đó trong bản này. Lịch sử ghi rõ ai được cứu khỏi Sói cắn trong đêm hiện tại. Không thể dựng lại lịch sử chi tiết các ván cũ đã mất dữ liệu hành động; ván chạy từ bản cũ sẽ có cảnh báo thiếu phần trước cập nhật.

## 2. Chuẩn bị và copy source trên Windows

1. Nếu đang có một ván chơi thật, chờ ván đó kết thúc rồi cập nhật để mọi người cùng sử dụng một phiên bản.
2. Trong terminal đang chạy dev, nhấn **Ctrl+C**.
3. Sao chép thư mục đang dùng thành một bản dự phòng, ví dụ `project-wolf-backup-0.3.4`. Bản dự phòng chứa cấu hình của riêng bạn; không gửi nó lên GitHub hoặc chia sẻ.
4. Giải nén `PROJECT-WOLF-0.4.0-Hoan-chinh.zip` ra một thư mục tạm.
5. Mở thư mục `project-wolf` trong gói giải nén. Chọn toàn bộ nội dung bên trong và copy vào thư mục hiện có chứa `package.json`:

   `B:\PROJECT-WOLF-Phase-1-source\project-wolf`

6. Chọn **Replace the files in the destination** để ghi đè. Không copy cả thư mục vào thành `project-wolf\project-wolf`.
7. Giữ nguyên `.env.local`, `.vercel` và `.git` của bạn. Gói này không chứa các mục đó; không xóa thư mục cũ trước khi copy.
8. Mở `package.json`, kiểm tra dòng `"version": "0.4.0"`.

## 3. Cập nhật Supabase — chạy đúng SQL 003 trước

Đây là bước mới bắt buộc để chat hoạt động. Giữ Supabase project đang dùng, không tạo project mới và không đổi khóa.

1. Mở Supabase, chọn đúng project WOLF đang chạy.
2. Vào **SQL Editor**, mở truy vấn mới.
3. Trong source mới trên máy, mở:

   `project-wolf\supabase\migrations\003_wolf_chat.sql`

4. Copy toàn bộ nội dung SQL vào editor và bấm **Run**.
5. Chờ kết quả thành công. Migration được thiết kế chạy lại được và không xóa dữ liệu phòng/người chơi/trận cũ. Nó chỉ tạo bảng chat, các hàm kiểm tra quyền và thêm bảng chat vào publication realtime.
6. Không chạy lại SQL 001/002 cho lần nâng cấp này. Không reset database hoặc truncate bảng.
7. Nếu SQL báo lỗi, dừng trước khi deploy và giữ lại thông báo lỗi để kiểm tra. Không bỏ một phần SQL, không tắt RLS để làm chat hoạt động.

SQL xác minh bảng và realtime (chỉ đọc):

```sql
select to_regclass('public.wolf_chat_messages') as chat_table;
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename = 'wolf_chat_messages';
```

Mong đợi: `chat_table` có tên bảng; truy vấn publication có 1 dòng `public / wolf_chat_messages`. Migration không đưa `wolf_game_secrets` vào realtime.

## 4. Kiểm tra trên máy

Mở terminal tại thư mục chứa `package.json`:

```powershell
cd B:\PROJECT-WOLF-Phase-1-source\project-wolf
npm ci
npm run typecheck
npm run build
npm run dev
```

Chạy từng lệnh và chờ hoàn tất. Nếu một lệnh lỗi, chưa chạy bước deploy. `.env.local` đã dùng ở bản cũ được giữ nguyên.

Mở trang local mà terminal hiển thị. Dùng cửa sổ thường và cửa sổ ẩn danh để có hai người chơi độc lập. Tạo phòng mới, thêm bot nếu cần.

Kiểm tra nhanh:

- Ở sảnh, QR mở thành hộp thoại; nút sẵn sàng/bắt đầu nằm gần nhau, có khoảng cách rõ.
- Tắt âm ở header, vào trận: footer cũng phải ghi “Bật âm thanh”. Tải lại vẫn giữ lựa chọn.
- Khi chưa mở thẻ nhận vai, tên vai không xuất hiện trong thẻ bị che. Bấm lần nữa/Esc để che.
- Ban đêm, khi bảng riêng bị che, lời nhắc hướng dẫn mở kỹ năng; thanh vòng/lượt không bị che theo.
- Ban ngày, gửi một tin nhắn từ người A; người B nhận mà không cần tải lại. Thử emoji và sticker.
- Khi chết, tin nhắn gửi vào kênh hồn ma; người sống không thấy. Chat chung được mở ở cuối ván.
- Kết thúc ván: có highlight người thắng, bảng lịch sử, bộ lọc vòng và nút tải JSON. Lịch sử phiếu phụ có mục riêng.
- Trước khi bấm chơi lại, tải JSON nếu muốn một bản tổng kết riêng trên máy. Ván trước vẫn nằm trong database, nhưng giao diện hiện tại tập trung vào ván đang chơi.

## 5. Đưa code lên domain Vercel hiện có

Sau khi kiểm tra local và SQL 003 thành công:

1. Nhấn **Ctrl+C** để dừng dev.
2. Vẫn ở đúng thư mục `project-wolf`, chạy:

```powershell
npx vercel --prod
```

3. Nếu CLI hỏi cài package, chọn **y**. Nếu hỏi tài khoản/team, dùng đúng tài khoản/team chứa project hiện có. Nếu hỏi liên kết dự án, chọn **project-wolf** hiện có; không tạo project mới.
4. Nếu báo `Error: Not authorized`, chạy:

```powershell
npx vercel login
npx vercel --prod
```

5. Chờ deploy **Ready**. Kiểm tra domain được gắn đúng:

   https://project-wolf-one.vercel.app

6. Mở domain, nhấn **Ctrl+F5**. Mọi người tải lại trang; tạo phòng mới và thử ít nhất hai phiên độc lập.
7. Nút Redeploy của một deployment cũ chỉ build lại source của deployment đó. Muốn đưa code mới trên máy lên domain, chạy `npx vercel --prod` tại thư mục đã copy bản 0.4.0.
8. Không cần mua domain mới hay đổi DNS nếu vẫn dùng domain đã gắn vào project này.

Các biến môi trường trên Vercel vẫn dùng những giá trị đang chạy ổn định: URL Supabase, Publishable/anon key và Secret/service-role key ở phía server. Không cần đổi khóa cho bản này. Không đưa Secret/service-role key vào biến `NEXT_PUBLIC_*`.

Nếu bạn đã kết nối GitHub với Vercel, có thể commit/push bản mới để auto-deploy theo cấu hình hiện có. Bạn không bắt buộc hoàn tất GitHub trước khi dùng cách CLI ở trên. Trước khi `git add`, kiểm tra `.gitignore` vẫn loại `.env.local`, `.vercel`, `node_modules` và `.next`.

## 6. Nếu gặp lỗi và cách quay lại

- **Không có chat / báo migration 003:** kiểm tra đã chạy SQL ở đúng Supabase project của website và bảng nằm trong publication. Kiểm tra hai phiên cùng một phòng/ván. Chat người sống khóa ban đêm là hành vi đã thiết kế.
- **Báo chờ 2 giây:** chờ rồi gửi lại; server chống spam. Tin nhắn gửi lại cùng nonce không tạo bản trùng.
- **Website vẫn cũ:** kiểm tra version trên source là 0.4.0, terminal đứng đúng thư mục, deploy đúng project, đợi Ready rồi Ctrl+F5. Không dùng nút Redeploy của bản cũ để tải source mới.
- **Không có lịch sử ván cũ:** dữ liệu hành động cũ không được lưu đầy đủ; không thể khôi phục bằng giao diện mới. Hãy kiểm tra ván mới sau cập nhật.
- **Cần quay lại code cũ:** dùng bản dự phòng 0.3.4 để deploy lại vào cùng project. Có thể giữ nguyên migration 003; bảng chat bổ sung không cản code cũ. Không xóa dữ liệu Supabase để rollback.

## 7. Phạm vi kiểm tra và tài liệu

Kết quả kiểm thử bản này nằm trong `project-wolf/docs/QA-0.4.0-*.json` và `project-wolf/docs/KIEM-THU-0.4.0.md`. Kiểm thử cục bộ không thay thế thử trên Vercel/Supabase thật và mạng/máy của bạn. Gói được chuẩn bị để bạn cập nhật; chưa deploy vào tài khoản Vercel hoặc chạy SQL trên Supabase của bạn.

Tài liệu chính thức đã đối chiếu:

- Vercel CLI deploy: https://vercel.com/docs/cli/deploy
- Vercel CLI login: https://vercel.com/docs/cli/login
- Supabase Postgres Changes và publication/RLS: https://supabase.com/docs/guides/realtime/postgres-changes

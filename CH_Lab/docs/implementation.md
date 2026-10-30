# Thực hiện game VNR202

Yêu cầu đã chốt: FIFO như giơ tay, vẫn nhận lượt khi nhóm đầu trả lời; Sai bỏ đầu hàng, Đúng +1 và chốt; không thời gian; nhóm 1,3,4,5,6,7; bỏ code 3D/lớp học. Deploy Vercel, dùng GameProject (được người dùng chọn).

## Quyết định triển khai

- Dùng mã host ngẫu nhiên riêng thay email/password Supabase Auth, vì đây là một buổi thuyết trình và không cần đăng ký tài khoản. Mã host và token phiên chỉ lưu hash trong schema private; ba RPC kiểm tra quyền trước khi thay đổi.
- Một thiết bị/nhóm. Heartbeat 5 giây, có thể tiếp quản sau 30 giây; ngắt mạng không xóa hàng chờ hay điểm.
- Database khóa một hàng trận đấu cho mọi lệnh. Chấm điểm kiểm tra cả round và nhóm đầu hàng, tránh chấm nhầm khi bấm liên tiếp. Bảng public chỉ chứa số phiên bản để thông báo Realtime.
- Giữ đường dẫn `/` và `/chuong.html`, bỏ backend LAN để chỉ có một nguồn luật trong SQL.
- Xóa migration lớp học khỏi repo cài mới, không chạy DROP lên database cũ.

## Tiến độ

- Baseline: 6 test cũ đạt; build cũ đạt.
- Regression: 11 test mới fail khi chưa có schema, sau đó 11/11 đạt với SQL thực tế.
- Đã thay giao diện, client Supabase; bỏ đồng hồ và điểm thưởng; xóa code/tài nguyên lớp học cũ.
- Rà soát độc lập phát hiện hai lỗi đồng thời: bỏ sót thông báo khi đang tải trạng thái, và snapshot có thể trộn revision. Đã thêm test tái hiện lỗi client (fail → pass), chạy lại sau thông báo đến muộn và khóa cùng hàng trận khi đọc snapshot. Thêm kiểm tra tiếp quản thiết bị và quyền truy cập schema private. Tổng 14/14 test đạt.
- Kiểm tra Supabase thật: một host + đủ sáu nhóm, ba lượt FIFO rồi các lượt bấm song song, chấm trùng, snapshot đồng thời, RPC trái quyền, round cũ và Realtime (11 thông báo) đều đạt; reset dữ liệu chơi thử.
- Đối chiếu trong PGlite: 15 câu, đáp án, lựa chọn và giải thích trùng nguyên bản trong Git.
- Production: https://vnr202-buzzer.vercel.app — READY, Vite / Node24, project vnr202-buzzer trong tài khoản Hobby hiện có. HTTP không đăng nhập: / và /chuong.html trả 200; /.env.local và /HOST_ACCESS.local.txt trả 404.
- Kiểm tra giao diện production: hàng 4 → 1 → 7, Sai chuyển nhóm1, Đúng +1, reload giữ trận, Next xóa hàng. Không có lỗi/warning ứng dụng trong console. Điều khiển trình duyệt bị dừng lúc hộp thoại reset vì không xác minh được URL; reset/giải phóng phiên thử được thực hiện qua database.
- Chưa kiểm tra điện thoại thật/4G hoặc tải lớn; chưa push/merge GitHub. Bảng public.quiz cũ của GameProject chưa bật RLS và được giữ nguyên ngoài phạm vi game này.

# Rung chuông vàng · VNR202

Game thuyết trình về chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954.

**Bản online:** https://vnr202-buzzer.vercel.app · **Người dẫn:** https://vnr202-buzzer.vercel.app/?host=1

- Nhóm thi: **1, 3, 4, 5, 6, 7**. Nhóm 2 dẫn chương trình.
- Mỗi nhóm một thiết bị đại diện. Mỗi câu chỉ được bấm một lần.
- Bấm chuông để vào hàng chờ; nhóm bấm trước ở trên cùng. Các nhóm khác vẫn bấm khi nhóm đầu đang trả lời.
- Người dẫn bấm **Sai** để chuyển ngay sang nhóm kế tiếp. Hết hàng vẫn tiếp tục chờ các nhóm chưa trả lời.
- Bấm **Đúng** tự cộng **1 điểm** và chốt câu. Không trừ điểm, không nhân đôi, không chấp thời gian, không đếm giờ.
- Người dẫn chủ động **Hiện đáp án**, **Câu tiếp theo**, **Chơi lại**. Chơi lại xóa toàn bộ điểm sau xác nhận.
- Có 15 câu, giữ nguyên nội dung bộ câu hỏi gốc. Hòa điểm được giữ nguyên để người dẫn quyết định.

## Chạy trên máy

Cần Node.js 22.12 trở lên (hoặc 24).

```sh
npm ci
npm run dev
```

Copy `.env.example` thành `.env.local` và điền URL + publishable key của Supabase. Không dùng secret/service-role key trong biến `VITE_*`.

- Người chơi: `/`
- Nhóm cụ thể: `/?nhom=7`
- Người dẫn: `/?host=1` rồi nhập mã riêng. Mở link host không tự cấp quyền điều khiển.
- Phím tắt host: `D` đúng, `S` sai, `Enter` bắt đầu/câu tiếp theo. Có thể bật/tắt nhạc và tiếng chuông.

## Database Supabase

Chạy các file SQL trong `supabase/migrations` theo thứ tự tên một lần. Chúng tạo schema riêng `vnr202_private`, ba RPC `vnr202_join`, `vnr202_state`, `vnr202_action` và bảng thông báo `vnr202_events`. Không phụ thuộc schema lớp học cũ hoặc Supabase Auth. Không xóa dữ liệu game khác.

Tạo một mã người dẫn ngẫu nhiên dài bằng trình quản lý mật khẩu và đặt hash trong SQL Editor, chỉ chạy bằng quyền chủ database:

```sql
update vnr202_private.game
set host_key_hash=encode(sha256(convert_to('THAY_BANG_MA_NGAU_NHIEN_RIENG','UTF8')),'hex'),
    host_token_hash=null, host_last_seen=null;
```

Mã host chỉ gửi qua HTTPS khi vào màn hình người dẫn, không nằm trong bundle hoặc repo. Phiên thiết bị được lưu ở sessionStorage, database chỉ giữ hash token. Nếu thiết bị mất mạng, vị trí hàng vẫn được giữ; thiết bị khác có thể tiếp quản nhóm sau 30 giây không có heartbeat.

Game lấy thứ tự theo transaction được database xử lý trước, không theo thời gian điện thoại. Realtime đẩy thông báo đổi trạng thái; mỗi máy còn đồng bộ lại mỗi 5 giây và khi trở lại tab để phục hồi sau mất kết nối. Nếu mất kết nối, nút điều khiển bị khóa tới khi đồng bộ lại. Không có đồng hồ giới hạn câu hỏi.

## Deploy Vercel

Bản hiện tại deploy bằng CLI từ thư mục `CH_Lab` lên project `vnr202-buzzer`. Deploy lại từ thư mục này: `npx vercel deploy --prod --scope nguyen-anh-tuans-projects-c481c4e7`. URL và publishable key đã được cấu hình cho Production; mã host nằm trong file local `HOST_ACCESS.local.txt` (không commit, không upload).

Nếu chuyển sang tự deploy từ GitHub: kết nối repo, chọn **Root Directory: CH_Lab**, framework **Vite**. Với project mới, thêm hai biến môi trường trong `.env.example` cho Production. Build: `npm run build`, output: `dist`. Không cần chạy máy chủ trên laptop.

Máy chiếu mở link `/?host=1`, các đội mở link chính bằng Wi-Fi hoặc 4G. Tải lại trang giữ điểm, câu hiện tại và hàng chờ.

## Kiểm tra

```sh
npm test
npm run build
```

Test chạy migration thật trong PostgreSQL WASM (PGlite), gồm hàng chờ, nhóm hợp lệ, phân quyền, cộng điểm và lệnh gửi trùng/cũ. Project này chỉ phục vụ một trận tại một thời điểm. Độ trễ mạng có thể ảnh hưởng thứ tự lượt bấm được ghi nhận.

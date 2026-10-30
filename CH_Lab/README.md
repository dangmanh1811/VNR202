# Rung chuông vàng · Di cư 1954

**Mini game VNR202**

*Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ năm 1954*

Người chơi mở link là chọn nhóm. Máy chiếu dùng link host để hiện câu hỏi; điện thoại chỉ còn nút **Rung chuông**.

**Công nghệ:** Vite · WebSocket LAN

## Host cho cả lớp

```bash
conda activate fpt_env
cd CH_Lab
./host.sh
```

Script in **link host** và **link người chơi** (LAN + công khai). Tắt bằng `Ctrl+C`.

- Host: `http://IP:5173/?host=1`
- Người chơi: `http://IP:5173/`
- Vào thẳng nhóm 3: `http://IP:5173/?nhom=3`

## Luật chơi

- Màn hình lớn hiện câu hỏi, 4 đáp án, đồng hồ 1 phút và 5 chỗ nhóm. Có đội bấm chuông thì đồng hồ tạm dừng. Loa máy chiếu phát nhạc nền nhẹ và tiếng tick đếm ngược (5 giây cuối gấp hơn). Bấm **Tắt tiếng** hoặc phím `M` nếu cần.
- Ai bấm chuông trước được trả lời. Giảng viên chấm **Đúng** (+10, câu 5/10/15 là +20) hoặc **Sai** (mở chuông cho nhóm còn lại, giữ thời gian còn lại của câu).
- Đội nhiều điểm hơn thì chuông mở chậm hơn một chút (0,5 giây mỗi 10 điểm dẫn, tối đa 2 giây).
- Đề gồm **15 câu** lấy từ bộ mini game *Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ năm 1954*.

```bash
npm run test:lan
```

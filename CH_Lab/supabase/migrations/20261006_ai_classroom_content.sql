-- Replace the classroom exam with the AI literacy and responsible-use topic set.
-- Run after 20261006_avatar_profiles.sql on an existing installation.

update public.hcm_exam
set phase = 'idle', started_at = null, ends_at = null
where id = 1;

delete from public.hcm_exam_participants
where round = (select round from public.hcm_exam where id = 1);

insert into public.hcm_exam_questions(position, id, source, question, options, answer) values
(0, 'ai-role', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Mô tả nào đúng nhất về hệ thống AI hiện nay?',
 jsonb_build_array('Luôn suy nghĩ và hiểu như con người', 'Tìm quy luật từ dữ liệu để tạo dự đoán hoặc nội dung', 'Luôn biết sự kiện mới nhất', 'Không bao giờ mắc lỗi'), 1),
(1, 'ai-data-quality', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Yếu tố nào giúp giảm nguy cơ mô hình đưa ra kết quả sai lệch?',
 jsonb_build_array('Dùng càng ít dữ liệu càng tốt', 'Chỉ dùng dữ liệu từ một nhóm', 'Dữ liệu phù hợp, có chất lượng và đại diện cho bối cảnh sử dụng', 'Bỏ qua bước thử nghiệm'), 2),
(2, 'ai-verify', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Khi AI tạo sinh nêu một dữ kiện quan trọng, bạn nên làm gì trước khi sử dụng?',
 jsonb_build_array('Tin ngay vì câu trả lời trôi chảy', 'Đối chiếu với nguồn chính thức hoặc nguồn đáng tin cậy', 'Chỉ kiểm tra chính tả', 'Xóa tên công cụ AI'), 1),
(3, 'ai-privacy', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Cách dùng AI nào bảo vệ dữ liệu cá nhân tốt nhất?',
 jsonb_build_array('Không nhập dữ liệu nhạy cảm; chỉ dùng thông tin cần thiết và được phép', 'Dán toàn bộ hồ sơ để AI hiểu rõ hơn', 'Chia sẻ mật khẩu cho nhóm', 'Đăng công khai nội dung đầu vào'), 0),
(4, 'ai-bias', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Dấu hiệu nào cho thấy cần kiểm tra thiên lệch của hệ thống AI?',
 jsonb_build_array('Giao diện có màu tối', 'Kết quả bất lợi lặp lại với một nhóm người dùng', 'Mô hình trả lời nhanh', 'Ứng dụng có nhiều nút'), 1),
(5, 'ai-transparency', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Minh bạch trong một hệ thống AI hỗ trợ quyết định quan trọng có nghĩa là gì?',
 jsonb_build_array('Giấu toàn bộ giới hạn của mô hình', 'Chỉ công bố tên sản phẩm', 'Cho biết AI được dùng ở đâu, giới hạn và căn cứ chính của kết quả', 'Luôn hiển thị mã nguồn đầy đủ cho mọi người'), 2),
(6, 'ai-rmf', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Bộ nào gồm bốn chức năng của Khung quản trị rủi ro AI NIST?',
 jsonb_build_array('Plan, Build, Sell, Repeat', 'Govern, Map, Measure, Manage', 'Read, Write, Test, Delete', 'Ask, Answer, Copy, Share'), 1),
(7, 'ai-human-oversight', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Trong lớp học, cơ chế giám sát của con người nên được thực hiện thế nào?',
 jsonb_build_array('Để AI tự quyết định điểm cuối cùng trong mọi trường hợp', 'Giảng viên và sinh viên kiểm tra đầu ra, nêu giới hạn và chịu trách nhiệm sử dụng', 'Không cần giải thích khi dùng AI', 'Chỉ kiểm tra khi hệ thống ngừng hoạt động'), 1),
(8, 'ai-health', 'AI Lab · Kiến thức AI có trách nhiệm',
 'Nguyên tắc phù hợp khi dùng AI trong y tế là gì?',
 jsonb_build_array('Bảo vệ quyền tự chủ, an toàn và riêng tư của người bệnh', 'Thay thế mọi quyết định chuyên môn bằng AI', 'Dùng dữ liệu sức khỏe cho mọi mục đích', 'Không cần đánh giá tác động giữa các nhóm'), 0),
(9, 'ai-space', 'AI Lab · Kiến thức AI có trách nhiệm',
 'AI hỗ trợ các nhiệm vụ không gian của NASA theo cách nào?',
 jsonb_build_array('Làm tín hiệu truyền nhanh hơn ánh sáng', 'Đảm bảo không bao giờ có lỗi', 'Loại bỏ vai trò của nhà khoa học', 'Phân tích dữ liệu lớn và hỗ trợ phương tiện tự hành'), 3)
on conflict (position) do update set
  id = excluded.id,
  source = excluded.source,
  question = excluded.question,
  options = excluded.options,
  answer = excluded.answer;

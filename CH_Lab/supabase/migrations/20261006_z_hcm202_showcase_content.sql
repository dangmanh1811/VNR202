-- Restore the exam for the presentation topic: culture and people in Ho Chi Minh thought.
-- Run after 20261006_ai_classroom_content.sql on installations that already applied it.

update public.hcm_exam
set phase = 'idle', started_at = null, ends_at = null
where id = 1;

delete from public.hcm_exam_participants
where round = (select round from public.hcm_exam where id = 1);

insert into public.hcm_exam_questions(position, id, source, question, options, answer) values
(0, 'culture-origin', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Hồ Chí Minh cho rằng: “Vì ... loài người mới sáng tạo và phát minh ra ngôn ngữ, chữ viết, đạo đức, pháp luật, khoa học, tôn giáo, văn học, nghệ thuật, những công cụ cho sinh hoạt hằng ngày về mặc, ăn, ở và các phương thức sử dụng.” Chọn phương án đúng điền vào chỗ trống.',
 jsonb_build_array('Lẽ sinh tồn cũng như mục đích của cuộc sống', 'Nhu cầu đời sống và tinh thần', 'Mục đích phát triển và sinh tồn', 'Cuộc sống'), 0),
(1, 'five-culture-points', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Nội dung nào đúng về năm điểm lớn định hướng cho việc xây dựng nền văn hóa dân tộc theo tư tưởng Hồ Chí Minh?',
 jsonb_build_array('Xây dựng luân lý, tâm lý, xã hội, chính trị, kinh tế', 'Xây dựng luân lý, tâm lý, xã hội, chính trị, luật pháp', 'Xây dựng luân lý, tâm lý, xã hội, chính trị, khoa học'), 0),
(2, 'culture-economy-politics', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo Hồ Chí Minh, mối quan hệ giữa văn hóa với kinh tế và chính trị như thế nào?',
 jsonb_build_array('Văn hóa đứng ngoài kinh tế', 'Văn hóa đứng ngoài chính trị', 'Văn hóa không thể đứng ngoài mà phải ở trong kinh tế và chính trị', 'Văn hóa đứng ngoài kinh tế và chính trị'), 2),
(3, 'culture-goal-motivation', 'Bộ câu hỏi HCM202 · Văn hóa và con người', 'Hồ Chí Minh cho rằng:',
 jsonb_build_array('Văn hóa vừa là mục tiêu, vừa là động lực của cách mạng', 'Văn hóa vừa là cơ sở, vừa là động lực của cách mạng', 'Văn hóa vừa là mục tiêu, vừa là nhân tố quyết định của cách mạng'), 0),
(4, 'culture-characteristics', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Trong các luận điểm sau đây về văn hóa, luận điểm nào Hồ Chí Minh nói về tính chất của nền văn hóa?',
 jsonb_build_array('Phải nâng cao trình độ văn hóa của nhân dân', 'Phải xây dựng một nền văn hóa dân tộc, khoa học và đại chúng', 'Văn hóa cũng là một mặt trận', 'Xây dựng chính trị dân quyền'), 1),
(5, 'culture-functions', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo tư tưởng Hồ Chí Minh, văn hóa có mấy chức năng chủ yếu?',
 jsonb_build_array('Hai', 'Ba', 'Bốn', 'Năm'), 1),
(6, 'human-concept', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Nhận định nào sau đây đúng với khái niệm con người trong tư tưởng Hồ Chí Minh?',
 jsonb_build_array('Dùng để chỉ con người chung chung', 'Dùng để chỉ một cộng đồng người', 'Dùng để chỉ con người cụ thể gắn với hoàn cảnh lịch sử cụ thể', 'Dùng để chỉ con người trừu tượng'), 2),
(7, 'socialist-human', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo Hồ Chí Minh, “Muốn xây dựng chủ nghĩa xã hội, trước hết cần có...”',
 jsonb_build_array('Con người xã hội chủ nghĩa', 'Khoa học xã hội tiên tiến', 'Công nông nghiệp hiện đại', 'Nền kinh tế phát triển'), 0),
(8, 'planting-people', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo Hồ Chí Minh, để thực hiện chiến lược “trồng người”, cần có nhiều biện pháp, nhưng biện pháp quan trọng bậc nhất là:',
 jsonb_build_array('Giáo dục – đào tạo', 'Thuyết phục – nêu gương', 'Cảm hóa – động viên', 'Ép buộc – cưỡng chế'), 0),
(9, 'new-socialist-human', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo tư tưởng Hồ Chí Minh, con người mới xã hội chủ nghĩa là con người:',
 jsonb_build_array('Kế thừa những giá trị tốt đẹp của con người truyền thống', 'Phá bỏ những truyền thống cũ', 'Hình thành những phẩm chất mới xã hội chủ nghĩa', 'Kế thừa những giá trị tốt đẹp của con người truyền thống, hình thành những phẩm chất mới xã hội chủ nghĩa'), 3)
on conflict (position) do update set
  id = excluded.id,
  source = excluded.source,
  question = excluded.question,
  options = excluded.options,
  answer = excluded.answer;

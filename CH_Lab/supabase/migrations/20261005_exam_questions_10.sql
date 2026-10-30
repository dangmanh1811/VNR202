-- Replace the current exam with the 10 HCM202 questions supplied for the class.
-- Run after 20261001_online_classroom.sql. Safe to run more than once.

select hcm_private.hcm_close_exam(true);

alter table public.hcm_exam_questions drop constraint if exists hcm_exam_questions_position_check;
alter table public.hcm_exam_questions drop constraint if exists hcm_exam_questions_options_check;
alter table public.hcm_exam_questions add constraint hcm_exam_questions_position_check check (position between 0 and 9);
alter table public.hcm_exam_questions add constraint hcm_exam_questions_options_check
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4);

alter table public.hcm_exam_submissions drop constraint if exists hcm_exam_submissions_correct_check;
alter table public.hcm_exam_submissions add constraint hcm_exam_submissions_correct_check check (correct between 0 and 10);

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
(5, 'culture-functions', 'Bộ câu hỏi HCM202 · Văn hóa và con người', 'Theo tư tưởng Hồ Chí Minh, văn hóa có mấy chức năng chủ yếu?',
 jsonb_build_array('Hai', 'Ba', 'Bốn', 'Năm'), 1),
(6, 'human-concept', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Nhận định nào sau đây đúng với khái niệm con người trong tư tưởng Hồ Chí Minh?',
 jsonb_build_array('Dùng để chỉ con người chung chung', 'Dùng để chỉ một cộng đồng người', 'Dùng để chỉ con người cụ thể gắn với hoàn cảnh lịch sử cụ thể', 'Dùng để chỉ con người trừu tượng'), 2),
(7, 'socialist-human', 'Bộ câu hỏi HCM202 · Văn hóa và con người', 'Theo Hồ Chí Minh, “Muốn xây dựng chủ nghĩa xã hội, trước hết cần có...”',
 jsonb_build_array('Con người xã hội chủ nghĩa', 'Khoa học xã hội tiên tiến', 'Công nông nghiệp hiện đại', 'Nền kinh tế phát triển'), 0),
(8, 'planting-people', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo Hồ Chí Minh, để thực hiện chiến lược “trồng người”, cần có nhiều biện pháp, nhưng biện pháp quan trọng bậc nhất là:',
 jsonb_build_array('Giáo dục – đào tạo', 'Thuyết phục – nêu gương', 'Cảm hóa – động viên', 'Ép buộc – cưỡng chế'), 0),
(9, 'new-socialist-human', 'Bộ câu hỏi HCM202 · Văn hóa và con người',
 'Theo tư tưởng Hồ Chí Minh, con người mới xã hội chủ nghĩa là con người:',
 jsonb_build_array('Kế thừa những giá trị tốt đẹp của con người truyền thống', 'Phá bỏ những truyền thống cũ', 'Hình thành những phẩm chất mới xã hội chủ nghĩa', 'Kế thừa những giá trị tốt đẹp của con người truyền thống, hình thành những phẩm chất mới xã hội chủ nghĩa'), 3)
on conflict (position) do update set id = excluded.id, source = excluded.source, question = excluded.question, options = excluded.options, answer = excluded.answer;

delete from public.hcm_exam_questions where position not between 0 and 9;

create or replace function hcm_private.hcm_state()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_member public.hcm_members%rowtype;
  v_exam public.hcm_exam%rowtype;
  v_players jsonb;
  v_rankings jsonb;
  v_questions jsonb := '[]'::jsonb;
  v_online integer;
  v_seated integer;
  v_rooms integer;
  v_room_occupancy integer;
  v_participant_count integer;
  v_submitted_count integer;
  v_eligible boolean;
  v_submitted boolean;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  perform hcm_private.hcm_close_exam(false);
  select * into v_member from public.hcm_members where user_id = auth.uid() and last_seen > clock_timestamp() - interval '60 seconds';
  if not found then raise exception 'Phiên lớp đã hết hạn. Vui lòng vào lại.'; end if;
  select * into v_exam from public.hcm_exam where id = 1;
  select count(*), count(*) filter (where role = 'student' and seat_id is not null), count(distinct room_no), count(*) filter (where room_no = v_member.room_no)
    into v_online, v_seated, v_rooms, v_room_occupancy
  from public.hcm_members where last_seen > clock_timestamp() - interval '60 seconds';
  select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id::text, 'name', m.name, 'role', m.role, 'x', m.x, 'z', m.z, 'rotation', m.rotation, 'seatId', m.seat_id) order by m.user_id), '[]'::jsonb)
    into v_players from public.hcm_members m
    where m.room_no = v_member.room_no and m.last_seen > clock_timestamp() - interval '60 seconds';
  select count(*) into v_participant_count from public.hcm_exam_participants where round = v_exam.round;
  select count(*) into v_submitted_count from public.hcm_exam_submissions where round = v_exam.round;
  select exists(select 1 from public.hcm_exam_participants where round = v_exam.round and user_id = auth.uid()) into v_eligible;
  select exists(select 1 from public.hcm_exam_submissions where round = v_exam.round and user_id = auth.uid()) into v_submitted;
  select coalesce(jsonb_agg(jsonb_build_object('rank', r.place, 'id', r.user_id::text, 'name', r.name, 'correct', r.correct,
      'points', r.correct * 10, 'durationMs', r.duration_ms, 'submittedAt', floor(extract(epoch from r.submitted_at) * 1000)::bigint,
      'automatic', r.automatic) order by r.place), '[]'::jsonb)
    into v_rankings
  from (
    select row_number() over(order by s.correct desc, s.duration_ms, s.submitted_at, s.user_id) as place,
      s.user_id, p.name, s.correct, s.duration_ms, s.submitted_at, s.automatic
    from public.hcm_exam_submissions s join public.hcm_exam_participants p using (round, user_id)
    where s.round = v_exam.round
  ) r;
  if v_exam.phase = 'active' and v_eligible and not v_submitted then
    select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'source', q.source, 'question', q.question, 'options', q.options) order by q.position), '[]'::jsonb)
      into v_questions from public.hcm_exam_questions q;
  end if;
  return jsonb_build_object(
    'serverNow', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'me', jsonb_build_object('id', v_member.user_id::text, 'name', v_member.name, 'role', v_member.role, 'roomNo', v_member.room_no, 'seatId', v_member.seat_id, 'eligible', v_eligible, 'submitted', v_submitted),
    'players', v_players,
    'counts', jsonb_build_object('online', v_online, 'seated', v_seated, 'rooms', v_rooms, 'roomOccupancy', v_room_occupancy, 'roomCapacity', 10),
    'exam', jsonb_build_object('phase', v_exam.phase, 'round', v_exam.round,
      'startedAt', case when v_exam.started_at is null then null else floor(extract(epoch from v_exam.started_at) * 1000)::bigint end,
      'endsAt', case when v_exam.ends_at is null then null else floor(extract(epoch from v_exam.ends_at) * 1000)::bigint end,
      'participantCount', v_participant_count, 'submittedCount', v_submitted_count, 'rankings', v_rankings),
    'questions', v_questions
  );
end;
$$;

create or replace function hcm_private.hcm_submit_exam(p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exam public.hcm_exam%rowtype; v_index integer; v_correct integer; v_duration integer; v_question_count integer;
begin
  select * into v_exam from public.hcm_exam where id = 1 for update;
  if v_exam.phase <> 'active' then raise exception 'Bài kiểm tra đã kết thúc.'; end if;
  if clock_timestamp() >= v_exam.ends_at then
    perform hcm_private.hcm_close_exam(false);
    return hcm_private.hcm_state();
  end if;
  if not exists(select 1 from public.hcm_exam_participants where round = v_exam.round and user_id = auth.uid()) then
    raise exception 'Bạn không thuộc lượt kiểm tra này.';
  end if;
  if exists(select 1 from public.hcm_exam_submissions where round = v_exam.round and user_id = auth.uid()) then
    return hcm_private.hcm_state();
  end if;
  select count(*) into v_question_count from public.hcm_exam_questions;
  if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_array_length(p_answers) <> v_question_count then
    raise exception 'Bài làm phải có đúng % đáp án.', v_question_count;
  end if;
  for v_index in 0..v_question_count - 1 loop
    if jsonb_typeof(p_answers->v_index) <> 'number' or (p_answers->>v_index) !~ '^[0-3]$' then
      raise exception 'Đáp án không hợp lệ.';
    end if;
  end loop;
  select count(*) into v_correct from public.hcm_exam_questions where answer = (p_answers->>position)::integer;
  v_duration := greatest(0, least(900000, floor(extract(epoch from (clock_timestamp() - v_exam.started_at)) * 1000)::integer));
  insert into public.hcm_exam_submissions(round, user_id, correct, duration_ms, submitted_at, automatic)
    values (v_exam.round, auth.uid(), v_correct, v_duration, clock_timestamp(), false);
  if (select count(*) from public.hcm_exam_submissions where round = v_exam.round) =
     (select count(*) from public.hcm_exam_participants where round = v_exam.round) then
    perform hcm_private.hcm_close_exam(true);
  end if;
  return hcm_private.hcm_state();
end;
$$;

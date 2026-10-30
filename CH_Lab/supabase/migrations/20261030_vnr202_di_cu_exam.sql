-- VNR202 mini-game: 15 questions on the 1954 North-South migration.
-- Run after 20261006_zz_spawn_seat_recovery.sql. Safe to run more than once.

select hcm_private.hcm_close_exam(true);

alter table public.hcm_exam_questions drop constraint if exists hcm_exam_questions_position_check;
alter table public.hcm_exam_questions drop constraint if exists hcm_exam_questions_options_check;
alter table public.hcm_exam_questions add constraint hcm_exam_questions_position_check check (position between 0 and 14);
alter table public.hcm_exam_questions add constraint hcm_exam_questions_options_check
  check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4);

alter table public.hcm_exam_submissions drop constraint if exists hcm_exam_submissions_correct_check;
alter table public.hcm_exam_submissions add constraint hcm_exam_submissions_correct_check check (correct between 0 and 15);

insert into public.hcm_exam_questions(position, id, source, question, options, answer) values
(0, 'geneva-context', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Hiệp định nào tạo bối cảnh cho cuộc di cư Bắc – Nam năm 1954?',
 jsonb_build_array('Hiệp định Paris', 'Hiệp định Giơnevơ', 'Hiệp định Sơ bộ', 'Hiệp định Élysée'), 1),
(1, 'migration-direction', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Cuộc di cư được đề cập trong bài chủ yếu diễn ra theo hướng nào?',
 jsonb_build_array('Miền Nam ra miền Bắc', 'Việt Nam sang Pháp', 'Miền Bắc sang Trung Quốc', 'Miền Bắc vào miền Nam'), 3),
(2, 'article-14d', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Điều khoản nào của Hiệp định đình chỉ chiến sự cho phép thường dân chuyển vùng cư trú?',
 jsonb_build_array('Điều 14(d)', 'Điều 1', 'Điều 20', 'Điều 35'), 0),
(3, '300-days', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Thời hạn chuyển quân được Hiệp định Giơnevơ quy định tối đa bao nhiêu ngày?',
 jsonb_build_array('90 ngày', '180 ngày', '300 ngày', '365 ngày'), 2),
(4, 'diem-political-goal', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Một mục tiêu chính trị của việc thúc đẩy di cư vào Nam là gì?',
 jsonb_build_array('Phát triển du lịch', 'Củng cố cơ sở ủng hộ chính quyền Ngô Đình Diệm', 'Xóa bỏ toàn bộ tôn giáo', 'Đưa dân cư sang Mỹ'), 1),
(5, 'catholic-anticommunist', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Nhóm dân cư nào được chính quyền Diệm đặc biệt quan tâm thu hút vào Nam?',
 jsonb_build_array('Người nước ngoài', 'Chỉ quân nhân Pháp', 'Chỉ công nhân công nghiệp', 'Người Công giáo và các thành phần chống cộng'), 3),
(6, 'passage-to-freedom', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Chiến dịch vận chuyển người di cư do Hải quân Mỹ thực hiện có tên gì?',
 jsonb_build_array('Rolling Thunder', 'Linebacker', 'Passage to Freedom', 'Market Time'), 2),
(7, 'ships-planes', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Phương tiện chủ yếu được sử dụng để đưa người di cư vào Nam là gì?',
 jsonb_build_array('Tàu biển và máy bay', 'Xe đạp và xe máy', 'Tàu điện ngầm', 'Chỉ đi bộ'), 0),
(8, 'propaganda', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Nội dung nào được sử dụng trong tuyên truyền vận động người dân di cư?',
 jsonb_build_array('Khuyến khích du lịch quốc tế', 'Tuyên truyền về thể thao', 'Giới thiệu chương trình du học', 'Khơi gợi lo ngại về tôn giáo, tài sản và an toàn'), 3),
(9, 'land-promise', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Lời hứa nào được sử dụng để thu hút người dân vào Nam?',
 jsonb_build_array('Miễn toàn bộ nghĩa vụ công dân', 'Hỗ trợ đất đai và điều kiện định cư', 'Đưa tất cả người dân ra nước ngoài', 'Phát vàng cho mọi gia đình'), 1),
(10, 'mixed-motives', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Nhận định nào đúng nhất về nguyên nhân người dân di cư năm 1954–1955?',
 jsonb_build_array('Tất cả bị ép buộc', 'Tất cả chỉ vì kinh tế', 'Có nhiều động cơ đan xen như tôn giáo, gia đình, chính trị và sinh kế', 'Tất cả đều là quân nhân'), 2),
(11, 'nearly-one-million', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Quy mô người di cư từ Bắc vào Nam năm 1954–1955 thường được khái quát khoảng bao nhiêu?',
 jsonb_build_array('Gần 1 triệu người', '10.000 người', '50.000 người', '5 triệu người'), 0),
(12, 'settlement-hardship', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Khó khăn lớn trong quá trình ổn định đời sống người di cư tại miền Nam là gì?',
 jsonb_build_array('Không có phương tiện truyền thông', 'Không có bất kỳ hoạt động cứu trợ nào', 'Không có người dân tham gia di cư', 'Thiếu đất canh tác, công cụ sản xuất và điều kiện định cư ổn định'), 3),
(13, 'heath-telegram', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Điện tín ngày 23/7/1954 ghi nhận đề nghị Mỹ hỗ trợ di cư của Ngô Đình Diệm do ai gửi?',
 jsonb_build_array('Dwight Eisenhower', 'Donald Heath', 'Henry Kissinger', 'John F. Kennedy'), 1),
(14, 'distinguish-goals', 'Bộ 15 câu hỏi mini game · Chính sách di cư Bắc – Nam sau Hiệp định Giơnevơ 1954',
 'Khi đánh giá chính sách di cư năm 1954, cần phân biệt điều gì?',
 jsonb_build_array('Di cư đường biển và đường bộ', 'Người trẻ và người già', 'Mục tiêu chính trị của chính quyền với động cơ cá nhân của người di cư', 'Miền núi và đồng bằng'), 2)
on conflict (position) do update set
  id = excluded.id,
  source = excluded.source,
  question = excluded.question,
  options = excluded.options,
  answer = excluded.answer;

delete from public.hcm_exam_questions where position not between 0 and 14;

create or replace function hcm_private.hcm_join_room(p_name text, p_room integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text := left(btrim(p_name), 32); v_role text; v_room integer; v_existing public.hcm_members%rowtype;
begin
  if v_uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if v_name is null or length(v_name) = 0 then raise exception 'Hãy nhập tên trước khi vào lớp.'; end if;
  if p_room is not null and p_room not between 1 and 9999 then raise exception 'Số phòng phải từ 1 đến 9999.'; end if;
  perform pg_advisory_xact_lock(2026001);
  delete from public.hcm_members where last_seen < clock_timestamp() - interval '60 seconds';
  v_role := case when v_name = 'GIANGVIENVNR202' then 'teacher' else 'student' end;
  if v_role = 'teacher' and exists(select 1 from public.hcm_members where role = 'teacher' and user_id <> v_uid) then
    raise exception 'Giảng viên đã đăng nhập trên thiết bị khác.';
  end if;
  select * into v_existing from public.hcm_members where user_id = v_uid;
  if p_room is not null then
    v_room := p_room;
    if (select count(*) from public.hcm_members where room_no = v_room and user_id <> v_uid) >= 10 then
      raise exception 'Phòng % đã đủ 10 người.', v_room;
    end if;
  elsif found then
    v_room := v_existing.room_no;
  else
    v_room := 1;
    while (select count(*) from public.hcm_members where room_no = v_room) >= 10 loop
      v_room := v_room + 1;
      if v_room > 9999 then raise exception 'Lớp đã đạt giới hạn phòng.'; end if;
    end loop;
  end if;
  insert into public.hcm_members(user_id, name, role, room_no, seat_id, x, z, rotation, last_seen)
    values (v_uid, case when v_role = 'teacher' then 'Giảng viên' else v_name end, v_role, v_room, null, 5.4, 3.7, pi(), clock_timestamp())
  on conflict (user_id) do update set
    name = excluded.name,
    role = excluded.role,
    room_no = excluded.room_no,
    seat_id = null,
    x = excluded.x,
    z = excluded.z,
    rotation = excluded.rotation,
    last_seen = clock_timestamp();
  return hcm_private.hcm_state();
end;
$$;

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
  v_question_count integer;
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  perform hcm_private.hcm_close_exam(false);
  select * into v_member from public.hcm_members where user_id = auth.uid() and last_seen > clock_timestamp() - interval '60 seconds';
  if not found then raise exception 'Phiên lớp đã hết hạn. Vui lòng vào lại.'; end if;
  select * into v_exam from public.hcm_exam where id = 1;
  select count(*) into v_question_count from public.hcm_exam_questions;
  select count(*), count(*) filter (where role = 'student' and seat_id is not null), count(distinct room_no), count(*) filter (where room_no = v_member.room_no)
    into v_online, v_seated, v_rooms, v_room_occupancy
  from public.hcm_members where last_seen > clock_timestamp() - interval '60 seconds';
  select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id::text, 'name', m.name, 'role', m.role,
      'gender', m.gender, 'avatar', m.avatar, 'x', m.x, 'z', m.z, 'rotation', m.rotation, 'seatId', m.seat_id) order by m.user_id), '[]'::jsonb)
    into v_players from public.hcm_members m
    where m.room_no = v_member.room_no and m.last_seen > clock_timestamp() - interval '60 seconds';
  select count(*) into v_participant_count from public.hcm_exam_participants where round = v_exam.round;
  select count(*) into v_submitted_count from public.hcm_exam_submissions where round = v_exam.round;
  select exists(select 1 from public.hcm_exam_participants where round = v_exam.round and user_id = auth.uid()) into v_eligible;
  select exists(select 1 from public.hcm_exam_submissions where round = v_exam.round and user_id = auth.uid()) into v_submitted;
  select coalesce(jsonb_agg(jsonb_build_object('rank', r.place, 'id', r.user_id::text, 'name', r.name, 'correct', r.correct,
      'points', round(r.correct * 100.0 / greatest(v_question_count, 1))::integer, 'durationMs', r.duration_ms, 'submittedAt', floor(extract(epoch from r.submitted_at) * 1000)::bigint,
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
    'me', jsonb_build_object('id', v_member.user_id::text, 'name', v_member.name, 'role', v_member.role,
      'gender', v_member.gender, 'avatar', v_member.avatar, 'roomNo', v_member.room_no, 'seatId', v_member.seat_id,
      'eligible', v_eligible, 'submitted', v_submitted),
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

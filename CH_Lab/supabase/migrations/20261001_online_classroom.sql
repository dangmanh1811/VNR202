-- Run once in the Supabase SQL Editor. Enable Anonymous Sign-Ins in Auth settings.
-- The browser uses only the publishable key. Room assignment, exam time and scoring
-- are performed by database functions under the caller's authenticated user ID.

create schema if not exists hcm_private;

create table if not exists public.hcm_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 32),
  role text not null check (role in ('student', 'teacher')),
  gender text not null default 'male',
  avatar text not null default 'male-classic',
  room_no integer not null check (room_no between 1 and 9999),
  seat_id integer check (seat_id between 0 and 9),
  x double precision not null default 5.4,
  z double precision not null default 3.7,
  rotation double precision not null default 3.141592653589793,
  last_seen timestamptz not null default clock_timestamp()
);
alter table public.hcm_members drop constraint if exists hcm_members_gender_check;
alter table public.hcm_members add constraint hcm_members_gender_check check (gender in ('male', 'female', 'other'));
alter table public.hcm_members drop constraint if exists hcm_members_avatar_check;
alter table public.hcm_members add constraint hcm_members_avatar_check check (avatar in (
  'male-classic', 'agnes-tachyon', 'chikawa', 'megumin', 'miku', 'professor-layton', 'female-suzuka', 'super-creek'
));
create unique index if not exists hcm_room_seat_unique on public.hcm_members(room_no, seat_id) where seat_id is not null;
create index if not exists hcm_members_active_room on public.hcm_members(room_no, last_seen desc);

create table if not exists public.hcm_exam (
  id integer primary key check (id = 1),
  round integer not null default 0,
  phase text not null default 'idle' check (phase in ('idle', 'active', 'finished')),
  started_at timestamptz,
  ends_at timestamptz
);
insert into public.hcm_exam(id) values (1) on conflict (id) do nothing;

create table if not exists public.hcm_exam_questions (
  position integer primary key check (position between 0 and 9),
  id text not null unique,
  source text not null,
  question text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  answer integer not null check (answer between 0 and 3)
);

insert into public.hcm_exam_questions(position, id, source, question, options, answer) values
(0, 'source', 'Slide 3, 10',
 'Một bạn dùng AI tóm tắt tài liệu rồi đăng bài với tên mình nhưng không kiểm tra nguồn. Cách sửa nào phù hợp nhất với “học có nguồn” và văn hóa số?',
 '[]'::jsonb || jsonb_build_array('Chỉ thêm dòng “có dùng AI”, giữ mọi thông tin như cũ.', 'Kiểm tra tác giả, trang và bối cảnh của từng luận điểm; sửa phần sai và ghi rõ AI đã hỗ trợ ở đâu.', 'Xóa mọi tài liệu gốc để bài viết ngắn hơn.', 'Đăng ngay vì AI thường tổng hợp nhanh hơn người đọc.'), 1),
(1, 'identity', 'Slide 4, 6',
 'Lớp thiết kế triển lãm giao lưu quốc tế. Phương án nào vừa giữ bản sắc vừa tiếp thu tinh hoa, đồng thời thể hiện tính khoa học?',
 jsonb_build_array('Sao chép trọn bộ triển lãm nước ngoài để tiết kiệm thời gian.', 'Chỉ dùng biểu tượng quen thuộc, không cần giải thích nguồn gốc.', 'Chọn chất liệu văn hóa Việt có nguồn xác thực, tiếp nhận cách trình bày tốt từ bên ngoài và giải thích lý do lựa chọn.', 'Bỏ nội dung Việt Nam vì người xem quốc tế có thể chưa biết.'), 2),
(2, 'roles', 'Slide 5, 6',
 'Một chiến dịch đọc sách chỉ trưng bày áp phích đẹp nhưng người học khó tiếp cận sách. Cách cải tiến nào vận dụng đồng thời vai trò “phục vụ nhân dân” và tính đại chúng?',
 jsonb_build_array('Khảo sát nhu cầu, mở điểm mượn sách dễ tiếp cận và để người học góp ý sau khi sử dụng.', 'Tăng số áp phích để mọi người nhìn thấy nhiều hơn.', 'Chỉ mời người đã đọc nhiều sách tham gia.', 'Dùng khẩu hiệu dài hơn để truyền đạt đủ lý thuyết.'), 0),
(3, 'whole', 'Slide 7–9',
 'Một sinh viên đạt điểm chuyên môn cao nhưng thường xuyên sao chép bài nhóm và kiệt sức. Kế hoạch nào gần nhất với phát triển con người toàn diện và “hồng” đi cùng “chuyên”?',
 jsonb_build_array('Tăng giờ học chuyên môn và bỏ mọi hoạt động khác.', 'Chỉ yêu cầu xin lỗi, không cần thay đổi cách làm việc.', 'Giữ thành tích hiện tại vì kết quả là tiêu chí duy nhất.', 'Rèn năng lực chuyên môn, cam kết làm việc trung thực và xây dựng nhịp học nghỉ hợp lý.'), 3),
(4, 'community', 'Slide 8, 10',
 'Nhóm phát hiện một thông tin sai đang lan trong cộng đồng lớp. Hành động nào thể hiện con người vừa là chủ thể tạo văn hóa vừa chịu trách nhiệm với cộng đồng?',
 jsonb_build_array('Chia sẻ tiếp để nhiều người tự đánh giá.', 'Im lặng vì việc kiểm chứng chỉ thuộc người quản trị.', 'Kiểm chứng bằng nguồn tin cậy, đính chính tôn trọng người khác và rút kinh nghiệm cho lần đăng sau.', 'Công kích người đăng để mọi người chú ý đến vấn đề.'), 2)
on conflict (position) do update set id = excluded.id, source = excluded.source, question = excluded.question, options = excluded.options, answer = excluded.answer;

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

create table if not exists public.hcm_exam_participants (
  round integer not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  room_no integer not null,
  primary key (round, user_id)
);
create table if not exists public.hcm_exam_submissions (
  round integer not null,
  user_id uuid not null,
  correct integer not null check (correct between 0 and 10),
  duration_ms integer not null check (duration_ms >= 0),
  submitted_at timestamptz not null default clock_timestamp(),
  automatic boolean not null default false,
  primary key (round, user_id),
  foreign key (round, user_id) references public.hcm_exam_participants(round, user_id) on delete cascade
);
create index if not exists hcm_exam_submissions_rank on public.hcm_exam_submissions(round, correct desc, duration_ms, submitted_at);

alter table public.hcm_members enable row level security;
alter table public.hcm_exam enable row level security;
alter table public.hcm_exam_questions enable row level security;
alter table public.hcm_exam_participants enable row level security;
alter table public.hcm_exam_submissions enable row level security;
revoke all on public.hcm_members, public.hcm_exam, public.hcm_exam_questions, public.hcm_exam_participants, public.hcm_exam_submissions from anon, authenticated;

create or replace function hcm_private.hcm_channel_access(p_topic text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_room integer;
begin
  if auth.uid() is null then return false; end if;
  if p_topic = 'hcm-global' then
    return exists (select 1 from public.hcm_members where user_id = auth.uid() and last_seen > clock_timestamp() - interval '60 seconds');
  end if;
  if p_topic !~ '^hcm-room-[1-9][0-9]{0,3}$' then return false; end if;
  v_room := substring(p_topic from 10)::integer;
  return exists (select 1 from public.hcm_members where user_id = auth.uid() and room_no = v_room and last_seen > clock_timestamp() - interval '60 seconds');
end;
$$;

create or replace function hcm_private.hcm_close_exam(p_force boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare v_exam public.hcm_exam%rowtype;
begin
  select * into v_exam from public.hcm_exam where id = 1 for update;
  if v_exam.phase <> 'active' or (not p_force and clock_timestamp() < v_exam.ends_at) then return; end if;
  insert into public.hcm_exam_submissions(round, user_id, correct, duration_ms, submitted_at, automatic)
  select v_exam.round, p.user_id, 0,
    greatest(0, floor(extract(epoch from (least(clock_timestamp(), v_exam.ends_at) - v_exam.started_at)) * 1000)::integer),
    clock_timestamp(), true
  from public.hcm_exam_participants p
  where p.round = v_exam.round
  on conflict (round, user_id) do nothing;
  update public.hcm_exam set phase = 'finished' where id = 1;
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
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  perform hcm_private.hcm_close_exam(false);
  select * into v_member from public.hcm_members where user_id = auth.uid() and last_seen > clock_timestamp() - interval '60 seconds';
  if not found then raise exception 'Phiên lớp đã hết hạn. Vui lòng vào lại.'; end if;
  select * into v_exam from public.hcm_exam where id = 1;
  select count(*), count(*) filter (where role = 'student' and seat_id is not null), count(distinct room_no), count(*) filter (where room_no = v_member.room_no)
    into v_online, v_seated, v_rooms, v_room_occupancy
  from public.hcm_members where last_seen > clock_timestamp() - interval '60 seconds';
  select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id::text, 'name', m.name, 'role', m.role, 'gender', m.gender, 'avatar', m.avatar, 'x', m.x, 'z', m.z, 'rotation', m.rotation, 'seatId', m.seat_id) order by m.user_id), '[]'::jsonb)
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
    'me', jsonb_build_object('id', v_member.user_id::text, 'name', v_member.name, 'role', v_member.role, 'gender', v_member.gender, 'avatar', v_member.avatar, 'roomNo', v_member.room_no, 'seatId', v_member.seat_id, 'eligible', v_eligible, 'submitted', v_submitted),
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

create or replace function hcm_private.hcm_join_room(p_name text, p_room integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text := left(btrim(p_name), 32); v_role text; v_room integer; v_existing public.hcm_members%rowtype;
begin
  if v_uid is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if v_name is null or length(v_name) = 0 then raise exception 'Hãy nhập tên trước khi vào lớp.'; end if;
  if p_room is not null and p_room not between 1 and 9999 then raise exception 'Số phòng phải từ 1 đến 9999.'; end if;
  perform pg_advisory_xact_lock(2026001);
  delete from public.hcm_members where last_seen < clock_timestamp() - interval '60 seconds';
  v_role := case when v_name = 'NHOM3HCM202AI1802' then 'teacher' else 'student' end;
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
  on conflict (user_id) do update set name = excluded.name, role = excluded.role,
    room_no = excluded.room_no,
    seat_id = null,
    x = excluded.x,
    z = excluded.z,
    rotation = excluded.rotation,
    last_seen = clock_timestamp();
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_join(p_name text)
returns jsonb language sql security definer set search_path = '' as $$
  select hcm_private.hcm_join_room(p_name, null);
$$;

create or replace function hcm_private.hcm_join_profile(p_name text, p_room integer, p_gender text, p_avatar text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_gender text := lower(coalesce(p_gender, '')); v_avatar text := lower(coalesce(p_avatar, ''));
begin
  if v_gender not in ('male', 'female', 'other') then raise exception 'Giới tính không hợp lệ.'; end if;
  if (v_gender, v_avatar) not in (
    ('male', 'male-classic'), ('female', 'agnes-tachyon'), ('other', 'chikawa'), ('female', 'megumin'),
    ('female', 'miku'), ('male', 'professor-layton'), ('female', 'female-suzuka'), ('female', 'super-creek')
  ) then
    raise exception 'Avatar không phù hợp.';
  end if;
  perform hcm_private.hcm_join_room(p_name, p_room);
  update public.hcm_members set gender = v_gender, avatar = v_avatar, last_seen = clock_timestamp() where user_id = auth.uid();
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_touch(p_x double precision, p_z double precision, p_rotation double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  update public.hcm_members set
    last_seen = clock_timestamp(),
    x = case when seat_id is null and p_x between -7.82 and 7.83 then p_x else x end,
    z = case when seat_id is null and p_z between -5.75 and 5.86 then p_z else z end,
    rotation = case when seat_id is null and p_rotation between -20 and 20 then p_rotation else rotation end
  where user_id = auth.uid();
end;
$$;

create or replace function hcm_private.hcm_sit(p_seat integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.hcm_members%rowtype; v_x double precision; v_z double precision;
begin
  if p_seat is null or p_seat not between 0 and 9 then raise exception 'Ghế không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(2026001);
  delete from public.hcm_members where last_seen < clock_timestamp() - interval '60 seconds';
  select * into v_member from public.hcm_members where user_id = auth.uid() for update;
  if not found or v_member.role <> 'student' then raise exception 'Ghế kiểm tra dành cho sinh viên.'; end if;
  v_x := (array[-5.65, -2.35, 1.05, -5.65, -2.35, 1.05, -5.65, -2.35, 1.05, 4.4]::double precision[])[p_seat + 1];
  v_z := (array[-0.85, -0.85, -0.85, 1.9, 1.9, 1.9, 4.65, 4.65, 4.65, 1.9]::double precision[])[p_seat + 1];
  if v_member.seat_id is distinct from p_seat and sqrt(power(v_member.x - v_x, 2) + power(v_member.z - v_z, 2)) > 1.8 then
    raise exception 'Hãy đi tới gần ghế trước khi ngồi.';
  end if;
  if exists(select 1 from public.hcm_members where room_no = v_member.room_no and seat_id = p_seat and user_id <> v_member.user_id) then
    raise exception 'Ghế này đã có người ngồi.';
  end if;
  update public.hcm_members set seat_id = p_seat, x = v_x, z = v_z, rotation = pi(), last_seen = clock_timestamp() where user_id = v_member.user_id;
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_stand()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.hcm_members%rowtype;
begin
  select * into v_member from public.hcm_members where user_id = auth.uid() for update;
  if not found then raise exception 'Bạn chưa vào lớp.'; end if;
  if v_member.seat_id is not null then
    update public.hcm_members set seat_id = null, z = least(5.75, z + 0.43), rotation = pi(), last_seen = clock_timestamp() where user_id = v_member.user_id;
  end if;
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_start_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exam public.hcm_exam%rowtype; v_start timestamptz;
begin
  if not exists(select 1 from public.hcm_members where user_id = auth.uid() and role = 'teacher' and last_seen > clock_timestamp() - interval '60 seconds') then
    raise exception 'Chỉ giảng viên mới mở được bài kiểm tra.';
  end if;
  perform pg_advisory_xact_lock(2026001);
  perform hcm_private.hcm_close_exam(false);
  select * into v_exam from public.hcm_exam where id = 1 for update;
  if v_exam.phase = 'active' then raise exception 'Bài kiểm tra đang diễn ra.'; end if;
  if not exists(select 1 from public.hcm_members where role = 'student' and seat_id is not null and last_seen > clock_timestamp() - interval '60 seconds') then
    raise exception 'Cần ít nhất một sinh viên đang ngồi để mở bài kiểm tra.';
  end if;
  v_start := clock_timestamp();
  update public.hcm_exam set round = round + 1, phase = 'active', started_at = v_start, ends_at = v_start + interval '15 minutes' where id = 1;
  insert into public.hcm_exam_participants(round, user_id, name, room_no)
    select v_exam.round + 1, user_id, name, room_no from public.hcm_members
    where role = 'student' and seat_id is not null and last_seen > v_start - interval '60 seconds';
  return hcm_private.hcm_state();
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

create or replace function hcm_private.hcm_finish_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.hcm_members where user_id = auth.uid() and role = 'teacher' and last_seen > clock_timestamp() - interval '60 seconds') then
    raise exception 'Chỉ giảng viên mới kết thúc bài kiểm tra.';
  end if;
  perform hcm_private.hcm_close_exam(true);
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_reset_exam()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_round integer;
begin
  if not exists(select 1 from public.hcm_members where user_id = auth.uid() and role = 'teacher' and last_seen > clock_timestamp() - interval '60 seconds') then
    raise exception 'Chỉ giảng viên mới reset được bảng xếp hạng.';
  end if;
  perform pg_advisory_xact_lock(2026001);
  select round into v_round from public.hcm_exam where id = 1 for update;
  delete from public.hcm_exam_participants where round = v_round;
  update public.hcm_exam set phase = 'idle', started_at = null, ends_at = null where id = 1;
  return hcm_private.hcm_state();
end;
$$;

create or replace function hcm_private.hcm_leave()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.hcm_members where user_id = auth.uid();
end;
$$;

create or replace function public.hcm_join(p_name text) returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_join(p_name); $$;
create or replace function public.hcm_join_room(p_name text, p_room integer) returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_join_room(p_name, p_room); $$;
create or replace function public.hcm_join_profile(p_name text, p_room integer, p_gender text, p_avatar text) returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_join_profile(p_name, p_room, p_gender, p_avatar); $$;
create or replace function public.hcm_state() returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_state(); $$;
create or replace function public.hcm_touch(p_x double precision, p_z double precision, p_rotation double precision) returns void language sql security invoker set search_path = '' as $$ select hcm_private.hcm_touch(p_x, p_z, p_rotation); $$;
create or replace function public.hcm_sit(p_seat integer) returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_sit(p_seat); $$;
create or replace function public.hcm_stand() returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_stand(); $$;
create or replace function public.hcm_start_exam() returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_start_exam(); $$;
create or replace function public.hcm_submit_exam(p_answers jsonb) returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_submit_exam(p_answers); $$;
create or replace function public.hcm_finish_exam() returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_finish_exam(); $$;
create or replace function public.hcm_reset_exam() returns jsonb language sql security invoker set search_path = '' as $$ select hcm_private.hcm_reset_exam(); $$;
create or replace function public.hcm_leave() returns void language sql security invoker set search_path = '' as $$ select hcm_private.hcm_leave(); $$;

revoke all on schema hcm_private from public;
grant usage on schema hcm_private to authenticated;
revoke all on all functions in schema hcm_private from public;
grant execute on function hcm_private.hcm_channel_access(text), hcm_private.hcm_join(text), hcm_private.hcm_join_room(text, integer), hcm_private.hcm_join_profile(text, integer, text, text), hcm_private.hcm_state(),
  hcm_private.hcm_touch(double precision, double precision, double precision), hcm_private.hcm_sit(integer),
  hcm_private.hcm_stand(), hcm_private.hcm_start_exam(), hcm_private.hcm_submit_exam(jsonb),
  hcm_private.hcm_finish_exam(), hcm_private.hcm_reset_exam(), hcm_private.hcm_leave() to authenticated;
revoke all on function public.hcm_join(text), public.hcm_join_room(text, integer), public.hcm_join_profile(text, integer, text, text), public.hcm_state(), public.hcm_touch(double precision, double precision, double precision),
  public.hcm_sit(integer), public.hcm_stand(), public.hcm_start_exam(), public.hcm_submit_exam(jsonb), public.hcm_finish_exam(), public.hcm_reset_exam(), public.hcm_leave() from public, anon;
grant execute on function public.hcm_join(text), public.hcm_join_room(text, integer), public.hcm_join_profile(text, integer, text, text), public.hcm_state(), public.hcm_touch(double precision, double precision, double precision),
  public.hcm_sit(integer), public.hcm_stand(), public.hcm_start_exam(), public.hcm_submit_exam(jsonb), public.hcm_finish_exam(), public.hcm_reset_exam(), public.hcm_leave() to authenticated;

drop policy if exists "hcm room receive" on realtime.messages;
drop policy if exists "hcm room publish" on realtime.messages;
create policy "hcm room receive" on realtime.messages for select to authenticated
  using (extension in ('presence', 'broadcast') and hcm_private.hcm_channel_access(realtime.topic()));
create policy "hcm room publish" on realtime.messages for insert to authenticated
  with check (extension in ('presence', 'broadcast') and hcm_private.hcm_channel_access(realtime.topic()));

-- Add all selectable avatars and leaderboard reset to an existing classroom installation.
-- Run after the 20261005 migrations. Safe to run more than once.

alter table public.hcm_members
  add column if not exists gender text not null default 'male',
  add column if not exists avatar text not null default 'male-classic';

alter table public.hcm_members drop constraint if exists hcm_members_gender_check;
alter table public.hcm_members drop constraint if exists hcm_members_avatar_check;

update public.hcm_members set
  gender = case
    when avatar in ('agnes-tachyon', 'megumin', 'miku', 'female-suzuka', 'super-creek') then 'female'
    when avatar = 'chikawa' then 'other'
    else 'male'
  end,
  avatar = case when avatar in (
    'male-classic', 'agnes-tachyon', 'chikawa', 'megumin', 'miku', 'professor-layton', 'female-suzuka', 'super-creek'
  ) then avatar else 'male-classic' end;

alter table public.hcm_members add constraint hcm_members_gender_check check (gender in ('male', 'female', 'other'));
alter table public.hcm_members add constraint hcm_members_avatar_check check (avatar in (
  'male-classic', 'agnes-tachyon', 'chikawa', 'megumin', 'miku', 'professor-layton', 'female-suzuka', 'super-creek'
));

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
  select coalesce(jsonb_agg(jsonb_build_object('id', m.user_id::text, 'name', m.name, 'role', m.role,
      'gender', m.gender, 'avatar', m.avatar, 'x', m.x, 'z', m.z, 'rotation', m.rotation, 'seatId', m.seat_id) order by m.user_id), '[]'::jsonb)
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

create or replace function public.hcm_join_profile(p_name text, p_room integer, p_gender text, p_avatar text)
returns jsonb language sql security invoker set search_path = '' as $$
  select hcm_private.hcm_join_profile(p_name, p_room, p_gender, p_avatar);
$$;

revoke all on function hcm_private.hcm_join_profile(text, integer, text, text) from public;
grant execute on function hcm_private.hcm_join_profile(text, integer, text, text) to authenticated;
revoke all on function public.hcm_join_profile(text, integer, text, text) from public, anon;
grant execute on function public.hcm_join_profile(text, integer, text, text) to authenticated;

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

create or replace function public.hcm_reset_exam()
returns jsonb language sql security invoker set search_path = '' as $$
  select hcm_private.hcm_reset_exam();
$$;

revoke all on function hcm_private.hcm_reset_exam() from public;
grant execute on function hcm_private.hcm_reset_exam() to authenticated;
revoke all on function public.hcm_reset_exam() from public, anon;
grant execute on function public.hcm_reset_exam() to authenticated;

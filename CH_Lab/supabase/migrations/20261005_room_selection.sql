-- Add explicit room selection to an existing classroom installation.
-- Run this migration after 20261001_online_classroom.sql.

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

create or replace function public.hcm_join_room(p_name text, p_room integer)
returns jsonb language sql security invoker set search_path = '' as $$
  select hcm_private.hcm_join_room(p_name, p_room);
$$;

revoke all on function hcm_private.hcm_join_room(text, integer) from public;
grant execute on function hcm_private.hcm_join_room(text, integer) to authenticated;
revoke all on function public.hcm_join_room(text, integer) from public, anon;
grant execute on function public.hcm_join_room(text, integer) to authenticated;

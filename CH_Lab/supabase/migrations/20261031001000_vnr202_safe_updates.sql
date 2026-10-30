-- Bound singleton updates explicitly for Supabase safe-update protection.
create or replace function public.vnr202_join(p_token text,p_role text,p_group_id integer default null,p_name text default '',p_host_key text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  h text := vnr202_private.session_hash(p_token);
  g vnr202_private.game;
  team vnr202_private.groups;
begin
  select * into g from vnr202_private.game for update;
  if p_role='host' then
    if g.host_key_hash is null or g.host_key_hash<>encode(sha256(convert_to(coalesce(p_host_key,''),'UTF8')),'hex') then
      raise exception 'Mã người dẫn không đúng.';
    end if;
    if g.host_token_hash is distinct from h and g.host_last_seen>clock_timestamp()-interval '30 seconds' then
      raise exception 'Đã có màn hình người dẫn đang mở.';
    end if;
    if exists(select 1 from vnr202_private.groups where token_hash=h) then raise exception 'Phiên đã dùng cho nhóm.'; end if;
    update vnr202_private.game set host_token_hash=h,host_last_seen=clock_timestamp() where id=true;
  elsif p_role='group' then
    select * into team from vnr202_private.groups where id=p_group_id;
    if not found then raise exception 'Chọn nhóm 1, 3, 4, 5, 6 hoặc 7.'; end if;
    if team.token_hash is distinct from h and team.last_seen>clock_timestamp()-interval '30 seconds' then
      raise exception 'Nhóm % đã có thiết bị đại diện.',p_group_id;
    end if;
    if g.host_token_hash=h or exists(select 1 from vnr202_private.groups where token_hash=h and id<>p_group_id) then
      raise exception 'Phiên đã dùng cho nhóm khác.';
    end if;
    update vnr202_private.groups set token_hash=h,last_seen=clock_timestamp(),
      name=coalesce(nullif(left(btrim(p_name),24),''),'Nhóm ' || id) where id=p_group_id;
  else raise exception 'Vai trò không hợp lệ.';
  end if;
  update public.vnr202_events set version=version+1 where id=true;
  return vnr202_private.snapshot(h);
end;
$$;

create or replace function public.vnr202_action(p_token text,p_action text,p_round integer,p_active_group integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  h text := vnr202_private.session_hash(p_token);
  g vnr202_private.game;
  team_id integer;
  is_host boolean;
begin
  -- Serialize every command on the same row, including nearly simultaneous buzzes.
  select * into g from vnr202_private.game for update;
  is_host:=coalesce(g.host_token_hash=h,false);
  select id into team_id from vnr202_private.groups where token_hash=h;
  if not is_host and team_id is null then raise exception 'Phiên đã hết hiệu lực. Hãy vào lại nhóm.'; end if;
  if p_action is null or p_action not in ('buzz','start','next','correct','wrong','reveal','reset') then raise exception 'Lệnh không hợp lệ.'; end if;
  if p_action<>'buzz' and not is_host then raise exception 'Chỉ người dẫn được điều khiển trò chơi.'; end if;
  if p_round is distinct from g.round then return vnr202_private.snapshot(h); end if;

  if p_action='buzz' then
    if team_id is null or g.phase<>'open' or team_id=any(g.queue) or team_id=any(g.attempted) then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set queue=array_append(queue,team_id) where id=true;
  elsif p_action='start' then
    if g.phase not in ('lobby','done') then return vnr202_private.snapshot(h); end if;
    update vnr202_private.groups set score=0 where id in (1,3,4,5,6,7);
    update vnr202_private.game set phase='open',question_index=0,round=round+1,queue='{}',attempted='{}',correct_group=null where id=true;
  elsif p_action='next' then
    if g.phase<>'revealed' then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set question_index=question_index+1,round=round+1,queue='{}',attempted='{}',correct_group=null,
      phase=case when question_index+1>=(select count(*) from vnr202_private.questions) then 'done' else 'open' end where id=true;
  elsif p_action in ('correct','wrong') then
    if g.phase<>'open' or g.queue[1] is null or g.queue[1] is distinct from p_active_group then return vnr202_private.snapshot(h); end if;
    if p_action='correct' then
      update vnr202_private.groups set score=score+1 where id=g.queue[1];
      update vnr202_private.game set phase='revealed',correct_group=g.queue[1] where id=true;
    else
      update vnr202_private.game set queue=queue[2:cardinality(queue)],attempted=array_append(attempted,g.queue[1]) where id=true;
    end if;
  elsif p_action='reveal' then
    if g.phase<>'open' then return vnr202_private.snapshot(h); end if;
    update vnr202_private.game set phase='revealed' where id=true;
  elsif p_action='reset' then
    update vnr202_private.groups set score=0 where id in (1,3,4,5,6,7);
    update vnr202_private.game set phase='lobby',question_index=0,round=round+1,queue='{}',attempted='{}',correct_group=null where id=true;
  end if;
  update public.vnr202_events set version=version+1 where id=true;
  return vnr202_private.snapshot(h);
end;
$$;

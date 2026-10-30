-- All snapshots use the same lock as join/action, including heartbeat reads.
create or replace function public.vnr202_state(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare h text := vnr202_private.session_hash(p_token);
begin
  perform id from vnr202_private.game where id=true for update;
  if exists(select 1 from vnr202_private.game where host_token_hash=h) then
    update vnr202_private.game set host_last_seen=clock_timestamp() where host_token_hash=h;
  else
    update vnr202_private.groups set last_seen=clock_timestamp() where token_hash=h;
  end if;
  return vnr202_private.snapshot(h);
end;
$$;

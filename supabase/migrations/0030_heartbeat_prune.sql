-- Heartbeats were kept after a player page closed: only deleting the session or the account removed them. player_heartbeat now deletes
-- the session's rows last seen more than a day ago before it writes its own, so the privacy page ("who is listening, while a player page
-- is open") stays true for every live session. Same function as 0002, plus the delete.
create or replace function public.player_heartbeat(p_session text, p_device text, p_audio text, p_volume real, p_delay real)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_audio not in ('playing', 'muted', 'not_started') then raise exception 'bad audio value'; end if;
  if p_device is null or length(p_device) not between 4 and 40 then raise exception 'bad device id'; end if;
  if not exists (select 1 from public.sessions where id = p_session and ended_at is null) then
    raise exception 'session not found or ended';
  end if;
  delete from public.player_heartbeats where session_id = p_session and seen_at < now() - interval '1 day';
  if not exists (select 1 from public.player_heartbeats where session_id = p_session and device_id = p_device)
     and (select count(*) from public.player_heartbeats where session_id = p_session and seen_at > now() - interval '5 minutes') >= 50 then
    raise exception 'too many listeners';
  end if;
  insert into public.player_heartbeats (session_id, user_id, device_id, audio, volume, delay)
  values (p_session, auth.uid(), p_device, p_audio, least(greatest(coalesce(p_volume, 0), 0), 1), least(greatest(coalesce(p_delay, 0), 0), 1))
  on conflict (session_id, device_id) do update
    set audio = excluded.audio, volume = excluded.volume, delay = excluded.delay, user_id = excluded.user_id;
end $$;

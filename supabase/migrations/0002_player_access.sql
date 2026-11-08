-- Open player link: whoever has the link can listen, with no account and no sign-in.
-- The 24-character session id is the credential. Listeners read through two functions and never touch the tables.

-- invites are replaced by the open link
drop function if exists public.redeem_invite(text);
drop table if exists public.invites;

-- slow mood after each state (background layer, see mood-mapping.md)
alter table public.states add column slow_mood jsonb;

-- listener controls reported by the player, returned to the model as `controls`.
-- Listeners have no account, so a heartbeat belongs to a device, not a user.
alter table public.player_heartbeats
  alter column user_id drop not null,
  add column volume real check (volume between 0 and 1),
  add column delay  real check (delay  between 0 and 1);

-- seen_at must come from the database clock, not from a player's device
create or replace function public.touch_heartbeat()
returns trigger language plpgsql as $$
begin
  new.seen_at := now();
  return new;
end $$;
create trigger player_heartbeats_touch before insert or update on public.player_heartbeats
  for each row execute function public.touch_heartbeat();

-- What a player needs: the current state and the settings it must respect. Null if the session does not exist.
create or replace function public.get_player_state(p_session text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ended', s.ended_at is not null,
    'settings', s.settings,
    'state', case when st.id is null then null else jsonb_build_object(
      'effective', st.effective, 'seed', st.seed, 'turn', st.turn, 'final', st.final, 'created_at', st.created_at) end)
  from public.sessions s
  left join public.states st on st.id = s.current_state_id
  where s.id = p_session;
$$;

-- A player says it is listening, and with which controls. Bounded so a leaked link cannot flood the table.
-- user_id is the signed-in account, or null for a listener with only the link. Only the owner's controls
-- are reported to the model (see set_sound); everyone else only counts as a listener.
create or replace function public.player_heartbeat(p_session text, p_device text, p_audio text, p_volume real, p_delay real)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_audio not in ('playing', 'muted', 'not_started') then raise exception 'bad audio value'; end if;
  if p_device is null or length(p_device) not between 4 and 40 then raise exception 'bad device id'; end if;
  if not exists (select 1 from public.sessions where id = p_session and ended_at is null) then
    raise exception 'session not found or ended';
  end if;
  if not exists (select 1 from public.player_heartbeats where session_id = p_session and device_id = p_device)
     and (select count(*) from public.player_heartbeats where session_id = p_session and seen_at > now() - interval '5 minutes') >= 50 then
    raise exception 'too many listeners';
  end if;
  insert into public.player_heartbeats (session_id, user_id, device_id, audio, volume, delay)
  values (p_session, auth.uid(), p_device, p_audio, least(greatest(coalesce(p_volume, 0), 0), 1), least(greatest(coalesce(p_delay, 0), 0), 1))
  on conflict (session_id, device_id) do update
    set audio = excluded.audio, volume = excluded.volume, delay = excluded.delay, user_id = excluded.user_id;
end $$;

-- Wake the players when something changes. The payload is only a hint: the player fetches the real state with
-- get_player_state, so a forged broadcast on this public channel can never push content to listeners.
create or replace function public.broadcast_state()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('turn', new.turn, 'final', new.final), 'state', 'player:' || new.session_id, false);
  return new;
end $$;
create trigger states_broadcast after insert on public.states
  for each row execute function public.broadcast_state();

create or replace function public.broadcast_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send('{}'::jsonb, 'session', 'player:' || new.id, false);
  return new;
end $$;
create trigger sessions_broadcast after update on public.sessions
  for each row when (old.ended_at is distinct from new.ended_at or old.settings is distinct from new.settings)
  execute function public.broadcast_session();

revoke execute on function public.touch_heartbeat(), public.broadcast_state(), public.broadcast_session() from public, anon, authenticated;
revoke execute on function public.get_player_state(text), public.player_heartbeat(text, text, text, real, real) from public;
grant  execute on function public.get_player_state(text), public.player_heartbeat(text, text, text, real, real) to anon, authenticated, service_role;

-- How many sessions have someone listening right now, and how many listeners in all. Aggregate numbers only: no session id,
-- no device, nothing that identifies anyone, so the landing page can show it to everybody.
-- A listener is a player with a heartbeat in the last 60 s (they come every 20 s) that is playing or muted; a tab that
-- never pressed "Start listening" (not_started) does not count. Ended sessions do not count.
create or replace function public.live_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'sessions',  count(distinct h.session_id),
    'listeners', count(*))
  from public.player_heartbeats h
  join public.sessions s on s.id = h.session_id and s.ended_at is null
  where h.seen_at > now() - interval '60 seconds' and h.audio in ('playing', 'muted');
$$;
revoke execute on function public.live_counts() from public;
grant  execute on function public.live_counts() to anon, authenticated, service_role;

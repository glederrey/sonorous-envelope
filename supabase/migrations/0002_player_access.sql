-- Open player link: anyone with the link can listen after an anonymous sign-in.
-- Anonymous users become listeners through join_session; they never own sessions.

-- invites are replaced by the open link
drop function if exists public.redeem_invite(text);
drop table if exists public.invites;

-- anonymous users cannot create sessions through the Data API
drop policy if exists sessions_owner_insert on public.sessions;
create policy sessions_owner_insert on public.sessions for insert
  with check (owner_id = auth.uid() and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- slow mood after each state (background layer, see mood-mapping.md)
alter table public.states add column slow_mood jsonb;

-- listener controls reported by the player, returned to the model as `controls`
alter table public.player_heartbeats
  add column volume real check (volume between 0 and 1),
  add column delay  real check (delay  between 0 and 1);

-- Join a session as a listener (works for anonymous users too).
create or replace function public.join_session(p_session text)
returns text language plpgsql security definer set search_path = public as $$
declare n integer; found_id text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into found_id from public.sessions where id = p_session and ended_at is null;
  if found_id is null then raise exception 'session not found or ended'; end if;
  select count(*) + 1 into n from public.listeners where session_id = p_session;
  insert into public.listeners (session_id, user_id, role, label)
  values (p_session, auth.uid(), 'listener', 'listener ' || n)
  on conflict do nothing;
  return found_id;
end $$;

revoke execute on function public.join_session(text) from public, anon;
grant  execute on function public.join_session(text) to authenticated, service_role;

-- seen_at must come from the database clock, not from a player's device
create or replace function public.touch_heartbeat()
returns trigger language plpgsql as $$
begin
  new.seen_at := now();
  return new;
end $$;
create trigger player_heartbeats_touch before insert or update on public.player_heartbeats
  for each row execute function public.touch_heartbeat();
revoke execute on function public.touch_heartbeat() from public, anon, authenticated;

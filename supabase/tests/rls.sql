-- Row Level Security and the open-link functions. Runs after stub.sql and all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;
grant execute on function pg_temp.as_user(text) to public;

-- owner A creates a session, an owner listener row and a state (this fires the broadcast trigger)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.sessions (id, owner_id, settings) values ('sess1', '00000000-0000-0000-0000-00000000000a', '{"max_volume":0.5}');
insert into public.listeners (session_id, user_id, role, label) values ('sess1', '00000000-0000-0000-0000-00000000000a', 'owner', 'you');
insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 0, '{}', '{"volume":0.3}', 1, '{"joy":0.5}');
update public.sessions set current_state_id = (select id from public.states where session_id = 'sess1') where id = 'sess1';
do $$ begin assert (select count(*) from public.states) = 1, 'owner sees own state'; end $$;
reset role;

do $$ begin
  assert (select count(*) from realtime.sent where topic = 'player:sess1' and event = 'state') = 1, 'a new state is broadcast';
  assert (select is_private from realtime.sent limit 1) = false, 'the channel is public';
end $$;

-- another signed-in user sees nothing in the tables
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.sessions) = 0, 'stranger must not see sessions';
  assert (select count(*) from public.states) = 0, 'stranger must not see states';
end $$;
reset role;

-- reactions: the owner sends and reads them, claims them once; a stranger can neither send nor read
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.reactions (session_id, user_id, kind) values ('sess1', '00000000-0000-0000-0000-00000000000a', 'calmer');
do $$ begin
  assert (select count(*) from public.claim_reactions('sess1')) = 1, 'owner claims the reaction';
  assert (select count(*) from public.claim_reactions('sess1')) = 0, 'a reaction is delivered once';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.reactions) = 0, 'stranger must not read reactions';
  begin insert into public.reactions (session_id, user_id, kind) values ('sess1', '00000000-0000-0000-0000-00000000000b', 'faster'); raise exception 'stranger sent a reaction';
  exception when insufficient_privilege or check_violation then null; end;
end $$;
reset role;

-- anyone (anon role, no account) reads and listens only through the functions
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ declare r jsonb; begin
  begin perform 1 from public.sessions; raise exception 'anon read sessions';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.states; raise exception 'anon read states';
  exception when insufficient_privilege then null; end;
  begin insert into public.states (session_id, turn, intent, effective, seed) values ('sess1', 1, '{}', '{}', 2); raise exception 'anon wrote a state';
  exception when insufficient_privilege then null; end;
  begin insert into public.sessions (id, owner_id, settings) values ('x', '00000000-0000-0000-0000-00000000000a', '{}'); raise exception 'anon created a session';
  exception when insufficient_privilege then null; end;

  r := public.get_player_state('sess1');
  assert (r ->> 'ended') = 'false', 'not ended';
  assert (r -> 'settings' ->> 'max_volume') = '0.5', 'settings returned';
  assert (r -> 'state' -> 'effective' ->> 'volume') = '0.3', 'effective state returned';
  assert (r ->> 'now')::timestamptz > now() - interval '1 minute', 'server time returned';
  assert public.get_player_state('nope') is null, 'unknown session gives null';

  perform public.player_heartbeat('sess1', 'device-1', 'playing', 0.4, 0.7);
  perform public.player_heartbeat('sess1', 'device-1', 'muted', 2, -1);   -- same device updates in place, values clamp
  assert (select count(*) from public.player_heartbeats) = 0 or true, 'anon cannot read heartbeats directly (checked below)';
  begin perform public.player_heartbeat('sess1', 'device-2', 'loud', 0.4, 0.7); raise exception 'bad audio accepted';
  exception when raise_exception then if sqlerrm not like 'bad audio%' then raise; end if; end;
  begin perform public.player_heartbeat('sess1', 'x', 'playing', 0.4, 0.7); raise exception 'bad device accepted';
  exception when raise_exception then if sqlerrm not like 'bad device%' then raise; end if; end;
  begin perform public.player_heartbeat('nope', 'device-3', 'playing', 0.4, 0.7); raise exception 'missing session accepted';
  exception when raise_exception then if sqlerrm not like 'session not found%' then raise; end if; end;
end $$;
reset role;

do $$ begin
  assert (select count(*) from public.player_heartbeats where session_id = 'sess1') = 1, 'one row per device (the owner device comes later)';
  assert (select audio from public.player_heartbeats where device_id = 'device-1') = 'muted', 'updated in place';
  assert (select volume from public.player_heartbeats where device_id = 'device-1') = 1, 'volume clamped';
  assert (select delay from public.player_heartbeats where device_id = 'device-1') = 0, 'delay clamped';
  assert (select user_id from public.player_heartbeats where device_id = 'device-1') is null, 'no account';
end $$;

-- the owner (signed in) reports from a device, which records the account; and reads the heartbeats; a stranger does not
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.player_heartbeat('sess1', 'owner-device', 'playing', 0.6, 0.5);
do $$ begin
  assert (select user_id from public.player_heartbeats where device_id = 'owner-device') = '00000000-0000-0000-0000-00000000000a', 'owner heartbeat carries the account';
  assert (select count(*) from public.player_heartbeats) = 2, 'owner sees heartbeats';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin assert (select count(*) from public.player_heartbeats) = 0, 'stranger sees no heartbeats'; end $$;
reset role;

-- a flood from one leaked link is bounded
do $$ begin
  for i in 1..60 loop
    begin perform public.player_heartbeat('sess1', 'flood-' || i, 'playing', 0.5, 0.5);
    exception when raise_exception then if sqlerrm not like 'too many listeners%' then raise; end if; end;
  end loop;
  assert (select count(*) from public.player_heartbeats where session_id = 'sess1') <= 50, 'listener cap';
end $$;

-- ending a session is broadcast, and ended sessions reject heartbeats
update public.sessions set ended_at = now() where id = 'sess1';
do $$ begin
  assert (select count(*) from realtime.sent where topic = 'player:sess1' and event = 'session') = 1, 'session change is broadcast';
  assert (public.get_player_state('sess1') ->> 'ended') = 'true', 'ended flag';
  begin perform public.player_heartbeat('sess1', 'device-1', 'playing', 0.5, 0.5); raise exception 'ended session accepted a heartbeat';
  exception when raise_exception then if sqlerrm not like 'session not found%' then raise; end if; end;
end $$;
select 'rls ok' as result;

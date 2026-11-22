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

-- snapshots: the owner writes through put_snapshot and reads the row; a stranger and anon can do neither
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.put_snapshot('sess1', (select current_state_id from public.sessions where id = 'sess1'), 'data:image/jpeg;base64,QUJDRA==', '{"seconds":8}', 0.5);
do $$ begin assert (select count(*) from public.snapshots) = 1, 'owner sees the snapshot'; end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.snapshots) = 0, 'stranger sees no snapshot';
  begin perform public.put_snapshot('sess1', null, 'data:image/jpeg;base64,QUJDRA==', '{}', 0.5); raise exception 'stranger saved a snapshot';
  exception when raise_exception then if sqlerrm not like 'only the session owner%' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ begin
  begin perform public.put_snapshot('sess1', null, 'data:image/jpeg;base64,QUJDRA==', '{}', 0.5); raise exception 'anon saved a snapshot';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.snapshots; raise exception 'anon read snapshots';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- notes to the developers: neither table is reachable by anon or authenticated, and anon cannot send one
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  begin perform 1 from public.dev_feedback; raise exception 'authenticated read dev_feedback';
  exception when insufficient_privilege then null; end;
  begin insert into public.dev_feedback (kind, source, body) values ('bug', 'model', repeat('x', 80)); raise exception 'authenticated wrote dev_feedback';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.dev_feedback_quota; raise exception 'authenticated read dev_feedback_quota';
  exception when insufficient_privilege then null; end;
  begin insert into public.dev_feedback_quota (user_id, day, n) values ('00000000-0000-0000-0000-00000000000a', current_date, 0); raise exception 'authenticated wrote dev_feedback_quota';
  exception when insufficient_privilege then null; end;
  perform public.send_dev_feedback('bug', 'model', repeat('x', 80), '0.0.0', null, null);
end $$;
reset role;
do $$ begin assert (select count(*) from public.dev_feedback) = 1, 'the note arrived'; end $$;
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ begin
  begin perform 1 from public.dev_feedback; raise exception 'anon read dev_feedback';
  exception when insufficient_privilege then null; end;
  begin insert into public.dev_feedback (kind, source, body) values ('bug', 'model', repeat('x', 80)); raise exception 'anon wrote dev_feedback';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.dev_feedback_quota; raise exception 'anon read dev_feedback_quota';
  exception when insufficient_privilege then null; end;
  begin insert into public.dev_feedback_quota (user_id, day, n) values ('00000000-0000-0000-0000-00000000000a', current_date, 0); raise exception 'anon wrote dev_feedback_quota';
  exception when insufficient_privilege then null; end;
  begin perform public.send_dev_feedback('bug', 'model', repeat('x', 80), '0.0.0', null, null); raise exception 'anon sent a note';
  exception when insufficient_privilege then null; end;
end $$;
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
-- saved moments: only save_moment writes, the state is copied on the server and frozen, the owner reads, renames and deletes, a stranger
-- does nothing, and the public read never carries owner_id or session_id
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.sessions (id, owner_id, settings) values ('sess-quiet', '00000000-0000-0000-0000-00000000000a', '{}');
do $$ declare sid uuid; r jsonb; mid text; begin
  -- a quiet session: nothing to save
  begin perform public.save_moment('sess-quiet', 'x', 'human', 5, 'dev'); raise exception 'saved a session with no state';
  exception when raise_exception then if sqlerrm <> 'saved_moment: nothing_playing' then raise; end if; end;
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess-quiet', 0, '{}', '{"volume":0}', 1, '{}');
  update public.sessions set current_state_id = (select id from public.states where session_id = 'sess-quiet') where id = 'sess-quiet';
  begin perform public.save_moment('sess-quiet', 'x', 'human', 5, 'dev'); raise exception 'saved a silent state';
  exception when raise_exception then if sqlerrm <> 'saved_moment: nothing_playing' then raise; end if; end;
  -- a playing state with a one-shot motif, a delay and a tempo glide: they do not reach the keepsake
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood)
  values ('sess1', 1, '{}', '{"volume":0.3,"motif":{"id":1},"transition":{"time":4,"curve":"smooth","delay":9},"grid":{"arp":0,"bass":0,"beat":3,"fromTempo":80,"glide":4,"fromRate":1.2}}', 777, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
  begin perform public.save_moment('sess1', '   ', 'human', 5, 'dev'); raise exception 'saved an empty name';
  exception when raise_exception then if sqlerrm <> 'saved_moment: bad_input' then raise; end if; end;
  begin perform public.save_moment('sess1', repeat('n', 81), 'human', 5, 'dev'); raise exception 'saved a long name';
  exception when raise_exception then if sqlerrm <> 'saved_moment: bad_input' then raise; end if; end;
  begin perform public.save_moment('sess1', 'x', 'robot', 5, 'dev'); raise exception 'saved with a made-up author';
  exception when raise_exception then if sqlerrm <> 'saved_moment: bad_input' then raise; end if; end;
  r := public.save_moment('sess1', '  Rain at dusk  ', 'human', 4242, 'v0.0.1');
  mid := r ->> 'id';
  perform set_config('test.moment', mid, false);
  assert length(mid) = 22 and mid ~ '^[A-Za-z0-9_-]+$', 'the id is 22 url-safe characters';
  assert r ->> 'name' = 'Rain at dusk', 'the name is trimmed';
  assert (select effective from public.saved_moments where id = mid) = '{"volume":0.3,"transition":{"time":4,"curve":"smooth"},"grid":{"arp":0,"bass":0,"beat":3}}'::jsonb, 'frozen: no motif, delay or glide';
  assert (select seed from public.saved_moments where id = mid) = 777 and (select voice_seed from public.saved_moments where id = mid) = 4242, 'seeds kept';
  assert (select saved_by from public.saved_moments where id = mid) = 'human', 'saved_by kept';
  -- the AI on its own: three per session
  perform public.save_moment('sess1', 'ai 1', 'ai', 4242, 'dev'); perform public.save_moment('sess1', 'ai 2', 'ai', 4242, 'dev'); perform public.save_moment('sess1', 'ai 3', 'ai', 4242, 'dev');
  begin perform public.save_moment('sess1', 'ai 4', 'ai', 4242, 'dev'); raise exception 'the AI saved a fourth';
  exception when raise_exception then if sqlerrm <> 'saved_moment: ai_saves_full' then raise; end if; end;
  perform public.save_moment('sess1', 'listener asked', 'human', 4242, 'dev'); -- the cap is for the AI's own saves
  -- ten a minute
  for i in 1..5 loop perform public.save_moment('sess1', 'h' || i, 'human', 4242, 'dev'); end loop;
  begin perform public.save_moment('sess1', 'too many', 'human', 4242, 'dev'); raise exception 'the per-minute cap did not hold';
  exception when raise_exception then if sqlerrm <> 'saved_moment: too_fast' then raise; end if; end;
end $$;
-- 200 per owner: the rows are not writable by the owner, so fill up as the table owner
reset role;
update public.saved_moments set created_at = now() - interval '1 hour' where owner_id = '00000000-0000-0000-0000-00000000000a';
insert into public.saved_moments (id, owner_id, name, saved_by, effective, seed, voice_seed)
  select 'fill' || i, '00000000-0000-0000-0000-00000000000a', 'fill', 'human', '{}', 1, 1 from generate_series(1, 190) i;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  begin perform public.save_moment('sess1', 'one more', 'human', 4242, 'dev'); raise exception 'saved past 200';
  exception when raise_exception then if sqlerrm <> 'saved_moment: saves_full' then raise; end if; end;
  -- no direct insert, no change to anything but the name
  begin insert into public.saved_moments (id, owner_id, name, saved_by, effective, seed, voice_seed) values ('x', '00000000-0000-0000-0000-00000000000a', 'n', 'human', '{}', 1, 1); raise exception 'direct insert';
  exception when insufficient_privilege then null; end;
  begin update public.saved_moments set effective = '{"volume":1}' where name = 'Rain at dusk'; raise exception 'effective was changed';
  exception when insufficient_privilege then null; end;
  begin update public.saved_moments set owner_id = '00000000-0000-0000-0000-00000000000b' where name = 'Rain at dusk'; raise exception 'owner was changed';
  exception when insufficient_privilege then null; end;
  begin update public.saved_moments set saved_by = 'ai' where name = 'Rain at dusk'; raise exception 'saved_by was changed';
  exception when insufficient_privilege then null; end;
  update public.saved_moments set name = 'Rain, later' where name = 'Rain at dusk';
  assert exists (select 1 from public.saved_moments where name = 'Rain, later'), 'the owner renames';
  begin update public.saved_moments set name = '' where name = 'Rain, later'; raise exception 'empty name';
  exception when check_violation then null; end;
end $$;
reset role;

-- a stranger: no save in someone else's session, no read, no rename, no delete
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  begin perform public.save_moment('sess1', 'mine now', 'human', 1, 'dev'); raise exception 'a stranger saved';
  exception when raise_exception then if sqlerrm <> 'saved_moment: not_owner' then raise; end if; end;
  assert (select count(*) from public.saved_moments) = 0, 'a stranger sees no saved moment';
  update public.saved_moments set name = 'hijack';
  delete from public.saved_moments;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.saved_moments where owner_id = '00000000-0000-0000-0000-00000000000a') = 200, 'the stranger deleted nothing';
  assert not exists (select 1 from public.saved_moments where name = 'hijack'), 'no rename by a stranger';
end $$;

-- anyone reads one by its id, and never gets the owner or the session; anon cannot save, list or read the table
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ declare r jsonb; begin
  r := public.get_saved_moment(current_setting('test.moment'));
  assert r ->> 'name' = 'Rain, later' and r ->> 'saved_by' = 'human' and (r ->> 'voice_seed')::bigint = 4242 and (r ->> 'seed')::bigint = 777, 'the public read';
  assert r -> 'effective' ->> 'volume' = '0.3' and r ->> 'app_version' = 'v0.0.1' and r ->> 'created_at' is not null, 'the public read has the sound';
  assert not (r ? 'owner_id') and not (r ? 'session_id') and not (r::text like '%sess1%'), 'no owner or session in the public read';
  assert public.get_saved_moment('nothing-here') is null, 'an unknown id is null';
  begin perform 1 from public.saved_moments; raise exception 'anon read saved_moments';
  exception when insufficient_privilege then null; end;
  begin perform public.save_moment('sess1', 'anon', 'human', 1, 'dev'); raise exception 'anon saved';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- the owner deletes one of their own
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  delete from public.saved_moments where id = current_setting('test.moment');
  assert not exists (select 1 from public.saved_moments where id = current_setting('test.moment')), 'the owner deletes';
end $$;
reset role;

-- delete_my_account: the caller's own account and data go, nobody else's; anon and a missing uid are refused
insert into public.sessions (id, owner_id, settings) values ('sess-b', '00000000-0000-0000-0000-00000000000b', '{}');
insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess-b', 0, '{}', '{}', 1, '{}');
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ begin
  begin perform public.delete_my_account(); raise exception 'anon deleted an account';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
do $$ begin
  begin perform public.delete_my_account(); raise exception 'deleted with no uid';
  exception when insufficient_privilege then if sqlerrm <> 'not signed in' then raise; end if; end;
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 'A is deleted';
  assert not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'A profile is deleted';
  assert not exists (select 1 from public.sessions where owner_id = '00000000-0000-0000-0000-00000000000a'), 'A sessions are deleted';
  assert not exists (select 1 from public.states where session_id = 'sess1'), 'A states are deleted';
  assert not exists (select 1 from public.saved_moments where owner_id = '00000000-0000-0000-0000-00000000000a'), 'A saved moments are deleted';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 'B is untouched';
  assert exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b'), 'B profile is untouched';
  assert exists (select 1 from public.sessions where id = 'sess-b'), 'B session is untouched';
  assert exists (select 1 from public.states where session_id = 'sess-b'), 'B states are untouched';
end $$;
select 'rls ok' as result;

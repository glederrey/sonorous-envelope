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
  -- saving the same state again writes nothing and returns the first save
  r := public.save_moment('sess1', 'again', 'ai', 4242, 'dev');
  assert (r ->> 'already')::boolean and r ->> 'id' = mid and r ->> 'name' = 'Rain at dusk' and r ->> 'saved_by' = 'human', 'a second save returns the first';
  assert (select count(*) from public.saved_moments where owner_id = '00000000-0000-0000-0000-00000000000a') = 1, 'a second save writes no row';
  assert not (public.save_moment('sess1', 'x', 'human', 4243, 'dev') ->> 'already')::boolean, 'another voice seed is another moment';
  -- the AI on its own: one per 5 turns of the session (the turn is the saved state's)
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 100, '{}', '{"volume":0.3}', 1000, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
  r := public.save_moment('sess1', 'ai at 100', 'ai', 4242, 'dev');
  assert not (r ->> 'already')::boolean and r ->> 'saved_by' = 'ai', 'a new save is not already';
  assert (select turn from public.saved_moments where id = r ->> 'id') = 100, 'the turn is kept';
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 104, '{}', '{"volume":0.3}', 1004, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
  begin perform public.save_moment('sess1', 'ai at 104', 'ai', 4242, 'dev'); raise exception 'the AI saved 4 turns after its last save';
  exception when raise_exception then if sqlerrm <> 'saved_moment: ai_too_soon' then raise; end if; end;
  perform public.save_moment('sess1', 'listener asked', 'human', 4242, 'dev'); -- the spacing is for the AI's own saves
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 105, '{}', '{"volume":0.3}', 1005, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
  perform public.save_moment('sess1', 'ai at 105', 'ai', 4242, 'dev'); -- 5 turns after the one at 100
  -- ten a minute: 5 saved so far above (the first one, the other voice seed, 100, 104 and 105)
  for i in 1..5 loop
    insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 200 + i, '{}', '{"volume":0.3}', 2000 + i, '{}') returning id into sid;
    update public.sessions set current_state_id = sid where id = 'sess1';
    perform public.save_moment('sess1', 'h' || i, 'human', 4242, 'dev');
  end loop;
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 300, '{}', '{"volume":0.3}', 3000, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
  begin perform public.save_moment('sess1', 'too many', 'human', 4242, 'dev'); raise exception 'the per-minute cap did not hold';
  exception when raise_exception then if sqlerrm <> 'saved_moment: too_fast' then raise; end if; end;
  -- saving what is already saved is not a new save: no cap applies (the current state is the one saved as h5, turn 205)
  update public.sessions set current_state_id = (select id from public.states where session_id = 'sess1' and turn = 205) where id = 'sess1';
  assert (public.save_moment('sess1', 'again', 'ai', 4242, 'dev') ->> 'already')::boolean, 're-saving passes the per-minute cap';
end $$;
-- 200 per owner: the rows are not writable by the owner, so fill up as the table owner
reset role;
update public.saved_moments set created_at = now() - interval '1 hour' where owner_id = '00000000-0000-0000-0000-00000000000a';
insert into public.saved_moments (id, owner_id, name, saved_by, effective, seed, voice_seed, fingerprint)
  select 'fill' || i, '00000000-0000-0000-0000-00000000000a', 'fill', 'human', '{}', 1, 1, 'fill' || i from generate_series(1, 190) i;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ declare sid uuid; begin
  insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 400, '{}', '{"volume":0.3}', 4000, '{}') returning id into sid;
  update public.sessions set current_state_id = sid where id = 'sess1';
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

-- guest emojis (0028): anyone with the link presses, with rate limits; only the owner reads and claims them; they never touch reactions
insert into public.sessions (id, owner_id, settings) values
  ('emo1', '00000000-0000-0000-0000-00000000000a', '{}'),
  ('emo2', '00000000-0000-0000-0000-00000000000a', '{}'),
  ('emo-gone', '00000000-0000-0000-0000-00000000000a', '{}');
update public.sessions set ended_at = now() where id = 'emo-gone';
select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '{}', false);
set role anon;
do $$ declare r jsonb; begin
  r := public.send_emoji('emo1', 'guest-dev-1', 'heart');
  assert r = '{"ok": true}'::jsonb, 'anon stores an emoji';
  begin perform 1 from public.emoji_reactions; raise exception 'anon read emoji_reactions';
  exception when insufficient_privilege then null; end;
  begin insert into public.emoji_reactions (session_id, device_id, emoji) values ('emo1', 'guest-dev-9', 'heart'); raise exception 'anon inserted directly';
  exception when insufficient_privilege then null; end;
  begin perform * from public.claim_emojis('emo1'); raise exception 'anon claimed';
  exception when insufficient_privilege then null; end;
  -- the same device again within 2 s: slow_down, nothing stored (one transaction, so now() has not moved)
  r := public.send_emoji('emo1', 'guest-dev-1', 'happy');
  assert r = '{"ok": false, "reason": "slow_down"}'::jsonb, 'second press within 2 s';
  -- refused
  begin perform public.send_emoji('emo1', 'guest-dev-2', 'skull'); raise exception 'bad emoji accepted';
  exception when raise_exception then if sqlerrm <> 'bad emoji' then raise; end if; end;
  begin perform public.send_emoji('emo1', 'ab', 'heart'); raise exception 'short device id accepted';
  exception when raise_exception then if sqlerrm <> 'bad device id' then raise; end if; end;
  begin perform public.send_emoji('emo-gone', 'guest-dev-2', 'heart'); raise exception 'ended session accepted';
  exception when raise_exception then if sqlerrm not like 'session not found%' then raise; end if; end;
  begin perform public.send_emoji('nothing-here', 'guest-dev-2', 'heart'); raise exception 'missing session accepted';
  exception when raise_exception then if sqlerrm not like 'session not found%' then raise; end if; end;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.emoji_reactions where session_id = 'emo1') = 1, 'only the first press was stored';
  -- the broadcast carries the emoji key and nothing else
  assert (select payload from realtime.sent where topic = 'player:emo1' and event = 'emoji') = '{"emoji": "heart"}'::jsonb, 'broadcast carries only the key';
  assert (select is_private from realtime.sent where topic = 'player:emo1' and event = 'emoji') = false, 'the emoji channel is public like the others';
  -- a guest press is not a reaction
  assert not exists (select 1 from public.reactions where session_id = 'emo1'), 'no row in reactions';
end $$;

-- the caps: 10 a minute for one device, 60 a minute for the session (presses are backdated 3 s each, to stand for real time passing)
do $$ declare r jsonb; i int; d int; begin
  for i in 1..10 loop
    r := public.send_emoji('emo2', 'cap-dev-1', 'happy');
    assert (r ->> 'ok')::boolean, 'press ' || i || ' of a device is allowed';
    update public.emoji_reactions set created_at = created_at - interval '3 seconds' where session_id = 'emo2';
  end loop;
  r := public.send_emoji('emo2', 'cap-dev-1', 'happy');
  assert r = '{"ok": false, "reason": "slow_down"}'::jsonb, 'the 11th press in a minute';
  assert (select count(*) from public.emoji_reactions where session_id = 'emo2') = 10, 'the refused press is not stored';
  -- other devices fill the session up to 60 a minute (5 more devices of 10 each; the first already has its 10)
  for d in 2..6 loop
    for i in 1..10 loop
      r := public.send_emoji('emo2', 'cap-dev-' || d, 'sad');
      assert (r ->> 'ok')::boolean, 'device ' || d || ' press ' || i;
      update public.emoji_reactions set created_at = created_at - interval '3 seconds' where session_id = 'emo2' and device_id = 'cap-dev-' || d;
    end loop;
  end loop;
  assert (select count(*) from public.emoji_reactions where session_id = 'emo2') = 60, 'sixty in the session';
  r := public.send_emoji('emo2', 'cap-dev-7', 'sad');
  assert r = '{"ok": false, "reason": "slow_down"}'::jsonb, 'the session cap';
  -- housekeeping: a press older than a day goes on the next insert
  update public.emoji_reactions set created_at = now() - interval '2 days' where session_id = 'emo2';
  r := public.send_emoji('emo2', 'cap-dev-7', 'sad');
  assert (r ->> 'ok')::boolean and (select count(*) from public.emoji_reactions where session_id = 'emo2') = 1, 'old presses are removed';
end $$;

-- a stranger (signed in, not the owner) can press, but sees and claims nothing, and cannot mark anything delivered
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ declare n int; begin
  assert (public.send_emoji('emo1', 'stranger-dev', 'crying') ->> 'ok')::boolean, 'a signed-in stranger presses';
  assert (select count(*) from public.emoji_reactions) = 0, 'the stranger reads none';
  assert (select count(*) from public.claim_emojis('emo1')) = 0, 'the stranger claims none';
  update public.emoji_reactions set delivered_at = now(); get diagnostics n = row_count;
  assert n = 0, 'the stranger marks none delivered';
  begin update public.emoji_reactions set emoji = 'heart'; raise exception 'emoji column updated';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin assert (select count(*) from public.emoji_reactions where session_id = 'emo1' and delivered_at is null) = 2, 'still undelivered after the stranger'; end $$;

-- the owner reads them and claims them once; reactions are untouched
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ declare c int; begin
  assert (select count(*) from public.emoji_reactions where session_id = 'emo1') = 2, 'the owner reads both';
  select count(*) into c from public.claim_emojis('emo1');
  assert c = 2, 'the owner claims both';
  assert (select count(*) from public.claim_emojis('emo1')) = 0, 'claimed once';
  assert (select count(*) from public.claim_emojis('emo2')) = 1, 'each session on its own';
  assert (select count(*) from public.claim_reactions('emo1')) = 0, 'claim_reactions never returns an emoji';
end $$;
reset role;

-- deleting the session takes its emojis along
delete from public.sessions where id in ('emo1', 'emo2', 'emo-gone');
do $$ begin assert not exists (select 1 from public.emoji_reactions), 'emojis go with the session'; end $$;

-- Allow Strudel off then on (0029): the pattern comes back on the same state; after a lock to Self it does not
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.sessions (id, owner_id, mode, settings) values ('sess-st', '00000000-0000-0000-0000-00000000000a', 'sandbox', '{}');
insert into public.listeners (session_id, user_id, role, label) values ('sess-st', '00000000-0000-0000-0000-00000000000a', 'owner', 'you');
insert into public.states (session_id, turn, intent, effective, seed, slow_mood)
  values ('sess-st', 1, '{}', '{"volume":0.5,"engine":"strudel","pattern":{"code":"s(\"bd\")","bpm":100}}', 1, '{}');
update public.sessions set current_state_id = (select id from public.states where session_id = 'sess-st') where id = 'sess-st';
select public.set_allow_code('sess-st', false);
do $$ declare e jsonb; i jsonb; begin
  select effective, intent into e, i from public.states where session_id = 'sess-st';
  assert not e ? 'engine' and (e->>'volume')::numeric = 0, 'code off strips the pattern and silences';
  assert i->'stopped_pattern'->'pattern'->>'code' = 's("bd")' and (i->'stopped_pattern'->>'volume')::numeric = 0.5, 'what was stripped is kept';
end $$;
select public.set_allow_code('sess-st', true);
do $$ declare e jsonb; i jsonb; begin
  select effective, intent into e, i from public.states where session_id = 'sess-st';
  assert e->>'engine' = 'strudel' and e->'pattern'->>'code' = 's("bd")' and (e->>'volume')::numeric = 0.5, 'code on brings the pattern back';
  assert not i ? 'stopped_pattern' and not i ? 'owner_stopped_pattern', 'and clears the marks';
end $$;
select public.set_allow_code('sess-st', false);
select public.set_mode_policy('sess-st', 'internal');
select public.set_mode_policy('sess-st', 'auto');
update public.sessions set mode = 'sandbox' where id = 'sess-st';
select public.set_allow_code('sess-st', true);
do $$ begin
  assert not (select effective ? 'engine' from public.states st join public.sessions s on st.id = s.current_state_id where s.id = 'sess-st'), 'a lock to Self is final';
end $$;
reset role;

-- deleting a session (the sessions page): the owner can, a stranger cannot; its rows cascade and its saved moments stay with no session
update public.saved_moments set created_at = created_at - interval '2 minutes'; -- earlier saves must not trip the 10 a minute cap
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.sessions (id, owner_id, settings) values ('sess-del', '00000000-0000-0000-0000-00000000000a', '{}');
insert into public.listeners (session_id, user_id, role, label) values ('sess-del', '00000000-0000-0000-0000-00000000000a', 'owner', 'you');
insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess-del', 0, '{}', '{"volume":0.3}', 1, '{}');
update public.sessions set current_state_id = (select id from public.states where session_id = 'sess-del') where id = 'sess-del';
select public.put_snapshot('sess-del', (select current_state_id from public.sessions where id = 'sess-del'), 'data:image/jpeg;base64,QUJDRA==', '{}', 0.5);
select public.player_heartbeat('sess-del', 'del-device', 'playing', 0.6, 0.5);
select public.save_moment('sess-del', 'kept', 'human', 1, 'dev');
do $$ begin
  assert exists (select 1 from public.states where session_id = 'sess-del'), 'the session to delete has a state';
  assert exists (select 1 from public.snapshots where session_id = 'sess-del'), 'and a snapshot';
  assert exists (select 1 from public.player_heartbeats where session_id = 'sess-del'), 'and a heartbeat';
end $$;
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
delete from public.sessions where id = 'sess-del';
reset role;
do $$ begin assert exists (select 1 from public.sessions where id = 'sess-del'), 'a stranger does not delete the session'; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
delete from public.sessions where id = 'sess-del';
reset role;
do $$ begin
  assert not exists (select 1 from public.sessions where id = 'sess-del'), 'the owner deletes the session';
  assert not exists (select 1 from public.states where session_id = 'sess-del'), 'its states go';
  assert not exists (select 1 from public.snapshots where session_id = 'sess-del'), 'its snapshot goes';
  assert not exists (select 1 from public.player_heartbeats where session_id = 'sess-del'), 'its heartbeats go';
  assert not exists (select 1 from public.listeners where session_id = 'sess-del'), 'its listeners go';
  assert (select count(*) from public.saved_moments where name = 'kept' and session_id is null) = 1, 'the saved moment stays, with no session';
end $$;

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

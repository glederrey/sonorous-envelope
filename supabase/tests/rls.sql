-- Row Level Security and join_session checks. Runs after stub.sql and all migrations.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', null);

create function pg_temp.as_user(uid text, anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'is_anonymous', anon)::text, false);
end $$;
grant execute on function pg_temp.as_user(text, boolean) to public;

-- owner A creates a session, an owner listener row and a state
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
insert into public.sessions (id, owner_id, settings) values ('sess1', '00000000-0000-0000-0000-00000000000a', '{}');
insert into public.listeners (session_id, user_id, role, label) values ('sess1', '00000000-0000-0000-0000-00000000000a', 'owner', 'you');
insert into public.states (session_id, turn, intent, effective, seed, slow_mood) values ('sess1', 0, '{}', '{}', 1, '{"joy":0.5}');
do $$ begin assert (select count(*) from public.states) = 1, 'owner sees own state'; end $$;
reset role;

-- B is not a member: sees nothing
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.sessions) = 0, 'stranger must not see sessions';
  assert (select count(*) from public.states) = 0, 'stranger must not see states';
end $$;
reset role;

-- anonymous C: cannot create a session, can join, can read, cannot write states
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c', true);
set role authenticated;
do $$ begin
  begin
    insert into public.sessions (id, owner_id, settings) values ('sess2', '00000000-0000-0000-0000-00000000000c', '{}');
    raise exception 'anonymous user created a session';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  assert (select count(*) from public.states) = 0, 'not yet a member';
  perform public.join_session('sess1');
  perform public.join_session('sess1'); -- idempotent
  assert (select count(*) from public.states) = 1, 'member reads states';
  assert (select count(*) from public.listeners where session_id = 'sess1') = 2, 'one row per listener';
  assert (select label from public.listeners where user_id = '00000000-0000-0000-0000-00000000000c') = 'listener 2', 'label';
  begin
    insert into public.states (session_id, turn, intent, effective, seed) values ('sess1', 1, '{}', '{}', 2);
    raise exception 'listener wrote a state';
  exception when insufficient_privilege then null; end;
  insert into public.player_heartbeats (session_id, user_id, device_id, audio, volume, delay)
  values ('sess1', '00000000-0000-0000-0000-00000000000c', 'dev1', 'playing', 0.5, 0.5);
  begin
    perform public.join_session('nope');
    raise exception 'joined a missing session';
  exception when raise_exception then
    if sqlerrm not like 'session not found%' then raise; end if;
  end;
end $$;
reset role;

-- ended sessions cannot be joined; anon role cannot call join_session
update public.sessions set ended_at = now() where id = 'sess1';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  begin perform public.join_session('sess1'); raise exception 'joined an ended session';
  exception when raise_exception then if sqlerrm not like 'session not found%' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.join_session('sess1'); raise exception 'anon role called join_session';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'rls ok' as result;

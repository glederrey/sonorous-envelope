-- The two faces of the sonorous envelope (Anzieu): 'internal' is how the model feels (the default), 'external' is sound it
-- makes for the listener. `mode` is the face playing now; `mode_policy` is the owner's choice: 'auto' lets the model
-- switch (with rules, enforced in the service), 'internal' or 'external' locks it. Old rows said inner/outer.
alter table public.sessions drop constraint if exists sessions_mode_check;
update public.sessions set mode = case mode when 'outer' then 'external' else 'internal' end;
alter table public.sessions alter column mode set default 'internal';
alter table public.sessions add constraint sessions_mode_check check (mode in ('internal', 'external'));
alter table public.sessions add column mode_policy text not null default 'auto' check (mode_policy in ('auto', 'internal', 'external'));

-- every change of face or policy, for `inspect`: who did it and at which turn
create table public.mode_changes (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  turn       int not null default 0,
  to_mode    text not null check (to_mode in ('internal', 'external', 'auto')),
  by         text not null check (by in ('model', 'owner'))
);
create index mode_changes_session on public.mode_changes (session_id, created_at desc);
alter table public.mode_changes enable row level security;
create policy mode_changes_member_select on public.mode_changes for select using (public.is_session_member(session_id));
create policy mode_changes_owner_insert on public.mode_changes for insert with check (public.is_session_owner(session_id));
grant select, insert on public.mode_changes to authenticated;

-- the owner picks auto, internal or external from the player; a lock also sets the face playing
create or replace function public.set_mode_policy(p_session text, p_policy text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if p_policy not in ('auto', 'internal', 'external') then raise exception 'bad policy'; end if;
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change the mode'; end if;
  select mode into cur from public.sessions where id = p_session;
  update public.sessions set mode_policy = p_policy, mode = case when p_policy = 'auto' then mode else p_policy end where id = p_session;
  insert into public.mode_changes (session_id, turn, to_mode, by)
  values (p_session, coalesce((select turn from public.sessions where id = p_session), 0), p_policy, 'owner');
end $$;
revoke execute on function public.set_mode_policy(text, text) from public;
grant  execute on function public.set_mode_policy(text, text) to authenticated;

-- the player also needs the face and the policy
create or replace function public.get_player_state(p_session text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ended', s.ended_at is not null,
    'now', now(),
    'settings', s.settings,
    'mode', s.mode,
    'mode_policy', s.mode_policy,
    'state', case when st.id is null then null else jsonb_build_object(
      'effective', st.effective, 'seed', st.seed, 'turn', st.turn, 'final', st.final, 'created_at', st.created_at) end)
  from public.sessions s
  left join public.states st on st.id = s.current_state_id
  where s.id = p_session;
$$;

-- wake the players when the face or the policy changes too
drop trigger if exists sessions_broadcast on public.sessions;
create trigger sessions_broadcast after update on public.sessions
  for each row when (old.ended_at is distinct from new.ended_at or old.settings is distinct from new.settings
                     or old.mode is distinct from new.mode or old.mode_policy is distinct from new.mode_policy)
  execute function public.broadcast_session();

grant all on public.mode_changes to service_role;

-- Strudel (roadmap #18): the model may send Strudel code on the external face; the listener's browser runs it in a sandboxed frame.
-- `allow_code` is the owner's switch (on by default). `pattern_reports` is what the owner's player says about the code it ran
-- (an error, how many events per cycle), so the model can read it: only the session owner's device may write one, because the text
-- reaches the model's context.
alter table public.sessions add column allow_code boolean not null default true;

create table public.pattern_reports (
  state_id         uuid primary key references public.states(id) on delete cascade,
  session_id       text not null references public.sessions(id) on delete cascade,
  ok               boolean not null,
  error            text,
  events_per_cycle numeric,
  notes            jsonb not null default '[]'::jsonb,
  reported_at      timestamptz not null default now()
);
alter table public.pattern_reports enable row level security;
create policy pattern_reports_owner_select on public.pattern_reports for select using (public.is_session_owner(session_id));
grant select on public.pattern_reports to authenticated;
grant all on public.pattern_reports to service_role;

-- the owner's player reports once per state: the first report wins, the text is capped
create or replace function public.report_pattern(p_state uuid, p_ok boolean, p_error text, p_events numeric, p_notes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_session text;
begin
  select session_id into v_session from public.states where id = p_state;
  if v_session is null or not public.is_session_owner(v_session) then raise exception 'only the session owner can report a pattern'; end if;
  insert into public.pattern_reports (state_id, session_id, ok, error, events_per_cycle, notes)
  values (p_state, v_session, p_ok, left(p_error, 200), p_events,
          case when jsonb_typeof(p_notes) = 'array' and jsonb_array_length(p_notes) <= 8 then p_notes else '[]'::jsonb end)
  on conflict (state_id) do nothing;
end $$;
revoke execute on function public.report_pattern(uuid, boolean, text, numeric, jsonb) from public;
grant  execute on function public.report_pattern(uuid, boolean, text, numeric, jsonb) to authenticated;

create or replace function public.set_allow_code(p_session text, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change this'; end if;
  update public.sessions set allow_code = p_allow where id = p_session;
end $$;
revoke execute on function public.set_allow_code(text, boolean) from public;
grant  execute on function public.set_allow_code(text, boolean) to authenticated;

-- the player also needs the owner's switch
create or replace function public.get_player_state(p_session text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ended', s.ended_at is not null,
    'now', now(),
    'settings', s.settings,
    'mode', s.mode,
    'mode_policy', s.mode_policy,
    'allow_code', s.allow_code,
    'state', case when st.id is null then null else jsonb_build_object(
      'id', st.id, 'effective', st.effective, 'seed', st.seed, 'turn', st.turn, 'final', st.final, 'created_at', st.created_at) end)
  from public.sessions s
  left join public.states st on st.id = s.current_state_id
  where s.id = p_session;
$$;

-- wake the players when the owner's switch changes too
drop trigger if exists sessions_broadcast on public.sessions;
create trigger sessions_broadcast after update on public.sessions
  for each row when (old.ended_at is distinct from new.ended_at or old.settings is distinct from new.settings
                     or old.mode is distinct from new.mode or old.mode_policy is distinct from new.mode_policy
                     or old.allow_code is distinct from new.allow_code)
  execute function public.broadcast_session();

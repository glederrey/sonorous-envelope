-- Allow Strudel off, then on again, brings the pattern back (v0.23.2 and v0.23.3 reports). The player already plays it again when nothing
-- new came from the model; the server now agrees: turning code off keeps what it strips from the current state (engine, pattern, volume)
-- in intent.stopped_pattern, and turning it on again puts them back while the mode is a listener one. A mode lock to Self is final: it
-- drops what was kept, so allowing code later does not bring the pattern back. A new state from the model replaces the row, so nothing
-- old comes back after it.
drop function if exists public.stop_pattern(text, boolean);
create or replace function public.stop_pattern(p_session text, p_silent boolean default false, p_by_code boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare cur uuid;
begin
  select current_state_id into cur from public.sessions where id = p_session;
  -- SET expressions read the row as it was, so stopped_pattern holds the fields before they are stripped
  update public.states
  set effective = (effective - 'engine' - 'pattern') || case when p_silent then '{"volume": 0}'::jsonb else '{}'::jsonb end,
      intent = (intent - 'stopped_pattern') || '{"owner_stopped_pattern": true}'::jsonb
               || case when p_by_code then jsonb_build_object('stopped_pattern',
                    jsonb_build_object('engine', effective->'engine', 'pattern', effective->'pattern', 'volume', effective->'volume'))
                  else '{}'::jsonb end
  where id = cur and effective ? 'engine';
  -- a stop that is not the code switch (a mode lock) is final, also over an earlier stop by the code switch
  if not p_by_code then
    update public.states set intent = intent - 'stopped_pattern' where id = cur and intent ? 'stopped_pattern';
  end if;
end $$;
revoke execute on function public.stop_pattern(text, boolean, boolean) from public;

create or replace function public.set_allow_code(p_session text, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change this'; end if;
  update public.sessions set allow_code = p_allow where id = p_session;
  if not p_allow then
    perform public.stop_pattern(p_session, true, true);
  else
    update public.states st
    set effective = st.effective || (st.intent->'stopped_pattern'),
        intent = st.intent - 'stopped_pattern' - 'owner_stopped_pattern'
    from public.sessions s
    where s.id = p_session and st.id = s.current_state_id and s.mode in ('external', 'sandbox') and st.intent ? 'stopped_pattern';
  end if;
end $$;
revoke execute on function public.set_allow_code(text, boolean) from public;
grant  execute on function public.set_allow_code(text, boolean) to authenticated;

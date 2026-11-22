-- Revert 0029: the stop functions as in 0014 (code off strips the pattern for good).
drop function if exists public.stop_pattern(text, boolean, boolean);
create or replace function public.stop_pattern(p_session text, p_silent boolean default false)
returns void language sql security definer set search_path = public as $$
  update public.states
  set effective = (effective - 'engine' - 'pattern') || case when p_silent then '{"volume": 0}'::jsonb else '{}'::jsonb end,
      intent = intent || '{"owner_stopped_pattern": true}'::jsonb
  where id = (select current_state_id from public.sessions where id = p_session) and effective ? 'engine';
$$;
revoke execute on function public.stop_pattern(text, boolean) from public;

create or replace function public.set_allow_code(p_session text, p_allow boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change this'; end if;
  update public.sessions set allow_code = p_allow where id = p_session;
  if not p_allow then perform public.stop_pattern(p_session, true); end if;
end $$;
revoke execute on function public.set_allow_code(text, boolean) from public;
grant  execute on function public.set_allow_code(text, boolean) to authenticated;

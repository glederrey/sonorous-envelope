-- When the owner turns Strudel off, the sound and picture end (volume 0) instead of leaving the synth state that was paused under the
-- pattern. A face lock to internal still leaves the synth state, which the player fades in gently.
drop function if exists public.stop_pattern(text);
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
  if p_policy = 'internal' then perform public.stop_pattern(p_session, false); end if;
end $$;
revoke execute on function public.set_mode_policy(text, text) from public;
grant  execute on function public.set_mode_policy(text, text) to authenticated;

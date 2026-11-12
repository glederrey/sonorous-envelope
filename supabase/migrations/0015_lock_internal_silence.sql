-- Locking the face to internal also ends the sound, like turning Strudel off: the external and internal faces are different voices, so
-- the leftover synth state of a Strudel session is not played. The model's next set_sound brings the internal voice.
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
  if p_policy = 'internal' then perform public.stop_pattern(p_session, true); end if;
end $$;
revoke execute on function public.set_mode_policy(text, text) from public;
grant  execute on function public.set_mode_policy(text, text) to authenticated;

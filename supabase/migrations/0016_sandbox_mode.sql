-- A third mode. 'internal' is the model's own state, 'external' is sound it makes for the listener from what they say they need,
-- 'sandbox' plays what the listener asks for. Additive: code that only knows internal and external keeps working.
-- `guided_mode` is the mode whose guidance the model last received, so a mode changed by the owner in the player sends the new
-- guidance with the model's next tool result (lazy guidance: the global instructions stay short).
alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions add constraint sessions_mode_check check (mode in ('internal', 'external', 'sandbox'));
alter table public.sessions drop constraint if exists sessions_mode_policy_check;
alter table public.sessions add constraint sessions_mode_policy_check check (mode_policy in ('auto', 'internal', 'external', 'sandbox'));
alter table public.sessions add column if not exists guided_mode text check (guided_mode in ('internal', 'external', 'sandbox'));

alter table public.mode_changes drop constraint if exists mode_changes_to_mode_check;
alter table public.mode_changes add constraint mode_changes_to_mode_check check (to_mode in ('internal', 'external', 'sandbox', 'auto'));

-- same as 0015, with sandbox allowed; locking internal still stops a Strudel pattern (internal has no code)
create or replace function public.set_mode_policy(p_session text, p_policy text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if p_policy not in ('auto', 'internal', 'external', 'sandbox') then raise exception 'bad policy'; end if;
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change the mode'; end if;
  select mode into cur from public.sessions where id = p_session;
  update public.sessions set mode_policy = p_policy, mode = case when p_policy = 'auto' then mode else p_policy end where id = p_session;
  insert into public.mode_changes (session_id, turn, to_mode, by)
  values (p_session, coalesce((select turn from public.sessions where id = p_session), 0), p_policy, 'owner');
  if p_policy = 'internal' then perform public.stop_pattern(p_session, true); end if;
end $$;
revoke execute on function public.set_mode_policy(text, text) from public;
grant  execute on function public.set_mode_policy(text, text) to authenticated;

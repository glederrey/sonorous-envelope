-- Locking Self from Attuned or Jukebox also silences the synth state that was made for the listener: the mood played for them must not
-- go on sounding as the model's own state. A silent copy of it becomes the current state (3 s fade). It is marked (`owner_silenced`) so the model's next set_sound starts from its own mood and
-- the level-step limit sees the sound as silent. A Strudel state is handled by stop_pattern, as in 0016.
create or replace function public.set_mode_policy(p_session text, p_policy text)
returns void language plpgsql security definer set search_path = public as $$
declare cur text; new_state uuid; was_pattern boolean;
begin
  if p_policy not in ('auto', 'internal', 'external', 'sandbox') then raise exception 'bad policy'; end if;
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can change the mode'; end if;
  select mode into cur from public.sessions where id = p_session;
  update public.sessions set mode_policy = p_policy, mode = case when p_policy = 'auto' then mode else p_policy end where id = p_session;
  insert into public.mode_changes (session_id, turn, to_mode, by)
  values (p_session, coalesce((select turn from public.sessions where id = p_session), 0), p_policy, 'owner');
  if p_policy = 'internal' then
    select coalesce(st.effective ? 'engine', false) into was_pattern from public.states st where st.id = (select current_state_id from public.sessions where id = p_session);
    perform public.stop_pattern(p_session, true);
    if cur in ('external', 'sandbox') and not coalesce(was_pattern, false) then
      -- a new state row, not an update in place: a connected player only applies states newer than the one it plays
      insert into public.states (session_id, turn, final, intent, effective, clamps, seed, slow_mood, created_at)
      select st.session_id, st.turn, true,
             jsonb_build_object('mood', st.intent->'mood', 'silence', true, 'owner_silenced', true),
             (st.effective - 'transition') || '{"volume": 0, "transition": {"time": 3, "curve": "smooth"}}'::jsonb,
             '[]'::jsonb, st.seed, st.slow_mood, now()
      from public.states st
      where st.id = (select current_state_id from public.sessions where id = p_session)
      returning id into new_state;
      if new_state is not null then
        update public.sessions set current_state_id = new_state, pending_final = false where id = p_session;
      end if;
    end if;
  end if;
end $$;
revoke execute on function public.set_mode_policy(text, text) from public;
grant  execute on function public.set_mode_policy(text, text) to authenticated;

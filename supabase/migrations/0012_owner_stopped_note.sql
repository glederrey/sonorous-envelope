-- Remember that the owner (not the model) ended the pattern, so get_feedback can say so even after the owner allows Strudel again.
create or replace function public.stop_pattern(p_session text)
returns void language sql security definer set search_path = public as $$
  update public.states
  set effective = effective - 'engine' - 'pattern', intent = intent || '{"owner_stopped_pattern": true}'::jsonb
  where id = (select current_state_id from public.sessions where id = p_session) and effective ? 'engine';
$$;
revoke execute on function public.stop_pattern(text) from public;

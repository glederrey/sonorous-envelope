-- The player needs the server's clock to fade the sound after rest_after seconds without an update
-- (player-ui.md, "Presence between turns"): it compares 'now' with its own clock once and keeps the offset.
create or replace function public.get_player_state(p_session text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ended', s.ended_at is not null,
    'now', now(),
    'settings', s.settings,
    'state', case when st.id is null then null else jsonb_build_object(
      'effective', st.effective, 'seed', st.seed, 'turn', st.turn, 'final', st.final, 'created_at', st.created_at) end)
  from public.sessions s
  left join public.states st on st.id = s.current_state_id
  where s.id = p_session;
$$;

-- Undoes 0019_listening.sql: restores get_player_state (0010), player_poll (0013) and the broadcast trigger (0010), then drops the column.
-- Not run by anything on its own. Run it by hand, once, against the database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/revert/0019_listening.down.sql
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

create or replace function public.player_poll(p_session text, p_known text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v text; whole jsonb;
begin
  select md5(concat_ws('|', s.ended_at::text, s.settings::text, s.mode, s.mode_policy, s.allow_code::text, st.id::text, st.effective::text))
    into v
  from public.sessions s left join public.states st on st.id = s.current_state_id
  where s.id = p_session;
  if v is null then return null; end if;
  if p_known is not null and p_known = v then
    return jsonb_build_object('same', true, 'now', now(), 'v', v);
  end if;
  whole := public.get_player_state(p_session);
  return whole || jsonb_build_object('v', v);
end $$;
revoke execute on function public.player_poll(text, text) from public;
grant  execute on function public.player_poll(text, text) to anon, authenticated, service_role;

drop trigger if exists sessions_broadcast on public.sessions;
create trigger sessions_broadcast after update on public.sessions
  for each row when (old.ended_at is distinct from new.ended_at or old.settings is distinct from new.settings
                     or old.mode is distinct from new.mode or old.mode_policy is distinct from new.mode_policy
                     or old.allow_code is distinct from new.allow_code)
  execute function public.broadcast_session();

alter table public.sessions drop column if exists listening_until;

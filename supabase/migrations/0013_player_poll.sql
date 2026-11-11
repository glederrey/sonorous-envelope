-- A cheap poll for the player: it sends the version of the state it already has. When nothing changed the answer is a few bytes
-- (`same`, the server's clock and the version); otherwise it is the full get_player_state answer plus the new version. The version
-- covers everything the player reads: the state (including a pattern the owner stopped), the face, the policy, the owner's code
-- switch, the settings and whether the session ended.
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

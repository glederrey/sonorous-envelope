-- Revert 0031: the search_path settings, the policies with a bare auth.uid() and no extra indexes.
alter function public.check_reaction_kind() reset search_path;
alter function public.touch_heartbeat() reset search_path;

alter policy profiles_self_select on public.profiles using (id = auth.uid());
alter policy profiles_self_update on public.profiles using (id = auth.uid());
alter policy sessions_member_select on public.sessions using (owner_id = auth.uid() or public.is_session_member(id));
alter policy sessions_owner_insert on public.sessions with check (owner_id = auth.uid());
alter policy sessions_owner_update on public.sessions using (owner_id = auth.uid());
alter policy sessions_owner_delete on public.sessions using (owner_id = auth.uid());
alter policy listeners_owner_delete on public.listeners using (public.is_session_owner(session_id) or user_id = auth.uid());
alter policy reactions_member_insert on public.reactions with check (user_id = auth.uid() and public.is_session_member(session_id));
alter policy hb_member_insert on public.player_heartbeats with check (user_id = auth.uid() and public.is_session_member(session_id));
alter policy hb_member_update on public.player_heartbeats using (user_id = auth.uid());
alter policy saved_moments_select on public.saved_moments using (owner_id = auth.uid());
alter policy saved_moments_update on public.saved_moments using (owner_id = auth.uid()) with check (owner_id = auth.uid());
alter policy saved_moments_delete on public.saved_moments using (owner_id = auth.uid());
alter policy emoji_reactions_select on public.emoji_reactions
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));
alter policy emoji_reactions_update on public.emoji_reactions
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));

drop index if exists public.listeners_user_id;
drop index if exists public.pattern_reports_session_id;
drop index if exists public.player_heartbeats_user_id;
drop index if exists public.reactions_user_id;
drop index if exists public.sessions_current_state_id;
drop index if exists public.snapshots_state_id;

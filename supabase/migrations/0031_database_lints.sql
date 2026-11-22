-- The Supabase advisors' lints, no change in behaviour (#177).
-- 0011 function_search_path_mutable: the two trigger functions that did not pin their search_path.
alter function public.check_reaction_kind() set search_path = public;
alter function public.touch_heartbeat() set search_path = public;

-- 0003 auth_rls_initplan: (select auth.uid()) is evaluated once per query, not once per row. Each policy keeps its latest definition,
-- with only auth.uid() wrapped.
alter policy profiles_self_select on public.profiles using (id = (select auth.uid()));
alter policy profiles_self_update on public.profiles using (id = (select auth.uid()));
alter policy sessions_member_select on public.sessions using (owner_id = (select auth.uid()) or public.is_session_member(id));
alter policy sessions_owner_insert on public.sessions with check (owner_id = (select auth.uid()));
alter policy sessions_owner_update on public.sessions using (owner_id = (select auth.uid()));
alter policy sessions_owner_delete on public.sessions using (owner_id = (select auth.uid()));
alter policy listeners_owner_delete on public.listeners using (public.is_session_owner(session_id) or user_id = (select auth.uid()));
alter policy reactions_member_insert on public.reactions with check (user_id = (select auth.uid()) and public.is_session_member(session_id));
alter policy hb_member_insert on public.player_heartbeats with check (user_id = (select auth.uid()) and public.is_session_member(session_id));
alter policy hb_member_update on public.player_heartbeats using (user_id = (select auth.uid()));
alter policy saved_moments_select on public.saved_moments using (owner_id = (select auth.uid()));
alter policy saved_moments_update on public.saved_moments using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy saved_moments_delete on public.saved_moments using (owner_id = (select auth.uid()));
alter policy emoji_reactions_select on public.emoji_reactions
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid())));
alter policy emoji_reactions_update on public.emoji_reactions
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid())));

-- 0001 unindexed_foreign_keys: account and session deletion cascade through these.
create index if not exists listeners_user_id on public.listeners (user_id);
create index if not exists pattern_reports_session_id on public.pattern_reports (session_id);
create index if not exists player_heartbeats_user_id on public.player_heartbeats (user_id);
create index if not exists reactions_user_id on public.reactions (user_id);
create index if not exists sessions_current_state_id on public.sessions (current_state_id);
create index if not exists snapshots_state_id on public.snapshots (state_id);

-- Delete the caller's own account. Every table that holds a user's data references auth.users on delete cascade
-- (profiles, sessions -> states/reactions/..., listeners, player_heartbeats, dev_feedback_quota, and auth's own oauth consents/grants).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

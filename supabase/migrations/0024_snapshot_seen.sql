-- Snapshot seen (follows 0020): the owner can see what the model actually looked at. The live `image` is replaced every 30 s, so when the
-- model asks for it with inspect("snapshot"), the server marks the row seen: `seen_image` is a copy of the image it was given and
-- `seen_at` is when. Only the session owner can mark it (the model works with the owner's token); the owner's select policy already covers both columns.
alter table public.snapshots add column if not exists seen_at timestamptz, add column if not exists seen_image text;

create or replace function public.mark_snapshot_seen(p_session text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can mark a snapshot seen'; end if;
  update public.snapshots set seen_at = now(), seen_image = image where session_id = p_session;
end $$;
revoke execute on function public.mark_snapshot_seen(text) from public, anon;
grant  execute on function public.mark_snapshot_seen(text) to authenticated;

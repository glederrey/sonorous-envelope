-- Guest emoji reactions (#152): anyone listening who is not the owner (a link with no account, or a signed-in stranger) can press an emoji
-- that conveys how it feels. The owner's player floats them over the picture and the AI gets counts, labelled as guests. They live apart from
-- `reactions`: claim_reactions never sees them, and they never reach `heard`. Only send_emoji writes a row, and it holds the rate limits.
create table public.emoji_reactions (
  id           bigint generated always as identity primary key,
  session_id   text not null references public.sessions(id) on delete cascade,
  device_id    text not null check (char_length(device_id) between 4 and 40),
  -- keys, not glyphs. The same list as GUEST_EMOJIS in packages/shared/src/emojis.ts: change both together.
  emoji        text not null check (emoji in ('thumbs_up', 'thumbs_down', 'heart', 'happy', 'unhappy', 'sad', 'crying')),
  created_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index emoji_reactions_session on public.emoji_reactions (session_id, id);
create index emoji_reactions_device on public.emoji_reactions (session_id, device_id, created_at);
alter table public.emoji_reactions enable row level security;
-- only the session's owner reads them, and marks them delivered (the column grant below allows nothing else). No insert or delete: only send_emoji writes.
create policy emoji_reactions_select on public.emoji_reactions for select
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));
create policy emoji_reactions_update on public.emoji_reactions for update
  using (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid()));
revoke all on public.emoji_reactions from public, anon, authenticated;
grant select on public.emoji_reactions to authenticated;
grant update (delivered_at) on public.emoji_reactions to authenticated;
grant all on public.emoji_reactions to service_role;

-- A listener presses an emoji. Returns {ok: true}, or {ok: false, reason: 'slow_down'} over a cap (nothing is stored): one press per 2 s and
-- 10 per minute for a device, 60 per minute for the whole session. Raises for a bad emoji or device id, or a session that is missing or ended.
create or replace function public.send_emoji(p_session text, p_device text, p_emoji text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_emoji is null or p_emoji not in ('thumbs_up', 'thumbs_down', 'heart', 'happy', 'unhappy', 'sad', 'crying') then raise exception 'bad emoji'; end if;
  if p_device is null or length(p_device) not between 4 and 40 then raise exception 'bad device id'; end if;
  if not exists (select 1 from public.sessions where id = p_session and ended_at is null) then
    raise exception 'session not found or ended';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session, 28)); -- one press at a time per session, so the caps below hold
  if exists (select 1 from public.emoji_reactions where session_id = p_session and device_id = p_device and created_at > now() - interval '2 seconds')
     or (select count(*) from public.emoji_reactions where session_id = p_session and device_id = p_device and created_at > now() - interval '1 minute') >= 10
     or (select count(*) from public.emoji_reactions where session_id = p_session and created_at > now() - interval '1 minute') >= 60 then
    return jsonb_build_object('ok', false, 'reason', 'slow_down');
  end if;
  delete from public.emoji_reactions where session_id = p_session and created_at < now() - interval '1 day';
  insert into public.emoji_reactions (session_id, device_id, emoji) values (p_session, p_device, p_emoji);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.send_emoji(text, text, text) from public;
grant execute on function public.send_emoji(text, text, text) to anon, authenticated, service_role;

-- Wake the owner's player with the emoji key only, never the device id. Like broadcast_state: a hint on a public channel, so a forged one
-- can only float a glyph.
create or replace function public.broadcast_emoji()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('emoji', new.emoji), 'emoji', 'player:' || new.session_id, false);
  return new;
end $$;
create trigger emoji_reactions_broadcast after insert on public.emoji_reactions
  for each row execute function public.broadcast_emoji();
revoke execute on function public.broadcast_emoji() from public, anon, authenticated;

-- Claim the pending emojis atomically (called by the MCP endpoint with the owner's token). Security invoker: RLS lets only the owner see
-- or update them, so anyone else gets nothing.
create or replace function public.claim_emojis(p_session text)
returns table (emoji text, created_at timestamptz) language plpgsql security invoker set search_path = public as $$
begin
  return query
  update public.emoji_reactions e set delivered_at = now()
  where e.id in (
    select r.id from public.emoji_reactions r
    where r.session_id = p_session and r.delivered_at is null
    order by r.id
    for update skip locked
  )
  returning e.emoji, e.created_at;
end $$;
revoke execute on function public.claim_emojis(text) from public, anon;
grant execute on function public.claim_emojis(text) to authenticated, service_role;

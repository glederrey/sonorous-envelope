-- Snapshots (roadmap step 10): what the owner's player shows and plays, for the model to look at with inspect("snapshot").
-- One row per session, replaced on every capture: a small JPEG (the picture on top, a spectrogram of the last ~8 s of the
-- player's output below) and a few numbers measured from that output. Only the session owner's device may write one, because
-- the image and the numbers reach the model's context; only the owner may read it (link listeners never see it).
create table public.snapshots (
  session_id  text primary key references public.sessions(id) on delete cascade,
  state_id    uuid references public.states(id) on delete set null,
  image       text not null,                       -- data URL, image/jpeg
  measured    jsonb not null default '{}'::jsonb,  -- loudness_db, centroid_hz, brightness, onsets_per_s, quiet_share, seconds
  volume      real,                                -- the owner's player volume when it was taken (the sound was measured after it)
  taken_at    timestamptz not null default now()
);
alter table public.snapshots enable row level security;
create policy snapshots_owner_select on public.snapshots for select using (public.is_session_owner(session_id));
grant select on public.snapshots to authenticated;
grant all on public.snapshots to service_role;

-- the owner's player writes through this: the image is capped (about 250 kB of base64) and must be a JPEG data URL,
-- `measured` must be a small object, and an ended session takes no more snapshots
create or replace function public.put_snapshot(p_session text, p_state uuid, p_image text, p_measured jsonb, p_volume real)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_session_owner(p_session) then raise exception 'only the session owner can save a snapshot'; end if;
  if exists (select 1 from public.sessions where id = p_session and ended_at is not null) then return; end if;
  if p_image is null or left(p_image, 23) <> 'data:image/jpeg;base64,' or length(p_image) > 350000 then raise exception 'snapshot image must be a small JPEG'; end if;
  if p_state is not null and not exists (select 1 from public.states where id = p_state and session_id = p_session) then raise exception 'unknown state'; end if;
  insert into public.snapshots (session_id, state_id, image, measured, volume, taken_at)
  values (p_session, p_state, p_image,
          case when jsonb_typeof(p_measured) = 'object' and length(p_measured::text) <= 1000 then p_measured else '{}'::jsonb end,
          p_volume, now())
  on conflict (session_id) do update set state_id = excluded.state_id, image = excluded.image, measured = excluded.measured,
                                         volume = excluded.volume, taken_at = excluded.taken_at;
end $$;
revoke execute on function public.put_snapshot(text, uuid, text, jsonb, real) from public;
grant  execute on function public.put_snapshot(text, uuid, text, jsonb, real) to authenticated;

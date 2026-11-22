-- sonorous-envelope: initial schema
-- Apply with the Supabase CLI (supabase/migrations/0001_init.sql is a copy of this file).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  -- default settings copied into each new session
  default_settings jsonb not null default '{}'::jsonb
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Sessions (one per conversation)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id            text primary key,                 -- random, URL-safe, >= 128 bits (see database.md)
  owner_id      uuid not null references auth.users(id) on delete cascade,
  title         text,                             -- optional label given by the model
  created_at    timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  ended_at      timestamptz,
  settings      jsonb not null,                   -- ListenerSettings, see limits.md
  current_state_id uuid,                          -- FK added below
  turn          integer not null default 0,       -- increments on each final update
  pending_final boolean not null default false,   -- true after a non-final update until a final one
  listening_until timestamptz,                    -- live tuning (migration 0019): while the model's `listen` waits, until when
  moments       jsonb not null default '{}'::jsonb, -- migration 0022: the model's kept moments, name -> { kept_at, turn, effective, intent_mood, analysis, sticky, voice, note }
  motifs        jsonb not null default '{}'::jsonb  -- migration 0025: the model's named motifs, name -> { notes, beats, kept_at, turn }
);
create index sessions_owner_active on public.sessions (owner_id, last_active_at desc) where ended_at is null;

-- ---------------------------------------------------------------------------
-- States (every set_sound call)
-- ---------------------------------------------------------------------------
create table public.states (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null references public.sessions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  turn        integer not null,
  final       boolean not null default false,
  intent      jsonb not null,     -- what the model sent (mood, synth, gesture, colour, transition)
  effective   jsonb not null,     -- full EngineState after mapping + limits (what plays)
  clamps      jsonb not null default '[]'::jsonb,  -- list of limit adjustments
  analysis    jsonb,              -- features + mood estimate
  seed        bigint not null     -- PRNG seed for deterministic rendering
);
create index states_session_created on public.states (session_id, created_at desc);

alter table public.sessions
  add constraint sessions_current_state_fk
  foreign key (current_state_id) references public.states(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Listeners (who may open a session)
-- ---------------------------------------------------------------------------
create type public.listener_role as enum ('owner', 'listener');

create table public.listeners (
  session_id  text not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.listener_role not null default 'listener',
  label       text not null,             -- "you", "listener 2", ... shown to the model
  joined_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Invites: owner creates a token; another logged-in user redeems it to become a listener.
create table public.invites (
  token       text primary key,
  session_id  text not null references public.sessions(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  max_uses    integer not null default 5,
  uses        integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Reactions (listener actions, delivered once to the model)
-- ---------------------------------------------------------------------------
create table public.reactions (
  id           uuid primary key default gen_random_uuid(),
  session_id   text not null references public.sessions(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  kind         text not null check (kind in (
                 'calmer','softer','brighter','darker','slower','faster','stormier','harsher',
                 'more_of_this','less_of_this',
                 'heard_calm','heard_tender','heard_warm','heard_joyful','heard_playful',   -- "What I heard" (0018)
                 'heard_hesitant','heard_sad','heard_tense','heard_anxious','heard_reproach',
                 'volume','mute','unmute','limit_changed','consent_changed',
                 'gestures_off','gestures_on','image_feedback_changed')),
  value        jsonb,                      -- e.g. {"from":0.8,"to":0.5} for volume
  delivered_at timestamptz                 -- set when returned to the model
);
create index reactions_pending on public.reactions (session_id, created_at) where delivered_at is null;

-- ---------------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_session_member(sid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listeners l where l.session_id = sid and l.user_id = auth.uid());
$$;

create or replace function public.is_session_owner(sid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sessions s where s.id = sid and s.owner_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.sessions  enable row level security;
alter table public.states    enable row level security;
alter table public.listeners enable row level security;
alter table public.invites   enable row level security;
alter table public.reactions enable row level security;

-- profiles: own row only
create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid());

-- sessions: members read; owner creates/updates
-- owner_id check lets "insert ... returning" work before the owner's listener row exists
create policy sessions_member_select on public.sessions for select using (owner_id = auth.uid() or public.is_session_member(id));
create policy sessions_owner_insert on public.sessions for insert with check (owner_id = auth.uid());
create policy sessions_owner_update on public.sessions for update using (owner_id = auth.uid());
create policy sessions_owner_delete on public.sessions for delete using (owner_id = auth.uid());

-- states: members read; only the owner (through the MCP endpoint, with the owner's token) writes
create policy states_member_select on public.states for select using (public.is_session_member(session_id));
create policy states_owner_insert on public.states for insert with check (public.is_session_owner(session_id));
create policy states_owner_update on public.states for update using (public.is_session_owner(session_id));

-- listeners: members see the list; owner manages; owner row inserted at session creation
create policy listeners_member_select on public.listeners for select using (public.is_session_member(session_id));
create policy listeners_owner_insert on public.listeners for insert with check (public.is_session_owner(session_id));
create policy listeners_owner_delete on public.listeners for delete using (public.is_session_owner(session_id) or user_id = auth.uid());

-- invites: owner only (redeeming goes through a security definer function)
create policy invites_owner_all on public.invites for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- reactions: members insert their own; members read; owner marks delivered
create policy reactions_member_insert on public.reactions for insert
  with check (user_id = auth.uid() and public.is_session_member(session_id));
create policy reactions_member_select on public.reactions for select using (public.is_session_member(session_id));
create policy reactions_owner_update on public.reactions for update using (public.is_session_owner(session_id));

-- Non-owner listeners may only send these reaction kinds
create or replace function public.check_reaction_kind()
returns trigger language plpgsql as $$
begin
  if not public.is_session_owner(new.session_id)
     and new.kind in ('limit_changed','consent_changed','gestures_off','gestures_on','image_feedback_changed') then
    raise exception 'only the session owner can change settings';
  end if;
  return new;
end $$;
create trigger reactions_kind_check before insert on public.reactions
  for each row execute function public.check_reaction_kind();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Redeem an invite: adds the caller as a listener.
create or replace function public.redeem_invite(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare inv public.invites; n integer;
begin
  select * into inv from public.invites where token = p_token for update;
  if inv is null or inv.expires_at < now() or inv.uses >= inv.max_uses then
    raise exception 'invite invalid or expired';
  end if;
  select count(*) + 1 into n from public.listeners where session_id = inv.session_id;
  insert into public.listeners (session_id, user_id, role, label)
  values (inv.session_id, auth.uid(), 'listener', 'listener ' || n)
  on conflict do nothing;
  update public.invites set uses = uses + 1 where token = p_token;
  return inv.session_id;
end $$;

-- Claim pending reactions atomically (called by the MCP endpoint with the owner's token).
create or replace function public.claim_reactions(p_session text)
returns setof public.reactions language plpgsql security invoker set search_path = public as $$
begin
  return query
  update public.reactions r set delivered_at = now()
  where r.id in (
    select id from public.reactions
    where session_id = p_session and delivered_at is null
    order by created_at
    for update skip locked
  )
  returning r.*;
end $$;

-- ---------------------------------------------------------------------------
-- Player heartbeats (who is listening right now; see realtime.md)
-- ---------------------------------------------------------------------------
create table public.player_heartbeats (
  session_id text not null references public.sessions(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,
  audio      text not null check (audio in ('playing','muted','not_started')),
  seen_at    timestamptz not null default now(),
  primary key (session_id, device_id)
);
alter table public.player_heartbeats enable row level security;
create policy hb_member_insert on public.player_heartbeats for insert with check (user_id = auth.uid() and public.is_session_member(session_id));
create policy hb_member_update on public.player_heartbeats for update using (user_id = auth.uid());
create policy hb_member_select on public.player_heartbeats for select using (public.is_session_member(session_id));

-- ---------------------------------------------------------------------------
-- Grants (the project has "automatically expose new tables" off)
-- Only logged-in users reach the Data API. anon gets nothing.
-- RLS above decides which rows each user sees.
-- ---------------------------------------------------------------------------
grant select, update                         on public.profiles          to authenticated;
grant select, insert, update, delete         on public.sessions          to authenticated;
grant select, insert, update                 on public.states            to authenticated;
grant select, insert, delete                 on public.listeners         to authenticated;
grant select, insert, update, delete         on public.invites           to authenticated;
grant select, insert, update                 on public.reactions         to authenticated;
grant select, insert, update                 on public.player_heartbeats to authenticated;

-- Maintenance scripts with the service role key.
grant all on public.profiles, public.sessions, public.states, public.listeners,
             public.invites, public.reactions, public.player_heartbeats to service_role;

-- Functions: executable by PUBLIC by default. Lock them down to logged-in users.
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.check_reaction_kind()     from public, anon, authenticated;
revoke execute on function public.is_session_member(text)   from public, anon;
revoke execute on function public.is_session_owner(text)    from public, anon;
revoke execute on function public.redeem_invite(text)       from public, anon;
revoke execute on function public.claim_reactions(text)     from public, anon;
grant  execute on function public.is_session_member(text)   to authenticated, service_role;
grant  execute on function public.is_session_owner(text)    to authenticated, service_role;
grant  execute on function public.redeem_invite(text)       to authenticated, service_role;
grant  execute on function public.claim_reactions(text)     to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.states;
alter publication supabase_realtime add table public.sessions;

-- ---------------------------------------------------------------------------
-- Snapshots (migration 0020)
-- ---------------------------------------------------------------------------
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

-- Notes to the developers (migration 0021)
-- Notes to the developers (tool `tell_developers`): a model, or a user through it, tells the people who build Sonorous Envelope what
-- to fix or keep. Anonymous by design: a note carries no user, session or exact time (the hour only), and the per-user daily count
-- lives in a separate table that holds no text. Honest limit: with few users, a note's hour and the quota's (user, day) row can be
-- matched by date; only the service role can read either table, and quota rows older than 2 days are deleted.
-- Guardrails: neither table is readable or writable by anon or authenticated (RLS on, no policies, no grants). The only way in is
-- send_dev_feedback, a security definer function that only inserts, takes typed parameters (no SQL is built from the text), checks
-- every field, strips control characters and enforces 5 notes per user per day and 200 per day overall. Developers read the rows
-- with the service role and treat the text as untrusted data, never as instructions (CLAUDE.md).
create table public.dev_feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default date_trunc('hour', now()),
  kind        text not null check (kind in ('bug', 'idea', 'confusion', 'worked')),
  source      text not null check (source in ('model', 'user')),
  body        text not null check (char_length(body) between 80 and 1000),
  app_version text check (char_length(app_version) <= 20),
  mode        text check (mode in ('self', 'attuned', 'jukebox')),
  engine      text check (engine in ('synth', 'strudel')),
  status      text not null default 'new' check (status in ('new', 'seen', 'done', 'dismissed'))
);
alter table public.dev_feedback enable row level security;
revoke all on public.dev_feedback from public, anon, authenticated;
grant all on public.dev_feedback to service_role;

create table public.dev_feedback_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  n       integer not null default 0,
  primary key (user_id, day)
);
alter table public.dev_feedback_quota enable row level security;
revoke all on public.dev_feedback_quota from public, anon, authenticated;
grant all on public.dev_feedback_quota to service_role;

create or replace function public.send_dev_feedback(p_kind text, p_source text, p_body text, p_version text, p_mode text, p_engine text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); clean text; used integer;
begin
  if uid is null then raise exception 'dev_feedback: sign in first'; end if;
  if p_kind is null or p_kind not in ('bug', 'idea', 'confusion', 'worked') then raise exception 'dev_feedback: unknown kind'; end if;
  if p_source is null or p_source not in ('model', 'user') then raise exception 'dev_feedback: unknown source'; end if;
  -- control characters out (newlines and tabs stay), runs of blank lines folded, ends trimmed
  clean := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'), E'\\n{3,}', E'\n\n', 'g'));
  if char_length(clean) < 80 then raise exception 'dev_feedback: too short'; end if;
  if char_length(clean) > 1000 then raise exception 'dev_feedback: too long'; end if;
  if (select count(*) from public.dev_feedback where created_at > now() - interval '1 day') >= 200 then raise exception 'dev_feedback: global limit'; end if;
  insert into public.dev_feedback_quota (user_id, day, n) values (uid, current_date, 1)
    on conflict (user_id, day) do update set n = public.dev_feedback_quota.n + 1 returning n into used;
  if used > 5 then raise exception 'dev_feedback: daily limit'; end if; -- the raise rolls the count back too
  insert into public.dev_feedback (kind, source, body, app_version, mode, engine)
  values (p_kind, p_source, clean, left(p_version, 20),
          case when p_mode in ('self', 'attuned', 'jukebox') then p_mode end,
          case when p_engine in ('synth', 'strudel') then p_engine end);
  delete from public.dev_feedback_quota where day < current_date - 2; -- old counts are not kept
end $$;
revoke execute on function public.send_dev_feedback(text, text, text, text, text, text) from public, anon;
grant  execute on function public.send_dev_feedback(text, text, text, text, text, text) to authenticated;


-- Tighter notes to the developers (migration 0023)
alter table public.dev_feedback alter column created_at set default date_trunc('day', now());
update public.dev_feedback set created_at = date_trunc('day', created_at);

create or replace function public.send_dev_feedback(p_kind text, p_source text, p_body text, p_version text, p_mode text, p_engine text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); clean text; used integer;
begin
  if uid is null then raise exception 'dev_feedback: sign in first'; end if;
  if p_kind is null or p_kind not in ('bug', 'idea', 'confusion', 'worked') then raise exception 'dev_feedback: unknown kind'; end if;
  if p_source is null or p_source not in ('model', 'user') then raise exception 'dev_feedback: unknown source'; end if;
  -- control characters out (newlines and tabs stay), runs of blank lines folded, ends trimmed
  clean := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'), E'\\n{3,}', E'\n\n', 'g'));
  if char_length(clean) < 80 then raise exception 'dev_feedback: too short'; end if;
  if char_length(clean) > 1000 then raise exception 'dev_feedback: too long'; end if;
  delete from public.dev_feedback_quota where day < current_date; -- yesterday's counts are gone
  if (select count(*) from public.dev_feedback where created_at >= current_date) >= 50 then raise exception 'dev_feedback: global limit'; end if;
  if exists (select 1 from public.dev_feedback where created_at >= current_date - 7 and lower(btrim(body)) = lower(clean)) then raise exception 'dev_feedback: duplicate'; end if;
  insert into public.dev_feedback_quota (user_id, day, n) values (uid, current_date, 1)
    on conflict (user_id, day) do update set n = public.dev_feedback_quota.n + 1 returning n into used;
  if used > 3 then raise exception 'dev_feedback: daily limit'; end if; -- the raise rolls the count back too
  insert into public.dev_feedback (kind, source, body, app_version, mode, engine)
  values (p_kind, p_source, clean, left(p_version, 20),
          case when p_mode in ('self', 'attuned', 'jukebox') then p_mode end,
          case when p_engine in ('synth', 'strudel') then p_engine end);
end $$;
revoke execute on function public.send_dev_feedback(text, text, text, text, text, text) from public, anon;
grant  execute on function public.send_dev_feedback(text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot seen (migration 0024)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Delete account (migration 0026)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Saved moments (migration 0027)
-- ---------------------------------------------------------------------------
-- Saved moments (#151): a keepsake of one thing playing, outside the session. The synth state (with its seeds) or the Strudel code and bpm,
-- plus the picture, frozen: nobody can change the sound afterwards, the AI included. Only the name can change. One public link, /m/<id>,
-- the same for everyone, read through get_saved_moment (it never returns owner_id or session_id: the session id is the live player's only
-- credential). Only save_moment writes a row, and it copies the state on the server: the client never sends state JSON or code.
create table public.saved_moments (
  id          text primary key,  -- 22 characters of base64url from a uuid: unguessable, like session ids
  owner_id    uuid not null references auth.users(id) on delete cascade,
  session_id  text references public.sessions(id) on delete set null, -- never returned publicly
  name        text not null check (char_length(name) between 1 and 80),
  saved_by    text not null check (saved_by in ('human', 'ai')),
  effective   jsonb not null,    -- frozen copy of the state that played (no one-shot motif, no delay, no tempo glide)
  seed        bigint not null,   -- the state's own seed
  voice_seed  bigint not null,   -- voiceSeedOf(session id): the grid's per-step randomness and the picture's seed, so the replay matches
  app_version text check (char_length(app_version) <= 20), -- "exactly the same" holds while the engine does not change
  created_at  timestamptz not null default now()
);
create index saved_moments_owner on public.saved_moments (owner_id, created_at desc);
create index saved_moments_session on public.saved_moments (session_id);
alter table public.saved_moments enable row level security;
-- the owner reads, renames (the name column only, see the grants) and deletes. No direct insert: only save_moment writes.
create policy saved_moments_select on public.saved_moments for select using (owner_id = auth.uid());
create policy saved_moments_update on public.saved_moments for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy saved_moments_delete on public.saved_moments for delete using (owner_id = auth.uid());
revoke all on public.saved_moments from public, anon, authenticated;
grant select, delete on public.saved_moments to authenticated;
grant update (name) on public.saved_moments to authenticated;
grant all on public.saved_moments to service_role;

-- Save what plays now in a session the caller owns. Errors carry a code after "saved_moment: " (not_owner, nothing_playing, bad_input,
-- ai_saves_full, saves_full, too_fast). p_by 'ai' is the AI saving on its own (3 per session); 'human' is the button, or the AI saving
-- because the listener asked in words.
create or replace function public.save_moment(p_session text, p_name text, p_by text, p_voice_seed bigint, p_app_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s record; st record; nm text; mid text; eff jsonb;
begin
  if uid is null then raise exception 'saved_moment: not_owner'; end if;
  select id, owner_id, current_state_id into s from public.sessions where id = p_session;
  if not found or s.owner_id <> uid then raise exception 'saved_moment: not_owner'; end if;
  if p_by is null or p_by not in ('human', 'ai') or p_voice_seed is null then raise exception 'saved_moment: bad_input'; end if;
  nm := btrim(regexp_replace(coalesce(p_name, ''), E'[\\x01-\\x1F\\x7F]', '', 'g'));
  if char_length(nm) < 1 or char_length(nm) > 80 then raise exception 'saved_moment: bad_input'; end if;
  if s.current_state_id is null then raise exception 'saved_moment: nothing_playing'; end if;
  select effective, seed into st from public.states where id = s.current_state_id;
  -- the same test as isSounding (apps/web/lib/sounding.ts): the synth has volume, or Strudel plays a pattern
  if not found or not (coalesce((st.effective ->> 'volume')::numeric, 0) > 0.001
                       or (st.effective ->> 'engine' = 'strudel' and st.effective -> 'pattern' is not null)) then
    raise exception 'saved_moment: nothing_playing';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 27)); -- one save at a time per owner, so the caps below hold
  if p_by = 'ai' and (select count(*) from public.saved_moments where session_id = p_session and saved_by = 'ai') >= 3 then
    raise exception 'saved_moment: ai_saves_full';
  end if;
  if (select count(*) from public.saved_moments where owner_id = uid) >= 200 then raise exception 'saved_moment: saves_full'; end if;
  if (select count(*) from public.saved_moments where owner_id = uid and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'saved_moment: too_fast';
  end if;
  -- freeze: no one-shot motif, no delay, no tempo or rate glide from the state before
  eff := st.effective - 'motif' #- '{transition,delay}' #- '{grid,fromTempo}' #- '{grid,glide}' #- '{grid,fromRate}';
  mid := translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_');
  insert into public.saved_moments (id, owner_id, session_id, name, saved_by, effective, seed, voice_seed, app_version)
  values (mid, uid, p_session, nm, p_by, eff, st.seed, p_voice_seed, left(p_app_version, 20));
  return jsonb_build_object('id', mid, 'name', nm);
end $$;
revoke execute on function public.save_moment(text, text, text, bigint, text) from public, anon;
grant execute on function public.save_moment(text, text, text, bigint, text) to authenticated;

-- The public read behind /m/<id>. Never owner_id, never session_id.
create or replace function public.get_saved_moment(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', name, 'saved_by', saved_by, 'created_at', created_at, 'effective', effective,
                            'seed', seed, 'voice_seed', voice_seed, 'app_version', app_version)
  from public.saved_moments where id = p_id
$$;
revoke execute on function public.get_saved_moment(text) from public;
grant execute on function public.get_saved_moment(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest emojis (migration 0028)
-- ---------------------------------------------------------------------------
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

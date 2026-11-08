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
  pending_final boolean not null default false    -- true after a non-final update until a final one
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
                 'calmer','softer','brighter','darker','slower','faster',
                 'more_of_this','less_of_this',
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

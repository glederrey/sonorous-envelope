-- Moments (v0.22, tool `moment`): the model's musical memory. A map name -> moment on the session: each moment is a self-contained copy of
-- the sound and picture that played when the model kept it (effective state, mood, analysis, voice, sticky, note), so it can be recalled
-- even if states are cleaned up one day. Written by the model's own client (the owner's RLS update, sessions_owner_update); not part of
-- player_poll, the player does not need it.
alter table public.sessions add column if not exists moments jsonb not null default '{}'::jsonb;

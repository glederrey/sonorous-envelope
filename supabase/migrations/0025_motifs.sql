-- Motifs (`set_sound` motif, roadmap #128): the short phrases the model named, to quote them later. A map name -> { notes, beats, kept_at, turn }
-- (note names like "E4", "-" for a rest; at most 12 per session). Written by the model's own client (the owner's RLS update,
-- sessions_owner_update); not part of player_poll, the player gets the phrase inside the state it plays.
alter table public.sessions add column if not exists motifs jsonb not null default '{}'::jsonb;

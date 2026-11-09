-- The instance's voice (mood-mapping.md, "Voice"): root, scale, chord, note order, octaves, wave. Null = none chosen,
-- the mapping then draws a character from the session id. Only the owner's own token writes sessions (RLS unchanged).
alter table public.sessions add column voice jsonb;

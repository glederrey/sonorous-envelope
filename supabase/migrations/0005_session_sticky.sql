-- What stays on a session until Claude changes it: colour, stacked intervals, pad, LFOs (shared/src/sticky.ts).
-- Written only through the owner's own token (RLS unchanged).
alter table public.sessions add column sticky jsonb;

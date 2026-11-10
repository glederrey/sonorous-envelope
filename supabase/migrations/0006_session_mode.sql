-- The mode of a session, fixed when it starts (roadmap #16): 'inner' is the model's own state, never announced;
-- 'outer' is sound the model makes on request and may talk about. Additive: old rows are inner.
alter table public.sessions add column mode text not null default 'inner' check (mode in ('inner', 'outer'));

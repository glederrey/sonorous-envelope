-- Undoes 0024_snapshot_seen.sql. Run by hand against the database (psql or the Supabase SQL editor), then delete the row
-- version '0024' from supabase_migrations.schema_migrations so a later `supabase db push` would apply it again.
drop function if exists public.mark_snapshot_seen(text);
alter table public.snapshots drop column if exists seen_at, drop column if exists seen_image;

-- Undoes 0020_snapshots.sql. Run by hand against the database (psql or the Supabase SQL editor), then delete the row
-- version '0020' from supabase_migrations.schema_migrations so a later `supabase db push` would apply it again.
drop function if exists public.put_snapshot(text, uuid, text, jsonb, real);
drop table if exists public.snapshots;

-- Undoes 0025_motifs.sql (this deletes every named motif: they live only in this column). Not run by anything on its own.
-- Run it by hand against the database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/revert/0025_motifs.down.sql
-- then delete the row version '0025' from supabase_migrations.schema_migrations.
alter table public.sessions drop column if exists motifs;

-- Undoes 0027_saved_moments.sql (this deletes every saved moment, and their links stop working). Not run by anything on its own.
-- Run it by hand against the database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/revert/0027_saved_moments.down.sql
-- then delete the row version '0027' from supabase_migrations.schema_migrations.
drop function if exists public.get_saved_moment(text);
drop function if exists public.save_moment(text, text, text, bigint, text);
drop table if exists public.saved_moments;

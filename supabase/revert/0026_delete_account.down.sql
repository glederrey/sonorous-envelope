-- Undoes 0026_delete_account.sql (drops the function; accounts already deleted stay deleted). Not run by anything on its own.
-- Run it by hand against the database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/revert/0026_delete_account.down.sql
-- then delete the row version '0026' from supabase_migrations.schema_migrations.
drop function if exists public.delete_my_account();

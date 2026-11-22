-- Undoes 0028_guest_emojis.sql (this deletes every stored guest emoji). Not run by anything on its own.
-- Run it by hand against the database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/revert/0028_guest_emojis.down.sql
-- then delete the row version '0028' from supabase_migrations.schema_migrations.
drop function if exists public.claim_emojis(text);
drop function if exists public.send_emoji(text, text, text);
drop table if exists public.emoji_reactions; -- the trigger goes with it
drop function if exists public.broadcast_emoji();

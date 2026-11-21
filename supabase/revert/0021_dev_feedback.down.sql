-- Undoes 0021_dev_feedback.sql (this deletes every note sent so far: export them first if they matter). Run by hand against the
-- database (psql or the Supabase SQL editor), then delete the row version '0021' from supabase_migrations.schema_migrations.
drop function if exists public.send_dev_feedback(text, text, text, text, text, text);
drop table if exists public.dev_feedback_quota;
drop table if exists public.dev_feedback;

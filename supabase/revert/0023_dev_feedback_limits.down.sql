-- Undoes 0023_dev_feedback_limits.sql: back to the limits of 0021 (5 per user per day, 200 overall, the hour kept, no duplicate check).
-- Run by hand against the database (psql or the Supabase SQL editor), then delete the row version '0023' from
-- supabase_migrations.schema_migrations so a later `supabase db push` would apply it again. Notes keep the day they were stored with.
alter table public.dev_feedback alter column created_at set default date_trunc('hour', now());
create or replace function public.send_dev_feedback(p_kind text, p_source text, p_body text, p_version text, p_mode text, p_engine text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); clean text; used integer;
begin
  if uid is null then raise exception 'dev_feedback: sign in first'; end if;
  if p_kind is null or p_kind not in ('bug', 'idea', 'confusion', 'worked') then raise exception 'dev_feedback: unknown kind'; end if;
  if p_source is null or p_source not in ('model', 'user') then raise exception 'dev_feedback: unknown source'; end if;
  -- control characters out (newlines and tabs stay), runs of blank lines folded, ends trimmed
  clean := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'), E'\\n{3,}', E'\n\n', 'g'));
  if char_length(clean) < 80 then raise exception 'dev_feedback: too short'; end if;
  if char_length(clean) > 1000 then raise exception 'dev_feedback: too long'; end if;
  if (select count(*) from public.dev_feedback where created_at > now() - interval '1 day') >= 200 then raise exception 'dev_feedback: global limit'; end if;
  insert into public.dev_feedback_quota (user_id, day, n) values (uid, current_date, 1)
    on conflict (user_id, day) do update set n = public.dev_feedback_quota.n + 1 returning n into used;
  if used > 5 then raise exception 'dev_feedback: daily limit'; end if; -- the raise rolls the count back too
  insert into public.dev_feedback (kind, source, body, app_version, mode, engine)
  values (p_kind, p_source, clean, left(p_version, 20),
          case when p_mode in ('self', 'attuned', 'jukebox') then p_mode end,
          case when p_engine in ('synth', 'strudel') then p_engine end);
  delete from public.dev_feedback_quota where day < current_date - 2; -- old counts are not kept
end $$;
revoke execute on function public.send_dev_feedback(text, text, text, text, text, text) from public, anon;
grant  execute on function public.send_dev_feedback(text, text, text, text, text, text) to authenticated;

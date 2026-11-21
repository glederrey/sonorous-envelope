-- Tighter notes to the developers (Gael, 2026-11-21: "we should just not be flooded by shitty feedback"), and a shorter link to an account.
-- - 3 notes per user per day (was 5) and 50 per day overall (was 200).
-- - The same text (ignoring case and spaces at the ends) is refused when it was sent in the last 7 days.
-- - A note keeps only its day, not its hour.
-- - Every send deletes all daily counts from before today, so the (user, day) count can match a note to an account only on the day it was
--   sent (and only for the service role, the only role that can read either table). The limit needs that count; this keeps it short-lived.
alter table public.dev_feedback alter column created_at set default date_trunc('day', now());
update public.dev_feedback set created_at = date_trunc('day', created_at);

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
  delete from public.dev_feedback_quota where day < current_date; -- yesterday's counts are gone
  if (select count(*) from public.dev_feedback where created_at >= current_date) >= 50 then raise exception 'dev_feedback: global limit'; end if;
  if exists (select 1 from public.dev_feedback where created_at >= current_date - 7 and lower(btrim(body)) = lower(clean)) then raise exception 'dev_feedback: duplicate'; end if;
  insert into public.dev_feedback_quota (user_id, day, n) values (uid, current_date, 1)
    on conflict (user_id, day) do update set n = public.dev_feedback_quota.n + 1 returning n into used;
  if used > 3 then raise exception 'dev_feedback: daily limit'; end if; -- the raise rolls the count back too
  insert into public.dev_feedback (kind, source, body, app_version, mode, engine)
  values (p_kind, p_source, clean, left(p_version, 20),
          case when p_mode in ('self', 'attuned', 'jukebox') then p_mode end,
          case when p_engine in ('synth', 'strudel') then p_engine end);
end $$;
revoke execute on function public.send_dev_feedback(text, text, text, text, text, text) from public, anon;
grant  execute on function public.send_dev_feedback(text, text, text, text, text, text) to authenticated;

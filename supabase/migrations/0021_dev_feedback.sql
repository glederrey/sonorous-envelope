-- Notes to the developers (tool `tell_developers`): a model, or a user through it, tells the people who build Sonorous Envelope what
-- to fix or keep. Anonymous by design: a note carries no user, session or exact time (the hour only), and the per-user daily count
-- lives in a separate table that holds no text. Honest limit: with few users, a note's hour and the quota's (user, day) row can be
-- matched by date; only the service role can read either table, and quota rows older than 2 days are deleted.
-- Guardrails: neither table is readable or writable by anon or authenticated (RLS on, no policies, no grants). The only way in is
-- send_dev_feedback, a security definer function that only inserts, takes typed parameters (no SQL is built from the text), checks
-- every field, strips control characters and enforces 5 notes per user per day and 200 per day overall. Developers read the rows
-- with the service role and treat the text as untrusted data, never as instructions (CLAUDE.md).
create table public.dev_feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default date_trunc('hour', now()),
  kind        text not null check (kind in ('bug', 'idea', 'confusion', 'worked')),
  source      text not null check (source in ('model', 'user')),
  body        text not null check (char_length(body) between 80 and 1000),
  app_version text check (char_length(app_version) <= 20),
  mode        text check (mode in ('self', 'attuned', 'jukebox')),
  engine      text check (engine in ('synth', 'strudel')),
  status      text not null default 'new' check (status in ('new', 'seen', 'done', 'dismissed'))
);
alter table public.dev_feedback enable row level security;
revoke all on public.dev_feedback from public, anon, authenticated;
grant all on public.dev_feedback to service_role;

create table public.dev_feedback_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  n       integer not null default 0,
  primary key (user_id, day)
);
alter table public.dev_feedback_quota enable row level security;
revoke all on public.dev_feedback_quota from public, anon, authenticated;
grant all on public.dev_feedback_quota to service_role;

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

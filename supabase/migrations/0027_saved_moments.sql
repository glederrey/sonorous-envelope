-- Saved moments (#151): a keepsake of one thing playing, outside the session. The synth state (with its seeds) or the Strudel code and bpm,
-- plus the picture, frozen: nobody can change the sound afterwards, the AI included. Only the name can change. One public link, /m/<id>,
-- the same for everyone, read through get_saved_moment (it never returns owner_id or session_id: the session id is the live player's only
-- credential). Only save_moment writes a row, and it copies the state on the server: the client never sends state JSON or code.
create table public.saved_moments (
  id          text primary key,  -- 22 characters of base64url from a uuid: unguessable, like session ids
  owner_id    uuid not null references auth.users(id) on delete cascade,
  session_id  text references public.sessions(id) on delete set null, -- never returned publicly
  name        text not null check (char_length(name) between 1 and 80),
  saved_by    text not null check (saved_by in ('human', 'ai')),
  effective   jsonb not null,    -- frozen copy of the state that played (no one-shot motif, no delay, no tempo glide)
  seed        bigint not null,   -- the state's own seed
  voice_seed  bigint not null,   -- voiceSeedOf(session id): the grid's per-step randomness and the picture's seed, so the replay matches
  app_version text check (char_length(app_version) <= 20), -- "exactly the same" holds while the engine does not change
  turn        integer,           -- the state's turn in its session: the AI's own saves are spaced by turns
  fingerprint text not null,     -- md5 of what the replay depends on: a moment is saved once per owner, a second save returns the first
  created_at  timestamptz not null default now()
);
create index saved_moments_owner on public.saved_moments (owner_id, created_at desc);
create index saved_moments_session on public.saved_moments (session_id);
create unique index saved_moments_once on public.saved_moments (owner_id, fingerprint);
alter table public.saved_moments enable row level security;
-- the owner reads, renames (the name column only, see the grants) and deletes. No direct insert: only save_moment writes.
create policy saved_moments_select on public.saved_moments for select using (owner_id = auth.uid());
create policy saved_moments_update on public.saved_moments for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy saved_moments_delete on public.saved_moments for delete using (owner_id = auth.uid());
revoke all on public.saved_moments from public, anon, authenticated;
grant select, delete on public.saved_moments to authenticated;
grant update (name) on public.saved_moments to authenticated;
grant all on public.saved_moments to service_role;

-- Save what plays now in a session the caller owns. Errors carry a code after "saved_moment: " (not_owner, nothing_playing, bad_input,
-- ai_too_soon, saves_full, too_fast). p_by 'ai' is the AI saving on its own (once per 5 turns of the session, so a long session allows more
-- than a short one); 'human' is the button, or the AI saving because the listener asked in words. Saving what is already saved (the same
-- frozen state, seeds included) writes nothing and returns the first save with already = true.
create or replace function public.save_moment(p_session text, p_name text, p_by text, p_voice_seed bigint, p_app_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  s record; st record; old record; nm text; mid text; eff jsonb; fp text;
begin
  if uid is null then raise exception 'saved_moment: not_owner'; end if;
  select id, owner_id, current_state_id into s from public.sessions where id = p_session;
  if not found or s.owner_id <> uid then raise exception 'saved_moment: not_owner'; end if;
  if p_by is null or p_by not in ('human', 'ai') or p_voice_seed is null then raise exception 'saved_moment: bad_input'; end if;
  nm := btrim(regexp_replace(coalesce(p_name, ''), E'[\\x01-\\x1F\\x7F]', '', 'g'));
  if char_length(nm) < 1 or char_length(nm) > 80 then raise exception 'saved_moment: bad_input'; end if;
  if s.current_state_id is null then raise exception 'saved_moment: nothing_playing'; end if;
  select effective, seed, turn into st from public.states where id = s.current_state_id;
  -- the same test as isSounding (apps/web/lib/sounding.ts): the synth has volume, or Strudel plays a pattern
  if not found or not (coalesce((st.effective ->> 'volume')::numeric, 0) > 0.001
                       or (st.effective ->> 'engine' = 'strudel' and st.effective -> 'pattern' is not null)) then
    raise exception 'saved_moment: nothing_playing';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 27)); -- one save at a time per owner, so the caps below hold
  -- freeze: no one-shot motif, no delay, no tempo or rate glide from the state before
  eff := st.effective - 'motif' #- '{transition,delay}' #- '{grid,fromTempo}' #- '{grid,glide}' #- '{grid,fromRate}';
  -- what the replay depends on (jsonb text is canonical); a Strudel pattern does not use the state's seed
  fp := md5(eff::text || '|' || p_voice_seed || '|'
            || case when eff ->> 'engine' = 'strudel' and eff -> 'pattern' is not null then '' else st.seed::text end);
  select id, name, saved_by into old from public.saved_moments where owner_id = uid and fingerprint = fp;
  if found then return jsonb_build_object('id', old.id, 'name', old.name, 'saved_by', old.saved_by, 'already', true); end if;
  if p_by = 'ai' and exists (select 1 from public.saved_moments
                             where session_id = p_session and saved_by = 'ai' and turn > coalesce(st.turn, 0) - 5) then
    raise exception 'saved_moment: ai_too_soon';
  end if;
  if (select count(*) from public.saved_moments where owner_id = uid) >= 200 then raise exception 'saved_moment: saves_full'; end if;
  if (select count(*) from public.saved_moments where owner_id = uid and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'saved_moment: too_fast';
  end if;
  mid := translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_');
  insert into public.saved_moments (id, owner_id, session_id, name, saved_by, effective, seed, voice_seed, app_version, turn, fingerprint)
  values (mid, uid, p_session, nm, p_by, eff, st.seed, p_voice_seed, left(p_app_version, 20), st.turn, fp);
  return jsonb_build_object('id', mid, 'name', nm, 'saved_by', p_by, 'already', false);
end $$;
revoke execute on function public.save_moment(text, text, text, bigint, text) from public, anon;
grant execute on function public.save_moment(text, text, text, bigint, text) to authenticated;

-- The public read behind /m/<id>. Never owner_id, never session_id.
create or replace function public.get_saved_moment(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', name, 'saved_by', saved_by, 'created_at', created_at, 'effective', effective,
                            'seed', seed, 'voice_seed', voice_seed, 'app_version', app_version)
  from public.saved_moments where id = p_id
$$;
revoke execute on function public.get_saved_moment(text) from public;
grant execute on function public.get_saved_moment(text) to anon, authenticated;

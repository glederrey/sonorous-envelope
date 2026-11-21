-- "What I heard" (#129): the listener tells the model how the sound read to them, in every mode, Self included. Stored as reactions
-- with a `heard_` kind, delivered once like the others, but returned in their own `heard` field and never treated as steering.
-- Revert: supabase/migrations/revert/0018_heard_reactions.down.sql
alter table public.reactions drop constraint reactions_kind_check;
alter table public.reactions add constraint reactions_kind_check check (kind in (
  'calmer','softer','brighter','darker','slower','faster','stormier','harsher',
  'more_of_this','less_of_this',
  'heard_calm','heard_tender','heard_warm','heard_joyful','heard_playful',
  'heard_hesitant','heard_sad','heard_tense','heard_anxious','heard_reproach',
  'volume','mute','unmute','limit_changed','consent_changed',
  'gestures_off','gestures_on','image_feedback_changed'));

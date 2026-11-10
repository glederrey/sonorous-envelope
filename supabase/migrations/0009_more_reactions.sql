-- Two more reaction kinds: stormier (the opposite of calmer) and harsher (the opposite of softer).
alter table public.reactions drop constraint reactions_kind_check;
alter table public.reactions add constraint reactions_kind_check check (kind in (
  'calmer','softer','brighter','darker','slower','faster','stormier','harsher',
  'more_of_this','less_of_this',
  'volume','mute','unmute','limit_changed','consent_changed',
  'gestures_off','gestures_on','image_feedback_changed'));

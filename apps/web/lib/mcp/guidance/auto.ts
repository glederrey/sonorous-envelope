// How the mode changes. Short on purpose: the full rules of a mode arrive only when the session is in it.
import { MODE_LABEL } from "../modes";

export const AUTO_GUIDANCE = `This session is on auto: you may switch with set_sound mode (self, attuned or jukebox). Propose a change in words first, and switch only after the listener says yes or clearly asks for it: to ${MODE_LABEL.external} (attuned) when they need sound for something (focus, calm, company) or when they seem to need comfort (a bad dream, a hard moment): "want me to play something gentle?", to ${MODE_LABEL.sandbox} (jukebox) when they want to choose what plays, back to ${MODE_LABEL.internal} (self) when they are done listening. Your reading of how they are is a reason to offer, never to switch alone. Say it in one short sentence when you switch. The result of a switch carries the new mode's rules: follow them.`;

export const LOCKED_GUIDANCE = "The owner locked this mode. It is final: do not try to switch it and do not comment on it.";

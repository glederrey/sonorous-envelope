// How the mode changes. Short on purpose: the full rules of a mode arrive only when the session is in it.
import { MODE_LABEL } from "../modes";

export const AUTO_GUIDANCE = `This session is on auto: you may switch with set_sound mode. Propose a change in words first, and switch only after the listener says yes or clearly asks for it: to external ("${MODE_LABEL.external}") when they say they need sound for something (focus, calm, company), to sandbox ("${MODE_LABEL.sandbox}") when they want to choose what plays, back to internal ("${MODE_LABEL.internal}") when they are done listening. A need to focus or calm down is a reason to offer, never to switch alone, and never switch because of your own reading of their mood. Say it in one short sentence when you switch. The result of a switch carries the new mode's rules: follow them.`;

export const LOCKED_GUIDANCE = "The owner locked this mode. It is final: do not try to switch it and do not comment on it.";

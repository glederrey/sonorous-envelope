// Lazy guidance: the global instructions only name the three modes. The rules of a mode reach the model with start_session, and
// again in the first result after the mode changes (by the model's switch or by the owner in the player), never all at once.
import { forListener, type Face, type Policy } from "../modes";
import { AUTO_GUIDANCE, LOCKED_GUIDANCE } from "./auto";
import { EXTERNAL_GUIDANCE } from "./external";
import { INTERNAL_GUIDANCE } from "./internal";
import { PICTURE_GUIDANCE } from "./picture";
import { SANDBOX_GUIDANCE } from "./sandbox";
import { STRUDEL_GUIDANCE } from "./strudel";

export const MODE_GUIDANCE: Record<Face, string> = { internal: INTERNAL_GUIDANCE, external: EXTERNAL_GUIDANCE, sandbox: SANDBOX_GUIDANCE };

/** The rules for the mode the session is in now: the mode, how it may change, and Strudel where it is allowed. */
export function modeGuidance(face: Face, policy: Policy): string {
  return [MODE_GUIDANCE[face], policy === "auto" ? AUTO_GUIDANCE : LOCKED_GUIDANCE, forListener(face) ? STRUDEL_GUIDANCE : ""].filter(Boolean).join("\n");
}

/** What start_session returns: the mode's rules plus the picture controls, sent once per session. */
export function startGuidance(face: Face, policy: Policy): string {
  return `${modeGuidance(face, policy)}\n${PICTURE_GUIDANCE}`;
}

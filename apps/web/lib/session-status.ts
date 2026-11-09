/** A session is "active" while its last sound is recent, whatever the fade setting (roadmap #30). */
export const INACTIVE_AFTER_S = 1800;

/** A session with no sound for this long is shown as ended, and `start_session` ends it for good. Until then it stays
 *  inactive, because a conversation can come back: Claude calls `set_sound` with the same session and it plays again. */
export const ENDED_AFTER_S = 7 * 86400;
/** Sessions whose last sound is older than this go under "Older" on the sessions page. */
export const OLDER_AFTER_S = 86400;

export type SessionStatus = "ended" | "active" | "inactive";

export function sessionStatus(s: { ended_at: string | null; last_active_at: string }, now: number): SessionStatus {
  if (s.ended_at) return "ended";
  const idle = now - new Date(s.last_active_at).getTime();
  if (idle > ENDED_AFTER_S * 1000) return "ended";
  return idle > INACTIVE_AFTER_S * 1000 ? "inactive" : "active";
}

export const isOlder = (s: { last_active_at: string }, now: number) => now - new Date(s.last_active_at).getTime() > OLDER_AFTER_S * 1000;

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

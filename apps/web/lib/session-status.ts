/** A session is "active" while its last sound is recent, whatever the fade setting (roadmap #30). */
export const INACTIVE_AFTER_S = 1800;

export type SessionStatus = "ended" | "active" | "inactive";

export function sessionStatus(s: { ended_at: string | null; last_active_at: string }, now: number): SessionStatus {
  if (s.ended_at) return "ended";
  return now - new Date(s.last_active_at).getTime() > INACTIVE_AFTER_S * 1000 ? "inactive" : "active";
}

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** The listener's own volume and mute, remembered per page in this browser (the session player and the saved-moment page). */
export function stored(id: string) {
  const fallback = { muted: false, volume: 0.8 };
  try {
    const raw = localStorage.getItem(`se:player:${id}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
export function remember(id: string, value: object) {
  try { localStorage.setItem(`se:player:${id}`, JSON.stringify(value)); } catch { /* private window */ }
}

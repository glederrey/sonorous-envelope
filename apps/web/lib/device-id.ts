/** This browser's id for the session player: heartbeats and guest emojis (rate limits) are counted per device. Not an account, not secret. */
export function deviceId() {
  try {
    let d = localStorage.getItem("se:device");
    if (!d) { d = crypto.randomUUID().slice(0, 12); localStorage.setItem("se:device", d); }
    return d;
  } catch { return crypto.randomUUID().slice(0, 12); }
}

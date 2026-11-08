/** Accept only same-origin relative paths. Anything else becomes the fallback. */
export function safeNext(value: string | null | undefined, fallback = "/sessions"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
  } catch {
    return fallback;
  }
  return value;
}

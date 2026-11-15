/** `?debug`, `?debug=1` and `?debug=true` turn the debugging on (`?debug=0` and `?debug=false` leave it off). Read once: the page does not change its address. */
export function debugFlag(search: string): boolean {
  const v = new URLSearchParams(search).get("debug");
  return v !== null && v !== "0" && v.toLowerCase() !== "false";
}

let flag: boolean | null = null;
/** What the picture does (scenes, fades, the Strudel view), as `[picture]` lines in the console, when the page was opened with `?debug`. Any build, since a tester uses the deployed site. */
export function picLog(...a: unknown[]) {
  if (flag === null) flag = typeof window !== "undefined" && debugFlag(window.location.search);
  if (flag) console.info("[picture]", ...a);
}

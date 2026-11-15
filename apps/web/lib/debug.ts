/** `?debug`, `?debug=1` and `?debug=true` turn the debugging on (`?debug=0` and `?debug=false` leave it off). Read once: the page does not change its address. */
export function debugFlag(search: string): boolean {
  const v = new URLSearchParams(search).get("debug");
  return v !== null && v !== "0" && v.toLowerCase() !== "false";
}

let flag: boolean | null = null, lastLine = "";
/** What the picture does (scenes, fades, the Strudel view), as `[picture]` lines in the console, when the page was opened with `?debug`. Any build, since a tester uses the deployed site. */
export function picLog(...a: unknown[]) {
  if (flag === null) flag = typeof window !== "undefined" && debugFlag(window.location.search);
  if (!flag) return;
  // the same line twice in a row says nothing new (the console folded about 15 of them in the v0.19.2 tests)
  let line = ""; try { line = JSON.stringify(a); } catch { /* a cycle: log it */ }
  if (line && line === lastLine) return;
  lastLine = line;
  console.info("[picture]", ...a);
}

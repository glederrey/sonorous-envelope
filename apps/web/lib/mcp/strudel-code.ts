import { parse } from "acorn";

// Strudel code is JavaScript. The server never runs it (it is the listener's browser that does, in a sandboxed frame), but it can
// parse it: a syntax error then comes back in the same tool result instead of a turn later. Mini-notation strings and runtime
// errors only show when the code runs, and the player reports those (pattern_reports).

export type CodeCheck = { ok: true } | { ok: false; message: string };

export function checkPatternCode(code: string): CodeCheck {
  if (!code.trim()) return { ok: false, message: "the code is empty" };
  try {
    // top-level await is allowed (strudel.cc wraps the code in an async function); `$:` is a plain label
    parse(code, { ecmaVersion: "latest", sourceType: "script", allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
    return { ok: true };
  } catch (e) {
    const err = e as { message?: string; loc?: { line: number; column: number } };
    const where = err.loc ? ` (line ${err.loc.line}, column ${err.loc.column + 1})` : "";
    return { ok: false, message: `syntax error: ${(err.message ?? "invalid code").replace(/\s*\(\d+:\d+\)$/, "")}${where}` };
  }
}

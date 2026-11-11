// Sample banks. The sandboxed frame has no network, so the page loads samples, and only from this list: the banks strudel.cc loads by
// default (the dough-samples maps) and Dirt-Samples. Every URL is pinned to a commit, so a later change upstream cannot swap in another
// file. We do not host or redistribute them: the listener's browser fetches them from the publishers, as strudel.cc does.
// Licences per bank (docs/licensing.md): VCSL CC0, piano CC-BY 3.0, mridangam CC-BY-SA 4.0; tidal-drum-machines and Dirt-Samples state none.

const RAW = "https://raw.githubusercontent.com";
const DOUGH = `${RAW}/felixroos/dough-samples/9eacfc86ec4393e68a463ff52b01c19cfaa77f38`;

/** a branch URL as the maps write it, and the same files at one commit */
const PINS: Array<[string, string]> = [
  [`${RAW}/ritchse/tidal-drum-machines/main/`, `${RAW}/ritchse/tidal-drum-machines/6577395a4d05031728ced2ec3e5637fa89d8be48/`],
  [`${RAW}/tidalcycles/Dirt-Samples/master/`, `${RAW}/tidalcycles/Dirt-Samples/c74fc80f8db8038f6a33648ffef5ac00a07ad402/`],
  [`${RAW}/sgossner/VCSL/master/`, `${RAW}/sgossner/VCSL/c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e/`],
  [`${RAW}/yaxu/mrid/main/`, `${RAW}/yaxu/mrid/5ba409cabb2893e6e8a52a15a2812c35585cdadb/`],
  [`${RAW}/felixroos/dough-samples/main/`, `${DOUGH}/`],
];

/** The pinned form of a sample base URL, or null when it is not one of the allowed banks. */
export function pinBase(base: string): string | null {
  if (typeof base !== "string") return null;
  for (const [from, to] of PINS) if (base.startsWith(from)) return to + base.slice(from.length);
  for (const [, to] of PINS) if (base.startsWith(to)) return base;
  return null;
}

/** What strudel.cc loads when it starts, in the order it loads it. */
export const DEFAULT_BANKS = ["tidal-drum-machines", "piano", "Dirt-Samples", "EmuSP12", "vcsl", "mridangam"] as const;

const NAMED: Record<string, string> = {
  ...Object.fromEntries(DEFAULT_BANKS.map((b) => [b.toLowerCase(), `${DOUGH}/${b}.json`])),
  "github:tidalcycles/dirt-samples": `${RAW}/tidalcycles/Dirt-Samples/c74fc80f8db8038f6a33648ffef5ac00a07ad402/strudel.json`,
  "github:ritchse/tidal-drum-machines": `${DOUGH}/tidal-drum-machines.json`,
};

/** The map URL the page may load for a request from the model's code (a bank name, `github:...`, or a dough-samples map URL), else null. */
export function resolveBankRequest(request: string): string | null {
  const r = String(request).trim();
  const key = r.toLowerCase().replace(/\/+$/, "");
  if (NAMED[key]) return NAMED[key];
  const m = /^https:\/\/raw\.githubusercontent\.com\/felixroos\/dough-samples\/(?:main|[0-9a-f]{40})\/\/?([A-Za-z0-9_-]+)\.json$/.exec(r);
  if (m) return NAMED[m[1].toLowerCase()] ?? null;
  return null;
}

type SampleMap = Record<string, unknown> & { _base?: string };

/** A fetched map made safe to hand to superdough: its base pinned and allowed, and no per-key base. */
export function safeSampleMap(json: unknown, fallbackBase = ""): { map: SampleMap; base: string } | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const map = { ...(json as SampleMap) };
  const base = pinBase(typeof map._base === "string" ? map._base : fallbackBase);
  if (!base) return null;
  delete map._base;
  for (const [k, v] of Object.entries(map)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "_base" in (v as object)) { const c = { ...(v as SampleMap) }; delete c._base; map[k] = c; }
  }
  return { map, base };
}

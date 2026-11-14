// The frame's bootstrap. The frame is sandboxed (allow-scripts only: an opaque origin, no storage, cookies or network, a CSP that
// allows nothing but this script and a blob worker). It starts the worker from source the page sends, and relays messages with the
// frame's token, which the model's code (in the worker) cannot read. Built to public/strudel/frame.js.
const MAX_HAPS_PER_SECOND = 600;
// the drawings have a budget of their own: a pianoroll looks several cycles ahead and behind, so it sends more than the sound does
const MAX_DRAW_HAPS_PER_SECOND = 2000;
let worker: Worker | null = null, token = "", windowStart = 0, count = 0, dropped = false, drawStart = 0, drawCount = 0;

const toPage = (m: Record<string, unknown>) => parent.postMessage({ token, ...m }, "*");

window.addEventListener("message", (e: MessageEvent) => {
  if (e.source !== parent) return;
  const m = e.data;
  if (!m || typeof m !== "object") return;
  if (m.kind === "init" && !worker && typeof m.token === "string" && typeof m.worker === "string") {
    token = m.token;
    try {
      worker = new Worker(URL.createObjectURL(new Blob([m.worker], { type: "text/javascript" })));
    } catch (err) {
      toPage({ kind: "report", report: { ok: false, error: `the sandbox could not start a worker: ${String((err as Error).message).slice(0, 120)}`, notes: [] } });
      return;
    }
    worker.onmessage = (ev: MessageEvent) => {
      const d = ev.data;
      if (!d || typeof d !== "object") return;
      if (d.kind === "hap") {
        const now = performance.now();
        if (now - windowStart > 1000) { windowStart = now; count = 0; dropped = false; }
        if (++count > MAX_HAPS_PER_SECOND) { if (!dropped) { dropped = true; toPage({ kind: "report", report: { ok: false, error: "too many events per second: the extra ones were dropped", notes: [] } }); } return; }
        toPage({ kind: "hap", hap: d.hap });
      } else if (d.kind === "draw") {
        const now = performance.now();
        if (now - drawStart > 1000) { drawStart = now; drawCount = 0; }
        const list = Array.isArray(d.haps) ? d.haps.slice(0, 400) : [];
        if ((drawCount += list.length) > MAX_DRAW_HAPS_PER_SECOND) return;
        toPage({ kind: "draw", haps: list });
      } else if (d.kind === "viz") {
        toPage({ kind: "viz", specs: Array.isArray(d.specs) ? d.specs.slice(0, 8) : [] });
      } else if (d.kind === "report" || d.kind === "banks" || d.kind === "alive") toPage(d.kind === "alive" ? { kind: "alive" } : d);
    };
    worker.onerror = (ev) => toPage({ kind: "report", report: { ok: false, error: `worker error: ${String(ev.message).slice(0, 160)}`, notes: [] } });
    toPage({ kind: "ready" });
  } else if (worker && (m.kind === "play" || m.kind === "clock" || m.kind === "stop")) worker.postMessage(m);
});
// a heartbeat from the frame itself, so the page can tell a frozen worker (no "alive" from it) from a missing frame
toPage({ kind: "frame" });

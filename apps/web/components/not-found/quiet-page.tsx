"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { QuietWaves } from "./quiet-waves";
import { womp, WOMP_S } from "./trombone";

/** The site's 404: "this page went quiet". The 0 of 404 is a rippling ring (the visuals' ripples), a flat sound line runs under the text
 *  (QuietWaves, standing waves that swell with each note), and a button plays a short sad trombone. Motion stops under prefers-reduced-motion. */
export function QuietPage() {
  const [playing, setPlaying] = useState(false);
  const [heardAt, setHeardAt] = useState<number | null>(null); // when the trombone is heard (performance.now()): the waves follow it
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const press = async () => {
    setPlaying(true);
    const at = await womp();
    if (at === null) { setPlaying(false); return; }
    setHeardAt(at);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPlaying(false), at - performance.now() + WOMP_S * 1000);
  };

  return (
    <main className="nf" data-playing={playing || undefined}>
      <div className="nf-code" aria-hidden>
        <span>4</span>
        <svg className="nf-ring" viewBox="0 0 120 120">
          <circle className="nf-ripple" cx="60" cy="60" r="34" />
          <circle className="nf-ripple nf-ripple-2" cx="60" cy="60" r="34" />
          <circle className="nf-ripple nf-ripple-3" cx="60" cy="60" r="34" />
          <circle className="nf-zero" cx="60" cy="60" r="34" />
        </svg>
        <span>4</span>
      </div>
      <h1 className="nf-title">This page went quiet.</h1>
      <p className="nf-text se-muted">
        Nothing plays at this address. The link may be old, mistyped, or the saved moment behind it was deleted.
      </p>
      <QuietWaves heardAt={heardAt} />
      <div className="nf-actions">
        <Link className="se-btn se-btn-primary" href="/">Back to the start</Link>
        <button type="button" className="se-btn" onClick={press} disabled={playing}>
          <Volume2 size={16} aria-hidden />{playing ? "Wah wah wah…" : "Play a sad trombone"}
        </button>
      </div>
    </main>
  );
}

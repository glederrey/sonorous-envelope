"use client";

import { useMemo, useState } from "react";
import type { EngineState } from "@sonorous/engine";
import { MomentPlayer } from "../../../components/moment/moment-player";
import { SAMPLES, stateOfStep } from "../../../lib/samples";

const CODE = `stack(
  s("bd*2 [~ bd] sd:3").bank("RolandTR909"),
  s("hh*8").gain(0.4),
  note("<c2 g2 eb2 bb1>").s("sawtooth").lpf(500)
).pianoroll()`;

type Kind = "synth" | "strudel";

/** A made-up saved moment, shaped like what get_saved_moment returns (frozen: no motif, no delay, no glide). */
function fixture(kind: Kind): EngineState {
  const sample = SAMPLES[0];
  const e = stateOfStep(sample.steps[0], sample.id);
  e.transition = { time: 2, curve: "smooth" };
  if (kind === "strudel") { e.engine = "strudel"; e.pattern = { code: CODE, bpm: 110 }; e.colour = { ...e.colour, h: 200, s: 0.4, l: 0.18 }; }
  return e;
}

const btn = (on: boolean) => `se-btn${on ? " se-btn-primary" : ""}`;

export function MomentLab() {
  const [kind, setKind] = useState<Kind>("synth");
  const [mine, setMine] = useState(false);
  const effective = useMemo(() => fixture(kind), [kind]);
  return (
    <>
      <div style={{ position: "fixed", top: 72, right: 12, zIndex: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className={btn(kind === "synth")} onClick={() => setKind("synth")}>Synth state</button>
        <button type="button" className={btn(kind === "strudel")} onClick={() => setKind("strudel")}>Strudel state</button>
        <button type="button" className={btn(mine)} aria-pressed={mine} onClick={() => setMine(!mine)}>Saved by me</button>
      </div>
      <MomentPlayer
        key={kind}
        mine={mine}
        moment={{ id: "A".repeat(22), name: `${kind === "synth" ? "Tender" : "Pattern"} · 14:32`, savedBy: mine ? "human" : "ai", createdAt: "2026-11-22T14:32:00Z", effective, seed: 1234, voiceSeed: 98765 }}
      />
    </>
  );
}

import { describe, expect, it } from "vitest";
import { neutralState, type ResolvedColour } from "@sonorous/engine";
import {
  capFrame, drawFrame, hash01, itemArea, applyColour, SCENES, moodToScene, hslToRgb, isSaturatedRed, largeSwing, redFactor, relLuminance, visualFrame, applyLimits,
  moodToColour, moodToFeel, stretchMood, HALF_TIME_BPM, MAX_ITEMS, MAX_LARGE_SWING, MAX_SMALL_AREA, EMPTY_FRAME, type Frame,
} from "../src";

const base = (o: Partial<ResolvedColour> = {}): ResolvedColour => ({ h: 220, s: 0.4, l: 0.3, motion: "pulse", texture: "flat", pulseHz: 0, ...o });
const mood = { warmth: 0.5, closeness: 0.5, joy: 0.5, calm: 0.5, spontaneity: 0.5 };

describe("visual frame", () => {
  it("is a pure function: the same input gives the same frame", () => {
    const c = base({ scene: "motes", density: 0.7, feel: moodToFeel(mood) });
    expect(visualFrame({ colour: c, bpm: 100, beats: 12.3, t: 4, seed: 3 })).toEqual(visualFrame({ colour: c, bpm: 100, beats: 12.3, t: 4, seed: 3 }));
    expect(hash01(5, 9)).toBe(hash01(5, 9));
  });
  it("keeps the scene where it is when only the colour changes (the seed belongs to the session)", () => {
    const f = (h: number, beats: number) => visualFrame({ colour: base({ h, scene: "rain", density: 0.6, feel: moodToFeel(mood) }), bpm: 100, beats, t: 0, seed: 7 }).items;
    expect(f(40, 20.5)).toEqual(f(40, 20.5).map((i) => ({ ...i })));
    expect(f(200, 20.5).map(({ x, y }) => [x, y])).toEqual(f(40, 20.5).map(({ x, y }) => [x, y]));
    // and a step of a hundredth of a beat moves the items a hair, never across the view
    const a = f(40, 20.5), b = f(40, 20.51);
    a.forEach((i, k) => expect(Math.hypot(i.x - b[k].x, i.y - b[k].y)).toBeLessThan(0.05));
  });
  it("draws nothing for a still field without a scene", () => {
    expect(visualFrame({ colour: base({ motion: "still" }), bpm: 100, beats: 3, t: 1 })).toBe(EMPTY_FRAME);
  });
  it("pulses on the beat: brightest at the beat, not at the middle, and repeats every beat", () => {
    const c = base({ sync: "beat", feel: { ...moodToFeel(mood), depth: 1, jitter: 0, soft: 1 } });
    const at = (beats: number) => drawFrame({ colour: c, bpm: 120, beats, t: 0 }).wash;
    expect(at(8)).toBeGreaterThan(at(8.5));
    expect(at(8)).toBeCloseTo(at(12), 9); // the bar repeats every 4 beats
    expect(at(8)).toBeGreaterThan(at(9));  // and its first beat hits hardest
    expect(at(9)).toBeCloseTo(at(10), 9);
  });
  it("shows the beat in the shape too, so red (no brightness pulse) still moves: streaks stretch and brighten on the beat", () => {
    const c = base({ h: 0, s: 1, l: 0.45, motion: "pulse", scene: "rain", density: 1, sync: "beat", feel: { ...moodToFeel(mood), depth: 1 } });
    const f = (beats: number) => drawFrame({ colour: c, bpm: 120, beats, t: 0 });
    expect(f(8).wash).toBe(0);
    const len = (beats: number) => f(beats).items.reduce((s, i) => s + i.r, 0);
    expect(len(8.02)).toBeGreaterThan(len(8.6));
  });
  it("follows the phrase slowly in phrase sync: one swell over 16 beats", () => {
    const c = base({ sync: "phrase" });
    const w = (beats: number) => drawFrame({ colour: c, bpm: 120, beats, t: 0 }).wash;
    expect(w(8)).toBeGreaterThan(w(0.5));
    expect(w(0)).toBeCloseTo(w(16), 9);
  });
  it("runs at half-time above 180 BPM", () => {
    const c = base({ sync: "beat", feel: { ...moodToFeel(mood), depth: 1, jitter: 0, soft: 1 } });
    const fast = (beats: number) => drawFrame({ colour: c, bpm: HALF_TIME_BPM + 20, beats, t: 0 }).wash;
    expect(fast(8)).toBeCloseTo(fast(16), 9); // a cycle takes two beats, a bar four of them
    expect(fast(8)).toBeGreaterThan(fast(9));
  });
  it("carries the mood in the form, not only the hue: joy expands, low joy contracts, calm couples less", () => {
    const glow = (joy: number) => drawFrame({ colour: base({ motion: "breathe", sync: "beat", feel: moodToFeel({ ...mood, joy, calm: 0.1 }) }), bpm: 100, beats: 8.05, t: 0 }).glow!;
    expect(glow(1).r).toBeGreaterThan(glow(0).r);
    const swing = (calm: number) => { const c = base({ sync: "beat", feel: moodToFeel({ ...mood, calm }) }); const v = [0, 0.25, 0.5, 0.75].map((p) => drawFrame({ colour: c, bpm: 100, beats: 4 + p, t: 0 }).wash); return Math.max(...v) - Math.min(...v); };
    expect(swing(0.1)).toBeGreaterThan(swing(0.9));
    const rough = (tension: number) => { const f = moodToFeel({ ...mood, tension }); return f.jitter; };
    expect(rough(0.9)).toBeGreaterThan(rough(0));
  });
  it("maps calm to the motion: breathe, drift, pulse, and never still on its own", () => {
    const motion = (calm: number) => moodToColour({ ...mood, calm }, 1500, 0.3).motion;
    expect(motion(0.95)).toBe("breathe"); expect(motion(0.6)).toBe("drift"); expect(motion(0.1)).toBe("pulse");
    for (let k = 0; k <= 1; k += 0.05) expect(moodToColour({ ...mood, calm: k }, 1500, 0.3).motion).not.toBe("still");
  });
  it("moods differ in motion with the hue taken away, with the motion the mood gives and no forced scene or sync", () => {
    const sig = (m: typeof mood & { tension?: number }) => {
      const c = { ...moodToColour(m as never, 1500, 0.3), s: 0, secondary: undefined };
      const frames = [0, 0.3, 0.6, 1.1, 2.4, 5, 9.5].map((p) => drawFrame({ colour: c, bpm: 100, beats: 8 + p, t: p }, 0.6));
      expect(frames.some((f) => f.wash > 0 || f.glow)).toBe(true); // something moves
      return JSON.stringify(frames);
    };
    const moods = [
      { warmth: 0.8, closeness: 0.9, joy: 0.6, calm: 0.9, spontaneity: 0.3 },   // tender
      { warmth: 0.3, closeness: 0.4, joy: 0.3, calm: 0.1, spontaneity: 0.8, tension: 0.5 }, // nervous
      { warmth: 0.5, closeness: 0.2, joy: 0.8, calm: 0.55, spontaneity: 0.4 },  // awe
      { warmth: 0.2, closeness: 0.6, joy: 0.2, calm: 0.2, spontaneity: 0.6, tension: 0.8 }, // irritated
      { warmth: 0.7, closeness: 0.6, joy: 0.7, calm: 0.8, spontaneity: 0.2 },   // relief
    ];
    expect(new Set(moods.map(sig)).size).toBe(moods.length);
  });
});

describe("the flash budget", () => {
  it("scales large elements to the swing cap and is idempotent", () => {
    const f: Frame = { wash: 0.2, glow: { x: 0.5, y: 0.5, r: 0.9, a: 0.5, hold: 0 }, layers: [{ kind: "blob", x: 0.5, y: 0.9, r: 0.8, a: 0.3, dh: 0 }], items: [] };
    const c = capFrame(f, 0.6);
    expect(largeSwing(c)).toBeLessThanOrEqual(MAX_LARGE_SWING + 1e-9);
    expect(capFrame(c, 0.6)).toEqual(c);
  });
  it("drops small elements past the area and count caps, and caps their opacity", () => {
    const dots = Array.from({ length: 200 }, (_, i) => ({ kind: "dot" as const, x: 0.5, y: 0.5, r: 0.05, w: 0, a: 1 + i }));
    const c = capFrame({ wash: 0, glow: null, layers: [], items: dots }, 0.6);
    expect(c.items.length).toBeLessThanOrEqual(MAX_ITEMS);
    expect(c.items.reduce((s, i) => s + Math.PI * i.r * i.r * 0.6, 0)).toBeLessThanOrEqual(MAX_SMALL_AREA + 1e-9);
    expect(Math.max(...c.items.map((i) => i.a))).toBeLessThanOrEqual(0.5);
  });
  it("gives saturated red no large pulse", () => {
    const red = base({ h: 0, s: 1, l: 0.45, secondary: undefined, motion: "pulse", sync: "beat" });
    expect(isSaturatedRed(hslToRgb(0, 1, 0.45))).toBe(true);
    expect(redFactor(red)).toBe(0);
    expect(drawFrame({ colour: red, bpm: 100, beats: 8, t: 0 }).wash).toBe(0);
    expect(redFactor(base({ h: 220 }))).toBe(1);
  });
  it("saturated red pulses nothing large, in any scene: the layers stay flat across a beat", () => {
    for (const scene of SCENES) {
      const c = base({ h: 0, s: 1, l: 0.45, motion: "pulse", scene, density: 0.8, sync: "beat", feel: { ...moodToFeel(mood), depth: 1, jitter: 0.9 } });
      const total = (beats: number) => largeSwing(drawFrame({ colour: c, bpm: 120, beats, t: 0, seed: 4 }));
      const vals = [0, 0.1, 0.25, 0.5, 0.75].map((p) => total(40 + p));
      if (scene === "aurora" || scene === "fog") continue; // these drift on their own slow clock, not on the beat: checked below
      expect(Math.max(...vals) - Math.min(...vals)).toBeLessThan(0.004);
    }
    const slow = (scene: "aurora" | "fog") => { const c = base({ h: 0, s: 1, l: 0.45, scene, density: 0.8, sync: "beat" }); const v = [0, 0.25, 0.5, 0.75].map((p) => largeSwing(drawFrame({ colour: c, bpm: 120, beats: 40 + p, t: 0 }))); return Math.max(...v) - Math.min(...v); };
    expect(slow("aurora")).toBeLessThan(0.004); expect(slow("fog")).toBeLessThan(0.004);
  });
  it("steps the wash and glow back with the crossfade, never in one frame", () => {
    const c = base({ motion: "breathe", scene: "fog", density: 0.6, sync: "phrase" });
    const g = (from?: { k: number }) => drawFrame({ colour: c, bpm: 100, beats: 24, t: 0, seed: 2, from: from ? { scene: "motes", ...from } : undefined }).glow!.a;
    expect(g()).toBeCloseTo(g({ k: 0.9995 }), 3);
    expect(g({ k: 0.998 })).toBeCloseTo(g(), 3);
    expect(g({ k: 0.5 })).toBeGreaterThan(g() + 1e-4); // half way: between the two
    expect(g({ k: 0 })).toBeGreaterThan(g({ k: 0.5 }));
  });
  it("property: no random state ever swings large areas by 10% of luminance, at any tempo, glide or scene, scene switches included", () => {
    let seed = 12345;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const motions = ["still", "drift", "pulse", "breathe"] as const, scenes = ["none", ...SCENES] as const, syncs = ["beat", "phrase", "free"] as const;
    for (let run = 0; run < 220; run++) {
      const feel = { depth: rnd(), lift: rnd(), jitter: rnd(), soft: rnd(), near: rnd(), irreg: rnd() };
      const c = base({
        h: rnd() * 360, s: rnd(), l: 0.05 + rnd() * 0.55, motion: motions[Math.floor(rnd() * 4)], scene: scenes[Math.floor(rnd() * scenes.length)], sync: syncs[Math.floor(rnd() * 3)],
        density: rnd(), speed: rnd(), feel,
      });
      const other = scenes[Math.floor(rnd() * scenes.length)];
      const aspect = 0.4 + rnd() * 1.4, minW = rnd() * 0.004;
      const baseL = relLuminance(hslToRgb(c.h, c.s, c.l));
      let beats = rnd() * 100, bpm = 30 + rnd() * 170;
      const swings: number[] = [];
      for (let i = 0; i < 480; i++) { // 8 s at 60 fps, with a tempo change every second and a scene crossfade over the middle two seconds
        if (i % 60 === 0) bpm = 30 + rnd() * 170;
        beats += bpm / 60 / 60;
        const k = Math.min(1, Math.max(0, (i - 180) / 120));
        const f = drawFrame({ colour: c, bpm, beats, t: i / 60, seed: run, from: k < 1 ? { scene: other, density: rnd() < 2 ? 0.9 : 0, speed: 0.5, k } : undefined }, aspect, minW);
        swings.push(baseL + largeSwing(f) * (1 - baseL)); // the worst pixel, white over the base, no area discount
        expect(largeSwing(f)).toBeLessThanOrEqual(MAX_LARGE_SWING + 1e-9);
        expect(f.items.length).toBeLessThanOrEqual(MAX_ITEMS);
        expect(f.items.reduce((s, it) => s + itemArea(it, aspect, minW), 0)).toBeLessThanOrEqual(MAX_SMALL_AREA + 1e-9);
      }
      for (let i = 0; i + 60 <= swings.length; i += 10) {
        const win = swings.slice(i, i + 60);
        expect(Math.max(...win) - Math.min(...win)).toBeLessThan(0.1);
      }
    }
  });
  it("a scene fades in and out over the crossfade: nothing of the new one at k=0, nothing of the old one at k=1", () => {
    const c = base({ scene: "fog", density: 0.8 });
    const at = (k: number) => drawFrame({ colour: c, bpm: 90, beats: 10, t: 0, seed: 3, from: { scene: "rain", density: 0.8, speed: 0.4, k } });
    expect(at(0).layers.every((l) => l.a < 1e-9 || l.kind === "blob")).toBe(true);
    expect(largeSwing(at(0.5)) - at(0.5).wash).toBeGreaterThan(0);
    const drops = (k: number) => at(k).items.filter((i) => i.kind === "streak").length;
    expect(drops(1)).toBe(0);
    expect(drops(0)).toBeGreaterThan(20);
    expect(at(0).layers.reduce((s, l) => s + l.a, 0)).toBeLessThan(at(1).layers.reduce((s, l) => s + l.a, 0));
  });
  it("every scene draws something, and the layers of a scene are bounded blobs and ribbons", () => {
    for (const scene of SCENES) {
      const f = visualFrame({ colour: base({ scene, density: 0.6, speed: 0.5, feel: moodToFeel(mood) }), bpm: 90, beats: 12.3, t: 1, seed: 5 });
      expect(f.items.length + f.layers.length).toBeGreaterThan(0);
      for (const i of f.items) { expect(Number.isFinite(i.x + i.y + i.r + i.w + i.a)).toBe(true); }
    }
  });
});

describe("emotions in the picture", () => {
  // the player stretches the axes before the mapping (stretchMood), so the test does too
  const e = (o: Partial<typeof mood> & { tension?: number }) => moodToScene(stretchMood({ ...mood, ...o }))?.scene ?? "none";
  it("gives each emotion its own kind of scene, and nothing for a neutral mood", () => {
    expect(e({})).toBe("none");
    expect(e({ joy: 0.1, calm: 0.8, warmth: 0.3, closeness: 0.4, spontaneity: 0.2, tension: 0.05 })).toBe("rain");     // sad
    expect(e({ joy: 0.15, calm: 0.85, warmth: 0.2, closeness: 0.1, spontaneity: 0.2, tension: 0 })).toBe("snow");   // lonely
    expect(e({ joy: 0.25, calm: 0.8, warmth: 0.75, closeness: 0.7, spontaneity: 0.3, tension: 0.05 })).toBe("fog");    // melancholic
    expect(e({ joy: 0.12, calm: 0.12, warmth: 0.5, closeness: 0.4, spontaneity: 0.6, tension: 0.85 })).toBe("embers"); // angry
    expect(e({ joy: 0.12, calm: 0.12, warmth: 0.1, closeness: 0.3, spontaneity: 0.6, tension: 0.85 })).toBe("rain");   // cold anger: a storm
    expect(e({ joy: 0.9, calm: 0.3, warmth: 0.7, closeness: 0.6, spontaneity: 0.6, tension: 0 })).toBe("motes");       // happy
    expect(e({ joy: 0.7, calm: 0.9, warmth: 0.5, closeness: 0.1, spontaneity: 0.3, tension: 0 })).toBe("aurora");      // awe
    expect(e({ joy: 0.6, calm: 0.75, warmth: 0.9, closeness: 0.9, spontaneity: 0.3, tension: 0 })).toBe("embers");     // tender
    expect(e({ joy: 0.55, calm: 0.25, warmth: 0.4, closeness: 0.4, spontaneity: 0.6, tension: 0.5 })).toBe("ripples");   // nervous
  });
  it("shapes the same scene by the mood: a storm leans and flickers, a drizzle falls straight", () => {
    const rain = (jitter: number) => visualFrame({ colour: base({ scene: "rain", density: 0.7, speed: 0.5, feel: { ...moodToFeel(mood), jitter } }), bpm: 90, beats: 20, t: 0, seed: 2 }).items.filter((i) => i.kind === "streak");
    const lean = (jitter: number) => rain(jitter).reduce((s, i) => s + (i.ang ?? 0), 0) / rain(jitter).length;
    expect(lean(0.9)).toBeGreaterThan(lean(0) + 0.2);
  });
  it("keeps the same auto scene and the same positions for moods a little apart", () => {
    const a = { joy: 0.12, calm: 0.75, warmth: 0.3, closeness: 0.4, spontaneity: 0.2, tension: 0.05 }, b = { ...a, joy: 0.14, calm: 0.78, tension: 0.08 };
    expect(moodToScene(a)).toEqual(moodToScene(b));
    const frame = (m: typeof a) => { const c = moodToColour(m, 1500, 0.3); return visualFrame({ colour: c, bpm: 80, beats: 3000.5, t: 0, seed: 9 }).items.map(({ x, y }) => [x, y]); };
    const fa = frame(a), fb = frame(b);
    expect(fa.length).toBeGreaterThan(20); expect(fb.length).toBe(fa.length);
    fa.forEach(([x, y], i) => expect(Math.hypot(x - fb[i][0], y - fb[i][1])).toBeLessThan(0.03));
  });
  it("marks a scene the mood picked, and the model's own scene replaces it", () => {
    const c = moodToColour(stretchMood({ ...mood, joy: 0.1, calm: 0.8, warmth: 0.3, closeness: 0.4, spontaneity: 0.2, tension: 0.05 }), 1500, 0.3);
    expect(c.scene).toBe("rain"); expect(c.sceneAuto).toBe(true);
    const own = applyColour(c, { scene: "snow" });
    expect(own.scene).toBe("snow"); expect(own.sceneAuto).toBeUndefined();
    expect(applyColour(c, { scene: "none" }).scene).toBe("none");
  });
});

describe("limits", () => {
  it("hardCaps keeps the new fields in range and the old pulse under 3 Hz", () => {
    const s = neutralState(); s.colour = base({ motion: "pulse", pulseHz: 9, density: 4, speed: -1, feel: { depth: 3, lift: -2, jitter: 0, soft: 0, near: 0, irreg: 0 } });
    const { effective, clamps } = applyLimits({ mapped: s });
    expect(effective.colour.pulseHz).toBe(3); expect(effective.colour.density).toBe(1); expect(effective.colour.speed).toBe(0);
    expect(effective.colour.feel!.depth).toBe(1); expect(effective.colour.feel!.lift).toBe(0);
    expect(clamps.length).toBe(1);
  });
});

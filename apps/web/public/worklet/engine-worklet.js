"use strict";
(() => {
  // src/filter.ts
  var Biquad = class {
    b0 = 1;
    b1 = 0;
    b2 = 0;
    a1 = 0;
    a2 = 0;
    z1 = 0;
    z2 = 0;
    set(type, cutoff, q, sampleRate2) {
      const f = Math.min(Math.max(cutoff, 20), 0.45 * sampleRate2);
      const w0 = 2 * Math.PI * f / sampleRate2;
      const cos = Math.cos(w0);
      const alpha = Math.sin(w0) / (2 * Math.max(q, 0.1));
      let b0, b1, b2;
      if (type === "lowpass") {
        b0 = (1 - cos) / 2;
        b1 = 1 - cos;
        b2 = b0;
      } else if (type === "highpass") {
        b0 = (1 + cos) / 2;
        b1 = -(1 + cos);
        b2 = b0;
      } else {
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
      }
      const a0 = 1 + alpha;
      this.b0 = b0 / a0;
      this.b1 = b1 / a0;
      this.b2 = b2 / a0;
      this.a1 = -2 * cos / a0;
      this.a2 = (1 - alpha) / a0;
    }
    process(x) {
      const y = this.b0 * x + this.z1;
      this.z1 = this.b1 * x - this.a1 * y + this.z2;
      this.z2 = this.b2 * x - this.a2 * y;
      return y;
    }
  };

  // src/fx.ts
  var PingPongDelay = class {
    constructor(sr) {
      this.sr = sr;
      const n = Math.ceil(1.5 * sr) + 4;
      this.l = new Float32Array(n);
      this.r = new Float32Array(n);
      this.time = 0.3 * sr;
      this.lpCoef = 1 - Math.exp(-2 * Math.PI * 4e3 / sr);
    }
    l;
    r;
    w = 0;
    lpL = 0;
    lpR = 0;
    time;
    lpCoef;
    /** Returns the wet signal (not mixed with the input). `timeSec` is smoothed here to avoid pitch jumps. */
    process(x, timeSec, feedback, out) {
      const target2 = Math.min(Math.max(timeSec, 0.01), 1.5) * this.sr;
      this.time += (target2 - this.time) * 5e-4;
      const n = this.l.length;
      let rp = this.w - this.time;
      if (rp < 0) rp += n;
      const i = Math.floor(rp), f = rp - i, j = (i + 1) % n;
      const yl = this.l[i] * (1 - f) + this.l[j] * f;
      const yr = this.r[i] * (1 - f) + this.r[j] * f;
      this.lpL += (yl - this.lpL) * this.lpCoef;
      this.lpR += (yr - this.lpR) * this.lpCoef;
      this.l[this.w] = x + feedback * this.lpR;
      this.r[this.w] = feedback * this.lpL;
      this.w = (this.w + 1) % n;
      out[0] = yl;
      out[1] = yr;
    }
  };
  var Comb = class {
    buf;
    i = 0;
    store = 0;
    constructor(len) {
      this.buf = new Float32Array(len);
    }
    process(x, fb, damp) {
      const y = this.buf[this.i];
      this.store = y * (1 - damp) + this.store * damp;
      this.buf[this.i] = x + this.store * fb;
      if (++this.i >= this.buf.length) this.i = 0;
      return y;
    }
  };
  var Allpass = class {
    buf;
    i = 0;
    constructor(len) {
      this.buf = new Float32Array(len);
    }
    process(x) {
      const b = this.buf[this.i];
      const y = -x + b;
      this.buf[this.i] = x + b * 0.5;
      if (++this.i >= this.buf.length) this.i = 0;
      return y;
    }
  };
  var COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  var ALLPASS = [556, 441, 341, 225];
  var SPREAD = 23;
  var Reverb = class {
    cl;
    cr;
    al;
    ar;
    constructor(sr) {
      const k = sr / 44100;
      const len = (n) => Math.max(8, Math.round(n * k));
      this.cl = COMBS.map((n) => new Comb(len(n)));
      this.cr = COMBS.map((n) => new Comb(len(n + SPREAD)));
      this.al = ALLPASS.map((n) => new Allpass(len(n)));
      this.ar = ALLPASS.map((n) => new Allpass(len(n + SPREAD)));
    }
    /** `size` 0..1 maps to room size 0.5..0.95. */
    process(x, size, out) {
      const fb = 0.5 + 0.45 * Math.min(Math.max(size, 0), 1);
      const inp = x * 0.015;
      let l = 0, r = 0;
      for (const c of this.cl) l += c.process(inp, fb, 0.4);
      for (const c of this.cr) r += c.process(inp, fb, 0.4);
      for (const a of this.al) l = a.process(l);
      for (const a of this.ar) r = a.process(r);
      out[0] = l;
      out[1] = r;
    }
  };

  // src/music.ts
  var SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
    pentatonic: [0, 2, 4, 7, 9],
    whole_tone: [0, 2, 4, 6, 8, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };
  var midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  function degreeToMidi(root, scale, degree) {
    const s = SCALES[scale];
    const i = Math.max(1, Math.round(degree)) - 1;
    return root + s[i % s.length] + 12 * Math.floor(i / s.length);
  }
  function buildCycle(root, scale, chord, octaves, pattern) {
    const base = (chord.length ? chord : [1]).map((d) => degreeToMidi(root, scale, d));
    const up = [];
    for (let o = 0; o < Math.max(1, octaves); o++) for (const n of base) up.push(n + 12 * o);
    switch (pattern) {
      case "down":
        return [...up].reverse();
      case "up_down":
        return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
      default:
        return up;
    }
  }

  // src/oscillator.ts
  function polyBlep(t, dt) {
    if (t < dt) {
      const x = t / dt;
      return x + x - x * x - 1;
    }
    if (t > 1 - dt) {
      const x = (t - 1) / dt;
      return x * x + x + x + 1;
    }
    return 0;
  }
  function oscSample(wave, phase, dt) {
    switch (wave) {
      case "sine":
        return Math.sin(6.283185307179586 * phase);
      case "triangle":
        return 4 * Math.abs((phase + 0.75) % 1 - 0.5) - 1;
      case "sawtooth":
        return 2 * phase - 1 - polyBlep(phase, dt);
      case "square":
        return (phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep((phase + 0.5) % 1, dt);
    }
  }

  // src/layer.ts
  var MAX_VOICES = 6;
  var MAX_PENDING = 8;
  var Voice = class {
    active = false;
    midi = 0;
    dt = 0;
    phases = [0, 0, 0];
    detuneMul = [1, 1, 1];
    n = 1;
    stage = 0;
    env = 0;
    held = 0;
    velocity = 1;
    atk = 0;
    decC = 0;
    sus = 0;
    relC = 0;
    wave = "sine";
    age = 0;
  };
  var ENV_FLOOR = 1e-4;
  var Layer = class {
    constructor(sr, rand, name, events) {
      this.sr = sr;
      this.rand = rand;
      this.name = name;
      this.events = events;
    }
    voices = Array.from({ length: MAX_VOICES }, () => new Voice());
    pendAt = new Float64Array(MAX_PENDING);
    pendMidi = new Int16Array(MAX_PENDING);
    pendLen = new Float64Array(MAX_PENDING);
    pendCount = 0;
    cycle = [60];
    cycleKey = "";
    idx = 0;
    step = 0;
    nextStep = 0;
    p;
    reseed(rand) {
      this.rand = rand;
    }
    setEvents(e) {
      this.events = e;
    }
    configure(p) {
      this.p = p;
      const key = `${p.root}|${p.scale}|${p.chord.join(",")}|${p.octaves}|${p.pattern}`;
      if (key !== this.cycleKey) {
        this.cycleKey = key;
        this.cycle = buildCycle(p.root, p.scale, p.chord, p.octaves, p.pattern);
        if (this.idx >= this.cycle.length) this.idx = 0;
      }
    }
    /** One sample of the layer (mono, before level). `t` = sample counter, `pitchMul` = vibrato multiplier. */
    process(t, pitchMul) {
      const p = this.p;
      if (p.on && t >= this.nextStep) this.runStep(t);
      for (let i = 0; i < this.pendCount; ) {
        if (t >= this.pendAt[i]) {
          this.trigger(this.pendMidi[i], this.pendLen[i], t);
          const last = --this.pendCount;
          this.pendAt[i] = this.pendAt[last];
          this.pendMidi[i] = this.pendMidi[last];
          this.pendLen[i] = this.pendLen[last];
        } else i++;
      }
      let out = 0;
      for (const v of this.voices) {
        if (!v.active) continue;
        switch (v.stage) {
          case 0:
            v.env += v.atk;
            if (v.env >= 1) {
              v.env = 1;
              v.stage = 1;
            }
            break;
          case 1:
            v.env = v.sus + (v.env - v.sus) * v.decC;
            if (v.env - v.sus < 1e-3) v.stage = 2;
            break;
          case 2:
            break;
          default:
            v.env *= v.relC;
            if (v.env < ENV_FLOOR) {
              v.active = false;
              continue;
            }
        }
        if (v.stage < 3 && --v.held <= 0) v.stage = 3;
        let s = 0;
        for (let k = 0; k < v.n; k++) {
          const dt = v.dt * v.detuneMul[k] * pitchMul;
          s += oscSample(v.wave, v.phases[k], dt);
          v.phases[k] += dt;
          if (v.phases[k] >= 1) v.phases[k] -= 1;
        }
        out += s / Math.sqrt(v.n) * v.env * v.velocity;
      }
      return out * 0.3;
    }
    runStep(t) {
      const p = this.p, sr = this.sr;
      const stepS = p.stepSeconds * sr;
      const i = this.step++;
      this.nextStep = t + stepS;
      if (this.rand() > p.density) return;
      let midi;
      if (p.pattern === "random") midi = this.cycle[Math.floor(this.rand() * this.cycle.length)];
      else {
        midi = this.cycle[this.idx % this.cycle.length];
        this.idx = (this.idx + 1) % this.cycle.length;
      }
      let delay = i % 2 === 1 ? p.swing * 0.33 * stepS : 0;
      if (p.jitterMs > 0) delay += p.jitterMs / 1e3 * sr * (1 + (this.rand() * 2 - 1));
      if (this.pendCount < MAX_PENDING) {
        this.pendAt[this.pendCount] = t + delay;
        this.pendMidi[this.pendCount] = midi;
        this.pendLen[this.pendCount] = Math.max(1, p.gate * stepS);
        this.pendCount++;
      }
    }
    trigger(midi, lenSamples, t) {
      const p = this.p, sr = this.sr;
      let v = this.voices.find((x) => !x.active);
      if (!v) {
        v = this.voices.reduce((a, b) => a.age < b.age ? a : b);
      }
      v.active = true;
      v.midi = midi;
      v.dt = midiToHz(midi) / sr;
      v.n = Math.min(3, Math.max(1, Math.round(p.voices)));
      const d = Math.pow(2, p.detune / 1200);
      v.detuneMul[0] = v.n === 1 ? 1 : 1 / d;
      v.detuneMul[1] = v.n === 2 ? d : 1;
      v.detuneMul[2] = d;
      if (v.n === 3) {
        v.detuneMul[0] = 1 / d;
        v.detuneMul[1] = 1;
        v.detuneMul[2] = d;
      }
      for (let k = 0; k < 3; k++) v.phases[k] = this.rand();
      v.wave = p.wave;
      v.velocity = 0.8;
      v.stage = 0;
      v.env = 0;
      v.age = t;
      v.atk = 1 / Math.max(1, p.attack * sr);
      v.sus = Math.min(1, Math.max(0, p.sustain));
      v.decC = Math.exp(-1 / Math.max(1, p.decay / 5 * sr));
      v.relC = Math.exp(-1 / Math.max(1, p.release / 5 * sr));
      v.held = Math.max(1, Math.round(lenSamples));
      this.events?.push({ time: t / sr, midi, velocity: v.velocity, layer: this.name });
    }
  };

  // src/lfo.ts
  var Lfo = class {
    constructor(rand) {
      this.rand = rand;
      this.held = rand() * 2 - 1;
    }
    phase = 0;
    held = 0;
    value = 0;
    /** Advance by one sample, return a value in [-1, 1]. */
    next(shape, rate, sr) {
      this.phase += rate / sr;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.held = this.rand() * 2 - 1;
      }
      const p = this.phase;
      switch (shape) {
        case "sine":
          this.value = Math.sin(2 * Math.PI * p);
          break;
        case "triangle":
          this.value = 4 * Math.abs(p - 0.5) - 1;
          break;
        case "square":
          this.value = p < 0.5 ? 1 : -1;
          break;
        case "random":
          this.value = this.held;
          break;
      }
      return this.value;
    }
  };

  // src/prng.ts
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // src/engine.ts
  var BLOCK = 32;
  var RATE_BEATS = { "1/4": 1, "1/8": 0.5, "1/8t": 1 / 3, "1/16": 0.25 };
  var KEYS = [
    "tempo",
    "cutoff",
    "resonance",
    "volume",
    "droneLevel",
    "bassLevel",
    "delayTime",
    "delayFb",
    "delayMix",
    "revSize",
    "revMix",
    "width",
    "detune",
    "drive",
    "lfo0Rate",
    "lfo0Depth",
    "lfo1Rate",
    "lfo1Depth",
    "gate",
    "swing",
    "density",
    "jitterMs",
    "attack",
    "decay",
    "sustain",
    "release",
    "bassStep"
  ];
  function target(s) {
    return {
      tempo: s.arp.tempo,
      cutoff: s.filter.cutoff,
      resonance: s.filter.resonance,
      volume: s.volume,
      droneLevel: s.drone.on ? s.drone.level : 0,
      bassLevel: s.bass.on ? s.bass.level : 0,
      delayTime: s.fx.delay.time,
      delayFb: s.fx.delay.feedback,
      delayMix: s.fx.delay.mix,
      revSize: s.fx.reverb.size,
      revMix: s.fx.reverb.mix,
      width: s.pan.width,
      detune: s.osc.detune,
      drive: s.osc.drive,
      lfo0Rate: s.lfo[0]?.rate ?? 0,
      lfo0Depth: s.lfo[0]?.depth ?? 0,
      lfo1Rate: s.lfo[1]?.rate ?? 0,
      lfo1Depth: s.lfo[1]?.depth ?? 0,
      gate: s.arp.gate,
      swing: s.arp.swing,
      density: s.arp.density,
      jitterMs: s.arp.jitterMs,
      attack: s.env.attack,
      decay: s.env.decay,
      sustain: s.env.sustain,
      release: s.env.release,
      bassStep: s.bass.stepSeconds
    };
  }
  var Engine = class {
    constructor(sampleRate2, seed) {
      this.sampleRate = sampleRate2;
      this.lfos = [new Lfo(mulberry32(seed ^ 31)), new Lfo(mulberry32(seed ^ 47))];
      this.arp = new Layer(sampleRate2, mulberry32(seed ^ 161), "arp", null);
      this.bass = new Layer(sampleRate2, mulberry32(seed ^ 178), "bass", null);
      this.delay = new PingPongDelay(sampleRate2);
      this.reverb = new Reverb(sampleRate2);
    }
    state = null;
    cur;
    from;
    to;
    glideT = 1;
    glideDur = 1;
    // seconds
    t = 0;
    // samples rendered
    arp;
    bass;
    events = null;
    lfos;
    filter = new Biquad();
    delay;
    reverb;
    drones = [];
    listenerGain = 1;
    listenerGainCur = 1;
    listenerDelay = 0.5;
    delayCap = 0.6;
    hpZ = 0;
    tmp = [0, 0];
    tmp2 = [0, 0];
    /** Start recording note events (for offline analysis). */
    recordEvents(into) {
      this.events = into;
      this.arp.setEvents(into);
      this.bass.setEvents(into);
    }
    setListenerGain(gain) {
      this.listenerGain = Math.min(1, Math.max(0, gain));
    }
    /** Local echo control 0..1 (0.5 = as mapped). Scales the delay mix, capped at `maxMix`. */
    setListenerDelay(amount, maxMix = 0.6) {
      this.listenerDelay = Math.min(1, Math.max(0, amount));
      this.delayCap = maxMix;
    }
    /** Snapshot of the currently gliding continuous parameters (for tests and debugging). */
    params() {
      return this.cur;
    }
    setState(state, seed) {
      const to = target(state);
      const first = this.state === null;
      this.state = state;
      this.arp.reseed(mulberry32(seed ^ 161));
      this.bass.reseed(mulberry32(seed ^ 178));
      if (first) {
        this.cur = { ...to };
        this.from = { ...to };
        this.glideT = 1;
      } else {
        this.from = { ...this.cur };
        this.glideDur = state.transition.curve === "sudden" ? 0.03 : Math.max(0.03, state.transition.time);
        this.glideT = 0;
      }
      this.to = to;
      const want = /* @__PURE__ */ new Map();
      if (state.drone.on) for (const n of state.drone.notes) want.set(n, state.drone.wave);
      for (const d of this.drones) {
        d.goal = want.has(d.midi) ? 1 : 0;
        if (want.has(d.midi)) d.wave = want.get(d.midi);
        want.delete(d.midi);
      }
      for (const [midi, wave] of want) this.drones.push({ midi, gain: first ? 1 : 0, goal: 1, ph: [0, 0], wave });
    }
    layerParams() {
      const s = this.state, c = this.cur;
      const beat = 60 / Math.max(20, c.tempo);
      return {
        arp: {
          on: s.arp.on,
          root: s.arp.root,
          scale: s.arp.scale,
          chord: s.arp.chord,
          octaves: s.arp.octaves,
          pattern: s.arp.pattern,
          stepSeconds: beat * RATE_BEATS[s.arp.rate],
          gate: c.gate,
          swing: c.swing,
          density: c.density,
          jitterMs: c.jitterMs,
          wave: s.osc.wave,
          voices: s.osc.voices,
          detune: c.detune,
          attack: c.attack,
          decay: c.decay,
          sustain: c.sustain,
          release: c.release,
          level: 1
        },
        bass: {
          on: s.bass.on,
          root: s.bass.root,
          scale: s.bass.scale,
          chord: s.bass.chord,
          octaves: 1,
          pattern: "up_down",
          stepSeconds: Math.max(0.2, c.bassStep),
          gate: 1,
          swing: 0,
          density: 1,
          jitterMs: 0,
          wave: s.bass.wave,
          voices: 1,
          detune: 0,
          attack: 0.1,
          decay: 0.3,
          sustain: 0.8,
          release: 0.8,
          level: c.bassLevel
        }
      };
    }
    glide(dtSec) {
      if (this.glideT >= 1) return;
      this.glideT = Math.min(1, this.glideT + dtSec / this.glideDur);
      const x = this.glideT, e = x * x * (3 - 2 * x);
      for (const k of KEYS) {
        this.cur[k] = k === "cutoff" ? Math.pow(2, Math.log2(this.from.cutoff) * (1 - e) + Math.log2(this.to.cutoff) * e) : this.from[k] + (this.to[k] - this.from[k]) * e;
      }
    }
    process(left, right, frames) {
      const s = this.state, sr = this.sampleRate;
      if (!s) {
        left.fill(0, 0, frames);
        right.fill(0, 0, frames);
        return;
      }
      const l0 = s.lfo[0], l1 = s.lfo[1];
      const hpA = Math.exp(-2 * Math.PI * 25 / sr);
      let lp = this.layerParams();
      this.arp.configure(lp.arp);
      this.bass.configure(lp.bass);
      for (let i = 0; i < frames; i++) {
        if (i % BLOCK === 0) {
          this.glide(BLOCK / sr);
          lp = this.layerParams();
          this.arp.configure(lp.arp);
          this.bass.configure(lp.bass);
          this.filter.set(s.filter.type, this.cur.cutoff, this.cur.resonance, sr);
        }
        const c = this.cur;
        let cutMod = 0, pitchCents = 0, amp = 1, pan = 0;
        const lfoRaw = [
          l0 ? this.lfos[0].next(l0.shape, c.lfo0Rate, sr) : 0,
          l1 ? this.lfos[1].next(l1.shape, c.lfo1Rate, sr) : 0
        ];
        [l0, l1].forEach((l, k) => {
          if (!l) return;
          const depth = k === 0 ? c.lfo0Depth : c.lfo1Depth;
          if (l.target === "cutoff") cutMod += lfoRaw[k] * depth * 2;
          else if (l.target === "pitch") pitchCents += lfoRaw[k] * depth * 50;
          else if (l.target === "amp") amp *= 1 - depth * (0.5 + 0.5 * lfoRaw[k]);
          else pan += lfoRaw[k] * depth;
        });
        const pitchMul = pitchCents === 0 ? 1 : Math.pow(2, pitchCents / 1200);
        if (cutMod !== 0 && i % 8 === 0) this.filter.set(s.filter.type, c.cutoff * Math.pow(2, cutMod), c.resonance, sr);
        let x = this.arp.process(this.t, pitchMul) + this.bass.process(this.t, 1) * lp.bass.level;
        for (let d = this.drones.length - 1; d >= 0; d--) {
          const dr = this.drones[d];
          dr.gain += Math.sign(dr.goal - dr.gain) * Math.min(Math.abs(dr.goal - dr.gain), 1 / (3 * sr));
          if (dr.gain <= 0 && dr.goal === 0) {
            this.drones.splice(d, 1);
            continue;
          }
          const dt = midiToHz(dr.midi) / sr * pitchMul;
          x += (oscSample(dr.wave, dr.ph[0], dt) + oscSample(dr.wave, dr.ph[1], dt * 1.0012)) * 0.5 * dr.gain * c.droneLevel * 0.3;
          dr.ph[0] += dt;
          if (dr.ph[0] >= 1) dr.ph[0] -= 1;
          dr.ph[1] += dt * 1.0012;
          if (dr.ph[1] >= 1) dr.ph[1] -= 1;
        }
        if (c.drive > 1e-3) {
          const g2 = 1 + 4 * c.drive;
          x = Math.tanh(x * g2) / Math.tanh(g2);
        }
        x = this.filter.process(x) * amp;
        const dMix = Math.min(c.delayMix * 2 * this.listenerDelay, this.delayCap);
        this.delay.process(x, c.delayTime, Math.min(c.delayFb, 0.6), this.tmp);
        const dryL = x * (1 - Math.max(0, pan) * 0.5);
        const dryR = x * (1 + Math.min(0, pan) * 0.5);
        const mixL = dryL + this.tmp[0] * dMix, mixR = dryR + this.tmp[1] * dMix;
        this.reverb.process((mixL + mixR) * 0.5, c.revSize, this.tmp2);
        let outL = mixL * (1 - 0.5 * c.revMix) + this.tmp2[0] * c.revMix * 3;
        let outR = mixR * (1 - 0.5 * c.revMix) + this.tmp2[1] * c.revMix * 3;
        const m = (outL + outR) * 0.5, sd = (outL - outR) * 0.5 * c.width;
        outL = m + sd;
        outR = m - sd;
        this.listenerGainCur += (this.listenerGain - this.listenerGainCur) * (1 - Math.exp(-1 / (0.02 * sr)));
        const g = Math.min(c.volume, 0.9) * this.listenerGainCur;
        this.hpZ = hpA * this.hpZ + (1 - hpA) * ((outL + outR) * 0.5);
        outL = Math.tanh((outL - this.hpZ) * g);
        outR = Math.tanh((outR - this.hpZ) * g);
        left[i] = Math.max(-0.98, Math.min(0.98, outL));
        right[i] = Math.max(-0.98, Math.min(0.98, outR));
        this.t++;
      }
    }
  };

  // src/worklet.ts
  var EngineProcessor = class extends AudioWorkletProcessor {
    engine = new Engine(sampleRate, 1);
    constructor() {
      super();
      this.port.onmessage = (e) => {
        const m = e.data;
        if (m.type === "state") this.engine.setState(m.state, m.seed);
        else if (m.type === "gain") this.engine.setListenerGain(m.value);
        else if (m.type === "delay") this.engine.setListenerDelay(m.value, m.max);
      };
    }
    process(_inputs, outputs) {
      const out = outputs[0];
      if (out && out.length >= 2) this.engine.process(out[0], out[1], out[0].length);
      else if (out && out.length === 1) {
        const r = new Float32Array(out[0].length);
        this.engine.process(out[0], r, out[0].length);
      }
      return true;
    }
  };
  EngineProcessor.prototype.process = EngineProcessor.prototype.process;
  registerProcessor("sonorous-engine", EngineProcessor);
})();

import { scoreSeed } from "../content/score-seeds";
import { ATMOSPHERES, resolveSound, type Atmosphere, type Cue, type CueSound, type Mode } from "../content/sound";
import type { Section } from "../content/types";
import { buildTimeline, type Timeline } from "./timeline";
import { clamp, progress, smoothstep } from "./util";

/*
 * The score: generative music synthesised live with Web Audio (no audio
 * files). Like the stage, it follows the beat position `u`.
 *
 * - Each scene's `sound` (src/content/sound.ts) sets the atmosphere: mode,
 *   brightness, drone, santur, ney, bells, drums, wind and rumble. Changes
 *   glide in during the dive into the scene.
 * - Each couplet's appearance is answered by the voices in `answer`, plus any
 *   cue the scene ties to that couplet.
 * - Each portal opening rings a bell over a deep swell; the ending turns to
 *   the "radiance" atmosphere.
 *
 * Randomness comes from a generator seeded by the section id, so a section
 * read the same way plays the same music. Sections whose ids were aligned to
 * their chapter keep the seed they were reviewed with (`scoreSeed`).
 * `renderScore()` renders a whole
 * section offline to an AudioBuffer (scripts/listen.mjs writes it to a file).
 * sound/SOUND.md is the design guide.
 */

/** Seven steps in cents above the tonic. Koron (neutral) steps such as 150 and 350 are tuned exactly. */
const MODES: Record<Mode, { cents: readonly number[]; shahed: number }> = {
  shur: { cents: [0, 150, 300, 500, 700, 800, 1000], shahed: 2 },
  dashti: { cents: [0, 150, 300, 500, 700, 800, 1000], shahed: 4 },
  homayun: { cents: [0, 150, 400, 500, 700, 800, 1000], shahed: 3 },
  segah: { cents: [0, 150, 350, 500, 650, 850, 1000], shahed: 2 },
  chahargah: { cents: [0, 150, 400, 500, 700, 850, 1100], shahed: 4 },
  mahur: { cents: [0, 200, 400, 500, 700, 900, 1100], shahed: 4 },
};

/** D3. One tonic for the whole book, so sections join without a key change. */
const TONIC = 146.83;
const MASTER = 0.85;
const STORAGE_KEY = "shahnameh.sound";
const GLIDE = 1.6; // seconds for an atmosphere change to settle

/**
 * One audio context for the whole visit, so music can carry from the home
 * page into a section (and browsers only need to unlock audio once).
 */
let shared: AudioContext | undefined;
const context = () => (shared ??= new AudioContext({ latencyHint: "playback" }));

interface SceneScore {
  atmosphere: Atmosphere;
  cues: readonly Cue[];
}

export class Sound {
  private ctx?: BaseAudioContext;
  private master!: GainNode;
  private dry!: GainNode;
  private reverb!: ConvolverNode;
  private santurTone!: BiquadFilterNode;
  private santurBus!: GainNode;
  private neyBus!: GainNode;
  private bellBus!: GainNode;
  private hornBus!: GainNode;
  private drumBus!: GainNode;
  private lowBus!: GainNode;
  private droneGain!: GainNode;
  private droneFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private noise!: AudioBuffer;
  private neyWave!: PeriodicWave;
  private strings = new Map<number, AudioBuffer>();
  /** Sources that run for the life of the score (drone, beds), stopped on destroy. */
  private sustained: AudioScheduledSourceNode[] = [];

  private scores: SceneScore[];
  private ending: SceneScore = { atmosphere: ATMOSPHERES.radiance, cues: [] };
  private score: SceneScore;
  private random: () => number;
  private on = false;
  private prevU = 0;
  private nextNote = 0;
  private nextStep = 0;
  private stepIndex = 0;
  private quietUntil = 0;
  private degree = 2;
  private gestures = 0;

  constructor(
    private section: Section,
    private timeline: Timeline = buildTimeline(section),
  ) {
    this.scores = section.scenes.map((scene, i) => resolveSound(scene.sound, i === 0 ? "threshold" : "contemplative"));
    this.score = this.scores[0];
    this.random = seeded(scoreSeed[section.id] ?? section.id);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Sound is on unless the reader has turned it off (remembered across visits). */
  static get wanted() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  }

  get enabled() {
    return this.on;
  }

  /** Must be called from a user gesture (click, key, touch): browsers block audio otherwise. */
  async enable() {
    remember(true);
    if (!this.ctx) this.build(context());
    const ctx = this.ctx as AudioContext;
    await ctx.resume();
    this.on = true;
    this.fadeIn(ctx.currentTime);
  }

  disable() {
    remember(false);
    this.on = false;
    const ctx = this.ctx as AudioContext | undefined;
    if (!ctx) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => !this.on && ctx.suspend(), 1200);
  }

  /** Fade out and release this score's voices. The shared context stays open. */
  destroy() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.on = false;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.setTargetAtTime(0, t, 0.5);
    for (const src of this.sustained) src.stop(t + 3);
    setTimeout(() => this.master.disconnect(), 3200);
  }

  /** A bell over a deep swell: for moments outside the timeline, like entering from the home page. */
  ring() {
    if (this.on && this.ctx) this.portal(this.ctx.currentTime);
  }

  /** Live: called every frame with the camera's beat position and speed (beats/second). */
  update(u: number, speed: number) {
    const ctx = this.ctx;
    if (!this.on || !(ctx instanceof AudioContext) || ctx.state !== "running") {
      this.prevU = u;
      return;
    }
    this.step(u, speed, ctx.currentTime);
  }

  /**
   * Render a whole section offline, as a reader who scrolls to each couplet,
   * reads it and moves on. Deterministic for a given section.
   */
  static async renderScore(section: Section, sampleRate = 44100): Promise<AudioBuffer> {
    const timeline = buildTimeline(section);
    const path = readingPath(timeline);
    const ctx = new OfflineAudioContext(2, Math.ceil(path.duration * sampleRate), sampleRate);
    const sound = new Sound(section, timeline);
    document.removeEventListener("visibilitychange", sound.onVisibility);
    sound.build(ctx);
    sound.on = true;
    sound.fadeIn(0);
    const fps = 50;
    let prev = 0;
    for (let frame = 0; frame <= path.duration * fps; frame++) {
      const t = frame / fps;
      const u = path.at(t);
      sound.step(u, (u - prev) * fps, t);
      prev = u;
    }
    return ctx.startRendering();
  }

  // ------------------------------------------------------------ conductor

  private step(u: number, speed: number, t: number) {
    const { timeline } = this;

    // Where are we: which painting, inside a dive, or in the ending?
    let current = 0;
    let dive = -1;
    timeline.scenes.forEach((s, i) => {
      if (u >= s.diveStart) current = i;
      if (i > 0 && u >= s.diveStart && u < s.revealed) dive = progress(u, s.diveStart, s.revealed);
    });
    const te = progress(u, timeline.endingStart, timeline.total);
    const score = u >= timeline.endingStart ? this.ending : this.scores[current];
    if (score !== this.score) this.setScore(score, t);
    const a = score.atmosphere;

    // Events fire only when moving forward past them, and not on big jumps
    // (for example "back to the start").
    const prev = this.prevU;
    this.prevU = u;
    if (u > prev && u - prev < 1.5) {
      const crossed = (p: number) => prev < p && u >= p;
      for (const c of timeline.couplets) {
        if (!crossed(c.start + 0.14 * (c.end - c.start))) continue;
        const cue = this.scores[c.scene].cues.find((q) => q.couplet === c.number);
        if (cue) this.cue(cue.sound, t);
        if (cue?.sound !== "hush") this.answer(t);
      }
      for (const s of timeline.scenes.slice(1)) {
        if (crossed(s.diveStart + 0.45 * (s.revealed - s.diveStart))) this.portal(t);
      }
      if (crossed(timeline.endingStart + 0.2 * (timeline.total - timeline.endingStart))) this.radiance(t);
    }

    // Wind: the scene's air, scroll speed, and a rush through each dive.
    const rush = dive >= 0 ? Math.sin(Math.PI * dive) : 0;
    const motion = clamp(Math.abs(speed) / 1.6, 0, 1);
    this.windGain.gain.setTargetAtTime(a.wind * 0.06 + motion * 0.09 + rush * 0.12, t, 0.12);
    this.windFilter.frequency.setTargetAtTime(380 + motion * 1100 + (dive >= 0 ? dive * 2400 : 0), t, 0.15);

    // At the closing page, settle to a quiet drone.
    this.dry.gain.setTargetAtTime(1 - 0.55 * smoothstep(0.75, 1, te), t, 0.5);

    if (te > 0.7) return; // the light has flooded in: no more notes

    // Santur between couplets.
    if (a.santur > 0) {
      if (this.nextNote < t) this.nextNote = t + 0.05;
      while (this.nextNote < t + 0.15) {
        const base = 1 / a.santur;
        if (this.nextNote >= this.quietUntil) this.wander(this.nextNote, base);
        this.nextNote += base * this.pick([0.5, 0.75, 1, 1, 1.25, 1.5, 2]);
      }
    }

    // Drums: a 16-step loop in time, not tied to scrolling.
    if (a.drums && a.drums.level > 0) {
      const stepLength = 60 / a.drums.bpm / 4;
      if (this.nextStep < t) this.nextStep = t + 0.05;
      while (this.nextStep < t + 0.15) {
        const hit = a.drums.pattern[this.stepIndex % a.drums.pattern.length];
        const human = (this.random() - 0.5) * 0.012;
        const accent = this.stepIndex % 4 === 0 ? 1 : 0.8;
        this.drum(hit, this.nextStep + human, a.drums.level * accent * (0.9 + this.random() * 0.2));
        this.stepIndex++;
        this.nextStep += stepLength;
      }
    }
  }

  private setScore(score: SceneScore, t: number) {
    this.score = score;
    this.degree = MODES[score.atmosphere.mode].shahed;
    this.stepIndex = 0;
    this.applyAtmosphere(t, GLIDE);
  }

  private applyAtmosphere(t: number, tau: number) {
    const a = this.score.atmosphere;
    const bright = cutoff(a.brightness);
    this.droneFilter.frequency.setTargetAtTime(220 + bright * 0.28, t, tau);
    this.droneGain.gain.setTargetAtTime(a.drone * 0.11, t, tau);
    this.santurTone.frequency.setTargetAtTime(clamp(bright * 2.6, 1800, 9000), t, tau);
    this.rumbleGain.gain.setTargetAtTime(a.rumble * 0.5, t, tau);
    this.drumBus.gain.setTargetAtTime(a.drums ? 1 : 0, t, tau * 0.5);
  }

  private fadeIn(t: number) {
    this.nextNote = t + 1.2;
    this.nextStep = t + 1.2;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.setTargetAtTime(MASTER, t, 0.9);
  }

  private onVisibility = () => {
    const ctx = this.ctx;
    if (!(ctx instanceof AudioContext) || !this.on) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };

  // --------------------------------------------------------------- graph

  private build(ctx: BaseAudioContext) {
    this.ctx = ctx;

    this.master = gain(ctx, 0);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    this.master.connect(limiter).connect(ctx.destination);

    this.dry = gain(ctx, 1);
    this.dry.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = impulse(ctx, 4.2, seeded(`${scoreSeed[this.section.id] ?? this.section.id}/hall`));
    this.reverb.connect(this.master);

    // Each voice has its own bus with a reverb send: [wet, level].
    this.santurTone = ctx.createBiquadFilter();
    this.santurTone.type = "lowpass";
    this.santurBus = this.bus(0.5, 0.42);
    this.santurTone.connect(this.santurBus);
    this.neyBus = this.bus(0.6, 0.55);
    this.bellBus = this.bus(0.9, 0.35);
    this.hornBus = this.bus(0.7, 0.32);
    this.drumBus = gain(ctx, 0);
    this.drumBus.connect(this.bus(0.3, 0.55));
    this.lowBus = this.bus(0.45, 1);

    this.noise = noiseBuffer(ctx, 3, seeded(`${scoreSeed[this.section.id] ?? this.section.id}/noise`));
    this.neyWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.32, 0.12, 0.05, 0.02]));

    // Drone: D2 body, D3 and A3 in slightly detuned pairs, D4 halo.
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = "lowpass";
    this.droneFilter.Q.value = 0.7;
    this.droneGain = gain(ctx, 0);
    this.droneFilter.connect(this.droneGain).connect(this.lowBus);
    const voices: [number, OscillatorType, number][] = [
      [TONIC / 2, "sine", 0.28],
      [TONIC, "sawtooth", 0.16],
      [TONIC * 1.003, "sawtooth", 0.14],
      [TONIC * 1.5, "triangle", 0.2],
      [TONIC * 1.5 * 0.998, "triangle", 0.16],
      [TONIC * 2, "sine", 0.12],
    ];
    for (const [f, type, level] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f;
      osc.connect(gain(ctx, level)).connect(this.droneFilter);
      osc.start();
      this.sustained.push(osc);
    }
    const breath = ctx.createOscillator(); // slow breathing in the drone's tone
    breath.frequency.value = 0.07;
    breath.connect(gain(ctx, 250)).connect(this.droneFilter.detune);
    breath.start();
    this.sustained.push(breath);

    // Wind: looping noise through a moving band-pass.
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.Q.value = 0.9;
    this.windGain = gain(ctx, 0);
    this.loopNoise().connect(this.windFilter).connect(this.windGain).connect(this.bus(0.4, 1));

    // Rumble: deep filtered noise that swells slowly, for armies and storms.
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 95;
    this.rumbleGain = gain(ctx, 0);
    const surge = gain(ctx, 0.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    lfo.connect(gain(ctx, 0.4)).connect(surge.gain);
    lfo.start();
    this.sustained.push(lfo);
    this.loopNoise().connect(low).connect(surge).connect(this.rumbleGain).connect(this.lowBus);

    this.applyAtmosphere(0, 0.01);
  }

  private bus(wet: number, level: number) {
    const ctx = this.ctx!;
    const g = gain(ctx, level);
    g.connect(this.dry);
    g.connect(gain(ctx, wet)).connect(this.reverb);
    return g;
  }

  private loopNoise() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = this.random() * 2; // decorrelate the loops
    src.start();
    this.sustained.push(src);
    return src;
  }

  // --------------------------------------------------------------- music

  private pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }

  /** Frequency of a scale step (may be negative or above 6) in the current mode. */
  private pitch(step: number, base = TONIC * 2) {
    const { cents } = MODES[this.score.atmosphere.mode];
    const octave = Math.floor(step / 7);
    return base * 2 ** (octave + cents[((step % 7) + 7) % 7] / 1200);
  }

  /** Between couplets: a slow line wandering around the mode's focal step. */
  private wander(when: number, base: number) {
    const a = this.score.atmosphere;
    const { shahed } = MODES[a.mode];
    if (this.random() < 0.18) return; // breathe
    let step = this.degree + this.pick([-2, -1, -1, -1, 0, 1, 1, 1, 2]);
    if (step > shahed + 5) step -= 2;
    if (step < shahed - 4) step += 2;
    this.degree = step;
    const f = this.pitch(step + 7 * a.register);
    const level = 0.16 + this.random() * 0.08;
    if (this.random() < 0.14 && base > 0.8) this.riz(f, when, 0.9, level * 0.8);
    else this.pluck(f, when, level, (this.random() - 0.5) * 0.6);
  }

  /** A couplet appears: each voice in the atmosphere's `answer` responds. */
  private answer(t: number) {
    const a = this.score.atmosphere;
    const { shahed } = MODES[a.mode];
    const n = this.gestures++;
    let quiet = 2.5;
    for (const voice of a.answer) {
      if (voice === "santur") {
        const reg = 7 * a.register;
        let when = t + 0.04;
        const run = n % 2 === 0 ? [4, 3, 2, 1, 0] : [-2, -1, 0]; // alternate, so couplets don't repeat
        run.forEach((d, i) => {
          this.pluck(this.pitch(shahed + d + reg), when, 0.12 + i * 0.03, 0.25 - i * 0.1);
          when += 0.12;
        });
        this.riz(this.pitch(shahed + reg), when, 1.1, 0.2);
        quiet = Math.max(quiet, 3);
      } else if (voice === "ney" && a.ney > 0) {
        const level = 0.1 * a.ney;
        this.ney(this.pitch(shahed), t + 0.5, 2.6, level);
        this.ney(this.pitch(shahed + (n % 3 === 2 ? 1 : -1)), t + 3.0, 1.9, level * 0.8);
        quiet = Math.max(quiet, 4.8);
      } else if (voice === "horn") {
        this.horn(this.pitch(0, TONIC / 2), t + 0.05, 1.3, 0.5);
        this.horn(this.pitch(4, TONIC / 2), t + 1.2, 1.8, 0.45);
        quiet = Math.max(quiet, 3);
      } else if (voice === "bell" && a.bells > 0) {
        this.bell(this.pitch(shahed + 14), t + 0.05, 0.08 * a.bells);
      } else if (voice === "drum") {
        this.drum("D", t + 0.02, 1);
        for (let i = 0; i < 6; i++) this.drum("t", t + 0.35 + i * 0.07, 0.3 + i * 0.08);
        this.drum("D", t + 0.8, 0.9);
      }
    }
    this.degree = shahed;
    this.quietUntil = t + quiet;
    this.nextNote = Math.max(this.nextNote, this.quietUntil);
  }

  /** A cue the scene ties to a couplet. */
  private cue(sound: CueSound, t: number) {
    if (sound === "strike") this.strike(t);
    else if (sound === "horn") this.horn(this.pitch(0, TONIC / 2), t, 3.5, 0.7);
    else if (sound === "gong") this.gong(t);
    else if (sound === "thunder") this.thunder(t);
    else if (sound === "hush") {
      this.dry.gain.cancelScheduledValues(t);
      this.dry.gain.setTargetAtTime(0.15, t, 0.25);
      this.dry.gain.setTargetAtTime(1, t + 4, 1);
      this.quietUntil = t + 5;
      this.nextNote = Math.max(this.nextNote, this.quietUntil);
      this.nextStep = Math.max(this.nextStep, this.quietUntil);
    }
  }

  /** A portal opens: a bell on the focal step and a low swell beneath. */
  private portal(t: number) {
    const a = this.score.atmosphere;
    this.bell(this.pitch(MODES[a.mode].shahed + 14), t, 0.09 * (0.4 + a.bells));
    this.swell(t, 0.22);
    this.quietUntil = Math.max(this.quietUntil, t + 1.5);
  }

  /** The light floods in: bells climb a bright chord and the ney sings the tonic. */
  private radiance(t: number) {
    [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => this.bell(this.pitch(d + 7), t + i * 0.32, 0.07));
    this.ney(this.pitch(7), t + 1.4, 5.5, 0.08);
    this.swell(t, 0.3);
  }

  // --------------------------------------------------------------- voices

  /** Santur: a Karplus–Strong string, doubled with a slight detune like a santur course. */
  private pluck(f: number, when: number, level: number, pan = 0) {
    const ctx = this.ctx!;
    const N = Math.max(8, Math.round(ctx.sampleRate / f));
    const buffer = this.string(N);
    const rate = f / (ctx.sampleRate / N);
    for (const detune of [-4, 4]) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate * 2 ** (detune / 1200);
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan + detune * 0.04, -1, 1);
      src.connect(gain(ctx, level * 0.5)).connect(p).connect(this.santurTone);
      src.start(when);
    }
  }

  /** Riz: the santur's tremolo, quick repeated strokes that fade. */
  private riz(f: number, when: number, length: number, level: number) {
    const strokes = Math.round(length / 0.065);
    for (let i = 0; i < strokes; i++) {
      const fade = 1 - i / strokes;
      this.pluck(f, when + i * 0.065 + this.random() * 0.008, level * (0.35 + 0.65 * fade) * (i % 2 ? 0.8 : 1), i % 2 ? 0.15 : -0.15);
    }
  }

  private string(N: number) {
    const cached = this.strings.get(N);
    if (cached) return cached;
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * 3.4);
    const data = new Float32Array(length);
    const ring = new Float32Array(N);
    const random = seeded(`string/${N}`);
    let smooth = 0;
    for (let i = 0; i < N; i++) {
      smooth = smooth * 0.25 + (random() * 2 - 1) * 0.75; // a hard hammer: bright attack
      ring[i] = smooth;
    }
    let i = 0;
    for (let n = 0; n < length; n++) {
      const a = ring[i];
      const b = ring[(i + 1) % N];
      data[n] = a;
      ring[i] = (a * 0.55 + b * 0.45) * 0.9985;
      i = (i + 1) % N;
    }
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    buffer.copyToChannel(data, 0);
    this.strings.set(N, buffer);
    return buffer;
  }

  /** Ney: a soft, breathy tone that slides into pitch and grows a vibrato. */
  private ney(f: number, when: number, length: number, level: number) {
    const ctx = this.ctx!;
    const end = when + length;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.neyWave);
    osc.frequency.setValueAtTime(f * 0.985, when);
    osc.frequency.exponentialRampToValueAtTime(f, when + 0.22);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 4.8;
    const depth = gain(ctx, 0);
    depth.gain.setValueAtTime(0, when);
    depth.gain.linearRampToValueAtTime(f * 0.007, when + Math.min(1.2, length * 0.6));
    vibrato.connect(depth).connect(osc.frequency);

    const env = envelope(ctx, when, end, level, 0.4, 0.7);
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const band = filter(ctx, "bandpass", f * 2, 2);
    air.connect(band).connect(gain(ctx, 0.35)).connect(env);
    osc.connect(filter(ctx, "lowpass", 2600)).connect(env).connect(this.neyBus);
    for (const node of [osc, vibrato, air]) {
      node.start(when);
      node.stop(end + 0.05);
    }
  }

  /** Karnay: a long, rough brass call that blooms and fades. */
  private horn(f: number, when: number, length: number, level: number) {
    const ctx = this.ctx!;
    const end = when + length;
    const env = envelope(ctx, when, end, level, 0.25, 0.6);
    const tone = filter(ctx, "lowpass", 300, 2.5);
    tone.frequency.setValueAtTime(300, when);
    tone.frequency.linearRampToValueAtTime(1500, when + 0.35);
    tone.frequency.linearRampToValueAtTime(800, end);
    tone.connect(env).connect(this.hornBus);
    for (const [ratio, type, amp] of [
      [1, "sawtooth", 0.5],
      [1.004, "sawtooth", 0.45],
      [0.5, "square", 0.2],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f * ratio * 0.97, when);
      osc.frequency.exponentialRampToValueAtTime(f * ratio, when + 0.15);
      osc.connect(gain(ctx, amp)).connect(tone);
      osc.start(when);
      osc.stop(end + 0.05);
    }
  }

  /** Percussion strokes: D dum, t tak, k soft ka, j daf jingle. */
  private drum(hit: string, when: number, level: number) {
    const ctx = this.ctx!;
    if (hit === "D") {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(115, when);
      osc.frequency.exponentialRampToValueAtTime(48, when + 0.3);
      osc.connect(envelope(ctx, when, when + 0.7, level * 0.9, 0.003, 0.65, true)).connect(this.drumBus);
      osc.start(when);
      osc.stop(when + 0.75);
      this.burst(when, 0.03, "lowpass", 1400, level * 0.4);
    } else if (hit === "t" || hit === "k") {
      const soft = hit === "k" ? 0.5 : 1;
      this.burst(when, 0.07, "bandpass", 2300, level * 0.55 * soft, 3);
      const ring = ctx.createOscillator();
      ring.frequency.value = 430;
      ring.connect(envelope(ctx, when, when + 0.1, level * 0.2 * soft, 0.002, 0.09, true)).connect(this.drumBus);
      ring.start(when);
      ring.stop(when + 0.12);
    } else if (hit === "j") {
      for (let i = 0; i < 4; i++) this.burst(when + i * 0.018, 0.22 - i * 0.04, "highpass", 5200, level * 0.25 * (1 - i * 0.2));
    }
  }

  /** A short shaped noise burst into the drum bus. */
  private burst(when: number, length: number, type: BiquadFilterType, f: number, level: number, q = 0.8) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.connect(filter(ctx, type, f, q)).connect(envelope(ctx, when, when + length, level, 0.002, length * 0.9, true)).connect(this.drumBus);
    src.start(when, this.random() * 2);
    src.stop(when + length + 0.02);
  }

  /** Bell: inharmonic partials with their own decays. */
  private bell(f: number, when: number, level: number) {
    this.partials(f, when, level, [
      [1, 1, 4.5],
      [2.76, 0.45, 2.6],
      [5.4, 0.22, 1.5],
      [8.93, 0.1, 0.8],
    ]);
  }

  /** Steel on steel: bright clashing partials over a hiss. */
  private strike(when: number) {
    this.partials(1250, when, 0.09, [
      [1, 1, 1.6],
      [1.47, 0.8, 1.2],
      [2.39, 0.6, 0.9],
      [3.91, 0.4, 0.6],
      [5.3, 0.3, 0.4],
    ]);
    this.burst(when, 0.08, "highpass", 3000, 0.5);
  }

  /** A deep gong: slow-beating low partials with a long decay. */
  private gong(when: number) {
    this.partials(TONIC / 2, when, 0.22, [
      [1, 1, 8],
      [1.48, 0.7, 6],
      [2.1, 0.5, 5],
      [2.73, 0.35, 3.5],
      [3.6, 0.2, 2.5],
    ]);
  }

  /** Thunder: a crack, then a long low roll. */
  private thunder(when: number) {
    const ctx = this.ctx!;
    this.burst(when, 0.25, "bandpass", 900, 0.5, 0.6);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.connect(filter(ctx, "lowpass", 180)).connect(envelope(ctx, when, when + 5, 0.9, 0.12, 4.6, true)).connect(this.lowBus);
    src.start(when);
    src.stop(when + 5.1);
  }

  private partials(f: number, when: number, level: number, partials: readonly (readonly [number, number, number])[]) {
    const ctx = this.ctx!;
    for (const [ratio, amp, decay] of partials) {
      const osc = ctx.createOscillator();
      osc.frequency.value = f * ratio;
      osc.connect(envelope(ctx, when, when + decay, level * amp, 0.006, decay, true)).connect(this.bellBus);
      osc.start(when);
      osc.stop(when + decay + 0.05);
    }
  }

  /** A deep swell under a portal: the feeling of falling into space. */
  private swell(when: number, level: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(TONIC / 2, when);
    osc.frequency.exponentialRampToValueAtTime(TONIC / 4, when + 2.8);
    osc.connect(envelope(ctx, when, when + 3, level, 0.5, 2.5, true)).connect(this.lowBus);
    osc.start(when);
    osc.stop(when + 3.1);
  }
}

// ---------------------------------------------------------------- helpers

/** Filter cutoff in Hz for a brightness of 0–1. */
function cutoff(brightness: number) {
  return 500 * 2 ** (clamp(brightness, 0, 1) * 3.3);
}

function gain(ctx: BaseAudioContext, value: number) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** A gain envelope: attack to `level`, hold, then release (exponential for percussive decays). */
function envelope(ctx: BaseAudioContext, when: number, end: number, level: number, attack: number, release: number, percussive = false) {
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(level, when + attack);
  if (percussive) {
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    g.gain.linearRampToValueAtTime(level * 0.85, Math.max(when + attack, end - release));
    g.gain.linearRampToValueAtTime(0, end);
  }
  return g;
}

/** A small seeded random generator (mulberry32), so the music is reproducible. */
function seeded(key: string) {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, random: () => number) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
  return buffer;
}

/** A dark, wide hall: decaying stereo noise that loses its highs over time. */
function impulse(ctx: BaseAudioContext, seconds: number, random: () => number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const k = 0.15 + 0.8 * t; // more smoothing as the tail decays
      low = low * k + (random() * 2 - 1) * (1 - k);
      data[i] = low * (1 - t) ** 2.4 * (1 + t);
    }
  }
  return buffer;
}

function remember(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* private mode: just don't remember */
  }
}

/**
 * A typical reader for offline renders: pause on the title, scroll to each
 * couplet and read it, then let the ending play out.
 */
function readingPath(timeline: Timeline) {
  const stops: { u: number; hold: number }[] = [{ u: 0, hold: 6 }];
  for (const c of timeline.couplets) stops.push({ u: c.start + 0.5 * (c.end - c.start), hold: 5 });
  stops.push({ u: timeline.total, hold: 8 });
  const segments: { t0: number; t1: number; u0: number; u1: number }[] = [];
  let t = 0;
  for (let i = 0; i < stops.length; i++) {
    const prev = stops[i - 1];
    if (prev) {
      const travel = 1.1 + 0.7 * (stops[i].u - prev.u);
      segments.push({ t0: t, t1: t + travel, u0: prev.u, u1: stops[i].u });
      t += travel;
    }
    segments.push({ t0: t, t1: t + stops[i].hold, u0: stops[i].u, u1: stops[i].u });
    t += stops[i].hold;
  }
  return {
    duration: t,
    at(time: number) {
      const s = segments.find((x) => time < x.t1) ?? segments[segments.length - 1];
      const k = clamp((time - s.t0) / (s.t1 - s.t0), 0, 1);
      return s.u0 + (s.u1 - s.u0) * (0.5 - 0.5 * Math.cos(Math.PI * k));
    },
  };
}

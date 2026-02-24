# Audio System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace thin synthetic SFX with rich, layered Web Audio sounds and add procedural reggae background music that reacts to game state.

**Architecture:** Two modules — upgrade existing `SoundManager` SFX synthesis in-place, and create a new `MusicEngine` class that generates reggae music procedurally using Web Audio API oscillators/noise scheduled via a sequencer loop. MusicEngine fades instrument stems in/out based on `GameState`. Both modules integrate into `GameController` (AI games) and `OnlineGameController` (multiplayer).

**Tech Stack:** Web Audio API (AudioContext, OscillatorNode, BiquadFilterNode, GainNode, AudioBufferSourceNode), existing Howler.js fallback retained for future MP3 assets.

---

### Task 1: Upgrade SFX Synthesis in SoundManager

**Files:**
- Modify: `apps/web/src/audio/SoundManager.ts`

**Step 1: Rewrite `initSynthetic()` and all synth methods**

Replace the thin single-oscillator sounds with richer layered synthesis. The new implementations:

**dice-roll** — Shaker rattle: 3 staggered noise grains with bandpass sweep + resonant body
```typescript
"dice-roll": () => this.synthShaker(),
```
```typescript
private synthShaker(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  // 3 staggered noise grains with descending bandpass sweep
  for (let i = 0; i < 3; i++) {
    const startTime = ctx.currentTime + i * 0.03;
    const duration = 0.06;
    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = (Math.random() * 2 - 1) * 0.5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(3000 - i * 600, startTime);
    bp.frequency.exponentialRampToValueAtTime(1200, startTime + duration);
    bp.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.4, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    source.connect(bp).connect(gain).connect(ctx.destination);
    source.start(startTime);
    source.stop(startTime + duration);
  }
  // Add a low body thump
  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(180, ctx.currentTime);
  body.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(vol * 0.2, ctx.currentTime);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  body.connect(bodyGain).connect(ctx.destination);
  body.start();
  body.stop(ctx.currentTime + 0.08);
}
```

**piece-move** — Woody knock: filtered noise burst + resonant body tone
```typescript
"piece-move": () => this.synthWoodKnock(),
```
```typescript
private synthWoodKnock(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Noise click
  const clickDur = 0.015;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * clickDur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(vol * 0.3, t);
  clickGain.gain.exponentialRampToValueAtTime(0.001, t + clickDur);
  src.connect(hp).connect(clickGain).connect(ctx.destination);
  src.start(t);
  src.stop(t + clickDur);
  // Resonant body
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = 220;
  bpf.Q.value = 8;
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.2, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(bpf).connect(oscGain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.06);
}
```

**piece-hit** — Deep 808 boom + echo tail
```typescript
"piece-hit": () => this.synth808Boom(),
```
```typescript
private synth808Boom(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // 808 kick: sine with steep pitch drop
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  // Distortion via waveshaper for warmth
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
  }
  shaper.curve = curve;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol * 0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(shaper).connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.35);
  // Click transient
  const click = ctx.createOscillator();
  click.type = "square";
  click.frequency.value = 800;
  const clickG = ctx.createGain();
  clickG.gain.setValueAtTime(vol * 0.15, t);
  clickG.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
  click.connect(clickG).connect(ctx.destination);
  click.start(t);
  click.stop(t + 0.01);
}
```

**bear-off** — Steel drum ting: inharmonic partials + shimmer delay
```typescript
"bear-off": () => this.synthSteelDrum(),
```
```typescript
private synthSteelDrum(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Steel drum: multiple inharmonic partials
  const freqs = [523, 659, 1047, 1318, 1568]; // C5 + harmonics, slightly inharmonic
  const detune = [0, 12, -8, 15, -5];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol * 0.2, t);
  masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  masterGain.connect(ctx.destination);
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freqs[i];
    osc.detune.value = detune[i];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 / (i + 1), t); // Higher partials quieter
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4 - i * 0.04);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }
  // Attack click
  const noiseDur = 0.008;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.2, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  src.connect(ng).connect(ctx.destination);
  src.start(t);
  src.stop(t + noiseDur);
}
```

**victory** — Reggae horn stab: detuned saws + delay
```typescript
"victory": () => this.synthHornStab(),
```
```typescript
private synthHornStab(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Major chord: C5-E5-G5, two detuned oscillators per note
  const notes = [523, 659, 784];
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol * 0.2, t);
  masterGain.gain.setValueAtTime(vol * 0.2, t + 0.3);
  masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  // Low-pass for warmth
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3000, t);
  lp.frequency.exponentialRampToValueAtTime(800, t + 0.8);
  lp.connect(masterGain).connect(ctx.destination);
  for (const freq of notes) {
    for (const dt of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = dt;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + 0.8);
    }
  }
  // Second stab (echo)
  const t2 = t + 0.15;
  const echoGain = ctx.createGain();
  echoGain.gain.setValueAtTime(vol * 0.1, t2);
  echoGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.5);
  const lp2 = ctx.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = 1500;
  lp2.connect(echoGain).connect(ctx.destination);
  for (const freq of notes) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.connect(lp2);
    osc.start(t2);
    osc.stop(t2 + 0.5);
  }
}
```

**defeat** — Minor descending with low-pass sweep
```typescript
"defeat": () => this.synthDefeat(),
```
```typescript
private synthDefeat(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  // Descending minor: Eb5 -> C5 -> Ab4
  const notes = [622, 523, 415];
  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.2;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(lp).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  });
}
```

**double-offered** — Dub siren: pitch-swept oscillator with echo
```typescript
"double-offered": () => this.synthDubSiren(),
```
```typescript
private synthDubSiren(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Rising siren
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(900, t + 0.2);
  osc.frequency.exponentialRampToValueAtTime(400, t + 0.4);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2000;
  lp.Q.value = 5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.15, t);
  g.gain.setValueAtTime(vol * 0.15, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(lp).connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
  // Echo
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(400, t + 0.15);
  osc2.frequency.exponentialRampToValueAtTime(700, t + 0.35);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(vol * 0.06, t + 0.15);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  const lp2 = ctx.createBiquadFilter();
  lp2.type = "lowpass";
  lp2.frequency.value = 1200;
  osc2.connect(lp2).connect(g2).connect(ctx.destination);
  osc2.start(t + 0.15);
  osc2.stop(t + 0.5);
}
```

**ya-mon** — Synthesized vowel formant "ah" shape
```typescript
"ya-mon": () => this.synthVocalAh(),
```
```typescript
private synthVocalAh(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Vocal formant synthesis: buzz source + formant filters for "ah" vowel
  // "ah" formants: F1~730Hz, F2~1090Hz, F3~2440Hz
  const buzz = ctx.createOscillator();
  buzz.type = "sawtooth";
  buzz.frequency.setValueAtTime(140, t); // Male fundamental
  buzz.frequency.setValueAtTime(160, t + 0.1); // Slight rise for "mon"
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(vol * 0.15, t);
  masterGain.gain.setValueAtTime(vol * 0.15, t + 0.25);
  masterGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  masterGain.connect(ctx.destination);
  const formants = [
    { freq: 730, Q: 10, gain: 1.0 },
    { freq: 1090, Q: 12, gain: 0.5 },
    { freq: 2440, Q: 14, gain: 0.3 },
  ];
  for (const f of formants) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f.freq;
    bp.Q.value = f.Q;
    const fg = ctx.createGain();
    fg.gain.value = f.gain;
    buzz.connect(bp).connect(fg).connect(masterGain);
  }
  buzz.start(t);
  buzz.stop(t + 0.45);
}
```

**turn-start** — Rimshot: click + body resonance
```typescript
"turn-start": () => this.synthRimshot(),
```
```typescript
private synthRimshot(): void {
  const ctx = this.getAudioCtx();
  const vol = this.effectiveVolume();
  const t = ctx.currentTime;
  // Click transient
  const noiseDur = 0.005;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * noiseDur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2000;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
  src.connect(hp).connect(ng).connect(ctx.destination);
  src.start(t);
  src.stop(t + noiseDur);
  // Resonant body
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 820;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 820;
  bp.Q.value = 15;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  osc.connect(bp).connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}
```

**Step 2: Remove old synth methods, keep Howl loading**

Delete these old methods: `synthNoiseBurst`, `synthTone`, `synthAscending`, `synthDescending`, `synthChord`, `synthDoubleBeep`, `synthClick`. The Howl loading stays — if MP3s are dropped in later they'll override synthesis.

**Step 3: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 4: Manual test**

Run: `npm run dev` — play a game, verify each SFX fires and sounds richer than before.

**Step 5: Commit**

```bash
git add apps/web/src/audio/SoundManager.ts
git commit -m "feat(audio): upgrade all 9 SFX to rich layered Web Audio synthesis"
```

---

### Task 2: Create MusicEngine — Procedural Reggae Background Music

**Files:**
- Create: `apps/web/src/audio/MusicEngine.ts`

**Step 1: Write the MusicEngine class**

This is the core — a procedural reggae music generator using Web Audio API. It schedules notes ahead of time using `AudioContext.currentTime` and a lookahead scheduler pattern.

```typescript
// apps/web/src/audio/MusicEngine.ts

export type MusicMood = "chill" | "moving" | "tension" | "climax";

const BPM = 75;
const BEAT_SEC = 60 / BPM; // 0.8s per beat
const SIXTEENTH = BEAT_SEC / 4;
const BAR_SEC = BEAT_SEC * 4; // 3.2s per bar

// Chord progression: Am - Dm - G - C (roots reggae classic, 1 bar each)
// Expressed as bass root notes
const BASS_ROOTS = [220, 146.83, 196, 261.63]; // A3, D3, G3, C4

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0; // 0-63 (16 steps per bar, 4 bars)
  private _mood: MusicMood = "chill";
  private _volume = 0.35;
  private _playing = false;
  private _muted = false;
  private destroyed = false;

  // Gain nodes for each stem (for fading)
  private masterGain: GainNode | null = null;
  private kickGain: GainNode | null = null;
  private snareGain: GainNode | null = null;
  private hatGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private skankGain: GainNode | null = null;
  private organGain: GainNode | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  // ── Public API ──────────────────────────────────────────

  start(): void {
    if (this._playing || this.destroyed) return;
    const ctx = this.getCtx();
    if (ctx.state === "suspended") ctx.resume();

    this._playing = true;
    this.initGainNodes(ctx);
    this.applyMood();
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.currentStep = 0;

    // Lookahead scheduler: check every 25ms, schedule 100ms ahead
    this.schedulerTimer = setInterval(() => this.scheduler(), 25);
  }

  stop(): void {
    this._playing = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    // Fade out master
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    }
  }

  setMood(mood: MusicMood): void {
    this._mood = mood;
    if (this._playing) this.applyMood();
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime,
        0.1,
      );
    }
  }

  getVolume(): number {
    return this._volume;
  }

  mute(): void {
    this._muted = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  unmute(): void {
    this._muted = false;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this._volume, this.ctx.currentTime, 0.1);
    }
  }

  toggleMute(): boolean {
    if (this._muted) this.unmute(); else this.mute();
    return this._muted;
  }

  isMuted(): boolean {
    return this._muted;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  // ── Gain node setup ─────────────────────────────────────

  private initGainNodes(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : this._volume;
    this.masterGain.connect(ctx.destination);

    this.kickGain = ctx.createGain();
    this.kickGain.connect(this.masterGain);

    this.snareGain = ctx.createGain();
    this.snareGain.connect(this.masterGain);

    this.hatGain = ctx.createGain();
    this.hatGain.connect(this.masterGain);

    this.bassGain = ctx.createGain();
    this.bassGain.connect(this.masterGain);

    this.skankGain = ctx.createGain();
    this.skankGain.connect(this.masterGain);

    this.organGain = ctx.createGain();
    this.organGain.connect(this.masterGain);
  }

  // ── Mood-based stem mixing ──────────────────────────────

  private applyMood(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const fade = 1.0; // seconds

    // Fade targets by mood:
    //   chill:   kick + hat + bass only
    //   moving:  + snare + skank
    //   tension: + organ, busier hat
    //   climax:  all stems louder
    const levels: Record<MusicMood, {
      kick: number; snare: number; hat: number;
      bass: number; skank: number; organ: number;
    }> = {
      chill:   { kick: 0.7, snare: 0,   hat: 0.3, bass: 0.8, skank: 0,   organ: 0   },
      moving:  { kick: 0.8, snare: 0.5, hat: 0.4, bass: 0.9, skank: 0.6, organ: 0   },
      tension: { kick: 0.9, snare: 0.6, hat: 0.6, bass: 1.0, skank: 0.7, organ: 0.5 },
      climax:  { kick: 1.0, snare: 0.8, hat: 0.7, bass: 1.0, skank: 0.8, organ: 0.7 },
    };

    const l = levels[this._mood];
    this.kickGain?.gain.setTargetAtTime(l.kick, t, fade);
    this.snareGain?.gain.setTargetAtTime(l.snare, t, fade);
    this.hatGain?.gain.setTargetAtTime(l.hat, t, fade);
    this.bassGain?.gain.setTargetAtTime(l.bass, t, fade);
    this.skankGain?.gain.setTargetAtTime(l.skank, t, fade);
    this.organGain?.gain.setTargetAtTime(l.organ, t, fade);
  }

  // ── Scheduler ───────────────────────────────────────────

  private scheduler(): void {
    if (!this.ctx || !this._playing) return;
    // Schedule notes up to 100ms ahead
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += SIXTEENTH;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const barStep = step % 16; // 0-15 within current bar
    const barIndex = Math.floor(step / 16); // 0-3 which bar
    const bassRoot = BASS_ROOTS[barIndex];

    // ── Kick: one-drop pattern (beats 2 and 4 = steps 4 and 12) ──
    if (barStep === 4 || barStep === 12) {
      this.playKick(time);
    }

    // ── Snare/Rimshot: beat 3 (step 8) ──
    if (barStep === 8) {
      this.playSnare(time);
    }

    // ── Hi-hat: 8ths (every 2 steps); in tension/climax, 16ths ──
    const hatEvery = (this._mood === "tension" || this._mood === "climax") ? 1 : 2;
    if (barStep % hatEvery === 0) {
      // Open hat on offbeats (odd 8ths)
      const open = barStep % 4 === 2;
      this.playHat(time, open);
    }

    // ── Bass: root on beat 1, octave hit on "and of 2", root on beat 3 ──
    if (barStep === 0) {
      this.playBass(time, bassRoot, 0.35);
    } else if (barStep === 6) {
      this.playBass(time, bassRoot * 2, 0.15); // Octave up, shorter
    } else if (barStep === 8) {
      this.playBass(time, bassRoot * 0.75, 0.25); // Fifth below
    }

    // ── Skank: offbeat chops (steps 2, 6, 10, 14 = the "ands") ──
    if (barStep % 4 === 2) {
      this.playSkank(time, bassRoot);
    }

    // ── Organ bubble: sustained pad, restrike every bar ──
    if (barStep === 0) {
      this.playOrgan(time, bassRoot, BAR_SEC * 0.9);
    }
  }

  // ── Instrument synthesis ────────────────────────────────

  private playKick(time: number): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
    osc.connect(g).connect(this.kickGain!);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private playSnare(time: number): void {
    const ctx = this.getCtx();
    // Noise burst
    const dur = 0.08;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp).connect(g).connect(this.snareGain!);
    src.start(time);
    src.stop(time + dur);
    // Tone body
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 200;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.3, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(og).connect(this.snareGain!);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playHat(time: number, open: boolean): void {
    const ctx = this.getCtx();
    const dur = open ? 0.08 : 0.03;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.15 : 0.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(hp).connect(g).connect(this.hatGain!);
    src.start(time);
    src.stop(time + dur);
  }

  private playBass(time: number, freq: number, duration: number): void {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    osc.type = "triangle"; // Warm bass tone
    osc.frequency.setValueAtTime(freq, time);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, time);
    g.gain.setValueAtTime(0.6, time + duration * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(lp).connect(g).connect(this.bassGain!);
    osc.start(time);
    osc.stop(time + duration);
  }

  private playSkank(time: number, rootFreq: number): void {
    const ctx = this.getCtx();
    // Chord stab: root + major third + fifth, short and clipped
    const freqs = [rootFreq * 2, rootFreq * 2.52, rootFreq * 3]; // Octave up
    const dur = 0.06;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1200;
      bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + dur);
      osc.connect(bp).connect(g).connect(this.skankGain!);
      osc.start(time);
      osc.stop(time + dur);
    }
  }

  private playOrgan(time: number, rootFreq: number, duration: number): void {
    const ctx = this.getCtx();
    // Organ bubble: two oscillators with tremolo
    const freqs = [rootFreq * 2, rootFreq * 2.5]; // Root + third, octave up
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 800;
      // Tremolo via LFO
      const trem = ctx.createOscillator();
      trem.type = "sine";
      trem.frequency.value = 5.5; // ~5.5 Hz tremolo
      const tremGain = ctx.createGain();
      tremGain.gain.value = 0.04;
      trem.connect(tremGain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, time);
      tremGain.connect(g.gain); // Modulate the gain
      g.gain.setTargetAtTime(0.001, time + duration * 0.8, duration * 0.1);
      osc.connect(lp).connect(g).connect(this.organGain!);
      osc.start(time);
      osc.stop(time + duration);
      trem.start(time);
      trem.stop(time + duration);
    }
  }
}
```

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 3: Commit**

```bash
git add apps/web/src/audio/MusicEngine.ts
git commit -m "feat(audio): add procedural reggae MusicEngine with reactive stems"
```

---

### Task 3: Integrate MusicEngine into SoundManager

**Files:**
- Modify: `apps/web/src/audio/SoundManager.ts`

The SoundManager singleton is the single point of contact for all audio. It should own the MusicEngine and expose music controls.

**Step 1: Add MusicEngine to SoundManager**

Add to SoundManager:
- `private music: MusicEngine`
- `startMusic(): void` — starts the background music
- `stopMusic(): void`
- `updateMood(state: GameState): void` — derives mood from game state and calls `music.setMood()`
- `setMusicVolume(v: number): void`
- `getMusicVolume(): number`
- Update `mute()`/`unmute()`/`toggleMute()` to also mute/unmute music
- Update `destroy()` to destroy music engine

Import MusicEngine and GameState:
```typescript
import { MusicEngine, type MusicMood } from "./MusicEngine";
import type { GameState, Player } from "@backyamon/engine";
```

Add a `private music: MusicEngine;` field, initialized in constructor.

Add `startMusic()`:
```typescript
startMusic(): void {
  this.resumeContext();
  this.music.start();
}
```

Add `stopMusic()`:
```typescript
stopMusic(): void {
  this.music.stop();
}
```

Add `updateMood(state)`:
```typescript
updateMood(state: GameState): void {
  const mood = this.deriveMood(state);
  this.music.setMood(mood);
}

private deriveMood(state: GameState): MusicMood {
  if (state.phase === "GAME_OVER") return "climax";

  // Check if bearing off race
  const goldOff = state.borneOff.gold;
  const redOff = state.borneOff.red;
  if (goldOff >= 10 || redOff >= 10) return "climax";

  // Check if pieces on bar (tension)
  const totalOnBar = state.bar.gold + state.bar.red;
  if (totalOnBar >= 2) return "tension";

  // High doubling cube = tension
  if (state.doublingCube.value >= 4) return "tension";

  // Moving phase = active
  if (state.phase === "MOVING") return "moving";

  return "chill";
}
```

Add music volume controls:
```typescript
setMusicVolume(v: number): void {
  this.music.setVolume(v);
}

getMusicVolume(): number {
  return this.music.getVolume();
}

isMusicPlaying(): boolean {
  return this.music.isPlaying();
}
```

Update `mute()`:
```typescript
mute(): void {
  this._muted = true;
  this.music.mute();
}
```

Update `unmute()`:
```typescript
unmute(): void {
  this._muted = false;
  this.music.unmute();
}
```

Update `toggleMute()`:
```typescript
toggleMute(): boolean {
  this._muted = !this._muted;
  if (this._muted) this.music.mute(); else this.music.unmute();
  return this._muted;
}
```

Update `destroy()`:
```typescript
destroy(): void {
  this.destroyed = true;
  this.music.destroy();
  for (const howl of Object.values(this.howls)) {
    if (howl) howl.unload();
  }
  // ... rest unchanged
}
```

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 3: Commit**

```bash
git add apps/web/src/audio/SoundManager.ts
git commit -m "feat(audio): integrate MusicEngine into SoundManager with mood derivation"
```

---

### Task 4: Wire Music into GameController

**Files:**
- Modify: `apps/web/src/game/GameController.ts`

**Step 1: Start music and update mood on state changes**

In `startGame()`, after initial state is created, add:
```typescript
this.sound.startMusic();
this.sound.updateMood(this.state);
```

In `emitStateChange()`, add mood update:
```typescript
private emitStateChange(): void {
  this.sound.updateMood(this.state);
  this.onStateChange?.(this.state);
}
```

In `destroy()`, stop music:
```typescript
destroy(): void {
  this.destroyed = true;
  this.sound.stopMusic();
  this.inputHandler?.destroy();
  // ... rest unchanged
}
```

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 3: Commit**

```bash
git add apps/web/src/game/GameController.ts
git commit -m "feat(audio): wire MusicEngine into GameController with mood updates"
```

---

### Task 5: Add SFX + Music to OnlineGameController

**Files:**
- Modify: `apps/web/src/game/OnlineGameController.ts`

The OnlineGameController currently has **no audio at all**. Add the same SoundManager integration as GameController.

**Step 1: Add SoundManager import and field**

```typescript
import { SoundManager } from "@/audio/SoundManager";
```

Add field:
```typescript
private sound: SoundManager;
```

In constructor, add:
```typescript
this.sound = SoundManager.getInstance();
```

**Step 2: Add SFX calls matching GameController**

In `startGame()`:
```typescript
this.sound.startMusic();
this.sound.updateMood(this.state);
```

In `startLocalTurn()`:
```typescript
this.sound.playSFX("turn-start");
```

In `handleDiceRolled()`, at the start:
```typescript
this.sound.playSFX("dice-roll");
```

In `handleMoveMade()`, before animating (use same logic as GameController's `playMoveSFX`):
```typescript
// Play move SFX
if (move.to === "off") {
  this.sound.playSFX("bear-off");
} else if (typeof move.to === "number") {
  const target = this.state.points[move.to];
  const opp = this.state.currentPlayer === Player.Gold ? Player.Red : Player.Gold;
  if (target && target.player === opp && target.count === 1) {
    this.sound.playSFX("piece-hit");
  } else {
    this.sound.playSFX("piece-move");
  }
} else {
  this.sound.playSFX("piece-move");
}
```

Note: this SFX check uses `this.state` BEFORE updating it from server data (since `this.state` still has the pre-move board). The existing code in `handleMoveMade` does `const movingPlayer = this.state.currentPlayer;` before `this.state = state;`, so we insert the SFX call right after `movingPlayer` and before the state update.

In `handleGameOver()`:
```typescript
if (data.winner === this.localPlayer) {
  this.sound.playSFX("victory");
} else {
  this.sound.playSFX("defeat");
}
```

In `handleDoubleOffered()`:
```typescript
this.sound.playSFX("double-offered");
```

Add `emitStateChange()` mood update (same pattern as GameController):
```typescript
private emitStateChange(): void {
  this.sound.updateMood(this.state);
  this.onStateChange?.(this.state);
}
```

In `destroy()`:
```typescript
destroy(): void {
  this.destroyed = true;
  this.sound.stopMusic();
  this.unbindServerEvents();
  // ... rest unchanged
}
```

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 3: Commit**

```bash
git add apps/web/src/game/OnlineGameController.ts
git commit -m "feat(audio): add full SFX and music to OnlineGameController"
```

---

### Task 6: Add Music Volume Controls to GameHUD

**Files:**
- Modify: `apps/web/src/components/GameHUD.tsx`

**Step 1: Add music toggle button next to existing mute button**

Add a music on/off toggle next to the speaker icon. The existing mute button controls everything (SFX + music). Add a separate music-only toggle.

In the top-right controls area, after the existing mute button, add a music toggle:

```tsx
{/* Music toggle */}
<button
  onClick={(e) => {
    (e.target as HTMLElement).blur();
    soundManager.resumeContext();
    if (soundManager.isMusicPlaying()) {
      soundManager.stopMusic();
    } else {
      soundManager.startMusic();
    }
    // Force re-render
    setMuted(soundManager.isMuted());
  }}
  tabIndex={-1}
  className="pointer-events-auto bg-[#1A1A0E]/80 hover:bg-[#1A1A0E] rounded-lg p-1.5 border border-[#8B4513] transition-colors cursor-pointer"
  title={soundManager.isMusicPlaying() ? "Stop Music" : "Start Music"}
>
  {soundManager.isMusicPlaying() ? <MusicOnIcon /> : <MusicOffIcon />}
</button>
```

Add the icon components:

```tsx
function MusicOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function MusicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
```

Add a `musicPlaying` state and use `useEffect` + `setInterval` to keep it in sync (since music state lives in SoundManager):

```tsx
const [musicPlaying, setMusicPlaying] = useState(false);

useEffect(() => {
  const interval = setInterval(() => {
    setMusicPlaying(soundManager.isMusicPlaying());
  }, 500);
  return () => clearInterval(interval);
}, [soundManager]);
```

Update the music toggle button to use `musicPlaying` state instead of calling `soundManager.isMusicPlaying()` directly in the render.

**Step 2: Build and verify**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 3: Manual test**

Run: `npm run dev` — start a game. Verify:
- Background reggae music plays automatically
- Music toggle button works (stops/starts music)
- Mute button silences everything (SFX + music)
- Music mood changes as game progresses (listen for stems fading in/out)

**Step 4: Commit**

```bash
git add apps/web/src/components/GameHUD.tsx
git commit -m "feat(audio): add music toggle button to GameHUD"
```

---

### Task 7: Final Build + Test

**Step 1: Full build**

Run: `npx turbo build`
Expected: All 3 packages build successfully.

**Step 2: Run engine tests**

Run: `npx turbo test`
Expected: All 107 tests pass (engine tests should be unaffected).

**Step 3: Manual smoke test**

1. Start dev server: `npm run dev`
2. Play an AI game — verify:
   - All 9 SFX sound rich (dice rattle, wood knock, 808 boom, steel drum, horn stab, etc.)
   - Background reggae music starts automatically
   - Music fades between moods as game progresses
   - Mute button silences everything
   - Music toggle independently stops/starts music
3. Open lobby, create a private room — verify rasta-themed room name appears

**Step 4: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "feat(audio): complete audio system — rich SFX + procedural reggae music"
```

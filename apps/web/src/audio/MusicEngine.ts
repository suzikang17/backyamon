/**
 * MusicEngine — Procedural reggae background music using Web Audio API.
 *
 * Generates a looping 4-bar reggae groove with reactive stems that crossfade
 * based on the current game mood. All audio is synthesised from scratch:
 * one-drop kick, snare, hi-hats, sub bass, offbeat skank chops, and a
 * sustained organ pad.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MusicMood = "chill" | "moving" | "tension" | "climax";
export type MusicStyle = "roots" | "dub" | "dancehall";

// ---------------------------------------------------------------------------
// Style presets — different vibes per difficulty
// ---------------------------------------------------------------------------

interface StylePreset {
  bpm: number;
  bassRoots: readonly number[];  // 4-bar chord progression as bass frequencies
  skankBrightness: number;       // bandpass center for skank (higher = brighter)
  organTremRate: number;         // tremolo LFO speed
  kickPunch: number;             // kick start frequency (higher = punchier)
}

const STYLE_PRESETS: Record<MusicStyle, StylePreset> = {
  // Easy / Beach Bum — slow, major key, laid back
  roots: {
    bpm: 70,
    bassRoots: [130.81, 174.61, 196, 130.81],   // C3 - F3 - G3 - C3 (major)
    skankBrightness: 1000,
    organTremRate: 4,
    kickPunch: 130,
  },
  // Medium / Selector — classic roots reggae
  dub: {
    bpm: 75,
    bassRoots: [220, 146.83, 196, 261.63],       // Am - Dm - G - C
    skankBrightness: 1200,
    organTremRate: 5.5,
    kickPunch: 150,
  },
  // Hard / King Tubby — faster steppers, minor key, heavy
  dancehall: {
    bpm: 82,
    bassRoots: [220, 164.81, 146.83, 329.63],    // Am - E3 - Dm - E4 (dark minor)
    skankBrightness: 1500,
    organTremRate: 7,
    kickPunch: 180,
  },
};

// ---------------------------------------------------------------------------
// Constants (derived from style)
// ---------------------------------------------------------------------------

const DEFAULT_STYLE: MusicStyle = "dub";

/** Stem gain levels per mood. Order: kick, snare, hat, bass, skank, organ. */
const MOOD_GAINS: Record<MusicMood, readonly number[]> = {
  chill: [0.7, 0, 0.3, 0.8, 0, 0],
  moving: [0.8, 0.5, 0.4, 0.9, 0.6, 0],
  tension: [0.9, 0.6, 0.6, 1.0, 0.7, 0.5],
  climax: [1.0, 0.8, 0.7, 1.0, 0.8, 0.7],
};

const SCHEDULE_AHEAD = 0.1;
const SCHEDULE_INTERVAL = 25;
const FADE_TIME = 0.4;

// ---------------------------------------------------------------------------
// MusicEngine
// ---------------------------------------------------------------------------

export class MusicEngine {
  // --- Audio graph ----------------------------------------------------------
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private kickGain: GainNode | null = null;
  private snareGain: GainNode | null = null;
  private hatGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private skankGain: GainNode | null = null;
  private organGain: GainNode | null = null;

  // --- Style & timing -------------------------------------------------------
  private preset: StylePreset = STYLE_PRESETS[DEFAULT_STYLE];
  private sixteenth = 60 / STYLE_PRESETS[DEFAULT_STYLE].bpm / 4;
  private barSec = (60 / STYLE_PRESETS[DEFAULT_STYLE].bpm) * 4;

  // --- Scheduler state ------------------------------------------------------
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0; // 0–63 (16 steps/bar × 4 bars)

  // --- Public-facing state --------------------------------------------------
  private _mood: MusicMood = "chill";
  private _volume = 0.35;
  private _playing = false;
  private _muted = false;
  private destroyed = false;

  // =========================================================================
  // Public API
  // =========================================================================

  start(): void {
    if (this.destroyed || this._playing) return;

    const ctx = this.getCtx();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    this.initGainNodes(ctx);
    this.applyMood();

    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.05; // tiny look-ahead
    this._playing = true;

    this.schedulerTimer = setInterval(() => this.scheduler(), SCHEDULE_INTERVAL);
  }

  stop(): void {
    if (!this._playing) return;

    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    // Fade out master then disconnect
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    this._playing = false;
  }

  setStyle(style: MusicStyle): void {
    this.preset = STYLE_PRESETS[style];
    this.sixteenth = 60 / this.preset.bpm / 4;
    this.barSec = (60 / this.preset.bpm) * 4;
  }

  setMood(mood: MusicMood): void {
    this._mood = mood;
    if (this._playing) {
      this.applyMood();
    }
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime,
      );
    }
  }

  getVolume(): number {
    return this._volume;
  }

  mute(): void {
    this._muted = true;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  unmute(): void {
    this._muted = false;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this._volume, this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    if (this._muted) {
      this.unmute();
    } else {
      this.mute();
    }
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
    this.masterGain = null;
    this.kickGain = null;
    this.snareGain = null;
    this.hatGain = null;
    this.bassGain = null;
    this.skankGain = null;
    this.organGain = null;
  }

  // =========================================================================
  // Internal — AudioContext & gain routing
  // =========================================================================

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private initGainNodes(ctx: AudioContext): void {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this._muted ? 0 : this._volume;
    this.masterGain.connect(ctx.destination);

    this.kickGain = ctx.createGain();
    this.snareGain = ctx.createGain();
    this.hatGain = ctx.createGain();
    this.bassGain = ctx.createGain();
    this.skankGain = ctx.createGain();
    this.organGain = ctx.createGain();

    this.kickGain.connect(this.masterGain);
    this.snareGain.connect(this.masterGain);
    this.hatGain.connect(this.masterGain);
    this.bassGain.connect(this.masterGain);
    this.skankGain.connect(this.masterGain);
    this.organGain.connect(this.masterGain);
  }

  private applyMood(): void {
    if (!this.ctx) return;
    const gains = MOOD_GAINS[this._mood];
    const now = this.ctx.currentTime;
    const stemNodes = [
      this.kickGain,
      this.snareGain,
      this.hatGain,
      this.bassGain,
      this.skankGain,
      this.organGain,
    ];
    for (let i = 0; i < stemNodes.length; i++) {
      const node = stemNodes[i];
      if (node) {
        node.gain.setValueAtTime(node.gain.value, now);
        node.gain.linearRampToValueAtTime(gains[i], now + FADE_TIME);
      }
    }
  }

  // =========================================================================
  // Internal — Scheduler
  // =========================================================================

  private scheduler(): void {
    if (!this.ctx || !this._playing) return;
    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.sixteenth;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const barIndex = Math.floor(step / 16);
    const localStep = step % 16; // 0-15 within the current bar
    const rootFreq = this.preset.bassRoots[barIndex];

    // --- Kick: one-drop on beats 2 & 4 (steps 4, 12) ----------------------
    if (localStep === 4 || localStep === 12) {
      this.playKick(time);
    }

    // --- Snare: beat 3 (step 8) --------------------------------------------
    if (localStep === 8) {
      this.playSnare(time);
    }

    // --- Hi-hat ------------------------------------------------------------
    const fastHats =
      this._mood === "tension" || this._mood === "climax";
    if (fastHats) {
      // Every 16th note
      const open = localStep % 2 !== 0; // odd 16ths are open
      this.playHat(time, open);
    } else if (localStep % 2 === 0) {
      // Every 8th note
      const open = (localStep / 2) % 2 !== 0; // odd 8ths are open
      this.playHat(time, open);
    }

    // --- Bass --------------------------------------------------------------
    if (localStep === 0) {
      this.playBass(time, rootFreq, 0.35);
    } else if (localStep === 6) {
      this.playBass(time, rootFreq * 2, 0.15); // octave up
    } else if (localStep === 8) {
      // fifth below the root — multiply by 2/3
      this.playBass(time, rootFreq * (2 / 3), 0.25);
    }

    // --- Skank: offbeat chops (steps 2, 6, 10, 14) ------------------------
    if (localStep === 2 || localStep === 6 || localStep === 10 || localStep === 14) {
      this.playSkank(time, rootFreq);
    }

    // --- Organ: sustained pad from step 0 of each bar ---------------------
    if (localStep === 0) {
      this.playOrgan(time, rootFreq, this.barSec * 0.9);
    }
  }

  // =========================================================================
  // Internal — Instrument synthesis
  // =========================================================================

  /** Kick drum: sine 150→40Hz pitch drop with gain envelope. */
  private playKick(time: number): void {
    const ctx = this.getCtx();
    if (!this.kickGain) return;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(this.preset.kickPunch, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    osc.connect(gain).connect(this.kickGain);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  /** Snare: noise burst (highpass 2kHz) + triangle body 200Hz. */
  private playSnare(time: number): void {
    const ctx = this.getCtx();
    if (!this.snareGain) return;

    // Noise burst
    const noiseDur = 0.12;
    const bufferSize = Math.ceil(ctx.sampleRate * noiseDur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDur);

    noiseSrc.connect(hp).connect(noiseGain).connect(this.snareGain);
    noiseSrc.start(time);
    noiseSrc.stop(time + noiseDur);

    // Triangle body
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 200;

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.7, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(bodyGain).connect(this.snareGain);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  /** Hi-hat: highpass noise (7kHz). open = 0.08s, closed = 0.03s. */
  private playHat(time: number, open: boolean): void {
    const ctx = this.getCtx();
    if (!this.hatGain) return;

    const dur = open ? 0.08 : 0.03;
    const bufferSize = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.5 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(hp).connect(gain).connect(this.hatGain);
    src.start(time);
    src.stop(time + dur);
  }

  /** Bass: triangle oscillator through lowpass 500Hz. */
  private playBass(time: number, freq: number, duration: number): void {
    const ctx = this.getCtx();
    if (!this.bassGain) return;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(lp).connect(gain).connect(this.bassGain);
    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Skank: chord stab (root×2, root×2.52, root×3) with square waves through
   * bandpass 1200Hz. Duration 0.06s.
   */
  private playSkank(time: number, rootFreq: number): void {
    const ctx = this.getCtx();
    if (!this.skankGain) return;

    const dur = 0.06;
    const chordFreqs = [rootFreq * 2, rootFreq * 2.52, rootFreq * 3];

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = this.preset.skankBrightness;
    bp.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    bp.connect(gain).connect(this.skankGain);

    for (const f of chordFreqs) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, time);
      osc.connect(bp);
      osc.start(time);
      osc.stop(time + dur);
    }
  }

  /**
   * Organ: two square oscillators (root×2, root×2.5) through lowpass 800Hz
   * with 5.5Hz sine tremolo LFO.
   */
  private playOrgan(time: number, rootFreq: number, duration: number): void {
    const ctx = this.getCtx();
    if (!this.organGain) return;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.setValueAtTime(0.5, time + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    // Tremolo LFO
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = this.preset.organTremRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15; // tremolo depth
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start(time);
    lfo.stop(time + duration);

    lp.connect(gain).connect(this.organGain);

    const freqs = [rootFreq * 2, rootFreq * 2.5];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, time);
      osc.connect(lp);
      osc.start(time);
      osc.stop(time + duration);
    }
  }
}

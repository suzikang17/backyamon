import { Howl, Howler } from "howler";

export type SFXName =
  | "dice-roll"
  | "piece-move"
  | "piece-hit"
  | "bear-off"
  | "victory"
  | "defeat"
  | "double-offered"
  | "ya-mon"
  | "turn-start";

const SFX_NAMES: SFXName[] = [
  "dice-roll",
  "piece-move",
  "piece-hit",
  "bear-off",
  "victory",
  "defeat",
  "double-offered",
  "ya-mon",
  "turn-start",
];

/**
 * Singleton audio manager for Backyamon.
 *
 * Attempts to load real MP3 files from /audio/sfx-{name}.mp3.
 * When a file is missing it falls back to synthetic Web Audio API sounds.
 */
export class SoundManager {
  private static instance: SoundManager | null = null;

  private howls: Partial<Record<SFXName, Howl>> = {};
  private syntheticPlayers: Partial<Record<SFXName, () => void>> = {};
  private loadFailed: Set<SFXName> = new Set();
  private audioCtx: AudioContext | null = null;
  private _volume = 0.5;
  private _muted = false;
  private destroyed = false;

  private constructor() {
    this.initHowls();
    this.initSynthetic();
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /** Reset the singleton (used in tests or full teardown). */
  static resetInstance(): void {
    if (SoundManager.instance) {
      SoundManager.instance.destroy();
      SoundManager.instance = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Howl loading
  // ---------------------------------------------------------------------------

  private initHowls(): void {
    for (const name of SFX_NAMES) {
      const howl = new Howl({
        src: [`/audio/sfx-${name}.mp3`],
        volume: this._volume,
        preload: true,
        onloaderror: () => {
          this.loadFailed.add(name);
        },
      });
      this.howls[name] = howl;
    }
  }

  // ---------------------------------------------------------------------------
  // Synthetic Web Audio API fallbacks
  // ---------------------------------------------------------------------------

  private getAudioCtx(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  /** Resume the AudioContext after a user gesture (autoplay policy). */
  resumeContext(): void {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    // Also resume Howler global context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (Howler as any).ctx as AudioContext | undefined;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  }

  private initSynthetic(): void {
    this.syntheticPlayers = {
      "dice-roll": () => this.synthShaker(),
      "piece-move": () => this.synthWoodKnock(),
      "piece-hit": () => this.synth808Boom(),
      "bear-off": () => this.synthSteelDrum(),
      victory: () => this.synthHornStab(),
      defeat: () => this.synthDefeat(),
      "double-offered": () => this.synthDubSiren(),
      "ya-mon": () => this.synthVocalAh(),
      "turn-start": () => this.synthRimshot(),
    };
  }

  /** Shaker rattle: 3 staggered noise grains with bandpass sweep + body thump. */
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
    bodyGain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.08,
    );
    body.connect(bodyGain).connect(ctx.destination);
    body.start();
    body.stop(ctx.currentTime + 0.08);
  }

  /** Woody knock: filtered noise click + resonant triangle body. */
  private synthWoodKnock(): void {
    const ctx = this.getAudioCtx();
    const vol = this.effectiveVolume();
    const t = ctx.currentTime;
    // Noise click
    const clickDur = 0.015;
    const buf = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * clickDur),
      ctx.sampleRate,
    );
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

  /** Deep 808 boom: sine with steep pitch drop + waveshaper distortion + click. */
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
      const x = i / 128 - 1;
      curve[i] = ((Math.PI + 3) * x) / (Math.PI + 3 * Math.abs(x));
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

  /** Steel drum ting: inharmonic sine partials with detuning + noise attack click. */
  private synthSteelDrum(): void {
    const ctx = this.getAudioCtx();
    const vol = this.effectiveVolume();
    const t = ctx.currentTime;
    // Steel drum: multiple inharmonic partials
    const freqs = [523, 659, 1047, 1318, 1568];
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
    const buf = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * noiseDur),
      ctx.sampleRate,
    );
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);
    src.connect(ng).connect(ctx.destination);
    src.start(t);
    src.stop(t + noiseDur);
  }

  /** Reggae horn stab: detuned sawtooth major chord + lowpass sweep + echo. */
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

  /** Descending minor arpeggio: Eb5 -> C5 -> Ab4 with triangle + lowpass sweep. */
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

  /** Dub siren: sawtooth swept 400-900-400Hz with resonant lowpass + echo. */
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

  /** Vocal "ah" formant: sawtooth buzz through 3 bandpass formant filters. */
  private synthVocalAh(): void {
    const ctx = this.getAudioCtx();
    const vol = this.effectiveVolume();
    const t = ctx.currentTime;
    // Vocal formant synthesis: buzz source + formant filters for "ah" vowel
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

  /** Rimshot: noise click (highpass 2kHz) + resonant triangle body at 820Hz. */
  private synthRimshot(): void {
    const ctx = this.getAudioCtx();
    const vol = this.effectiveVolume();
    const t = ctx.currentTime;
    // Click transient
    const noiseDur = 0.005;
    const buf = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * noiseDur),
      ctx.sampleRate,
    );
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  playSFX(name: SFXName): void {
    if (this.destroyed || this._muted) return;

    // Try Howl first (real audio file).
    const howl = this.howls[name];
    if (howl && !this.loadFailed.has(name)) {
      howl.volume(this._volume);
      howl.play();
      return;
    }

    // Fall back to synthetic.
    const synth = this.syntheticPlayers[name];
    if (synth) {
      try {
        synth();
      } catch {
        // Ignore AudioContext errors (e.g. not yet resumed)
      }
    }
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
    // Update existing Howl volumes
    for (const howl of Object.values(this.howls)) {
      if (howl) howl.volume(this._volume);
    }
  }

  getVolume(): number {
    return this._volume;
  }

  mute(): void {
    this._muted = true;
  }

  unmute(): void {
    this._muted = false;
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    return this._muted;
  }

  isMuted(): boolean {
    return this._muted;
  }

  destroy(): void {
    this.destroyed = true;
    for (const howl of Object.values(this.howls)) {
      if (howl) howl.unload();
    }
    this.howls = {};
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private effectiveVolume(): number {
    return this._muted ? 0 : this._volume;
  }
}

import { Howl, Howler } from "howler";
import { MusicEngine, type MusicMood, type MusicStyle } from "./MusicEngine";
import { Player, type GameState } from "@backyamon/engine";

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
  private music: MusicEngine;
  private customHowls: Map<string, Howl> = new Map();
  private customMusic: Howl | null = null;
  private _volume = 0.5;
  private _muted = false;
  private destroyed = false;

  private speechVoice: SpeechSynthesisVoice | null = null;
  private speechReady = false;

  private constructor() {
    this.music = new MusicEngine();
    this.initHowls();
    this.initSynthetic();
    this.initSpeech();
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

  // ---------------------------------------------------------------------------
  // Speech (Web Speech API — Jamaican English)
  // ---------------------------------------------------------------------------

  private initSpeech(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const pickVoice = () => {
      const voices = speechSynthesis.getVoices();
      // Prefer Jamaican English, fall back to any English
      this.speechVoice =
        voices.find((v) => v.lang === "en-JM") ??
        voices.find((v) => v.lang.startsWith("en") && /male/i.test(v.name)) ??
        voices.find((v) => v.lang.startsWith("en")) ??
        null;
      this.speechReady = true;
    };

    // Voices load async in some browsers
    if (speechSynthesis.getVoices().length > 0) {
      pickVoice();
    } else {
      speechSynthesis.addEventListener("voiceschanged", pickVoice, { once: true });
    }
  }

  /**
   * Speak a phrase using Web Speech API with Jamaican English voice.
   * Non-blocking, fire-and-forget. Respects mute state.
   */
  speak(text: string, rate = 0.9): void {
    if (this._muted || !this.speechReady || typeof window === "undefined") return;
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech to avoid overlap
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 0.95;
    utterance.volume = Math.min(this._volume * 1.2, 1);
    if (this.speechVoice) {
      utterance.voice = this.speechVoice;
    }
    utterance.lang = "en-JM";
    speechSynthesis.speak(utterance);
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

  loadCustomSFX(slot: SFXName, url: string): void {
    // Unload previous custom howl for this slot if any
    const existing = this.customHowls.get(slot);
    if (existing) existing.unload();

    const howl = new Howl({
      src: [url],
      volume: this._volume,
      preload: true,
      onloaderror: () => {
        this.customHowls.delete(slot);
      },
    });
    this.customHowls.set(slot, howl);
  }

  loadCustomMusic(url: string): void {
    if (this.customMusic) {
      this.customMusic.unload();
    }
    this.customMusic = new Howl({
      src: [url],
      volume: this._volume * 0.4,
      loop: true,
      preload: true,
    });
  }

  clearCustomSFX(slot: SFXName): void {
    const existing = this.customHowls.get(slot);
    if (existing) {
      existing.unload();
      this.customHowls.delete(slot);
    }
  }

  clearCustomMusic(): void {
    if (this.customMusic) {
      this.customMusic.unload();
      this.customMusic = null;
    }
  }

  playSFX(name: SFXName): void {
    if (this.destroyed || this._muted) return;

    // Try custom SFX first
    const custom = this.customHowls.get(name);
    if (custom) {
      custom.volume(this._volume);
      custom.play();
      return;
    }

    // Try Howl (real audio file)
    const howl = this.howls[name];
    if (howl && !this.loadFailed.has(name)) {
      howl.volume(this._volume);
      howl.play();
      return;
    }

    // Fall back to synthetic
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
    for (const howl of this.customHowls.values()) {
      howl.volume(this._volume);
    }
    if (this.customMusic) {
      this.customMusic.volume(this._volume * 0.4);
    }
  }

  getVolume(): number {
    return this._volume;
  }

  mute(): void {
    this._muted = true;
    this.music.mute();
    if (this.customMusic) this.customMusic.mute(true);
  }

  unmute(): void {
    this._muted = false;
    this.music.unmute();
    if (this.customMusic) this.customMusic.mute(false);
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this._muted) this.music.mute();
    else this.music.unmute();
    return this._muted;
  }

  isMuted(): boolean {
    return this._muted;
  }

  // ---------------------------------------------------------------------------
  // Music API
  // ---------------------------------------------------------------------------

  startMusic(): void {
    this.resumeContext();
    if (this.customMusic) {
      if (!this.customMusic.playing()) {
        this.customMusic.play();
      }
    } else {
      this.music.start();
    }
    this.startAmbience();
  }

  setMusicStyle(style: MusicStyle): void {
    this.music.setStyle(style);
  }

  stopMusic(): void {
    if (this.customMusic) {
      this.customMusic.stop();
    } else {
      this.music.stop();
    }
    this.stopAmbience();
  }

  updateMood(state: GameState): void {
    const mood = this.deriveMood(state);
    this.music.setMood(mood);
  }

  setMusicVolume(v: number): void {
    this.music.setVolume(v);
  }

  getMusicVolume(): number {
    return this.music.getVolume();
  }

  isMusicPlaying(): boolean {
    if (this.customMusic) {
      return this.customMusic.playing();
    }
    return this.music.isPlaying();
  }

  // ---------------------------------------------------------------------------
  // Ambient sounds (ocean waves + distant bar chatter)
  // ---------------------------------------------------------------------------

  private ambientNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private ambientRunning = false;

  startAmbience(): void {
    if (this.ambientRunning) return;
    this.ambientRunning = true;

    const ctx = this.getAudioCtx();
    const vol = this.effectiveVolume() * 0.12;

    // Ocean waves — filtered brown noise with slow LFO modulation
    const oceanLen = 4; // 4 seconds of noise, looped
    const oceanBuf = ctx.createBuffer(1, ctx.sampleRate * oceanLen, ctx.sampleRate);
    const oceanData = oceanBuf.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < oceanData.length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = 0.99 * lastOut + 0.01 * white; // Brown noise
      oceanData[i] = lastOut * 3;
    }

    const oceanSrc = ctx.createBufferSource();
    oceanSrc.buffer = oceanBuf;
    oceanSrc.loop = true;

    // Bandpass for ocean character
    const oceanFilter = ctx.createBiquadFilter();
    oceanFilter.type = "lowpass";
    oceanFilter.frequency.value = 400;
    oceanFilter.Q.value = 0.7;

    // Slow volume LFO for wave swells
    const oceanGain = ctx.createGain();
    oceanGain.gain.value = vol;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08; // Very slow
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = vol * 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(oceanGain.gain);
    lfo.start();

    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(oceanGain);
    oceanGain.connect(ctx.destination);
    oceanSrc.start();

    this.ambientNodes.push({ source: oceanSrc, gain: oceanGain });

    // Bar chatter — higher-frequency filtered noise, very quiet
    const chatterLen = 3;
    const chatterBuf = ctx.createBuffer(1, ctx.sampleRate * chatterLen, ctx.sampleRate);
    const chatterData = chatterBuf.getChannelData(0);
    for (let i = 0; i < chatterData.length; i++) {
      chatterData[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const chatterSrc = ctx.createBufferSource();
    chatterSrc.buffer = chatterBuf;
    chatterSrc.loop = true;

    const chatterBp = ctx.createBiquadFilter();
    chatterBp.type = "bandpass";
    chatterBp.frequency.value = 800;
    chatterBp.Q.value = 2;

    const chatterGain = ctx.createGain();
    chatterGain.gain.value = vol * 0.3;

    chatterSrc.connect(chatterBp);
    chatterBp.connect(chatterGain);
    chatterGain.connect(ctx.destination);
    chatterSrc.start();

    this.ambientNodes.push({ source: chatterSrc, gain: chatterGain });
  }

  stopAmbience(): void {
    for (const n of this.ambientNodes) {
      try { n.source.stop(); } catch { /* already stopped */ }
    }
    this.ambientNodes = [];
    this.ambientRunning = false;
  }

  private deriveMood(state: GameState): MusicMood {
    if (state.phase === "GAME_OVER") return "climax";
    const goldOff = state.borneOff[Player.Gold];
    const redOff = state.borneOff[Player.Red];
    if (goldOff >= 10 || redOff >= 10) return "climax";
    const totalOnBar = state.bar[Player.Gold] + state.bar[Player.Red];
    if (totalOnBar >= 2) return "tension";
    if (state.doublingCube.value >= 4) return "tension";
    if (state.phase === "MOVING") return "moving";
    return "chill";
  }

  destroy(): void {
    this.music.destroy();
    this.destroyed = true;
    for (const howl of Object.values(this.howls)) {
      if (howl) howl.unload();
    }
    this.howls = {};
    for (const howl of this.customHowls.values()) {
      howl.unload();
    }
    this.customHowls.clear();
    if (this.customMusic) {
      this.customMusic.unload();
      this.customMusic = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private effectiveVolume(): number {
    return this._muted ? 0 : this._volume;
  }
}

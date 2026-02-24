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
      "dice-roll": () => this.synthNoiseBurst(0.08, 800, 2000),
      "piece-move": () => this.synthTone(220, 0.06, "sine"),
      "piece-hit": () => this.synthTone(110, 0.15, "triangle"),
      "bear-off": () => this.synthAscending([330, 440, 550], 0.08),
      victory: () => this.synthChord([523, 659, 784], 0.35),
      defeat: () => this.synthDescending([392, 330, 262], 0.12),
      "double-offered": () => this.synthDoubleBeep(660, 0.08),
      "ya-mon": () => {}, // No synthetic for voice – intentional no-op
      "turn-start": () => this.synthClick(),
    };
  }

  /** Short noise burst (dice rattle). */
  private synthNoiseBurst(
    duration: number,
    lowFreq: number,
    highFreq: number,
  ): void {
    const ctx = this.getAudioCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = (lowFreq + highFreq) / 2;
    bandpass.Q.value = 0.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.effectiveVolume(), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration,
    );

    source.connect(bandpass).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  }

  /** Simple tone. */
  private synthTone(
    freq: number,
    duration: number,
    type: OscillatorType,
  ): void {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.effectiveVolume() * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration,
    );

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Ascending arpeggio (bear-off). */
  private synthAscending(freqs: number[], noteDuration: number): void {
    freqs.forEach((f, i) => {
      setTimeout(() => {
        if (!this.destroyed) this.synthTone(f, noteDuration, "sine");
      }, i * noteDuration * 600);
    });
  }

  /** Descending arpeggio (defeat). */
  private synthDescending(freqs: number[], noteDuration: number): void {
    freqs.forEach((f, i) => {
      setTimeout(() => {
        if (!this.destroyed) this.synthTone(f, noteDuration, "triangle");
      }, i * noteDuration * 600);
    });
  }

  /** Major chord (victory). */
  private synthChord(freqs: number[], duration: number): void {
    const ctx = this.getAudioCtx();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(
      this.effectiveVolume() * 0.25,
      ctx.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration,
    );
    gain.connect(ctx.destination);

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
  }

  /** Two short beeps (double offered). */
  private synthDoubleBeep(freq: number, beepDuration: number): void {
    this.synthTone(freq, beepDuration, "square");
    setTimeout(() => {
      if (!this.destroyed) this.synthTone(freq, beepDuration, "square");
    }, beepDuration * 1000 + 60);
  }

  /** Subtle click (turn start). */
  private synthClick(): void {
    const ctx = this.getAudioCtx();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.effectiveVolume() * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
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

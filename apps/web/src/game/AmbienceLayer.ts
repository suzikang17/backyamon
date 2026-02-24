import { Application, Container, Graphics } from "pixi.js";

/**
 * AmbienceLayer — floating dust motes and warm flickering lantern light
 * overlaid on the game board for an immersive beach-bar atmosphere.
 */

interface Mote {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  phase: number; // For twinkle
}

export class AmbienceLayer {
  private app: Application;
  private container: Container;
  private lightOverlay: Graphics;
  private motes: Mote[] = [];
  private tickFn: ((dt: any) => void) | null = null;
  private width: number;
  private height: number;

  constructor(app: Application, width: number, height: number) {
    this.app = app;
    this.width = width;
    this.height = height;
    this.container = new Container();
    app.stage.addChild(this.container);

    // Warm light overlay (sits behind pieces but above the board)
    this.lightOverlay = new Graphics();
    this.container.addChild(this.lightOverlay);

    this.spawnMotes();
    this.startAnimation();
  }

  private spawnMotes(): void {
    const count = 25;
    for (let i = 0; i < count; i++) {
      const size = 1 + Math.random() * 2.5;
      const g = new Graphics();
      // Warm golden dust motes
      const color = Math.random() > 0.3 ? 0xffd700 : 0xffaa44;
      g.circle(0, 0, size).fill({ color, alpha: 1 });

      const mote: Mote = {
        g,
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.1 - Math.random() * 0.25, // Gently drift upward
        size,
        baseAlpha: 0.08 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
      };

      g.x = mote.x;
      g.y = mote.y;
      g.alpha = mote.baseAlpha;

      this.container.addChild(g);
      this.motes.push(mote);
    }
  }

  private startAnimation(): void {
    const startTime = performance.now();

    this.tickFn = () => {
      const now = performance.now();
      const elapsed = (now - startTime) / 1000; // Seconds

      // Update light overlay — warm flickering lantern
      this.lightOverlay.clear();
      const flickerA = 0.03 + Math.sin(elapsed * 2.5) * 0.01 + Math.sin(elapsed * 4.1) * 0.005;
      // Radial warm glow from top-left (simulating a lantern above the table)
      this.lightOverlay
        .ellipse(this.width * 0.3, this.height * 0.25, this.width * 0.6, this.height * 0.5)
        .fill({ color: 0xffaa44, alpha: flickerA });
      // Second smaller glow from right side
      const flickerB = 0.02 + Math.sin(elapsed * 3.2 + 1) * 0.008;
      this.lightOverlay
        .ellipse(this.width * 0.75, this.height * 0.7, this.width * 0.4, this.height * 0.35)
        .fill({ color: 0xff8833, alpha: flickerB });

      // Update motes
      for (const m of this.motes) {
        m.x += m.vx;
        m.y += m.vy;

        // Gentle horizontal sway
        m.x += Math.sin(elapsed * 0.8 + m.phase) * 0.15;

        // Wrap around
        if (m.y < -10) {
          m.y = this.height + 10;
          m.x = Math.random() * this.width;
        }
        if (m.x < -10) m.x = this.width + 10;
        if (m.x > this.width + 10) m.x = -10;

        // Twinkle
        const twinkle = 0.6 + Math.sin(elapsed * 2 + m.phase) * 0.4;
        m.g.alpha = m.baseAlpha * twinkle;

        m.g.x = m.x;
        m.g.y = m.y;
      }
    };

    this.app.ticker.add(this.tickFn);
  }

  /**
   * Spawn a brief burst of dust particles at a position (for piece landing).
   */
  spawnDustBurst(x: number, y: number): void {
    const count = 6;
    const particles: { g: Graphics; vx: number; vy: number; life: number }[] = [];

    for (let i = 0; i < count; i++) {
      const g = new Graphics();
      const size = 1 + Math.random() * 1.5;
      const color = Math.random() > 0.5 ? 0xd4a857 : 0x8b6914;
      g.circle(0, 0, size).fill({ color, alpha: 0.5 });
      g.x = x;
      g.y = y;
      this.container.addChild(g);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.8 + Math.random() * 1.2;
      particles.push({
        g,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 1,
      });
    }

    const decayRate = 0.02;
    const burstTick = () => {
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.life -= decayRate;
        p.g.x += p.vx;
        p.g.y += p.vy;
        p.vy += 0.03; // Gravity
        p.g.alpha = p.life * 0.5;
        p.g.scale.set(p.life);

        if (p.life <= 0) {
          p.g.destroy();
        }
      }
      if (!alive) {
        this.app.ticker.remove(burstTick);
      }
    };

    this.app.ticker.add(burstTick);
  }

  destroy(): void {
    if (this.tickFn) {
      this.app.ticker.remove(this.tickFn);
      this.tickFn = null;
    }
    this.container.destroy({ children: true });
  }
}

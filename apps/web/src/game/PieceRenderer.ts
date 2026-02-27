import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { Player, type GameState, type Move } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";

const GOLD_COLOR = 0xffd700;
const GOLD_BORDER = 0xb8960f;
const RED_COLOR = 0xce1126;
const RED_BORDER = 0x8a0b1a;

const MAX_VISUAL_STACK = 5;

export type PieceSet = "coconut" | "vinyl" | "lion" | "custom";

export class PieceRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private container: Container;
  private pieceContainers: Map<string, Container> = new Map();
  private pieceSet: PieceSet;

  // Custom SVG piece support
  private customSvgs: { gold: string; red: string } | null = null;
  private textureCache: Map<string, Texture> = new Map();
  private customTexturesReady = false;
  private blobUrls: string[] = [];

  // Glow effect state
  private glowContainer: Container;
  private glowGraphics: Graphics[] = [];
  private glowAnimTicker: ((dt: any) => void) | null = null;

  constructor(app: Application, boardRenderer: BoardRenderer, pieceSet: PieceSet = "lion") {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.pieceSet = pieceSet;
    this.glowContainer = new Container();
    app.stage.addChild(this.glowContainer);
    this.container = new Container();
    app.stage.addChild(this.container);
  }

  /**
   * Render all pieces based on current game state.
   * Clears and re-draws everything.
   */
  render(state: GameState): void {
    this.container.removeChildren();
    this.pieceContainers.clear();

    const radius = this.boardRenderer.getPieceRadius();

    // Render pieces on each point
    for (let i = 0; i < 24; i++) {
      const point = state.points[i];
      if (!point) continue;

      const count = point.count;
      const visualCount = Math.min(count, MAX_VISUAL_STACK);

      for (let s = 0; s < visualCount; s++) {
        const pos = this.boardRenderer.getPiecePosition(i, s, visualCount);
        const pieceContainer = this.createPiece(point.player, radius);
        pieceContainer.x = pos.x;
        pieceContainer.y = pos.y;

        // If this is the top piece and count > MAX_VISUAL_STACK, show count
        if (s === visualCount - 1 && count > MAX_VISUAL_STACK) {
          const countLabel = new Text({
            text: `${count}`,
            style: {
              fontSize: Math.max(10, Math.floor(radius * 0.9)),
              fill: point.player === Player.Gold ? 0x1a1a0e : 0xffffff,
              fontFamily: "Inter, sans-serif",
              fontWeight: "bold",
            },
          });
          countLabel.anchor.set(0.5, 0.5);
          pieceContainer.addChild(countLabel);
        }

        this.container.addChild(pieceContainer);

        // Store reference for the topmost piece on this point
        if (s === visualCount - 1) {
          this.pieceContainers.set(`point-${i}-${point.player}`, pieceContainer);
        }
      }
    }

    // Render bar pieces
    for (const player of [Player.Gold, Player.Red]) {
      const barCount = state.bar[player];
      if (barCount === 0) continue;

      const barPos = this.boardRenderer.getBarPosition(player);
      const visualBarCount = Math.min(barCount, 4);

      for (let s = 0; s < visualBarCount; s++) {
        // Stack toward player's side (Gold=down, Red=up)
        const offset =
          player === Player.Gold
            ? -(s * radius * 1.6)
            : s * radius * 1.6;
        const pieceContainer = this.createPiece(player, radius * 0.85);
        pieceContainer.x = barPos.x;
        pieceContainer.y = barPos.y + offset;

        if (s === visualBarCount - 1 && barCount > 1) {
          const countLabel = new Text({
            text: `${barCount}`,
            style: {
              fontSize: Math.max(9, Math.floor(radius * 0.8)),
              fill: player === Player.Gold ? 0x1a1a0e : 0xffffff,
              fontFamily: "Inter, sans-serif",
              fontWeight: "bold",
            },
          });
          countLabel.anchor.set(0.5, 0.5);
          pieceContainer.addChild(countLabel);
        }

        this.container.addChild(pieceContainer);

        if (s === visualBarCount - 1) {
          this.pieceContainers.set(`bar-${player}`, pieceContainer);
        }
      }
    }

    // Render borne off as a compact count badge
    for (const player of [Player.Gold, Player.Red]) {
      const borneOff = state.borneOff[player];
      if (borneOff === 0) continue;

      const pos = this.boardRenderer.getBearOffPosition(player);
      const color = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
      const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;

      const badgeContainer = new Container();
      badgeContainer.x = pos.x;
      badgeContainer.y = pos.y;

      // Background badge
      const badgeW = radius * 1.6;
      const badgeH = radius * 1.6;
      const bg = new Graphics();
      bg.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 6)
        .fill({ color, alpha: 0.25 })
        .roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 6)
        .stroke({ color: border, width: 1.5 });
      badgeContainer.addChild(bg);

      // Count number
      const label = new Text({
        text: `${borneOff}`,
        style: {
          fontSize: Math.max(12, Math.floor(radius * 0.9)),
          fill: color,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
        },
      });
      label.anchor.set(0.5, 0.5);
      badgeContainer.addChild(label);

      this.container.addChild(badgeContainer);
    }
  }

  private createPiece(player: Player, radius: number): Container {
    switch (this.pieceSet) {
      case "coconut":
        return this.createCoconutPiece(player, radius);
      case "vinyl":
        return this.createVinylPiece(player, radius);
      case "custom":
        return this.createCustomPiece(player, radius);
      case "lion":
      default:
        return this.createLionPiece(player, radius);
    }
  }

  /**
   * Lion head piece - radiating mane, face, eyes, and nose.
   */
  private createLionPiece(player: Player, radius: number): Container {
    const c = new Container();
    const g = new Graphics();
    const color = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
    const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;
    const darkShade = player === Player.Gold ? 0x997a00 : 0x7a0a18;
    const lightShade = player === Player.Gold ? 0xffee88 : 0xe84858;

    // Drop shadow
    g.circle(1, 2, radius).fill({ color: 0x000000, alpha: 0.3 });

    // Mane base (outer circle)
    g.circle(0, 0, radius).fill({ color });

    // Mane tufts: V-shaped fur points radiating outward
    const tuftCount = 10;
    for (let i = 0; i < tuftCount; i++) {
      const angle = (i / tuftCount) * Math.PI * 2;
      const tipR = radius * 0.97;
      const baseR = radius * 0.7;
      const halfW = (Math.PI / tuftCount) * 0.55;

      g.moveTo(
        Math.cos(angle - halfW) * baseR,
        Math.sin(angle - halfW) * baseR
      )
        .lineTo(Math.cos(angle) * tipR, Math.sin(angle) * tipR)
        .lineTo(
          Math.cos(angle + halfW) * baseR,
          Math.sin(angle + halfW) * baseR
        )
        .closePath()
        .fill({ color: darkShade, alpha: 0.45 });
    }

    // Face (lighter inner circle)
    const faceR = radius * 0.55;
    g.circle(0, radius * 0.04, faceR).fill({ color: lightShade });

    // Eyes
    const eyeR = Math.max(1.5, radius * 0.09);
    const eyeY = -radius * 0.06;
    g.circle(-radius * 0.17, eyeY, eyeR).fill({ color: 0x1a1a0e });
    g.circle(radius * 0.17, eyeY, eyeR).fill({ color: 0x1a1a0e });

    // Nose (small inverted triangle)
    const noseW = Math.max(2, radius * 0.1);
    const noseH = Math.max(1.8, radius * 0.09);
    g.moveTo(-noseW, radius * 0.12)
      .lineTo(noseW, radius * 0.12)
      .lineTo(0, radius * 0.12 + noseH)
      .closePath()
      .fill({ color: darkShade });

    // Mouth (small curved line)
    g.moveTo(-radius * 0.08, radius * 0.26)
      .lineTo(0, radius * 0.3)
      .lineTo(radius * 0.08, radius * 0.26)
      .stroke({ color: darkShade, width: Math.max(0.8, radius * 0.04) });

    // Outer border
    g.circle(0, 0, radius).stroke({ color: border, width: 2 });

    // Top highlight shine
    g.ellipse(-radius * 0.1, -radius * 0.38, radius * 0.28, radius * 0.1).fill({
      color: 0xffffff,
      alpha: 0.12,
    });

    c.addChild(g);
    return c;
  }

  /**
   * Coconut shell piece - halved coconut with fibrous texture and white flesh ring.
   */
  private createCoconutPiece(player: Player, radius: number): Container {
    const c = new Container();
    const g = new Graphics();

    const shellColor = player === Player.Gold ? 0x8b6914 : 0x6b2020;
    const shellDark = player === Player.Gold ? 0x5c4710 : 0x4a1515;
    const shellLight = player === Player.Gold ? 0xa07828 : 0x8a3030;
    const fleshColor = player === Player.Gold ? 0xfff8e7 : 0xffe0e0;
    const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;

    // Drop shadow
    g.circle(1, 2, radius).fill({ color: 0x000000, alpha: 0.3 });

    // Outer shell
    g.circle(0, 0, radius).fill({ color: shellColor });

    // Fibrous texture lines (radial scratches)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + 0.2;
      const innerR = radius * 0.35;
      const outerR = radius * 0.85;
      g.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
        .lineTo(Math.cos(angle + 0.15) * outerR, Math.sin(angle + 0.15) * outerR)
        .stroke({ color: shellDark, width: Math.max(0.8, radius * 0.04), alpha: 0.4 });
    }

    // White flesh ring (inner circle border)
    const fleshR = radius * 0.65;
    g.circle(0, 0, fleshR).fill({ color: fleshColor, alpha: 0.9 });

    // Coconut water center (darker inner)
    const waterR = radius * 0.45;
    g.circle(0, 0, waterR).fill({ color: shellLight });

    // Three "eyes" of the coconut
    const eyeR = Math.max(1.5, radius * 0.08);
    const eyeDist = radius * 0.2;
    g.circle(0, -eyeDist, eyeR).fill({ color: shellDark });
    g.circle(-eyeDist * 0.87, eyeDist * 0.5, eyeR).fill({ color: shellDark });
    g.circle(eyeDist * 0.87, eyeDist * 0.5, eyeR).fill({ color: shellDark });

    // Outer border
    g.circle(0, 0, radius).stroke({ color: border, width: 2 });

    // Top highlight
    g.ellipse(-radius * 0.15, -radius * 0.35, radius * 0.25, radius * 0.1).fill({
      color: 0xffffff,
      alpha: 0.15,
    });

    c.addChild(g);
    return c;
  }

  /**
   * Vinyl record piece - grooves, label center, and spindle hole.
   */
  private createVinylPiece(player: Player, radius: number): Container {
    const c = new Container();
    const g = new Graphics();

    const vinylColor = player === Player.Gold ? 0x1a1a0e : 0x1a0a0e;
    const grooveColor = player === Player.Gold ? 0x333320 : 0x331520;
    const labelColor = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
    const labelDark = player === Player.Gold ? GOLD_BORDER : RED_BORDER;
    const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;

    // Drop shadow
    g.circle(1, 2, radius).fill({ color: 0x000000, alpha: 0.3 });

    // Vinyl disc
    g.circle(0, 0, radius).fill({ color: vinylColor });

    // Grooves (concentric rings)
    const grooveCount = 5;
    for (let i = 1; i <= grooveCount; i++) {
      const r = radius * (0.4 + (i / grooveCount) * 0.5);
      g.circle(0, 0, r).stroke({ color: grooveColor, width: Math.max(0.5, radius * 0.02), alpha: 0.6 });
    }

    // Vinyl sheen (arc highlight)
    g.arc(0, 0, radius * 0.75, -Math.PI * 0.7, -Math.PI * 0.2)
      .stroke({ color: 0xffffff, width: Math.max(1, radius * 0.06), alpha: 0.08 });

    // Center label
    const labelR = radius * 0.38;
    g.circle(0, 0, labelR).fill({ color: labelColor });
    g.circle(0, 0, labelR).stroke({ color: labelDark, width: 1.5 });

    // Label text lines (decorative)
    const lineW = labelR * 0.55;
    g.moveTo(-lineW, -labelR * 0.15)
      .lineTo(lineW, -labelR * 0.15)
      .stroke({ color: labelDark, width: Math.max(0.8, radius * 0.035), alpha: 0.5 });
    g.moveTo(-lineW * 0.7, labelR * 0.1)
      .lineTo(lineW * 0.7, labelR * 0.1)
      .stroke({ color: labelDark, width: Math.max(0.6, radius * 0.025), alpha: 0.4 });

    // Spindle hole
    const holeR = Math.max(1.5, radius * 0.07);
    g.circle(0, 0, holeR).fill({ color: vinylColor });

    // Outer border
    g.circle(0, 0, radius).stroke({ color: border, width: 2 });

    // Subtle edge shine
    g.arc(0, 0, radius * 0.95, -Math.PI * 0.8, -Math.PI * 0.3)
      .stroke({ color: 0xffffff, width: Math.max(0.8, radius * 0.03), alpha: 0.1 });

    c.addChild(g);
    return c;
  }

  // ── Custom SVG Piece Support ──────────────────────────────────────────

  private async loadCustomTexture(svgStr: string, cacheKey: string): Promise<Texture> {
    const cached = this.textureCache.get(cacheKey);
    if (cached) return cached;

    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    this.blobUrls.push(url);
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); });

    const texture = Texture.from(img);
    this.textureCache.set(cacheKey, texture);
    return texture;
  }

  async setCustomSvgs(gold: string, red: string): Promise<void> {
    this.customSvgs = { gold, red };
    this.customTexturesReady = false;
    this.pieceSet = "custom";

    // Pre-load both textures
    await Promise.all([
      this.loadCustomTexture(gold, "custom-gold"),
      this.loadCustomTexture(red, "custom-red"),
    ]);
    this.customTexturesReady = true;
  }

  private createCustomPiece(player: Player, radius: number): Container {
    if (!this.customTexturesReady) {
      return this.createLionPiece(player, radius); // fallback
    }

    const cacheKey = player === Player.Gold ? "custom-gold" : "custom-red";
    const texture = this.textureCache.get(cacheKey);
    if (!texture) return this.createLionPiece(player, radius);

    const container = new Container();

    // Drop shadow
    const shadow = new Graphics();
    shadow.circle(1, 2, radius).fill({ color: 0x000000, alpha: 0.3 });
    container.addChild(shadow);

    const sprite = new Sprite(texture);
    sprite.width = radius * 2;
    sprite.height = radius * 2;
    sprite.anchor.set(0.5);
    container.addChild(sprite);

    // Border ring for consistency with other piece sets
    const border = new Graphics();
    const borderColor = player === Player.Gold ? 0xb8960f : 0x8a0b1a;
    border.circle(0, 0, radius).stroke({ color: borderColor, width: 2 });
    container.addChild(border);

    return container;
  }

  /**
   * Get the display object for a specific piece (for drag-and-drop).
   */
  getPieceAt(
    pointIndex: number | "bar",
    player: Player
  ): Container | null {
    if (pointIndex === "bar") {
      return this.pieceContainers.get(`bar-${player}`) ?? null;
    }
    return this.pieceContainers.get(`point-${pointIndex}-${player}`) ?? null;
  }

  /**
   * Animate a piece moving from one position to another.
   */
  async animateMove(move: Move, player: Player): Promise<void> {
    const radius = this.boardRenderer.getPieceRadius();

    // Determine start position
    let startX = 0;
    let startY = 0;
    if (move.from === "bar") {
      const barPos = this.boardRenderer.getBarPosition(player);
      startX = barPos.x;
      startY = barPos.y;
    } else {
      const pos = this.boardRenderer.getPiecePosition(move.from, 0);
      startX = pos.x;
      startY = pos.y;
    }

    // Determine end position
    let endX = 0;
    let endY = 0;
    if (move.to === "off") {
      const bearPos = this.boardRenderer.getBearOffPosition(player);
      endX = bearPos.x;
      endY = bearPos.y;
    } else {
      // We approximate position at stack 0 for animation; render() will fix it
      const pos = this.boardRenderer.getPiecePosition(move.to as number, 0);
      endX = pos.x;
      endY = pos.y;
    }

    // Create animated piece
    const animPiece = this.createPiece(player, radius);
    animPiece.x = startX;
    animPiece.y = startY;
    animPiece.zIndex = 1000;
    this.container.addChild(animPiece);

    // Drop shadow under the animated piece
    const shadow = new Graphics();
    shadow.ellipse(0, 0, radius * 0.7, radius * 0.25)
      .fill({ color: 0x000000, alpha: 0.25 });
    shadow.zIndex = 999;
    this.container.addChild(shadow);

    // Animate with ticker
    return new Promise<void>((resolve) => {
      const duration = 350; // ms
      const startTime = performance.now();
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Arc height scales with distance, with a nice minimum
      const arcHeight = Math.max(radius * 1.5, dist * 0.2);

      const tickFn = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out cubic for lateral movement
        const ease = 1 - Math.pow(1 - t, 3);

        const baseX = startX + dx * ease;
        const baseY = startY + dy * ease;

        // Hop arc (parabolic)
        const hop = Math.sin(t * Math.PI) * arcHeight;

        animPiece.x = baseX;
        animPiece.y = baseY - hop;

        // Scale: slight grow at peak, settle to normal
        const scalePulse = 1 + Math.sin(t * Math.PI) * 0.12;
        animPiece.scale.set(scalePulse);

        // Shadow follows ground position, squashes at peak
        shadow.x = baseX;
        shadow.y = baseY + radius * 0.3;
        const shadowScale = 1 - Math.sin(t * Math.PI) * 0.3;
        shadow.scale.set(shadowScale, shadowScale * 0.6);
        shadow.alpha = 0.25 * (1 - Math.sin(t * Math.PI) * 0.5);

        if (t >= 1) {
          this.app.ticker.remove(tickFn);
          shadow.destroy();
          animPiece.destroy();
          resolve();
        }
      };

      this.app.ticker.add(tickFn);
    });
  }

  /**
   * Show a pulsing glow behind all pieces that have legal moves.
   * Called when input is enabled and waiting for piece selection.
   */
  showMoveableGlow(moveableFroms: Set<number | "bar">, player: Player): void {
    this.clearMoveableGlow();

    const radius = this.boardRenderer.getPieceRadius();
    const glowColor = player === Player.Gold ? 0xffd700 : 0xce1126;
    const brightColor = player === Player.Gold ? 0xffee66 : 0xff4466;

    for (const from of moveableFroms) {
      const piece = this.getPieceAt(from, player);
      if (!piece) continue;

      const g = new Graphics();

      // Tight glow ring
      g.circle(piece.x, piece.y, radius * 1.18).fill({
        color: glowColor,
        alpha: 0.2,
      });
      // Crisp bright edge
      g.circle(piece.x, piece.y, radius * 1.08).stroke({
        color: brightColor,
        width: 2,
        alpha: 0.6,
      });

      this.glowContainer.addChild(g);
      this.glowGraphics.push(g);
    }

    // Animated pulse: alpha only
    if (this.glowGraphics.length > 0 && !this.glowAnimTicker) {
      const startTime = performance.now();
      this.glowAnimTicker = () => {
        const elapsed = performance.now() - startTime;
        const pulse = 0.7 + Math.sin(elapsed * 0.005) * 0.3;
        for (const g of this.glowGraphics) {
          g.alpha = pulse;
        }
      };
      this.app.ticker.add(this.glowAnimTicker);
    }
  }

  /**
   * Remove all moveable glow effects.
   */
  clearMoveableGlow(): void {
    if (this.glowAnimTicker) {
      this.app.ticker.remove(this.glowAnimTicker);
      this.glowAnimTicker = null;
    }
    this.glowGraphics = [];
    this.glowContainer.removeChildren();
  }

  destroy(): void {
    this.clearMoveableGlow();
    this.glowContainer.destroy({ children: true });
    this.container.destroy({ children: true });
    this.pieceContainers.clear();

    // Clean up custom SVG textures and blob URLs
    for (const texture of this.textureCache.values()) {
      texture.destroy(true);
    }
    this.textureCache.clear();
    for (const url of this.blobUrls) {
      URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
  }
}

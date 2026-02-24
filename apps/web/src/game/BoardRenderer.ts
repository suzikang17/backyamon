import { Application, Container, Graphics, Text } from "pixi.js";
import { Player } from "@backyamon/engine";

/**
 * BoardRenderer - Draws the backgammon board using PixiJS Graphics API.
 *
 * Layout from Gold player's perspective (all dimensions relative to given width/height):
 *   +-------------------------------------------------+--------+
 *   |  12 11 10  9  8  7 | BAR |  6  5  4  3  2  1   |  ZION  |
 *   |   (triangles down) |     |   (triangles down)   | (Red)  |
 *   |                    |     |                       |        |
 *   |   (triangles up)   |     |   (triangles up)      | (Gold) |
 *   |  13 14 15 16 17 18 |     |  19 20 21 22 23 24   |        |
 *   +-------------------------------------------------+--------+
 *
 * Point numbering matches standard backgammon from Gold's POV:
 *   Gold home = 19-24 (bottom right), Red home = 1-6 (top right)
 */

// Board colors — warm wood palette
const FRAME_WOOD = 0x7a4a2a; // Rich medium-brown frame
const FRAME_BORDER = 0x5c3317; // Darker border edge
const FELT_COLOR = 0x1e3a2a; // Dark green felt playing surface
const GREEN_POINT = 0x006b3f;
const GOLD_POINT = 0xd4a020;
const BAR_COLOR = 0x2a1a0e;
const ZION_COLOR = 0x2a1a0e;
const LABEL_COLOR = 0xd4a857;

// Wood grain palette
const GRAIN_LIGHT = 0xa06830;
const GRAIN_MED = 0x8b5522;
const GRAIN_DARK = 0x5a3412;
const GRAIN_KNOT = 0x4a2810;

export class BoardRenderer {
  private app: Application;
  private container: Container;
  private highlightContainer: Container;
  private highlightAnimTicker: ((dt: any) => void) | null = null;
  private highlightGraphics: Graphics[] = [];
  private boardWidth: number;
  private boardHeight: number;

  // Layout dimensions (calculated once)
  private padding: number;
  private playAreaX: number;
  private playAreaY: number;
  private playAreaW: number;
  private playAreaH: number;
  private barWidth: number;
  private barX: number;
  private zionWidth: number;
  private zionX: number;
  private _pointWidth: number;
  private pointHeight: number;
  private _pieceRadius: number;

  constructor(app: Application, width: number, height: number) {
    this.app = app;
    this.boardWidth = width;
    this.boardHeight = height;
    this.container = new Container();
    this.highlightContainer = new Container();
    app.stage.addChild(this.container);
    app.stage.addChild(this.highlightContainer);

    // Calculate layout (with minimums for small screens)
    this.padding = Math.max(Math.floor(width * 0.01), 4);
    this.zionWidth = Math.max(Math.floor(width * 0.065), 24);
    this.barWidth = Math.max(Math.floor(width * 0.04), 16);

    // Play area = total - border padding - zion tray
    const innerWidth = width - this.padding * 2;
    const innerHeight = height - this.padding * 2;
    this.playAreaX = this.padding;
    this.playAreaY = this.padding;
    this.playAreaW = innerWidth - this.zionWidth;
    this.playAreaH = innerHeight;

    this.zionX = this.playAreaX + this.playAreaW;

    // Bar is centered in the play area
    const halfBoardW = (this.playAreaW - this.barWidth) / 2;
    this.barX = this.playAreaX + halfBoardW;

    // Each quadrant has 6 points
    this._pointWidth = Math.floor(halfBoardW / 6);
    this.pointHeight = Math.floor(this.playAreaH * 0.42);
    this._pieceRadius = Math.max(Math.floor(this._pointWidth * 0.42), 10);

    this.drawBoard();
  }

  private drawBoard(): void {
    // Outer shadow for depth
    const outerShadow = new Graphics();
    outerShadow
      .roundRect(4, 5, this.boardWidth, this.boardHeight, 14)
      .fill({ color: 0x000000, alpha: 0.5 });
    this.container.addChild(outerShadow);

    // Wooden frame (full board area)
    const frame = new Graphics();
    frame
      .roundRect(0, 0, this.boardWidth, this.boardHeight, 10)
      .fill({ color: FRAME_WOOD });
    this.container.addChild(frame);

    // Wood grain across the entire frame
    this.drawWoodGrain();

    // Frame bevel — top/left highlight, bottom/right shadow
    const bevel = new Graphics();
    // Top edge highlight
    bevel
      .rect(2, 0, this.boardWidth - 4, 3)
      .fill({ color: 0xffffff, alpha: 0.12 });
    // Left edge highlight
    bevel
      .rect(0, 2, 3, this.boardHeight - 4)
      .fill({ color: 0xffffff, alpha: 0.08 });
    // Bottom edge shadow
    bevel
      .rect(2, this.boardHeight - 3, this.boardWidth - 4, 3)
      .fill({ color: 0x000000, alpha: 0.2 });
    // Right edge shadow
    bevel
      .rect(this.boardWidth - 3, 2, 3, this.boardHeight - 4)
      .fill({ color: 0x000000, alpha: 0.15 });
    this.container.addChild(bevel);

    // Outer border stroke
    const borderStroke = new Graphics();
    borderStroke
      .roundRect(0, 0, this.boardWidth, this.boardHeight, 10)
      .stroke({ color: FRAME_BORDER, width: 3 });
    this.container.addChild(borderStroke);

    // Felt playing surface (inset from frame)
    const felt = new Graphics();
    felt
      .rect(this.playAreaX, this.playAreaY, this.playAreaW, this.playAreaH)
      .fill({ color: FELT_COLOR });
    this.container.addChild(felt);

    // Subtle felt texture (very faint noise-like dots)
    const feltTex = new Graphics();
    const rng = this.seededRng(42);
    for (let i = 0; i < 200; i++) {
      const fx = this.playAreaX + rng() * this.playAreaW;
      const fy = this.playAreaY + rng() * this.playAreaH;
      feltTex
        .circle(fx, fy, 0.8 + rng() * 0.6)
        .fill({ color: rng() > 0.5 ? 0x2a5a3a : 0x142a1a, alpha: 0.15 + rng() * 0.1 });
    }
    this.container.addChild(feltTex);

    // Inset shadow around felt edge (recessed look)
    const inset = new Graphics();
    // Top inset shadow
    inset
      .rect(this.playAreaX, this.playAreaY, this.playAreaW, 4)
      .fill({ color: 0x000000, alpha: 0.3 });
    // Left inset shadow
    inset
      .rect(this.playAreaX, this.playAreaY, 4, this.playAreaH)
      .fill({ color: 0x000000, alpha: 0.25 });
    // Bottom inset highlight
    inset
      .rect(this.playAreaX, this.playAreaY + this.playAreaH - 2, this.playAreaW, 2)
      .fill({ color: 0xffffff, alpha: 0.06 });
    // Right inset highlight
    inset
      .rect(this.playAreaX + this.playAreaW - 2, this.playAreaY, 2, this.playAreaH)
      .fill({ color: 0xffffff, alpha: 0.04 });
    this.container.addChild(inset);

    // Draw bar (Babylon zone) — darker wood inset
    const bar = new Graphics();
    bar
      .rect(this.barX, this.playAreaY, this.barWidth, this.playAreaH)
      .fill({ color: BAR_COLOR });
    // Bar inset shadow
    bar
      .rect(this.barX, this.playAreaY, 2, this.playAreaH)
      .fill({ color: 0x000000, alpha: 0.3 });
    bar
      .rect(this.barX + this.barWidth - 2, this.playAreaY, 2, this.playAreaH)
      .fill({ color: 0x000000, alpha: 0.3 });
    this.container.addChild(bar);

    // "BABYLON" label on the bar
    const babylonLabel = new Text({
      text: "BABYLON",
      style: {
        fontSize: Math.max(8, Math.floor(this.barWidth * 0.3)),
        fill: 0x6b3510,
        fontFamily: "'Reggae One', cursive",
        fontWeight: "bold",
        letterSpacing: 2,
      },
    });
    babylonLabel.anchor.set(0.5, 0.5);
    babylonLabel.rotation = -Math.PI / 2;
    babylonLabel.x = this.barX + this.barWidth / 2;
    babylonLabel.y = this.playAreaY + this.playAreaH / 2;
    babylonLabel.alpha = 0.6;
    this.container.addChild(babylonLabel);

    // Zion tray — darker inset with golden tint
    const zion = new Graphics();
    zion
      .rect(this.zionX, this.playAreaY, this.zionWidth, this.playAreaH)
      .fill({ color: ZION_COLOR });
    // Golden tint
    zion
      .rect(this.zionX, this.playAreaY, this.zionWidth, this.playAreaH)
      .fill({ color: 0xffd700, alpha: 0.03 });
    // Inset shadow
    zion
      .rect(this.zionX, this.playAreaY, 2, this.playAreaH)
      .fill({ color: 0x000000, alpha: 0.3 });
    // Border
    zion
      .rect(this.zionX, this.playAreaY, this.zionWidth, this.playAreaH)
      .stroke({ color: FRAME_BORDER, width: 2 });
    // Divider line between Gold and Red halves
    zion
      .moveTo(this.zionX + 4, this.playAreaY + this.playAreaH / 2)
      .lineTo(this.zionX + this.zionWidth - 4, this.playAreaY + this.playAreaH / 2)
      .stroke({ color: FRAME_BORDER, width: 1, alpha: 0.5 });
    this.container.addChild(zion);

    // "ZION" label
    const zionLabel = new Text({
      text: "ZION",
      style: {
        fontSize: Math.max(8, Math.floor(this.zionWidth * 0.35)),
        fill: 0xffd700,
        fontFamily: "'Reggae One', cursive",
        fontWeight: "bold",
        letterSpacing: 2,
      },
    });
    zionLabel.anchor.set(0.5, 0.5);
    zionLabel.rotation = -Math.PI / 2;
    zionLabel.x = this.zionX + this.zionWidth / 2;
    zionLabel.y = this.playAreaY + this.playAreaH / 2;
    zionLabel.alpha = 0.4;
    this.container.addChild(zionLabel);

    // Draw the 24 triangular points
    this.drawPoints();
  }

  /**
   * Draw visible wood grain across the frame area using layered lines
   * with wavy offsets, varying thickness, and knot patterns.
   */
  private drawWoodGrain(): void {
    const bw = this.boardWidth;
    const bh = this.boardHeight;
    const rng = this.seededRng(7);

    // Layer 1: broad grain bands
    const bands = new Graphics();
    for (let y = 0; y < bh; y += 3) {
      const wave = Math.sin(y * 0.15 + rng() * 0.5) * 3 + Math.sin(y * 0.04) * 6;
      const alpha = 0.04 + Math.sin(y * 0.08) * 0.03;
      const color = y % 6 < 3 ? GRAIN_LIGHT : GRAIN_MED;
      bands
        .moveTo(wave, y)
        .lineTo(bw + wave, y)
        .stroke({ color, width: 1.5, alpha });
    }
    this.container.addChild(bands);

    // Layer 2: fine grain detail
    const fine = new Graphics();
    for (let y = 0; y < bh; y += 2) {
      const wave = Math.sin(y * 0.2 + 1.5) * 2 + Math.cos(y * 0.07) * 4;
      const alpha = 0.02 + rng() * 0.02;
      fine
        .moveTo(wave - 5, y)
        .lineTo(bw + wave + 5, y)
        .stroke({ color: GRAIN_DARK, width: 0.8, alpha });
    }
    this.container.addChild(fine);

    // Layer 3: darker accent streaks (irregular spacing)
    const streaks = new Graphics();
    for (let i = 0; i < 12; i++) {
      const y0 = rng() * bh;
      const thickness = 1 + rng() * 2;
      const alpha = 0.05 + rng() * 0.04;
      const waveFreq = 0.03 + rng() * 0.05;

      streaks.moveTo(0, y0);
      for (let x = 0; x <= bw; x += 8) {
        const yOff = Math.sin(x * waveFreq + i) * 3;
        streaks.lineTo(x, y0 + yOff);
      }
      streaks.stroke({ color: GRAIN_DARK, width: thickness, alpha });
    }
    this.container.addChild(streaks);

    // Layer 4: knots (oval rings)
    const knots = new Graphics();
    const knotPositions = [
      { x: bw * 0.12, y: bh * 0.18 },
      { x: bw * 0.85, y: bh * 0.82 },
      { x: bw * 0.45, y: bh * 0.08 },
      { x: bw * 0.68, y: bh * 0.92 },
    ];
    for (const k of knotPositions) {
      const rx = 4 + rng() * 6;
      const ry = 2 + rng() * 3;
      for (let ring = 0; ring < 3; ring++) {
        knots
          .ellipse(k.x, k.y, rx + ring * 3, ry + ring * 1.5)
          .stroke({ color: GRAIN_KNOT, width: 1, alpha: 0.06 - ring * 0.015 });
      }
      // Dark center
      knots.circle(k.x, k.y, 1.5).fill({ color: GRAIN_KNOT, alpha: 0.08 });
    }
    this.container.addChild(knots);
  }

  /**
   * Simple seeded pseudo-random for deterministic grain patterns.
   */
  private seededRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private drawPoints(): void {
    for (let i = 0; i < 24; i++) {
      const pos = this.getPointPosition(i);
      const dir = this.getPointDirection(i);
      const color = this.getPointColor(i);
      this.drawTriangle(pos.x, pos.y, this._pointWidth, this.pointHeight, dir, color);

      // Point number labels
      const labelY =
        dir === "up"
          ? this.playAreaY + this.playAreaH + this.padding * 0.2
          : this.playAreaY - this.padding * 0.5;
      const label = new Text({
        text: `${i + 1}`,
        style: {
          fontSize: Math.max(7, Math.floor(this._pointWidth * 0.32)),
          fill: LABEL_COLOR,
          fontFamily: "'Reggae One', cursive",
        },
      });
      label.anchor.set(0.5, dir === "up" ? 0 : 1);
      label.x = pos.x;
      label.y = labelY;
      label.alpha = 0.5;
      this.container.addChild(label);
    }
  }

  private drawTriangle(
    cx: number,
    baseY: number,
    width: number,
    height: number,
    direction: "up" | "down",
    color: number
  ): void {
    const halfW = width / 2;
    const tipY = direction === "up" ? baseY - height : baseY + height;

    // Base fill
    const g = new Graphics();
    g.moveTo(cx - halfW, baseY)
      .lineTo(cx + halfW, baseY)
      .lineTo(cx, tipY)
      .closePath()
      .fill({ color });

    // Subtle inner highlight (left edge catch-light)
    const highlight = new Graphics();
    highlight
      .moveTo(cx - halfW + 1, baseY)
      .lineTo(cx, tipY)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.08 });
    g.addChild(highlight);

    // Subtle shadow on the right edge
    const shadow = new Graphics();
    shadow
      .moveTo(cx + halfW - 1, baseY)
      .lineTo(cx, tipY)
      .stroke({ color: 0x000000, width: 1, alpha: 0.12 });
    g.addChild(shadow);

    // Thin outline for inlay look
    const outline = new Graphics();
    outline
      .moveTo(cx - halfW, baseY)
      .lineTo(cx + halfW, baseY)
      .lineTo(cx, tipY)
      .closePath()
      .stroke({ color: 0x000000, width: 0.8, alpha: 0.2 });
    g.addChild(outline);

    this.container.addChild(g);
  }

  private getPointColor(pointIndex: number): number {
    // Alternating green and gold
    return pointIndex % 2 === 0 ? GREEN_POINT : GOLD_POINT;
  }

  /**
   * Get the base position of a point (where pieces stack from).
   * From Gold's perspective (Gold = bottom):
   *   Points 0-11 (1-12) are on the TOP row (opponent's side).
   *   Points 12-23 (13-24) are on the BOTTOM row (player's side).
   *
   * Layout within each row:
   *   Top row (right to left): 0,1,2,3,4,5 | bar | 6,7,8,9,10,11
   *   Bottom row (left to right): 12,13,14,15,16,17 | bar | 18,19,20,21,22,23
   */
  getPointPosition(pointIndex: number): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (pointIndex >= 0 && pointIndex <= 5) {
      // Top right quadrant, points 1-6 (Red home board)
      // Rightmost = point 1 (index 0), leftmost = point 6 (index 5)
      const slot = 5 - pointIndex;
      x =
        this.barX +
        this.barWidth +
        slot * this._pointWidth +
        this._pointWidth / 2;
      y = this.playAreaY;
    } else if (pointIndex >= 6 && pointIndex <= 11) {
      // Top left quadrant, points 7-12
      // Rightmost = point 7 (index 6), leftmost = point 12 (index 11)
      const slot = 11 - pointIndex;
      x = this.playAreaX + slot * this._pointWidth + this._pointWidth / 2;
      y = this.playAreaY;
    } else if (pointIndex >= 12 && pointIndex <= 17) {
      // Bottom left quadrant, points 13-18
      // Leftmost = point 13 (index 12), rightmost = point 18 (index 17)
      const slot = pointIndex - 12;
      x = this.playAreaX + slot * this._pointWidth + this._pointWidth / 2;
      y = this.playAreaY + this.playAreaH;
    } else {
      // Bottom right quadrant, points 19-24 (Gold home board)
      // Leftmost = point 19 (index 18), rightmost = point 24 (index 23)
      const slot = pointIndex - 18;
      x =
        this.barX +
        this.barWidth +
        slot * this._pointWidth +
        this._pointWidth / 2;
      y = this.playAreaY + this.playAreaH;
    }

    return { x, y };
  }

  getPointDirection(pointIndex: number): "up" | "down" {
    // Top row (0-11) points down, bottom row (12-23) points up
    return pointIndex < 12 ? "down" : "up";
  }

  getBarPosition(player: Player): { x: number; y: number } {
    const x = this.barX + this.barWidth / 2;
    // Gold bar pieces in bottom half (player's side), Red in top half
    const y =
      player === Player.Gold
        ? this.playAreaY + this.playAreaH * 0.7
        : this.playAreaY + this.playAreaH * 0.3;
    return { x, y };
  }

  getBearOffPosition(player: Player): { x: number; y: number } {
    const x = this.zionX + this.zionWidth / 2;
    // Gold borne off in bottom half, Red in top half
    const y =
      player === Player.Gold
        ? this.playAreaY + this.playAreaH * 0.75
        : this.playAreaY + this.playAreaH * 0.25;
    return { x, y };
  }

  getPointWidth(): number {
    return this._pointWidth;
  }

  getPieceRadius(): number {
    return this._pieceRadius;
  }

  getPlayAreaBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: this.playAreaX,
      y: this.playAreaY,
      width: this.playAreaW,
      height: this.playAreaH,
    };
  }

  getBarBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.barX,
      y: this.playAreaY,
      width: this.barWidth,
      height: this.playAreaH,
    };
  }

  getDiceCenterPosition(): { x: number; y: number } {
    // Position dice in the right half of the board, between bar and Zion
    const rightHalfCenter = this.barX + this.barWidth + (this.zionX - this.barX - this.barWidth) / 2;
    return {
      x: rightHalfCenter,
      y: this.playAreaY + this.playAreaH / 2,
    };
  }

  /**
   * Get the position where a piece should be rendered on a point,
   * taking into account stacking. Spacing is adaptive so pieces
   * never overflow beyond the triangle height.
   */
  getPiecePosition(
    pointIndex: number,
    stackIndex: number,
    totalInStack?: number
  ): { x: number; y: number } {
    const base = this.getPointPosition(pointIndex);
    const dir = this.getPointDirection(pointIndex);
    const diameter = this._pieceRadius * 2;

    // Maximum available height for stacking is the triangle height
    const maxHeight = this.pointHeight - this._pieceRadius;
    const count = totalInStack ?? (stackIndex + 1);

    // Default spacing, compressed if needed to fit within triangle
    const idealSpacing = diameter * 0.95;
    const neededHeight = (count - 1) * idealSpacing + diameter;
    const spacing = neededHeight > maxHeight && count > 1
      ? (maxHeight - diameter) / (count - 1)
      : idealSpacing;

    // Inset from the board edge so pieces don't clip the frame
    const edgeInset = this._pieceRadius * 0.3;
    const offset = stackIndex * spacing + this._pieceRadius + edgeInset;

    return {
      x: base.x,
      y: dir === "up" ? base.y - offset : base.y + offset,
    };
  }

  highlightPoints(pointIndices: number[]): void {
    this.clearHighlights();

    for (const idx of pointIndices) {
      const pos = this.getPointPosition(idx);
      const dir = this.getPointDirection(idx);

      const g = new Graphics();
      const halfW = this._pointWidth / 2;
      const tipY =
        dir === "up" ? pos.y - this.pointHeight : pos.y + this.pointHeight;

      // Brighter triangle highlight
      g.moveTo(pos.x - halfW, pos.y)
        .lineTo(pos.x + halfW, pos.y)
        .lineTo(pos.x, tipY)
        .closePath()
        .fill({ color: 0x00ffaa, alpha: 0.35 });

      // Landing dot at the base of the triangle (where pieces actually land)
      const dotY = dir === "up" ? pos.y - this._pieceRadius - 2 : pos.y + this._pieceRadius + 2;
      g.circle(pos.x, dotY, this._pieceRadius * 0.5).fill({
        color: 0xffffff,
        alpha: 0.6,
      });

      // Outer glow ring at landing position
      g.circle(pos.x, dotY, this._pieceRadius * 0.8).stroke({
        color: 0x00ffaa,
        alpha: 0.5,
        width: 2,
      });

      this.highlightContainer.addChild(g);
      this.highlightGraphics.push(g);
    }

    // Start pulsing animation on highlights
    this.startHighlightPulse();
  }

  highlightBearOff(player: Player): void {
    const pos = this.getBearOffPosition(player);
    const g = new Graphics();
    g.roundRect(
      pos.x - this.zionWidth * 0.4,
      pos.y - this._pieceRadius * 1.5,
      this.zionWidth * 0.8,
      this._pieceRadius * 3,
      6
    ).fill({ color: 0x00ffaa, alpha: 0.4 });
    // Add a dot in the center
    g.circle(pos.x, pos.y, this._pieceRadius * 0.5).fill({
      color: 0xffffff,
      alpha: 0.6,
    });
    this.highlightContainer.addChild(g);
    this.highlightGraphics.push(g);

    // Start pulsing if not already
    this.startHighlightPulse();
  }

  private startHighlightPulse(): void {
    if (this.highlightAnimTicker) return; // already running

    const startTime = performance.now();
    this.highlightAnimTicker = () => {
      const elapsed = performance.now() - startTime;
      // Pulse between 0.5 and 1.0 alpha, period ~800ms
      const pulse = 0.75 + Math.sin(elapsed * 0.008) * 0.25;
      for (const g of this.highlightGraphics) {
        g.alpha = pulse;
      }
    };
    this.app.ticker.add(this.highlightAnimTicker);
  }

  private stopHighlightPulse(): void {
    if (this.highlightAnimTicker) {
      this.app.ticker.remove(this.highlightAnimTicker);
      this.highlightAnimTicker = null;
    }
  }

  clearHighlights(): void {
    this.stopHighlightPulse();
    this.highlightGraphics = [];
    this.highlightContainer.removeChildren();
  }

  destroy(): void {
    this.stopHighlightPulse();
    this.container.destroy({ children: true });
    this.highlightContainer.destroy({ children: true });
  }
}

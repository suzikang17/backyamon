import { Application, Container, Graphics, Text } from "pixi.js";
import { Player } from "@backyamon/engine";

/**
 * BoardRenderer - Draws the backgammon board using PixiJS Graphics API.
 *
 * Layout (all dimensions relative to given width/height):
 *   +-------------------------------------------------+--------+
 *   |  13 14 15 16 17 18 | BAR | 19 20 21 22 23 24   |  ZION  |
 *   |   (triangles down) |     |   (triangles down)   | (Gold) |
 *   |                    |     |                       |        |
 *   |   (triangles up)   |     |   (triangles up)      | (Red)  |
 *   |  12 11 10  9  8  7 |     |   6  5  4  3  2  1   |        |
 *   +-------------------------------------------------+--------+
 *
 * Point numbering matches standard backgammon:
 *   Gold home = 19-24 (top right), Red home = 1-6 (bottom right)
 */

// Board colors
const BOARD_FILL = 0x2a2a1e;
const BOARD_BORDER = 0x8b4513;
const GREEN_POINT = 0x006b3f;
const GOLD_POINT = 0xffd700;
const BAR_COLOR = 0x1a1a0e;
const ZION_COLOR = 0x1a1a0e;
const LABEL_COLOR = 0xd4a857;

// Wood grain overlay colors
const WOOD_LIGHT = 0x9b5523;
const WOOD_DARK = 0x6b3510;

export class BoardRenderer {
  private app: Application;
  private container: Container;
  private highlightContainer: Container;
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

    // Calculate layout
    this.padding = Math.floor(width * 0.01);
    this.zionWidth = Math.floor(width * 0.065);
    this.barWidth = Math.floor(width * 0.04);

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
    this._pieceRadius = Math.floor(this._pointWidth * 0.42);

    this.drawBoard();
  }

  private drawBoard(): void {
    // Outer shadow for depth
    const outerShadow = new Graphics();
    outerShadow
      .roundRect(3, 4, this.boardWidth, this.boardHeight, 14)
      .fill({ color: 0x000000, alpha: 0.4 });
    this.container.addChild(outerShadow);

    // Outer frame
    const frame = new Graphics();
    frame
      .roundRect(0, 0, this.boardWidth, this.boardHeight, 12)
      .fill({ color: BOARD_FILL })
      .roundRect(0, 0, this.boardWidth, this.boardHeight, 12)
      .stroke({ color: BOARD_BORDER, width: 3 });
    this.container.addChild(frame);

    // Wood grain texture overlay on the frame border area
    this.drawWoodGrain();

    // Inner shadow/depth at the board edges (inset shadow effect)
    const innerShadow = new Graphics();
    // Top edge shadow
    innerShadow
      .rect(this.playAreaX, this.playAreaY, this.playAreaW + this.zionWidth, 3)
      .fill({ color: 0x000000, alpha: 0.2 });
    // Left edge shadow
    innerShadow
      .rect(this.playAreaX, this.playAreaY, 3, this.playAreaH)
      .fill({ color: 0x000000, alpha: 0.15 });
    // Bottom highlight
    innerShadow
      .rect(
        this.playAreaX,
        this.playAreaY + this.playAreaH - 2,
        this.playAreaW + this.zionWidth,
        2
      )
      .fill({ color: 0xffffff, alpha: 0.05 });
    // Right highlight
    innerShadow
      .rect(
        this.zionX + this.zionWidth - 2,
        this.playAreaY,
        2,
        this.playAreaH
      )
      .fill({ color: 0xffffff, alpha: 0.04 });
    this.container.addChild(innerShadow);

    // Draw bar (Babylon zone)
    const bar = new Graphics();
    bar
      .rect(this.barX, this.playAreaY, this.barWidth, this.playAreaH)
      .fill({ color: BAR_COLOR });
    this.container.addChild(bar);

    // "BABYLON" label on the bar
    const babylonLabel = new Text({
      text: "BABYLON",
      style: {
        fontSize: Math.max(8, Math.floor(this.barWidth * 0.3)),
        fill: 0x8b4513,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        letterSpacing: 2,
      },
    });
    babylonLabel.anchor.set(0.5, 0.5);
    babylonLabel.rotation = -Math.PI / 2;
    babylonLabel.x = this.barX + this.barWidth / 2;
    babylonLabel.y = this.playAreaY + this.playAreaH / 2;
    this.container.addChild(babylonLabel);

    // Draw Zion tray
    const zion = new Graphics();
    zion
      .rect(this.zionX, this.playAreaY, this.zionWidth, this.playAreaH)
      .fill({ color: ZION_COLOR })
      .rect(this.zionX, this.playAreaY, this.zionWidth, this.playAreaH)
      .stroke({ color: BOARD_BORDER, width: 2 });
    this.container.addChild(zion);

    // "ZION" label on the tray
    const zionLabel = new Text({
      text: "ZION",
      style: {
        fontSize: Math.max(8, Math.floor(this.zionWidth * 0.35)),
        fill: 0xffd700,
        fontFamily: "Inter, sans-serif",
        fontWeight: "bold",
        letterSpacing: 2,
      },
    });
    zionLabel.anchor.set(0.5, 0.5);
    zionLabel.rotation = -Math.PI / 2;
    zionLabel.x = this.zionX + this.zionWidth / 2;
    zionLabel.y = this.playAreaY + this.playAreaH / 2;
    this.container.addChild(zionLabel);

    // Draw the 24 triangular points
    this.drawPoints();
  }

  /**
   * Draw subtle wood grain lines on the frame border area.
   * Uses overlapping semi-transparent lines to simulate a wood texture.
   */
  private drawWoodGrain(): void {
    const grain = new Graphics();
    const bw = this.boardWidth;
    const bh = this.boardHeight;
    const pad = this.padding;

    // Horizontal grain lines across the full board background
    const lineSpacing = 6;
    for (let y = 0; y < bh; y += lineSpacing) {
      // Vary the alpha and offset for a natural look
      const alpha = 0.02 + (Math.sin(y * 0.7) * 0.01);
      const offset = Math.sin(y * 0.3) * 2;
      const color = y % (lineSpacing * 2) === 0 ? WOOD_LIGHT : WOOD_DARK;

      grain
        .moveTo(offset, y)
        .lineTo(bw + offset, y)
        .stroke({ color, width: 1, alpha });
    }

    // A few knot-like ellipses for variety
    grain
      .ellipse(bw * 0.2, bh * 0.15, 8, 3)
      .stroke({ color: WOOD_DARK, width: 1, alpha: 0.03 });
    grain
      .ellipse(bw * 0.7, bh * 0.85, 6, 2.5)
      .stroke({ color: WOOD_DARK, width: 1, alpha: 0.025 });

    this.container.addChild(grain);
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
          fontFamily: "Inter, sans-serif",
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
    const g = new Graphics();
    const halfW = width / 2;
    const tipY = direction === "up" ? baseY - height : baseY + height;

    g.moveTo(cx - halfW, baseY)
      .lineTo(cx + halfW, baseY)
      .lineTo(cx, tipY)
      .closePath()
      .fill({ color });

    this.container.addChild(g);
  }

  private getPointColor(pointIndex: number): number {
    // Alternating green and gold
    return pointIndex % 2 === 0 ? GREEN_POINT : GOLD_POINT;
  }

  /**
   * Get the base position of a point (where pieces stack from).
   * Points 0-11 (1-12) are on the bottom row.
   * Points 12-23 (13-24) are on the top row.
   *
   * Layout within each row:
   *   Bottom row (right to left): 0,1,2,3,4,5 | bar | 6,7,8,9,10,11
   *   Top row (left to right): 12,13,14,15,16,17 | bar | 18,19,20,21,22,23
   */
  getPointPosition(pointIndex: number): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (pointIndex >= 0 && pointIndex <= 5) {
      // Bottom right quadrant, points 1-6 (Red home board)
      // Rightmost = point 1 (index 0), leftmost = point 6 (index 5)
      const slot = 5 - pointIndex; // 0=rightmost, 5=leftmost
      x =
        this.barX +
        this.barWidth +
        slot * this._pointWidth +
        this._pointWidth / 2;
      y = this.playAreaY + this.playAreaH;
    } else if (pointIndex >= 6 && pointIndex <= 11) {
      // Bottom left quadrant, points 7-12
      // Rightmost = point 7 (index 6), leftmost = point 12 (index 11)
      const slot = 11 - pointIndex;
      x = this.playAreaX + slot * this._pointWidth + this._pointWidth / 2;
      y = this.playAreaY + this.playAreaH;
    } else if (pointIndex >= 12 && pointIndex <= 17) {
      // Top left quadrant, points 13-18
      // Leftmost = point 13 (index 12), rightmost = point 18 (index 17)
      const slot = pointIndex - 12;
      x = this.playAreaX + slot * this._pointWidth + this._pointWidth / 2;
      y = this.playAreaY;
    } else {
      // Top right quadrant, points 19-24 (Gold home board)
      // Leftmost = point 19 (index 18), rightmost = point 24 (index 23)
      const slot = pointIndex - 18;
      x =
        this.barX +
        this.barWidth +
        slot * this._pointWidth +
        this._pointWidth / 2;
      y = this.playAreaY;
    }

    return { x, y };
  }

  getPointDirection(pointIndex: number): "up" | "down" {
    // Bottom row points up, top row points down
    return pointIndex < 12 ? "up" : "down";
  }

  getBarPosition(player: Player): { x: number; y: number } {
    const x = this.barX + this.barWidth / 2;
    // Gold bar pieces in top half, Red in bottom half
    const y =
      player === Player.Gold
        ? this.playAreaY + this.playAreaH * 0.3
        : this.playAreaY + this.playAreaH * 0.7;
    return { x, y };
  }

  getBearOffPosition(player: Player): { x: number; y: number } {
    const x = this.zionX + this.zionWidth / 2;
    // Gold borne off in top half, Red in bottom half
    const y =
      player === Player.Gold
        ? this.playAreaY + this.playAreaH * 0.25
        : this.playAreaY + this.playAreaH * 0.75;
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
    return {
      x: this.barX + this.barWidth / 2,
      y: this.playAreaY + this.playAreaH / 2,
    };
  }

  /**
   * Get the position where a piece should be rendered on a point,
   * taking into account stacking.
   */
  getPiecePosition(
    pointIndex: number,
    stackIndex: number
  ): { x: number; y: number } {
    const base = this.getPointPosition(pointIndex);
    const dir = this.getPointDirection(pointIndex);
    const diameter = this._pieceRadius * 2;
    const spacing = diameter * 0.95;

    const offset = stackIndex * spacing + this._pieceRadius + 2;

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

      g.moveTo(pos.x - halfW, pos.y)
        .lineTo(pos.x + halfW, pos.y)
        .lineTo(pos.x, tipY)
        .closePath()
        .fill({ color: 0x00ff88, alpha: 0.3 });

      // Glow circle at tip
      g.circle(pos.x, tipY, this._pieceRadius * 1.2).fill({
        color: 0x00ff88,
        alpha: 0.2,
      });

      this.highlightContainer.addChild(g);
    }
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
    ).fill({ color: 0x00ff88, alpha: 0.3 });
    this.highlightContainer.addChild(g);
  }

  clearHighlights(): void {
    this.highlightContainer.removeChildren();
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.highlightContainer.destroy({ children: true });
  }
}

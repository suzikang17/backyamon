import { Application, Container, Graphics, Text } from "pixi.js";
import { Player, type GameState, type Move } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";

const GOLD_COLOR = 0xffd700;
const GOLD_BORDER = 0xb8960f;
const RED_COLOR = 0xce1126;
const RED_BORDER = 0x8a0b1a;

const MAX_VISUAL_STACK = 5;

export class PieceRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private container: Container;
  private pieceContainers: Map<string, Container> = new Map();

  constructor(app: Application, boardRenderer: BoardRenderer) {
    this.app = app;
    this.boardRenderer = boardRenderer;
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

    // Render borne off as mini stacked chips
    for (const player of [Player.Gold, Player.Red]) {
      const borneOff = state.borneOff[player];
      if (borneOff === 0) continue;

      const pos = this.boardRenderer.getBearOffPosition(player);
      const color = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
      const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;
      const miniR = radius * 0.55;
      const chipSpacing = Math.min(miniR * 0.6, (radius * 4) / Math.max(borneOff, 1));

      // Stack direction: Gold stacks upward, Red stacks downward
      for (let i = 0; i < borneOff; i++) {
        const chip = new Graphics();
        const yOff = player === Player.Gold
          ? -(i * chipSpacing)
          : i * chipSpacing;
        chip
          .roundRect(pos.x - miniR, pos.y + yOff - miniR * 0.4, miniR * 2, miniR * 0.8, 3)
          .fill({ color })
          .roundRect(pos.x - miniR, pos.y + yOff - miniR * 0.4, miniR * 2, miniR * 0.8, 3)
          .stroke({ color: border, width: 1 });
        this.container.addChild(chip);
      }

      // Count label on top
      const label = new Text({
        text: `${borneOff}`,
        style: {
          fontSize: Math.max(9, Math.floor(miniR * 1.4)),
          fill: color,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
        },
      });
      label.anchor.set(0.5, 0.5);
      const labelYOff = player === Player.Gold
        ? -(borneOff * chipSpacing) - miniR * 1.2
        : borneOff * chipSpacing + miniR * 1.2;
      label.x = pos.x;
      label.y = pos.y + labelYOff;
      this.container.addChild(label);
    }
  }

  /**
   * Draw a stylized lion head piece - the default Backyamon piece set.
   * Features a radiating mane, lighter face circle, eyes, and nose.
   */
  private createPiece(player: Player, radius: number): Container {
    const c = new Container();
    const g = new Graphics();
    const color = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
    const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;
    const darkShade = player === Player.Gold ? 0x997a00 : 0x7a0a18;
    const lightShade = player === Player.Gold ? 0xffee88 : 0xe84858;

    // Drop shadow
    g.circle(1.5, 3, radius).fill({ color: 0x000000, alpha: 0.35 });

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
    g.ellipse(-radius * 0.1, -radius * 0.38, radius * 0.28, radius * 0.1).fill(
      {
        color: 0xffffff,
        alpha: 0.12,
      }
    );

    c.addChild(g);
    return c;
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

    // Animate with ticker
    return new Promise<void>((resolve) => {
      const duration = 300; // ms
      const startTime = performance.now();

      const tickFn = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const ease = 1 - Math.pow(1 - t, 3);

        animPiece.x = startX + (endX - startX) * ease;
        animPiece.y = startY + (endY - startY) * ease;

        // Slight arc
        const arcHeight = Math.abs(endX - startX) * 0.15;
        animPiece.y -= Math.sin(t * Math.PI) * arcHeight;

        if (t >= 1) {
          this.app.ticker.remove(tickFn);
          animPiece.destroy();
          resolve();
        }
      };

      this.app.ticker.add(tickFn);
    });
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.pieceContainers.clear();
  }
}

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
        const pos = this.boardRenderer.getPiecePosition(i, s);
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
      const visualBarCount = Math.min(barCount, 3);

      for (let s = 0; s < visualBarCount; s++) {
        const offset =
          player === Player.Gold
            ? s * radius * 1.8
            : -(s * radius * 1.8);
        const pieceContainer = this.createPiece(player, radius * 0.9);
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

    // Render borne off counts
    for (const player of [Player.Gold, Player.Red]) {
      const borneOff = state.borneOff[player];
      if (borneOff === 0) continue;

      const pos = this.boardRenderer.getBearOffPosition(player);
      const bearOffContainer = new Container();
      bearOffContainer.x = pos.x;
      bearOffContainer.y = pos.y;

      const bg = new Graphics();
      bg.roundRect(-radius * 1.1, -radius * 1.1, radius * 2.2, radius * 2.2, 4)
        .fill({
          color: player === Player.Gold ? GOLD_COLOR : RED_COLOR,
          alpha: 0.3,
        });
      bearOffContainer.addChild(bg);

      const label = new Text({
        text: `${borneOff}`,
        style: {
          fontSize: Math.max(12, Math.floor(radius * 1.2)),
          fill: player === Player.Gold ? GOLD_COLOR : RED_COLOR,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
        },
      });
      label.anchor.set(0.5, 0.5);
      bearOffContainer.addChild(label);

      this.container.addChild(bearOffContainer);
    }
  }

  private createPiece(player: Player, radius: number): Container {
    const c = new Container();
    const g = new Graphics();
    const color = player === Player.Gold ? GOLD_COLOR : RED_COLOR;
    const border = player === Player.Gold ? GOLD_BORDER : RED_BORDER;

    // Shadow
    g.circle(1, 2, radius).fill({ color: 0x000000, alpha: 0.25 });

    // Main circle
    g.circle(0, 0, radius).fill({ color });

    // Border
    g.circle(0, 0, radius).stroke({ color: border, width: 2 });

    // Highlight (inner shine)
    g.circle(-radius * 0.2, -radius * 0.2, radius * 0.4).fill({
      color: 0xffffff,
      alpha: 0.15,
    });

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

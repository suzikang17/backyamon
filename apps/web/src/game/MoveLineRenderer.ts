import { Application, Container, Graphics, Text } from "pixi.js";
import { Player, type GameState, type Move } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";

const FADE_ALPHA = 0.25;
const ACTIVE_ALPHA = 0.7;
const LINE_WIDTH_FADE = 2;
const LINE_WIDTH_ACTIVE = 3.5;

/**
 * Renders curved arcs from moveable pieces to their legal targets.
 *
 * - All legal moves shown as faded arcs when input is enabled.
 * - Hovering or selecting a piece brightens its arcs and shows number labels.
 * - Clicking an arc (or pressing its number key) executes the move.
 */
export class MoveLineRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;

  // Container for faded background lines
  private fadeContainer: Container;
  // Container for active (highlighted) lines drawn on top
  private activeContainer: Container;

  // All line data for the current state
  private moveLines: MoveLineData[] = [];
  // Currently highlighted piece
  private highlightedFrom: number | "bar" | null = null;

  // Callback when a line/label is clicked
  onMoveClicked: ((move: Move) => void) | null = null;

  constructor(app: Application, boardRenderer: BoardRenderer) {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.fadeContainer = new Container();
    this.fadeContainer.zIndex = 400;
    this.activeContainer = new Container();
    this.activeContainer.zIndex = 450;
    app.stage.addChild(this.fadeContainer);
    app.stage.addChild(this.activeContainer);
  }

  /**
   * Draw all legal move lines for the current state.
   */
  showMoveLines(state: GameState, legalMoves: Move[]): void {
    this.clear();

    const player = state.currentPlayer;
    const radius = this.boardRenderer.getPieceRadius();

    // Group moves by source
    const movesByFrom = new Map<string, Move[]>();
    for (const move of legalMoves) {
      const key = String(move.from);
      if (!movesByFrom.has(key)) movesByFrom.set(key, []);
      movesByFrom.get(key)!.push(move);
    }

    // Create line data for each move
    for (const move of legalMoves) {
      const start = this.getPosition(move.from, player, state);
      const end = this.getPosition(move.to, player, state);
      if (!start || !end) continue;

      // Assign a label index within its group
      const groupMoves = movesByFrom.get(String(move.from))!;
      const labelIdx = groupMoves.indexOf(move) + 1;

      const lineData: MoveLineData = {
        move,
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
        label: groupMoves.length > 1 ? labelIdx : null,
      };
      this.moveLines.push(lineData);

      // Draw faded line
      this.drawLine(lineData, player, false);
    }
  }

  /**
   * Highlight all lines from a specific source piece.
   * Pass null to clear highlight.
   */
  highlightFrom(from: number | "bar" | null): void {
    if (from === this.highlightedFrom) return;
    this.highlightedFrom = from;
    this.activeContainer.removeChildren();

    if (from === null) return;

    const activeLines = this.moveLines.filter(
      (l) => l.move.from === from
    );

    // Also dim lines NOT from this source
    this.fadeContainer.alpha = 0.3;

    for (const lineData of activeLines) {
      // We need the player color - infer from move context
      this.drawLine(lineData, null, true);
    }
  }

  /**
   * Clear highlight, restore all faded lines to normal.
   */
  clearHighlight(): void {
    this.highlightedFrom = null;
    this.activeContainer.removeChildren();
    this.fadeContainer.alpha = 1;
  }

  /**
   * Get the move for a given label index on the currently highlighted piece.
   */
  getMoveByLabel(labelIdx: number): Move | null {
    if (this.highlightedFrom === null) return null;
    const activeLines = this.moveLines.filter(
      (l) => l.move.from === this.highlightedFrom
    );
    if (labelIdx >= 1 && labelIdx <= activeLines.length) {
      return activeLines[labelIdx - 1].move;
    }
    return null;
  }

  /**
   * Get the number of active lines for the highlighted piece.
   */
  getActiveLineCount(): number {
    if (this.highlightedFrom === null) return 0;
    return this.moveLines.filter(
      (l) => l.move.from === this.highlightedFrom
    ).length;
  }

  clear(): void {
    this.fadeContainer.removeChildren();
    this.activeContainer.removeChildren();
    this.fadeContainer.alpha = 1;
    this.moveLines = [];
    this.highlightedFrom = null;
  }

  destroy(): void {
    this.clear();
    this.fadeContainer.destroy({ children: true });
    this.activeContainer.destroy({ children: true });
  }

  private getPosition(
    point: number | "bar" | "off",
    player: Player,
    state: GameState
  ): { x: number; y: number } | null {
    if (point === "bar") {
      return this.boardRenderer.getBarPosition(player);
    }
    if (point === "off") {
      return this.boardRenderer.getBearOffPosition(player);
    }
    if (typeof point === "number") {
      // Use piece position at top of stack for source, base for target
      const ptData = state.points[point];
      const count = ptData ? ptData.count : 0;
      if (count > 0) {
        return this.boardRenderer.getPiecePosition(
          point,
          Math.min(count, 5) - 1,
          Math.min(count, 5)
        );
      }
      return this.boardRenderer.getPointPosition(point);
    }
    return null;
  }

  private drawLine(
    lineData: MoveLineData,
    player: Player | null,
    active: boolean
  ): void {
    const container = active ? this.activeContainer : this.fadeContainer;
    const alpha = active ? ACTIVE_ALPHA : FADE_ALPHA;
    const lineWidth = active ? LINE_WIDTH_ACTIVE : LINE_WIDTH_FADE;
    const radius = this.boardRenderer.getPieceRadius();
    const color = this.getLineColor(lineData, player, active);

    // Calculate control point for a curved arc
    const midX = (lineData.startX + lineData.endX) / 2;
    const midY = (lineData.startY + lineData.endY) / 2;
    const dx = lineData.endX - lineData.startX;
    const dy = lineData.endY - lineData.startY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const arcHeight = Math.min(dist * 0.25, radius * 3);
    // Perpendicular direction
    const nx = -dy / dist;
    const ny = dx / dist;
    const cpX = midX + nx * arcHeight;
    const cpY = midY + ny * arcHeight;

    // Draw the arc
    const g = new Graphics();
    g.moveTo(lineData.startX, lineData.startY);
    g.quadraticCurveTo(cpX, cpY, lineData.endX, lineData.endY);
    g.stroke({ color, width: lineWidth, alpha });
    container.addChild(g);

    // Tangent direction at the end point (for arrowhead orientation)
    const tangentX = lineData.endX - cpX;
    const tangentY = lineData.endY - cpY;
    const tangentLen = Math.sqrt(tangentX * tangentX + tangentY * tangentY) || 1;
    const tdx = tangentX / tangentLen;
    const tdy = tangentY / tangentLen;

    // Arrowhead
    if (active) {
      const arrowSize = radius * 0.4;
      const ax = lineData.endX;
      const ay = lineData.endY;
      const arrowG = new Graphics();
      arrowG
        .moveTo(ax, ay)
        .lineTo(
          ax - tdx * arrowSize + tdy * arrowSize * 0.5,
          ay - tdy * arrowSize - tdx * arrowSize * 0.5
        )
        .lineTo(
          ax - tdx * arrowSize - tdy * arrowSize * 0.5,
          ay - tdy * arrowSize + tdx * arrowSize * 0.5
        )
        .closePath()
        .fill({ color, alpha: alpha + 0.15 });
      container.addChild(arrowG);

      // Wide invisible hit area for clicking
      const hitG = new Graphics();
      hitG.moveTo(lineData.startX, lineData.startY);
      hitG.quadraticCurveTo(cpX, cpY, lineData.endX, lineData.endY);
      hitG.stroke({ color: 0xffffff, width: radius * 1.2, alpha: 0.001 });
      hitG.eventMode = "static";
      hitG.cursor = "pointer";
      hitG.on("pointerdown", () => {
        this.onMoveClicked?.(lineData.move);
      });
      container.addChild(hitG);
    }

    // Number label at the target end (only when multiple targets)
    if (active && lineData.label !== null) {
      const labelSize = Math.max(10, radius * 0.7);
      // Offset the label slightly back along the tangent so it doesn't overlap the point
      const labelX = lineData.endX - tdx * radius * 0.6;
      const labelY = lineData.endY - tdy * radius * 0.6;

      const labelBg = new Graphics();
      labelBg.circle(labelX, labelY, labelSize * 0.75).fill({
        color: 0x1a1a0e,
        alpha: 0.85,
      });
      labelBg.circle(labelX, labelY, labelSize * 0.75).stroke({
        color,
        width: 1.5,
        alpha: 0.8,
      });
      labelBg.eventMode = "static";
      labelBg.cursor = "pointer";
      labelBg.on("pointerdown", () => {
        this.onMoveClicked?.(lineData.move);
      });
      container.addChild(labelBg);

      const text = new Text({
        text: `${lineData.label}`,
        style: {
          fontSize: labelSize,
          fill: color,
          fontFamily: "Inter, sans-serif",
          fontWeight: "bold",
        },
      });
      text.anchor.set(0.5, 0.5);
      text.x = labelX;
      text.y = labelY;
      container.addChild(text);
    }
  }

  private getLineColor(
    _lineData: MoveLineData,
    _player: Player | null,
    active: boolean
  ): number {
    // Use high-contrast colors that stand out against the board
    return active ? 0x00ffcc : 0x88ddbb;
  }
}

interface MoveLineData {
  move: Move;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  label: number | null;
}

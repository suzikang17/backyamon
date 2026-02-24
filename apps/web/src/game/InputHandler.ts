import { Application, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { Player, type GameState, type Move } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";
import { PieceRenderer } from "./PieceRenderer";

export class InputHandler {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private pieceRenderer: PieceRenderer;
  private state: GameState | null = null;
  private legalMoves: Move[] = [];
  private enabled = false;

  // Selection state
  private selectedFrom: number | "bar" | null = null;
  private selectedPiece: Container | null = null;
  private selectedPieceOrigX = 0;
  private selectedPieceOrigY = 0;
  private isDragging = false;

  // Multi-move: track pending auto-select after a move completes
  private pendingAutoSelectFrom: number | "bar" | null = null;

  // Hit areas for click targets
  private hitAreaContainer: Container;
  private pointHitAreas: Map<number, Graphics> = new Map();
  private barHitArea: Graphics | null = null;
  private bearOffHitArea: Graphics | null = null;

  // Callback
  onMoveSelected: ((move: Move) => void) | null = null;

  constructor(
    app: Application,
    boardRenderer: BoardRenderer,
    pieceRenderer: PieceRenderer
  ) {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.pieceRenderer = pieceRenderer;
    this.hitAreaContainer = new Container();
    this.hitAreaContainer.zIndex = 900;
    app.stage.addChild(this.hitAreaContainer);

    this.setupHitAreas();
  }

  private setupHitAreas(): void {
    const pw = this.boardRenderer.getPointWidth();

    // Create invisible hit areas for each point
    for (let i = 0; i < 24; i++) {
      const pos = this.boardRenderer.getPointPosition(i);
      const dir = this.boardRenderer.getPointDirection(i);
      const area = this.boardRenderer.getPlayAreaBounds();

      const hitArea = new Graphics();
      hitArea.rect(
        pos.x - pw / 2,
        dir === "up" ? pos.y - area.height * 0.45 : pos.y,
        pw,
        area.height * 0.45
      ).fill({ color: 0xffffff, alpha: 0.001 }); // Nearly invisible

      hitArea.eventMode = "static";
      hitArea.cursor = "default";

      const pointIndex = i;
      hitArea.on("pointerdown", (e: FederatedPointerEvent) => {
        this.onPointClick(pointIndex, e);
      });

      this.pointHitAreas.set(i, hitArea);
      this.hitAreaContainer.addChild(hitArea);
    }

    // Bar hit area
    const barBounds = this.boardRenderer.getBarBounds();
    this.barHitArea = new Graphics();
    this.barHitArea
      .rect(barBounds.x, barBounds.y, barBounds.width, barBounds.height)
      .fill({ color: 0xffffff, alpha: 0.001 });
    this.barHitArea.eventMode = "static";
    this.barHitArea.on("pointerdown", () => {
      this.onBarClick();
    });
    this.hitAreaContainer.addChild(this.barHitArea);

    // Bear-off hit area
    const bearGold = this.boardRenderer.getBearOffPosition(Player.Gold);
    const bearRed = this.boardRenderer.getBearOffPosition(Player.Red);
    const zionR = this.boardRenderer.getPieceRadius() * 2;
    this.bearOffHitArea = new Graphics();
    this.bearOffHitArea
      .rect(bearGold.x - zionR, bearGold.y - zionR, zionR * 2, (bearRed.y - bearGold.y) + zionR * 2)
      .fill({ color: 0xffffff, alpha: 0.001 });
    this.bearOffHitArea.eventMode = "static";
    this.bearOffHitArea.on("pointerdown", () => {
      this.onBearOffClick();
    });
    this.hitAreaContainer.addChild(this.bearOffHitArea);

    // Ensure stage can receive events for drag handling
    this.app.stage.eventMode = "static";
  }

  /**
   * Enable interaction for the current player's turn.
   */
  enable(state: GameState, legalMoves: Move[]): void {
    this.state = state;
    this.legalMoves = legalMoves;
    this.enabled = true;
    this.deselect();
    this.updateCursors();

    // Show glow on all moveable pieces
    this.showMoveableGlow();

    // Multi-move: if we have a pending auto-select from a previous move,
    // auto-select the same point if it still has moves
    const autoFrom = this.pendingAutoSelectFrom;
    this.pendingAutoSelectFrom = null;

    if (autoFrom !== null) {
      const movesFromHere = this.legalMoves.filter((m) => m.from === autoFrom);
      if (movesFromHere.length > 0) {
        // Auto-select this piece (without drag)
        this.selectPiece(autoFrom);
        return;
      }
    }
  }

  /**
   * Disable all interaction.
   */
  disable(): void {
    this.enabled = false;
    this.deselect();
    this.pieceRenderer.clearMoveableGlow();
    this.updateCursors();
  }

  /**
   * Set the point/bar to auto-select on next enable() call.
   * Used for multi-move from the same position (doubles).
   * Pass null to clear.
   */
  setAutoSelectFrom(from: number | "bar" | null): void {
    this.pendingAutoSelectFrom = from;
  }

  private updateCursors(): void {
    if (!this.enabled || !this.state) {
      // Disable all cursors
      this.pointHitAreas.forEach((area) => {
        area.cursor = "default";
      });
      if (this.barHitArea) this.barHitArea.cursor = "default";
      return;
    }

    const player = this.state.currentPlayer;
    const movablePointFroms = new Set<number>(
      this.legalMoves
        .filter((m): m is Move & { from: number } => typeof m.from === "number")
        .map((m) => m.from)
    );

    // Set cursors for points that have movable pieces
    this.pointHitAreas.forEach((area, idx) => {
      const point = this.state!.points[idx];
      if (point && point.player === player && movablePointFroms.has(idx)) {
        area.cursor = "pointer";
      } else {
        area.cursor = "default";
      }
    });

    // Bar cursor
    if (this.barHitArea) {
      const hasBarMove = this.legalMoves.some((m) => m.from === "bar");
      this.barHitArea.cursor = hasBarMove ? "pointer" : "default";
    }
  }

  private onPointClick(pointIndex: number, e: FederatedPointerEvent): void {
    if (!this.enabled || !this.state) return;

    const player = this.state.currentPlayer;

    // If we already have a selection, check if this is a valid target
    if (this.selectedFrom !== null) {
      const matchingMove = this.legalMoves.find(
        (m) => m.from === this.selectedFrom && m.to === pointIndex
      );
      if (matchingMove) {
        this.executeMove(matchingMove);
        return;
      }
    }

    // Check if this point has the current player's pieces and can move from here
    const point = this.state.points[pointIndex];
    if (!point || point.player !== player) {
      this.deselect();
      return;
    }

    // Check if any legal moves start from this point
    const movesFromHere = this.legalMoves.filter((m) => m.from === pointIndex);
    if (movesFromHere.length === 0) {
      this.deselect();
      return;
    }

    // Auto-move: if there's exactly one legal move from here, execute it immediately
    if (movesFromHere.length === 1) {
      this.executeMove(movesFromHere[0]);
      return;
    }

    // Select this piece
    this.selectPiece(pointIndex, e);
  }

  private onBarClick(): void {
    if (!this.enabled || !this.state) return;

    const player = this.state.currentPlayer;
    if (this.state.bar[player] === 0) {
      this.deselect();
      return;
    }

    const movesFromBar = this.legalMoves.filter((m) => m.from === "bar");
    if (movesFromBar.length === 0) {
      this.deselect();
      return;
    }

    // Auto-move: if there's exactly one legal move from bar, execute it immediately
    if (movesFromBar.length === 1) {
      this.executeMove(movesFromBar[0]);
      return;
    }

    this.selectPiece("bar");
  }

  private onBearOffClick(): void {
    if (!this.enabled || !this.state || this.selectedFrom === null) return;

    // Check if there's a bear-off move from the selected piece
    const matchingMove = this.legalMoves.find(
      (m) => m.from === this.selectedFrom && m.to === "off"
    );
    if (matchingMove) {
      this.executeMove(matchingMove);
    }
  }

  private selectPiece(
    from: number | "bar",
    e?: FederatedPointerEvent
  ): void {
    this.deselect();

    if (!this.state) return;
    const player = this.state.currentPlayer;

    // Clear moveable glow once a piece is selected
    this.pieceRenderer.clearMoveableGlow();

    this.selectedFrom = from;
    this.selectedPiece = this.pieceRenderer.getPieceAt(from, player);

    if (this.selectedPiece) {
      this.selectedPieceOrigX = this.selectedPiece.x;
      this.selectedPieceOrigY = this.selectedPiece.y;

      // Visual feedback: scale up slightly
      this.selectedPiece.scale.set(1.15);
      this.selectedPiece.zIndex = 1000;
    }

    // Highlight legal targets
    const movesFromHere = this.legalMoves.filter((m) => m.from === from);
    const targetPoints = movesFromHere
      .filter((m) => typeof m.to === "number")
      .map((m) => m.to as number);
    const hasBearOff = movesFromHere.some((m) => m.to === "off");

    this.boardRenderer.highlightPoints(targetPoints);
    if (hasBearOff) {
      this.boardRenderer.highlightBearOff(player);
    }

    // Setup drag if event provided
    if (e && this.selectedPiece) {
      this.startDrag(e);
    }
  }

  private startDrag(_e: FederatedPointerEvent): void {
    if (!this.selectedPiece) return;
    this.isDragging = true;

    const onMove = (moveEvent: FederatedPointerEvent) => {
      if (!this.isDragging || !this.selectedPiece) return;
      const pos = moveEvent.global;
      this.selectedPiece.x = pos.x;
      this.selectedPiece.y = pos.y;
    };

    const onUp = (upEvent: FederatedPointerEvent) => {
      this.app.stage.off("pointermove", onMove);
      this.app.stage.off("pointerup", onUp);
      this.app.stage.off("pointerupoutside", onUp);

      if (!this.isDragging || !this.selectedPiece) return;
      this.isDragging = false;

      // Check if dropped on a valid target
      const dropX = upEvent.global.x;
      const dropY = upEvent.global.y;
      const move = this.findTargetAtPosition(dropX, dropY);

      if (move) {
        this.executeMove(move);
      } else {
        // Snap back
        if (this.selectedPiece) {
          this.selectedPiece.x = this.selectedPieceOrigX;
          this.selectedPiece.y = this.selectedPieceOrigY;
          this.selectedPiece.scale.set(1.15);
        }
      }
    };

    this.app.stage.on("pointermove", onMove);
    this.app.stage.on("pointerup", onUp);
    this.app.stage.on("pointerupoutside", onUp);
  }

  private findTargetAtPosition(x: number, y: number): Move | null {
    if (this.selectedFrom === null) return null;

    const movesFromHere = this.legalMoves.filter(
      (m) => m.from === this.selectedFrom
    );
    const pw = this.boardRenderer.getPointWidth();
    const snapDist = pw * 1.2;

    // Check point targets
    for (const move of movesFromHere) {
      if (typeof move.to === "number") {
        const pos = this.boardRenderer.getPointPosition(move.to);
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist < snapDist) {
          return move;
        }
      }
    }

    // Check bear-off target
    const bearOffMove = movesFromHere.find((m) => m.to === "off");
    if (bearOffMove && this.state) {
      const bearPos = this.boardRenderer.getBearOffPosition(
        this.state.currentPlayer
      );
      const dist = Math.hypot(x - bearPos.x, y - bearPos.y);
      if (dist < snapDist * 1.5) {
        return bearOffMove;
      }
    }

    return null;
  }

  private executeMove(move: Move): void {
    // Remember the source for multi-move (same position doubles)
    const from = move.from;
    this.deselect();
    this.pieceRenderer.clearMoveableGlow();
    // Set auto-select hint for the next enable() call
    this.pendingAutoSelectFrom = from;
    if (this.onMoveSelected) {
      this.onMoveSelected(move);
    }
  }

  private deselect(): void {
    if (this.selectedPiece) {
      this.selectedPiece.scale.set(1);
      this.selectedPiece.zIndex = 0;
      if (this.isDragging) {
        this.selectedPiece.x = this.selectedPieceOrigX;
        this.selectedPiece.y = this.selectedPieceOrigY;
      }
    }
    this.selectedFrom = null;
    this.selectedPiece = null;
    this.isDragging = false;
    this.boardRenderer.clearHighlights();
  }

  /**
   * Show glow effects on all pieces that have legal moves.
   */
  private showMoveableGlow(): void {
    if (!this.state) return;

    const player = this.state.currentPlayer;
    const moveableFroms = new Set<number | "bar">();

    for (const move of this.legalMoves) {
      moveableFroms.add(move.from);
    }

    if (moveableFroms.size > 0) {
      this.pieceRenderer.showMoveableGlow(moveableFroms, player);
    }
  }

  /**
   * Deselect the current piece (Escape key).
   */
  deselectCurrent(): void {
    if (!this.enabled) return;
    this.deselect();
    this.showMoveableGlow();
  }

  /**
   * Cycle to the next moveable piece (Tab key).
   * If nothing is selected, selects the first moveable piece.
   * If a piece is selected, selects the next one.
   */
  selectNextMoveable(): void {
    if (!this.enabled || !this.state) return;

    const player = this.state.currentPlayer;
    // Collect all unique source points that have legal moves, sorted
    const moveableFroms: (number | "bar")[] = [];
    const seen = new Set<number | string>();
    for (const move of this.legalMoves) {
      const key = String(move.from);
      if (!seen.has(key)) {
        seen.add(key);
        moveableFroms.push(move.from);
      }
    }

    if (moveableFroms.length === 0) return;

    // Sort: "bar" first, then numeric ascending
    moveableFroms.sort((a, b) => {
      if (a === "bar") return -1;
      if (b === "bar") return 1;
      return (a as number) - (b as number);
    });

    // Find current index
    let currentIdx = -1;
    if (this.selectedFrom !== null) {
      currentIdx = moveableFroms.indexOf(this.selectedFrom);
    }

    // Move to next
    const nextIdx = (currentIdx + 1) % moveableFroms.length;
    const nextFrom = moveableFroms[nextIdx];

    this.selectPiece(nextFrom);
  }

  /**
   * Cycle through available target destinations for the selected piece (Arrow keys).
   * Returns the currently highlighted target index for visual feedback.
   */
  private highlightedTargetIdx = -1;

  cycleTarget(direction: 1 | -1): void {
    if (!this.enabled || this.selectedFrom === null) return;

    const movesFromHere = this.legalMoves.filter((m) => m.from === this.selectedFrom);
    if (movesFromHere.length === 0) return;

    this.highlightedTargetIdx += direction;
    if (this.highlightedTargetIdx >= movesFromHere.length) this.highlightedTargetIdx = 0;
    if (this.highlightedTargetIdx < 0) this.highlightedTargetIdx = movesFromHere.length - 1;
  }

  /**
   * Confirm the currently selected piece's move. If a target is highlighted via
   * arrow keys, use that. Otherwise pick the first available target.
   */
  confirmMove(): void {
    if (!this.enabled || this.selectedFrom === null) return;

    const movesFromHere = this.legalMoves.filter((m) => m.from === this.selectedFrom);
    if (movesFromHere.length === 0) return;

    // If only one target, confirm immediately
    if (movesFromHere.length === 1) {
      this.highlightedTargetIdx = -1;
      this.executeMove(movesFromHere[0]);
      return;
    }

    // Multiple targets: require explicit arrow key selection
    if (this.highlightedTargetIdx < 0 || this.highlightedTargetIdx >= movesFromHere.length) return;

    const idx = this.highlightedTargetIdx;
    this.highlightedTargetIdx = -1;
    this.executeMove(movesFromHere[idx]);
  }

  /**
   * Check if a piece is currently selected.
   */
  hasSelection(): boolean {
    return this.selectedFrom !== null;
  }

  /**
   * Check if the user has explicitly cycled to a target with arrow keys.
   */
  hasTargetHighlighted(): boolean {
    return this.selectedFrom !== null && this.highlightedTargetIdx >= 0;
  }

  destroy(): void {
    this.disable();
    this.hitAreaContainer.destroy({ children: true });
    this.pointHitAreas.clear();
  }
}

import { Application } from "pixi.js";
import { Player, type GameState, type Move } from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";
import { PieceRenderer, type PieceSet } from "./PieceRenderer";
import { DiceRenderer } from "./DiceRenderer";
import { InputHandler } from "./InputHandler";
import { MoveLineRenderer } from "./MoveLineRenderer";
import { AmbienceLayer } from "./AmbienceLayer";
import { SoundManager } from "@/audio/SoundManager";

/**
 * Shared base for both single-player and online game controllers.
 * Owns renderer setup, sound, input delegation, and common helpers.
 */
export abstract class BaseGameController {
  protected app: Application;
  protected boardRenderer!: BoardRenderer;
  protected pieceRenderer!: PieceRenderer;
  protected diceRenderer!: DiceRenderer;
  protected moveLineRenderer!: MoveLineRenderer;
  protected ambienceLayer!: AmbienceLayer;
  protected inputHandler!: InputHandler;
  protected sound: SoundManager;

  protected state!: GameState;
  protected destroyed = false;
  protected currentDiceValues: number[] = [];

  // Minimum time (ms) dice should stay visible after showRoll
  protected diceShownAt = 0;

  // UI callbacks (subclasses may add more)
  onStateChange: ((state: GameState) => void) | null = null;
  onMessage: ((msg: string) => void) | null = null;
  onWaitingForRoll: ((waiting: boolean) => void) | null = null;

  constructor(app: Application) {
    this.app = app;
    this.sound = SoundManager.getInstance();
  }

  protected initRenderers(pieceSet?: PieceSet): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.boardRenderer = new BoardRenderer(this.app, w, h);
    this.ambienceLayer = new AmbienceLayer(this.app, w, h);
    this.pieceRenderer = new PieceRenderer(this.app, this.boardRenderer, pieceSet);
    this.diceRenderer = new DiceRenderer(this.app, this.boardRenderer);
    this.moveLineRenderer = new MoveLineRenderer(this.app, this.boardRenderer);
    this.inputHandler = new InputHandler(
      this.app,
      this.boardRenderer,
      this.pieceRenderer,
      this.moveLineRenderer
    );
  }

  // ── Keyboard Navigation Delegation ─────────────────────────────────

  deselectPiece(): void {
    this.inputHandler?.deselectCurrent();
  }

  selectNextPiece(): void {
    this.inputHandler?.selectNextMoveable();
  }

  selectPrevPiece(): void {
    this.inputHandler?.selectPrevMoveable();
  }

  navigatePieces(direction: "up" | "down" | "left" | "right"): void {
    this.inputHandler?.navigatePieces(direction);
  }

  cycleTarget(direction: 1 | -1): void {
    this.inputHandler?.cycleTarget(direction);
  }

  selectMoveByNumber(num: number): void {
    this.inputHandler?.selectMoveByNumber(num);
  }

  confirmMove(): void {
    this.inputHandler?.confirmMove();
  }

  hasSelection(): boolean {
    return this.inputHandler?.hasSelection() ?? false;
  }

  hasTargetHighlighted(): boolean {
    return this.inputHandler?.hasTargetHighlighted() ?? false;
  }

  // ── Abstract ───────────────────────────────────────────────────────

  abstract rollForHuman(): void;

  // ── Getters ────────────────────────────────────────────────────────

  getState(): GameState {
    return this.state;
  }

  // ── Shared Helpers ─────────────────────────────────────────────────

  protected playMoveSFX(move: Move): void {
    if (move.to === "off") {
      this.sound.playSFX("bear-off");
      return;
    }
    if (typeof move.to === "number") {
      const target = this.state.points[move.to];
      const opp =
        this.state.currentPlayer === Player.Gold ? Player.Red : Player.Gold;
      if (target && target.player === opp && target.count === 1) {
        this.sound.playSFX("piece-hit");
        return;
      }
    }
    this.sound.playSFX("piece-move");
  }

  protected spawnLandingDust(move: Move, player: Player): void {
    if (!this.ambienceLayer) return;
    let pos: { x: number; y: number } | null = null;
    if (move.to === "off") {
      pos = this.boardRenderer.getBearOffPosition(player);
    } else if (typeof move.to === "number") {
      pos = this.boardRenderer.getPiecePosition(move.to, 0);
    }
    if (pos) {
      this.ambienceLayer.spawnDustBurst(pos.x, pos.y);
    }
  }

  protected emitStateChange(): void {
    this.sound.updateMood(this.state);
    this.onStateChange?.(this.state);
  }

  protected storeDiceValues(dice: { values: [number, number] }): void {
    this.currentDiceValues =
      dice.values[0] === dice.values[1]
        ? [dice.values[0], dice.values[0], dice.values[0], dice.values[0]]
        : [dice.values[0], dice.values[1]];
  }

  destroy(): void {
    this.destroyed = true;
    this.sound.stopMusic();
    this.inputHandler?.destroy();
    this.moveLineRenderer?.destroy();
    this.diceRenderer?.destroy();
    this.pieceRenderer?.destroy();
    this.ambienceLayer?.destroy();
    this.boardRenderer?.destroy();
  }
}

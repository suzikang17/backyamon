import { Application } from "pixi.js";
import {
  Player,
  type GameState,
  type Move,
  type WinType,
  createInitialState,
  rollDice,
  getLegalMoves,
  applyMove,
  endTurn,
  canMove,
  canOfferDouble,
  offerDouble,
  acceptDouble,
  declineDouble,
  BeachBum,
  Selector,
  KingTubby,
  type AIPlayer,
} from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";
import { PieceRenderer } from "./PieceRenderer";
import { DiceRenderer } from "./DiceRenderer";
import { InputHandler } from "./InputHandler";
import { SoundManager } from "@/audio/SoundManager";

type Difficulty = "easy" | "medium" | "hard";

function createAI(difficulty: Difficulty): AIPlayer {
  switch (difficulty) {
    case "easy":
      return new BeachBum();
    case "medium":
      return new Selector();
    case "hard":
      return new KingTubby();
  }
}

export class GameController {
  private app: Application;
  private difficulty: Difficulty;
  private boardRenderer!: BoardRenderer;
  private pieceRenderer!: PieceRenderer;
  private diceRenderer!: DiceRenderer;
  private inputHandler!: InputHandler;
  private ai: AIPlayer;
  private state!: GameState;
  private destroyed = false;
  private sound: SoundManager;

  // Track dice values for display
  private currentDiceValues: number[] = [];

  // Callbacks for UI updates
  onStateChange: ((state: GameState) => void) | null = null;
  onGameOver: ((winner: Player, winType: WinType) => void) | null = null;
  onMessage: ((msg: string) => void) | null = null;
  onWaitingForRoll: ((waiting: boolean) => void) | null = null;

  constructor(app: Application, difficulty: Difficulty) {
    this.app = app;
    this.difficulty = difficulty;
    this.ai = createAI(difficulty);
    this.sound = SoundManager.getInstance();
  }

  get aiName(): string {
    return this.ai.name;
  }

  /**
   * Start a new game.
   */
  startGame(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.boardRenderer = new BoardRenderer(this.app, w, h);
    this.pieceRenderer = new PieceRenderer(this.app, this.boardRenderer);
    this.diceRenderer = new DiceRenderer(this.app, this.boardRenderer);
    this.inputHandler = new InputHandler(
      this.app,
      this.boardRenderer,
      this.pieceRenderer
    );

    this.state = createInitialState();

    // Render initial board
    this.pieceRenderer.render(this.state);
    this.emitStateChange();

    // Gold (human) always goes first
    this.startHumanTurn();
  }

  /**
   * Roll dice for the human player (called from UI).
   */
  rollForHuman(): void {
    if (this.destroyed) return;
    if (this.state.phase !== "ROLLING") return;
    if (this.state.currentPlayer !== Player.Gold) return;

    this.sound.resumeContext();
    this.doHumanRoll();
  }

  /**
   * Offer a double (called from HUD).
   */
  offerDouble(): void {
    if (this.destroyed) return;
    if (!canOfferDouble(this.state)) return;
    if (this.state.currentPlayer !== Player.Gold) return;

    this.sound.resumeContext();
    this.sound.playSFX("double-offered");

    this.onWaitingForRoll?.(false);
    this.state = offerDouble(this.state);
    this.emitStateChange();

    // AI always accepts for now (simple AI behavior)
    this.onMessage?.(`${this.ai.name} considers the double...`);
    this.delay(1200).then(() => {
      if (this.destroyed) return;

      // Simple AI: accept if cube value <= 4, otherwise 50/50
      const shouldAccept =
        this.state.doublingCube.value <= 2 || Math.random() > 0.4;

      if (shouldAccept) {
        this.state = acceptDouble(this.state);
        this.emitStateChange();
        this.onMessage?.(`${this.ai.name} accepts the double!`);
        this.delay(800).then(() => {
          if (this.destroyed) return;
          // Continue with the human's rolling phase
          this.startHumanTurn();
        });
      } else {
        this.state = declineDouble(this.state);
        this.emitStateChange();
        this.onMessage?.(`${this.ai.name} declines! You win!`);
        this.sound.playSFX("victory");
        this.onGameOver?.(Player.Gold, "ya_mon");
      }
    });
  }

  private async startHumanTurn(): Promise<void> {
    if (this.destroyed) return;

    this.sound.playSFX("turn-start");

    // Signal that we're waiting for a roll
    this.onWaitingForRoll?.(true);
    this.onMessage?.("Click to roll the dice!");
  }

  private async doHumanRoll(): Promise<void> {
    if (this.destroyed) return;

    this.onWaitingForRoll?.(false);

    // Roll dice
    this.sound.playSFX("dice-roll");
    const dice = rollDice();
    this.state = { ...this.state, dice, phase: "MOVING" };
    this.currentDiceValues = dice.values[0] === dice.values[1]
      ? [dice.values[0], dice.values[0], dice.values[0], dice.values[0]]
      : [dice.values[0], dice.values[1]];
    this.emitStateChange();

    // Show dice animation
    await this.diceRenderer.showRoll(dice);
    if (this.destroyed) return;

    // Check legal moves
    const legalMoves = getLegalMoves(this.state);

    if (legalMoves.length === 0) {
      this.onMessage?.("No legal moves! Turn passes...");
      await this.delay(1200);
      if (this.destroyed) return;
      this.diceRenderer.hide();
      this.endCurrentTurn();
      return;
    }

    this.onMessage?.("Select a piece to move");
    this.enableHumanInput();
  }

  private enableHumanInput(): void {
    if (this.destroyed) return;

    const legalMoves = getLegalMoves(this.state);

    if (legalMoves.length === 0) {
      // No more moves available, end turn
      this.onMessage?.("");
      this.diceRenderer.hide();
      this.endCurrentTurn();
      return;
    }

    // Check if there are remaining dice
    if (!this.state.dice || this.state.dice.remaining.length === 0) {
      this.onMessage?.("");
      this.diceRenderer.hide();
      this.endCurrentTurn();
      return;
    }

    // Update dice display
    this.diceRenderer.updateUsedDice(
      this.currentDiceValues,
      this.state.dice.remaining
    );

    this.inputHandler.onMoveSelected = async (move: Move) => {
      if (this.destroyed) return;
      this.inputHandler.disable();

      // Detect move type for audio before applying
      this.playMoveSFX(move);

      // Apply the move
      this.state = applyMove(this.state, move);
      this.emitStateChange();

      // Animate the move
      await this.pieceRenderer.animateMove(move, Player.Gold);
      if (this.destroyed) return;

      // Re-render pieces to show correct state
      this.pieceRenderer.render(this.state);

      // Check if there are more moves to make
      if (
        this.state.dice &&
        this.state.dice.remaining.length > 0 &&
        canMove(this.state)
      ) {
        this.enableHumanInput();
      } else {
        this.onMessage?.("");
        this.diceRenderer.hide();
        this.endCurrentTurn();
      }
    };

    this.inputHandler.enable(this.state, legalMoves);
  }

  private async startAITurn(): Promise<void> {
    if (this.destroyed) return;

    this.onMessage?.(`${this.ai.name} is thinking...`);

    // Brief pause before AI acts
    await this.delay(500);
    if (this.destroyed) return;

    // Roll dice
    this.sound.playSFX("dice-roll");
    const dice = rollDice();
    this.state = { ...this.state, dice, phase: "MOVING" };
    this.currentDiceValues = dice.values[0] === dice.values[1]
      ? [dice.values[0], dice.values[0], dice.values[0], dice.values[0]]
      : [dice.values[0], dice.values[1]];
    this.emitStateChange();

    // Show dice animation
    await this.diceRenderer.showRoll(dice);
    if (this.destroyed) return;

    // AI selects moves
    const moves = this.ai.selectMoves(this.state);

    if (moves.length === 0) {
      this.onMessage?.(`${this.ai.name}: No moves!`);
      await this.delay(800);
      if (this.destroyed) return;
      this.diceRenderer.hide();
      this.endCurrentTurn();
      return;
    }

    // Animate each AI move one by one
    for (let i = 0; i < moves.length; i++) {
      if (this.destroyed) return;

      const move = moves[i];

      // Detect move type for audio before applying
      this.playMoveSFX(move);

      this.state = applyMove(this.state, move);
      this.emitStateChange();

      // Update dice display
      if (this.state.dice) {
        this.diceRenderer.updateUsedDice(
          this.currentDiceValues,
          this.state.dice.remaining
        );
      }

      // Animate
      await this.pieceRenderer.animateMove(move, Player.Red);
      if (this.destroyed) return;

      this.pieceRenderer.render(this.state);

      // Brief delay between moves
      if (i < moves.length - 1) {
        await this.delay(400);
      }
    }

    if (this.destroyed) return;

    this.onMessage?.("");
    this.diceRenderer.hide();
    this.endCurrentTurn();
  }

  private endCurrentTurn(): void {
    if (this.destroyed) return;

    // End turn (checks winner and switches player)
    this.state = endTurn(this.state);
    this.emitStateChange();

    // Check for game over
    if (this.state.phase === "GAME_OVER" && this.state.winner) {
      const winType = this.state.winType ?? "ya_mon";
      if (this.state.winner === Player.Gold) {
        this.sound.playSFX("victory");
      } else {
        this.sound.playSFX("defeat");
      }
      this.onMessage?.(
        this.state.winner === Player.Gold
          ? "Ya Mon! You win!"
          : `${this.ai.name} wins!`
      );
      this.onGameOver?.(this.state.winner, winType);
      return;
    }

    // Next turn
    if (this.state.currentPlayer === Player.Gold) {
      this.startHumanTurn();
    } else {
      this.startAITurn();
    }
  }

  /**
   * Play the appropriate SFX for a move, inspecting the current state
   * before the move is applied.
   */
  private playMoveSFX(move: Move): void {
    if (move.to === "off") {
      this.sound.playSFX("bear-off");
      return;
    }

    // Check for a hit (opponent blot on target)
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

  private emitStateChange(): void {
    this.onStateChange?.(this.state);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.destroyed = true;
    this.inputHandler?.destroy();
    this.diceRenderer?.destroy();
    this.pieceRenderer?.destroy();
    this.boardRenderer?.destroy();
  }
}

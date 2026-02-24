import { Application } from "pixi.js";
import {
  Player,
  type GameState,
  type Move,
  type WinType,
  type Dice,
  getLegalMoves,
  canMove,
} from "@backyamon/engine";
import { BoardRenderer } from "./BoardRenderer";
import { PieceRenderer } from "./PieceRenderer";
import { DiceRenderer } from "./DiceRenderer";
import { InputHandler } from "./InputHandler";
import { MoveLineRenderer } from "./MoveLineRenderer";
import { SocketClient } from "@/multiplayer/SocketClient";
import { SoundManager } from "@/audio/SoundManager";

export class OnlineGameController {
  private app: Application;
  private boardRenderer!: BoardRenderer;
  private pieceRenderer!: PieceRenderer;
  private moveLineRenderer!: MoveLineRenderer;
  private diceRenderer!: DiceRenderer;
  private inputHandler!: InputHandler;
  private socketClient: SocketClient;
  private sound: SoundManager;

  private state!: GameState;
  private localPlayer: Player = Player.Gold;
  private roomId: string;
  private destroyed = false;

  // Track dice values for display
  private currentDiceValues: number[] = [];

  // Callbacks for UI updates
  onStateChange: ((state: GameState) => void) | null = null;
  onGameOver:
    | ((winner: Player, winType: WinType, pointsWon: number) => void)
    | null = null;
  onMessage: ((msg: string) => void) | null = null;
  onWaitingForRoll: ((waiting: boolean) => void) | null = null;
  onOpponentDisconnected: (() => void) | null = null;
  onOpponentReconnected: (() => void) | null = null;
  onError: ((message: string) => void) | null = null;

  constructor(app: Application, socketClient: SocketClient, roomId: string) {
    this.app = app;
    this.socketClient = socketClient;
    this.roomId = roomId;
    this.sound = SoundManager.getInstance();
  }

  /**
   * Initialize renderers and bind server event listeners.
   * Call this after receiving `room-joined` with the initial state and player role.
   */
  startGame(initialState: GameState, localPlayer: Player): void {
    if (this.destroyed) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.boardRenderer = new BoardRenderer(this.app, w, h);
    this.pieceRenderer = new PieceRenderer(this.app, this.boardRenderer);
    this.diceRenderer = new DiceRenderer(this.app, this.boardRenderer);
    this.moveLineRenderer = new MoveLineRenderer(this.app, this.boardRenderer);
    this.inputHandler = new InputHandler(
      this.app,
      this.boardRenderer,
      this.pieceRenderer,
      this.moveLineRenderer
    );

    this.state = initialState;
    this.localPlayer = localPlayer;

    this.sound.startMusic();
    this.sound.updateMood(this.state);

    // Render initial board
    this.pieceRenderer.render(this.state);
    this.emitStateChange();

    // Bind server events
    this.bindServerEvents();

    // If it's already our turn (e.g. Gold starts), prompt
    if (this.state.currentPlayer === this.localPlayer && this.state.phase === "ROLLING") {
      this.startLocalTurn();
    } else if (this.state.phase === "ROLLING") {
      this.onMessage?.("Waiting for opponent to roll...");
    }
  }

  /**
   * Roll dice for the local player (called from UI click).
   */
  rollForHuman(): void {
    if (this.destroyed) return;
    if (this.state.phase !== "ROLLING") return;
    if (this.state.currentPlayer !== this.localPlayer) return;

    this.onWaitingForRoll?.(false);
    this.onMessage?.("Rolling...");
    this.socketClient.rollDice();
  }

  // ── Private Helpers ─────────────────────────────────────────────────

  private startLocalTurn(): void {
    if (this.destroyed) return;
    this.sound.playSFX("turn-start");
    this.onWaitingForRoll?.(true);
    this.onMessage?.("Your turn - click to roll!");
  }

  private enableLocalInput(): void {
    if (this.destroyed) return;

    const legalMoves = getLegalMoves(this.state);

    if (legalMoves.length === 0) {
      // No moves: server will auto-end turn via turn-ended event
      this.onMessage?.("No legal moves...");
      return;
    }

    // Update dice display
    if (this.state.dice && this.state.dice.remaining.length > 0) {
      this.diceRenderer.updateUsedDice(
        this.currentDiceValues,
        this.state.dice.remaining
      );
    }

    this.onMessage?.("Select a piece to move");

    this.inputHandler.onMoveSelected = (move: Move) => {
      if (this.destroyed) return;
      this.inputHandler.disable();
      this.onMessage?.("...");

      // Send move to server; wait for move-made event to animate
      this.socketClient.makeMove(move);
    };

    this.inputHandler.enable(this.state, legalMoves);
  }

  // ── Server Event Bindings ────────────────────────────────────────────

  private boundHandlers: Map<string, (...args: unknown[]) => void> = new Map();

  private bindServerEvents(): void {
    const bind = (event: string, handler: (...args: unknown[]) => void) => {
      this.boundHandlers.set(event, handler);
      this.socketClient.on(event, handler);
    };

    bind("dice-rolled", (data: unknown) => {
      this.handleDiceRolled(data as { dice: Dice });
    });

    bind("move-made", (data: unknown) => {
      this.handleMoveMade(data as { move: Move; state: GameState });
    });

    bind("turn-ended", (data: unknown) => {
      this.handleTurnEnded(data as { state: GameState; currentPlayer: Player });
    });

    bind("game-over", (data: unknown) => {
      this.handleGameOver(
        data as { winner: Player; winType: WinType; pointsWon: number }
      );
    });

    bind("double-offered", (data: unknown) => {
      this.handleDoubleOffered(data as { currentCubeValue: number });
    });

    bind("double-response", (data: unknown) => {
      this.handleDoubleResponse(data as { accepted: boolean; state: GameState });
    });

    bind("opponent-disconnected", () => {
      this.onMessage?.("Opponent disconnected. Waiting for reconnect...");
      this.onOpponentDisconnected?.();
    });

    bind("opponent-reconnected", () => {
      this.onMessage?.("Opponent reconnected!");
      this.onOpponentReconnected?.();
      // Clear the message after a short delay
      setTimeout(() => {
        if (this.destroyed) return;
        if (this.state.currentPlayer === this.localPlayer) {
          if (this.state.phase === "ROLLING") {
            this.startLocalTurn();
          } else if (this.state.phase === "MOVING") {
            this.enableLocalInput();
          }
        } else {
          this.onMessage?.("Opponent's turn...");
        }
      }, 1500);
    });

    bind("error", (data: unknown) => {
      const msg = (data as { message: string }).message;
      this.onError?.(msg);
    });
  }

  private unbindServerEvents(): void {
    for (const [event, handler] of this.boundHandlers) {
      this.socketClient.off(event, handler);
    }
    this.boundHandlers.clear();
  }

  // ── Server Event Handlers ────────────────────────────────────────────

  private async handleDiceRolled(data: { dice: Dice }): Promise<void> {
    if (this.destroyed) return;
    this.sound.playSFX("dice-roll");

    const { dice } = data;
    this.state = { ...this.state, dice, phase: "MOVING" };
    this.currentDiceValues =
      dice.values[0] === dice.values[1]
        ? [dice.values[0], dice.values[0], dice.values[0], dice.values[0]]
        : [dice.values[0], dice.values[1]];
    this.emitStateChange();

    // Animate dice
    await this.diceRenderer.showRoll(dice);
    if (this.destroyed) return;

    // If it's local player's turn, enable input
    if (this.state.currentPlayer === this.localPlayer) {
      const legalMoves = getLegalMoves(this.state);
      if (legalMoves.length === 0) {
        this.onMessage?.("No legal moves! Turn passes...");
        // Server will send turn-ended
      } else {
        this.enableLocalInput();
      }
    } else {
      this.onMessage?.("Opponent is moving...");
    }
  }

  private async handleMoveMade(data: {
    move: Move;
    state: GameState;
  }): Promise<void> {
    if (this.destroyed) return;

    const { move, state } = data;
    const movingPlayer = this.state.currentPlayer;

    // Play move SFX based on pre-move state
    if (move.to === "off") {
      this.sound.playSFX("bear-off");
    } else if (typeof move.to === "number") {
      const target = this.state.points[move.to];
      const opp = this.state.currentPlayer === Player.Gold ? Player.Red : Player.Gold;
      if (target && target.player === opp && target.count === 1) {
        this.sound.playSFX("piece-hit");
      } else {
        this.sound.playSFX("piece-move");
      }
    } else {
      this.sound.playSFX("piece-move");
    }

    // Update state from server
    this.state = state;
    this.emitStateChange();

    // Animate the move
    await this.pieceRenderer.animateMove(move, movingPlayer);
    if (this.destroyed) return;

    // Re-render to show correct state
    this.pieceRenderer.render(this.state);

    // Update dice display
    if (this.state.dice && this.state.dice.remaining.length > 0) {
      this.diceRenderer.updateUsedDice(
        this.currentDiceValues,
        this.state.dice.remaining
      );
    }

    // If still local player's turn with moves remaining, re-enable input
    if (
      this.state.currentPlayer === this.localPlayer &&
      this.state.phase === "MOVING" &&
      this.state.dice &&
      this.state.dice.remaining.length > 0 &&
      canMove(this.state)
    ) {
      this.enableLocalInput();
    } else if (
      this.state.currentPlayer === this.localPlayer &&
      this.state.phase === "MOVING"
    ) {
      // No more moves; server will send turn-ended
      this.onMessage?.("No more moves...");
    }
  }

  private handleTurnEnded(data: {
    state: GameState;
    currentPlayer: Player;
  }): void {
    if (this.destroyed) return;

    this.state = data.state;
    this.diceRenderer.hide();
    this.inputHandler.disable();
    this.emitStateChange();
    this.pieceRenderer.render(this.state);

    if (this.state.phase === "GAME_OVER") {
      // game-over event will handle this
      return;
    }

    if (data.currentPlayer === this.localPlayer) {
      this.startLocalTurn();
    } else {
      this.onMessage?.("Opponent's turn...");
    }
  }

  private handleGameOver(data: {
    winner: Player;
    winType: WinType;
    pointsWon: number;
  }): void {
    if (this.destroyed) return;

    this.diceRenderer.hide();
    this.inputHandler.disable();

    if (data.winner === this.localPlayer) {
      this.sound.playSFX("victory");
    } else {
      this.sound.playSFX("defeat");
    }

    const isWinner = data.winner === this.localPlayer;
    this.onMessage?.(isWinner ? "Ya Mon! You win!" : "You lose!");
    this.onGameOver?.(data.winner, data.winType, data.pointsWon);
  }

  private handleDoubleOffered(data: { currentCubeValue: number }): void {
    if (this.destroyed) return;
    this.sound.playSFX("double-offered");

    // Only the non-offering player (opponent of current player) sees this
    this.onMessage?.(
      `Opponent doubles! Cube to ${data.currentCubeValue}. Accept or decline?`
    );
    // The UI layer will handle showing accept/decline buttons
  }

  private handleDoubleResponse(data: {
    accepted: boolean;
    state: GameState;
  }): void {
    if (this.destroyed) return;

    this.state = data.state;
    this.emitStateChange();
    this.pieceRenderer.render(this.state);

    if (data.accepted) {
      this.onMessage?.("Double accepted!");
      // Game continues - if it's our turn now, start rolling phase
      setTimeout(() => {
        if (this.destroyed) return;
        if (this.state.currentPlayer === this.localPlayer && this.state.phase === "ROLLING") {
          this.startLocalTurn();
        } else if (this.state.phase !== "GAME_OVER") {
          this.onMessage?.("Opponent's turn...");
        }
      }, 1000);
    } else {
      // Decline: game-over event will handle it
      this.onMessage?.("Double declined!");
    }
  }

  // ── Doubling Actions ─────────────────────────────────────────────────

  offerDouble(): void {
    if (this.destroyed) return;
    this.socketClient.offerDouble();
  }

  respondToDouble(accept: boolean): void {
    if (this.destroyed) return;
    this.socketClient.respondToDouble(accept);
  }

  // ── Getters ──────────────────────────────────────────────────────────

  getLocalPlayer(): Player {
    return this.localPlayer;
  }

  getState(): GameState {
    return this.state;
  }

  // ── Utilities ────────────────────────────────────────────────────────

  private emitStateChange(): void {
    this.sound.updateMood(this.state);
    this.onStateChange?.(this.state);
  }

  destroy(): void {
    this.destroyed = true;
    this.sound.stopMusic();
    this.unbindServerEvents();
    this.inputHandler?.destroy();
    this.diceRenderer?.destroy();
    this.pieceRenderer?.destroy();
    this.boardRenderer?.destroy();
  }
}

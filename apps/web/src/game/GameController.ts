import { Application } from "pixi.js";
import {
  Player,
  type GameState,
  type Move,
  type WinType,
  createInitialState,
  rollDice,
  rollSingleDie,
  getLegalMoves,
  getConstrainedMoves,
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
import type { PieceSet } from "./PieceRenderer";
import type { MusicStyle } from "@/audio/MusicEngine";
import { BaseGameController } from "./BaseGameController";
import {
  greetingMessage,
  turnStartMessage,
  aiThinkingMessage,
  aiNoMovesMessage,
  victoryMessage,
  defeatMessage,
  noMovesMessage,
  doubleConsiderMessage,
  doubleAcceptedMessage,
  doubleDeclinedMessage,
} from "./patois";

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_MUSIC: Record<Difficulty, MusicStyle> = {
  easy: "roots",
  medium: "dub",
  hard: "dancehall",
};

const PIECE_SETS: Record<Difficulty, PieceSet> = {
  easy: "coconut",
  medium: "vinyl",
  hard: "lion",
};

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

export class GameController extends BaseGameController {
  private difficulty: Difficulty;
  private ai: AIPlayer;

  // Undo state: stack of previous states within the current turn
  private turnStateHistory: GameState[] = [];

  // Callbacks specific to single-player
  onGameOver: ((winner: Player, winType: WinType) => void) | null = null;
  onCanUndo: ((canUndo: boolean) => void) | null = null;

  constructor(app: Application, difficulty: Difficulty) {
    super(app);
    this.difficulty = difficulty;
    this.ai = createAI(difficulty);
  }

  get aiName(): string {
    return this.ai.name;
  }

  /**
   * Start a new game.
   */
  startGame(): void {
    this.initRenderers(PIECE_SETS[this.difficulty]);

    this.state = createInitialState();
    this.sound.setMusicStyle(DIFFICULTY_MUSIC[this.difficulty]);
    this.sound.startMusic();
    this.sound.updateMood(this.state);

    // Spoken greeting
    const greeting = greetingMessage();
    this.sound.speak(greeting);

    // Render initial board
    this.pieceRenderer.render(this.state);
    this.emitStateChange();

    // Start with opening roll ceremony
    this.onMessage?.("Opening roll - click to roll!");
    this.onWaitingForRoll?.(true);
  }

  /**
   * Roll dice for the human player (called from UI).
   */
  rollForHuman(): void {
    if (this.destroyed) return;

    if (this.state.phase === "OPENING_ROLL") {
      this.sound.resumeContext();
      this.performOpeningRoll();
      return;
    }

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
    const considerMsg = doubleConsiderMessage(this.ai.name);
    this.onMessage?.(considerMsg);
    this.sound.speak(considerMsg);
    this.delay(1200).then(() => {
      if (this.destroyed) return;

      // Simple AI: accept if cube value <= 4, otherwise 50/50
      const shouldAccept =
        this.state.doublingCube.value <= 2 || Math.random() > 0.4;

      if (shouldAccept) {
        this.state = acceptDouble(this.state);
        this.emitStateChange();
        const acceptMsg = doubleAcceptedMessage(this.ai.name);
        this.onMessage?.(acceptMsg);
        this.sound.speak(acceptMsg);
        this.delay(800).then(() => {
          if (this.destroyed) return;
          // Continue with the human's rolling phase
          this.startHumanTurn();
        });
      } else {
        this.state = declineDouble(this.state);
        this.emitStateChange();
        const declineMsg = doubleDeclinedMessage(this.ai.name);
        this.onMessage?.(declineMsg);
        this.sound.speak(declineMsg);
        this.sound.playSFX("victory");
        this.onGameOver?.(Player.Gold, "ya_mon");
      }
    });
  }

  /**
   * Undo the last move made during the current turn.
   */
  undoMove(): void {
    if (this.destroyed) return;
    if (this.turnStateHistory.length === 0) return;

    // Disable current input
    this.inputHandler.disable();

    // Pop the previous state
    this.state = this.turnStateHistory.pop()!;
    this.emitStateChange();

    // Re-render pieces
    this.pieceRenderer.render(this.state);

    // Update dice display
    if (this.state.dice) {
      this.diceRenderer.updateUsedDice(
        this.currentDiceValues,
        this.state.dice.remaining
      );
    }

    // Update undo availability
    this.onCanUndo?.(this.turnStateHistory.length > 0);

    // Re-enable input for the restored state
    this.onMessage?.("Select a piece to move");
    // Clear auto-select to avoid re-selecting after undo
    this.inputHandler.setAutoSelectFrom(null);
    this.enableHumanInput();
  }

  private async performOpeningRoll(): Promise<void> {
    if (this.destroyed) return;
    this.onWaitingForRoll?.(false);

    let goldDie: number;
    let redDie: number;

    do {
      goldDie = rollSingleDie();
      redDie = rollSingleDie();

      // Show dice on separate sides: opponent (Red) on left, player (Gold) on right
      this.sound.playSFX("dice-roll");
      await this.diceRenderer.showOpeningRoll(redDie, goldDie);
      if (this.destroyed) return;

      if (goldDie === redDie) {
        this.onMessage?.(`Tied ${goldDie}-${redDie}! Roll again...`);
        this.onWaitingForRoll?.(true);
        // Wait for player to click again to re-roll
        return;
      }
    } while (false);

    // Determine who goes first — use both dice for the first turn
    const firstPlayer = goldDie > redDie ? Player.Gold : Player.Red;
    const dice = rollDice([Math.max(goldDie, redDie), Math.min(goldDie, redDie)]);
    this.state = {
      ...this.state,
      currentPlayer: firstPlayer,
      dice,
      phase: "MOVING",
    };
    this.storeDiceValues(dice);
    this.emitStateChange();

    if (firstPlayer === Player.Gold) {
      this.onMessage?.(`You rolled ${goldDie} vs ${redDie} — you go first!`);
      await this.delay(800);
      if (this.destroyed) return;
      // Show the combined dice in normal position for move selection
      await this.diceRenderer.showRoll(dice);
      if (this.destroyed) return;
      this.enableHumanInput();
    } else {
      this.onMessage?.(`${this.ai.name} rolled ${redDie} vs ${goldDie} — they go first!`);
      await this.delay(800);
      if (this.destroyed) return;
      this.diceRenderer.hide();
      this.startAIFirstTurn();
    }
  }

  private async startAIFirstTurn(): Promise<void> {
    if (this.destroyed) return;

    const thinkMsg = aiThinkingMessage(this.ai.name);
    this.onMessage?.(thinkMsg);
    this.sound.speak(thinkMsg, 1.0);

    await this.delay(500);
    if (this.destroyed) return;

    // Show the opening dice for the AI's turn
    this.sound.playSFX("dice-roll");
    await this.diceRenderer.showRoll(this.state.dice!);
    if (this.destroyed) return;

    // AI selects moves with the opening dice
    const moves = this.ai.selectMoves(this.state);

    if (moves.length === 0) {
      this.onMessage?.(aiNoMovesMessage(this.ai.name));
      await this.delay(800);
      if (this.destroyed) return;
      this.diceRenderer.hide();
      this.endCurrentTurn();
      return;
    }

    // Animate each AI move
    for (let i = 0; i < moves.length; i++) {
      if (this.destroyed) return;
      const move = moves[i];
      this.playMoveSFX(move);
      this.state = applyMove(this.state, move);
      this.emitStateChange();

      if (this.state.dice) {
        this.diceRenderer.updateUsedDice(this.currentDiceValues, this.state.dice.remaining);
      }

      await this.pieceRenderer.animateMove(move, Player.Red);
      if (this.destroyed) return;
      this.spawnLandingDust(move, Player.Red);
      this.moveLineRenderer.showOpponentMove(move, Player.Red);
      this.pieceRenderer.render(this.state);

      if (i < moves.length - 1) {
        await this.delay(400);
      }
    }

    if (this.destroyed) return;
    this.onMessage?.("");
    this.diceRenderer.hide();
    this.endCurrentTurn();
  }

  private async startHumanTurn(): Promise<void> {
    if (this.destroyed) return;

    this.sound.playSFX("turn-start");

    // Signal that we're waiting for a roll
    this.onWaitingForRoll?.(true);
    this.onMessage?.(turnStartMessage());
  }

  private async doHumanRoll(): Promise<void> {
    if (this.destroyed) return;

    this.onWaitingForRoll?.(false);

    // Clear opponent move arcs from previous AI turn
    this.moveLineRenderer.clearOpponentMoves();

    // Reset undo stack at start of turn
    this.turnStateHistory = [];
    this.onCanUndo?.(false);

    // Roll dice
    this.sound.playSFX("dice-roll");
    const dice = rollDice();
    this.state = { ...this.state, dice, phase: "MOVING" };
    this.storeDiceValues(dice);
    this.emitStateChange();

    // Show dice animation
    await this.diceRenderer.showRoll(dice);
    if (this.destroyed) return;

    // Check legal moves (constrained by must-use-higher-die / must-maximize rules)
    const legalMoves = getConstrainedMoves(this.state);

    if (legalMoves.length === 0) {
      this.onMessage?.(noMovesMessage());
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

    const legalMoves = getConstrainedMoves(this.state);

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

      // Push current state onto undo stack before applying move
      this.turnStateHistory.push(this.state);
      this.onCanUndo?.(true);

      // Detect move type for audio before applying
      this.playMoveSFX(move);

      // Apply the move
      this.state = applyMove(this.state, move);
      this.emitStateChange();

      // Animate the move
      await this.pieceRenderer.animateMove(move, Player.Gold);
      if (this.destroyed) return;
      this.spawnLandingDust(move, Player.Gold);

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

    const thinkMsg = aiThinkingMessage(this.ai.name);
    this.onMessage?.(thinkMsg);
    this.sound.speak(thinkMsg, 1.0);

    // Brief pause before AI acts
    await this.delay(500);
    if (this.destroyed) return;

    // Roll dice
    this.sound.playSFX("dice-roll");
    const dice = rollDice();
    this.state = { ...this.state, dice, phase: "MOVING" };
    this.storeDiceValues(dice);
    this.emitStateChange();

    // Show dice animation
    await this.diceRenderer.showRoll(dice);
    if (this.destroyed) return;

    // AI selects moves
    const moves = this.ai.selectMoves(this.state);

    if (moves.length === 0) {
      this.onMessage?.(aiNoMovesMessage(this.ai.name));
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
      this.spawnLandingDust(move, Player.Red);

      // Show arc for this AI move
      this.moveLineRenderer.showOpponentMove(move, Player.Red);

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

    // Clear undo stack - turn is being committed
    this.turnStateHistory = [];
    this.onCanUndo?.(false);

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
      const endMsg = this.state.winner === Player.Gold
        ? victoryMessage()
        : defeatMessage();
      this.onMessage?.(endMsg);
      this.sound.speak(endMsg);
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

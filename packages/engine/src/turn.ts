import type { GameState } from "./types";
import { cloneState } from "./state";
import { getLegalMoves } from "./moves";
import { checkWinner, getWinType } from "./winner";
import { opponent } from "./moves";

/**
 * End the current turn:
 * 1. Check if there's a winner
 * 2. If winner, set GAME_OVER phase with winner info
 * 3. Otherwise, switch current player and reset to ROLLING phase
 */
export function endTurn(state: GameState): GameState {
  const newState = cloneState(state);

  // Check for winner
  const winner = checkWinner(newState);
  if (winner) {
    newState.phase = "GAME_OVER";
    newState.winner = winner;
    newState.winType = getWinType(newState, winner);
    return newState;
  }

  // Switch player and reset phase
  newState.currentPlayer = opponent(newState.currentPlayer);
  newState.phase = "ROLLING";
  newState.dice = null;

  return newState;
}

/**
 * Check if the current player has any legal moves available.
 */
export function canMove(state: GameState): boolean {
  return getLegalMoves(state).length > 0;
}

import type { GameState } from "./types";
import { cloneState } from "./state";
import { opponent } from "./moves";

/**
 * Check if the current player can offer a double.
 * Only allowed:
 * - Before rolling (ROLLING phase)
 * - By cube owner or when cube is centered
 * - Not during Crawford game
 */
export function canOfferDouble(state: GameState): boolean {
  if (state.phase !== "ROLLING") return false;
  if (state.isCrawford) return false;
  const { owner } = state.doublingCube;
  return owner === null || owner === state.currentPlayer;
}

/**
 * Offer a double. Transitions the game to DOUBLING phase,
 * awaiting the opponent's response.
 */
export function offerDouble(state: GameState): GameState {
  const newState = cloneState(state);
  newState.phase = "DOUBLING";
  return newState;
}

/**
 * Accept the double offer.
 * - Doubles the cube value
 * - Transfers cube ownership to the accepting player (opponent of offerer)
 * - Returns to ROLLING phase
 */
export function acceptDouble(state: GameState): GameState {
  const newState = cloneState(state);
  newState.doublingCube.value *= 2;
  newState.doublingCube.owner = opponent(newState.currentPlayer);
  newState.phase = "ROLLING";
  return newState;
}

/**
 * Decline the double offer.
 * - The declining player loses at the current stake (before the proposed double)
 * - The offerer (current player) wins
 */
export function declineDouble(state: GameState): GameState {
  const newState = cloneState(state);
  newState.phase = "GAME_OVER";
  newState.winner = newState.currentPlayer; // The offerer wins
  newState.winType = "ya_mon"; // Decline is equivalent to a normal loss
  return newState;
}

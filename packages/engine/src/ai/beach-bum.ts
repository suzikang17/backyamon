import type { GameState, Move } from "../types";
import type { AIPlayer } from "./types";
import { getAllLegalTurns } from "./turn-generator";

/**
 * Beach Bum - Easy AI
 *
 * Picks a random legal turn from all possible complete turns.
 * No strategic evaluation whatsoever - just vibes.
 */
export class BeachBum implements AIPlayer {
  name = "Beach Bum";
  difficulty = "easy" as const;

  selectMoves(state: GameState): Move[] {
    const turns = getAllLegalTurns(state);
    if (turns.length === 0 || (turns.length === 1 && turns[0].length === 0)) {
      return [];
    }
    // Pick a random turn
    const randomIndex = Math.floor(Math.random() * turns.length);
    return turns[randomIndex];
  }

  shouldDouble(_state: GameState): boolean {
    // Beach Bum randomly doubles ~10% of the time
    return Math.random() < 0.1;
  }

  shouldAcceptDouble(_state: GameState): boolean {
    // Beach Bum always accepts doubles (doesn't understand the risk)
    return true;
  }
}

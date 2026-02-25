import type { GameState, Move } from "./types.js";
import { getAllLegalTurns } from "./ai/turn-generator.js";

/**
 * Get legal moves constrained by backgammon rules:
 * - Must maximize dice usage (use both dice if possible)
 * - If only one die can be used, must use the higher die
 *
 * Returns only first-moves from maximal-length turns. After a human
 * plays one of these moves, call again on the new state to get the
 * next set of constrained moves.
 */
export function getConstrainedMoves(state: GameState): Move[] {
  const allTurns = getAllLegalTurns(state);

  // If no turns or only empty turns, no moves available
  if (allTurns.length === 0 || (allTurns.length === 1 && allTurns[0].length === 0)) {
    return [];
  }

  // Extract unique first moves from the (already filtered) legal turns
  const seen = new Set<string>();
  const moves: Move[] = [];

  for (const turn of allTurns) {
    if (turn.length === 0) continue;
    const first = turn[0];
    const key = `${first.from}:${first.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push(first);
    }
  }

  return moves;
}

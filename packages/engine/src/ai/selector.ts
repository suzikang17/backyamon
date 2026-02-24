import { Player, type GameState, type Move } from "../types.js";
import type { AIPlayer } from "./types.js";
import { getAllLegalTurns } from "./turn-generator.js";
import { applyMove, opponent } from "../moves.js";
import {
  HOME_BOARD_START,
  HOME_BOARD_END,
  POINTS_COUNT,
  MOVE_DIRECTION,
} from "../constants.js";

/**
 * Selector - Medium AI
 *
 * Evaluates all possible complete turns using a heuristic scoring function,
 * then picks the highest-scoring turn.
 *
 * Scoring weights:
 * +10 per made point (2+ own pieces on a point)
 * -15 per blot (single exposed piece)
 * +5 per piece in home board
 * -20 per piece on bar
 * +3 per pip count advantage
 */
export class Selector implements AIPlayer {
  name = "Selector";
  difficulty = "medium" as const;

  selectMoves(state: GameState): Move[] {
    const turns = getAllLegalTurns(state);
    if (turns.length === 0 || (turns.length === 1 && turns[0].length === 0)) {
      return [];
    }

    let bestTurn = turns[0];
    let bestScore = -Infinity;

    for (const turn of turns) {
      // Apply all moves in this turn to get the resulting state
      let resultState = state;
      for (const move of turn) {
        resultState = applyMove(resultState, move);
      }

      const score = evaluateBoard(resultState, state.currentPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestTurn = turn;
      }
    }

    return bestTurn;
  }

  shouldDouble(state: GameState): boolean {
    // Double if we have a significant advantage
    const score = evaluateBoard(state, state.currentPlayer);
    return score > 50;
  }

  shouldAcceptDouble(state: GameState): boolean {
    // Accept if we're not too far behind
    const score = evaluateBoard(state, opponent(state.currentPlayer));
    return score > -80;
  }
}

/**
 * Evaluate the board position from the perspective of the given player.
 * Higher scores are better for the player.
 */
export function evaluateBoard(state: GameState, player: Player): number {
  const opp = opponent(player);
  let score = 0;

  const homeStart = HOME_BOARD_START[player];
  const homeEnd = HOME_BOARD_END[player];
  const minHome = Math.min(homeStart, homeEnd);
  const maxHome = Math.max(homeStart, homeEnd);

  // Evaluate board points
  for (let i = 0; i < POINTS_COUNT; i++) {
    const point = state.points[i];
    if (!point) continue;

    if (point.player === player) {
      // Made point bonus (2+ pieces)
      if (point.count >= 2) {
        score += 10;
      }
      // Blot penalty (single exposed piece)
      if (point.count === 1) {
        score -= 15;
      }
      // Home board bonus
      if (i >= minHome && i <= maxHome) {
        score += 5 * point.count;
      }
    } else if (point.player === opp) {
      // Opponent's made points are bad for us
      if (point.count >= 2) {
        score -= 10;
      }
      if (point.count === 1) {
        score += 15;
      }
      // Opponent pieces in our home board
      if (i >= minHome && i <= maxHome) {
        score -= 5 * point.count;
      }
    }
  }

  // Bar penalty/bonus
  score -= 20 * state.bar[player];
  score += 20 * state.bar[opp];

  // Borne off bonus
  score += 10 * state.borneOff[player];
  score -= 10 * state.borneOff[opp];

  // Pip count advantage
  const myPips = calculatePipCount(state, player);
  const oppPips = calculatePipCount(state, opp);
  score += 3 * (oppPips - myPips);

  return score;
}

/**
 * Calculate the pip count for a player.
 * The pip count is the total number of pips needed to bear off all pieces.
 */
export function calculatePipCount(state: GameState, player: Player): number {
  let pips = 0;
  const direction = MOVE_DIRECTION[player];

  for (let i = 0; i < POINTS_COUNT; i++) {
    const point = state.points[i];
    if (point && point.player === player) {
      // Distance to bearing off
      let distance: number;
      if (player === Player.Gold) {
        distance = POINTS_COUNT - i; // Distance from right edge
      } else {
        distance = i + 1; // Distance from left edge
      }
      pips += distance * point.count;
    }
  }

  // Pieces on bar need to traverse the full board
  if (player === Player.Gold) {
    pips += 25 * state.bar[player]; // Enter at 1-6, then travel to 24
  } else {
    pips += 25 * state.bar[player]; // Enter at 19-24, then travel to 1
  }

  return pips;
}

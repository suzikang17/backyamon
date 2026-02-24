import { Player, type GameState, type WinType } from "./types.js";
import {
  PIECES_PER_PLAYER,
  HOME_BOARD_START,
  HOME_BOARD_END,
} from "./constants.js";

/**
 * Check if either player has won (borne off all 15 pieces).
 */
export function checkWinner(state: GameState): Player | null {
  if (state.borneOff[Player.Gold] === PIECES_PER_PLAYER) return Player.Gold;
  if (state.borneOff[Player.Red] === PIECES_PER_PLAYER) return Player.Red;
  return null;
}

/**
 * Determine the type of win:
 * - ya_mon (1x): opponent has borne off at least 1 piece (normal win)
 * - big_ya_mon (2x): opponent has borne off 0 pieces (gammon)
 * - massive_ya_mon (3x): opponent has 0 borne off AND has pieces on bar
 *   or in winner's home board (backgammon)
 */
export function getWinType(state: GameState, winner: Player): WinType {
  const loser = winner === Player.Gold ? Player.Red : Player.Gold;

  // Has loser borne off any pieces? If so, it's a normal win.
  if (state.borneOff[loser] > 0) return "ya_mon";

  // Check for backgammon: loser has pieces on bar or in winner's home board
  if (state.bar[loser] > 0) return "massive_ya_mon";

  const winnerHomeStart = HOME_BOARD_START[winner];
  const winnerHomeEnd = HOME_BOARD_END[winner];
  const minIdx = Math.min(winnerHomeStart, winnerHomeEnd);
  const maxIdx = Math.max(winnerHomeStart, winnerHomeEnd);

  for (let i = minIdx; i <= maxIdx; i++) {
    const point = state.points[i];
    if (point && point.player === loser) return "massive_ya_mon";
  }

  // Gammon: loser hasn't borne off any pieces but no backgammon condition
  return "big_ya_mon";
}

/**
 * Calculate points won based on win type and doubling cube value.
 */
export function getPointsWon(
  winType: WinType,
  doublingCubeValue: number,
): number {
  const multiplier =
    winType === "ya_mon" ? 1 : winType === "big_ya_mon" ? 2 : 3;
  return multiplier * doublingCubeValue;
}

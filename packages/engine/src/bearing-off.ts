import {
  Player,
  type GameState,
  type Move,
} from "./types.js";
import {
  HOME_BOARD_START,
  HOME_BOARD_END,
  POINTS_COUNT,
} from "./constants.js";

/**
 * Check if a player can bear off pieces.
 * All pieces must be in the home board (or already borne off), and none on the bar.
 */
export function canBearOff(state: GameState, player: Player): boolean {
  // Cannot bear off if any pieces are on the bar
  if (state.bar[player] > 0) return false;

  const homeStart = HOME_BOARD_START[player];
  const homeEnd = HOME_BOARD_END[player];
  const minHome = Math.min(homeStart, homeEnd);
  const maxHome = Math.max(homeStart, homeEnd);

  // Check that no pieces exist outside the home board
  for (let i = 0; i < POINTS_COUNT; i++) {
    if (i >= minHome && i <= maxHome) continue; // In home board, skip
    const point = state.points[i];
    if (point && point.player === player) {
      return false; // Piece outside home board
    }
  }

  return true;
}

/**
 * Get bear-off moves for a player given a single die value.
 *
 * Rules:
 * - Exact die value: can bear off the piece at the exact distance
 * - Higher die: can bear off the FARTHEST piece (most distant from bearing off)
 *   ONLY if no piece is farther back than that piece
 *   (i.e., the piece being borne off must be the farthest from the bearing-off edge)
 */
export function getBearOffMoves(
  state: GameState,
  player: Player,
  dieValue: number,
): Move[] {
  const moves: Move[] = [];

  if (player === Player.Gold) {
    // Gold bears off from the high end (index 23 = point 24)
    // Distance to bear off from index i = 24 - i = POINTS_COUNT - i
    const homeStart = HOME_BOARD_START[player]; // 18
    const homeEnd = HOME_BOARD_END[player]; // 23

    // Exact bear off: piece at index where distance == dieValue
    // distance = POINTS_COUNT - i => i = POINTS_COUNT - dieValue
    const exactIdx = POINTS_COUNT - dieValue;
    if (
      exactIdx >= homeStart &&
      exactIdx <= homeEnd &&
      state.points[exactIdx] &&
      state.points[exactIdx]!.player === player
    ) {
      moves.push({ from: exactIdx, to: "off" });
    }

    // Higher die: if die is larger than needed for any piece, can bear off the farthest piece
    // Farthest piece = lowest index in the home board (closest to homeStart)
    if (dieValue > 1) {
      // Find the farthest back piece in the home board (lowest index for Gold)
      let farthestIdx = -1;
      for (let i = homeStart; i <= homeEnd; i++) {
        const point = state.points[i];
        if (point && point.player === player) {
          farthestIdx = i;
          break;
        }
      }

      if (farthestIdx !== -1) {
        const distanceNeeded = POINTS_COUNT - farthestIdx;
        // Can use higher die only if die > distanceNeeded AND this piece IS the farthest back
        // (which it is by definition since we found the lowest index)
        // Also, only add if it wasn't already added as exact
        if (dieValue > distanceNeeded && farthestIdx !== exactIdx) {
          moves.push({ from: farthestIdx, to: "off" });
        }
      }
    }
  } else {
    // Red bears off from the low end (index 0 = point 1)
    // Distance to bear off from index i = i + 1
    const homeStart = HOME_BOARD_START[player]; // 0
    const homeEnd = HOME_BOARD_END[player]; // 5

    // Exact bear off: piece at index where distance == dieValue
    // distance = i + 1 => i = dieValue - 1
    const exactIdx = dieValue - 1;
    if (
      exactIdx >= homeStart &&
      exactIdx <= homeEnd &&
      state.points[exactIdx] &&
      state.points[exactIdx]!.player === player
    ) {
      moves.push({ from: exactIdx, to: "off" });
    }

    // Higher die: find farthest back piece (highest index for Red)
    if (dieValue > 1) {
      let farthestIdx = -1;
      for (let i = homeEnd; i >= homeStart; i--) {
        const point = state.points[i];
        if (point && point.player === player) {
          farthestIdx = i;
          break;
        }
      }

      if (farthestIdx !== -1) {
        const distanceNeeded = farthestIdx + 1;
        if (dieValue > distanceNeeded && farthestIdx !== exactIdx) {
          moves.push({ from: farthestIdx, to: "off" });
        }
      }
    }
  }

  return moves;
}

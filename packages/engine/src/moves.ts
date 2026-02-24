import { Player, type GameState, type Move, type PointState } from "./types.js";
import { MOVE_DIRECTION, POINTS_COUNT } from "./constants.js";
import { cloneState } from "./state.js";
import { canBearOff, getBearOffMoves } from "./bearing-off.js";

export function opponent(player: Player): Player {
  return player === Player.Gold ? Player.Red : Player.Gold;
}

export function getTargetIndex(
  from: number | "bar",
  dieValue: number,
  player: Player,
): number {
  if (from === "bar") {
    return player === Player.Gold ? dieValue - 1 : POINTS_COUNT - dieValue;
  }
  return from + dieValue * MOVE_DIRECTION[player];
}

export function isPointOpen(point: PointState, player: Player): boolean {
  if (point === null) return true;
  if (point.player === player) return true;
  if (point.count <= 1) return true; // Blot - can hit
  return false;
}

export function getLegalMoves(state: GameState): Move[] {
  const { currentPlayer, dice } = state;
  if (!dice || dice.remaining.length === 0) return [];

  const moves: Move[] = [];
  const hasBar = state.bar[currentPlayer] > 0;

  // Unique remaining dice values to avoid duplicate moves
  const uniqueDice = [...new Set(dice.remaining)];

  for (const die of uniqueDice) {
    if (hasBar) {
      // Must enter from bar first
      const target = getTargetIndex("bar", die, currentPlayer);
      if (
        target >= 0 &&
        target < POINTS_COUNT &&
        isPointOpen(state.points[target], currentPlayer)
      ) {
        moves.push({ from: "bar", to: target });
      }
    } else {
      // Move pieces from points
      for (let i = 0; i < POINTS_COUNT; i++) {
        const point = state.points[i];
        if (point && point.player === currentPlayer) {
          const target = getTargetIndex(i, die, currentPlayer);
          if (
            target >= 0 &&
            target < POINTS_COUNT &&
            isPointOpen(state.points[target], currentPlayer)
          ) {
            moves.push({ from: i, to: target });
          }
        }
      }

      // Bearing off moves
      if (canBearOff(state, currentPlayer)) {
        const bearOffMoves = getBearOffMoves(state, currentPlayer, die);
        moves.push(...bearOffMoves);
      }
    }
  }

  return moves;
}

export function applyMove(state: GameState, move: Move): GameState {
  const newState = cloneState(state);
  const { currentPlayer } = newState;
  const opp = opponent(currentPlayer);

  // Remove piece from source
  if (move.from === "bar") {
    newState.bar[currentPlayer]--;
  } else {
    const fromPoint = newState.points[move.from]!;
    fromPoint.count--;
    if (fromPoint.count === 0) {
      newState.points[move.from] = null;
    }
  }

  // Place piece on target
  if (move.to === "off") {
    newState.borneOff[currentPlayer]++;
  } else {
    const toPoint = newState.points[move.to];
    if (toPoint && toPoint.player === opp) {
      // Hit opponent blot
      newState.bar[opp]++;
      newState.points[move.to] = { player: currentPlayer, count: 1 };
    } else if (toPoint && toPoint.player === currentPlayer) {
      toPoint.count++;
    } else {
      newState.points[move.to] = { player: currentPlayer, count: 1 };
    }
  }

  // Consume the die used
  if (move.to === "off") {
    // Bear-off die consumption: calculate the die used
    const from = move.from as number;
    let dieUsed: number;
    if (currentPlayer === Player.Gold) {
      dieUsed = POINTS_COUNT - from; // distance to bearing off for Gold
    } else {
      dieUsed = from + 1; // distance to bearing off for Red
    }
    // Try exact die first
    let dieIdx = newState.dice!.remaining.indexOf(dieUsed);
    if (dieIdx === -1) {
      // If no exact die, use the smallest die that is >= dieUsed (higher die bearing off)
      const sorted = [...newState.dice!.remaining].sort((a, b) => a - b);
      const higherDie = sorted.find((d) => d > dieUsed);
      if (higherDie !== undefined) {
        dieIdx = newState.dice!.remaining.indexOf(higherDie);
      }
    }
    if (dieIdx !== -1) newState.dice!.remaining.splice(dieIdx, 1);
  } else if (move.from === "bar") {
    const die =
      currentPlayer === Player.Gold
        ? (move.to as number) + 1
        : POINTS_COUNT - (move.to as number);
    const dieIdx = newState.dice!.remaining.indexOf(die);
    if (dieIdx !== -1) newState.dice!.remaining.splice(dieIdx, 1);
  } else {
    const distance = Math.abs((move.to as number) - (move.from as number));
    const dieIdx = newState.dice!.remaining.indexOf(distance);
    if (dieIdx !== -1) newState.dice!.remaining.splice(dieIdx, 1);
  }

  return newState;
}

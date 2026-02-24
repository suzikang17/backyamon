import type { GameState, Move } from "../types.js";
import { getLegalMoves, applyMove } from "../moves.js";

/**
 * Generate all possible complete turns (sequences of moves) for the current
 * player given the current dice. A complete turn uses as many dice as possible.
 *
 * In backgammon, you must use both dice if possible. If only one can be used,
 * you must use the higher die.
 */
export function getAllLegalTurns(state: GameState): Move[][] {
  const turns: Move[][] = [];

  function explore(currentState: GameState, movesSoFar: Move[]): void {
    const legalMoves = getLegalMoves(currentState);

    if (legalMoves.length === 0) {
      // No more moves possible - this is a terminal turn
      turns.push([...movesSoFar]);
      return;
    }

    for (const move of legalMoves) {
      const newState = applyMove(currentState, move);
      movesSoFar.push(move);
      explore(newState, movesSoFar);
      movesSoFar.pop();
    }
  }

  explore(state, []);

  if (turns.length === 0) {
    return [[]]; // No moves available at all
  }

  // Enforce backgammon rule: must use as many dice as possible
  const maxMoves = Math.max(...turns.map((t) => t.length));
  let filteredTurns = turns.filter((t) => t.length === maxMoves);

  // If only one die can be used, must use the higher die
  if (maxMoves === 1 && state.dice && state.dice.remaining.length >= 2) {
    const dieValues = state.dice.remaining;
    const maxDie = Math.max(...dieValues);

    // Check if there are turns that use the higher die
    const turnsUsingHigherDie = filteredTurns.filter((turn) => {
      const move = turn[0];
      const dieUsed = getDieUsedForMove(state, move);
      return dieUsed === maxDie;
    });

    if (turnsUsingHigherDie.length > 0) {
      filteredTurns = turnsUsingHigherDie;
    }
  }

  // Deduplicate turns
  const seen = new Set<string>();
  const uniqueTurns: Move[][] = [];
  for (const turn of filteredTurns) {
    const key = turn.map((m) => `${m.from}:${m.to}`).join("|");
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTurns.push(turn);
    }
  }

  return uniqueTurns;
}

/**
 * Determine which die value a move uses.
 */
function getDieUsedForMove(state: GameState, move: Move): number {
  const { currentPlayer } = state;
  if (move.from === "bar") {
    if (currentPlayer === "gold") {
      return (move.to as number) + 1;
    } else {
      return 24 - (move.to as number);
    }
  }
  if (move.to === "off") {
    if (currentPlayer === "gold") {
      return 24 - (move.from as number);
    } else {
      return (move.from as number) + 1;
    }
  }
  return Math.abs((move.to as number) - (move.from as number));
}

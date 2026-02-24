import { Player, type GameState, type Move } from "../types";
import type { AIPlayer } from "./types";
import { getAllLegalTurns } from "./turn-generator";
import { applyMove, opponent } from "../moves";
import { evaluateBoard } from "./selector";
import { rollDice } from "../dice";
import { endTurn } from "../turn";

/**
 * King Tubby - Hard AI
 *
 * Uses minimax with alpha-beta pruning to look ahead 2 plies.
 * Uses Selector's evaluation function at leaf nodes.
 * Must complete within 2 seconds.
 */
export class KingTubby implements AIPlayer {
  name = "King Tubby";
  difficulty = "hard" as const;
  private maxDepth = 2;
  private timeLimit = 1800; // ms, slightly under 2s for safety

  selectMoves(state: GameState): Move[] {
    const turns = getAllLegalTurns(state);
    if (turns.length === 0 || (turns.length === 1 && turns[0].length === 0)) {
      return [];
    }

    if (turns.length === 1) {
      return turns[0]; // Only one option, no need to think
    }

    const startTime = Date.now();
    let bestTurn = turns[0];
    let bestScore = -Infinity;
    const player = state.currentPlayer;

    for (const turn of turns) {
      if (Date.now() - startTime > this.timeLimit) break;

      // Apply all moves to get the resulting state
      let resultState = state;
      for (const move of turn) {
        resultState = applyMove(resultState, move);
      }

      // Switch turn for the opponent to analyze
      const afterTurnState = endTurn(resultState);

      if (afterTurnState.phase === "GAME_OVER") {
        // We win! Maximum score
        bestTurn = turn;
        bestScore = Infinity;
        break;
      }

      // Evaluate with minimax looking ahead
      const score = this.expectiminimax(
        afterTurnState,
        this.maxDepth - 1,
        -Infinity,
        Infinity,
        false,
        player,
        startTime,
      );

      if (score > bestScore) {
        bestScore = score;
        bestTurn = turn;
      }
    }

    return bestTurn;
  }

  /**
   * Expectiminimax with alpha-beta pruning.
   * Uses expected value over all possible dice rolls (chance nodes).
   */
  private expectiminimax(
    state: GameState,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean,
    perspective: Player,
    startTime: number,
  ): number {
    // Time check
    if (Date.now() - startTime > this.timeLimit) {
      return evaluateBoard(state, perspective);
    }

    // Terminal conditions
    if (depth <= 0 || state.phase === "GAME_OVER") {
      return evaluateBoard(state, perspective);
    }

    // Chance node: average over a sample of dice rolls
    // All 21 unique dice combinations (6 doubles + 15 non-doubles)
    const diceRolls = getDiceRolls();
    let totalScore = 0;
    let totalWeight = 0;

    for (const { roll, weight } of diceRolls) {
      if (Date.now() - startTime > this.timeLimit) break;

      // Set dice on the state
      const stateWithDice: GameState = {
        ...state,
        dice: rollDice(roll),
        phase: "MOVING",
      };

      const turns = getAllLegalTurns(stateWithDice);

      if (turns.length === 0 || (turns.length === 1 && turns[0].length === 0)) {
        // No moves available, evaluate current position
        const evalScore = evaluateBoard(state, perspective);
        totalScore += evalScore * weight;
        totalWeight += weight;
        continue;
      }

      if (isMaximizing) {
        let bestVal = -Infinity;
        for (const turn of turns) {
          if (Date.now() - startTime > this.timeLimit) break;

          let resultState = stateWithDice;
          for (const move of turn) {
            resultState = applyMove(resultState, move);
          }
          const afterTurn = endTurn(resultState);

          if (afterTurn.phase === "GAME_OVER") {
            bestVal = Infinity;
            break;
          }

          const val = depth > 1
            ? this.expectiminimax(
                afterTurn,
                depth - 1,
                alpha,
                beta,
                false,
                perspective,
                startTime,
              )
            : evaluateBoard(afterTurn, perspective);

          bestVal = Math.max(bestVal, val);
          alpha = Math.max(alpha, val);
          if (beta <= alpha) break;
        }
        totalScore += bestVal * weight;
      } else {
        let bestVal = Infinity;
        for (const turn of turns) {
          if (Date.now() - startTime > this.timeLimit) break;

          let resultState = stateWithDice;
          for (const move of turn) {
            resultState = applyMove(resultState, move);
          }
          const afterTurn = endTurn(resultState);

          if (afterTurn.phase === "GAME_OVER") {
            bestVal = -Infinity;
            break;
          }

          const val = depth > 1
            ? this.expectiminimax(
                afterTurn,
                depth - 1,
                alpha,
                beta,
                true,
                perspective,
                startTime,
              )
            : evaluateBoard(afterTurn, perspective);

          bestVal = Math.min(bestVal, val);
          beta = Math.min(beta, val);
          if (beta <= alpha) break;
        }
        totalScore += bestVal * weight;
      }
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : evaluateBoard(state, perspective);
  }

  shouldDouble(state: GameState): boolean {
    const score = evaluateBoard(state, state.currentPlayer);
    return score > 40;
  }

  shouldAcceptDouble(state: GameState): boolean {
    // Use the standard 25% equity threshold for acceptance
    const score = evaluateBoard(state, opponent(state.currentPlayer));
    return score > -60;
  }
}

/**
 * All 21 distinct dice roll outcomes with probabilities.
 * Doubles have probability 1/36, non-doubles have 2/36.
 */
function getDiceRolls(): { roll: [number, number]; weight: number }[] {
  const rolls: { roll: [number, number]; weight: number }[] = [];

  for (let i = 1; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      const weight = i === j ? 1 : 2; // Doubles 1/36, non-doubles 2/36
      rolls.push({ roll: [i, j], weight });
    }
  }

  return rolls;
}

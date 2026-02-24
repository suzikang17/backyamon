import type { GameState, Move } from "../types";

export interface AIPlayer {
  name: string;
  difficulty: "easy" | "medium" | "hard";
  selectMoves(state: GameState): Move[];
  shouldDouble(state: GameState): boolean;
  shouldAcceptDouble(state: GameState): boolean;
}

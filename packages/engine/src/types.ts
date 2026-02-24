export enum Player {
  Gold = "gold",
  Red = "red",
}

export type PointState = {
  player: Player;
  count: number;
} | null;

export type GamePhase =
  | "ROLLING"
  | "MOVING"
  | "DOUBLING"
  | "CHECKING_WIN"
  | "GAME_OVER";

export type WinType = "ya_mon" | "big_ya_mon" | "massive_ya_mon";

export interface DoublingCube {
  value: number; // 1, 2, 4, 8, 16, ...
  owner: Player | null; // null = centered (either can double)
}

export interface Dice {
  values: [number, number];
  remaining: number[]; // Dice values not yet used this turn
}

export interface Move {
  from: number | "bar"; // Point index (0-23) or "bar"
  to: number | "off"; // Point index (0-23) or "off" (bear off)
}

export interface GameState {
  points: PointState[]; // 24 points, index 0 = point 1
  bar: Record<Player, number>;
  borneOff: Record<Player, number>;
  currentPlayer: Player;
  phase: GamePhase;
  dice: Dice | null;
  doublingCube: DoublingCube;
  matchScore: Record<Player, number>;
  matchLength: number; // Points to win the match
  isCrawford: boolean;
  winner: Player | null;
  winType: WinType | null;
}

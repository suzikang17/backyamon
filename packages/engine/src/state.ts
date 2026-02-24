import { Player, type GameState } from "./types";
import { INITIAL_POSITIONS } from "./constants";

export function createInitialState(matchLength = 1): GameState {
  return {
    points: INITIAL_POSITIONS.map((p) => (p ? { ...p } : null)),
    bar: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<Player, number>,
    borneOff: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<Player, number>,
    currentPlayer: Player.Gold,
    phase: "ROLLING",
    dice: null,
    doublingCube: { value: 1, owner: null },
    matchScore: { [Player.Gold]: 0, [Player.Red]: 0 } as Record<
      Player,
      number
    >,
    matchLength,
    isCrawford: false,
    winner: null,
    winType: null,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    points: state.points.map((p) => (p ? { ...p } : null)),
    bar: { ...state.bar },
    borneOff: { ...state.borneOff },
    dice: state.dice
      ? { ...state.dice, remaining: [...state.dice.remaining] }
      : null,
    doublingCube: { ...state.doublingCube },
    matchScore: { ...state.matchScore },
  };
}

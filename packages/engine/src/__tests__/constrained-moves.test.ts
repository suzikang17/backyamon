import { describe, it, expect } from "vitest";
import { getConstrainedMoves } from "../constrained-moves";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("getConstrainedMoves", () => {
  it("should return moves for a normal opening position", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const moves = getConstrainedMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should return empty array when no moves exist", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    state.dice = rollDice([6, 5]);
    state.phase = "MOVING";
    // Block entry points
    state.points[4] = { player: Player.Red, count: 2 };
    state.points[5] = { player: Player.Red, count: 2 };
    const moves = getConstrainedMoves(state);
    expect(moves).toEqual([]);
  });

  it("should enforce must-use-higher-die when only one die can be played", () => {
    // Gold piece on idx 0, dice [5, 2]
    // Both idx 2 and idx 5 are open for the first move
    // But after moving to either, the second move is blocked
    // So only 1 die can be used -> must use die 5
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[0] = { player: Player.Gold, count: 1 };
    // Block the second-move targets
    state.points[7] = { player: Player.Red, count: 2 }; // blocks 5+2 and 2+5
    state.dice = rollDice([5, 2]);
    state.phase = "MOVING";

    const moves = getConstrainedMoves(state);
    // Should only allow the move using die 5 (from 0 to 5)
    const movesUsing5 = moves.filter(m => m.from === 0 && m.to === 5);
    const movesUsing2 = moves.filter(m => m.from === 0 && m.to === 2);
    expect(movesUsing5.length).toBe(1);
    expect(movesUsing2.length).toBe(0);
  });

  it("should allow moves that lead to using both dice", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[0] = { player: Player.Gold, count: 1 };
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";

    const moves = getConstrainedMoves(state);
    // Both first-move options (using die 3 first, or die 1 first) should be available
    // since both lead to using both dice
    expect(moves).toContainEqual({ from: 0, to: 3 });
    expect(moves).toContainEqual({ from: 0, to: 1 });
  });
});

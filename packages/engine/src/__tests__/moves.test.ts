import { describe, it, expect } from "vitest";
import { getLegalMoves, applyMove, opponent } from "../moves";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("getLegalMoves", () => {
  it("should return moves for opening position", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should only allow bar entry when player has pieces on bar", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    state.points[0]!.count = 1; // Remove one piece from point 1
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    // All moves must start from "bar"
    expect(moves.every((m) => m.from === "bar")).toBe(true);
  });

  it("should return empty array when no legal moves exist", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    // Block all entry points for a roll of [6, 5]
    state.dice = rollDice([6, 5]);
    state.phase = "MOVING";
    // Fill points 5 and 6 with 2+ opponent pieces
    state.points[4] = { player: Player.Red, count: 2 };
    state.points[5] = { player: Player.Red, count: 2 };
    const moves = getLegalMoves(state);
    expect(moves).toEqual([]);
  });

  it("should return empty array when no dice remain", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.dice.remaining = [];
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    expect(moves).toEqual([]);
  });

  it("should return empty array when dice is null", () => {
    const state = createInitialState();
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    expect(moves).toEqual([]);
  });

  it("should not allow landing on 2+ opponent pieces", () => {
    const state = createInitialState();
    state.dice = rollDice([5, 4]);
    state.phase = "MOVING";
    // Point 6 (idx 5) has 5 Red pieces - Gold should not be able to land on it
    const moves = getLegalMoves(state);
    const movesToPoint5 = moves.filter((m) => m.to === 5);
    expect(movesToPoint5).toEqual([]);
  });

  it("should allow hitting a single opponent blot", () => {
    const state = createInitialState();
    state.dice = rollDice([4, 1]);
    state.phase = "MOVING";
    // Place a red blot on point 5 (idx 4)
    state.points[4] = { player: Player.Red, count: 1 };
    const moves = getLegalMoves(state);
    const movesToPoint5 = moves.filter((m) => m.to === 4);
    expect(movesToPoint5.length).toBeGreaterThan(0);
  });

  it("should generate unique moves for doubles", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 3]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    // Should have moves but no duplicates
    const moveStrings = moves.map((m) => `${m.from}-${m.to}`);
    const uniqueMoves = new Set(moveStrings);
    expect(uniqueMoves.size).toBe(moveStrings.length);
  });

  it("should allow Gold bar entry on correct points", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.bar[Player.Gold] = 1;
    state.dice = rollDice([3, 5]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    // Gold enters at die-1: die=3 -> idx 2, die=5 -> idx 4
    expect(moves).toContainEqual({ from: "bar", to: 2 });
    expect(moves).toContainEqual({ from: "bar", to: 4 });
  });

  it("should allow Red bar entry on correct points", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.currentPlayer = Player.Red;
    state.bar[Player.Red] = 1;
    state.dice = rollDice([3, 5]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    // Red enters at 24-die: die=3 -> idx 21, die=5 -> idx 19
    expect(moves).toContainEqual({ from: "bar", to: 21 });
    expect(moves).toContainEqual({ from: "bar", to: 19 });
  });
});

describe("applyMove", () => {
  it("should move a piece from one point to another", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    // Move gold piece from point 1 (idx 0) by 3 to point 4 (idx 3)
    const newState = applyMove(state, { from: 0, to: 3 });
    expect(newState.points[0]!.count).toBe(1); // Was 2, now 1
    expect(newState.points[3]).toEqual({ player: Player.Gold, count: 1 });
  });

  it("should hit an opponent blot and send it to the bar", () => {
    const state = createInitialState();
    state.dice = rollDice([4, 1]);
    state.phase = "MOVING";
    // Place a red blot on point 5 (idx 4)
    state.points[4] = { player: Player.Red, count: 1 };
    // Move gold from point 1 (idx 0) to point 5 (idx 4)
    const newState = applyMove(state, { from: 0, to: 4 });
    expect(newState.points[4]).toEqual({ player: Player.Gold, count: 1 });
    expect(newState.bar[Player.Red]).toBe(1);
  });

  it("should enter a piece from the bar", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 1;
    state.points[0]!.count = 1;
    state.dice = rollDice([1, 3]);
    state.phase = "MOVING";
    const newState = applyMove(state, { from: "bar", to: 0 });
    expect(newState.bar[Player.Gold]).toBe(0);
    expect(newState.points[0]!.count).toBe(2);
  });

  it("should not mutate the original state", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const originalCount = state.points[0]!.count;
    applyMove(state, { from: 0, to: 3 });
    expect(state.points[0]!.count).toBe(originalCount);
  });

  it("should consume the correct die value", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    // Move by 3 (from idx 0 to idx 3)
    const newState = applyMove(state, { from: 0, to: 3 });
    expect(newState.dice!.remaining).toEqual([1]);
  });

  it("should consume die for bar entry", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.bar[Player.Gold] = 1;
    state.dice = rollDice([3, 5]);
    state.phase = "MOVING";
    // Gold enters at idx 2 (die = 3)
    const newState = applyMove(state, { from: "bar", to: 2 });
    expect(newState.dice!.remaining).toEqual([5]);
    expect(newState.bar[Player.Gold]).toBe(0);
  });

  it("should set point to null when last piece moves away", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[5] = { player: Player.Gold, count: 1 };
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const newState = applyMove(state, { from: 5, to: 8 });
    expect(newState.points[5]).toBeNull();
    expect(newState.points[8]).toEqual({ player: Player.Gold, count: 1 });
  });

  it("should stack pieces on a friendly point", () => {
    const state = createInitialState();
    state.dice = rollDice([6, 1]);
    state.phase = "MOVING";
    // Move Gold from point 12 (idx 11) by 6 to point 18 (idx 17)
    // First place a Gold piece there
    state.points[17] = { player: Player.Gold, count: 2 };
    const newState = applyMove(state, { from: 11, to: 17 });
    expect(newState.points[17]).toEqual({ player: Player.Gold, count: 3 });
  });
});

describe("opponent", () => {
  it("should return Red for Gold", () => {
    expect(opponent(Player.Gold)).toBe(Player.Red);
  });
  it("should return Gold for Red", () => {
    expect(opponent(Player.Red)).toBe(Player.Gold);
  });
});

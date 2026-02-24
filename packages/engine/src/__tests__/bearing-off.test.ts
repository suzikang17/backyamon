import { describe, it, expect } from "vitest";
import { canBearOff, getBearOffMoves } from "../bearing-off";
import { getLegalMoves, applyMove } from "../moves";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("canBearOff", () => {
  it("should return false at game start", () => {
    const state = createInitialState();
    expect(canBearOff(state, Player.Gold)).toBe(false);
    expect(canBearOff(state, Player.Red)).toBe(false);
  });

  it("should return true when all Gold pieces are in home board", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 5 };
    state.points[19] = { player: Player.Gold, count: 5 };
    state.points[20] = { player: Player.Gold, count: 5 };
    expect(canBearOff(state, Player.Gold)).toBe(true);
  });

  it("should return true when all Red pieces are in home board", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[0] = { player: Player.Red, count: 5 };
    state.points[1] = { player: Player.Red, count: 5 };
    state.points[2] = { player: Player.Red, count: 5 };
    expect(canBearOff(state, Player.Red)).toBe(true);
  });

  it("should return false if a piece is on the bar", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 14 };
    state.bar[Player.Gold] = 1;
    expect(canBearOff(state, Player.Gold)).toBe(false);
  });

  it("should return false if any piece is outside home board", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 14 };
    state.points[10] = { player: Player.Gold, count: 1 }; // Outside home board
    expect(canBearOff(state, Player.Gold)).toBe(false);
  });

  it("should include borne off pieces in the count", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[20] = { player: Player.Gold, count: 10 };
    state.borneOff[Player.Gold] = 5; // 5 already off
    expect(canBearOff(state, Player.Gold)).toBe(true);
  });
});

describe("getBearOffMoves", () => {
  it("should allow exact bear off for Gold", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[23] = { player: Player.Gold, count: 1 }; // Point 24 - needs die=1 to bear off
    const moves = getBearOffMoves(state, Player.Gold, 1);
    expect(moves).toContainEqual({ from: 23, to: "off" });
  });

  it("should allow exact bear off for Red", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[0] = { player: Player.Red, count: 1 }; // Point 1 - needs die=1 to bear off
    const moves = getBearOffMoves(state, Player.Red, 1);
    expect(moves).toContainEqual({ from: 0, to: "off" });
  });

  it("should allow higher die to bear off farthest piece for Gold", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[20] = { player: Player.Gold, count: 1 }; // Point 21 (needs 4 to bear off exactly)
    // Rolling a 6 should allow bearing off from point 21 if no piece is farther back
    const moves = getBearOffMoves(state, Player.Gold, 6);
    expect(moves).toContainEqual({ from: 20, to: "off" });
  });

  it("should allow higher die to bear off farthest piece for Red", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[3] = { player: Player.Red, count: 1 }; // Point 4 (needs 4 to bear off exactly)
    // Rolling a 6 should allow bearing off from point 4 if no piece is farther back
    const moves = getBearOffMoves(state, Player.Red, 6);
    expect(moves).toContainEqual({ from: 3, to: "off" });
  });

  it("should NOT allow higher die to bear off if a piece is farther back (Gold)", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 1 }; // Point 19 - farther back
    state.points[22] = { player: Player.Gold, count: 1 }; // Point 23
    // Rolling a 2: can bear off from 22 (exact: 24-22=2), but cannot use higher die on 22
    // since 18 is farther back, and 18 can't bear off with die=2 (needs 6)
    const moves = getBearOffMoves(state, Player.Gold, 2);
    expect(moves).toContainEqual({ from: 22, to: "off" }); // Exact bear off
    expect(moves).not.toContainEqual({ from: 18, to: "off" }); // Too far back for die=2
  });

  it("should NOT allow higher die to bear off if a piece is farther back (Red)", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[5] = { player: Player.Red, count: 1 }; // Point 6 - farther back
    state.points[1] = { player: Player.Red, count: 1 }; // Point 2
    // Rolling a 2: exact for point 2 (idx 1), but die=2 can't reach from point 6
    const moves = getBearOffMoves(state, Player.Red, 2);
    expect(moves).toContainEqual({ from: 1, to: "off" }); // Exact
    expect(moves).not.toContainEqual({ from: 5, to: "off" }); // Too far back
  });

  it("should return empty when die is too small and not the farthest piece", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[18] = { player: Player.Gold, count: 5 }; // All on point 19
    // Die of 1 can't bear off from point 19 (needs 6), and it's not exact
    // But since it IS the farthest piece, a die of 6+ would work
    const moves = getBearOffMoves(state, Player.Gold, 1);
    expect(moves).toEqual([]);
  });
});

describe("bearing off integration with getLegalMoves", () => {
  it("should include bear-off moves when all pieces in home board", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[23] = { player: Player.Gold, count: 5 };
    state.points[22] = { player: Player.Gold, count: 5 };
    state.points[21] = { player: Player.Gold, count: 5 };
    state.dice = rollDice([1, 2]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    const bearOffMoves = moves.filter((m) => m.to === "off");
    expect(bearOffMoves.length).toBeGreaterThan(0);
  });

  it("should not include bear-off moves at game start", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const moves = getLegalMoves(state);
    const bearOffMoves = moves.filter((m) => m.to === "off");
    expect(bearOffMoves).toEqual([]);
  });

  it("should apply bear-off move correctly", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[23] = { player: Player.Gold, count: 5 };
    state.points[22] = { player: Player.Gold, count: 5 };
    state.points[21] = { player: Player.Gold, count: 5 };
    state.dice = rollDice([1, 2]);
    state.phase = "MOVING";
    const newState = applyMove(state, { from: 23, to: "off" });
    expect(newState.borneOff[Player.Gold]).toBe(1);
    expect(newState.points[23]!.count).toBe(4);
  });
});

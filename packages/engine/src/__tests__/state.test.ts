import { describe, it, expect } from "vitest";
import { createInitialState, cloneState } from "../state";
import { Player } from "../types";

describe("createInitialState", () => {
  it("should set up the board with standard backgammon positions", () => {
    const state = createInitialState();

    // Point 1 (index 0): 2 Gold pieces
    expect(state.points[0]).toEqual({ player: Player.Gold, count: 2 });
    // Point 6 (index 5): 5 Red pieces
    expect(state.points[5]).toEqual({ player: Player.Red, count: 5 });
    // Point 8 (index 7): 3 Red pieces
    expect(state.points[7]).toEqual({ player: Player.Red, count: 3 });
    // Point 12 (index 11): 5 Gold pieces
    expect(state.points[11]).toEqual({ player: Player.Gold, count: 5 });
    // Point 13 (index 12): 5 Red pieces
    expect(state.points[12]).toEqual({ player: Player.Red, count: 5 });
    // Point 17 (index 16): 3 Gold pieces
    expect(state.points[16]).toEqual({ player: Player.Gold, count: 3 });
    // Point 19 (index 18): 5 Gold pieces
    expect(state.points[18]).toEqual({ player: Player.Gold, count: 5 });
    // Point 24 (index 23): 2 Red pieces
    expect(state.points[23]).toEqual({ player: Player.Red, count: 2 });

    // Empty points should be null
    expect(state.points[1]).toBeNull();
    expect(state.points[2]).toBeNull();
    expect(state.points[3]).toBeNull();
    expect(state.points[4]).toBeNull();
    expect(state.points[6]).toBeNull();

    // Bar and borne off should be empty
    expect(state.bar[Player.Gold]).toBe(0);
    expect(state.bar[Player.Red]).toBe(0);
    expect(state.borneOff[Player.Gold]).toBe(0);
    expect(state.borneOff[Player.Red]).toBe(0);

    // Game should start in ROLLING phase
    expect(state.phase).toBe("ROLLING");
    expect(state.currentPlayer).toBe(Player.Gold);
    expect(state.doublingCube).toEqual({ value: 1, owner: null });
    expect(state.dice).toBeNull();
    expect(state.winner).toBeNull();
    expect(state.winType).toBeNull();
    expect(state.isCrawford).toBe(false);
  });

  it("should have 15 pieces per player", () => {
    const state = createInitialState();
    let goldCount = 0;
    let redCount = 0;
    for (const point of state.points) {
      if (point?.player === Player.Gold) goldCount += point.count;
      if (point?.player === Player.Red) redCount += point.count;
    }
    expect(goldCount).toBe(15);
    expect(redCount).toBe(15);
  });

  it("should have 24 points on the board", () => {
    const state = createInitialState();
    expect(state.points).toHaveLength(24);
  });

  it("should accept a custom match length", () => {
    const state = createInitialState(5);
    expect(state.matchLength).toBe(5);
    expect(state.matchScore[Player.Gold]).toBe(0);
    expect(state.matchScore[Player.Red]).toBe(0);
  });
});

describe("cloneState", () => {
  it("should create a deep copy of the state", () => {
    const state = createInitialState();
    const clone = cloneState(state);

    // Should be equal but not the same reference
    expect(clone).toEqual(state);
    expect(clone).not.toBe(state);
    expect(clone.points).not.toBe(state.points);
    expect(clone.bar).not.toBe(state.bar);
    expect(clone.borneOff).not.toBe(state.borneOff);
    expect(clone.doublingCube).not.toBe(state.doublingCube);
    expect(clone.matchScore).not.toBe(state.matchScore);
  });

  it("should not affect original when clone is modified", () => {
    const state = createInitialState();
    const clone = cloneState(state);

    clone.points[0]!.count = 99;
    clone.bar[Player.Gold] = 5;
    clone.borneOff[Player.Red] = 10;

    expect(state.points[0]!.count).toBe(2);
    expect(state.bar[Player.Gold]).toBe(0);
    expect(state.borneOff[Player.Red]).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { checkWinner, getWinType, getPointsWon } from "../winner";
import { createInitialState } from "../state";
import { Player } from "../types";

describe("checkWinner", () => {
  it("should return null when no one has won", () => {
    const state = createInitialState();
    expect(checkWinner(state)).toBeNull();
  });

  it("should detect Gold win when all 15 pieces borne off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    expect(checkWinner(state)).toBe(Player.Gold);
  });

  it("should detect Red win when all 15 pieces borne off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Red] = 15;
    expect(checkWinner(state)).toBe(Player.Red);
  });

  it("should not detect winner with 14 borne off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 14;
    state.points[20] = { player: Player.Gold, count: 1 };
    expect(checkWinner(state)).toBeNull();
  });
});

describe("getWinType", () => {
  it('should return "ya_mon" for normal win (opponent has borne off pieces)', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 3; // Red has borne off some
    expect(getWinType(state, Player.Gold)).toBe("ya_mon");
  });

  it('should return "ya_mon" when opponent has borne off just 1 piece', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 1;
    state.points[10] = { player: Player.Red, count: 14 };
    expect(getWinType(state, Player.Gold)).toBe("ya_mon");
  });

  it('should return "big_ya_mon" for gammon (opponent has 0 borne off)', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 0;
    state.points[12] = { player: Player.Red, count: 15 }; // All red in neutral territory
    expect(getWinType(state, Player.Gold)).toBe("big_ya_mon");
  });

  it('should return "massive_ya_mon" when opponent has pieces on bar', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 0;
    state.bar[Player.Red] = 2;
    state.points[10] = { player: Player.Red, count: 13 };
    expect(getWinType(state, Player.Gold)).toBe("massive_ya_mon");
  });

  it('should return "massive_ya_mon" when opponent has pieces in winner home board', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 0;
    state.points[20] = { player: Player.Red, count: 15 }; // In Gold's home board (18-23)
    expect(getWinType(state, Player.Gold)).toBe("massive_ya_mon");
  });

  it('should return "massive_ya_mon" for Red winning with Gold on bar', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Red] = 15;
    state.borneOff[Player.Gold] = 0;
    state.bar[Player.Gold] = 3;
    state.points[10] = { player: Player.Gold, count: 12 };
    expect(getWinType(state, Player.Red)).toBe("massive_ya_mon");
  });

  it('should return "massive_ya_mon" for Red winning with Gold in Red home board', () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Red] = 15;
    state.borneOff[Player.Gold] = 0;
    state.points[3] = { player: Player.Gold, count: 15 }; // In Red's home board (0-5)
    expect(getWinType(state, Player.Red)).toBe("massive_ya_mon");
  });
});

describe("getPointsWon", () => {
  it("should return 1x cube for ya_mon", () => {
    expect(getPointsWon("ya_mon", 1)).toBe(1);
    expect(getPointsWon("ya_mon", 2)).toBe(2);
    expect(getPointsWon("ya_mon", 4)).toBe(4);
  });

  it("should return 2x cube for big_ya_mon", () => {
    expect(getPointsWon("big_ya_mon", 1)).toBe(2);
    expect(getPointsWon("big_ya_mon", 2)).toBe(4);
    expect(getPointsWon("big_ya_mon", 4)).toBe(8);
  });

  it("should return 3x cube for massive_ya_mon", () => {
    expect(getPointsWon("massive_ya_mon", 1)).toBe(3);
    expect(getPointsWon("massive_ya_mon", 2)).toBe(6);
    expect(getPointsWon("massive_ya_mon", 4)).toBe(12);
  });
});

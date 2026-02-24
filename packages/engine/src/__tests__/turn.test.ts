import { describe, it, expect } from "vitest";
import { endTurn, canMove } from "../turn";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("endTurn", () => {
  it("should switch current player from Gold to Red", () => {
    const state = createInitialState();
    state.phase = "MOVING";
    state.dice = rollDice([3, 1]);
    state.dice.remaining = []; // All dice used
    const newState = endTurn(state);
    expect(newState.currentPlayer).toBe(Player.Red);
    expect(newState.phase).toBe("ROLLING");
    expect(newState.dice).toBeNull();
  });

  it("should switch current player from Red to Gold", () => {
    const state = createInitialState();
    state.currentPlayer = Player.Red;
    state.phase = "MOVING";
    state.dice = rollDice([5, 2]);
    state.dice.remaining = [];
    const newState = endTurn(state);
    expect(newState.currentPlayer).toBe(Player.Gold);
    expect(newState.phase).toBe("ROLLING");
  });

  it("should detect winner and set GAME_OVER phase", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.phase = "MOVING";
    const newState = endTurn(state);
    expect(newState.phase).toBe("GAME_OVER");
    expect(newState.winner).toBe(Player.Gold);
    expect(newState.winType).toBeDefined();
  });

  it("should set appropriate win type on game over", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.borneOff[Player.Gold] = 15;
    state.borneOff[Player.Red] = 3;
    state.phase = "MOVING";
    const newState = endTurn(state);
    expect(newState.winType).toBe("ya_mon");
  });

  it("should not mutate original state", () => {
    const state = createInitialState();
    state.phase = "MOVING";
    state.dice = rollDice([3, 1]);
    state.dice.remaining = [];
    const originalPlayer = state.currentPlayer;
    endTurn(state);
    expect(state.currentPlayer).toBe(originalPlayer);
  });

  it("should clear dice when switching turns", () => {
    const state = createInitialState();
    state.dice = rollDice([4, 2]);
    state.dice.remaining = [];
    state.phase = "MOVING";
    const newState = endTurn(state);
    expect(newState.dice).toBeNull();
  });
});

describe("canMove", () => {
  it("should return true when legal moves exist", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    expect(canMove(state)).toBe(true);
  });

  it("should return false when no legal moves exist", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 2;
    state.points[0]!.count = 0;
    state.points[0] = null;
    state.dice = rollDice([6, 5]);
    state.phase = "MOVING";
    // Block entry points
    state.points[4] = { player: Player.Red, count: 3 };
    state.points[5] = { player: Player.Red, count: 3 };
    expect(canMove(state)).toBe(false);
  });

  it("should return false when dice is null", () => {
    const state = createInitialState();
    state.phase = "MOVING";
    expect(canMove(state)).toBe(false);
  });

  it("should return false when no dice remain", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.dice.remaining = [];
    state.phase = "MOVING";
    expect(canMove(state)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { BeachBum } from "../ai/beach-bum";
import { Selector, evaluateBoard } from "../ai/selector";
import { KingTubby } from "../ai/king-tubby";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";
import { getLegalMoves, applyMove } from "../moves";
import { getAllLegalTurns } from "../ai/turn-generator";

describe("getAllLegalTurns", () => {
  it("should generate complete turns", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const turns = getAllLegalTurns(state);
    expect(turns.length).toBeGreaterThan(0);
    // Each turn should use 2 moves (non-doubles, both dice)
    for (const turn of turns) {
      expect(turn.length).toBe(2);
    }
  });

  it("should handle doubles with 4 moves", () => {
    const state = createInitialState();
    state.dice = rollDice([1, 1]);
    state.phase = "MOVING";
    const turns = getAllLegalTurns(state);
    expect(turns.length).toBeGreaterThan(0);
    // Each turn should use 4 moves (doubles)
    const maxMoves = Math.max(...turns.map((t) => t.length));
    expect(maxMoves).toBe(4);
  });

  it("should return empty turn array when no moves possible", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 2;
    state.points[0] = null;
    state.dice = rollDice([6, 5]);
    state.phase = "MOVING";
    state.points[4] = { player: Player.Red, count: 3 };
    state.points[5] = { player: Player.Red, count: 3 };
    const turns = getAllLegalTurns(state);
    // Should have one turn with zero moves
    expect(turns).toEqual([[]]);
  });
});

describe("Beach Bum (easy)", () => {
  it("should return legal moves for opening position", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const ai = new BeachBum();
    const moves = ai.selectMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should return empty array when no moves available", () => {
    const state = createInitialState();
    state.bar[Player.Gold] = 2;
    state.points[0] = null;
    state.dice = rollDice([6, 5]);
    state.phase = "MOVING";
    state.points[4] = { player: Player.Red, count: 3 };
    state.points[5] = { player: Player.Red, count: 3 };
    const ai = new BeachBum();
    const moves = ai.selectMoves(state);
    expect(moves).toEqual([]);
  });

  it("should return moves that are all individually legal", () => {
    const state = createInitialState();
    state.dice = rollDice([4, 2]);
    state.phase = "MOVING";
    const ai = new BeachBum();
    const selectedMoves = ai.selectMoves(state);

    // Verify we can apply all selected moves sequentially
    let currentState = state;
    for (const move of selectedMoves) {
      const legalMoves = getLegalMoves(currentState);
      const isLegal = legalMoves.some(
        (m) => m.from === move.from && m.to === move.to,
      );
      expect(isLegal).toBe(true);
      currentState = applyMove(currentState, move);
    }
  });

  it("should have correct name and difficulty", () => {
    const ai = new BeachBum();
    expect(ai.name).toBe("Beach Bum");
    expect(ai.difficulty).toBe("easy");
  });

  it("should always accept doubles", () => {
    const state = createInitialState();
    const ai = new BeachBum();
    expect(ai.shouldAcceptDouble(state)).toBe(true);
  });
});

describe("Selector (medium)", () => {
  it("should return legal moves", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const ai = new Selector();
    const moves = ai.selectMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should prefer making points over leaving blots", () => {
    // Set up a position where making a point is clearly better
    const state = createInitialState();
    state.points = state.points.map(() => null);
    // Two Gold pieces that could form a point
    state.points[5] = { player: Player.Gold, count: 1 };
    state.points[8] = { player: Player.Gold, count: 1 };
    // Rest of Gold pieces safely in home
    state.points[20] = { player: Player.Gold, count: 13 };
    // Some Red pieces
    state.points[0] = { player: Player.Red, count: 15 };
    state.dice = rollDice([3, 3]);
    state.phase = "MOVING";

    const ai = new Selector();
    const moves = ai.selectMoves(state);

    // The AI should try to consolidate pieces rather than spread them
    // After applying moves, check if we have fewer blots
    let resultState = state;
    for (const move of moves) {
      resultState = applyMove(resultState, move);
    }

    // Count blots in resulting state
    let blots = 0;
    for (const point of resultState.points) {
      if (point && point.player === Player.Gold && point.count === 1) {
        blots++;
      }
    }
    // Selector should try to minimize blots
    expect(blots).toBeLessThanOrEqual(2);
  });

  it("should have correct name and difficulty", () => {
    const ai = new Selector();
    expect(ai.name).toBe("Selecta");
    expect(ai.difficulty).toBe("medium");
  });
});

describe("evaluateBoard", () => {
  it("should evaluate initial position as roughly even", () => {
    const state = createInitialState();
    const goldScore = evaluateBoard(state, Player.Gold);
    const redScore = evaluateBoard(state, Player.Red);
    // Both perspectives should give a similar score (neither side is winning)
    // Due to heuristic asymmetry, the scores may not be perfectly zero-sum
    expect(Math.abs(goldScore - redScore)).toBeLessThan(10);
  });

  it("should give higher score when more pieces are borne off", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    state.points[20] = { player: Player.Gold, count: 10 };
    state.borneOff[Player.Gold] = 5;
    state.points[3] = { player: Player.Red, count: 15 };

    const score = evaluateBoard(state, Player.Gold);
    expect(score).toBeGreaterThan(0); // Gold should be winning
  });

  it("should penalize having pieces on the bar", () => {
    const stateA = createInitialState();
    const stateB = createInitialState();
    stateB.bar[Player.Gold] = 2;
    stateB.points[0]!.count = 0;
    stateB.points[0] = null;

    const scoreA = evaluateBoard(stateA, Player.Gold);
    const scoreB = evaluateBoard(stateB, Player.Gold);
    expect(scoreB).toBeLessThan(scoreA);
  });
});

describe("King Tubby (hard)", () => {
  it("should return legal moves", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const ai = new KingTubby();
    const moves = ai.selectMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it("should complete within 2 seconds", () => {
    const state = createInitialState();
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    const ai = new KingTubby();

    const start = Date.now();
    ai.selectMoves(state);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it("should complete within 2 seconds with doubles", () => {
    const state = createInitialState();
    state.dice = rollDice([6, 6]);
    state.phase = "MOVING";
    const ai = new KingTubby();

    const start = Date.now();
    ai.selectMoves(state);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it("should have correct name and difficulty", () => {
    const ai = new KingTubby();
    expect(ai.name).toBe("King Tubby");
    expect(ai.difficulty).toBe("hard");
  });

  it("should return moves that are all individually legal", () => {
    const state = createInitialState();
    state.dice = rollDice([5, 3]);
    state.phase = "MOVING";
    const ai = new KingTubby();
    const selectedMoves = ai.selectMoves(state);

    let currentState = state;
    for (const move of selectedMoves) {
      const legalMoves = getLegalMoves(currentState);
      const isLegal = legalMoves.some(
        (m) => m.from === move.from && m.to === move.to,
      );
      expect(isLegal).toBe(true);
      currentState = applyMove(currentState, move);
    }
  });
});

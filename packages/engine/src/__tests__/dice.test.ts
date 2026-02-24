import { describe, it, expect } from "vitest";
import { rollDice, getDiceMoveCounts } from "../dice";

describe("rollDice", () => {
  it("should return two values between 1 and 6", () => {
    for (let i = 0; i < 100; i++) {
      const dice = rollDice();
      expect(dice.values).toHaveLength(2);
      expect(dice.values[0]).toBeGreaterThanOrEqual(1);
      expect(dice.values[0]).toBeLessThanOrEqual(6);
      expect(dice.values[1]).toBeGreaterThanOrEqual(1);
      expect(dice.values[1]).toBeLessThanOrEqual(6);
    }
  });

  it("should double the remaining moves on doubles", () => {
    const dice = rollDice([3, 3]);
    expect(dice.remaining).toEqual([3, 3, 3, 3]);
  });

  it("should have two remaining moves for non-doubles", () => {
    const dice = rollDice([4, 2]);
    expect(dice.remaining).toEqual([4, 2]);
  });

  it("should accept forced dice values", () => {
    const dice = rollDice([5, 1]);
    expect(dice.values).toEqual([5, 1]);
    expect(dice.remaining).toEqual([5, 1]);
  });
});

describe("getDiceMoveCounts", () => {
  it("should return both values for non-doubles", () => {
    expect(getDiceMoveCounts([3, 5])).toEqual([3, 5]);
  });

  it("should return four of the same for doubles", () => {
    expect(getDiceMoveCounts([6, 6])).toEqual([6, 6, 6, 6]);
  });

  it("should handle all possible double values", () => {
    for (let i = 1; i <= 6; i++) {
      const result = getDiceMoveCounts([i, i] as [number, number]);
      expect(result).toHaveLength(4);
      expect(result.every((v) => v === i)).toBe(true);
    }
  });
});

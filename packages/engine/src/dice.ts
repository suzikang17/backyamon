import type { Dice } from "./types.js";

export function rollDice(forced?: [number, number]): Dice {
  const values: [number, number] = forced ?? [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  const remaining = getDiceMoveCounts(values);
  return { values, remaining };
}

export function getDiceMoveCounts(values: [number, number]): number[] {
  if (values[0] === values[1]) {
    return [values[0], values[0], values[0], values[0]];
  }
  return [values[0], values[1]];
}

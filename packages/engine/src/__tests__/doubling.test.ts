import { describe, it, expect } from "vitest";
import {
  canOfferDouble,
  offerDouble,
  acceptDouble,
  declineDouble,
} from "../doubling";
import { createInitialState } from "../state";
import { Player } from "../types";
import { rollDice } from "../dice";

describe("canOfferDouble", () => {
  it("should allow doubling before rolling when cube is centered", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    expect(canOfferDouble(state)).toBe(true);
  });

  it("should not allow doubling during MOVING phase", () => {
    const state = createInitialState();
    state.phase = "MOVING";
    state.dice = rollDice([3, 1]);
    expect(canOfferDouble(state)).toBe(false);
  });

  it("should not allow doubling during GAME_OVER phase", () => {
    const state = createInitialState();
    state.phase = "GAME_OVER";
    expect(canOfferDouble(state)).toBe(false);
  });

  it("should allow doubling when current player owns the cube", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    state.doublingCube = { value: 2, owner: Player.Gold };
    state.currentPlayer = Player.Gold;
    expect(canOfferDouble(state)).toBe(true);
  });

  it("should not allow doubling when opponent owns the cube", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    state.doublingCube = { value: 2, owner: Player.Red };
    state.currentPlayer = Player.Gold;
    expect(canOfferDouble(state)).toBe(false);
  });

  it("should not allow doubling during Crawford game", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    state.isCrawford = true;
    expect(canOfferDouble(state)).toBe(false);
  });
});

describe("offerDouble", () => {
  it("should transition to awaiting double response", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    const newState = offerDouble(state);
    expect(newState.phase).toBe("DOUBLING");
  });

  it("should not mutate original state", () => {
    const state = createInitialState();
    state.phase = "ROLLING";
    offerDouble(state);
    expect(state.phase).toBe("ROLLING");
  });
});

describe("acceptDouble", () => {
  it("should double the cube value", () => {
    const state = createInitialState();
    state.phase = "DOUBLING" as any;
    state.doublingCube = { value: 1, owner: null };
    const newState = acceptDouble(state);
    expect(newState.doublingCube.value).toBe(2);
  });

  it("should transfer cube ownership to the accepting player (opponent)", () => {
    const state = createInitialState();
    state.currentPlayer = Player.Gold; // Gold offered the double
    state.phase = "DOUBLING" as any;
    state.doublingCube = { value: 1, owner: null };
    const newState = acceptDouble(state);
    expect(newState.doublingCube.owner).toBe(Player.Red); // Red accepts
  });

  it("should return to ROLLING phase after accepting", () => {
    const state = createInitialState();
    state.phase = "DOUBLING" as any;
    const newState = acceptDouble(state);
    expect(newState.phase).toBe("ROLLING");
  });

  it("should correctly double from 2 to 4", () => {
    const state = createInitialState();
    state.phase = "DOUBLING" as any;
    state.doublingCube = { value: 2, owner: Player.Gold };
    state.currentPlayer = Player.Gold;
    const newState = acceptDouble(state);
    expect(newState.doublingCube.value).toBe(4);
    expect(newState.doublingCube.owner).toBe(Player.Red);
  });
});

describe("declineDouble", () => {
  it("should end the game with the doubling player winning", () => {
    const state = createInitialState();
    state.currentPlayer = Player.Gold;
    state.phase = "DOUBLING" as any;
    const newState = declineDouble(state);
    expect(newState.phase).toBe("GAME_OVER");
    expect(newState.winner).toBe(Player.Gold); // Gold offered, Red declined -> Gold wins
  });

  it("should win at current cube value (before the proposed double)", () => {
    const state = createInitialState();
    state.currentPlayer = Player.Gold;
    state.phase = "DOUBLING" as any;
    state.doublingCube = { value: 2, owner: Player.Gold };
    const newState = declineDouble(state);
    expect(newState.winner).toBe(Player.Gold);
    // Cube value should remain at 2 (the current stake, not the proposed 4)
    expect(newState.doublingCube.value).toBe(2);
  });

  it("should not mutate original state", () => {
    const state = createInitialState();
    state.currentPlayer = Player.Gold;
    state.phase = "DOUBLING" as any;
    declineDouble(state);
    expect(state.phase).not.toBe("GAME_OVER");
  });
});

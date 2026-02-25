# Backgammon Rules Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three missing backgammon rules: opening roll ceremony, must-use-higher-die, and must-maximize-dice-usage.

**Architecture:** Extract constrained move logic from `getAllLegalTurns()` (already correct for AI) into a reusable `getConstrainedMoves()` function, then use it for human move validation in both singleplayer and multiplayer. Add a new `OPENING_ROLL` game phase with a roll-off ceremony before the first turn.

**Tech Stack:** TypeScript, vitest, PixiJS, Socket.io

---

### Task 1: Add `rollSingleDie()` to engine

**Files:**
- Modify: `packages/engine/src/dice.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/src/__tests__/dice.test.ts`

**Step 1: Write the failing test**

Add to `dice.test.ts`:

```typescript
describe("rollSingleDie", () => {
  it("should return a value between 1 and 6", () => {
    for (let i = 0; i < 100; i++) {
      const value = rollSingleDie();
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });

  it("should accept a forced value", () => {
    expect(rollSingleDie(4)).toBe(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/dice.test.ts`
Expected: FAIL with "rollSingleDie is not a function"

**Step 3: Write minimal implementation**

Add to `dice.ts`:

```typescript
export function rollSingleDie(forced?: number): number {
  return forced ?? Math.floor(Math.random() * 6) + 1;
}
```

Update `index.ts` — `rollSingleDie` is auto-exported via `export * from "./dice.js"`.

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && npx vitest run src/__tests__/dice.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/dice.ts packages/engine/src/__tests__/dice.test.ts
git commit -m "feat(engine): add rollSingleDie for opening roll ceremony"
```

---

### Task 2: Add `getConstrainedMoves()` to engine

This is the key function that enforces must-use-higher-die and must-maximize-dice-usage for human players. It wraps `getAllLegalTurns()` to extract only the first moves that lead to maximal dice usage.

**Files:**
- Create: `packages/engine/src/constrained-moves.ts`
- Modify: `packages/engine/src/index.ts`
- Create: `packages/engine/src/__tests__/constrained-moves.test.ts`

**Step 1: Write the failing tests**

Create `packages/engine/src/__tests__/constrained-moves.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getConstrainedMoves } from "../constrained-moves";
import { createInitialState } from "../state";
import { applyMove } from "../moves";
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
    // Set up a position where die 5 can be used but die 2 cannot (after using 5)
    // and die 2 can be used but die 5 cannot (after using 2)
    // In this case, must use die 5 (the higher one)
    const state = createInitialState();
    state.points = state.points.map(() => null);
    // Gold has one piece on point 1 (idx 0)
    state.points[0] = { player: Player.Gold, count: 1 };
    // Block point 3 (idx 2) with Red so die-2 landing is blocked
    // Block point 6 (idx 5) would block die-5...
    // Actually let's make a clear scenario:
    // Gold piece on idx 0, dice [5, 2]
    // Point idx 2 (die 2 target) is open
    // Point idx 5 (die 5 target) is open
    // Point idx 7 (idx 2 + 5) is blocked, point idx 7 (idx 5 + 2) is blocked
    // So only one die can be used, must be the higher (5)
    state.points[7] = { player: Player.Red, count: 2 }; // blocks second move for both sequences
    state.dice = rollDice([5, 2]);
    state.phase = "MOVING";

    const moves = getConstrainedMoves(state);
    // Should only allow move from 0 to 5 (using die 5), not 0 to 2 (using die 2)
    const movesUsing5 = moves.filter(m => m.from === 0 && m.to === 5);
    const movesUsing2 = moves.filter(m => m.from === 0 && m.to === 2);
    expect(movesUsing5.length).toBe(1);
    expect(movesUsing2.length).toBe(0);
  });

  it("should only allow moves that lead to using both dice when possible", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    // Gold piece on idx 0
    state.points[0] = { player: Player.Gold, count: 1 };
    // Open path: idx 0 -> idx 3 (die 3) -> idx 4 (die 1) works
    // Open path: idx 0 -> idx 1 (die 1) -> idx 4 (die 3) works
    // Both use both dice, so both first moves should be allowed
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";

    const moves = getConstrainedMoves(state);
    expect(moves).toContainEqual({ from: 0, to: 3 });
    expect(moves).toContainEqual({ from: 0, to: 1 });
  });

  it("should exclude first moves that waste a die when alternatives use both", () => {
    const state = createInitialState();
    state.points = state.points.map(() => null);
    // Gold has pieces on idx 0 and idx 10
    state.points[0] = { player: Player.Gold, count: 1 };
    state.points[10] = { player: Player.Gold, count: 1 };
    state.dice = rollDice([3, 1]);
    state.phase = "MOVING";
    // Block idx 3 so 0->3 is not possible, but 0->1 is
    // Then 0->1 + 10->13 uses both dice
    state.points[3] = { player: Player.Red, count: 2 };
    // Also block idx 1+3=4 so that 0->1 then 1->4 doesn't work either
    // But 10->11 and 10->13 should be open

    const moves = getConstrainedMoves(state);
    // All returned moves should appear in some 2-move turn
    expect(moves.length).toBeGreaterThan(0);
    // Every move should be part of a maximal turn
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/constrained-moves.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

Create `packages/engine/src/constrained-moves.ts`:

```typescript
import type { GameState, Move } from "./types.js";
import { getAllLegalTurns } from "./ai/turn-generator.js";

/**
 * Get legal moves constrained by backgammon rules:
 * - Must maximize dice usage (use both dice if possible)
 * - If only one die can be used, must use the higher die
 *
 * Returns only first-moves from maximal-length turns. After a human
 * plays one of these moves, call again on the new state to get the
 * next set of constrained moves.
 */
export function getConstrainedMoves(state: GameState): Move[] {
  const allTurns = getAllLegalTurns(state);

  // If no turns or only empty turns, no moves available
  if (allTurns.length === 0 || (allTurns.length === 1 && allTurns[0].length === 0)) {
    return [];
  }

  // Extract unique first moves from the (already filtered) legal turns
  const seen = new Set<string>();
  const moves: Move[] = [];

  for (const turn of allTurns) {
    if (turn.length === 0) continue;
    const first = turn[0];
    const key = `${first.from}:${first.to}`;
    if (!seen.has(key)) {
      seen.add(key);
      moves.push(first);
    }
  }

  return moves;
}
```

Add to `packages/engine/src/index.ts`:

```typescript
export { getConstrainedMoves } from "./constrained-moves.js";
```

**Step 4: Run test to verify it passes**

Run: `cd packages/engine && npx vitest run src/__tests__/constrained-moves.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/engine/src/constrained-moves.ts packages/engine/src/__tests__/constrained-moves.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): add getConstrainedMoves for must-use-higher-die and must-maximize-dice"
```

---

### Task 3: Add `OPENING_ROLL` phase to types and state

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/state.ts`

**Step 1: Add OPENING_ROLL phase**

In `types.ts`, change:
```typescript
export type GamePhase =
  | "OPENING_ROLL"
  | "ROLLING"
  | "MOVING"
  | "DOUBLING"
  | "CHECKING_WIN"
  | "GAME_OVER";
```

**Step 2: Update `createInitialState()`**

In `state.ts`, change `phase: "ROLLING"` to `phase: "OPENING_ROLL"`.

Also remove the hardcoded `currentPlayer: Player.Gold` — set to `Player.Gold` as placeholder but the opening roll will determine who goes first.

**Step 3: Run existing tests to verify nothing breaks**

Run: `cd packages/engine && npx vitest run`
Expected: PASS (existing tests set phase explicitly, so changing the default won't break them)

**Step 4: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/state.ts
git commit -m "feat(engine): add OPENING_ROLL phase for opening roll ceremony"
```

---

### Task 4: Implement opening roll in singleplayer `GameController`

**Files:**
- Modify: `apps/web/src/game/GameController.ts`

**Step 1: Update `startGame()` to begin with opening roll**

Replace the `startGame()` method to show an opening roll ceremony instead of immediately starting Gold's turn:

```typescript
startGame(): void {
  this.initRenderers(PIECE_SETS[this.difficulty]);

  this.state = createInitialState();
  this.sound.setMusicStyle(DIFFICULTY_MUSIC[this.difficulty]);
  this.sound.startMusic();
  this.sound.updateMood(this.state);

  // Spoken greeting
  const greeting = greetingMessage();
  this.sound.speak(greeting);

  // Render initial board
  this.pieceRenderer.render(this.state);
  this.emitStateChange();

  // Start opening roll ceremony
  this.doOpeningRoll();
}
```

**Step 2: Add opening roll method**

```typescript
private async doOpeningRoll(): Promise<void> {
  if (this.destroyed) return;

  this.onMessage?.("Opening roll - click to roll!");
  this.onWaitingForRoll?.(true);
}
```

**Step 3: Update `rollForHuman()` to handle OPENING_ROLL phase**

```typescript
rollForHuman(): void {
  if (this.destroyed) return;
  if (this.state.phase === "OPENING_ROLL") {
    this.sound.resumeContext();
    this.performOpeningRoll();
    return;
  }
  if (this.state.phase !== "ROLLING") return;
  if (this.state.currentPlayer !== Player.Gold) return;

  this.sound.resumeContext();
  this.doHumanRoll();
}
```

**Step 4: Add `performOpeningRoll()` method**

```typescript
private async performOpeningRoll(): Promise<void> {
  if (this.destroyed) return;
  this.onWaitingForRoll?.(false);

  // Roll one die for each player, re-roll on ties
  let goldDie: number;
  let redDie: number;

  do {
    goldDie = rollSingleDie();
    redDie = rollSingleDie();

    // Show both dice using a combined Dice object for animation
    const openingDice = rollDice([goldDie, redDie]);
    this.storeDiceValues(openingDice);
    this.sound.playSFX("dice-roll");
    await this.diceRenderer.showRoll(openingDice);
    if (this.destroyed) return;

    if (goldDie === redDie) {
      this.onMessage?.(`Tied ${goldDie}-${redDie}! Roll again...`);
      await this.delay(1200);
      if (this.destroyed) return;
    }
  } while (goldDie === redDie);

  // Determine who goes first
  const firstPlayer = goldDie > redDie ? Player.Gold : Player.Red;
  this.state = {
    ...this.state,
    currentPlayer: firstPlayer,
    dice: rollDice([Math.max(goldDie, redDie), Math.min(goldDie, redDie)]),
    phase: "MOVING",
  };
  this.emitStateChange();

  if (firstPlayer === Player.Gold) {
    this.onMessage?.(`You rolled ${goldDie} vs ${redDie} - you go first!`);
    await this.delay(800);
    if (this.destroyed) return;
    this.enableHumanInput();
  } else {
    this.onMessage?.(`${this.ai.name} rolled ${redDie} vs ${goldDie} - they go first!`);
    await this.delay(800);
    if (this.destroyed) return;
    this.diceRenderer.hide();
    this.startAIFirstTurn();
  }
}
```

**Step 5: Add `startAIFirstTurn()` for when AI wins the opening roll**

```typescript
private async startAIFirstTurn(): Promise<void> {
  if (this.destroyed) return;

  // AI already has dice from opening roll, just needs to play moves
  const thinkMsg = aiThinkingMessage(this.ai.name);
  this.onMessage?.(thinkMsg);
  this.sound.speak(thinkMsg, 1.0);

  await this.delay(500);
  if (this.destroyed) return;

  // Show the opening dice again for the AI's turn
  this.sound.playSFX("dice-roll");
  await this.diceRenderer.showRoll(this.state.dice!);
  if (this.destroyed) return;

  // AI selects moves with the opening dice
  const moves = this.ai.selectMoves(this.state);

  if (moves.length === 0) {
    this.onMessage?.(aiNoMovesMessage(this.ai.name));
    await this.delay(800);
    if (this.destroyed) return;
    this.diceRenderer.hide();
    this.endCurrentTurn();
    return;
  }

  // Animate each AI move (same as startAITurn but without rolling new dice)
  for (let i = 0; i < moves.length; i++) {
    if (this.destroyed) return;
    const move = moves[i];
    this.playMoveSFX(move);
    this.state = applyMove(this.state, move);
    this.emitStateChange();

    if (this.state.dice) {
      this.diceRenderer.updateUsedDice(this.currentDiceValues, this.state.dice.remaining);
    }

    await this.pieceRenderer.animateMove(move, Player.Red);
    if (this.destroyed) return;
    this.spawnLandingDust(move, Player.Red);
    this.moveLineRenderer.showOpponentMove(move, Player.Red);
    this.pieceRenderer.render(this.state);

    if (i < moves.length - 1) {
      await this.delay(400);
    }
  }

  if (this.destroyed) return;
  this.onMessage?.("");
  this.diceRenderer.hide();
  this.endCurrentTurn();
}
```

**Step 6: Add `rollSingleDie` import**

Add `rollSingleDie` to the import from `@backyamon/engine`.

**Step 7: Test manually in browser**

Run: `cd apps/web && npm run dev`
Expected: Game starts with opening roll ceremony. Each player rolls 1 die. Higher die goes first using both dice.

**Step 8: Commit**

```bash
git add apps/web/src/game/GameController.ts
git commit -m "feat(web): implement opening roll ceremony in singleplayer"
```

---

### Task 5: Implement opening roll in multiplayer (server + client)

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/game/OnlineGameController.ts`

**Step 1: Update server dice rolling for OPENING_ROLL phase**

In the server's `roll-dice` handler, add opening roll support before the normal roll logic:

```typescript
// Handle opening roll
if (state.phase === "OPENING_ROLL") {
  const goldDie = rollSingleDie();
  const redDie = rollSingleDie();

  if (goldDie === redDie) {
    // Tied - broadcast and let them roll again
    broadcastToRoom(room, "opening-roll-tied", { goldDie, redDie });
    return;
  }

  const firstPlayer = goldDie > redDie ? Player.Gold : Player.Red;
  state.currentPlayer = firstPlayer;
  state.dice = rollDice([Math.max(goldDie, redDie), Math.min(goldDie, redDie)]);
  state.phase = "MOVING";
  room.state = state;

  // Check if first player can move
  if (!canMove(state)) {
    room.state = endTurn(state);
    broadcastToRoom(room, "opening-roll-result", {
      goldDie, redDie, firstPlayer,
      dice: state.dice,
    });
    broadcastToRoom(room, "turn-ended", {
      state: room.state,
      currentPlayer: room.state.currentPlayer,
    });
    if (room.state.phase === "GAME_OVER") handleGameOver(room);
    return;
  }

  broadcastToRoom(room, "opening-roll-result", {
    goldDie, redDie, firstPlayer,
    dice: state.dice,
  });
  return;
}
```

Also: either player can trigger the opening roll (remove the "it's not your turn" check when phase is OPENING_ROLL), OR designate Gold as the one to trigger it.

**Step 2: Update OnlineGameController for opening roll events**

Add handlers in `bindServerEvents()`:

```typescript
bind("opening-roll-tied", (data: unknown) => {
  this.handleOpeningRollTied(data as { goldDie: number; redDie: number });
});

bind("opening-roll-result", (data: unknown) => {
  this.handleOpeningRollResult(data as {
    goldDie: number; redDie: number;
    firstPlayer: Player; dice: Dice;
  });
});
```

Add handlers:

```typescript
private async handleOpeningRollTied(data: { goldDie: number; redDie: number }): Promise<void> {
  if (this.destroyed) return;
  this.sound.playSFX("dice-roll");
  const openingDice = rollDice([data.goldDie, data.redDie]);
  this.storeDiceValues(openingDice);
  await this.diceRenderer.showRoll(openingDice);
  if (this.destroyed) return;
  this.onMessage?.(`Tied ${data.goldDie}-${data.redDie}! Roll again...`);
  // Re-enable roll button after delay
  setTimeout(() => {
    if (this.destroyed) return;
    this.onWaitingForRoll?.(true);
    this.onMessage?.("Opening roll - click to roll!");
  }, 1500);
}

private async handleOpeningRollResult(data: {
  goldDie: number; redDie: number;
  firstPlayer: Player; dice: Dice;
}): Promise<void> {
  if (this.destroyed) return;
  this.sound.playSFX("dice-roll");
  const openingDice = rollDice([data.goldDie, data.redDie]);
  this.storeDiceValues(openingDice);
  await this.diceRenderer.showRoll(openingDice);
  if (this.destroyed) return;

  this.state = { ...this.state, currentPlayer: data.firstPlayer, dice: data.dice, phase: "MOVING" };
  this.storeDiceValues(data.dice);
  this.emitStateChange();

  const isLocal = data.firstPlayer === this.localPlayer;
  const myDie = this.localPlayer === Player.Gold ? data.goldDie : data.redDie;
  const theirDie = this.localPlayer === Player.Gold ? data.redDie : data.goldDie;

  if (isLocal) {
    this.onMessage?.(`You rolled ${myDie} vs ${theirDie} - you go first!`);
    setTimeout(() => {
      if (this.destroyed) return;
      this.enableLocalInput();
    }, 800);
  } else {
    this.onMessage?.(`Opponent rolled ${theirDie} vs ${myDie} - they go first`);
  }
}
```

**Step 3: Update `startGame()` and `rollForHuman()` to handle OPENING_ROLL**

In `startGame()`:
```typescript
// If phase is OPENING_ROLL, prompt for opening roll
if (this.state.phase === "OPENING_ROLL") {
  this.onWaitingForRoll?.(true);
  this.onMessage?.("Opening roll - click to roll!");
}
```

In `rollForHuman()`:
```typescript
rollForHuman(): void {
  if (this.destroyed) return;
  if (this.state.phase === "OPENING_ROLL") {
    this.onWaitingForRoll?.(false);
    this.onMessage?.("Rolling...");
    this.socketClient.rollDice();
    return;
  }
  // ... existing ROLLING phase logic
}
```

**Step 4: Add `rollSingleDie` import in server**

Add `rollSingleDie` to the server's import from `@backyamon/engine`.

**Step 5: Test multiplayer opening roll**

Run both server and web app, create a room, verify opening roll works.

**Step 6: Commit**

```bash
git add apps/server/src/index.ts apps/web/src/game/OnlineGameController.ts
git commit -m "feat(server+web): implement opening roll ceremony in multiplayer"
```

---

### Task 6: Use constrained moves in singleplayer `GameController`

**Files:**
- Modify: `apps/web/src/game/GameController.ts`

**Step 1: Import `getConstrainedMoves`**

Add `getConstrainedMoves` to the import from `@backyamon/engine`.

**Step 2: Replace `getLegalMoves` with `getConstrainedMoves` in human input paths**

In `doHumanRoll()`, change:
```typescript
const legalMoves = getLegalMoves(this.state);
```
to:
```typescript
const legalMoves = getConstrainedMoves(this.state);
```

In `enableHumanInput()`, change:
```typescript
const legalMoves = getLegalMoves(this.state);
```
to:
```typescript
const legalMoves = getConstrainedMoves(this.state);
```

Keep `getLegalMoves` for the `canMove()` check and for AI turn logic (AI already uses `getAllLegalTurns()` internally via `selectMoves()`).

**Step 3: Test manually**

Play a singleplayer game. Verify that when only one die can be used, only moves using the higher die are shown. Verify that moves which would waste a die (when both could be used) are not available.

**Step 4: Commit**

```bash
git add apps/web/src/game/GameController.ts
git commit -m "feat(web): enforce constrained moves for human player in singleplayer"
```

---

### Task 7: Use constrained moves in multiplayer server

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/game/OnlineGameController.ts`

**Step 1: Import `getConstrainedMoves` in server**

Add `getConstrainedMoves` to server import from `@backyamon/engine`.

**Step 2: Replace move validation in server's `make-move` handler**

Change:
```typescript
const legalMoves = getLegalMoves(state);
```
to:
```typescript
const legalMoves = getConstrainedMoves(state);
```

This ensures the server validates against constrained moves, preventing clients from making illegal moves.

**Step 3: Update OnlineGameController to use constrained moves for input**

In `enableLocalInput()`, change:
```typescript
const legalMoves = getLegalMoves(this.state);
```
to:
```typescript
const legalMoves = getConstrainedMoves(this.state);
```

**Step 4: Add import**

Add `getConstrainedMoves` to OnlineGameController's import from `@backyamon/engine`.

**Step 5: Test multiplayer**

Play an online game. Verify constrained moves are enforced both client-side (input) and server-side (validation).

**Step 6: Commit**

```bash
git add apps/server/src/index.ts apps/web/src/game/OnlineGameController.ts
git commit -m "feat(server+web): enforce constrained moves in multiplayer"
```

---

### Task 8: Final integration check

**Step 1: Run all engine tests**

Run: `cd packages/engine && npx vitest run`
Expected: All tests pass

**Step 2: Run build**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

**Step 3: Manual smoke test**

- Start singleplayer game: opening roll ceremony works
- Both dice rules enforced during play
- Start multiplayer game: opening roll ceremony works
- Both dice rules enforced during play

**Step 4: Commit all and push**

```bash
git push origin main
```

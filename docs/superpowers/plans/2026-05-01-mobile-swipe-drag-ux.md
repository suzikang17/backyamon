# Mobile Swipe & Drag UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add swipe-to-roll and drag-die-to-piece gestures to the mobile game experience, with a dedicated dice tray below the board and an illustrated dice cup animation.

**Architecture:** Extend the PixiJS canvas height to include a tray area below the board. The board renders at 8:5 ratio in the top portion; the tray occupies the remaining ~13% height. `DiceRenderer` owns the tray: cup animation when waiting to roll, large pip dice after rolling. `InputHandler` owns gesture detection: swipe anywhere on the board area to roll, drag a die onto a piece to execute that move.

**Tech Stack:** PixiJS 8 (rendering + ticker animation), TypeScript, React (canvas container sizing only), `@backyamon/engine` (move/state types)

**Spec:** `docs/superpowers/specs/2026-05-01-mobile-swipe-drag-ux-design.md`

---

## File Map

| File | What changes |
|------|-------------|
| `apps/web/src/game/BoardRenderer.ts` | Add `getBoardHeight()` getter |
| `apps/web/src/game/DiceRenderer.ts` | Add `trayHeight` param; tray positioning; larger dice; `showCup()`/`hideCup()`; `getDieInfo()`/`snapDieBack()`; store `dieValues`/`dieOrigPositions` |
| `apps/web/src/game/MoveLineRenderer.ts` | Export `computeDieValue` (currently module-private) |
| `apps/web/src/game/InputHandler.ts` | Add `enableSwipeToRoll()`/`disableSwipeToRoll()`; `setDiceRenderer()`; `enableDieDrag()`/`disableDieDrag()`; `getEligiblePieceAtPosition()` |
| `apps/web/src/game/BaseGameController.ts` | Pass `trayHeight` to `DiceRenderer` in `initRenderers()`; call `inputHandler.setDiceRenderer()` |
| `apps/web/src/game/GameController.ts` | Add `setWaitingForRoll()` helper; replace all `onWaitingForRoll?.(true/false)` calls; call `enableDieDrag()` in `enableHumanInput()` |
| `apps/web/src/game/OnlineGameController.ts` | Same `setWaitingForRoll()` pattern |
| `apps/web/src/components/GameCanvas.tsx` | Compute `trayHeight`; add it to canvas `height`; remove `aspect-[8/5]` |
| `apps/web/src/components/OnlineGameCanvas.tsx` | Same canvas height changes |

---

## Task 1: Extend canvas to include tray area

**Files:**
- Modify: `apps/web/src/game/BoardRenderer.ts`
- Modify: `apps/web/src/game/DiceRenderer.ts`
- Modify: `apps/web/src/game/BaseGameController.ts`
- Modify: `apps/web/src/components/GameCanvas.tsx`
- Modify: `apps/web/src/components/OnlineGameCanvas.tsx`

- [ ] **Step 1: Add `getBoardHeight()` to `BoardRenderer`**

In `apps/web/src/game/BoardRenderer.ts`, add this getter alongside the other getters near line 498:

```typescript
getBoardHeight(): number {
  return this.boardHeight;
}
```

- [ ] **Step 2: Update `DiceRenderer` constructor to accept `trayHeight`**

In `apps/web/src/game/DiceRenderer.ts`, change:

```typescript
// Old:
export class DiceRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private container: Container;
  private dieContainers: Container[] = [];
  private dieSize: number;

  constructor(app: Application, boardRenderer: BoardRenderer) {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.container = new Container();
    this.container.zIndex = 500;
    app.stage.addChild(this.container);
    this.dieSize = Math.floor(boardRenderer.getPieceRadius() * 2.2);
  }
```

To:

```typescript
export class DiceRenderer {
  private app: Application;
  private boardRenderer: BoardRenderer;
  private container: Container;
  private dieContainers: Container[] = [];
  private dieValues: number[] = [];
  private dieOrigPositions: { x: number; y: number }[] = [];
  private dieSize: number;
  private trayHeight: number;

  constructor(app: Application, boardRenderer: BoardRenderer, trayHeight: number) {
    this.app = app;
    this.boardRenderer = boardRenderer;
    this.trayHeight = trayHeight;
    this.container = new Container();
    this.container.zIndex = 500;
    app.stage.addChild(this.container);
    this.dieSize = Math.max(Math.floor(boardRenderer.getPieceRadius() * 3), 40);
  }

  private getTrayCenter(): { x: number; y: number } {
    const boardH = this.boardRenderer.getBoardHeight();
    const bounds = this.boardRenderer.getPlayAreaBounds();
    return {
      x: bounds.x + bounds.width / 2,
      y: boardH + this.trayHeight / 2,
    };
  }
```

- [ ] **Step 3: Update `BaseGameController.initRenderers()` to derive and pass `trayHeight`**

In `apps/web/src/game/BaseGameController.ts`, change `initRenderers`:

```typescript
protected initRenderers(pieceSet?: PieceSet): void {
  const w = this.app.screen.width;
  const h = this.app.screen.height;
  // Board occupies top 8:5 portion; tray is the rest
  const boardH = Math.floor(w / (8 / 5));
  const trayH = h - boardH;

  this.boardRenderer = new BoardRenderer(this.app, w, boardH);
  this.ambienceLayer = new AmbienceLayer(this.app, w, boardH);
  this.pieceRenderer = new PieceRenderer(this.app, this.boardRenderer, pieceSet);
  this.diceRenderer = new DiceRenderer(this.app, this.boardRenderer, trayH);
  this.moveLineRenderer = new MoveLineRenderer(this.app, this.boardRenderer);
  this.inputHandler = new InputHandler(
    this.app,
    this.boardRenderer,
    this.pieceRenderer,
    this.moveLineRenderer
  );
}
```

- [ ] **Step 4: Update `GameCanvas.tsx` canvas sizing**

In `apps/web/src/components/GameCanvas.tsx`, inside `init()`, change:

```typescript
// Old:
const width = Math.floor(rect.width);
const aspectRatio = 8 / 5;
const height = Math.floor(width / aspectRatio);
```

To:

```typescript
const width = Math.floor(rect.width);
const boardHeight = Math.floor(width / (8 / 5));
const trayHeight = Math.round(boardHeight * 0.13);
const height = boardHeight + trayHeight;
```

Also update canvas style (same variables, no change to `canvas.style.width/height` assignment — they already use `width` and `height`).

Remove `aspect-[8/5]` from the container div JSX. The div will size to its canvas child naturally:

```tsx
// Old:
<div
  ref={containerRef}
  className="w-full aspect-[8/5] rounded-2xl border-2 border-[#8B4513] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
  onClick={handleRollClick}
  style={{ cursor: waitingForRoll ? "pointer" : "default", touchAction: "manipulation" }}
/>

// New:
<div
  ref={containerRef}
  className="w-full rounded-2xl border-2 border-[#8B4513] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
  onClick={handleRollClick}
  style={{ cursor: waitingForRoll ? "pointer" : "default", touchAction: "manipulation" }}
/>
```

- [ ] **Step 5: Apply the same canvas sizing changes to `OnlineGameCanvas.tsx`**

In `apps/web/src/components/OnlineGameCanvas.tsx`, apply the identical changes as Step 4 (same `boardHeight`/`trayHeight` calculation; remove `aspect-[8/5]` from container div).

- [ ] **Step 6: Verify the canvas renders correctly**

Run: `cd apps/web && npm run dev`

Open the game in browser. Expected:
- The canvas is taller than before (~13% extra height below the board)
- Board visuals are identical
- A dark strip appears below the board (the empty tray area — `backgroundColor: 0x2a2a1e`)
- No layout shifts or console errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/game/BoardRenderer.ts apps/web/src/game/DiceRenderer.ts apps/web/src/game/BaseGameController.ts apps/web/src/components/GameCanvas.tsx apps/web/src/components/OnlineGameCanvas.tsx
git commit -m "feat: extend canvas to include dice tray area below board"
```

---

## Task 2: Move pip dice into tray (post-roll positioning + larger size)

**Files:**
- Modify: `apps/web/src/game/DiceRenderer.ts`

- [ ] **Step 1: Update `showRoll()` to use tray positioning and store original positions**

In `apps/web/src/game/DiceRenderer.ts`, replace the `showRoll` method:

```typescript
async showRoll(dice: Dice): Promise<void> {
  this.hide();

  const center = this.getTrayCenter();
  const gap = this.dieSize * 0.3;
  const totalWidth = 2 * this.dieSize + gap;
  const startX = center.x - totalWidth / 2 + this.dieSize / 2;

  this.dieValues = [dice.values[0], dice.values[1]];
  this.dieOrigPositions = [];

  for (let i = 0; i < 2; i++) {
    const die = this.createDie(dice.values[i]);
    die.x = startX + i * (this.dieSize + gap);
    die.y = center.y;
    die.eventMode = "static";
    this.dieOrigPositions.push({ x: die.x, y: die.y });
    this.container.addChild(die);
    this.dieContainers.push(die);
  }

  await this.animateRoll();
}
```

- [ ] **Step 2: Add `getDieInfo()` and `snapDieBack()` methods**

Add these two methods to `DiceRenderer` after the `hide()` method:

```typescript
/** Returns draggable info for each die currently in the tray. */
getDieInfo(): Array<{ container: Container; value: number; origX: number; origY: number }> {
  return this.dieContainers.map((c, i) => ({
    container: c,
    value: this.dieValues[i] ?? 0,
    origX: this.dieOrigPositions[i]?.x ?? 0,
    origY: this.dieOrigPositions[i]?.y ?? 0,
  }));
}

/** Animate a die back to its resting tray position. */
snapDieBack(index: number): Promise<void> {
  const die = this.dieContainers[index];
  const orig = this.dieOrigPositions[index];
  if (!die || !orig) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const startX = die.x;
    const startY = die.y;
    const startScale = die.scale.x;
    const startTime = performance.now();
    const duration = 200;

    const tick = () => {
      const t = Math.min((performance.now() - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      die.x = startX + (orig.x - startX) * ease;
      die.y = startY + (orig.y - startY) * ease;
      die.scale.set(startScale + (1 - startScale) * ease);
      if (t >= 1) {
        this.app.ticker.remove(tick);
        die.zIndex = 0;
        resolve();
      }
    };
    this.app.ticker.add(tick);
  });
}
```

- [ ] **Step 3: Verify dice appear in tray after rolling**

Start dev server if not running. Roll dice in game. Expected:
- After roll animation, both dice appear in the dark tray strip below the board
- Dice are noticeably larger than before (~40px minimum, previously ~22px on mobile)
- Pip layout (1-6 dots) is correct
- Used-dice dimming still works when pieces are moved

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/game/DiceRenderer.ts
git commit -m "feat: move rolled dice into tray with larger touch-friendly size"
```

---

## Task 3: Dice cup animation in tray

**Files:**
- Modify: `apps/web/src/game/DiceRenderer.ts`
- Modify: `apps/web/src/game/GameController.ts`
- Modify: `apps/web/src/game/OnlineGameController.ts`

- [ ] **Step 1: Add cup state fields to `DiceRenderer`**

In `DiceRenderer`, add these private fields after `dieOrigPositions`:

```typescript
private cupContainer: Container | null = null;
private cupTickFn: ((dt: unknown) => void) | null = null;
```

- [ ] **Step 2: Add `showCup()` method to `DiceRenderer`**

Add after the `getTrayCenter()` method:

```typescript
showCup(): void {
  this.hideCup();

  const center = this.getTrayCenter();
  const cupH = Math.min(this.trayHeight * 0.85, this.dieSize * 1.6);
  const cupW = cupH * 0.72;
  const hw = cupW / 2;
  const rimH = cupH * 0.2;

  this.cupContainer = new Container();
  this.cupContainer.x = center.x;
  this.cupContainer.y = center.y;
  this.cupContainer.zIndex = 520;

  const g = new Graphics();

  // Cup body (trapezoid)
  g.moveTo(-hw * 0.9, -cupH / 2 + rimH)
    .lineTo(hw * 0.9, -cupH / 2 + rimH)
    .lineTo(hw * 0.65, cupH / 2)
    .quadraticCurveTo(0, cupH / 2 + cupH * 0.05, -hw * 0.65, cupH / 2)
    .closePath()
    .fill({ color: 0x7a3c10 })
    .stroke({ color: 0x4a2008, width: 2 });

  // Leather rim
  g.roundRect(-hw, -cupH / 2, cupW, rimH * 1.1, 4)
    .fill({ color: 0x9a5020 })
    .stroke({ color: 0x7a3c10, width: 1.5 });

  // Leather strap band
  const bandY = -cupH / 2 + rimH + cupH * 0.35;
  g.rect(-hw * 0.8, bandY, cupW * 0.8, cupH * 0.07)
    .fill({ color: 0x4a2008, alpha: 0.55 });

  this.cupContainer.addChild(g);

  // Two small dice peeking above rim
  const miniScale = 0.5;
  for (let i = 0; i < 2; i++) {
    const miniDie = this.createDie(i === 0 ? 1 : 6);
    miniDie.scale.set(miniScale);
    miniDie.x = (i === 0 ? -1 : 1) * hw * 0.28;
    miniDie.y = -cupH / 2 - this.dieSize * miniScale * 0.25;
    this.cupContainer.addChild(miniDie);
  }

  this.container.addChild(this.cupContainer);

  // Gentle wobble
  const startTime = performance.now();
  this.cupTickFn = () => {
    if (!this.cupContainer) return;
    const t = (performance.now() - startTime) / 900;
    this.cupContainer.rotation = Math.sin(t * Math.PI * 2) * (8 * Math.PI / 180);
  };
  this.app.ticker.add(this.cupTickFn);
}
```

- [ ] **Step 3: Add `hideCup()` method to `DiceRenderer`**

Add immediately after `showCup()`:

```typescript
hideCup(): void {
  if (this.cupTickFn) {
    this.app.ticker.remove(this.cupTickFn);
    this.cupTickFn = null;
  }
  if (this.cupContainer) {
    this.cupContainer.destroy({ children: true });
    this.cupContainer = null;
  }
}
```

Also call `this.hideCup()` at the top of the existing `hide()` method:

```typescript
hide(): void {
  this.hideCup();             // add this line
  this.container.removeChildren();
  this.dieContainers = [];
  this.dieValues = [];
  this.dieOrigPositions = [];
}
```

And update `destroy()`:

```typescript
destroy(): void {
  this.hideCup();             // add this line
  this.container.destroy({ children: true });
  this.dieContainers = [];
  this.dieValues = [];
  this.dieOrigPositions = [];
}
```

- [ ] **Step 4: Add `setWaitingForRoll()` helper to `GameController`**

In `apps/web/src/game/GameController.ts`, add this private method. Place it just before `startHumanTurn()` (around line 328):

```typescript
private setWaitingForRoll(waiting: boolean): void {
  this.onWaitingForRoll?.(waiting);
  if (waiting) {
    this.diceRenderer.showCup();
  } else {
    this.diceRenderer.hideCup();
  }
}
```

- [ ] **Step 5: Replace `onWaitingForRoll?.(true/false)` calls in `GameController`**

Replace every `this.onWaitingForRoll?.(true)` and `this.onWaitingForRoll?.(false)` in `GameController.ts` with `this.setWaitingForRoll(true)` / `this.setWaitingForRoll(false)`.

There are 6 occurrences (lines 107, 140, 215, 231, 334, 341). After replacement:

- Line 107: `this.setWaitingForRoll(true);`
- Line 140: `this.setWaitingForRoll(false);`
- Line 215: `this.setWaitingForRoll(false);`
- Line 231: `this.setWaitingForRoll(true);`
- Line 334: `this.setWaitingForRoll(true);`
- Line 341: `this.setWaitingForRoll(false);`

- [ ] **Step 6: Apply the same pattern to `OnlineGameController`**

In `apps/web/src/game/OnlineGameController.ts`, add the same `setWaitingForRoll` private method, then replace the 5 `onWaitingForRoll` call sites (lines 61, 78, 87, 98, 233) with `this.setWaitingForRoll(true/false)` to match their original boolean argument.

- [ ] **Step 7: Verify cup animation**

In the browser, start a game. Expected:
- On game start (waiting for opening roll): leather cup with two mini dice peeking out appears in the tray, gently wobbling (~±8°)
- Clicking "Roll Dice" button (or pressing Space): cup disappears, dice animate into tray
- After AI's turn when it's your turn again: cup reappears in tray

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/game/DiceRenderer.ts apps/web/src/game/GameController.ts apps/web/src/game/OnlineGameController.ts
git commit -m "feat: add wobbling dice cup animation to tray while waiting to roll"
```

---

## Task 4: Swipe-to-roll gesture

**Files:**
- Modify: `apps/web/src/game/InputHandler.ts`
- Modify: `apps/web/src/game/GameController.ts`
- Modify: `apps/web/src/game/OnlineGameController.ts`

- [ ] **Step 1: Add swipe state fields to `InputHandler`**

In `apps/web/src/game/InputHandler.ts`, add these private fields after the existing `onMoveSelected` callback declaration:

```typescript
// Swipe-to-roll state
private swipeCallback: (() => void) | null = null;
private swipeStart: { x: number; y: number } | null = null;
private swipePending = false;
private swipeDownHandler: ((e: FederatedPointerEvent) => void) | null = null;
private swipeMoveHandler: ((e: FederatedPointerEvent) => void) | null = null;
private swipeUpHandler: ((e: FederatedPointerEvent) => void) | null = null;
```

- [ ] **Step 2: Add `enableSwipeToRoll()` and `disableSwipeToRoll()` to `InputHandler`**

Add these methods before the `destroy()` method:

```typescript
enableSwipeToRoll(onRoll: () => void): void {
  this.disableSwipeToRoll();
  this.swipeCallback = onRoll;

  this.swipeDownHandler = (e: FederatedPointerEvent) => {
    // Only detect swipes on the board area, not the tray
    if (e.global.y < this.boardRenderer.getBoardHeight()) {
      this.swipeStart = { x: e.global.x, y: e.global.y };
      this.swipePending = false;
    }
  };

  this.swipeMoveHandler = (e: FederatedPointerEvent) => {
    if (!this.swipeStart) return;
    const dist = Math.hypot(
      e.global.x - this.swipeStart.x,
      e.global.y - this.swipeStart.y
    );
    if (dist >= 30) this.swipePending = true;
  };

  this.swipeUpHandler = () => {
    if (this.swipePending) this.swipeCallback?.();
    this.swipeStart = null;
    this.swipePending = false;
  };

  this.app.stage.on("pointerdown", this.swipeDownHandler);
  this.app.stage.on("pointermove", this.swipeMoveHandler);
  this.app.stage.on("pointerup", this.swipeUpHandler);
  this.app.stage.on("pointerupoutside", this.swipeUpHandler);
}

disableSwipeToRoll(): void {
  this.swipeStart = null;
  this.swipePending = false;
  this.swipeCallback = null;
  if (this.swipeDownHandler) {
    this.app.stage.off("pointerdown", this.swipeDownHandler);
    this.swipeDownHandler = null;
  }
  if (this.swipeMoveHandler) {
    this.app.stage.off("pointermove", this.swipeMoveHandler);
    this.swipeMoveHandler = null;
  }
  if (this.swipeUpHandler) {
    this.app.stage.off("pointerup", this.swipeUpHandler);
    this.app.stage.off("pointerupoutside", this.swipeUpHandler);
    this.swipeUpHandler = null;
  }
}
```

Also add `this.disableSwipeToRoll();` at the top of the existing `destroy()` method.

- [ ] **Step 3: Wire swipe-to-roll in `GameController.setWaitingForRoll()`**

Update the method added in Task 3 Step 4:

```typescript
private setWaitingForRoll(waiting: boolean): void {
  this.onWaitingForRoll?.(waiting);
  if (waiting) {
    this.diceRenderer.showCup();
    this.inputHandler.enableSwipeToRoll(() => this.rollForHuman());
  } else {
    this.diceRenderer.hideCup();
    this.inputHandler.disableSwipeToRoll();
  }
}
```

- [ ] **Step 4: Wire swipe-to-roll in `OnlineGameController.setWaitingForRoll()`**

Update the same method in `OnlineGameController.ts` (added in Task 3 Step 6):

```typescript
private setWaitingForRoll(waiting: boolean): void {
  this.onWaitingForRoll?.(waiting);
  if (waiting) {
    this.diceRenderer.showCup();
    this.inputHandler.enableSwipeToRoll(() => this.rollForHuman());
  } else {
    this.diceRenderer.hideCup();
    this.inputHandler.disableSwipeToRoll();
  }
}
```

- [ ] **Step 5: Verify swipe-to-roll on mobile (or touch simulation)**

Open browser DevTools → toggle device emulation (e.g., iPhone). Start a game. Expected:
- When cup is showing, swiping in any direction on the board area triggers the roll
- Short taps (< 30px movement) do NOT trigger roll — the existing roll button still works
- After rolling, swiping does nothing (swipe is disabled when not waiting for roll)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/game/InputHandler.ts apps/web/src/game/GameController.ts apps/web/src/game/OnlineGameController.ts
git commit -m "feat: add swipe-to-roll gesture on board area"
```

---

## Task 5: Drag die to piece to execute move

**Files:**
- Modify: `apps/web/src/game/MoveLineRenderer.ts`
- Modify: `apps/web/src/game/InputHandler.ts`
- Modify: `apps/web/src/game/BaseGameController.ts`
- Modify: `apps/web/src/game/GameController.ts`

- [ ] **Step 1: Export `computeDieValue` from `MoveLineRenderer.ts`**

In `apps/web/src/game/MoveLineRenderer.ts`, change the function declaration at the top of the file from:

```typescript
function computeDieValue(move: Move, player: Player, remaining: number[]): number {
```

To:

```typescript
export function computeDieValue(move: Move, player: Player, remaining: number[]): number {
```

- [ ] **Step 2: Add die-drag state and `setDiceRenderer()` to `InputHandler`**

In `apps/web/src/game/InputHandler.ts`, add the import at the top:

```typescript
import { computeDieValue } from "./MoveLineRenderer";
import { DiceRenderer } from "./DiceRenderer";
```

Add these private fields after the swipe fields added in Task 4:

```typescript
// Die-drag state
private diceRenderer: DiceRenderer | null = null;
private dieDragActive = false;
private dieDragIndex = -1;
private dieDragValue = 0;
private dieDragContainer: Container | null = null;
private dieDragHoveredFrom: number | "bar" | null = null;
private dieDragHoveredPiece: Container | null = null;
private dieMoveHandler: ((e: FederatedPointerEvent) => void) | null = null;
private dieUpHandler: ((e: FederatedPointerEvent) => void) | null = null;
```

Add this method before `enableSwipeToRoll`:

```typescript
setDiceRenderer(dr: DiceRenderer): void {
  this.diceRenderer = dr;
}
```

- [ ] **Step 3: Add `getEligiblePieceAtPosition()` to `InputHandler`**

Add this method before `destroy()`:

```typescript
private getEligiblePieceAtPosition(
  x: number,
  y: number,
  dieValue: number
): number | "bar" | null {
  if (!this.state || !this.state.dice) return null;
  const player = this.state.currentPlayer;
  const remaining = this.state.dice.remaining;
  const hitRadius = this.boardRenderer.getPieceRadius() * 1.6;

  const eligibleFroms = new Set(
    this.legalMoves
      .filter((m) => computeDieValue(m, player, remaining) === dieValue)
      .map((m) => m.from)
  );

  for (const from of eligibleFroms) {
    let pos: { x: number; y: number };
    if (from === "bar") {
      const b = this.boardRenderer.getBarBounds();
      pos = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    } else {
      pos = this.boardRenderer.getPointPosition(from as number);
    }
    if (Math.hypot(x - pos.x, y - pos.y) < hitRadius) return from;
  }

  return null;
}
```

- [ ] **Step 4: Add `enableDieDrag()` and `disableDieDrag()` to `InputHandler`**

Add these methods before `destroy()`:

```typescript
enableDieDrag(): void {
  this.disableDieDrag();
  if (!this.diceRenderer || !this.state) return;

  const dieInfo = this.diceRenderer.getDieInfo();

  dieInfo.forEach(({ container, value, origX, origY }, index) => {
    container.eventMode = "static";
    container.cursor = "grab";

    const onDieDown = (e: FederatedPointerEvent) => {
      if (!this.enabled || container.alpha < 0.5) return; // skip used dice
      e.stopPropagation();

      this.dieDragActive = true;
      this.dieDragIndex = index;
      this.dieDragValue = value;
      this.dieDragContainer = container;
      this.dieDragHoveredFrom = null;
      this.dieDragHoveredPiece = null;

      container.zIndex = 900;
      container.scale.set(1.2);

      this.dieMoveHandler = (moveE: FederatedPointerEvent) => {
        if (!this.dieDragActive || !this.dieDragContainer) return;

        this.dieDragContainer.x = moveE.global.x;
        this.dieDragContainer.y = moveE.global.y;

        const hitFrom = this.getEligiblePieceAtPosition(
          moveE.global.x,
          moveE.global.y,
          this.dieDragValue
        );

        if (hitFrom !== this.dieDragHoveredFrom) {
          // Clear previous hover
          if (this.dieDragHoveredPiece) {
            this.dieDragHoveredPiece.scale.set(1);
            this.dieDragHoveredPiece.zIndex = 0;
            this.dieDragHoveredPiece = null;
          }
          this.moveLineRenderer.clearHighlight();

          this.dieDragHoveredFrom = hitFrom;

          if (hitFrom !== null) {
            const player = this.state!.currentPlayer;
            const piece = this.pieceRenderer.getPieceAt(hitFrom, player);
            if (piece) {
              this.dieDragHoveredPiece = piece;
              piece.scale.set(1.15);
              piece.zIndex = 800;
            }
            this.moveLineRenderer.highlightFrom(hitFrom);
          }
        }
      };

      this.dieUpHandler = () => {
        if (!this.dieDragActive) return;
        this.app.stage.off("pointermove", this.dieMoveHandler!);
        this.app.stage.off("pointerup", this.dieUpHandler!);
        this.app.stage.off("pointerupoutside", this.dieUpHandler!);

        const fromHit = this.dieDragHoveredFrom;

        // Clear hover visuals
        if (this.dieDragHoveredPiece) {
          this.dieDragHoveredPiece.scale.set(1);
          this.dieDragHoveredPiece.zIndex = 0;
          this.dieDragHoveredPiece = null;
        }
        this.moveLineRenderer.clearHighlight();
        this.dieDragActive = false;
        this.dieDragHoveredFrom = null;

        if (fromHit !== null && this.state && this.state.dice) {
          const player = this.state.currentPlayer;
          const remaining = this.state.dice.remaining;
          const targetMove = this.legalMoves.find(
            (m) =>
              m.from === fromHit &&
              computeDieValue(m, player, remaining) === this.dieDragValue
          );
          if (targetMove) {
            this.executeMove(targetMove);
            return;
          }
        }

        // No valid drop — snap die back
        this.diceRenderer?.snapDieBack(this.dieDragIndex);
      };

      this.app.stage.on("pointermove", this.dieMoveHandler);
      this.app.stage.on("pointerup", this.dieUpHandler);
      this.app.stage.on("pointerupoutside", this.dieUpHandler);
    };

    container.on("pointerdown", onDieDown);
    // Store cleanup reference via tag
    (container as any).__dieDragCleanup = () => {
      container.off("pointerdown", onDieDown);
      container.eventMode = "none";
      container.cursor = "default";
    };
  });
}

disableDieDrag(): void {
  this.dieDragActive = false;
  this.dieDragHoveredFrom = null;
  if (this.dieDragHoveredPiece) {
    this.dieDragHoveredPiece.scale.set(1);
    this.dieDragHoveredPiece.zIndex = 0;
    this.dieDragHoveredPiece = null;
  }
  if (this.dieMoveHandler) {
    this.app.stage.off("pointermove", this.dieMoveHandler);
    this.dieMoveHandler = null;
  }
  if (this.dieUpHandler) {
    this.app.stage.off("pointerup", this.dieUpHandler);
    this.app.stage.off("pointerupoutside", this.dieUpHandler);
    this.dieUpHandler = null;
  }
  // Clean up per-die listeners
  if (this.diceRenderer) {
    for (const { container } of this.diceRenderer.getDieInfo()) {
      const cleanup = (container as any).__dieDragCleanup;
      if (cleanup) { cleanup(); delete (container as any).__dieDragCleanup; }
    }
  }
}
```

Also add `this.disableDieDrag();` inside the existing `disable()` method in `InputHandler`, right after `this.deselect();`.

- [ ] **Step 5: Wire `setDiceRenderer` and `enableDieDrag` in `BaseGameController`**

In `apps/web/src/game/BaseGameController.ts`, inside `initRenderers()`, add after the `inputHandler` constructor call:

```typescript
this.inputHandler.setDiceRenderer(this.diceRenderer);
```

- [ ] **Step 6: Call `enableDieDrag()` in `GameController.enableHumanInput()`**

In `apps/web/src/game/GameController.ts`, find the `enableHumanInput()` method (the one containing `this.inputHandler.enable(this.state, legalMoves)` at line 441). Add the die drag call immediately after:

```typescript
this.inputHandler.enable(this.state, legalMoves);
this.inputHandler.enableDieDrag();   // add this line
```

- [ ] **Step 7: Verify die drag end-to-end**

Open browser with device emulation (touch). Roll dice. Expected:
- Tapping and holding a die in the tray lifts it (scales to 1.2×, shadow intensifies)
- Dragging the die over the board — when the finger crosses an eligible piece, that piece glows and an arc shows its destination
- Lifting finger over the piece executes the move (piece animates to destination, die dims)
- Lifting finger over non-eligible area snaps the die back to its tray slot (200ms ease-out)
- After one die is used, the second die can still be dragged for the second move

Also test desktop: click-to-select and arc-click still work unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/game/MoveLineRenderer.ts apps/web/src/game/InputHandler.ts apps/web/src/game/BaseGameController.ts apps/web/src/game/GameController.ts
git commit -m "feat: drag die to piece to execute move with arc preview"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Dedicated dice tray below board (Tasks 1–2)
  - ✅ Real pip dice in tray, larger size (Task 2)
  - ✅ Illustrated cup with wobble animation (Task 3)
  - ✅ Swipe any direction on board to roll (Task 4)
  - ✅ Immediate touch-down drag (no long-press) — enabled via `pointerdown` directly (Task 5)
  - ✅ Hover die over eligible piece → piece glows + arc shows destination (Task 5)
  - ✅ Drop over piece → executes move (Task 5)
  - ✅ Drop elsewhere → snap back to tray (Task 5)
  - ✅ Desktop click/arc interactions unchanged
  - ✅ Opening roll is out of scope (cup shows, swipe works, opening dice still render inside board)

- **Type consistency:**
  - `computeDieValue(move, player, remaining)` — exported from `MoveLineRenderer`, imported in `InputHandler`
  - `getDieInfo()` returns `{ container, value, origX, origY }[]` — used in `enableDieDrag()`
  - `snapDieBack(index: number)` — called with `this.dieDragIndex`
  - `getBoardHeight()` added to `BoardRenderer` — called in swipe gesture bounds check

- **No placeholders:** All code blocks are complete.

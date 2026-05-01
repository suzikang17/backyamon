# Mobile Swipe & Drag UX — Design Spec

**Date:** 2026-05-01  
**Status:** Draft — pending user approval

---

## Overview

Redesign the mobile interaction model for backyamon to feel native on touch devices. Two core gestures replace the tap-heavy current flow:

1. **Swipe to roll** — any swipe on the board triggers the dice roll
2. **Drag die to piece** — pick up a pip die from the tray and drag it onto a piece to execute that move

Desktop click/arc interactions remain unchanged.

---

## Layout Change

### Current
The PixiJS canvas is locked to an 8:5 aspect ratio. Dice float inside the board canvas, centered near the bottom. The HUD (undo, status, roll button) lives in a React overlay.

### New
The PixiJS canvas grows taller: **board area (8:5) + dice tray (~70px)**. The board occupies the top portion; a dedicated tray area sits below it within the same canvas. The React HUD sits below the canvas as today.

```
┌─────────────────────────────┐
│                             │
│         BOARD (8:5)         │
│                             │
├─────────────────────────────┤  ← tray top = boardY + boardHeight
│   [cup / dice live here]    │  ~70px tall
└─────────────────────────────┘
│  HUD: undo | status | ⚙    │  (React, unchanged)
```

**Canvas height formula:**  
`canvasHeight = boardHeight + TRAY_HEIGHT` where `TRAY_HEIGHT = Math.round(boardHeight * 0.13)` (scales with board, ~70px at 540px board height).

`GameCanvas.tsx` height calculation changes from `width / 1.6` to `(width / 1.6) + trayHeight`.

---

## Dice Cup (waiting-to-roll state)

When it is the human player's turn and `phase === "ROLLING"` (regular turns only — not `OPENING_ROLL`), a leather dice cup with two dice peeking out of the top renders centered in the tray. It plays a gentle continuous wobble animation (~±8° rotation, 0.9s ease-in-out loop).

**On swipe:** The cup plays a single fast shake animation (~3 cycles, 300ms), then flies off upward (tween out), and the rolled dice appear in the tray with their existing bounce/spin animation.

**Rendering:** New `DiceCupRenderer` class inside `DiceRenderer.ts` (or a small standalone class). Uses PixiJS `Graphics` + `Ticker` for the wobble tween. The cup graphic mirrors the illustrated style: trapezoid body, rounded rim, leather band, two small pip-dice heads visible above the rim.

---

## Dice in Tray (post-roll state)

After rolling, pip dice render in the tray at **`Math.max(pieceRadius × 3, 40)`** size (larger than the current in-board size of `pieceRadius × 2.2`) so they are comfortable touch targets with a 40px minimum.

- Pip layout uses the existing `PIP_POSITIONS` table from `DiceRenderer.ts`.
- Used dice dim to `opacity = 0.28` (same as current behavior, just repositioned).
- For doubles, all four dice are shown in a row with equal spacing.
- `BoardRenderer.getDiceCenterPosition()` is updated to return a position within the tray area.

---

## Swipe to Roll

**Gesture:** `pointerdown` + `pointermove` (≥30px in any direction) + `pointerup` on the **board canvas area** (not the tray).

**Implementation in `InputHandler.ts`:**
- Track `swipeStart: {x, y} | null` on `pointerdown` when `waitingForRoll === true`.
- On `pointermove`: if distance from `swipeStart` exceeds 30px, mark `swipePending = true`.
- On `pointerup`: if `swipePending`, call the existing `onRollRequested` callback (same as the Roll button).
- Clear swipe state on `pointerup` regardless.
- Does not interfere with piece selection drags (those only activate post-roll).

The "Roll Dice" button in `GameHUD.tsx` remains for desktop and as a fallback.

---

## Die Drag to Piece

### Pickup
`pointerdown` on a die graphic in the tray → immediately starts drag. No long-press delay.

- The die graphic lifts: scale to 1.2×, drop-shadow increases, z-index to 900.
- In the tray, the die's slot dims (opacity 0.3) to show it's "in hand."

### While Dragging
The die follows the pointer. On each `pointermove`:

1. Hit-test against **eligible piece positions** (pieces that have at least one legal move using this die's value).
2. **If over an eligible piece:**
   - Piece glows gold (scale 1.15×, gold ring shadow — same as current selection glow).
   - `MoveLineRenderer` draws the arc + destination ring for that `(piece → destination)` move.
   - New method: `MoveLineRenderer.showDieDragPreview(from, move)`.
3. **If not over any eligible piece:**
   - Clear any active preview: `MoveLineRenderer.clearDieDragPreview()`.
   - All eligible pieces show their resting glow (they pulse gold to indicate they're valid drop targets).

### Drop
- **Over eligible piece:** Execute the move via existing `executeMove()`. Die consumed (removed from tray / dimmed). Piece animates to destination.
- **Anywhere else:** Die tweens back to its tray slot (200ms ease-out). Slot returns to full opacity.

### Hit Testing
`InputHandler` gets a new method `getEligiblePieceAtPosition(x, y, dieValue): PointIndex | null`.  
It checks the pointer position against piece bounding boxes (stored by `PieceRenderer`) filtered by `legalMoves` that use `dieValue`. Hit radius = `pieceRadius × 1.4` for generous touch targeting.

---

## Eligible Piece Highlighting (post-roll idle)

When dice are rolled and no die is being dragged, all pieces that have at least one legal move pulse with a gentle gold glow. This replaces the current "select piece first, then see arcs" discovery flow on mobile. The faded background arcs (beginner guide) remain togglable via settings.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/game/DiceRenderer.ts` | Add `DiceCupRenderer`, move dice to tray area, increase die size, expose die graphics as draggable PixiJS objects |
| `apps/web/src/game/InputHandler.ts` | Add swipe-to-roll detection, add die-drag logic with piece hit testing |
| `apps/web/src/game/MoveLineRenderer.ts` | Add `showDieDragPreview()` and `clearDieDragPreview()` methods |
| `apps/web/src/game/BoardRenderer.ts` | Export `getTrayBounds()` for positioning; update `getDiceCenterPosition()` |
| `apps/web/src/game/GameController.ts` | Wire `onRollRequested` callback from swipe gesture |
| `apps/web/src/game/OnlineGameController.ts` | Same roll callback wiring |
| `apps/web/src/components/GameCanvas.tsx` | Adjust canvas height to include tray; pass tray height to renderer |

---

## Out of Scope

- No changes to the doubling cube interaction.
- No changes to the bearing-off flow.
- No changes to the opening roll (two dice on left/right sides).
- No new sounds (existing roll sound fires on swipe just as it does on button press).
- Desktop behavior is entirely unchanged.

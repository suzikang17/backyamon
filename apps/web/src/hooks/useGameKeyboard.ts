import { useEffect } from "react";
import type { BaseGameController } from "@/game/BaseGameController";
import { SoundManager } from "@/audio/SoundManager";

/**
 * Shared keyboard shortcuts for both single-player and online game modes.
 *
 * Space/Enter  - Roll dice or confirm move
 * Escape/Q     - Deselect piece
 * Tab/N        - Cycle targets forward
 * Arrow keys   - Navigate pieces / cycle targets
 * hjkl         - Vim-style navigation
 * U / Ctrl+Z   - Undo (when onUndo provided)
 * M            - Toggle mute
 * 1-6          - Select move by number label
 */
export function useGameKeyboard(
  controllerRef: React.RefObject<BaseGameController | null>,
  waitingForRoll: boolean,
  soundManager: SoundManager,
  options?: {
    onUndo?: () => void;
  }
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = controllerRef.current;
      if (!ctrl) return;

      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (waitingForRoll) {
            soundManager.resumeContext();
            ctrl.rollForHuman();
          } else if (ctrl.hasSelection()) {
            ctrl.confirmMove();
          }
          break;
        case "Escape":
        case "q":
          e.preventDefault();
          ctrl.deselectPiece();
          break;
        case "Tab":
        case "n":
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          }
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          } else {
            ctrl.navigatePieces("right");
          }
          break;
        case "ArrowLeft":
        case "h":
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(-1);
          } else {
            ctrl.navigatePieces("left");
          }
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(-1);
          } else {
            ctrl.navigatePieces("up");
          }
          break;
        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          } else {
            ctrl.navigatePieces("down");
          }
          break;
        case "u":
          e.preventDefault();
          options?.onUndo?.();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          options?.onUndo?.();
          break;
        case "m":
          e.preventDefault();
          soundManager.toggleMute();
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
          if (ctrl.hasSelection()) {
            e.preventDefault();
            ctrl.selectMoveByNumber(parseInt(e.key));
          }
          break;
      }
    };

    // Use capture phase to intercept keys before any focused element swallows them
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [controllerRef, waitingForRoll, soundManager, options]);
}

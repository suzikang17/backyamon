"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application } from "pixi.js";
import { Player, type GameState, type WinType, canOfferDouble } from "@backyamon/engine";
import { GameController } from "@/game/GameController";
import { SoundManager } from "@/audio/SoundManager";
import { GameHUD } from "./GameHUD";

interface GameCanvasProps {
  difficulty: string;
  onGameOver?: (winner: Player, winType: WinType) => void;
}

const aiNames: Record<string, string> = {
  easy: "Beach Bum",
  medium: "Selector",
  hard: "King Tubby",
};

export function GameCanvas({ difficulty, onGameOver }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const appRef = useRef<Application | null>(null);
  const [message, setMessage] = useState("");
  const [waitingForRoll, setWaitingForRoll] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const soundManager = useMemo(() => SoundManager.getInstance(), []);

  const opponentName = aiNames[difficulty] ?? "Beach Bum";

  const handleRollClick = useCallback(() => {
    if (waitingForRoll && controllerRef.current) {
      soundManager.resumeContext();
      controllerRef.current.rollForHuman();
    }
  }, [waitingForRoll, soundManager]);

  const handleOfferDouble = useCallback(() => {
    controllerRef.current?.offerDouble();
  }, []);

  const handleUndo = useCallback(() => {
    controllerRef.current?.undoMove();
  }, []);

  // Determine if doubling is possible from current state
  const canDouble =
    gameState !== null &&
    canOfferDouble(gameState) &&
    gameState.currentPlayer === Player.Gold &&
    waitingForRoll;

  // Keyboard shortcuts
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
        case "q": // vim: quit selection
          e.preventDefault();
          ctrl.deselectPiece();
          break;
        case "Tab":
        case "n": // vim: next target
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          }
          break;
        case "ArrowRight":
        case "l": // vim: right
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          } else {
            ctrl.navigatePieces("right");
          }
          break;
        case "ArrowLeft":
        case "h": // vim: left
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(-1);
          } else {
            ctrl.navigatePieces("left");
          }
          break;
        case "ArrowUp":
        case "k": // vim: up
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(-1);
          } else {
            ctrl.navigatePieces("up");
          }
          break;
        case "ArrowDown":
        case "j": // vim: down
          e.preventDefault();
          if (ctrl.hasSelection()) {
            ctrl.cycleTarget(1);
          } else {
            ctrl.navigatePieces("down");
          }
          break;
        case "u": // vim: undo
          e.preventDefault();
          ctrl.undoMove();
          break;
        case "z":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
          }
          ctrl.undoMove();
          break;
      }
    };

    // Use capture phase to intercept keys before any focused element swallows them
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [waitingForRoll, soundManager]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let app: Application | null = null;
    let controller: GameController | null = null;

    const init = async () => {
      // Calculate canvas size based on container
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const aspectRatio = 8 / 5;
      const height = Math.floor(width / aspectRatio);

      app = new Application();
      await app.init({
        width,
        height,
        backgroundColor: 0x2a2a1e,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      appRef.current = app;

      // Style the canvas
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.borderRadius = "16px";
      canvas.style.cursor = "default";
      container.appendChild(canvas);

      // Validate difficulty
      const diff =
        difficulty === "easy" || difficulty === "medium" || difficulty === "hard"
          ? difficulty
          : "easy";

      controller = new GameController(app, diff);
      controllerRef.current = controller;

      controller.onMessage = (msg) => {
        if (!destroyed) setMessage(msg);
      };

      controller.onWaitingForRoll = (waiting) => {
        if (!destroyed) setWaitingForRoll(waiting);
      };

      controller.onStateChange = (state) => {
        if (!destroyed) setGameState(state);
      };

      controller.onCanUndo = (canUndoNow) => {
        if (!destroyed) setCanUndo(canUndoNow);
      };

      controller.onGameOver = (winner, winType) => {
        if (!destroyed) {
          onGameOver?.(winner, winType);
        }
      };

      controller.startGame();
    };

    init();

    return () => {
      destroyed = true;
      if (controller) {
        controller.destroy();
        controllerRef.current = null;
      }
      if (app) {
        // Remove canvas from DOM before destroying
        const canvas = app.canvas as HTMLCanvasElement;
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        app.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [difficulty, onGameOver]);

  return (
    <div className="relative w-full max-w-[900px]">
      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full aspect-[8/5] rounded-2xl border-2 border-[#8B4513] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        onClick={handleRollClick}
        style={{ cursor: waitingForRoll ? "pointer" : "default" }}
      />

      {/* HUD overlay */}
      <GameHUD
        state={gameState}
        playerColor={Player.Gold}
        opponentName={opponentName}
        onOfferDouble={handleOfferDouble}
        onRollDice={handleRollClick}
        onUndo={handleUndo}
        canRoll={waitingForRoll}
        canDouble={canDouble}
        canUndo={canUndo}
        soundManager={soundManager}
      />

      {/* Message overlay */}
      {message && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-none z-20">
          <div className="bg-[#1A1A0E]/85 text-[#D4A857] font-heading text-xs sm:text-sm px-3 sm:px-5 py-1 sm:py-1.5 rounded-lg border border-[#8B4513]/60 whitespace-nowrap backdrop-blur-sm">
            {message}
          </div>
        </div>
      )}
    </div>
  );
}

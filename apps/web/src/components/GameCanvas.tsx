"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application } from "pixi.js";
import { Player, type GameState, type WinType, canOfferDouble } from "@backyamon/engine";
import { GameController } from "@/game/GameController";
import { SoundManager } from "@/audio/SoundManager";
import { useGameKeyboard } from "@/hooks/useGameKeyboard";
import { GameHUD } from "./GameHUD";

interface GameCanvasProps {
  difficulty: string;
  onGameOver?: (winner: Player, winType: WinType) => void;
}

const aiNames: Record<string, string> = {
  easy: "Beach Bum",
  medium: "Selecta",
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

  // Shared keyboard shortcuts
  const undoOptions = useMemo(() => ({ onUndo: handleUndo }), [handleUndo]);
  useGameKeyboard(controllerRef, waitingForRoll, soundManager, undoOptions);

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
        style={{ cursor: waitingForRoll ? "pointer" : "default", touchAction: "manipulation" }}
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

      {/* Message bar — below the canvas, not overlapping the board */}
      <div className="h-8 flex items-center justify-center">
        {message && (
          <p className="text-[#D4A857] font-heading text-xs sm:text-sm whitespace-nowrap">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

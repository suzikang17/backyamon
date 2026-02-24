"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Application } from "pixi.js";
import { Player, type WinType } from "@backyamon/engine";
import { GameController } from "@/game/GameController";

interface GameCanvasProps {
  difficulty: string;
  onGameOver?: (winner: Player, winType: WinType) => void;
}

export function GameCanvas({ difficulty, onGameOver }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<GameController | null>(null);
  const appRef = useRef<Application | null>(null);
  const [message, setMessage] = useState("");
  const [waitingForRoll, setWaitingForRoll] = useState(false);

  const handleRollClick = useCallback(() => {
    if (waitingForRoll && controllerRef.current) {
      controllerRef.current.rollForHuman();
    }
  }, [waitingForRoll]);

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
    <div className="relative w-full max-w-[800px]">
      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full aspect-[8/5] rounded-2xl border-2 border-[#8B4513] overflow-hidden shadow-lg"
        onClick={handleRollClick}
        style={{ cursor: waitingForRoll ? "pointer" : "default" }}
      />

      {/* Message overlay */}
      {message && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-[#1A1A0E]/90 text-[#FFD700] font-heading text-lg px-6 py-2 rounded-xl border border-[#8B4513] whitespace-nowrap">
            {message}
          </div>
        </div>
      )}

      {/* Roll prompt */}
      {waitingForRoll && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[#1A1A0E]/80 text-[#FFD700] font-heading text-2xl px-8 py-4 rounded-2xl border-2 border-[#D4A857] animate-pulse pointer-events-auto cursor-pointer"
               onClick={handleRollClick}>
            Roll Dice
          </div>
        </div>
      )}
    </div>
  );
}

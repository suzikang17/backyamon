"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Application } from "pixi.js";
import { Player, type GameState, type WinType } from "@backyamon/engine";
import { OnlineGameController } from "@/game/OnlineGameController";
import { SocketClient } from "@/multiplayer/SocketClient";

interface OnlineGameCanvasProps {
  socketClient: SocketClient;
  roomId: string;
  localPlayer: Player;
  initialState: GameState;
  opponentName: string;
  onGameOver?: (winner: Player, winType: WinType, pointsWon: number) => void;
}

export function OnlineGameCanvas({
  socketClient,
  roomId,
  localPlayer,
  initialState,
  opponentName,
  onGameOver,
}: OnlineGameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<OnlineGameController | null>(null);
  const appRef = useRef<Application | null>(null);
  const [message, setMessage] = useState("");
  const [waitingForRoll, setWaitingForRoll] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

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
    let controller: OnlineGameController | null = null;

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

      controller = new OnlineGameController(app, socketClient, roomId);
      controllerRef.current = controller;

      controller.onMessage = (msg) => {
        if (!destroyed) setMessage(msg);
      };

      controller.onWaitingForRoll = (waiting) => {
        if (!destroyed) setWaitingForRoll(waiting);
      };

      controller.onGameOver = (winner, winType, pointsWon) => {
        if (!destroyed) {
          onGameOver?.(winner, winType, pointsWon);
        }
      };

      controller.onOpponentDisconnected = () => {
        if (!destroyed) setOpponentDisconnected(true);
      };

      controller.onOpponentReconnected = () => {
        if (!destroyed) setOpponentDisconnected(false);
      };

      controller.startGame(initialState, localPlayer);
    };

    init();

    return () => {
      destroyed = true;
      if (controller) {
        controller.destroy();
        controllerRef.current = null;
      }
      if (app) {
        const canvas = app.canvas as HTMLCanvasElement;
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
        app.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [socketClient, roomId, localPlayer, initialState, opponentName, onGameOver]);

  return (
    <div className="relative w-full max-w-[800px]">
      {/* Opponent disconnect warning */}
      {opponentDisconnected && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#CE1126]/90 text-white font-heading text-sm px-4 py-2 rounded-xl border border-[#CE1126] animate-pulse">
            Opponent disconnected - waiting for reconnect...
          </div>
        </div>
      )}

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
          <div
            className="bg-[#1A1A0E]/80 text-[#FFD700] font-heading text-2xl px-8 py-4 rounded-2xl border-2 border-[#D4A857] animate-pulse pointer-events-auto cursor-pointer"
            onClick={handleRollClick}
          >
            Roll Dice
          </div>
        </div>
      )}
    </div>
  );
}

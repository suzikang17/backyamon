"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Application } from "pixi.js";
import { Player, type GameState, type WinType, canOfferDouble } from "@backyamon/engine";
import { OnlineGameController } from "@/game/OnlineGameController";
import { SocketClient } from "@/multiplayer/SocketClient";
import { SoundManager } from "@/audio/SoundManager";
import { useGameKeyboard } from "@/hooks/useGameKeyboard";
import { GameHUD } from "./GameHUD";

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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [showMoveArcs, setShowMoveArcs] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("backyamon_show_arcs");
      return stored !== null ? stored === "true" : false; // default OFF in multiplayer
    }
    return false;
  });

  const soundManager = useMemo(() => SoundManager.getInstance(), []);

  const handleRollClick = useCallback(() => {
    if (waitingForRoll && controllerRef.current) {
      soundManager.resumeContext();
      controllerRef.current.rollForHuman();
    }
  }, [waitingForRoll, soundManager]);

  const handleOfferDouble = useCallback(() => {
    controllerRef.current?.offerDouble();
  }, []);

  const handleToggleMoveArcs = useCallback((show: boolean) => {
    setShowMoveArcs(show);
    localStorage.setItem("backyamon_show_arcs", String(show));
    controllerRef.current?.setShowMoveArcs(show);
  }, []);

  // Determine if doubling is possible from current state
  const canDouble =
    gameState !== null &&
    canOfferDouble(gameState) &&
    gameState.currentPlayer === localPlayer &&
    waitingForRoll;

  // Shared keyboard shortcuts (no undo in multiplayer — server owns state)
  useGameKeyboard(controllerRef, waitingForRoll, soundManager);

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

      controller.onStateChange = (state) => {
        if (!destroyed) setGameState(state);
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

      // Apply move arcs preference (default off in multiplayer)
      const storedArcs = localStorage.getItem("backyamon_show_arcs");
      controller.setShowMoveArcs(storedArcs === "true");
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
    <div className="relative w-full max-w-[900px]">
      {/* Opponent disconnect warning */}
      {opponentDisconnected && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-[#CE1126]/90 text-white font-heading text-sm px-4 py-2 rounded-xl border border-[#CE1126] animate-pulse">
            Opponent disconnected - waiting for reconnect...
          </div>
        </div>
      )}

      {/* HUD renders: top bar (outside board), overlay, bottom bar (outside board) */}
      <GameHUD
        state={gameState}
        playerColor={localPlayer}
        opponentName={opponentName}
        onOfferDouble={handleOfferDouble}
        onRollDice={handleRollClick}
        canRoll={waitingForRoll}
        canDouble={canDouble}
        soundManager={soundManager}
        showMoveArcs={showMoveArcs}
        onToggleMoveArcs={handleToggleMoveArcs}
      >
        {/* Canvas container — passed as children so HUD wraps around it */}
        <div
          ref={containerRef}
          className="w-full aspect-[8/5] rounded-2xl border-2 border-[#8B4513] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
          onClick={handleRollClick}
          style={{ cursor: waitingForRoll ? "pointer" : "default", touchAction: "manipulation" }}
        />
      </GameHUD>

      {/* Message bar */}
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

"use client";

import { type GameState, Player, canOfferDouble } from "@backyamon/engine";
import { useState, useCallback, useEffect } from "react";
import { SoundManager } from "@/audio/SoundManager";

interface GameHUDProps {
  state: GameState | null;
  playerColor: Player;
  opponentName: string;
  onOfferDouble: () => void;
  onRollDice: () => void;
  canRoll: boolean;
  canDouble: boolean;
  soundManager: SoundManager;
}

export function GameHUD({
  state,
  playerColor,
  opponentName,
  onOfferDouble,
  onRollDice,
  canRoll,
  canDouble,
  soundManager,
}: GameHUDProps) {
  const [muted, setMuted] = useState(soundManager.isMuted());

  const handleToggleMute = useCallback(() => {
    soundManager.resumeContext();
    const nowMuted = soundManager.toggleMute();
    setMuted(nowMuted);
  }, [soundManager]);

  // Keep muted state in sync
  useEffect(() => {
    setMuted(soundManager.isMuted());
  }, [soundManager]);

  if (!state) return null;

  const opponentColor =
    playerColor === Player.Gold ? Player.Red : Player.Gold;
  const isPlayerTurn = state.currentPlayer === playerColor;
  const cubeValue = state.doublingCube.value;
  const showDoubleButton = canDouble && canOfferDouble(state) && isPlayerTurn;

  // Turn indicator text
  let turnText: string;
  if (state.phase === "GAME_OVER") {
    turnText =
      state.winner === playerColor
        ? "Ya Mon! You win!"
        : `${opponentName} wins!`;
  } else if (state.phase === "DOUBLING") {
    turnText = `${opponentName} is considering...`;
  } else if (isPlayerTurn) {
    turnText = state.phase === "ROLLING" ? "Your turn - Roll!" : "Your turn";
  } else {
    turnText = `${opponentName} is thinking...`;
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top bar: opponent info */}
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="flex items-center gap-2 pointer-events-auto">
          <PlayerBadge name={opponentName} color={opponentColor} />
        </div>
        <div className="flex items-center gap-2">
          {/* Score display (match play) */}
          {state.matchLength > 1 && (
            <div className="bg-[#1A1A0E]/80 rounded-lg px-3 py-1 text-xs font-heading border border-[#8B4513]">
              <span className="text-[#D4A857]">Match to {state.matchLength}: </span>
              <span className="text-[#FFD700]">
                {state.matchScore[playerColor]}
              </span>
              <span className="text-[#D4A857]"> - </span>
              <span className="text-[#CE1126]">
                {state.matchScore[opponentColor]}
              </span>
            </div>
          )}
          {/* Volume toggle */}
          <button
            onClick={handleToggleMute}
            className="pointer-events-auto bg-[#1A1A0E]/80 hover:bg-[#1A1A0E] rounded-lg p-1.5 border border-[#8B4513] transition-colors cursor-pointer"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
          </button>
        </div>
      </div>

      {/* Center area: doubling cube + turn indicator */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
        {/* Doubling cube */}
        <DoublingCube
          value={cubeValue}
          canDouble={showDoubleButton}
          onDouble={onOfferDouble}
        />
      </div>

      {/* Center: roll button when waiting */}
      {canRoll && (
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-auto">
          <button
            onClick={() => {
              soundManager.resumeContext();
              onRollDice();
            }}
            className="
              bg-gradient-to-b from-[#D4A857] to-[#8B4513]
              text-[#1A1A0E] font-heading text-base sm:text-lg
              px-4 sm:px-5 py-2 sm:py-3 rounded-xl
              border-2 border-[#FFD700]
              shadow-lg shadow-[#FFD700]/20
              hover:brightness-110 active:scale-95
              transition-all duration-150
              animate-pulse
              cursor-pointer
            "
          >
            Roll Dice
          </button>
        </div>
      )}

      {/* Bottom bar: player info + turn indicator */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-3 pb-2">
        <div className="pointer-events-auto">
          <PlayerBadge name="You" color={playerColor} />
        </div>
        <div className="bg-[#1A1A0E]/80 rounded-lg px-4 py-1.5 border border-[#8B4513]">
          <span className="font-heading text-sm text-[#D4A857]">
            {turnText}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlayerBadge({ name, color }: { name: string; color: Player }) {
  const dotColor = color === Player.Gold ? "#FFD700" : "#CE1126";
  return (
    <div className="flex items-center gap-2 bg-[#1A1A0E]/80 rounded-lg px-3 py-1.5 border border-[#8B4513]">
      <span
        className="inline-block w-3 h-3 rounded-full border border-[#F4E1C1]/40"
        style={{ backgroundColor: dotColor }}
      />
      <span className="font-heading text-sm text-[#F4E1C1]">{name}</span>
    </div>
  );
}

function DoublingCube({
  value,
  canDouble,
  onDouble,
}: {
  value: number;
  canDouble: boolean;
  onDouble: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* The cube display */}
      <div
        className={`
          relative w-12 h-12 rounded-lg
          flex items-center justify-center
          border-2 font-heading text-lg
          transition-all duration-300
          ${
            canDouble
              ? "border-[#FFD700] bg-gradient-to-br from-[#3a2d0a] to-[#1A1A0E] shadow-[0_0_12px_rgba(255,215,0,0.4)]"
              : "border-[#8B4513] bg-[#1A1A0E]/90"
          }
        `}
      >
        <span
          className={`${canDouble ? "text-[#FFD700]" : "text-[#D4A857]"}`}
        >
          {value}
        </span>
        {/* Amplifier knob notch indicators */}
        <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-[#8B4513] rounded-full" />
      </div>

      {/* "Turn It Up!" button */}
      {canDouble && (
        <button
          onClick={onDouble}
          className="
            pointer-events-auto
            bg-gradient-to-b from-[#FFD700] to-[#D4A857]
            text-[#1A1A0E] font-heading text-[10px]
            px-2 py-0.5 rounded-md
            border border-[#8B4513]
            hover:brightness-110 active:scale-95
            transition-all duration-150
            shadow-[0_0_8px_rgba(255,215,0,0.3)]
            animate-pulse
            cursor-pointer
            whitespace-nowrap
          "
        >
          Turn It Up!
        </button>
      )}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D4A857"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function SpeakerMutedIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#CE1126"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

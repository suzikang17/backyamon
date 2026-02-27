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
  onUndo?: () => void;
  canRoll: boolean;
  canDouble: boolean;
  canUndo?: boolean;
  soundManager: SoundManager;
  showMoveArcs?: boolean;
  onToggleMoveArcs?: (show: boolean) => void;
  children?: React.ReactNode;
}

export function GameHUD({
  state,
  playerColor,
  opponentName,
  onOfferDouble,
  onRollDice,
  onUndo,
  canRoll,
  canDouble,
  canUndo = false,
  soundManager,
  showMoveArcs,
  onToggleMoveArcs,
  children,
}: GameHUDProps) {
  const [muted, setMuted] = useState(soundManager.isMuted());
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleToggleMute = useCallback(() => {
    soundManager.resumeContext();
    const nowMuted = soundManager.toggleMute();
    setMuted(nowMuted);
  }, [soundManager]);

  // Keep muted state in sync
  useEffect(() => {
    setMuted(soundManager.isMuted());
  }, [soundManager]);

  // Keep musicPlaying state in sync
  useEffect(() => {
    const interval = setInterval(() => {
      setMusicPlaying(soundManager.isMusicPlaying());
    }, 500);
    return () => clearInterval(interval);
  }, [soundManager]);

  if (!state) {
    // State not yet available — render children (canvas container) so the
    // ref can mount and the PixiJS init effect can run.
    return <>{children}</>;
  }

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
    <>
    {/* Top bar: opponent name + controls — ABOVE the board */}
    <div className="flex items-center justify-between px-1 pb-1">
      <div className="flex items-center gap-2">
        <PlayerBadge name={opponentName} color={opponentColor} />
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
      </div>
      <div className="flex items-center gap-2">
        {/* Volume toggle */}
        <button
          onClick={(e) => { (e.target as HTMLElement).blur(); handleToggleMute(); }}
          tabIndex={-1}
          className="bg-[#1A1A0E]/80 hover:bg-[#1A1A0E] rounded-lg p-2 sm:p-1.5 border border-[#8B4513] transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
        </button>
        {/* Music toggle */}
        <button
          onClick={(e) => {
            (e.target as HTMLElement).blur();
            soundManager.resumeContext();
            if (soundManager.isMusicPlaying()) {
              soundManager.stopMusic();
            } else {
              soundManager.startMusic();
            }
            setMusicPlaying(!musicPlaying);
          }}
          tabIndex={-1}
          className="bg-[#1A1A0E]/80 hover:bg-[#1A1A0E] rounded-lg p-2 sm:p-1.5 border border-[#8B4513] transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          title={musicPlaying ? "Stop Music" : "Start Music"}
        >
          {musicPlaying ? <MusicOnIcon /> : <MusicOffIcon />}
        </button>
        {/* Settings gear */}
        {onToggleMoveArcs && (
          <div className="relative">
            <button
              onClick={(e) => { (e.target as HTMLElement).blur(); setSettingsOpen(!settingsOpen); }}
              tabIndex={-1}
              className="bg-[#1A1A0E]/80 hover:bg-[#1A1A0E] rounded-lg p-2 sm:p-1.5 border border-[#8B4513] transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Settings"
            >
              <GearIcon />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#1A1A0E]/95 rounded-lg border border-[#8B4513] p-3 min-w-[180px] z-50 shadow-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMoveArcs ?? true}
                    onChange={(e) => onToggleMoveArcs(e.target.checked)}
                    className="accent-[#D4A857] w-4 h-4 cursor-pointer"
                  />
                  <span className="font-heading text-xs text-[#D4A857]">Show move arcs</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Board area — canvas (children) with overlay on top */}
    <div className="relative">
      {children}
      <div className="absolute inset-0 pointer-events-none z-10">
      {/* Doubling cube - small passive indicator, only visible when value > 1 */}
      {cubeValue > 1 && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <div className="w-8 h-8 rounded bg-[#1A1A0E]/80 border border-[#8B4513] flex items-center justify-center">
            <span className="font-heading text-xs text-[#D4A857]">{cubeValue}x</span>
          </div>
        </div>
      )}

      {/* Bottom bar: undo + turn indicator / roll button */}
      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-3 pb-2">
        <div className="flex items-center gap-2 pointer-events-auto">
          {canUndo && onUndo && (
            <button
              onClick={(e) => { (e.target as HTMLElement).blur(); onUndo(); }}
              tabIndex={-1}
              className="
                bg-[#1A1A0E]/80 hover:bg-[#1A1A0E]
                text-[#D4A857] font-heading text-xs
                px-4 py-2 rounded-lg min-h-[44px]
                border border-[#8B4513]
                hover:border-[#D4A857]
                transition-all duration-150
                cursor-pointer
              "
              title="Undo last move"
            >
              Undo
            </button>
          )}
        </div>
        {canRoll ? (
          <button
            onClick={(e) => {
              (e.target as HTMLElement).blur();
              soundManager.resumeContext();
              onRollDice();
            }}
            tabIndex={-1}
            className="
              pointer-events-auto
              bg-gradient-to-b from-[#D4A857] to-[#8B4513]
              text-[#1A1A0E] font-heading text-sm
              px-6 py-2 rounded-lg min-h-[44px]
              border border-[#FFD700]
              shadow-md shadow-[#FFD700]/15
              hover:brightness-110 active:scale-95
              transition-all duration-150
              animate-pulse
              cursor-pointer
            "
          >
            Roll Dice
          </button>
        ) : (
          <div className="bg-[#1A1A0E]/80 rounded-lg px-4 py-1.5 border border-[#8B4513]">
            <span className="font-heading text-sm text-[#D4A857]">
              {turnText}
            </span>
          </div>
        )}
      </div>
    </div>
    </div>

    {/* Bottom bar: player name — BELOW the board */}
    <div className="flex items-center justify-between px-1 pt-1">
      <PlayerBadge name="You" color={playerColor} />
    </div>
    </>
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

function MusicOnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function MusicOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

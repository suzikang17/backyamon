"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "tldraw/tldraw.css";

const Tldraw = dynamic(() => import("tldraw").then((m) => m.Tldraw), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-[#1A1A0E]">
      <span className="text-[#D4A857] text-sm font-heading animate-pulse">Loading canvas...</span>
    </div>
  ),
});

type Variant = "gold" | "red";

interface PieceDesignerProps {
  onSave: (goldSvg: string, redSvg: string) => void;
}

interface EditorInstance {
  getCurrentPageShapeIds: () => Set<unknown>;
  getSvgString: (
    ids: unknown[]
  ) => Promise<{ svg: string } | undefined>;
}

export function PieceDesigner({ onSave }: PieceDesignerProps) {
  const [activeVariant, setActiveVariant] = useState<Variant>("gold");
  const [goldSvg, setGoldSvg] = useState<string | null>(null);
  const [redSvg, setRedSvg] = useState<string | null>(null);

  const goldEditorRef = useRef<EditorInstance | null>(null);
  const redEditorRef = useRef<EditorInstance | null>(null);

  const extractSvg = useCallback(
    async (editor: EditorInstance): Promise<string | null> => {
      try {
        const ids = editor.getCurrentPageShapeIds();
        if (ids.size === 0) return null;
        // getSvgString expects an array, not a Set
        const result = await editor.getSvgString([...ids]);
        return result?.svg ?? null;
      } catch {
        return null;
      }
    },
    []
  );

  // When switching tabs, capture the current variant's SVG
  const handleTabSwitch = useCallback(
    async (next: Variant) => {
      if (next === activeVariant) return;

      const currentEditor =
        activeVariant === "gold" ? goldEditorRef.current : redEditorRef.current;
      if (currentEditor) {
        const svg = await extractSvg(currentEditor);
        if (activeVariant === "gold") {
          setGoldSvg(svg);
        } else {
          setRedSvg(svg);
        }
      }

      setActiveVariant(next);
    },
    [activeVariant, extractSvg]
  );

  // Periodically capture SVG for preview (debounced on a timer)
  const previewTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    previewTimerRef.current = setInterval(async () => {
      const editor =
        activeVariant === "gold"
          ? goldEditorRef.current
          : redEditorRef.current;
      if (!editor) return;
      const svg = await extractSvg(editor);
      if (activeVariant === "gold") {
        setGoldSvg(svg);
      } else {
        setRedSvg(svg);
      }
    }, 2000);

    return () => {
      if (previewTimerRef.current) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, [activeVariant, extractSvg]);

  const handleSave = useCallback(async () => {
    // Capture current tab before saving
    const currentEditor =
      activeVariant === "gold" ? goldEditorRef.current : redEditorRef.current;
    let finalGold = goldSvg;
    let finalRed = redSvg;

    if (currentEditor) {
      const svg = await extractSvg(currentEditor);
      if (activeVariant === "gold") {
        finalGold = svg;
      } else {
        finalRed = svg;
      }
    }

    if (!finalGold || !finalRed) {
      return;
    }

    onSave(finalGold, finalRed);
  }, [activeVariant, goldSvg, redSvg, extractSvg, onSave]);

  const hasGold = goldSvg !== null;
  const hasRed = redSvg !== null;
  const previewSvg = activeVariant === "gold" ? goldSvg : redSvg;

  return (
    <div className="flex flex-col gap-6">
      {/* Variant tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleTabSwitch("gold")}
          className={`rounded-xl px-6 py-2 font-heading text-sm font-bold transition-all cursor-pointer ${
            activeVariant === "gold"
              ? "bg-[#FFD700] text-[#1A1A0E] shadow-[0_0_12px_rgba(255,215,0,0.3)]"
              : "bg-[#1A1A0E] text-[#FFD700] border border-[#FFD700]/40 hover:border-[#FFD700]"
          }`}
        >
          Gold Variant {hasGold ? " (drawn)" : ""}
        </button>
        <button
          type="button"
          onClick={() => handleTabSwitch("red")}
          className={`rounded-xl px-6 py-2 font-heading text-sm font-bold transition-all cursor-pointer ${
            activeVariant === "red"
              ? "bg-[#CE1126] text-white shadow-[0_0_12px_rgba(206,17,38,0.3)]"
              : "bg-[#1A1A0E] text-[#CE1126] border border-[#CE1126]/40 hover:border-[#CE1126]"
          }`}
        >
          Red Variant {hasRed ? " (drawn)" : ""}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Canvas area */}
        <div className="relative w-full max-w-[400px] aspect-square">
          {/* Circular guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="w-[90%] h-[90%] rounded-full border-2 border-dashed opacity-30"
              style={{
                borderColor:
                  activeVariant === "gold" ? "#FFD700" : "#CE1126",
              }}
            />
          </div>

          {/* Tldraw canvas - Gold */}
          <div
            className="h-[400px] w-full rounded-xl overflow-hidden border border-[#8B4513]/60"
            style={{
              display: activeVariant === "gold" ? "block" : "none",
            }}
          >
            <Tldraw
              onMount={(editor) => {
                goldEditorRef.current = editor as unknown as EditorInstance;
              }}
            />
          </div>

          {/* Tldraw canvas - Red */}
          <div
            className="h-[400px] w-full rounded-xl overflow-hidden border border-[#8B4513]/60"
            style={{
              display: activeVariant === "red" ? "block" : "none",
            }}
          >
            <Tldraw
              onMount={(editor) => {
                redEditorRef.current = editor as unknown as EditorInstance;
              }}
            />
          </div>
        </div>

        {/* Preview section */}
        <div className="flex flex-col gap-4">
          <p className="text-[#D4A857] text-xs font-heading tracking-wider uppercase">
            Preview at Game Sizes
          </p>

          <div className="flex items-end gap-6">
            {[40, 30, 20].map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <div
                  className="rounded-full overflow-hidden flex items-center justify-center"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor:
                      activeVariant === "gold"
                        ? "rgba(255, 215, 0, 0.15)"
                        : "rgba(206, 17, 38, 0.15)",
                    border: `2px solid ${activeVariant === "gold" ? "#FFD700" : "#CE1126"}`,
                  }}
                >
                  {previewSvg ? (
                    <img
                      src={`data:image/svg+xml;base64,${btoa(previewSvg)}`}
                      alt="Piece preview"
                      style={{ width: size - 4, height: size - 4 }}
                    />
                  ) : (
                    <span
                      className="text-[#D4A857]/30"
                      style={{ fontSize: size * 0.4 }}
                    >
                      ?
                    </span>
                  )}
                </div>
                <span className="text-[#D4A857]/50 text-xs font-heading">
                  {size}px
                </span>
              </div>
            ))}
          </div>

          {/* Save status */}
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${hasGold ? "bg-[#006B3F]" : "bg-[#D4A857]/30"}`}
              />
              <span className="text-[#D4A857] text-xs font-heading">
                Gold variant {hasGold ? "ready" : "not drawn"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${hasRed ? "bg-[#006B3F]" : "bg-[#D4A857]/30"}`}
              />
              <span className="text-[#D4A857] text-xs font-heading">
                Red variant {hasRed ? "ready" : "not drawn"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasGold || !hasRed}
            className="mt-2 rounded-2xl wood-btn wood-btn-green px-8 py-3 text-lg font-bold text-[#FFD700] shadow-lg interactive-btn cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-heading hover:shadow-[0_0_20px_rgba(0,107,63,0.4)]"
          >
            Save Piece
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { audioUrl, type UploadResult } from "../lib/api";
import TrimWaveform from "./TrimWaveform";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

interface DescribeViewProps {
  upload: UploadResult;
  onIsolate: (description: string, trimStart?: number, trimEnd?: number) => void;
  isProcessing: boolean;
}

export default function DescribeView({
  upload,
  onIsolate,
  isProcessing,
}: DescribeViewProps) {
  const [description, setDescription] = useState("");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(upload.duration);
  const isTrimmed = trimStart > 0.1 || trimEnd < upload.duration - 0.1;

  const handleTrimChange = useCallback((start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

  const handleResetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(upload.duration);
  }, [upload.duration]);

  const handleSubmit = () => {
    const trimmed = description.trim();
    if (trimmed) {
      onIsolate(trimmed, isTrimmed ? trimStart : undefined, isTrimmed ? trimEnd : undefined);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left panel */}
      <div className="w-[340px] min-w-[340px] bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col">
        <div className="p-6 flex-1">
          <h2 className="text-base font-semibold mb-1">Choose what to isolate</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Describe a sound or highlight when it happens in the timeline.
          </p>

          {/* Text input */}
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "man talking", "guitar", "birds chirping"'
              className="w-full bg-[var(--bg-surface-hover)] border border-[var(--border-color)] rounded-lg p-3 pr-8 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none focus:outline-none focus:border-[var(--accent-teal)]"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {description && (
              <button
                onClick={() => setDescription("")}
                className="absolute right-3 top-3 text-[var(--text-secondary)] hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Waveform icon */}
          <div className="mt-4 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" />
            </svg>
          </div>
        </div>

        {/* Isolate button */}
        <div className="p-4">
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || isProcessing}
            className="w-full py-3 rounded-full flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent-teal)] text-black hover:opacity-90"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Isolating sound...
              </>
            ) : (
              <>
                Isolate sound
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right panel - Preview */}
      <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
          {upload.has_video ? (
            <video
              src={audioUrl(upload.file_id, "source")}
              controls
              className="w-full h-full object-contain rounded-lg bg-black"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <audio
                src={audioUrl(upload.file_id, "audio")}
                controls
                className="w-full max-w-md"
              />
            </div>
          )}
        </div>

        {/* Bottom waveform with trim */}
        <div className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] px-3 pt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-secondary)]">
              Drag handles to trim &middot;{" "}
              <span className="text-[var(--accent-teal)]">
                {formatTime(trimStart)} &ndash; {formatTime(trimEnd)}
              </span>
              {" "}({formatTime(trimEnd - trimStart)})
            </span>
            {isTrimmed && (
              <button
                onClick={handleResetTrim}
                className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <TrimWaveform
            data={upload.waveform}
            color="#00c9a7"
            height={64}
            duration={upload.duration}
            trimStart={trimStart}
            trimEnd={trimEnd}
            onTrimChange={handleTrimChange}
          />
        </div>

        {/* Loading overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50">
            <div className="w-12 h-12 border-3 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium">Isolating sound...</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              This may take 10-30 seconds depending on audio length
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

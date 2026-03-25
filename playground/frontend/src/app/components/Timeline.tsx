"use client";

import Waveform from "./Waveform";

interface Track {
  label: string;
  trackId: string;
  data: number[];
  color: string;
  muted: boolean;
  onToggleMute: () => void;
}

interface TimelineProps {
  tracks: Track[];
  selectedTrack: string;
  onSelectTrack: (trackId: string) => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

function MuteButton({
  muted,
  onClick,
}: {
  muted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded hover:bg-[var(--bg-surface-hover)] transition-colors"
      title={muted ? "Unmute" : "Mute"}
    >
      {muted ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Timeline({
  tracks,
  selectedTrack,
  onSelectTrack,
  currentTime,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
}: TimelineProps) {
  return (
    <div className="bg-[var(--bg-surface)] border-t border-[var(--border-color)]">
      {/* Playback controls */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border-color)]">
        <button
          onClick={onTogglePlay}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--bg-surface-hover)] hover:bg-[var(--border-color)] transition-colors"
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <span className="text-sm text-[var(--text-secondary)] font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Tracks */}
      <div className="flex flex-col">
        {tracks.map((track) => {
          const isSelected = track.trackId === selectedTrack;
          return (
            <div
              key={track.trackId}
              onClick={() => onSelectTrack(track.trackId)}
              className="flex items-center border-b last:border-b-0 cursor-pointer transition-colors"
              style={{
                borderColor: isSelected ? track.color : "var(--border-color)",
                borderWidth: isSelected ? "2px" : "1px",
                borderStyle: "solid",
                borderLeftWidth: 0,
                borderRightWidth: 0,
              }}
            >
              <MuteButton muted={track.muted} onClick={track.onToggleMute} />
              <div className="flex-1">
                <Waveform
                  data={track.data}
                  color={track.color}
                  height={40}
                  currentTime={currentTime}
                  duration={duration}
                  label={track.label}
                  onSeek={onSeek}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

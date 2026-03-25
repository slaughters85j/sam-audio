"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioUrl,
  listSamples,
  loadSample,
  uploadFile,
  type Sample,
  type UploadResult,
} from "../lib/api";
import type { MediaHistoryItem } from "../lib/media-history";
import { encodeWav } from "../lib/wav-encoder";
import { useAudioEngine } from "../hooks/useAudioEngine";
import EffectsPanel from "./EffectsPanel";
import Timeline from "./Timeline";

interface ResultsViewProps {
  upload: UploadResult;
  originalWaveform: number[];
  targetWaveform: number[];
  residualWaveform: number[];
  onStartOver: () => void;
  onNewMedia?: (upload: UploadResult) => void;
  mediaHistory?: MediaHistoryItem[];
}

export default function ResultsView({
  upload,
  originalWaveform = [],
  targetWaveform,
  residualWaveform,
  onStartOver,
  onNewMedia,
  mediaHistory = [],
}: ResultsViewProps) {
  const {
    state,
    loadBuffers,
    togglePlay,
    seek,
    setTrackMuted,
    setTrackVolume,
    setSelectedTrack,
    setEffectTab,
    toggleEffect,
    setEffectIntensity,
    getCtx,
  } = useAudioEngine(upload.file_id);

  useEffect(() => {
    loadBuffers(upload.file_id, ["original", "target", "residual"]);
  }, [upload.file_id, loadBuffers]);

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  // Video sync
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (state.isPlaying) {
      video.currentTime = state.currentTime;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = state.currentTime;
    }
  }, [state.isPlaying]);

  // Sync video on seek when paused
  useEffect(() => {
    const video = videoRef.current;
    if (!video || state.isPlaying) return;
    video.currentTime = state.currentTime;
  }, [state.currentTime, state.isPlaying]);

  // Drift correction during playback
  useEffect(() => {
    if (!state.isPlaying) return;
    const video = videoRef.current;
    if (!video) return;
    const interval = setInterval(() => {
      if (Math.abs(video.currentTime - state.currentTime) > 0.3) {
        video.currentTime = state.currentTime;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.currentTime]);

  const downloadTrack = useCallback(
    async (trackName: string, label: string) => {
      setShowDownloadMenu(false);
      const ctx = getCtx();
      const res = await fetch(audioUrl(upload.file_id, trackName));
      const buf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));

      const offCtx = new OfflineAudioContext(
        audioBuf.numberOfChannels,
        audioBuf.length,
        audioBuf.sampleRate
      );
      const source = offCtx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(offCtx.destination);
      source.start();

      const rendered = await offCtx.startRendering();
      const blob = encodeWav(rendered);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label}-${upload.filename || "audio"}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [upload.file_id, upload.filename, getCtx]
  );

  const handleDownloadBoth = useCallback(async () => {
    setShowDownloadMenu(false);
    await downloadTrack("target", "isolated");
    await downloadTrack("residual", "without-isolated");
  }, [downloadTrack]);

  const TRACK_COLORS: Record<string, string> = {
    original: "#00c9a7",
    target: "#ff6b9d",
    residual: "#7b68ee",
  };

  const tracks = [
    {
      label: "Original sound",
      trackId: "original",
      data: originalWaveform?.length > 0 ? originalWaveform : upload.waveform,
      color: TRACK_COLORS.original,
      muted: state.tracks.original.muted,
      onToggleMute: () =>
        setTrackMuted("original", !state.tracks.original.muted),
    },
    {
      label: "Isolated sound",
      trackId: "target",
      data: targetWaveform,
      color: TRACK_COLORS.target,
      muted: state.tracks.target.muted,
      onToggleMute: () =>
        setTrackMuted("target", !state.tracks.target.muted),
    },
    {
      label: "Without isolated sound",
      trackId: "residual",
      data: residualWaveform,
      color: TRACK_COLORS.residual,
      muted: state.tracks.residual.muted,
      onToggleMute: () =>
        setTrackMuted("residual", !state.tracks.residual.muted),
    },
  ];

  const currentVolume = state.tracks[state.selectedTrack].volume;
  const selectedColor = TRACK_COLORS[state.selectedTrack];

  return (
    <div className="flex h-screen">
      {/* Effects sidebar */}
      <EffectsPanel
        effectTab={state.effectTab}
        onSetTab={setEffectTab}
        volume={currentVolume}
        onVolumeChange={(v) => setTrackVolume(state.selectedTrack, v)}
        volumeColor={selectedColor}
        activeEffects={state.perTrackEffects[state.effectTab]}
        onToggleEffect={toggleEffect}
        onSetIntensity={setEffectIntensity}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
          <div />
          <div className="flex items-center gap-2">
            <button
              onClick={onStartOver}
              className="px-5 py-2 rounded-full text-sm border border-[var(--border-color-hover)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={() => setShowMediaModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-[var(--border-color-hover)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              title="Select media"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu((v) => !v)}
                className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{ border: `2px solid ${selectedColor}` }}
                title="Download"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {showDownloadMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDownloadMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg py-1">
                    <button
                      onClick={() => downloadTrack("target", "isolated")}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Isolated sound
                    </button>
                    <button
                      onClick={() =>
                        downloadTrack("residual", "without-isolated")
                      }
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Without isolated sound
                    </button>
                    <div className="border-t border-[var(--border-color)] my-1" />
                    <button
                      onClick={handleDownloadBoth}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Both
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center p-2 bg-[var(--bg-primary)] min-h-0">
          {upload.has_video ? (
            <video
              ref={videoRef}
              src={audioUrl(upload.file_id, "source")}
              className="w-full h-full object-contain rounded-lg bg-black"
              muted
              playsInline
            />
          ) : (
            <div className="text-center text-[var(--text-secondary)]">
              <svg
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="mx-auto mb-4 opacity-30"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <p className="text-sm">{upload.filename}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <Timeline
          tracks={tracks}
          selectedTrack={state.selectedTrack}
          onSelectTrack={(id) =>
            setSelectedTrack(id as "original" | "target" | "residual")
          }
          currentTime={state.currentTime}
          duration={state.duration}
          isPlaying={state.isPlaying}
          onTogglePlay={togglePlay}
          onSeek={seek}
        />
      </div>

      {/* Media library modal */}
      {showMediaModal && (
        <MediaModal
          onClose={() => setShowMediaModal(false)}
          onSelect={(result) => {
            setShowMediaModal(false);
            onNewMedia?.(result);
          }}
          history={mediaHistory}
        />
      )}
    </div>
  );
}

// ── Media Library Modal ─────────────────────────────────────────────────────

function MediaModal({
  onClose,
  onSelect,
  history,
}: {
  onClose: () => void;
  onSelect: (upload: UploadResult) => void;
  history: MediaHistoryItem[];
}) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSamples().then(setSamples).catch(console.error);
  }, []);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const result = await uploadFile(file);
      onSelect(result);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSample = async (filename: string) => {
    setLoading(true);
    try {
      const result = await loadSample(filename);
      onSelect(result);
    } catch (e) {
      console.error("Failed to load sample:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryItem = (item: MediaHistoryItem) => {
    onSelect({
      file_id: item.file_id,
      filename: item.filename,
      has_video: item.has_video,
      duration: item.duration,
      waveform: item.waveform,
      sample_rate: 48000,
    });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold">Select media</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
            <div className="w-10 h-10 border-2 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-3 gap-3">
            {/* Upload card */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-video rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--border-color-hover)] flex flex-col items-center justify-center gap-2 transition-colors"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[var(--text-secondary)]"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-sm text-[var(--text-primary)]">Upload</span>
              <span className="text-xs text-[var(--text-secondary)]">
                Max 70 MB
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            {/* History items */}
            {history.map((item) => (
              <button
                key={item.file_id}
                onClick={() => handleHistoryItem(item)}
                className="aspect-video rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-color)] flex flex-col items-center justify-center gap-1 transition-colors overflow-hidden relative"
              >
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.filename}
                    className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  />
                ) : item.has_video ? (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-[var(--text-secondary)]"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                ) : (
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-[var(--text-secondary)]"
                  >
                    <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" />
                  </svg>
                )}
                {/* Label overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4 rounded-b-lg">
                  <span className="text-xs text-white block truncate">
                    {item.filename.replace(/\.[^.]+$/, "")}
                  </span>
                  <span className="text-[10px] text-white/60">
                    {formatDuration(item.duration)}
                  </span>
                </div>
              </button>
            ))}

            {/* Sample cards (only show if not already in history) */}
            {samples
              .filter(
                (s) => !history.some((h) => h.filename === s.filename)
              )
              .map((sample) => (
                <button
                  key={sample.filename}
                  onClick={() => handleSample(sample.filename)}
                  className="aspect-video rounded-lg bg-[var(--bg-surface-hover)] hover:bg-[var(--border-color)] flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden relative"
                >
                  {sample.has_video ? (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-[var(--text-secondary)]"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  ) : (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-[var(--text-secondary)]"
                    >
                      <path d="M12 3v18M8 7v10M4 10v4M16 7v10M20 10v4" />
                    </svg>
                  )}
                  <span className="text-xs text-[var(--text-secondary)] px-2 text-center">
                    {sample.filename.replace(/\.[^.]+$/, "")}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

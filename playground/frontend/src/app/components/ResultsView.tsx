"use client";

import { useCallback, useEffect, useState } from "react";
import { audioUrl, type UploadResult } from "../lib/api";
import { encodeWav } from "../lib/wav-encoder";
import { useAudioEngine } from "../hooks/useAudioEngine";
import EffectsPanel from "./EffectsPanel";
import Timeline from "./Timeline";

interface ResultsViewProps {
  upload: UploadResult;
  targetWaveform: number[];
  residualWaveform: number[];
  onStartOver: () => void;
}

export default function ResultsView({
  upload,
  targetWaveform,
  residualWaveform,
  onStartOver,
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

  const downloadTrack = useCallback(async (trackName: string, label: string) => {
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
  }, [upload.file_id, upload.filename, getCtx]);

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
      data: upload.waveform,
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
          <div className="flex items-center gap-3">
            <button
              onClick={onStartOver}
              className="px-4 py-1.5 rounded-full text-sm border border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              Start Over
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDownloadMenu((v) => !v)}
                className="p-2 rounded-full hover:bg-[var(--bg-surface-hover)] transition-colors"
                title="Download"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {showDownloadMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDownloadMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-lg py-1">
                    <button
                      onClick={() => downloadTrack("target", "isolated")}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-surface-hover)] transition-colors"
                    >
                      Isolated sound
                    </button>
                    <button
                      onClick={() => downloadTrack("residual", "without-isolated")}
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
        <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg-primary)]">
          {upload.has_video ? (
            <video
              src={audioUrl(upload.file_id, "original")}
              className="max-w-full max-h-[60vh] rounded-lg"
              muted
            />
          ) : (
            <div className="text-center text-[var(--text-secondary)]">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-4 opacity-30">
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
          onSelectTrack={(id) => setSelectedTrack(id as "original" | "target" | "residual")}
          currentTime={state.currentTime}
          duration={state.duration}
          isPlaying={state.isPlaying}
          onTogglePlay={togglePlay}
          onSeek={seek}
        />
      </div>
    </div>
  );
}

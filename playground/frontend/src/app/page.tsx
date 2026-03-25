"use client";

import { useCallback, useState } from "react";
import { separateAudio, type UploadResult } from "./lib/api";
import UploadView from "./components/UploadView";
import DescribeView from "./components/DescribeView";
import ResultsView from "./components/ResultsView";

type AppView = "upload" | "describe" | "results";

interface DurationWarning {
  upload: UploadResult;
}

export default function Home() {
  const [view, setView] = useState<AppView>("upload");
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [targetWaveform, setTargetWaveform] = useState<number[]>([]);
  const [residualWaveform, setResidualWaveform] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationWarning, setDurationWarning] = useState<DurationWarning | null>(null);

  const proceedWithUpload = useCallback((result: UploadResult) => {
    setUpload(result);
    setView("describe");
    setError(null);
  }, []);

  const handleUploaded = useCallback(
    (result: UploadResult) => {
      if (result.duration > 60) {
        setDurationWarning({ upload: result });
      } else {
        proceedWithUpload(result);
      }
    },
    [proceedWithUpload]
  );

  const handleIsolate = useCallback(
    async (description: string) => {
      if (!upload) return;
      setIsProcessing(true);
      setError(null);
      try {
        const result = await separateAudio(upload.file_id, description);
        setTargetWaveform(result.target_waveform);
        setResidualWaveform(result.residual_waveform);
        setView("results");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Separation failed");
      } finally {
        setIsProcessing(false);
      }
    },
    [upload]
  );

  const handleStartOver = useCallback(() => {
    setView("upload");
    setUpload(null);
    setTargetWaveform([]);
    setResidualWaveform([]);
    setError(null);
  }, []);

  return (
    <main className="relative">
      {view === "upload" && <UploadView onUploaded={handleUploaded} />}
      {view === "describe" && upload && (
        <DescribeView
          upload={upload}
          onIsolate={handleIsolate}
          isProcessing={isProcessing}
        />
      )}
      {view === "results" && upload && (
        <ResultsView
          upload={upload}
          targetWaveform={targetWaveform}
          residualWaveform={residualWaveform}
          onStartOver={handleStartOver}
        />
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-sm">
          <div className="flex items-start gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-300 hover:text-white mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duration warning modal */}
      {durationWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="text-lg font-semibold">Long audio detected</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-2">
              This file is <strong className="text-white">{Math.round(durationWarning.upload.duration)}s</strong> long.
              Audio over 60 seconds may:
            </p>
            <ul className="text-sm text-[var(--text-secondary)] mb-6 space-y-1 ml-4">
              <li className="list-disc">Take significantly longer to process</li>
              <li className="list-disc">Produce lower quality results</li>
              <li className="list-disc">Use more GPU memory</li>
            </ul>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDurationWarning(null)}
                className="px-4 py-2 rounded-lg text-sm border border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  proceedWithUpload(durationWarning.upload);
                  setDurationWarning(null);
                }}
                className="px-4 py-2 rounded-lg text-sm bg-[var(--accent-teal)] text-black font-medium hover:opacity-90 transition-colors"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

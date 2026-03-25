"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listSamples, loadSample, uploadFile, type Sample, type UploadResult } from "../lib/api";

interface UploadViewProps {
  onUploaded: (result: UploadResult) => void;
}

export default function UploadView({ onUploaded }: UploadViewProps) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listSamples().then(setSamples).catch(console.error);
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      try {
        const result = await uploadFile(file);
        onUploaded(result);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleSample = useCallback(
    async (filename: string) => {
      setError(null);
      setIsUploading(true);
      try {
        const result = await loadSample(filename);
        onUploaded(result);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load sample");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploaded]
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-[260px] min-w-[260px] bg-[var(--bg-surface)] border-r border-[var(--border-color)] p-6 flex flex-col">
        <h1 className="text-lg font-semibold mb-1">Isolate sounds</h1>
        <p className="text-xs text-[var(--text-secondary)] mb-6">
          Extract sounds and add effects to them.
        </p>

        <div className="border-t border-[var(--border-color)] pt-4 mb-6">
          <h3 className="text-sm font-medium mb-3">How it works</h3>
          <ol className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li className="flex gap-2">
              <span className="text-[var(--text-primary)]">1.</span> Add audio or video
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--text-primary)]">2.</span> Isolate sound
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--text-primary)]">3.</span> Add effects
            </li>
          </ol>
        </div>

        <div className="mt-auto">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Model</div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-surface-hover)] text-xs">
            SAM Audio
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Upload zone */}
        <div
          className={`w-full max-w-4xl border-2 border-dashed rounded-xl p-16 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging
              ? "border-[var(--accent-teal)] bg-[var(--accent-teal-dim)]"
              : "border-[var(--border-color)] hover:border-[var(--border-color-hover)]"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[var(--accent-teal)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--text-secondary)]">
                Processing...
              </span>
            </div>
          ) : (
            <>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-[var(--text-secondary)] mb-4"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm text-[var(--text-primary)] mb-4">
                Start with your own audio or video
              </p>
              <button className="px-5 py-2 rounded-full border border-[var(--accent-teal)] text-[var(--accent-teal)] text-sm hover:bg-[var(--accent-teal-dim)] transition-colors">
                Upload
              </button>
            </>
          )}
        </div>

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

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* Samples */}
        {samples.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Or try a sample audio or video
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              {samples.map((sample) => (
                <button
                  key={sample.filename}
                  onClick={() => handleSample(sample.filename)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-color)] transition-colors"
                >
                  <div className="w-24 h-16 rounded bg-[var(--bg-surface-hover)] flex items-center justify-center">
                    {sample.has_video ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--text-secondary)]">
                        <path d="M9 18V5l12-2v13" />
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="16" r="3" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {sample.filename.replace(/\.[^.]+$/, "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

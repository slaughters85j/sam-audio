"use client";

import { useEffect, useRef } from "react";

interface WaveformProps {
  data: number[];
  color: string;
  height?: number;
  currentTime?: number;
  duration?: number;
  label?: string;
  onSeek?: (time: number) => void;
}

export default function Waveform({
  data,
  color,
  height = 48,
  currentTime = 0,
  duration = 0,
  label,
  onSeek,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw waveform
    const barWidth = w / data.length;
    const mid = h / 2;
    const maxAmp = Math.max(...data, 0.01);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < data.length; i++) {
      const amp = (data[i] / maxAmp) * mid * 0.85;
      const x = i * barWidth;
      ctx.fillRect(x, mid - amp, Math.max(barWidth - 0.5, 1), amp * 2 || 1);
    }
    ctx.globalAlpha = 1;

    // Draw playhead
    if (duration > 0) {
      const progress = currentTime / duration;
      const px = progress * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
  }, [data, color, currentTime, duration]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    onSeek(progress * duration);
  };

  return (
    <div className="relative" style={{ height }}>
      {label && (
        <span
          className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-0.5 rounded z-10"
          style={{ backgroundColor: color + "33", color }}
        >
          {label}
        </span>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        style={{ height }}
        onClick={handleClick}
      />
    </div>
  );
}

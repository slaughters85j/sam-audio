"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TrimWaveformProps {
  data: number[];
  color: string;
  height?: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  onTrimChange: (start: number, end: number) => void;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

type DragTarget = "start" | "end" | "region" | null;

export default function TrimWaveform({
  data,
  color,
  height = 80,
  duration,
  trimStart,
  trimEnd,
  onTrimChange,
  currentTime = 0,
  onSeek,
}: TrimWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const dragOriginRef = useRef({ x: 0, start: 0, end: 0 });

  // Draw waveform + trim overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0 || duration <= 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const barWidth = w / data.length;
    const mid = h / 2;
    const maxAmp = Math.max(...data, 0.01);

    const startX = (trimStart / duration) * w;
    const endX = (trimEnd / duration) * w;

    // Draw dimmed waveform (outside trim region)
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < data.length; i++) {
      const amp = (data[i] / maxAmp) * mid * 0.85;
      const x = i * barWidth;
      if (x + barWidth < startX || x > endX) {
        ctx.fillRect(x, mid - amp, Math.max(barWidth - 0.5, 1), amp * 2 || 1);
      }
    }

    // Draw active waveform (inside trim region)
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < data.length; i++) {
      const amp = (data[i] / maxAmp) * mid * 0.85;
      const x = i * barWidth;
      if (x + barWidth >= startX && x <= endX) {
        ctx.fillRect(x, mid - amp, Math.max(barWidth - 0.5, 1), amp * 2 || 1);
      }
    }
    ctx.globalAlpha = 1;

    // Draw trim region border
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX, 0, endX - startX, h);

    // Draw handle bars
    const handleWidth = 6;
    const handleRadius = 2;

    // Left handle
    ctx.fillStyle = color;
    roundRect(ctx, startX - handleWidth / 2, 0, handleWidth, h, handleRadius);
    ctx.fill();

    // Right handle
    roundRect(ctx, endX - handleWidth / 2, 0, handleWidth, h, handleRadius);
    ctx.fill();

    // Handle grip lines (small dashes in center of handles)
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    const gripY = mid - 8;
    const gripH = 16;
    for (const hx of [startX, endX]) {
      ctx.beginPath();
      ctx.moveTo(hx - 1, gripY);
      ctx.lineTo(hx - 1, gripY + gripH);
      ctx.moveTo(hx + 1, gripY);
      ctx.lineTo(hx + 1, gripY + gripH);
      ctx.stroke();
    }

    // Draw playhead
    if (currentTime > 0 && duration > 0) {
      const px = (currentTime / duration) * w;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
    }
  }, [data, color, duration, trimStart, trimEnd, currentTime]);

  const getTimeFromX = useCallback(
    (clientX: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      return (x / rect.width) * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const w = rect.width;
      const startX = (trimStart / duration) * w;
      const endX = (trimEnd / duration) * w;
      const handleZone = 12;

      let target: DragTarget = null;

      if (Math.abs(x - startX) <= handleZone) {
        target = "start";
      } else if (Math.abs(x - endX) <= handleZone) {
        target = "end";
      } else if (x > startX && x < endX) {
        target = "region";
      }

      if (target) {
        e.preventDefault();
        setDragTarget(target);
        dragOriginRef.current = { x: e.clientX, start: trimStart, end: trimEnd };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else if (onSeek) {
        const time = getTimeFromX(e.clientX);
        onSeek(time);
      }
    },
    [trimStart, trimEnd, duration, onSeek, getTimeFromX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget) {
        // Update cursor based on hover position
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const w = rect.width;
        const startX = (trimStart / duration) * w;
        const endX = (trimEnd / duration) * w;
        const handleZone = 12;

        if (Math.abs(x - startX) <= handleZone || Math.abs(x - endX) <= handleZone) {
          containerRef.current!.style.cursor = "ew-resize";
        } else if (x > startX && x < endX) {
          containerRef.current!.style.cursor = "grab";
        } else {
          containerRef.current!.style.cursor = "pointer";
        }
        return;
      }

      const { x: originX, start, end } = dragOriginRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaTime = ((e.clientX - originX) / rect.width) * duration;
      const minSpan = 0.5; // minimum 0.5s selection

      if (dragTarget === "start") {
        const newStart = Math.max(0, Math.min(start + deltaTime, trimEnd - minSpan));
        onTrimChange(newStart, trimEnd);
      } else if (dragTarget === "end") {
        const newEnd = Math.min(duration, Math.max(end + deltaTime, trimStart + minSpan));
        onTrimChange(trimStart, newEnd);
      } else if (dragTarget === "region") {
        const span = end - start;
        let newStart = start + deltaTime;
        let newEnd = end + deltaTime;
        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - span;
        }
        onTrimChange(newStart, newEnd);
      }
    },
    [dragTarget, trimStart, trimEnd, duration, onTrimChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none"
      style={{ height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ height }}
      />
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

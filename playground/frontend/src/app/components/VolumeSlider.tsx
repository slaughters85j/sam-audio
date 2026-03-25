"use client";

interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
  color?: string;
  label?: string;
}

export default function VolumeSlider({
  value,
  onChange,
  color = "#00c9a7",
  label,
}: VolumeSliderProps) {
  const pct = Math.round(value * 100);

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="text-xs text-[var(--text-secondary)] w-16">{label}</span>
      )}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
      <div className="flex-1 relative h-[14px] flex items-center">
        {/* Visual track behind the input */}
        <div
          className="absolute left-0 right-0 h-1 rounded-full pointer-events-none"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--border-color) ${pct}%, var(--border-color) 100%)`,
          }}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative w-full slider-no-track"
        />
      </div>
    </div>
  );
}

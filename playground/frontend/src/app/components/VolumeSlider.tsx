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
  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className="text-xs text-[var(--text-secondary)] w-16">{label}</span>
      )}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
        style={
          {
            "--tw-ring-color": color,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

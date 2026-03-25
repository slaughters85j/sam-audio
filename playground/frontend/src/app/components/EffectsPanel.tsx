"use client";

import { useState } from "react";
import { getCategories, getEffectsByCategory } from "../lib/effects";
import VolumeSlider from "./VolumeSlider";

interface EffectsPanelProps {
  effectTab: "target" | "residual";
  onSetTab: (tab: "target" | "residual") => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  volumeColor: string;
  activeEffects: Map<string, number>;
  onToggleEffect: (id: string) => void;
  onSetIntensity: (id: string, v: number) => void;
}

export default function EffectsPanel({
  effectTab,
  onSetTab,
  volume,
  onVolumeChange,
  volumeColor,
  activeEffects,
  onToggleEffect,
  onSetIntensity,
}: EffectsPanelProps) {
  const categories = getCategories();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="w-[280px] min-w-[280px] bg-[var(--bg-surface)] border-r border-[var(--border-color)] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <h2 className="text-sm font-semibold mb-1">Add sound effects</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Apply effects to the isolated layer or switch to the background layer.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border-color)]">
        <button
          onClick={() => onSetTab("target")}
          className={`flex-1 text-xs py-2.5 transition-colors ${
            effectTab === "target"
              ? "text-white border-b-2 border-[var(--accent-pink)]"
              : "text-[var(--text-secondary)] hover:text-white"
          }`}
        >
          Isolated sound
        </button>
        <button
          onClick={() => onSetTab("residual")}
          className={`flex-1 text-xs py-2.5 transition-colors ${
            effectTab === "residual"
              ? "text-white border-b-2 border-[var(--accent-purple)]"
              : "text-[var(--text-secondary)] hover:text-white"
          }`}
        >
          Without isolated sound
        </button>
      </div>

      {/* Volume */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="text-xs text-[var(--text-secondary)] mb-2">Volume</div>
        <VolumeSlider
          value={volume}
          onChange={onVolumeChange}
          color={volumeColor}
        />
      </div>

      {/* Effects list */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((category) => {
          const effects = getEffectsByCategory(category);
          const isCollapsed = collapsed[category] ?? false;

          return (
            <div key={category}>
              <button
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [category]: !c[category] }))
                }
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                {category}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {!isCollapsed && (
                <div className="px-2 pb-2">
                  {effects.map((effect) => {
                    const isActive = activeEffects.has(effect.id);
                    const intensity = activeEffects.get(effect.id) ?? 50;

                    return (
                      <div key={effect.id}>
                        <button
                          onClick={() => onToggleEffect(effect.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                            isActive
                              ? "bg-[var(--bg-surface-hover)] text-white"
                              : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                          }`}
                        >
                          <span>{effect.name}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className="cursor-help"
                              title={effect.description}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-[var(--text-secondary)]"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </span>
                            {isActive && (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                className="text-[var(--accent-teal)]"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </button>
                        {isActive && (
                          <div className="px-3 pb-2 pt-1">
                            <input
                              type="range"
                              min="1"
                              max="100"
                              value={intensity}
                              onChange={(e) =>
                                onSetIntensity(
                                  effect.id,
                                  parseInt(e.target.value)
                                )
                              }
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

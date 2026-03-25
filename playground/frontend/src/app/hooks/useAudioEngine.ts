"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioUrl } from "../lib/api";
import { getEffectById, PITCH_EFFECTS } from "../lib/effects";

export interface TrackState {
  muted: boolean;
  volume: number;
}

export interface AudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tracks: {
    original: TrackState;
    target: TrackState;
    residual: TrackState;
  };
  selectedTrack: TrackName;
  perTrackEffects: {
    target: Map<string, number>;
    residual: Map<string, number>;
  };
  effectTab: "target" | "residual";
}

const TRACK_NAMES = ["original", "target", "residual"] as const;
type TrackName = (typeof TRACK_NAMES)[number];

export function useAudioEngine(fileId: string | null) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode | null>>({
    original: null,
    target: null,
    residual: null,
  });
  const gainsRef = useRef<Record<string, GainNode | null>>({
    original: null,
    target: null,
    residual: null,
  });
  const buffersRef = useRef<Record<string, AudioBuffer | null>>({
    original: null,
    target: null,
    residual: null,
  });
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const stateRef = useRef<AudioEngineState | null>(null);

  const [state, setState] = useState<AudioEngineState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tracks: {
      original: { muted: false, volume: 1 },
      target: { muted: false, volume: 1 },
      residual: { muted: false, volume: 1 },
    },
    selectedTrack: "target",
    perTrackEffects: {
      target: new Map(),
      residual: new Map(),
    },
    effectTab: "target",
  });

  // Keep a ref in sync with state for use in non-reactive callbacks
  stateRef.current = state;

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext({ sampleRate: 48000 });
    }
    return ctxRef.current;
  }, []);

  const loadBuffers = useCallback(
    async (fId: string, tracks: string[]) => {
      const ctx = getCtx();
      for (const track of tracks) {
        try {
          const res = await fetch(audioUrl(fId, track));
          const arrayBuf = await res.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arrayBuf);
          buffersRef.current[track] = audioBuf;
        } catch (e) {
          console.error(`Failed to load ${track}:`, e);
        }
      }
      const dur = Math.max(
        ...Object.values(buffersRef.current)
          .filter(Boolean)
          .map((b) => b!.duration)
      );
      setState((s) => ({ ...s, duration: dur }));
    },
    [getCtx]
  );

  const stopSources = useCallback(() => {
    for (const track of TRACK_NAMES) {
      try {
        sourcesRef.current[track]?.stop();
      } catch {
        // already stopped
      }
      try {
        sourcesRef.current[track]?.disconnect();
      } catch {
        // already disconnected
      }
      sourcesRef.current[track] = null;
      try {
        gainsRef.current[track]?.disconnect();
      } catch {
        // already disconnected
      }
      gainsRef.current[track] = null;
    }
    cancelAnimationFrame(rafRef.current);
  }, []);

  const updateTime = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed" || !isPlayingRef.current) return;

    const elapsed = ctx.currentTime - startTimeRef.current;
    const current = offsetRef.current + elapsed;
    const s = stateRef.current;
    if (s && current >= s.duration) {
      isPlayingRef.current = false;
      offsetRef.current = 0;
      setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
      stopSources();
      return;
    }
    setState((prev) => ({ ...prev, currentTime: current }));
    rafRef.current = requestAnimationFrame(updateTime);
  }, [stopSources]);

  const play = useCallback(() => {
    const ctx = getCtx();
    const s = stateRef.current;
    if (!s) return;

    stopSources();

    // Build and connect graph
    for (const track of TRACK_NAMES) {
      const buf = buffersRef.current[track];
      if (!buf) continue;

      const source = ctx.createBufferSource();
      source.buffer = buf;

      // Per-track effects
      const trackEffects =
        track !== "original" ? s.perTrackEffects[track] : null;

      let rate = 1.0;
      if (trackEffects) {
        for (const [effectId, intensity] of trackEffects) {
          if (PITCH_EFFECTS[effectId]) {
            rate = PITCH_EFFECTS[effectId](intensity);
          }
        }
      }
      source.playbackRate.value = rate;

      const gain = ctx.createGain();
      const ts = s.tracks[track];
      gain.gain.value = ts.muted ? 0 : ts.volume;

      // Wire effects for this track
      if (trackEffects && trackEffects.size > 0) {
        let lastOutput: AudioNode = source;
        for (const [effectId, intensity] of trackEffects) {
          if (PITCH_EFFECTS[effectId]) continue;
          const def = getEffectById(effectId);
          if (!def) continue;
          const chain = def.build(ctx, intensity);
          lastOutput.connect(chain.input);
          lastOutput = chain.output;
        }
        lastOutput.connect(gain);
      } else {
        source.connect(gain);
      }

      gain.connect(ctx.destination);
      sourcesRef.current[track] = source;
      gainsRef.current[track] = gain;
    }

    // Start all sources from the same offset
    const offset = offsetRef.current;
    for (const track of TRACK_NAMES) {
      const src = sourcesRef.current[track];
      if (src) {
        src.start(0, offset);
      }
    }

    startTimeRef.current = ctx.currentTime;
    if (ctx.state === "suspended") ctx.resume();

    isPlayingRef.current = true;
    setState((prev) => ({ ...prev, isPlaying: true }));
    rafRef.current = requestAnimationFrame(updateTime);
  }, [getCtx, stopSources, updateTime]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed") return;
    const elapsed = ctx.currentTime - startTimeRef.current;
    offsetRef.current += elapsed;
    isPlayingRef.current = false;
    stopSources();
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, [stopSources]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const seek = useCallback(
    (time: number) => {
      offsetRef.current = time;
      setState((prev) => ({ ...prev, currentTime: time }));
      if (isPlayingRef.current) {
        stopSources();
        play();
      }
    },
    [play, stopSources]
  );

  const setTrackMuted = useCallback(
    (track: TrackName, muted: boolean) => {
      setState((s) => ({
        ...s,
        tracks: { ...s.tracks, [track]: { ...s.tracks[track], muted } },
      }));
      const gain = gainsRef.current[track];
      if (gain) {
        const s = stateRef.current;
        gain.gain.value = muted ? 0 : (s?.tracks[track].volume ?? 1);
      }
    },
    []
  );

  const setTrackVolume = useCallback(
    (track: TrackName, volume: number) => {
      setState((s) => ({
        ...s,
        tracks: { ...s.tracks, [track]: { ...s.tracks[track], volume } },
      }));
      const gain = gainsRef.current[track];
      if (gain) {
        const s = stateRef.current;
        if (s && !s.tracks[track].muted) {
          gain.gain.value = volume;
        }
      }
    },
    []
  );

  const setEffectTab = useCallback((tab: "target" | "residual") => {
    setState((s) => ({ ...s, effectTab: tab, selectedTrack: tab }));
  }, []);

  const setSelectedTrack = useCallback((track: TrackName) => {
    setState((s) => {
      const update: Partial<AudioEngineState> = { selectedTrack: track };
      if (track === "target" || track === "residual") {
        update.effectTab = track;
      }
      return { ...s, ...update };
    });
  }, []);

  const toggleEffect = useCallback((effectId: string) => {
    setState((s) => {
      const tab = s.effectTab;
      const newEffects = new Map(s.perTrackEffects[tab]);
      if (newEffects.has(effectId)) {
        newEffects.delete(effectId);
      } else {
        newEffects.set(effectId, 50);
      }
      return {
        ...s,
        perTrackEffects: { ...s.perTrackEffects, [tab]: newEffects },
      };
    });
  }, []);

  const setEffectIntensity = useCallback(
    (effectId: string, intensity: number) => {
      setState((s) => {
        const tab = s.effectTab;
        const newEffects = new Map(s.perTrackEffects[tab]);
        newEffects.set(effectId, intensity);
        return {
          ...s,
          perTrackEffects: { ...s.perTrackEffects, [tab]: newEffects },
        };
      });
    },
    []
  );

  // Rebuild graph when effects change during playback
  useEffect(() => {
    if (isPlayingRef.current) {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state === "closed") return;
      const elapsed = ctx.currentTime - startTimeRef.current;
      offsetRef.current += elapsed;
      stopSources();
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.perTrackEffects, state.effectTab]);

  // Update gains live when mute/volume changes
  useEffect(() => {
    for (const track of TRACK_NAMES) {
      const gain = gainsRef.current[track];
      if (gain) {
        const ts = state.tracks[track];
        gain.gain.value = ts.muted ? 0 : ts.volume;
      }
    }
  }, [state.tracks]);

  // Cleanup - don't close the context, just stop sources
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      isPlayingRef.current = false;
      for (const track of TRACK_NAMES) {
        try { sourcesRef.current[track]?.stop(); } catch {}
        try { sourcesRef.current[track]?.disconnect(); } catch {}
        sourcesRef.current[track] = null;
        try { gainsRef.current[track]?.disconnect(); } catch {}
        gainsRef.current[track] = null;
      }
    };
  }, []);

  return {
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
  };
}

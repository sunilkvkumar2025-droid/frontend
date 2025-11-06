// hooks/useAudioQueue.ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ---- module-level singletons (survive React Strict Mode re-mounts) ----
let sharedEl: HTMLAudioElement | null = null;
let sharedCtx: AudioContext | null = null;
let sharedSrc: MediaElementAudioSourceNode | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let sharedZero: GainNode | null = null;
let sharedStreamGain: GainNode | null = null;

type StreamState = {
  key: string;
  expectedSeq: number;
  pending: Map<number, ArrayBuffer>;
  decoding: boolean;
  nextStartTime: number;
  sources: Set<AudioBufferSourceNode>;
  done: boolean;
  started: boolean;
};

const STREAM_PADDING_SECONDS = 0.08;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof window === "undefined") {
    throw new Error("base64 decode not available server-side");
  }
  const normalized = base64.replace(/\s/g, "");
  const binary = atob(normalized);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getStreamKey(context?: string | null) {
  const trimmed = context?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "main";
}

export function resumeAudio() {
  try { sharedCtx?.resume?.(); } catch {}
}

export function useAudioQueue() {
  const WRAP_DELAY_MS = 650;
  const [queue, setQueue] = useState<string[]>([]);
  const [level, setLevel] = useState(0);

  // Expose the shared element via ref if other code needs it
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamStatesRef = useRef<Map<string, StreamState>>(new Map());
  const streamingDisabledRef = useRef(false);

  const stopAllStreams = useCallback(() => {
    const states = Array.from(streamStatesRef.current.values());
    for (const state of states) {
      state.done = true;
      const sources = Array.from(state.sources);
      for (const node of sources) {
        try {
          node.onended = null;
          node.stop();
        } catch {}
      }
    }
    streamStatesRef.current.clear();
  }, []);

  const abortStream = useCallback((context?: string | null) => {
    const key = getStreamKey(context);
    const state = streamStatesRef.current.get(key);
    if (!state) return;
    state.done = true;
    streamStatesRef.current.delete(key);
    const sources = Array.from(state.sources);
    for (const node of sources) {
      try {
        node.onended = null;
        node.stop();
      } catch {}
    }
  }, []);

  const scheduleStreamBuffer = useCallback((state: StreamState, buffer: AudioBuffer) => {
      if (!sharedCtx || !sharedStreamGain) return;
      const source = sharedCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(sharedStreamGain);

    const now = sharedCtx.currentTime;
    const earliest = now + STREAM_PADDING_SECONDS;
    const startAt = Math.max(state.nextStartTime, earliest);

    try {
      source.start(startAt);
    } catch (err) {
      console.error("[AudioQueue] Failed to start stream chunk", err);
      return;
    }

    state.nextStartTime = startAt + buffer.duration;
    state.sources.add(source);
    if (!state.started) state.started = true;

      source.onended = () => {
        state.sources.delete(source);
        if (state.done && state.sources.size === 0) {
          streamStatesRef.current.delete(state.key);
        }
      };
  }, []);

  const decodeAudioChunk = useCallback((data: ArrayBuffer): Promise<AudioBuffer> => {
      if (!sharedCtx) {
        return Promise.reject(new Error("AudioContext unavailable"));
      }
      const copy = data.slice(0);
      const fn = sharedCtx.decodeAudioData as unknown;
      if (typeof fn === "function" && (sharedCtx.decodeAudioData as unknown as { length: number }).length === 1) {
        return sharedCtx.decodeAudioData(copy);
      }
      return new Promise<AudioBuffer>((resolve, reject) => {
        sharedCtx!.decodeAudioData(copy, resolve, reject);
      });
  }, []);

  const processStreamState = useCallback(
    (state: StreamState) => {
      if (!sharedCtx || !sharedStreamGain) return;
      if (state.decoding || state.done) return;

      const next = state.pending.get(state.expectedSeq);
      if (!next) return;

      state.decoding = true;
      state.pending.delete(state.expectedSeq);

      decodeAudioChunk(next)
        .then((buffer) => {
          if (!sharedCtx || !sharedStreamGain) return;
          scheduleStreamBuffer(state, buffer);
          state.expectedSeq += 1;
        })
        .catch((err) => {
          console.error("[AudioQueue] Failed to decode audio chunk", err);
          streamingDisabledRef.current = true;
          stopAllStreams();
        })
        .finally(() => {
          state.decoding = false;
          if (streamStatesRef.current.has(state.key)) {
            processStreamState(state);
          }
        });
    },
    [stopAllStreams, decodeAudioChunk, scheduleStreamBuffer]
  );

  const enqueueStreamChunk = useCallback(
    (chunk: string, seq: number, context?: string | null) => {
      if (!sharedCtx || !sharedStreamGain) return null;
      if (typeof window === "undefined" || streamingDisabledRef.current) return null;

      const key = getStreamKey(context);
      let state = streamStatesRef.current.get(key);
      if (!state) {
        state = {
          key,
          expectedSeq: 0,
          pending: new Map(),
          decoding: false,
          nextStartTime: sharedCtx.currentTime + STREAM_PADDING_SECONDS,
          sources: new Set(),
          done: false,
          started: false,
        };
        streamStatesRef.current.set(key, state);
      }

      if (state.done || seq < state.expectedSeq || state.pending.has(seq)) {
        return { key } as const;
      }

      try {
        const buffer = base64ToArrayBuffer(chunk);
        state.pending.set(seq, buffer);
        processStreamState(state);
        return { key } as const;
      } catch (err) {
        console.error("[AudioQueue] Failed to enqueue audio chunk", err);
        streamingDisabledRef.current = true;
        abortStream(context);
        return null;
      }
    },
    [processStreamState, abortStream]
  );

  const completeStream = useCallback(
    (context?: string | null) => {
      const key = getStreamKey(context);
      const state = streamStatesRef.current.get(key);
      if (!state) {
        return { key, remainingMs: 0, active: false } as const;
      }

      state.done = true;
      state.pending.clear();

      if (!sharedCtx) {
        streamStatesRef.current.delete(key);
        return { key, remainingMs: 0, active: false } as const;
      }

      if (state.sources.size === 0 && !state.decoding) {
        streamStatesRef.current.delete(key);
        return { key, remainingMs: 0, active: false } as const;
      }

      const remaining = Math.max(0, (state.nextStartTime - sharedCtx.currentTime) * 1000);
      return { key, remainingMs: remaining, active: true } as const;
    },
    []
  );

  const cancelScheduledStop = useCallback(() => {
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const enqueue = useCallback(
    (url: string) => {
      cancelScheduledStop();
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      console.log("[AudioQueue] Enqueueing audio:", url);
      setQueue((q) => [...q, url]);
    },
    [cancelScheduledStop]
  );

  const clear = useCallback(
    (delayMs = 0) => {
      const stop = () => {
        stopTimerRef.current = null;
        if (completionTimerRef.current) {
          clearTimeout(completionTimerRef.current);
          completionTimerRef.current = null;
        }
        stopAllStreams();
        setQueue([]);
        if (sharedEl) {
          try {
            sharedEl.pause();
            sharedEl.currentTime = 0;
            sharedEl.src = "";
          } catch {}
        }
      };

      cancelScheduledStop();

      if (delayMs > 0) {
        stopTimerRef.current = setTimeout(stop, delayMs);
      } else {
        stop();
      }
    },
    [cancelScheduledStop, stopAllStreams]
  );

  // Create (or reuse) the audio element + WebAudio graph exactly once per page
  useEffect(() => {
    // 1) Single <audio> element
    if (!sharedEl) {
      sharedEl = new Audio();
      sharedEl.setAttribute("playsinline", "true");
      sharedEl.preload = "auto";
    }
    sharedEl.crossOrigin = "anonymous";
    audioRef.current = sharedEl;

    // 2) Single AudioContext & nodes
    if (!sharedCtx) {
      const windowWithAudioContext = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AC = window.AudioContext || windowWithAudioContext.webkitAudioContext;
      if (!AC) throw new Error("AudioContext not supported");
      sharedCtx = new AC();
    }
    if (!sharedSrc) {
      // IMPORTANT: only call this ONCE for the element, ever.
      sharedSrc = sharedCtx.createMediaElementSource(sharedEl);
    }
    if (!sharedAnalyser) {
      sharedAnalyser = sharedCtx.createAnalyser();
      sharedAnalyser.fftSize = 2048;
      sharedAnalyser.smoothingTimeConstant = 0.2;
    }
    if (!sharedZero) {
      sharedZero = sharedCtx.createGain();
      sharedZero.gain.value = 1;
      // Connect graph once
      sharedSrc.connect(sharedAnalyser);
      sharedAnalyser.connect(sharedZero);
      sharedZero.connect(sharedCtx.destination);
    }

    if (!sharedStreamGain) {
      sharedStreamGain = sharedCtx.createGain();
      sharedStreamGain.gain.value = 1;
      sharedStreamGain.connect(sharedAnalyser);
    }

    let raf = 0, mounted = true;
    const data = new Uint8Array(sharedAnalyser.fftSize);
    let env = 0;

    const tick = () => {
      sharedAnalyser!.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i]-128)/128; sum += v*v; }
      const rms = Math.sqrt(sum / data.length);
      const attack = 0.6, release = 0.1;
      env = rms > env ? env + (rms-env)*attack : env + (rms-env)*release;
      const norm = Math.max(0, Math.min(1, (env - 0.02) / 0.18));
      if (mounted) setLevel(norm);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => { mounted = false; cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledStop();
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      stopAllStreams();
    };
  }, [cancelScheduledStop, stopAllStreams]);

  // Playback logic (unchanged) but use sharedEl
  useEffect(() => {
    if (!sharedEl) {
      sharedEl = new Audio();
    }
    sharedEl.crossOrigin = "anonymous";
    const audio = sharedEl;

    if (!queue.length) return;
    if (!audio.paused) return;

    const [next, ...rest] = queue;
    const playNext = async () => {
      console.log("[AudioQueue] Playing audio (full URL):", next);
      console.log("[AudioQueue] Playing audio (first 100 chars):", next?.substring(0, 100) + "...");
      console.log("[AudioQueue] URL starts with:", next?.substring(0, 30));
      audio.src = next;
      console.log("▶️ NOW PLAYING - audio.src set to:", audio.src?.substring(0, 100) + "...");
      try {
        // Resume context on first user gesture elsewhere; if needed:
        await sharedCtx?.resume();
        console.log("[AudioQueue] AudioContext state:", sharedCtx?.state);
        await audio.play();
        console.log("[AudioQueue] Audio playing successfully");
      } catch (err) {
        console.error("[AudioQueue] Error playing audio:", err);
      }
    };
    const onEnded = () => {
      console.log("🎵 Audio track ended, scheduling wrap-up");
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
      }
      completionTimerRef.current = setTimeout(() => {
        completionTimerRef.current = null;
        setQueue(rest);
      }, WRAP_DELAY_MS);
    };
    const onError = (e: Event) => {
      console.error("❌ Audio error:", e);
      setQueue(rest);
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    void playNext();

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.join("|")]);

  return {
    enqueue,
    clear,
    level,
    audioRef,
    enqueueStreamChunk,
    completeStream,
    cancelStream: abortStream,
  } as const;
}

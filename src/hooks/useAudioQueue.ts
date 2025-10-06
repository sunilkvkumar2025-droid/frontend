// hooks/useAudioQueue.ts
"use client";
import { useEffect, useRef, useState } from "react";

// ---- module-level singletons (survive React Strict Mode re-mounts) ----
let sharedEl: HTMLAudioElement | null = null;
let sharedCtx: AudioContext | null = null;
let sharedSrc: MediaElementAudioSourceNode | null = null;
let sharedAnalyser: AnalyserNode | null = null;
let sharedZero: GainNode | null = null;

export function resumeAudio() {
  try { sharedCtx?.resume?.(); } catch {}
}

export function useAudioQueue() {
  const [queue, setQueue] = useState<string[]>([]);
  const [level, setLevel] = useState(0);

  // Expose the shared element via ref if other code needs it
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const enqueue = (url: string) => setQueue((q) => [...q, url]);

  const clear = () => {
    setQueue([]);
    if (sharedEl) {
      try { sharedEl.pause(); sharedEl.currentTime = 0; sharedEl.src = ""; } catch {}
    }
  };

  // Create (or reuse) the audio element + WebAudio graph exactly once per page
  useEffect(() => {
    // 1) Single <audio> element
    if (!sharedEl) sharedEl = new Audio();
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

  // Playback logic (unchanged) but use sharedEl
  useEffect(() => {
    if (!sharedEl) sharedEl = new Audio();
    const audio = sharedEl;

    if (!queue.length) return;
    if (!audio.paused) return;

    const [next, ...rest] = queue;
    const playNext = async () => {
      audio.src = next;
      try {
        // Resume context on first user gesture elsewhere; if needed:
        await sharedCtx?.resume();
        await audio.play();
      } catch {}
    };
    const onEnded = () => setQueue(rest);
    const onError = () => setQueue(rest);

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    void playNext();

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.join("|")]);

  return { enqueue, clear, level, audioRef } as const;
}

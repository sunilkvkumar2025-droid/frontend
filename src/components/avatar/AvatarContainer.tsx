// src/components/avatar/AvatarContainer.tsx
"use client";
import React from "react";
import { AvatarFace, AvatarState } from "./AvatarFace";

type Phase = "idle" | "userRecording" | "llm" | "tts";

export function AvatarContainer({
  phase,
  ttsLevel,       // from useAudioQueue().level
  micStream,      // from useMicCapture().stream
  micLevel,       // computed by caller (optional) OR compute here if you prefer
}: {
  phase: Phase;
  ttsLevel: number;
  micStream?: MediaStream | null;
  micLevel?: number; // if you precompute outside
}) {
  // If you prefer: compute mic level here with a tiny analyser (same RMS snippet).
  const state =
    phase === "userRecording" ? "listening" :
    phase === "llm"           ? "thinking"  :
    phase === "tts"           ? "speaking"  : "idle";

  const level =
    state === "speaking" ? ttsLevel :
    state === "listening" ? (micLevel ?? 0) :
    0;

  return (
    <div className="flex items-center justify-center">
      <AvatarFace state={state as AvatarState} level={level} />
    </div>
  );
}

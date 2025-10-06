// src/components/avatar/AvatarPhoto.tsx
"use client";
import NextImage from "next/image";   // ← rename this
import React, { useEffect, useRef, useState } from "react";

type Phase = "idle"|"userRecording"|"llm"|"tts";

export function AvatarPhoto({
  phase,
  level,
  width = 280,
  height = 280,
  baseSrc = "/avatars/coco/base.png",
  mouthOpenSrc = "/avatars/coco/mouth-open.png",
  mouthMidSrc,
  fade = true,
}: {
  phase: Phase;
  level: number;
  width?: number;
  height?: number;
  baseSrc?: string;
  mouthOpenSrc?: string;
  mouthMidSrc?: string;
  fade?: boolean;
}) {
  const [ready, setReady] = useState(false);

  // Preload using the *browser* Image
  useEffect(() => {
    const urls = [baseSrc, mouthOpenSrc, mouthMidSrc].filter(Boolean) as string[];
    let cancelled = false;

    const load = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new window.Image();     // ← use window.Image
        img.onload = () => resolve();
        img.onerror = () => resolve();      // fail-soft
        img.src = src;
      });

    Promise.all(urls.map(load)).then(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [baseSrc, mouthOpenSrc, mouthMidSrc]);

  // Hysteresis / smoothing
  const last = useRef(0);
  const [openAmt, setOpenAmt] = useState(0);
  useEffect(() => {
    const gateOpen = 0.28, gateClose = 0.18;
    const target =
      level > gateOpen ? Math.min(1, (level - gateOpen) / (1 - gateOpen)) :
      level < gateClose ? 0 : last.current;
    const k = target > last.current ? 0.5 : 0.18;
    const next = last.current + (target - last.current) * k;
    last.current = next;
    setOpenAmt(next);
  }, [level]);

  const openOpacity = fade ? Math.min(1, Math.max(0, (openAmt - 0.08) / 0.92)) : (openAmt > 0.35 ? 1 : 0);
  const midOpacity  = mouthMidSrc ? Math.min(1, Math.max(0, (openAmt - 0.12) / 0.4)) : 0;

  return (
    <div style={{ width, height, position: "relative", borderRadius: 16, overflow: "hidden" }}>
      {/* Base */}
      <NextImage src={baseSrc} alt="Tutor" fill sizes={`${width}px`} style={{ objectFit: "cover" }} />

      {/* Optional thinking glow */}
      {phase === "llm" && (
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(60% 60% at 50% 30%, rgba(255,255,0,0.12), transparent 70%)",
          pointerEvents: "none"
        }}/>
      )}

      {/* Mid frame (optional) */}
      {mouthMidSrc && (
        <NextImage
          src={mouthMidSrc}
          alt="Mouth mid"
          fill
          sizes={`${width}px`}
          style={{ objectFit: "cover", opacity: midOpacity, transition: fade ? "opacity 60ms linear" : "none" }}
        />
      )}

      {/* Open mouth overlay */}
      <NextImage
        src={mouthOpenSrc}
        alt="Mouth open"
        fill
        sizes={`${width}px`}
        style={{ objectFit: "cover", opacity: openOpacity, transition: fade ? "opacity 60ms linear" : "none" }}
      />

      {!ready && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#bbb", fontSize: 12
        }}>
          loading…
        </div>
      )}
    </div>
  );
}

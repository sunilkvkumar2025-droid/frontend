// File: components/avatar/AvatarFace.tsx


import React from 'react';

export type AvatarState = 'idle'|'listening'|'thinking'|'speaking';

export function AvatarFace({
  level = 0,
  state = 'idle',
  color = '#FFE27A',
}: {
  level?: number;
  state?: AvatarState;
  color?: string;
}) {
  // Map loudness (0–1) to mouth size
  const mouthOpen = Math.max(0, Math.min(1, level));
  const mouthH = 6 + mouthOpen * 22;   // 6–28 px
  const mouthW = 60 + mouthOpen * 10;  // subtle widen

  // Simple “thinking” eye wobble + occasional blink
  const now = Date.now();
  const eyeOffsetY = state === 'thinking' ? Math.sin(now / 600) * 1.5 : 0;
  const blink = (Math.floor(now / 2000) % 8) === 0; // quick blink every ~16s
  const eyeRy = blink ? 2 : 10;

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40">
      {/* Head */}
      <circle cx="100" cy="100" r="90" fill={color} stroke="#222" strokeWidth="3" />
      {/* Eyes */}
      <ellipse cx="70" cy={80 + eyeOffsetY} rx="8" ry={eyeRy} fill="#222" />
      <ellipse cx="130" cy={80 + eyeOffsetY} rx="8" ry={eyeRy} fill="#222" />
      {/* Mouth */}
      <rect
        x={100 - mouthW / 2}
        y={120 - mouthH / 2}
        width={mouthW}
        height={mouthH}
        rx={mouthH / 2}
        fill="#222"
      />
      {/* Subtle state dot */}
      {state !== 'idle' && (
        <circle
          cx="170" cy="30" r="10"
          fill={state === 'listening' ? '#4ade80' : state === 'speaking' ? '#60a5fa' : '#fbbf24'}
        />
      )}
    </svg>
  );
}

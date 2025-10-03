// File: components/shared/CEFRBadge.tsx
// Reusable CEFR badge with interactive dropdown

"use client";

import { useState } from "react";
import { CEFR_LEVELS } from "../../lib/cefr";

interface CEFRBadgeProps {
  level: string;
  className?: string;
}

export default function CEFRBadge({ level, className = "" }: CEFRBadgeProps) {
  const [showCEFRInfo, setShowCEFRInfo] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowCEFRInfo(!showCEFRInfo)}
        className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-full text-sm text-white hover:bg-blue-600/30 transition-colors cursor-pointer ${className}`}
      >
        <span className="text-neutral-400">CEFR Level:</span>
        <span className="font-bold">{level} ℹ️</span>
      </button>

      {/* CEFR Info Dropdown */}
      {showCEFRInfo && (
        <div className="mt-4 bg-zinc-800/50 border border-blue-400/30 rounded-xl p-4 text-left max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold mb-1 text-blue-300">CEFR Language Levels</h3>
          <div className="mb-3 text-xs text-neutral-400 italic">
            CEFR (Common European Framework of Reference) is an international standard for describing language ability.
          </div>
          <div className="space-y-3 text-sm">
            {Object.entries(CEFR_LEVELS).map(([cefrLevel, info]) => {
              const isCurrentLevel = cefrLevel === level;
              return (
                <div
                  key={cefrLevel}
                  className={`p-3 rounded-lg ${
                    isCurrentLevel
                      ? "bg-blue-600/20 border border-blue-400/40"
                      : "bg-zinc-800/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-blue-300">{cefrLevel}</span>
                    <span className="text-neutral-400">-</span>
                    <span className="font-semibold text-white">{info.name}</span>
                    {isCurrentLevel && <span className="ml-auto text-xs text-blue-300">← Your Level</span>}
                  </div>
                  <div className="text-neutral-300">{info.description}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

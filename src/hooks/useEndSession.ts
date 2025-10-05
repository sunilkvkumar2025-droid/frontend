// File: hooks/useEndSession.ts
// Hook to end a session and retrieve AI performance assessment

"use client";

import { useState } from "react";
import { functionUrl } from "../lib/api";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type PronunciationMistake = {
  example: string;
  suggestion: string;
};

type PronunciationSignals = Record<string, unknown> | null;

type ScoreData = {
  rubric: {
    pronunciation: number | null;
    content: number;
    vocabulary: number;
    grammar: number;
  };
  overall_score_0_100: number;
  estimated_cefr: string;
  section_summaries?: { [key: string]: string };
  mistakes?: {
    grammar?: Array<{ original: string; corrected: string; brief_rule: string }>;
    vocabulary?: Array<{ original: string; suggestion: string; reason: string }>;
    content?: Array<{ issue: string; suggestion: string }>;
    pronunciation?: PronunciationMistake[];
  };
  actionable_feedback?: string[];
};

export function useEndSession() {
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endSession = async (
    sessionId: string,
    pronunciationSignals?: PronunciationSignals
  ): Promise<ScoreData | null> => {
    setIsEnding(true);
    setError(null);

    try {
      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      // Call end-session edge function
      const url = functionUrl("end-session");
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          pronunciationSignals: pronunciationSignals || null,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
      }

      const result = await response.json();

      // Backend wraps data in finalScore
      if (result.finalScore) {
        return result.finalScore as ScoreData;
      }

      return result as ScoreData;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to end session";
      setError(errorMessage);
      console.error("End session error:", e);
      return null;
    } finally {
      setIsEnding(false);
    }
  };

  return { endSession, isEnding, error };
}

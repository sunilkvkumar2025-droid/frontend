// File: components/feedback/FeedbackCard.tsx
// Reusable component for displaying a single session's feedback

"use client";

import { useState } from "react";
import { getScoreMessage } from "../../lib/scoring";

interface Rubric {
  pronunciation: number | null;
  content: number;
  vocabulary: number;
  grammar: number;
}

interface Mistakes {
  grammar?: Array<{ original: string; corrected: string; brief_rule: string }>;
  vocabulary?: Array<{ original: string; suggestion: string; reason: string }>;
  content?: Array<{ issue: string; suggestion: string }>;
  pronunciation?: Array<any>;
}

interface SessionData {
  id: string;
  created_at: string;
  topic: string | null;
  overall_score: number;
  estimated_cefr: string;
  rubric: Rubric;
  section_summaries: { [key: string]: string };
  mistakes: Mistakes;
  actionable_feedback?: string[];
}

interface FeedbackCardProps {
  session: SessionData;
}

export default function FeedbackCard({ session }: FeedbackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { headline, message } = getScoreMessage(session.overall_score);

  // Format date
  const date = new Date(session.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Card Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-neutral-400 text-sm">{date}</span>
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-300 font-medium">
              {session.topic || "General Practice"}
            </span>
          </div>
          <div className="text-white font-semibold text-lg">
            Score: {session.overall_score}/100
          </div>
          <div className="text-neutral-400 text-sm">{headline}</div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl bg-blue-600/20 px-3 py-1 rounded-lg border border-blue-500">
            {session.estimated_cefr}
          </span>
          <svg
            className={`w-5 h-5 text-neutral-400 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-6 pb-6 space-y-6 border-t border-zinc-800 pt-6">
          {/* Score Message */}
          <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700">
            <p className="text-neutral-300 text-center">{message}</p>
          </div>

          {/* Rubric Grid */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              Performance Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(session.rubric).map(([key, score]) => {
                if (score === null) return null;
                const feedback = session.section_summaries?.[key] || "";
                return (
                  <div
                    key={key}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-neutral-300 font-medium capitalize">
                        {key}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full ${
                                i < score
                                  ? "bg-blue-500"
                                  : "bg-zinc-700"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-white font-semibold text-sm">
                          {score}/5
                        </span>
                      </div>
                    </div>
                    {feedback && (
                      <p className="text-sm text-neutral-400">{feedback}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Feedback */}
          {session.actionable_feedback && session.actionable_feedback.length > 0 && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
              <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                <span>💡</span>
                <span>Quick Tips for Improvement</span>
              </h4>
              <ul className="space-y-1 text-sm text-neutral-300">
                {session.actionable_feedback.map((tip, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-blue-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mistakes Breakdown */}
          {(session.mistakes.grammar?.length ||
            session.mistakes.vocabulary?.length ||
            session.mistakes.content?.length) && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Specific Mistakes to Learn From
              </h3>
              <div className="space-y-3">
                {session.mistakes.grammar && session.mistakes.grammar.length > 0 && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">
                      Grammar
                    </h4>
                    <ul className="space-y-2 text-sm text-neutral-300">
                      {session.mistakes.grammar.map((mistake, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <span className="text-red-400">✗</span>
                            <span className="line-through text-neutral-500">{mistake.original}</span>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <span className="text-green-400">✓</span>
                            <span className="text-green-400">{mistake.corrected}</span>
                          </div>
                          <div className="ml-4 text-xs text-neutral-400 italic">
                            {mistake.brief_rule}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.mistakes.vocabulary && session.mistakes.vocabulary.length > 0 && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <h4 className="text-orange-400 font-semibold mb-2">
                      Vocabulary
                    </h4>
                    <ul className="space-y-2 text-sm text-neutral-300">
                      {session.mistakes.vocabulary.map((mistake, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <span className="text-orange-400">→</span>
                            <span>{mistake.original}</span>
                          </div>
                          <div className="ml-4 text-orange-400">
                            Better: {mistake.suggestion}
                          </div>
                          <div className="ml-4 text-xs text-neutral-400 italic">
                            {mistake.reason}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {session.mistakes.content && session.mistakes.content.length > 0 && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                    <h4 className="text-yellow-400 font-semibold mb-2">
                      Content & Expression
                    </h4>
                    <ul className="space-y-2 text-sm text-neutral-300">
                      {session.mistakes.content.map((mistake, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span>{mistake.issue}</span>
                          </div>
                          <div className="ml-4 text-yellow-400">
                            Try: {mistake.suggestion}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

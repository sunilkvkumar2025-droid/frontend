// File: components/chat/ScoreResultsModal.tsx
// Modal to display AI performance assessment after session end

"use client";

import { useState } from "react";

function getScoreMessage(score: number): { headline: string; message: string } {
  if (score <= 25) {
    return {
      headline: "You're Building Your Foundation! 🌱",
      message: "Every expert was once a beginner. You're learning the basics—keep practicing and you'll see progress soon!"
    };
  }
  if (score <= 45) {
    return {
      headline: "You're Making Progress! 💪",
      message: "You're developing your English skills! Keep going—every conversation makes you stronger."
    };
  }
  if (score <= 60) {
    return {
      headline: "You're Getting Comfortable! ⭐",
      message: "Nice work! You can express your ideas well. Now let's add more variety and confidence."
    };
  }
  if (score <= 75) {
    return {
      headline: "You're Really Strong! 🎯",
      message: "Great job! Your English is clear and effective. With more practice, you'll sound even more natural."
    };
  }
  if (score <= 85) {
    return {
      headline: "You're Excellent! 🌟",
      message: "Impressive! You communicate really well in English. Just a few small improvements and you'll be perfect."
    };
  }
  return {
    headline: "You're Nearly Perfect! 🏆",
    message: "Wow! Your English is outstanding. You're ready for any conversation. Keep shining!"
  };
}

const CEFR_LEVELS = {
  A1: {
    name: "Beginner",
    description: "Can understand and use familiar everyday expressions and basic phrases. Can introduce themselves and ask simple questions."
  },
  A2: {
    name: "Elementary",
    description: "Can communicate in simple routine tasks. Can describe their background, immediate environment, and matters of immediate need."
  },
  B1: {
    name: "Intermediate",
    description: "Can deal with most situations while traveling. Can describe experiences, events, dreams, and ambitions. Can give reasons and explanations."
  },
  B2: {
    name: "Upper Intermediate",
    description: "Can interact with native speakers fluently and spontaneously. Can produce clear, detailed text on a wide range of subjects."
  },
  C1: {
    name: "Advanced",
    description: "Can express ideas fluently and spontaneously. Can use language flexibly for social, academic, and professional purposes."
  },
  C2: {
    name: "Proficient",
    description: "Can understand virtually everything with ease. Can express themselves spontaneously, very fluently, and precisely."
  }
};

type RubricScores = {
  pronunciation: number | null;
  content: number;
  vocabulary: number;
  grammar: number;
};

type ScoreData = {
  rubric: RubricScores;
  overall_score_0_100: number;
  estimated_cefr: string;
  section_summaries?: { [key: string]: string };
  mistakes?: {
    grammar?: Array<{ original: string; corrected: string; brief_rule: string }>;
    vocabulary?: Array<{ original: string; suggestion: string; reason: string }>;
    content?: Array<{ issue: string; suggestion: string }>;
    pronunciation?: Array<any>;
  };
  actionable_feedback?: string[];
};

type ScoreResultsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  scoreData: ScoreData | null;
  onStartNew: () => void;
};

export default function ScoreResultsModal({
  isOpen,
  onClose,
  scoreData,
  onStartNew,
}: ScoreResultsModalProps) {
  const [showMistakes, setShowMistakes] = useState(false);
  const [showSummaries, setShowSummaries] = useState(false);
  const [showCEFRInfo, setShowCEFRInfo] = useState(false);

  if (!isOpen || !scoreData) return null;

  // Add defensive check for rubric
  if (!scoreData.rubric) {
    console.error("Invalid scoreData - missing rubric:", scoreData);
    return null;
  }

  const rubricLabels = {
    pronunciation: "Pronunciation",
    content: "Content",
    vocabulary: "Vocabulary",
    grammar: "Grammar",
  };

  const { headline, message } = getScoreMessage(scoreData.overall_score_0_100);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-neutral-700 p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Session Complete! 🎉</h2>

          <div className="text-center mb-6">
            <div className="text-5xl font-bold mb-3 text-blue-400">
              {scoreData.overall_score_0_100}<span className="text-2xl text-neutral-400">/100</span>
            </div>
            <div className="text-2xl font-semibold mb-3">
              {headline}
            </div>
            <div className="text-sm opacity-80 italic max-w-md mx-auto leading-relaxed">
              {message}
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setShowCEFRInfo(!showCEFRInfo)}
              className="px-3 py-1 bg-blue-600/20 border border-blue-400/30 rounded-full text-sm font-semibold hover:bg-blue-600/30 transition-colors cursor-pointer"
            >
              {scoreData.estimated_cefr} ℹ️
            </button>
          </div>

          {/* CEFR Info Popup */}
          {showCEFRInfo && (
            <div className="mt-4 bg-neutral-800/50 border border-blue-400/30 rounded-xl p-4">
              <h3 className="text-lg font-semibold mb-1 text-blue-300">CEFR Language Levels</h3>
              <div className="mb-3 text-xs text-neutral-400 italic">
                CEFR (Common European Framework of Reference) is an international standard for describing language ability.
              </div>
              <div className="space-y-3 text-sm">
                {Object.entries(CEFR_LEVELS).map(([level, info]) => {
                  const isCurrentLevel = level === scoreData.estimated_cefr;
                  return (
                    <div
                      key={level}
                      className={`p-3 rounded-lg ${
                        isCurrentLevel
                          ? "bg-blue-600/20 border border-blue-400/40"
                          : "bg-neutral-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-blue-300">{level}</span>
                        <span className="text-neutral-400">-</span>
                        <span className="font-semibold">{info.name}</span>
                        {isCurrentLevel && <span className="ml-auto text-xs">← Your Level</span>}
                      </div>
                      <div className="text-neutral-300">{info.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rubric Scores */}
        <div className="p-6 border-b border-neutral-700">
          <h3 className="text-lg font-semibold mb-4">Performance Breakdown</h3>
          <div className="grid grid-cols-2 gap-4">
            {(Object.keys(rubricLabels) as Array<keyof RubricScores>).map((key) => {
              const score = scoreData.rubric[key];

              // Skip if score is null
              if (score === null) {
                return (
                  <div key={key} className="space-y-2 opacity-50">
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-300">{rubricLabels[key]}</span>
                      <span className="text-neutral-500 text-xs">N/A</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-neutral-700" />
                    </div>
                  </div>
                );
              }

              const percentage = (score / 5) * 100;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-300">{rubricLabels[key]}</span>
                    <span className="font-semibold">
                      {score.toFixed(1)}<span className="text-neutral-500">/5</span>
                    </span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actionable Feedback */}
        {scoreData.actionable_feedback && scoreData.actionable_feedback.length > 0 && (
          <div className="p-6 border-b border-neutral-700">
            <h3 className="text-lg font-semibold mb-3">Key Recommendations</h3>
            <ul className="space-y-2">
              {scoreData.actionable_feedback.map((item, idx) => (
                <li key={idx} className="flex gap-2 text-sm text-neutral-300">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Section Summaries (Collapsible) */}
        {scoreData.section_summaries && Object.keys(scoreData.section_summaries).length > 0 && (
          <div className="p-6 border-b border-neutral-700">
            <button
              onClick={() => setShowSummaries(!showSummaries)}
              className="w-full flex justify-between items-center text-lg font-semibold mb-3 hover:text-blue-400 transition-colors"
            >
              <span>Section Summaries</span>
              <span className="text-sm">{showSummaries ? "▼" : "▶"}</span>
            </button>
            {showSummaries && (
              <div className="space-y-3">
                {Object.entries(scoreData.section_summaries).map(([section, summary]) => (
                  <div key={section} className="bg-neutral-800/50 rounded-lg p-3">
                    <div className="text-sm font-semibold text-blue-300 mb-1 capitalize">
                      {section}
                    </div>
                    <div className="text-sm text-neutral-300">{summary}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mistakes Breakdown (Collapsible) */}
        {scoreData.mistakes && (
          (() => {
            const totalMistakes =
              (scoreData.mistakes.grammar?.length || 0) +
              (scoreData.mistakes.vocabulary?.length || 0) +
              (scoreData.mistakes.content?.length || 0);

            if (totalMistakes === 0) return null;

            return (
              <div className="p-6 border-b border-neutral-700">
                <button
                  onClick={() => setShowMistakes(!showMistakes)}
                  className="w-full flex justify-between items-center text-lg font-semibold mb-3 hover:text-blue-400 transition-colors"
                >
                  <span>Common Mistakes ({totalMistakes})</span>
                  <span className="text-sm">{showMistakes ? "▼" : "▶"}</span>
                </button>
                {showMistakes && (
                  <div className="space-y-4">
                    {/* Grammar Mistakes */}
                    {scoreData.mistakes.grammar && scoreData.mistakes.grammar.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-400 mb-2">Grammar</h4>
                        <div className="space-y-2">
                          {scoreData.mistakes.grammar.map((mistake, idx) => (
                            <div key={idx} className="bg-red-900/10 border border-red-500/20 rounded-lg p-3">
                              <div className="text-sm mb-1">
                                <span className="text-red-300 line-through">{mistake.original}</span>
                                {" → "}
                                <span className="text-green-300">{mistake.corrected}</span>
                              </div>
                              <div className="text-xs text-neutral-400">{mistake.brief_rule}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vocabulary Mistakes */}
                    {scoreData.mistakes.vocabulary && scoreData.mistakes.vocabulary.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-yellow-400 mb-2">Vocabulary</h4>
                        <div className="space-y-2">
                          {scoreData.mistakes.vocabulary.map((mistake, idx) => (
                            <div key={idx} className="bg-yellow-900/10 border border-yellow-500/20 rounded-lg p-3">
                              <div className="text-sm mb-1">
                                <span className="text-yellow-300">{mistake.original}</span>
                                {" → "}
                                <span className="text-green-300">{mistake.suggestion}</span>
                              </div>
                              <div className="text-xs text-neutral-400">{mistake.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Content Mistakes */}
                    {scoreData.mistakes.content && scoreData.mistakes.content.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">Content</h4>
                        <div className="space-y-2">
                          {scoreData.mistakes.content.map((mistake, idx) => (
                            <div key={idx} className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3">
                              <div className="text-sm mb-1 text-blue-300">{mistake.issue}</div>
                              <div className="text-xs text-neutral-400">{mistake.suggestion}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* Footer Actions */}
        <div className="p-6 flex gap-3">
          <button
            onClick={onStartNew}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Start New Session
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

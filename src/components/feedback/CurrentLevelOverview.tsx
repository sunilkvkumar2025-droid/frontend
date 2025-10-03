// File: components/feedback/CurrentLevelOverview.tsx
// Displays user's current level overview with aggregated stats

"use client";

import { getScoreMessage } from "../../lib/scoring";
import CEFRBadge from "../shared/CEFRBadge";

interface Rubric {
  pronunciation: number | null;
  content: number;
  vocabulary: number;
  grammar: number;
}

interface PronunciationMistake {
  example: string;
  suggestion: string;
}

interface Mistake {
  grammar?: Array<{ original: string; corrected: string; brief_rule: string }>;
  vocabulary?: Array<{ original: string; suggestion: string; reason: string }>;
  content?: Array<{ issue: string; suggestion: string }>;
  pronunciation?: PronunciationMistake[];
}

interface Session {
  id: string;
  created_at: string;
  topic: string | null;
  overall_score: number;
  estimated_cefr: string;
  rubric: Rubric;
  section_summaries: { [key: string]: string };
  mistakes: Mistake;
  actionable_feedback?: string[];
}

interface User {
  id: string;
  current_level: number;
  email: string;
  display_name: string;
}

interface Props {
  user: User;
  sessions: Session[];
}

interface OverviewData {
  currentLevel: number;
  cefr: string | null;
  sessionCount: number;
  avgRubric: {
    grammar: number;
    vocabulary: number;
    content: number;
    pronunciation: number | null;
  };
  strongest: string | null;
  weakest: string | null;
  mistakeCounts: {
    grammar: Array<{ original: string; corrected: string; brief_rule: string }>;
    vocabulary: Array<{ original: string; suggestion: string; reason: string }>;
    content: Array<{ issue: string; suggestion: string }>;
    pronunciation: PronunciationMistake[];
  };
  trend: { direction: string; diff: number } | null;
  hasEnoughForAverage: boolean;
  hasEnoughForPatterns: boolean;
}

function computeOverviewData(user: User, sessions: Session[]): OverviewData {
  const currentLevel = user?.current_level || 0;
  const sessionCount = sessions.length;

  // Get last 3 for rubric average
  const last3 = sessions.slice(0, 3);
  const rubricSum = {
    grammar: 0,
    vocabulary: 0,
    content: 0,
    pronunciation: 0,
    pronunciationCount: 0,
  };

  last3.forEach((s) => {
    const rubric = s.rubric;
    if (rubric) {
      if (typeof rubric.grammar === "number") rubricSum.grammar += rubric.grammar;
      if (typeof rubric.vocabulary === "number") rubricSum.vocabulary += rubric.vocabulary;
      if (typeof rubric.content === "number") rubricSum.content += rubric.content;
      if (typeof rubric.pronunciation === "number") {
        rubricSum.pronunciation += rubric.pronunciation;
        rubricSum.pronunciationCount++;
      }
    }
  });

  const divisor = last3.length || 1;
  const avgRubric = {
    grammar: rubricSum.grammar / divisor,
    vocabulary: rubricSum.vocabulary / divisor,
    content: rubricSum.content / divisor,
    pronunciation:
      rubricSum.pronunciationCount > 0
        ? rubricSum.pronunciation / rubricSum.pronunciationCount
        : null,
  };

  // Find strongest and weakest areas
  const scores = [
    { name: "Grammar", value: avgRubric.grammar },
    { name: "Vocabulary", value: avgRubric.vocabulary },
    { name: "Content", value: avgRubric.content },
    { name: "Pronunciation", value: avgRubric.pronunciation },
  ].filter((s) => s.value !== null && s.value > 0);

  scores.sort((a, b) => (b.value as number) - (a.value as number));
  const strongest = scores[0]?.name || null;
  const weakest = scores[scores.length - 1]?.name || null;

  // Get last 5 for mistake patterns
  const last5 = sessions.slice(0, 5);
  const mistakeCounts = {
    grammar: [] as Array<{ original: string; corrected: string; brief_rule: string }>,
    vocabulary: [] as Array<{ original: string; suggestion: string; reason: string }>,
    content: [] as Array<{ issue: string; suggestion: string }>,
    pronunciation: [] as PronunciationMistake[],
  };

  last5.forEach((s) => {
    const mistakes = s.mistakes;
    if (mistakes) {
      if (mistakes.grammar) mistakeCounts.grammar.push(...mistakes.grammar);
      if (mistakes.vocabulary) mistakeCounts.vocabulary.push(...mistakes.vocabulary);
      if (mistakes.content) mistakeCounts.content.push(...mistakes.content);
      if (mistakes.pronunciation) mistakeCounts.pronunciation.push(...mistakes.pronunciation);
    }
  });

  // Get CEFR from most recent session
  const cefr = sessions[0]?.estimated_cefr || null;

  // Trend: compare current level to 5 sessions ago
  let trend = null;
  if (sessions.length >= 5) {
    const session5Ago = sessions[4];
    const oldScore = session5Ago?.overall_score;
    if (oldScore) {
      const diff = Math.round(currentLevel - oldScore);
      const direction = diff > 5 ? "up" : diff < -5 ? "down" : "stable";
      trend = { direction, diff };
    }
  }

  return {
    currentLevel,
    cefr,
    sessionCount,
    avgRubric,
    strongest,
    weakest,
    mistakeCounts,
    trend,
    hasEnoughForAverage: sessionCount >= 3,
    hasEnoughForPatterns: sessionCount >= 5,
  };
}

function renderStars(score: number) {
  const full = Math.floor(score);
  const hasHalf = score % 1 >= 0.5;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <>
      {"⭐".repeat(full)}
      {hasHalf && "⭐"}
      {"☆".repeat(empty)}
    </>
  );
}

export default function CurrentLevelOverview({ user, sessions }: Props) {
  const overviewData = computeOverviewData(user, sessions);
  const { headline, message } = getScoreMessage(overviewData.currentLevel);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
      {/* Hero Section */}
      <div className="text-center mb-8 pb-6 border-b border-zinc-800">
        <h2 className="text-sm uppercase tracking-wide text-neutral-400 mb-2">
          Your Current Level
        </h2>
        <div className="text-6xl font-bold text-white mb-2">
          {Math.round(overviewData.currentLevel)}/100
        </div>
        <div className="text-2xl font-semibold text-white mb-1">{headline}</div>
        <div className="text-sm text-neutral-400 italic mb-3">{message}</div>

        {/* CEFR Badge */}
        {overviewData.cefr && <CEFRBadge level={overviewData.cefr} />}

        {/* Trend Indicator */}
        {overviewData.trend && (
          <div className="mt-3 text-sm">
            {overviewData.trend.direction === "up" && (
              <span className="text-green-400">
                ↑ +{overviewData.trend.diff} from 5 sessions ago
              </span>
            )}
            {overviewData.trend.direction === "down" && (
              <span className="text-orange-400">
                ↓ {overviewData.trend.diff} from 5 sessions ago
              </span>
            )}
            {overviewData.trend.direction === "stable" && (
              <span className="text-yellow-400">→ Steady progress</span>
            )}
          </div>
        )}
      </div>

      {/* Performance Breakdown */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-1">Performance Breakdown</h3>
        <p className="text-xs text-neutral-400 mb-4">
          {overviewData.hasEnoughForAverage
            ? `Based on your last ${Math.min(overviewData.sessionCount, 3)} sessions`
            : `Based on your ${overviewData.sessionCount} session${
                overviewData.sessionCount > 1 ? "s" : ""
              } - complete more for better insights!`}
        </p>

        {/* Rubric Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { name: "Grammar", value: overviewData.avgRubric.grammar },
            { name: "Vocabulary", value: overviewData.avgRubric.vocabulary },
            { name: "Content", value: overviewData.avgRubric.content },
            { name: "Pronunciation", value: overviewData.avgRubric.pronunciation },
          ].map((item) => (
            <div key={item.name} className="bg-zinc-800/50 rounded-xl p-4">
              <div className="text-sm text-neutral-400 mb-1">{item.name}</div>
              <div className="text-2xl font-bold text-white mb-1">
                {item.value !== null ? `${item.value.toFixed(1)}/5` : "To come"}
              </div>
              {item.value !== null && (
                <div className="text-yellow-400 text-sm">{renderStars(item.value)}</div>
              )}
            </div>
          ))}
        </div>

        {/* Strengths & Focus Areas */}
        {overviewData.strongest && overviewData.weakest && (
          <div className="flex gap-3 text-sm">
            <div className="flex-1 bg-green-600/10 border border-green-600/30 rounded-lg p-3">
              <div className="font-semibold text-green-400 mb-1">💪 Strength</div>
              <div className="text-white">{overviewData.strongest}</div>
            </div>
            <div className="flex-1 bg-orange-600/10 border border-orange-600/30 rounded-lg p-3">
              <div className="font-semibold text-orange-400 mb-1">🎯 Focus On</div>
              <div className="text-white">{overviewData.weakest}</div>
            </div>
          </div>
        )}
      </div>

      {/* Common Mistakes */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Common Mistakes to Work On</h3>
        <p className="text-xs text-neutral-400 mb-4">
          {overviewData.hasEnoughForPatterns
            ? `From your last ${Math.min(overviewData.sessionCount, 5)} sessions`
            : `Complete ${5 - overviewData.sessionCount} more session${
                5 - overviewData.sessionCount > 1 ? "s" : ""
              } to see patterns`}
        </p>

        {overviewData.hasEnoughForPatterns ? (
          <div className="space-y-3">
            {/* Grammar Mistakes */}
            {overviewData.mistakeCounts.grammar.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📝</span>
                  <span className="font-semibold text-white">
                    Grammar ({overviewData.mistakeCounts.grammar.length})
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-300">
                  {overviewData.mistakeCounts.grammar.slice(0, 3).map((mistake, i) => (
                    <li key={i}>
                      • "{mistake.original}" → "{mistake.corrected}"
                      <span className="text-xs text-neutral-500 ml-2">
                        ({mistake.brief_rule})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Vocabulary Mistakes */}
            {overviewData.mistakeCounts.vocabulary.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📚</span>
                  <span className="font-semibold text-white">
                    Vocabulary ({overviewData.mistakeCounts.vocabulary.length})
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-300">
                  {overviewData.mistakeCounts.vocabulary.slice(0, 3).map((mistake, i) => (
                    <li key={i}>
                      • "{mistake.original}" → Try: "{mistake.suggestion}"
                      <span className="text-xs text-neutral-500 ml-2">({mistake.reason})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Content Mistakes */}
            {overviewData.mistakeCounts.content.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💬</span>
                  <span className="font-semibold text-white">
                    Content ({overviewData.mistakeCounts.content.length})
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-300">
                  {overviewData.mistakeCounts.content.slice(0, 3).map((mistake, i) => (
                    <li key={i}>
                      • {mistake.issue} → {mistake.suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pronunciation Mistakes */}
            {overviewData.mistakeCounts.pronunciation.length > 0 && (
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎤</span>
                  <span className="font-semibold text-white">
                    Pronunciation ({overviewData.mistakeCounts.pronunciation.length})
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-neutral-300">
                  {overviewData.mistakeCounts.pronunciation.slice(0, 3).map((mistake, i) => (
                    <li key={i}>
                      • {mistake.example} → {mistake.suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-neutral-400 text-sm">
            Complete more sessions to see your common mistake patterns
          </div>
        )}
      </div>
    </div>
  );
}

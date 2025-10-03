// File: app/feedback/page.tsx
// Feedback history page showing all completed sessions

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "../../components/layout/TopNav";
import FeedbackCard from "../../components/feedback/FeedbackCard";
import CurrentLevelOverview from "../../components/feedback/CurrentLevelOverview";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

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

export default function FeedbackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id, current_level, email, display_name")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else {
          setProfile(profileData);
        }

        // Fetch sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("id, created_at, topic, final_score_json")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .not("final_score_json", "is", null)
          .order("created_at", { ascending: false });

        if (sessionsError) {
          console.error("Error fetching sessions:", sessionsError);
          return;
        }

        // Transform data to match SessionData interface
        const transformedSessions = (sessionsData || []).map((session: any) => ({
          id: session.id,
          created_at: session.created_at,
          topic: session.topic,
          overall_score: session.final_score_json.overall_score_0_100,
          estimated_cefr: session.final_score_json.estimated_cefr,
          rubric: session.final_score_json.rubric,
          section_summaries: session.final_score_json.section_summaries,
          mistakes: session.final_score_json.mistakes,
          actionable_feedback: session.final_score_json.actionable_feedback,
        }));

        setSessions(transformedSessions);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950">
      <TopNav />

      {/* Main content with padding for fixed TopNav */}
      <main className="pt-20 px-4 py-8 max-w-4xl mx-auto">
        {/* Back to Home button */}
        <Link href="/">
          <button className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm mb-6">
            <span>←</span>
            <span>Back to Home</span>
          </button>
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Your Progress 📊</h1>
          <p className="text-sm text-neutral-400">
            Track your improvement and review past sessions
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-8 text-center">
            <p className="text-lg text-neutral-300 mb-6">
              No completed sessions yet. Start a lesson to see your feedback here!
            </p>
            <button
              onClick={() => router.push("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Start a Lesson
            </button>
          </div>
        ) : (
          <>
            {/* Current Level Overview */}
            {profile && <CurrentLevelOverview user={profile} sessions={sessions} />}

            {/* Session History Header */}
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">Session History</h2>
              <p className="text-xs text-neutral-400">
                Click any session to see detailed feedback
              </p>
            </div>

            {/* Session Cards */}
            <div className="space-y-4">
              {sessions.map((session) => (
                <FeedbackCard key={session.id} session={session} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

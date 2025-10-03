// File: app/feedback/page.tsx
// Feedback history page showing all completed sessions

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "../../components/layout/TopNav";
import FeedbackCard from "../../components/feedback/FeedbackCard";
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
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("sessions")
          .select("id, created_at, topic, final_score_json")
          .eq("user_id", user.id)
          .not("ended_at", "is", null)
          .not("final_score_json", "is", null)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error fetching sessions:", error);
          return;
        }

        // Transform data to match SessionData interface
        const transformedSessions = (data || []).map((session: any) => ({
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
        console.error("Error fetching sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
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

        <h1 className="text-3xl font-bold text-white mb-8">
          Your Feedback History
        </h1>

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
          <div className="space-y-4">
            {sessions.map((session) => (
              <FeedbackCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

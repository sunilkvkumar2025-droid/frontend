"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Analytics = {
  summary: {
    totalTranscriptions: number;
    totalErrors: number;
    overallErrorRate: string;
  };
  byMethod: {
    [key: string]: {
      totalTranscriptions: number;
      totalErrors: number;
      errorRate: string;
    };
  };
  recentErrors: Array<{
    transcribed_text: string;
    correction_text: string;
    error_type: string;
    created_at: string;
  }>;
};

export default function STTStats() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          alert("Please log in to view analytics");
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stt-analytics`,
          {
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        } else {
          console.error("Failed to fetch analytics:", await response.text());
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="p-8 text-center">Failed to load analytics</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">STT Error Analytics</h1>

      {/* Summary */}
      <div className="bg-neutral-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Overall Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-neutral-400">Total Transcriptions</div>
            <div className="text-2xl font-bold">{analytics.summary.totalTranscriptions}</div>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Reported Errors</div>
            <div className="text-2xl font-bold text-red-400">{analytics.summary.totalErrors}</div>
          </div>
          <div>
            <div className="text-sm text-neutral-400">Error Rate</div>
            <div className="text-2xl font-bold text-yellow-400">{analytics.summary.overallErrorRate}</div>
          </div>
        </div>
      </div>

      {/* By Method */}
      <div className="bg-neutral-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">By Method</h2>
        {Object.entries(analytics.byMethod).map(([method, stats]) => (
          <div key={method} className="mb-4 pb-4 border-b border-neutral-700 last:border-0">
            <div className="font-semibold mb-2">{method}</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-neutral-400">Transcriptions: </span>
                {stats.totalTranscriptions}
              </div>
              <div>
                <span className="text-neutral-400">Errors: </span>
                <span className="text-red-400">{stats.totalErrors}</span>
              </div>
              <div>
                <span className="text-neutral-400">Error Rate: </span>
                <span className="text-yellow-400">{stats.errorRate}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Errors */}
      <div className="bg-neutral-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Errors (Last 20)</h2>
        <div className="space-y-4">
          {analytics.recentErrors.map((error, i) => (
            <div key={i} className="bg-neutral-900 rounded p-4">
              <div className="text-sm text-neutral-400 mb-2">
                {new Date(error.created_at).toLocaleString()} • {error.error_type}
              </div>
              <div className="mb-2">
                <span className="text-red-400 font-semibold">Heard: </span>
                <span className="text-neutral-300">"{error.transcribed_text}"</span>
              </div>
              <div>
                <span className="text-green-400 font-semibold">Actually: </span>
                <span className="text-neutral-300">"{error.correction_text}"</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

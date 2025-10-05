// File: app/onboarding/page.tsx
// User profile setup page for new users

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";

const LEVEL_OPTIONS = [
  { value: "elementary", label: "Beginner", emoji: "🌱" },
  { value: "intermediate", label: "Intermediate", emoji: "⭐" },
  { value: "advanced", label: "Advanced", emoji: "🚀" },
];

export default function OnboardingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // Update the existing profile (created by trigger)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          self_level: level,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  // Show nothing while checking auth
  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="max-w-md w-full mx-4">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
          <h1 className="text-3xl font-bold text-white mb-2 text-center">
            Let&apos;s get to know you! 🌟
          </h1>
          <p className="text-neutral-400 text-center mb-8">
            Tell us a bit about yourself to get started
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                What&apos;s your name?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </div>

            {/* Level Selection */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-3">
                What&apos;s your English level?
              </label>
              <div className="space-y-2">
                {LEVEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLevel(option.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${
                      level === option.value
                        ? "bg-blue-600/20 border-blue-500 text-white"
                        : "bg-zinc-800 border-zinc-700 text-neutral-300 hover:border-zinc-600"
                    }`}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="font-semibold">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-semibold px-6 py-4 rounded-xl transition-colors text-lg"
            >
              {loading ? "Creating your profile..." : "Start Learning"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

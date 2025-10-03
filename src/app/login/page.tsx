// File: app/login/page.tsx
// Dual authentication page: Magic Link + Email/Password

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type AuthTab = "magic" | "password";
type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();

  // Tab and mode state
  const [activeTab, setActiveTab] = useState<AuthTab>("magic");
  const [mode, setMode] = useState<AuthMode>("signin");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        // Sign up with email and password
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Create profile
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email,
            display_name: name,
            self_level: "intermediate",
            current_level: 0,
          });

          if (profileError) throw profileError;

          router.push("/");
        }
      } else {
        // Sign in with email and password
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="max-w-md w-full mx-4">
        {!sent ? (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">
              Welcome to Coco 👋
            </h1>
            <p className="text-neutral-400 text-center mb-8">
              Sign in to start learning English
            </p>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-6 bg-zinc-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("magic");
                  setError(null);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  activeTab === "magic"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Magic Link
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("password");
                  setError(null);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  activeTab === "password"
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
            </div>

            {/* Magic Link Form */}
            {activeTab === "magic" && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {loading ? "Sending..." : "Send Magic Link"}
                </button>
              </form>
            )}

            {/* Password Form */}
            {activeTab === "password" && (
              <form onSubmit={handlePasswordAuth} className="space-y-4">
                {mode === "signup" && (
                  <div>
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
                )}

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    disabled={loading}
                    minLength={6}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="text-red-400 text-sm text-center bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email || !password || (mode === "signup" && !name)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Sign Up"}
                </button>

                {/* Toggle between Sign In / Sign Up */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === "signin" ? "signup" : "signin");
                      setError(null);
                    }}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    {mode === "signin"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
            <div className="text-6xl mb-4">📧</div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Check your email!
            </h2>
            <p className="text-neutral-300 mb-2">
              We sent a magic link to <strong className="text-white">{email}</strong>
            </p>
            <p className="text-neutral-400 text-sm">
              Click the link in your email to sign in
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

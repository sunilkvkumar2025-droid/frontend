// File: app/page.tsx
// Home page with action cards for starting lessons and viewing feedback

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../components/layout/TopNav";
import HomeCard from "../components/home/HomeCard";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { callFunction } from "../lib/functions";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [hasProfile, setHasProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [startingSession, setStartingSession] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Check if profile exists and has valid self_level
  useEffect(() => {
    if (!user) return;

    const checkProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, self_level")
        .eq("id", user.id)
        .single();

      if (!data) {
        router.push("/onboarding");
      } else if (!data.self_level) {
        // Profile exists but self_level is null - redirect to onboarding to set it
        router.push("/onboarding");
      } else {
        setHasProfile(true);
      }
      setCheckingProfile(false);
    };

    checkProfile();
  }, [user, router]);

  const handleStartLesson = async () => {
    setStartingSession(true);
    try {
      // First, verify the profile has a valid self_level
      const { data: profile } = await supabase
        .from("profiles")
        .select("self_level")
        .eq("id", user!.id)
        .single();

      console.log("Profile self_level:", profile?.self_level);

      const payload = {
        topic: null,
        level_hint: profile?.self_level || "intermediate",
      };

      console.log("Sending to start-session:", payload);

      const response = await callFunction<{ sessionId: string }>("start-session", payload);

      if (response?.sessionId) {
        router.push(`/chat?s=${response.sessionId}`);
      }
    } catch (error) {
      console.error("Failed to start session:", error);
      alert(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setStartingSession(false);
    }
  };

  // Show loading state while checking auth/profile
  if (loading || checkingProfile || !hasProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950">
      <TopNav />

      {/* Main content with padding for fixed TopNav */}
      <main className="pt-20 px-4 py-8 max-w-2xl mx-auto">
        <div className="space-y-6">
          {/* Start Lesson Card */}
          <HomeCard
            title="Ready for your lesson?"
            subtitle="Let's practice English together with Coco!"
            buttonText="Start Lesson"
            onClick={handleStartLesson}
            gradient="warm"
            icon="🎤"
            loading={startingSession}
          />

          {/* Progress/Feedback Card */}
          <HomeCard
            title="Your Progress"
            subtitle="See how you're improving session by session"
            buttonText="View Feedback"
            buttonHref="/feedback"
            gradient="cool"
            icon="📊"
          />
        </div>
      </main>
    </div>
  );
}

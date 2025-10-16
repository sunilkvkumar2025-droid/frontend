// File: app/chat/page.tsx
// Next.js (App Router) page wrapper

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import TopNav from "../../components/layout/TopNav";
import ChatWindow from "../../components/chat/ChatWindow";
import { useAuth } from "../../hooks/useAuth";

export default function ChatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopNav />
      {/* Stage below TopNav; 5rem ≈ pt-20 (adjust if your TopNav height differs) */}
      <div className="pt-20">
        {/* 👇 allow page to scroll; give the stage a real height context */}
        <div className="mx-auto max-w-6xl px-4 h-[calc(100vh-5rem)] min-h-0">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}

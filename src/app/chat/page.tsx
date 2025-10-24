// File: app/chat/page.tsx
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
    if (!loading && !user) router.push("/login");
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
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar sits above the fixed chat region */}
      <TopNav />

      {/* FIXED chat region:
         - top-[56px]/top-14 must match TopNav height
         - bottom-0 anchors to bottom of viewport
         - overflow-hidden so the page doesn't double-scroll
      */}
      <main className="fixed inset-x-0 top-14 bottom-0 bg-zinc-950 overflow-hidden">
        <ChatWindow />
      </main>
    </div>
  );
}

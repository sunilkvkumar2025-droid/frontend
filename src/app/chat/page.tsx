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
    <div className="min-h-screen bg-zinc-950">
      {/* Ensure TopNav is fixed (or at least takes exactly ~64px height) */}
      <TopNav />

      {/* Full-bleed canvas below the nav. Adjust top-16 to match TopNav height */}
      <main className="fixed inset-x-0 top-14 bottom-0 bg-zinc-950">
        <ChatWindow />
      </main>
    </div>
  );
}

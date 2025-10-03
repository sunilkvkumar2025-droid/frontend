// File: app/chat/page.tsx
// Next.js (App Router) page wrapper

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

      {/* Main content with padding for fixed TopNav */}
      <div className="pt-20">
        {/* Back to Home button */}
        <div className="w-full mx-auto max-w-3xl px-4 pt-4">
          <Link href="/">
            <button className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm">
              <span>←</span>
              <span>Back to Home</span>
            </button>
          </Link>
        </div>

        {/* Chat Window */}
        <div className="w-full mx-auto max-w-3xl px-4 py-6">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}
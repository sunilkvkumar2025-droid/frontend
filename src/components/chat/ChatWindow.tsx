// File: components/chat/ChatWindow.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import Link from "next/link";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ScoreResultsModal from "./ScoreResultsModal";
import { useAudioQueue, resumeAudio } from "../../hooks/useAudioQueue";
import { useSSEChat } from "../../hooks/useSSEChat";
import { useEndSession } from "../../hooks/useEndSession";
import { AvatarPhoto } from "../avatar/AvatarPhoto";
import { createClient } from "@supabase/supabase-js";

export type Role = "user" | "assistant" | "system";
export type Message = { id: string; role: Role; text: string; wantAudio?: boolean };

type ScoreData = {
  rubric: { pronunciation: number | null; content: number; vocabulary: number; grammar: number };
  overall_score_0_100: number;
  estimated_cefr: string;
  section_summaries?: { [key: string]: string };
  mistakes?: {
    grammar?: Array<{ original: string; corrected: string; brief_rule: string }>;
    vocabulary?: Array<{ original: string; suggestion: string; reason: string }>;
    content?: Array<{ issue: string; suggestion: string }>;
    pronunciation?: Array<{ example: string; suggestion: string }>;
  };
  actionable_feedback?: string[];
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Phase = "idle" | "userRecording" | "llm" | "tts";

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    { id: "m-welcome", role: "assistant", text: "Hi! I’m Coco. Tell me about your day!" },
  ]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const { enqueue, clear, level: ttsLevel, audioRef } = useAudioQueue();
  const { send, abort } = useSSEChat();
  const { endSession, isEnding } = useEndSession();
  const [phase, setPhase] = useState<Phase>("idle");

  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  // measure sticky bar height so last message never hides
  const chatbarRef = useRef<HTMLDivElement | null>(null);
  const [chatbarH, setChatbarH] = useState(72);
  useLayoutEffect(() => {
    if (!chatbarRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry?.contentRect?.height) setChatbarH(Math.ceil(entry.contentRect.height));
    });
    ro.observe(chatbarRef.current);
    return () => ro.disconnect();
  }, []);

  // 🆕 keep user near bottom
  const scrollToNinetyPercent = (instant = false) => {
    const el = scrollBoxRef.current;
    if (!el) return;
    const range = Math.max(0, el.scrollHeight - el.clientHeight);
    const target = Math.floor(range * 0.95);
    el.scrollTo({ top: target, behavior: instant ? "auto" : "smooth" });
  };

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) setSessionId(s);
  }, []);

  useEffect(() => {
    scrollToNinetyPercent(true);
  }, [messages, isStreaming]);

  const getAccessToken = useMemo(() => {
    return async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };
  }, []);

  const handleBargeIn = () => {
    abort();
    clear();
    setIsStreaming(false);
    setPhase("idle");
  };

  const handleSend = async (input: string, wantAudio: boolean) => {
    if (!input.trim() || isStreaming) return;
    if (!sessionId) {
      alert("No active session.");
      return;
    }

    resumeAudio();
    clear();

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: input.trim(), wantAudio };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", text: "" }]);

    setIsStreaming(true);
    setPhase("llm");

    try {
      await send(
        { sessionId, text: userMsg.text, wantAudio, getAccessToken },
        (evt) => {
          if (evt.type === "token") {
            setMessages((m) =>
              m.map((msg) => (msg.id === assistantId ? { ...msg, text: msg.text + evt.text } : msg))
            );
          } else if (evt.type === "audio" && userMsg.wantAudio) {
            enqueue(evt.url);
            setPhase("tts");
          } else if (evt.type === "done") {
            setIsStreaming(false);
            if (!userMsg.wantAudio) setPhase("idle");
          }
        }
      );
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: msg.text || "(connection error — please try again)" }
            : msg
        )
      );
      setIsStreaming(false);
      setPhase("idle");
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    const result = await endSession(sessionId, null);
    if (result) {
      setScoreData(result);
      setShowScoreModal(true);
    }
  };

  const handleStartNewSession = () => {
    setMessages([{ id: "m-welcome", role: "assistant", text: "Hi! I’m Coco. Let’s talk!" }]);
    setSessionId(null);
    setShowScoreModal(false);
    setScoreData(null);
    setPhase("idle");
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPhase("tts");
    const onEnded = () => setPhase("idle");
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onEnded);
    el.addEventListener("pause", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("pause", onEnded);
    };
  }, [audioRef]);

  return (
    // ✅ CHANGED: stack vertically on mobile, side-by-side from sm+
    <div className="flex flex-col sm:flex-row w-full h-full min-h-screen overflow-hidden"> {/* ✅ CHANGED */}
      {/* LEFT PANEL */}
      {/* ✅ CHANGED: hide sidebar on small screens */}
      <aside className="hidden sm:flex shrink-0 w-[260px] md:w-[300px] h-full bg-zinc-900/40 border-r border-zinc-800"> {/* ✅ CHANGED */}
        <div className="h-full flex flex-col p-4">
          <Link href="/" className="inline-flex items-center gap-2 text-neutral-300 hover:text-white text-sm mb-2">
            <span>←</span><span>Back to Home</span>
          </Link>
          <div className="w-full h-px bg-zinc-800 my-2" />
          <div className="flex-1 flex items-start justify-center">
            <AvatarPhoto
              phase={phase}
              level={ttsLevel}
              width={180}   // ✅ CHANGED: slightly smaller for mid screens
              height={180}  // ✅ CHANGED
              baseSrc="/avatars/coco/base.png"
              mouthOpenSrc="/avatars/coco/mouth-open.png"
            />
          </div>
        </div>
      </aside>

      {/* CHAT AREA */}
      <section
        ref={scrollBoxRef}
        className="
          flex flex-col flex-1 min-w-0 h-full overflow-y-auto scroll-smooth
          rounded-none sm:rounded-2xl                         /* ✅ CHANGED */
          p-2 sm:p-6                                         /* ✅ CHANGED */
          scroll-pt-6
          [scrollbar-gutter:stable] overscroll-contain
          custom-scroll
          bg-zinc-950                                        /* ✅ CHANGED: ensure full black behind */
        "
        style={{
          // keep space for sticky bar on very short viewports
          paddingBottom: chatbarH + 4,
        }}
      >
        {/* Frame */}
        <div className="flex-1 min-w-0">
          <div className="h-full rounded-xl sm:rounded-2xl border border-zinc-800/60 bg-zinc-950"> {/* ✅ CHANGED: softer border */}
            {/* Scrollable message column */}
            <div className="h-full">
              <MessageList messages={messages} isStreaming={isStreaming} />
              <div ref={bottomAnchorRef} className="h-0" />
            </div>
          </div>
        </div>

        {/* Sticky input (measured) */}
        <div
          ref={chatbarRef}
          className="
            sticky bottom-0 left-0 right-0 z-30
            bg-zinc-950/95
            px-2 sm:px-6 lg:px-10                 /* ✅ CHANGED */
            py-2 sm:py-4                          /* ✅ CHANGED */
            shadow-[0_-1px_0_0_#27272a]
            backdrop-blur
            pb-[env(safe-area-inset-bottom)]      /* ✅ CHANGED: iOS safe area */
          "
        >
          <div className="flex items-center gap-2">
            {/* ChatInput expands to fill row */}
            <div className="flex-1">
              <ChatInput
                onSend={handleSend}
                onStop={() => {
                  abort();
                  setIsStreaming(false);
                  setPhase("idle");
                }}
                onBargeIn={handleBargeIn}
                isStreaming={isStreaming}
              />
            </div>

            {/* End Session button at the end of row */}
            {sessionId && messages.length > 2 && (
              <button
                onClick={handleEndSession}
                disabled={isStreaming || isEnding}
                className="
                  px-3 sm:px-4 py-2
                  bg-neutral-800 hover:bg-neutral-700
                  rounded-xl text-sm font-medium transition-colors
                  whitespace-nowrap
                "
                title="End Session"
              >
                <span className="sm:hidden">🏁</span>            {/* ✅ CHANGED: icon-only on mobile */}
                <span className="hidden sm:inline">🏁 End Session</span> {/* ✅ CHANGED */}
              </button>
            )}
          </div>
        </div>
      </section>

      <ScoreResultsModal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        scoreData={scoreData}
        onStartNew={handleStartNewSession}
      />
    </div>
  );
}

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
  // --- state ---
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

  // --- layout refs for scroll + footer height ---
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const footerRef = useRef<HTMLDivElement | null>(null);
  const [footerH, setFooterH] = useState(120);

  useLayoutEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry?.contentRect?.height) {
        setFooterH(Math.ceil(entry.contentRect.height));
      }
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  // scroll helper
  const scrollNearBottom = (instant = false) => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const maxScrollable = Math.max(0, el.scrollHeight - el.clientHeight);
    const target = Math.floor(maxScrollable * 0.98);
    el.scrollTo({ top: target, behavior: instant ? "auto" : "smooth" });
  };

  // pull sessionId from URL
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) setSessionId(s);
  }, []);

  // keep view near bottom when new content arrives
  useEffect(() => {
    scrollNearBottom(true);
  }, [messages, isStreaming]);

  // auth helper
  const getAccessToken = useMemo(() => {
    return async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };
  }, []);

  // barge-in: interrupt AI speech/stream
  const handleBargeIn = () => {
    abort();
    clear();
    setIsStreaming(false);
    setPhase("idle");
  };

  // send user text (or transcript)
  const handleSend = async (input: string, wantAudio: boolean) => {
    if (!input.trim() || isStreaming) return;
    if (!sessionId) {
      alert("No active session.");
      return;
    }

    resumeAudio();
    clear();

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: input.trim(),
      wantAudio,
    };
    const assistantId = `a-${Date.now()}`;

    // optimistic append
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", text: "" }]);

    setIsStreaming(true);
    setPhase("llm");

    try {
      await send(
        { sessionId, text: userMsg.text, wantAudio, getAccessToken },
        (evt) => {
          if (evt.type === "token") {
            // stream model tokens
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId ? { ...msg, text: msg.text + evt.text } : msg
              )
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
      // graceful fallback if SSE fails
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
              ...msg,
              text: msg.text || "(connection error — please try again)",
            }
            : msg
        )
      );
      setIsStreaming(false);
      setPhase("idle");
    }
  };

  // end session -> show score modal
  const handleEndSession = async () => {
    if (!sessionId) return;
    const result = await endSession(sessionId, null);
    if (result) {
      setScoreData(result);
      setShowScoreModal(true);
    }
  };

  const handleStartNewSession = () => {
    setMessages([
      { id: "m-welcome", role: "assistant", text: "Hi! I’m Coco. Let’s talk!" },
    ]);
    setSessionId(null);
    setShowScoreModal(false);
    setScoreData(null);
    setPhase("idle");
  };

  // track shared audio element to know if TTS is active
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
    // IMPORTANT:
    // - h-full means: fill the <main> fixed area from page.tsx
    // - overflow-hidden on root stops body scrolling underneath on iOS
    <div className="h-full w-full bg-zinc-950 text-white flex flex-col sm:flex-row overflow-hidden">
      {/* LEFT SIDEBAR (hidden on phones) */}
      <aside className="hidden sm:flex shrink-0 w-[240px] md:w-[280px] lg:w-[300px] h-full bg-zinc-900/40 border-r border-zinc-800">
        <div className="h-full flex flex-col p-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-neutral-300 hover:text-white text-sm mb-2"
          >
            <span>←</span>
            <span>Back to Home</span>
          </Link>

          <div className="w-full h-px bg-zinc-800 my-2" />

          <div className="flex-1 flex items-start justify-center">
            <AvatarPhoto
              phase={phase}
              level={ttsLevel}
              width={180}
              height={180}
              baseSrc="/avatars/coco/base.png"
              mouthOpenSrc="/avatars/coco/mouth-open.png"
            />
          </div>
        </div>
      </aside>

      {/* CHAT COLUMN */}
      {/* min-h-0 + flex-col prevents footer overlap on short screens */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-zinc-950">
        {/* Scrollable message area */}
        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth p-2 sm:p-6 [scrollbar-gutter:stable] custom-scroll"
          style={{
            paddingBottom: footerH + 84, // keep last bubble visible
          }}
        >
          <div className="h-full rounded-xl sm:rounded-2xl  border-zinc-800/60 bg-zinc-950">
            <MessageList messages={messages} isStreaming={isStreaming} />
            <div ref={bottomAnchorRef} className="h-0" />
          </div>
        </div>

        {/* Sticky footer (input row + End Session) */}

        {/* Sticky footer (input row + End Session) */}
        <div
          ref={footerRef}
          className="
    sticky bottom-0 left-0 right-0 z-30
    bg-zinc-950/95 backdrop-blur
    shadow-[0_-1px_0_0_#27272a]
    border-t border-zinc-800/60
    px-2 sm:px-6 lg:px-10
    py-2 sm:py-3
    pb-[env(safe-area-inset-bottom)]
  "
        >
          {/* Flex container ensures ChatInput and End Session align horizontally */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* ChatInput takes remaining width */}
            <div className="flex-1 min-w-[200px]">
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

            {/* End Session button stays aligned on same row */}
            {sessionId && messages.length > 2 && (
              <button
                onClick={handleEndSession}
                disabled={isStreaming || isEnding}
                className="
          flex-shrink-0
          px-3 sm:px-5 h-10 sm:h-11
          bg-neutral-800 hover:bg-neutral-700
          disabled:opacity-50 disabled:cursor-not-allowed
          rounded-xl text-sm font-medium transition-colors
          whitespace-nowrap text-white
        "
                title="End Session"
              >
                <span className="sm:hidden">🏁</span>
                <span className="hidden sm:inline">🏁 End Session</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Score modal */}
      <ScoreResultsModal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        scoreData={scoreData}
        onStartNew={handleStartNewSession}
      />
    </div>
  );
}

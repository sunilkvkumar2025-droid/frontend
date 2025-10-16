// File: components/chat/ChatWindow.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (s) setSessionId(s);
  }, []);

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
    // Grid container
    <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-4 w-full">
      {/* LEFT PANEL */}
      <aside className="sticky top-20 h-fit shrink-0 rounded-2xl p-4 flex flex-col items-center gap-4 bg-zinc-900/40">
        <Link
          href="/"
          className="self-start inline-flex items-center gap-2 text-neutral-300 hover:text-white text-sm transition-colors"
        >
          <span>←</span>
          <span>Back to Home</span>
        </Link>

        <div className="w-full h-px bg-zinc-800 my-1" />

        <AvatarPhoto
          phase={phase}
          level={ttsLevel}
          width={240}
          height={240}
          baseSrc="/avatars/coco/base.png"
          mouthOpenSrc="/avatars/coco/mouth-open.png"
        />
      </aside>

      {/* RIGHT PANEL — browser will scroll this naturally */}
      <section className="flex flex-col w-full">
        {/* Messages grow naturally → browser scroll */}
        <div className="flex-1 flex flex-col justify-end min-h-[70vh] pb-4">
          <MessageList messages={messages} isStreaming={isStreaming} />
        </div>

        {/* Sticky input at browser bottom */}
        <div className="sticky bottom-0 left-0 right-0 bg-zinc-950/95 py-3 px-2 z-10">
          {sessionId && messages.length > 2 && (
            <div className="flex justify-end relative top-13">
              <button
                onClick={handleEndSession}
                disabled={isStreaming || isEnding}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-medium transition-colors"
              >
                🏁 End Session
              </button>
            </div>
          )}

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

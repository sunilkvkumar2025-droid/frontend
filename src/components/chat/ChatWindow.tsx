// File: components/chat/ChatWindow.tsx
// Client component that orchestrates messages, input, and (later) streaming"use client";

"use client";

import { useEffect, useMemo, useState } from "react";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ScoreResultsModal from "./ScoreResultsModal";
import { useAudioQueue, resumeAudio } from "../../hooks/useAudioQueue";
import { useSSEChat } from "../../hooks/useSSEChat";
import { useEndSession } from "../../hooks/useEndSession";
import { AvatarContainer } from "../avatar/AvatarContainer"; 
import { AvatarPhoto } from "../avatar/AvatarPhoto";

export type Role = "user" | "assistant" | "system";
export type Message = {
    id: string;
    role: Role;
    text: string;
    wantAudio?: boolean; // stored per turn
};

type ScoreData = {
    rubric: {
        pronunciation: number | null;
        content: number;
        vocabulary: number;
        grammar: number;
    };
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

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type Phase = "idle" | "userRecording" | "llm" | "tts"; 


export default function ChatWindow() {
    const [messages, setMessages] = useState<Message[]>([
    {
    id: "m-welcome",
    role: "assistant",
    text: "Hi! I’m Coco. Tell me about your day and let’s practice English together!",
    },
    ]);

    const [isStreaming, setIsStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [scoreData, setScoreData] = useState<ScoreData | null>(null);
    const { enqueue, clear, level: ttsLevel, audioRef } = useAudioQueue();
    const { send, abort } = useSSEChat();
    const { endSession, isEnding } = useEndSession();  
    const [phase, setPhase] = useState<Phase>("idle");
  

    const handleBargeIn = () => {
        abort();        // stop Coco's current turn
        clear();        // stop any playing audio immediately
        setIsStreaming(false);
        setPhase("idle"); //avatar back to idle
      };
      
    
    // Pick up an existing session id from the URL (?s= or ?sessionId=) for now.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const s = params.get("s") || params.get("sessionId");
        if (s) setSessionId(s);
        }, []);
        
        
        const getAccessToken = useMemo(() => {
        return async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
        };
        }, []);
        
        
        const handleSend = async (input: string, wantAudio: boolean) => {
        if (!input.trim() || isStreaming) return;
        if (!sessionId) {
        alert("No active session. Open /app/test to start one or pass ?s=SESSION_ID in the URL.");
        return;
        }
        
        // mobile autoplay unlock
    resumeAudio(); // ensure AudioContext is resumed from this user gesture

        // cancel any queued/playing audio on user turn change
    clear();


    const userMsg: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        text: input.trim(),
        wantAudio,
    };
    const assistantId = `a-${Date.now()}`;


    setMessages((m) => [
        ...m,
        userMsg,
        { id: assistantId, role: "assistant", text: "" },
    ]);


    setIsStreaming(true);
    setPhase("llm"); //  avatar thinking while we wait for SSE/audio

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
    } else if (evt.type === "audio") {
    if (userMsg.wantAudio) {enqueue(evt.url); setPhase("tts"); // avatar speaking during TTS
    }} else if (evt.type === "done") {
    setIsStreaming(false);
    if (!userMsg.wantAudio) setPhase("idle");
    }
    }
    );
    } catch (e) {
    console.error("stream error", e);
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
        setMessages([
            {
                id: "m-welcome",
                role: "assistant",
                text: "Hi! I'm Coco. Tell me about your day and let's practice English together!",
            },
        ]);
        setSessionId(sessionId);
        setShowScoreModal(false);
        setScoreData(null);
        setPhase("idle");
    };

      // when the single <audio> starts/ends, keep avatar in sync
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => setPhase("tts");
    const onEnded = () => setPhase("idle");

    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onEnded);
    el.addEventListener("pause", onEnded); // covers interrupted playback

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("pause", onEnded);
    };
  }, [audioRef]);

    return (
    <div className="w-full flex flex-col gap-3">
      {/* Avatar sits above messages; small padding keeps layout neat */}
<div className="w-full flex items-center justify-center pt-1">
  <AvatarPhoto
    phase={phase}
    level={ttsLevel}   // later you can feed mic level when phase === 'listening'
    width={280}
    height={280}
    baseSrc="/avatars/coco/base.png"
    mouthOpenSrc="/avatars/coco/mouth-open.png"
    // mouthMidSrc="/avatars/coco/mouth-mid.png" // optional
  />
</div>
      {!sessionId ? (
        <div className="text-xs text-amber-300/90 border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-2">
          Tip: Provide a session via <code>?s=SESSION_ID</code> in the URL or wire an auto &quot;start-session&quot; here.
        </div>
      ) : null}

      <MessageList messages={messages} isStreaming={isStreaming} />

      {sessionId && messages.length > 2 && (
        <div className="flex justify-end">
          <button
            onClick={handleEndSession}
            disabled={isStreaming || isEnding}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:opacity-50 border border-neutral-600 rounded-xl text-sm font-medium transition-colors"
          >
            🏁 End Session
          </button>
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        onStop={() => { abort(); setIsStreaming(false); setPhase("idle"); }}
        onBargeIn={() => { handleBargeIn(); }}
        isStreaming={isStreaming}
      />

      <ScoreResultsModal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        scoreData={scoreData}
        onStartNew={handleStartNewSession}
      />
    </div>
  );
}

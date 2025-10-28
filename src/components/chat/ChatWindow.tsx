  "use client";

  import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useLayoutEffect,
  } from "react";
  import MessageList from "./MessageList";
  import ChatInput from "./ChatInput";
  import ScoreResultsModal from "./ScoreResultsModal";
  import { useAudioQueue, resumeAudio } from "../../hooks/useAudioQueue";
  import { useSSEChat } from "../../hooks/useSSEChat";
  import { useEndSession } from "../../hooks/useEndSession";
  import { AvatarPhoto } from "../avatar/AvatarPhoto";
  import { createClient } from "@supabase/supabase-js";

  export type Role = "user" | "assistant" | "system";

  export type Message = {
    id: string;
    role: Role;
    text: string;
    wantAudio?: boolean;
    correction?: string | null;
    appreciation?: string | null;
    contribution?: string | null;
    question?: string | null;
    stt_metadata?: {
      method: string;
      language: string;
      timestamp: string;
      duration_ms?: number;
      user_corrected?: boolean;
      correction_text?: string;
    };
    message_db_id?: number;
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
      grammar?: Array<{
        original: string;
        corrected: string;
        brief_rule: string;
      }>;
      vocabulary?: Array<{
        original: string;
        suggestion: string;
        reason: string;
      }>;
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
    // --- chat state ---
    const [messages, setMessages] = useState<Message[]>([
      {
        id: "m-welcome",
        role: "assistant",
        text: "Hi! I’m Coco. Tell me about your day!",
      },
    ]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // score modal
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [scoreData, setScoreData] = useState<ScoreData | null>(null);

    // audio / phases
    const { enqueue, clear, level: ttsLevel, audioRef } = useAudioQueue();
    const { send, abort } = useSSEChat();
    const { endSession, isEnding } = useEndSession();
    const [phase, setPhase] = useState<Phase>("idle");

    // layout + scroll refs
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

    const footerRef = useRef<HTMLDivElement | null>(null);
    const [footerH, setFooterH] = useState(120);

    // track whether we've already done the initial scroll positioning
    const didInitialScrollRef = useRef(false);

    // --- measure footer height so we can pad scrollable area correctly
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

    // --- scrolling helper
    // instant=true uses "auto" instead of "smooth" to avoid animation jumps
    // ratioOverride lets us explicitly say "85%" on first load if needed.
    const scrollNearBottom = (
      instant = false,
      ratioOverride?: number
    ) => {
      const el = scrollAreaRef.current;
      if (!el) return;

      const scrollHeight = el.scrollHeight;   // total content height
      const clientHeight = el.clientHeight;   // visible viewport height

      // If content fits in view, don't force-scroll.
      // That keeps the first welcome message visible instead of getting pushed off-screen.
      if (scrollHeight <= clientHeight) {
        return;
      }

      // We have overflow -> figure out where to position.
      const maxScrollable = Math.max(0, scrollHeight - clientHeight);

      // Default rule:
      // - If we only have 1 message (welcome), aim ~85% down.
      // - Otherwise stick to the bottom (100%).
      console.log("Messages length:", messages.length);
      const defaultRatio = messages.length === 1 ? 0.10 : 1;

      const ratio = ratioOverride ?? defaultRatio;
      const target = Math.floor(maxScrollable * ratio);

      el.scrollTo({
        top: target,
        behavior: instant ? "auto" : "smooth",
      });
    };

    // --- read sessionId from URL (?s=...)
    useEffect(() => {
      const s = new URLSearchParams(window.location.search).get("s");
      if (s) setSessionId(s);
    }, []);

    // --- first-load scroll positioning
    // We wait until footerH is known (which means layout is basically final)
    // and then *once* try to position content.
    useLayoutEffect(() => {
      if (didInitialScrollRef.current) return;
      requestAnimationFrame(() => {
        // try to position first bubble (or whatever we have)
        scrollNearBottom(true, 0.10);
        didInitialScrollRef.current = true;
      });
    }, [footerH]);

    // --- autoscroll whenever new messages / streaming updates AFTER first load
    useEffect(() => {
      if (didInitialScrollRef.current) {
        scrollNearBottom(true);
      }
    }, [messages, isStreaming]);

    // --- auth helper for API calls
    const getAccessToken = useMemo(() => {
      return async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      };
    }, []);

    // --- INTERRUPT AI (barge in)
    const handleBargeIn = () => {
      abort();
      clear();
      setIsStreaming(false);
      setPhase("idle");
    };

    // --- SEND MESSAGE
    const handleSend = async (
      input: string,
      wantAudio: boolean,
      stt_metadata?: any
    ) => {
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
        stt_metadata,
      };
      const assistantId = `a-${Date.now()}`;

      // optimistic append to UI
      setMessages((m) => [
        ...m,
        userMsg,
        { id: assistantId, role: "assistant", text: "" },
      ]);

      // save user message in DB with STT metadata
      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            session_id: sessionId,
            role: "user",
            content: userMsg.text,
            stt_metadata: userMsg.stt_metadata,
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to save message:", error);
        } else if (data) {
          userMsg.message_db_id = data.id;
          // update message in state with db id
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMsg.id
                ? { ...msg, message_db_id: data.id }
                : msg
            )
          );
        }
      } catch (e) {
        console.error("Error saving message:", e);
      }

      setIsStreaming(true);
      setPhase("llm");

      try {
        await send(
          { sessionId, text: userMsg.text, wantAudio, getAccessToken },
          (evt) => {
            if (evt.type === "token") {
              // stream assistant text tokens into the assistant stub
              setMessages((m) =>
                m.map((msg) =>
                  msg.id === assistantId
                    ? { ...msg, text: msg.text + evt.text }
                    : msg
                )
              );
            } else if (evt.type === "audio") {
              // enqueue TTS audio if user wants audio
              if (userMsg.wantAudio) {
                enqueue(evt.url);
                setPhase("tts");
              }
            } else if (evt.type === "audio_error") {
              console.error("[ChatWindow] Audio error:", evt.message);
            } else if (evt.type === "done") {
              // streaming finished
              setIsStreaming(false);
              if (!userMsg.wantAudio) setPhase("idle");

              // parse the final structured feedback blob (correction/appreciation/etc)
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];

                if (
                  lastMsg &&
                  lastMsg.role === "assistant" &&
                  evt.fullText
                ) {
                  try {
                    const parsed = JSON.parse(evt.fullText);
                    lastMsg.correction = parsed.correction || null;
                    lastMsg.appreciation = parsed.appreciation || null;
                    lastMsg.contribution = parsed.contribution || null;
                    lastMsg.question = parsed.question || null;
                  } catch (e) {
                    console.warn(
                      "Could not parse fullText as JSON:",
                      e
                    );
                  }
                }

                return updated;
              });
            }
          }
        );
      } catch (e) {
        console.error("stream error", e);
        // surface an error message in assistant bubble
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  text:
                    msg.text ||
                    "(connection error — please try again)",
                }
              : msg
          )
        );
        setIsStreaming(false);
        setPhase("idle");
      }
    };

    // --- END SESSION
    const handleEndSession = async () => {
      if (!sessionId) return;
      const result = await endSession(sessionId, null);
      if (result) {
        setScoreData(result);
        setShowScoreModal(true);
      }
    };

    // --- START NEW SESSION
    const handleStartNewSession = () => {
      setMessages([
        {
          id: "m-welcome",
          role: "assistant",
          text: "Hi! I’m Coco. Let’s talk!",
        },
      ]);
      setSessionId(null);
      setShowScoreModal(false);
      setScoreData(null);
      setPhase("idle");
      didInitialScrollRef.current = false; // so first-load logic runs again on next session
    };

    // --- keep track of audio element -> phase
    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;

      const onPlay = () => {
        setPhase("tts");
      };
      const onEnded = () => {
        setPhase("idle");
      };

      el.addEventListener("play", onPlay);
      el.addEventListener("ended", onEnded);
      el.addEventListener("pause", onEnded);

      return () => {
        el.removeEventListener("play", onPlay);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("pause", onEnded);
      };
    }, [audioRef]);

    // --- RENDER ---
    return (
      <div
        className="
          bg-zinc-950 text-white
          grid
          grid-rows-[25%_75%]
          h-[100dvh] min-h-0 w-full
        "
      >

        {/* TOP 25%: Avatar / header area */}
<header
    className="
      relative isolate flex flex-col items-center justify-center overflow-hidden
      border-b border-white/5 bg-[#0b1014]
    "
  >
    {/* ambient layers */}
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(96,132,176,0.18)_0%,_rgba(36,52,73,0.36)_32%,_rgba(10,15,22,0.92)_78%,_rgba(7,10,14,1)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f1622]/55 to-[#05070a]" />
    </div>

    <div className="relative flex flex-col items-center gap-8 pb-12 pt-16">
      <div className="relative flex items-center justify-center">
        <div className="absolute -inset-12 rounded-full bg-[radial-gradient(circle,_rgba(103,139,182,0.24)_0%,transparent_65%)] blur-[90px] opacity-70" />
        <div
          className="
            relative h-[180px] w-[180px] overflow-hidden rounded-full
            bg-[radial-gradient(circle_at_32%_28%,rgba(124,155,193,0.2),rgba(45,63,87,0.7),rgba(9,14,21,1))]
            shadow-[0_32px_60px_-36px_rgba(7,10,16,0.92)]
          "
        >
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
</div>
  </header>


        {/* BOTTOM 75%: Chat area */}
   <main
    className="
      relative isolate flex flex-col min-h-0 min-w-0
      bg-[#0a1117]
    "
  >
    {/* ambient tint */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(90,116,148,0.16)_0%,_rgba(34,48,66,0.34)_32%,_rgba(10,16,22,0.92)_76%,_rgba(7,10,15,1)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-[#060b11] via-[#0a1117]/80 to-transparent" />
    </div>

    {/* scrollable messages */}
    <div
      ref={scrollAreaRef}
      className="
        relative flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-smooth
        px-2 sm:px-6 [scrollbar-gutter:stable] custom-scroll bg-[#0a1117]/95
      "
      style={{
        paddingTop: 12,
        paddingBottom: footerH + 24,
      }}
    >
      <div className="relative rounded-2xl border-white/[0.06] bg-[#0a1117]/95 shadow-[0_26px_58px_-46px_rgba(5,9,14,0.7)] backdrop-blur">
        <MessageList messages={messages} isStreaming={isStreaming} />
        <div className="h-6 sm:h-8" />
        <div ref={bottomAnchorRef} className="h-0" />
      </div>
    </div>

    {/* sticky footer shares same surface */}
    <div
      ref={footerRef}
      className="
        sticky bottom-0 left-0 right-0 z-20
        border-t border-white/[0.06]
        bg-[#080d12]/95 backdrop-blur-xl
        shadow-[0_-18px_44px_-36px_rgba(5,8,13,0.85)]
        px-2 sm:px-6 lg:px-10
        py-2 sm:py-3
        pb-[env(safe-area-inset-bottom)]
      "
    >

      <div className="flex items-center gap-2 flex-wrap">
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

        {sessionId && messages.length > 2 && (
          <button
            onClick={handleEndSession}
            disabled={isStreaming || isEnding}
            className="
              flex-shrink-0
              px-4 py-2 sm:px-5 h-10 sm:h-11
              rounded-xl text-sm font-medium transition-colors
              text-white bg-slate-600/80 hover:bg-slate-500/80
              disabled:opacity-50 disabled:cursor-not-allowed
              whitespace-nowrap
            "
            title="End Session"
          >
            <span className="sm:hidden">🏁</span>
            <span className="hidden sm:inline">🏁 End Session</span>
          </button>
        )}
      </div>
    </div>
  </main>




        {/* score modal overlay */}
        <ScoreResultsModal
          isOpen={showScoreModal}
          onClose={() => setShowScoreModal(false)}
          scoreData={scoreData}
          onStartNew={handleStartNewSession}
        />
      </div>
    );
  }

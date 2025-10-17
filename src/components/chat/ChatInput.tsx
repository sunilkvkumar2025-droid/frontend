"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MicButton from "./MicButton";
import { functionUrl } from "../../lib/api";
import { Volume2, VolumeX } from "lucide-react"; // 👈 install lucide-react if not already

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ChatInput({
  onSend,
  onStop,
  isStreaming,
  onBargeIn,
  onEndSession,
}: {
  onSend: (text: string, wantAudio: boolean) => void;
  onStop: () => void;
  isStreaming: boolean;
  onBargeIn?: () => void;
  onEndSession?: () => void;
}) {
  const [wantAudio, setWantAudio] = useState(true);

  const toggleAudio = () => setWantAudio((prev) => !prev);

  const submit = (t: string) => {
    const s = t.trim();
    if (!s) return;
    onSend(s, wantAudio);
  };

  const getAccessToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token ?? null;

  return (
    <div
      className="
        sticky bottom-0 z-10
        border-zinc-800
        bg-zinc-950/85 backdrop-blur
        px-3 sm:px-4
        pt-3
        pb-[max(env(safe-area-inset-bottom),0.75rem)]
      "
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
        {/* 🎧 Left: Audio toggle icon */}
        <button
          type="button"
          onClick={toggleAudio}
          aria-label="Toggle Audio"
          title={wantAudio ? "Audio On" : "Audio Off"}
          className={`
            ml-1 h-10 w-10 flex items-center justify-center rounded-full
            transition active:scale-95
            ${
              wantAudio
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }
          `}
        >
          {wantAudio ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>

        {/* 🎤 Center: Mic + Stop */}
        <div className="flex items-center justify-center">
          <MicButton
            getAccessToken={getAccessToken}
            sttUrl={functionUrl("stt")}
            onStartRecording={() => onBargeIn?.()}
            onTranscript={(finalText) => {
              onBargeIn?.();
              submit(finalText);
            }}
          />

          {isStreaming && (
            <button
              type="button"
              onPointerDown={onStop}
              onClick={onStop}
              className="
                ml-3 px-4 py-2 rounded-full
                bg-red-600/80 hover:bg-red-600
                text-white text-sm
                [touch-action:manipulation] active:scale-[0.98]
                transition
              "
            >
              Stop
            </button>
          )}
        </div>


      </div>
    </div>
  );
}

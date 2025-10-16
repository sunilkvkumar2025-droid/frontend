"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MicButton from "./MicButton";
import { functionUrl } from "../../lib/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export default function ChatInput({
  onSend,
  onStop,
  isStreaming,
  onBargeIn,
}: {
  onSend: (text: string, wantAudio: boolean) => void;
  onStop: () => void;
  isStreaming: boolean;
  onBargeIn?: () => void;
}) {
  const [wantAudio, setWantAudio] = useState(true);

  const submit = (t: string) => {
    const s = t.trim();
    if (!s) return;
    onSend(s, wantAudio);
  };

  const getAccessToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token ?? null;

  return (
    <div className="sticky bottom-0 bg-transparent py-4 border-t border-zinc-800">
      {/* One row: checkbox (left) | Speak (center) | End Session (right) */}
      <div className="flex items-center justify-between w-full">
        {/* Left: Speak toggle */}
        <label className="flex items-center gap-2 text-sm select-none ml-2">
          <input
            type="checkbox"
            checked={wantAudio}
            onChange={(e) => setWantAudio(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          Speak
        </label>

        {/* Center: Mic button */}
        <div className="flex items-center justify-center flex-1">
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
              onPointerDown={onStop}
              onClick={onStop}
              type="button"
              className="ml-3 px-4 py-2 rounded-full bg-red-600/80 hover:bg-red-600 text-white text-sm [touch-action:manipulation] active:scale-[0.98]"
            >
              Stop
            </button>
          )}
        </div>

        {/* Right: End session */}
        {/* <button
          onClick={onStop}
          className="mr-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm text-white transition"
        >
          End Session
        </button> */}
      </div>
    </div>
  );
}

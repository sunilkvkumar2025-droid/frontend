"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MicButton from "./MicButton";
import { functionUrl } from "../../lib/api";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

type ChatInputProps = {
  onSend: (text: string, wantAudio: boolean) => void;
  onStop: () => void;
  isStreaming: boolean;
  onBargeIn?: () => void;
};

export default function ChatInput({
  onSend,
  onStop,
  isStreaming,
  onBargeIn,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [wantAudio, setWantAudio] = useState(true);

  const submit = (t = text) => {
    const s = t.trim();
    if (!s) return;
    onSend(s, wantAudio);
    setText("");
  };

  const getAccessToken = async () =>
    (await supabase.auth.getSession()).data.session?.access_token ?? null;

  return (
    // Fixed footer bar with safe-area padding and strong stacking to avoid overlays
    <div className="fixed inset-x-0 bottom-0 z-[100] bg-zinc-950/80 backdrop-blur pointer-events-auto">
      <div className="px-3 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
        <div className="mt-1 flex items-center gap-2 [touch-action:manipulation]">
          <div className="flex-1">
            <label className="text-xs opacity-70 mb-1 block">Message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Hold 🎤 to speak, or type here…"
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <label className="flex items-center gap-2 text-xs mt-1 select-none">
              <input
                type="checkbox"
                checked={wantAudio}
                onChange={(e) => setWantAudio(e.target.checked)}
              />
              Speak
            </label>
          </div>

          {/* Button column isolated with its own stacking context */}
          <div className="relative z-[101] isolate flex flex-col gap-2 min-w-[200px] items-stretch">
            <div className="flex gap-2">
              <div className="pointer-events-auto [touch-action:manipulation]">
                <MicButton
                  getAccessToken={getAccessToken}
                  sttUrl={functionUrl("stt")}
                  onStartRecording={() => onBargeIn?.()}
                  onPartial={(t) => setText(t)}
                  onTranscript={(finalText) => {
                    onBargeIn?.();
                    submit(finalText);
                  }}
                />
              </div>

              {isStreaming ? (
                <button
                  // Handle touch & mouse reliably
                  onPointerDown={onStop}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStop();
                  }}
                  onClick={onStop}
                  type="button"
                  className="relative z-[101] px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm text-white pointer-events-auto [touch-action:manipulation] active:scale-[0.98]"
                  aria-label="Stop"
                >
                  Stop
                </button>
              ) : (
                <button
                  onPointerDown={() => submit()}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    submit();
                  }}
                  onClick={() => submit()}
                  type="button"
                  className="relative z-[101] px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-sm text-white pointer-events-auto [touch-action:manipulation] active:scale-[0.98]"
                  aria-label="Send"
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

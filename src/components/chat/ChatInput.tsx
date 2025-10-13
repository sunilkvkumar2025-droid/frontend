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
  <div className="sticky bottom-0 bg-transparent">
    <div className="mt-2">
      {/* Row 1: label (kept separate so it doesn't shift vertical alignment) */}
      <label className="text-xs opacity-70 mb-1 block">Message</label>

      {/* Row 2: textarea + actions (aligned vertically to center) */}
      <div className="flex items-center gap-2">
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

        {/* Actions column (Mic + Send/Stop), centered to textarea */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <MicButton
            getAccessToken={getAccessToken}
            sttUrl={functionUrl("stt")}
            onStartRecording={() => onBargeIn?.()}
            onPartial={(t) => setText(t)}          // live partials
            onTranscript={(finalText) => {         // auto-send on final
              onBargeIn?.();
              submit(finalText);
            }}
          />

          {isStreaming ? (
            <button
              onPointerDown={onStop}
              onClick={onStop}
              type="button"
              className="px-3 py-2 rounded-lg bg-red-600/80 hover:bg-red-600 text-sm text-white [touch-action:manipulation] active:scale-[0.98]"
            >
              Stop
            </button>
          ) : (
            <button
              onPointerDown={() => submit()}
              onClick={() => submit()}
              type="button"
              className="px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-sm text-white [touch-action:manipulation] active:scale-[0.98]"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Speak toggle (kept separate) */}
      <label className="flex items-center gap-2 text-xs mt-1">
        <input
          type="checkbox"
          checked={wantAudio}
          onChange={(e) => setWantAudio(e.target.checked)}
        />
        Speak
      </label>
    </div>
  </div>
);
}

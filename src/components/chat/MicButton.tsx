"use client";
import { useState } from "react";
import { useWebSpeechSTT } from "../../hooks/useWebSpeechSTT";
import { useMicCapture } from "../../hooks/useMicCapture";

export default function MicButton({
  onTranscript,
  onPartial,
  onStartRecording,
  sttUrl,
  getAccessToken,
  forceServer = false,
}: {
  onTranscript: (text: string) => void;
  onPartial?: (text: string) => void;
  onStartRecording?: () => void;
  sttUrl: string;
  getAccessToken: () => Promise<string | null>;
  forceServer?: boolean; // optional env toggle
}) {
  const web = useWebSpeechSTT("en-IN");
  const rec = useMicCapture();
  const [busy, setBusy] = useState(false);

  const webOk = !forceServer && web.supported;

  const toggle = async () => {
    // Preferred: Web Speech (low latency)
    if (webOk) {
      if (!web.listening) {
        onStartRecording?.();
        web.start({
          onPartial: (t) => onPartial?.(t),
          onFinal:   (t) => t && onTranscript(t),
        });
      } else {
        web.stop();
      }
      return;
    }

    // Fallback: record → POST to /stt (OpenAI gpt-4o-mini-transcribe)
    if (!rec.isRecording) {
      onStartRecording?.();
      await rec.start();
      return;
    }
    const blob = await rec.stop();
    if (!blob) return;

    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");
      const form = new FormData();
      form.append("file", blob, blob.type.includes("webm") ? "audio.webm" : "audio.wav");
      const res = await fetch(sttUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `STT HTTP ${res.status}`);
      const j = JSON.parse(txt);
      if (j?.text) onTranscript(j.text);
    } catch (e) {
      console.error("STT failed", e);
    } finally {
      setBusy(false);
    }
  };

  const recording = webOk ? web.listening : rec.isRecording;
  const label = recording ? "Stop" : "🎤 Speak";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-3 py-2 rounded-lg text-sm ${recording ? "bg-red-600/80" : "bg-zinc-700/60 hover:bg-zinc-700"}`}
      title={recording ? "Stop" : "Speak"}
    >
      {label}
    </button>
  );
}

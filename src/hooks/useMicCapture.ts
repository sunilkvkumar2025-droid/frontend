"use client";
import { useEffect, useRef, useState } from "react";

export function useMicCapture() {
  const [supported, setSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setSupported(!!(navigator.mediaDevices && (window as any).MediaRecorder));
  }, []);

  async function start() {
    if (!supported || isRecording) return;
    setError(null);
    try {
      mediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = (window as any).MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      recRef.current = new MediaRecorder(mediaRef.current!, { mimeType: mime });
      chunksRef.current = [];
      recRef.current.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recRef.current.onstop = () => {
        mediaRef.current?.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
      };
      recRef.current.start(150);
      setIsRecording(true);
    } catch (e: any) {
      setError(e?.message ?? "Microphone error");
    }
  }

  async function stop(): Promise<Blob | null> {
    if (!isRecording || !recRef.current) return null;
    return new Promise((resolve) => {
      recRef.current!.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current!.mimeType });
        mediaRef.current?.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setIsRecording(false);
        resolve(blob);
      };
      recRef.current!.stop();
    });
  }

  useEffect(() => () => { mediaRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  return { supported, isRecording, start, stop, error } as const;
}

"use client";
import { useEffect, useRef, useState } from "react";

export function useMicCapture() {
  const [supported, setSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null); 
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    const windowWithMediaRecorder = window as Window & { MediaRecorder?: typeof MediaRecorder };
    setSupported(!!(navigator.mediaDevices && windowWithMediaRecorder.MediaRecorder));
  }, []);

  async function start() {
    if (!supported || isRecording) return;
    setError(null);
    try {
      mediaRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaRef.current); 

      const windowWithMediaRecorder = window as Window & {
        MediaRecorder?: typeof MediaRecorder & {
          isTypeSupported?: (type: string) => boolean
        }
      };
      const mime = windowWithMediaRecorder.MediaRecorder?.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      recRef.current = new MediaRecorder(mediaRef.current!, { mimeType: mime });
      chunksRef.current = [];
      recRef.current.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recRef.current.onstop = () => {
        mediaRef.current?.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setStream(null); 
      };
      recRef.current.start(150);
      setIsRecording(true);
    } catch (e) {
      const error = e as Error;
      setError(error?.message ?? "Microphone error");
    }
  }

  async function stop(): Promise<Blob | null> {
    if (!isRecording || !recRef.current) return null;
    return new Promise((resolve) => {
      recRef.current!.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recRef.current!.mimeType });
        mediaRef.current?.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setStream(null);
        setIsRecording(false);
        resolve(blob);
      };
      recRef.current!.stop();
    });
  }

  useEffect(() => () => { mediaRef.current?.getTracks().forEach((t) => t.stop()); }, []);
  return { supported, isRecording, start, stop, error, stream } as const;
}

"use client";
import { useEffect, useRef, useState } from "react";

type Cbs = { onPartial?: (t: string) => void; onFinal?: (t: string) => void };

export function useWebSpeechSTT(lang = "en-IN") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const cbsRef = useRef<Cbs>({});

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec: SpeechRecognition = new SR();
    rec.interimResults = true;
    rec.continuous = false;
    rec.lang = lang;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        (r.isFinal ? (final += r[0].transcript) : (interim += r[0].transcript));
      }
      if (interim) cbsRef.current.onPartial?.(interim);
      if (final)  cbsRef.current.onFinal?.(final.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  }, [lang]);

  const start = (cbs?: Cbs) => {
    if (!supported || listening) return;
    cbsRef.current = cbs || {};
    recRef.current?.start();
    setListening(true);
  };
  const stop = () => recRef.current?.stop();
  const cancel = () => { recRef.current?.abort(); setListening(false); };

  return { supported, listening, start, stop, cancel };
}

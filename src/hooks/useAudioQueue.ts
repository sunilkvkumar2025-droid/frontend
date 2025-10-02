// File: hooks/useAudioQueue.ts
// Single <audio> element with FIFO queue. Prevents overlapping TTS.

"use client";

import { useEffect, useRef, useState } from "react";


export function useAudioQueue() {
const audioRef = useRef<HTMLAudioElement | null>(null);
const [queue, setQueue] = useState<string[]>([]);

const enqueue = (url: string) => setQueue((q) => [...q, url]);
const clear = () => {
setQueue([]);
const a = audioRef.current;
if (a) {
    try {
        a.pause();
        a.currentTime = 0;
        a.src = "";
        } catch {}
        }
    };


useEffect(() => {
if (!audioRef.current) audioRef.current = new Audio();
const audio = audioRef.current;


if (!queue.length) return;
if (!audio.paused) return; // already playing something


const [next, ...rest] = queue;
const playNext = async () => {
audio.src = next;
try {
await audio.play();
} catch {
// autoplay policies may block until user interacts – we fail softly
}
};
const onEnded = () => setQueue(rest);
const onError = () => setQueue(rest);


audio.addEventListener("ended", onEnded);
audio.addEventListener("error", onError);


void playNext();


return () => {
audio.removeEventListener("ended", onEnded);
audio.removeEventListener("error", onError);
};
// We intentionally derive rest above to avoid infinite loops
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [queue.join("|")]);


return { enqueue, clear };
}
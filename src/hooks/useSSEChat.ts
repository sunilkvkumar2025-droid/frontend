// File: hooks/useSSEChat.ts 
// Public API defined
"use client";
import { useRef } from "react";
import { parseSSE } from "../lib/sse";
import { functionUrl, ssePost } from "../lib/api";

export type ChatEvent =
| { type: "token"; text: string }
| { type: "audio"; url: string; seq?: number }
| { type: "done"; messageId?: string };


export type SendChatArgs = {
    sessionId: string;
    text: string;
    userMessage?: string; // optional
    wantAudio: boolean;
    getAccessToken: () => Promise<string | null>;
};

function safeJson<T = unknown>(s: string): T | null {
    try {
    return JSON.parse(s) as T;
    } catch {
    return null;
    }
}


export function useSSEChat() {
    const abortRef = useRef<AbortController | null>(null);
    
    
    const send = async (
        { sessionId, text, wantAudio, userMessage, getAccessToken }: SendChatArgs,
        onEvent: (e: ChatEvent) => void
    ) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");
    
    
    // Ensure only one active stream
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const url = functionUrl("chat");
    
    const payload = { sessionId, userMessage: userMessage ?? text, wantAudio };
    console.log("[SSE] POST chat", payload);

    console.log("[SSE] url", url);
    console.log("[SSE] has token", !!token);
    console.log("[SSE] payload", payload);

    const res = await ssePost({
    url,
    token,
    body: payload,   
    signal: ctrl.signal,
    });

    if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }

    console.log("[SSE] status", res.status, res.statusText, res.headers.get("content-type"));

    const body = res.body;
    if (!body) throw new Error("Missing response body");

    let gotDone = false;
    for await (const { ev, data } of parseSSE(body)) {
    if (ctrl.signal.aborted) break;
    const parsed = safeJson<Record<string, unknown>>(data) ?? { text: data, url: data };
    if (ev === "token") {
    const t = typeof parsed.text === "string" ? parsed.text : String(parsed);
    onEvent({ type: "token", text: t });
    } else if (ev === "audio") {
    const u = typeof parsed.url === "string" ? parsed.url : String(parsed);
    const seq = typeof parsed.seq === "number" ? parsed.seq : undefined;
    onEvent({ type: "audio", url: u, seq });
    } else if (ev === "done") {
    gotDone = true;
    onEvent({ type: "done", messageId: parsed?.messageId });
    break;
    }
    }


    if (!ctrl.signal.aborted && !gotDone) {
    // Stream ended unexpectedly — fail soft by issuing a done.
    onEvent({ type: "done" });
    }
    };


    const abort = () => {
    abortRef.current?.abort();
    };


    return { send, abort };
    }
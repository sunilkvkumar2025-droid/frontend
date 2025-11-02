  "use client";

  import { useRef } from "react";
  import { parseSSE } from "../lib/sse";
  import { functionUrl, ssePost } from "../lib/api";

  export type ChatEvent =
    | { type: "token"; text: string }
    | { type: "audio"; url: string; seq?: number; context?: string }
    | { type: "audio_chunk"; chunk: string; seq: number; context?: string }
    | { type: "audio_done"; seq?: number; context?: string }
    | { type: "audio_error"; message: string; context?: string }
    | { type: "speak_ready"; text: string; context?: string }
    | { type: "done"; messageId?: string; fullText?: string }
    | { type: "debug"; event: string; payload: unknown };

  export type SendChatArgs = {
    sessionId: string;
    text: string;
    userMessage?: string;
    wantAudio: boolean;
    getAccessToken: () => Promise<string | null>;
    ttsStrategy?: string;
  };

  function safeJson<T = unknown>(raw: string): T | null {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  export function useSSEChat() {
    const abortRef = useRef<AbortController | null>(null);

    const send = async (
      { sessionId, text, wantAudio, userMessage, getAccessToken, ttsStrategy }: SendChatArgs,
      onEvent: (event: ChatEvent) => void
    ) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not authenticated");

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const url = functionUrl("chat");
      const payload = {
        sessionId,
        userMessage: userMessage ?? text,
        wantAudio,
        ...(ttsStrategy ? { ttsStrategy } : {}),
      };

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

      const body = res.body;
      if (!body) throw new Error("Missing response body");

      let gotDone = false;

      for await (const { ev, data } of parseSSE(body)) {
        if (ctrl.signal.aborted) break;

        const parsed =
          safeJson<{
            text?: string;
            url?: string;
            chunk?: string;
            seq?: number;
            context?: string;
            messageId?: string;
            fullText?: string;
            message?: string;
          }>(data) ?? { text: data, url: data };

        switch (ev) {
          case "token": {
            const textPayload =
              typeof parsed.text === "string" ? parsed.text : String(data ?? "");
            onEvent({ type: "token", text: textPayload });
            break;
          }

          case "audio": {
            const urlPayload =
              typeof parsed.url === "string" ? parsed.url : String(data ?? "");
            onEvent({
              type: "audio",
              url: urlPayload,
              seq: typeof parsed.seq === "number" ? parsed.seq : undefined,
              context: parsed.context,
            });
            break;
          }

          case "audio_chunk": {
            if (typeof parsed.chunk === "string" && typeof parsed.seq === "number") {
              onEvent({
                type: "audio_chunk",
                chunk: parsed.chunk,
                seq: parsed.seq,
                context: parsed.context,
              });
            }
            break;
          }

          case "audio_done": {
            onEvent({
              type: "audio_done",
              seq: typeof parsed.seq === "number" ? parsed.seq : undefined,
              context: parsed.context,
            });
            break;
          }

          case "audio_error": {
            const messagePayload =
              typeof parsed.message === "string"
                ? parsed.message
                : typeof data === "string"
                ? data
                : "Unknown audio error";
            onEvent({
              type: "audio_error",
              message: messagePayload,
              context: parsed.context,
            });
            break;
          }

          case "speak_ready": {
            if (typeof parsed.text === "string") {
              onEvent({
                type: "speak_ready",
                text: parsed.text,
                context: parsed.context,
              });
            }
            break;
          }

          case "done": {
            gotDone = true;
            onEvent({
              type: "done",
              messageId:
                typeof parsed.messageId === "string" ? parsed.messageId : undefined,
              fullText:
                typeof parsed.fullText === "string" ? parsed.fullText : undefined,
            });
            break;
          }

          default: {
            onEvent({ type: "debug", event: ev, payload: parsed });
            break;
          }
        }

        if (gotDone) break;
      }

      if (!ctrl.signal.aborted && !gotDone) {
        onEvent({ type: "done" });
      }
    };

    const abort = () => {
      abortRef.current?.abort();
    };

    return { send, abort };
  }
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
    | {
        type: "audio_text";
        provider?: string;
        text: string;
        model?: string | null;
        voice?: string | null;
        language?: string | null;
        sampleRate?: number | null;
        wsBase?: string | null;
        apiVersion?: string | null;
        context?: string;
      }
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
    ttsModel?: string;
  };

  function safeJson(raw: string) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  export function useSSEChat() {
    const abortRef = useRef<AbortController | null>(null);

    const send = async (
      { sessionId, text, wantAudio, userMessage, getAccessToken, ttsStrategy, ttsModel }: SendChatArgs,
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
        ...(ttsModel ? { ttsModel } : {}),
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

        const parsed = safeJson(data);
        const parsedObj =
          parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
        const parsedStr = typeof parsed === "string" ? parsed : undefined;

        switch (ev) {
          case "token": {
            const textPayload =
              parsedStr ??
              (typeof parsedObj?.text === "string" ? parsedObj.text : undefined) ??
              (typeof data === "string" ? (() => {
                try {
                  return JSON.parse(data);
                } catch {
                  return data;
                }
              })() : String(data ?? ""));
            onEvent({ type: "token", text: textPayload });
            break;
          }

          case "audio": {
            const urlPayload =
              (typeof parsedObj?.url === "string" ? parsedObj.url : undefined) ??
              (typeof parsedStr === "string" ? parsedStr : undefined) ??
              (typeof data === "string" ? data : String(data ?? ""));
            onEvent({
              type: "audio",
              url: urlPayload,
              seq: typeof parsedObj?.seq === "number" ? parsedObj.seq : undefined,
              context: typeof parsedObj?.context === "string" ? parsedObj.context : undefined,
            });
            break;
          }

          case "audio_chunk": {
            if (
              typeof parsedObj?.chunk === "string" &&
              typeof parsedObj?.seq === "number"
            ) {
              onEvent({
                type: "audio_chunk",
                chunk: parsedObj.chunk,
                seq: parsedObj.seq,
                context: typeof parsedObj.context === "string" ? parsedObj.context : undefined,
              });
            }
            break;
          }

          case "audio_done": {
            onEvent({
              type: "audio_done",
              seq: typeof parsedObj?.seq === "number" ? parsedObj.seq : undefined,
              context: typeof parsedObj?.context === "string" ? parsedObj.context : undefined,
            });
            break;
          }

          case "audio_error": {
            const messagePayload =
              (typeof parsedObj?.message === "string" ? parsedObj.message : undefined) ??
              parsedStr ??
              (typeof data === "string" ? data : "Unknown audio error");
            onEvent({
              type: "audio_error",
              message: messagePayload,
              context: typeof parsedObj?.context === "string" ? parsedObj.context : undefined,
            });
            break;
          }

          case "audio_text": {
            const textPayload =
              (typeof parsedObj?.text === "string" ? parsedObj.text : undefined) ??
              parsedStr ??
              "";
            onEvent({
              type: "audio_text",
              provider: typeof parsedObj?.provider === "string" ? parsedObj.provider : undefined,
              text: textPayload,
              model: typeof parsedObj?.model === "string" ? parsedObj.model : undefined,
              voice: typeof parsedObj?.voice === "string" ? parsedObj.voice : undefined,
              language: typeof parsedObj?.language === "string" ? parsedObj.language : undefined,
              sampleRate:
                typeof parsedObj?.sampleRate === "number" ? parsedObj.sampleRate : undefined,
              wsBase: typeof parsedObj?.wsBase === "string" ? parsedObj.wsBase : undefined,
              apiVersion:
                typeof parsedObj?.apiVersion === "string" ? parsedObj.apiVersion : undefined,
              context: typeof parsedObj?.context === "string" ? parsedObj.context : undefined,
            });
            break;
          }

          case "speak_ready": {
            const textPayload =
              parsedStr ??
              (typeof parsedObj?.text === "string" ? parsedObj.text : undefined);
            if (textPayload) {
              onEvent({
                type: "speak_ready",
                text: textPayload,
                context: typeof parsedObj?.context === "string" ? parsedObj.context : undefined,
              });
            }
            break;
          }

          case "done": {
            gotDone = true;
            onEvent({
              type: "done",
              messageId:
                typeof parsedObj?.messageId === "string" ? parsedObj.messageId : undefined,
              fullText:
                typeof parsedObj?.fullText === "string"
                  ? parsedObj.fullText
                  : parsedStr,
            });
            break;
          }

          default: {
            onEvent({ type: "debug", event: ev, payload: parsed ?? data });
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

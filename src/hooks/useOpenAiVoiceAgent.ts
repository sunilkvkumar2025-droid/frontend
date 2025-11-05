 "use client";

  import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
  import { functionUrl } from "../lib/api";

  type Message = { role: "user" | "assistant"; content: string };

  type VoiceEvent =
    | { type: "token"; text: string }
    | { type: "done"; meta?: unknown }
    | { type: "error"; message: string };

  type ConnectArgs = {
    getAccessToken: () => Promise<string | null>;
    voice?: string | null;
  };

  type SendArgs = {
    messages: Message[];
    onEvent: (event: VoiceEvent) => void;
  };

  export function useOpenAiVoiceAgent(
    audioRef: MutableRefObject<HTMLAudioElement | null>,
    resumeAudio: () => void
  ) {
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const onEventRef = useRef<(event: VoiceEvent) => void>(() => {});
    const responseIdRef = useRef<string | null>(null);
    const [ready, setReady] = useState(false);

    const reset = useCallback(() => {
      dataChannelRef.current?.close();
      peerRef.current?.close();
      dataChannelRef.current = null;
      peerRef.current = null;
      responseIdRef.current = null;
      setReady(false);
    }, []);

    const connect = useCallback(
      async ({ getAccessToken, voice }: ConnectArgs) => {
        if (peerRef.current) return;
        const token = await getAccessToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(functionUrl("realtime-token"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ voice, includeAudio: true }),
        });
        if (!res.ok) {
          const err = await res.text().catch(() => "");
          throw new Error(`Realtime token error ${res.status}: ${err}`);
        }

        const session = await res.json();
        const clientSecret: string | undefined = session?.client_secret;
        const model: string = session?.model;
        if (!clientSecret) throw new Error("Missing realtime client secret");

        const pc = new RTCPeerConnection();
        peerRef.current = pc;

        pc.addTransceiver("audio", { direction: "recvonly" });
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            reset();
          }
        };

        pc.ontrack = (event) => {
          const audioEl = audioRef.current;
          if (!audioEl) return;
          audioEl.srcObject = event.streams[0];
          resumeAudio();
          audioEl.play().catch(() => {});
        };

        const dc = pc.createDataChannel("oai-events");
        dataChannelRef.current = dc;

        dc.onopen = () => setReady(true);
        dc.onclose = reset;
        dc.onerror = (err) => {
          onEventRef.current({ type: "error", message: String(err) });
          reset();
        };
        dc.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            handleRealtimeMessage(payload);
          } catch {
            /* ignore non-json */
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const resp = await fetch(
          `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${clientSecret}`,
              "Content-Type": "application/sdp",
            },
            body: offer.sdp,
          }
        );
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error(`OpenAI handshake failed: ${resp.status} ${errText}`);
        }

        const answer = await resp.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      },
      [audioRef, resumeAudio, reset]
    );

    const handleRealtimeMessage = (msg: any) => {
      if (!msg) return;

      if (msg.type === "response.created") {
        responseIdRef.current = msg.response?.id ?? null;
        return;
      }

      if (msg.type === "response.completed") {
        onEventRef.current({ type: "done", meta: msg });
        responseIdRef.current = null;
        return;
      }

      if (msg.type === "response.error") {
        onEventRef.current({
          type: "error",
          message: msg.error?.message ?? "OpenAI voice error",
        });
        return;
      }

      if (msg.type === "response.output_text.delta" && typeof msg.delta === "string") {
        onEventRef.current({ type: "token", text: msg.delta });
        return;
      }

      if (Array.isArray(msg.delta?.outputs)) {
        for (const output of msg.delta.outputs) {
          if (!Array.isArray(output?.content)) continue;
          for (const block of output.content) {
            if (block?.type === "output_text.delta" && typeof block.text === "string") {
              onEventRef.current({ type: "token", text: block.text });
            }
          }
        }
      }
    };

    const send = useCallback(
      ({ messages, onEvent }: SendArgs) => {
        const dc = dataChannelRef.current;
        if (!dc || dc.readyState !== "open") {
          throw new Error("OpenAI voice session not ready");
        }
        onEventRef.current = onEvent;

        const payload = {
          type: "response.create",
          response: {
            modalities: ["text", "audio"],
            conversation: {
              messages: messages.map((m) => ({
                role: m.role,
                content: [{ type: "input_text", text: m.content }],
              })),
            },
          },
        };

        dc.send(JSON.stringify(payload));
      },
      []
    );

    const cancel = useCallback(() => {
      const dc = dataChannelRef.current;
      if (!dc || dc.readyState !== "open") return;

      if (responseIdRef.current) {
        dc.send(
          JSON.stringify({
            type: "response.cancel",
            response_id: responseIdRef.current,
          })
        );
      } else {
        dc.send(JSON.stringify({ type: "response.cancel_all" }));
      }
      responseIdRef.current = null;
    }, []);

    const disconnect = useCallback(() => {
      cancel();
      reset();
      const audioEl = audioRef.current;
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.removeAttribute("src");
        audioEl.load();
      }
    }, [cancel, reset, audioRef]);

    useEffect(() => disconnect, [disconnect]);

    return {
      connect,
      send,
      cancel,
      disconnect,
      ready,
    };
  }

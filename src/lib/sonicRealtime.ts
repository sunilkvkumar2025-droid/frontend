export type SonicRealtimeOptions = {
  voiceId?: string | null;
  language?: string | null;
  modelId?: string | null;
  sampleRate?: number | null;
  wsBase?: string | null;
  apiVersion?: string | null;
  contextId?: string | null;
  signal?: AbortSignal;
  onChunk?: (chunkB64: string, seq: number, contextId: string) => void;
  onDone?: (contextId: string) => void;
};

const CARTESIA_WS_BASE =
  process.env.NEXT_PUBLIC_CARTESIA_WS_BASE ?? "wss://api.cartesia.ai/tts/websocket";
const CARTESIA_VERSION = process.env.NEXT_PUBLIC_CARTESIA_VERSION ?? "2025-04-16";
const CARTESIA_API_KEY = process.env.NEXT_PUBLIC_CARTESIA_API_KEY ?? "";
const DEFAULT_VOICE_ID = process.env.NEXT_PUBLIC_CARTESIA_VOICE_ID ?? "";
const DEFAULT_LANGUAGE = process.env.NEXT_PUBLIC_CARTESIA_LANGUAGE ?? "en";
const DEFAULT_SAMPLE_RATE = Number(process.env.NEXT_PUBLIC_CARTESIA_SAMPLE_RATE ?? "24000");
const DEFAULT_MODEL_ID = process.env.NEXT_PUBLIC_CARTESIA_MODEL_ID ?? "sonic-3";

export async function fetchCartesiaSonicAudio(
  text: string,
  opts: SonicRealtimeOptions = {}
): Promise<string> {
  if (!text?.trim()) throw new Error("Cartesia Sonic requires text input");
  if (!CARTESIA_API_KEY) throw new Error("Missing NEXT_PUBLIC_CARTESIA_API_KEY");

  const voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
  if (!voiceId) throw new Error("Missing NEXT_PUBLIC_CARTESIA_VOICE_ID");

  const modelId = opts.modelId ?? DEFAULT_MODEL_ID;
  const language = opts.language ?? DEFAULT_LANGUAGE;
  const sampleRate = opts.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const wsBase = opts.wsBase ?? CARTESIA_WS_BASE;
  const apiVersion = opts.apiVersion ?? CARTESIA_VERSION;

  const wsUrl = new URL(wsBase);
  wsUrl.searchParams.set("api_key", CARTESIA_API_KEY);
  wsUrl.searchParams.set("cartesia_version", apiVersion);

  const rawContext = opts.contextId ?? `ctx_${crypto.randomUUID()}`;
  const contextId = rawContext.replace(/[^a-zA-Z0-9_-]/g, "");

  const ws = new WebSocket(wsUrl.toString());
  ws.binaryType = "arraybuffer";

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let chunkSeq = 0;
    let settled = false;

    const cleanup = () => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      opts.signal?.removeEventListener("abort", onAbort);
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!chunks.length) {
        reject(new Error("Cartesia Sonic returned no audio"));
        return;
      }
      const audio = concatChunks(chunks);
      const wavBytes = pcm16ToWav(audio, sampleRate, 1);
      opts.onDone?.(contextId);
      resolve(`data:audio/wav;base64,${bytesToBase64(wavBytes)}`);
    };

    const onAbort = () => fail(new DOMException("Aborted", "AbortError"));
    if (opts.signal) {
      if (opts.signal.aborted) return onAbort();
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    ws.onopen = () => {
      const payload = {
        model_id: modelId,
        transcript: text,
        voice: { mode: "id", id: voiceId },
        language,
        context_id: contextId,
        output_format: {
          container: "raw",
          encoding: "pcm_s16le",
          sample_rate: sampleRate,
          channels: 1,
        },
        add_timestamps: false,
        continue: false,
      };
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        fail(err);
      }
    };

    ws.onmessage = (event) => {
      if (settled) return;
      if (typeof event.data === "string") {
        try {
          const payload = JSON.parse(event.data);
          switch (payload?.type) {
            case "chunk":
              if (typeof payload.data === "string") {
                const pcm = decodeBase64(payload.data);
                chunks.push(pcm);
                if (opts.onChunk) {
                  const wav = pcm16ToWav(pcm, sampleRate, 1);
                  opts.onChunk(bytesToBase64(wav), chunkSeq++, contextId);
                }
              }
              break;
            case "done":
              succeed();
              break;
            case "error":
              fail(new Error(String(payload?.error ?? "Cartesia Sonic error")));
              break;
            default:
              break;
          }
        } catch (err) {
          fail(err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        const pcm = new Uint8Array(event.data);
        chunks.push(pcm);
        if (opts.onChunk) {
          const wav = pcm16ToWav(pcm, sampleRate, 1);
          opts.onChunk(bytesToBase64(wav), chunkSeq++, contextId);
        }
      }
    };

    ws.onerror = (evt) => fail(new Error(`Cartesia Sonic websocket error: ${JSON.stringify(evt)}`));
    ws.onclose = () => {
      if (!settled) fail(new Error("Cartesia Sonic connection closed"));
    };
  });
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + pcm.length, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, pcm.length, true);
  offset += 4;
  new Uint8Array(buffer, offset).set(pcm);
  return new Uint8Array(buffer);
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

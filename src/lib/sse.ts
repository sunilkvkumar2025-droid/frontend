// File: lib/sse.ts
// Tolerant SSE line parser for fetch streaming. Emits { ev, data }.

export type ParsedSSE = { ev: string; data: string };


export async function* parseSSE(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
  
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
  
        let ev = "message";
        let data = "";
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) ev = line.slice(6).trim();
          else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
        }
        yield { ev, data };
      }
    }
  }
  
export type CompressOptions = {
  targetMime?: string;
  audioBitsPerSecond?: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function maybeCompressWavDataUrl(
  dataUrl: string,
  { targetMime = "audio/webm;codecs=opus", audioBitsPerSecond = 24000 }: CompressOptions = {},
): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  if (!dataUrl.startsWith("data:audio/wav")) return dataUrl;
  if (typeof MediaRecorder === "undefined") return dataUrl;
  if (!MediaRecorder.isTypeSupported(targetMime)) return dataUrl;

  try {
    const response = await fetch(dataUrl);
    const wavBuffer = await response.arrayBuffer();

    const audioContext = new AudioContext();
    await audioContext.resume().catch(() => {});
    const decoded = await audioContext.decodeAudioData(wavBuffer.slice(0));

    const streamDestination = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(streamDestination);

    const recorder = new MediaRecorder(streamDestination.stream, {
      mimeType: targetMime,
      audioBitsPerSecond,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const recordingFinished = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: targetMime }));
      recorder.onerror = (event) => reject(event.error ?? new Error("MediaRecorder error"));
    });

    recorder.start();
    source.start();

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });

    recorder.stop();

    const blob = await recordingFinished;
    await audioContext.close().catch(() => {});

    const compressedBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(compressedBuffer);
    return `data:${blob.type};base64,${base64}`;
  } catch (error) {
    console.error("[audioTranscode] Compression failed, falling back to WAV", error);
    return dataUrl;
  }
}

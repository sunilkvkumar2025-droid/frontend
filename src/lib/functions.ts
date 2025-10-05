// src/lib/functions.ts
import { supabase } from "./supabase";

const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

async function getFreshToken(): Promise<string> {
  // 1) current token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  return session.access_token;
}

async function postOnce(name: string, token: string, payload?: unknown, signal?: AbortSignal) {
  const url = `${base}/functions/v1/${name}`;
  return fetch(url, {
    method: "POST",
    // IMPORTANT: do not set Content-Type; lets our edge functions skip preflight
    headers: { authorization: `Bearer ${token}` },
    body: payload ? JSON.stringify(payload) : undefined,
    signal,
  });
}

export async function callFunction<T = unknown>(
  name: string,
  payload?: unknown,
  signal?: AbortSignal
): Promise<T> {
  // First attempt
  let token = await getFreshToken();
  let res = await postOnce(name, token, payload, signal);

  // Retry once on 401 with a refreshed session
  if (res.status === 401) {
    await supabase.auth.refreshSession();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Session expired. Please sign in again.");
    token = session.access_token;
    res = await postOnce(name, token, payload, signal);
  }

  // Handle non-OK
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: Record<string, unknown> | null = null;
    try { parsed = text ? JSON.parse(text) as Record<string, unknown> : null; } catch {
      // Ignore parse errors
    }
    const msg = (parsed?.error as string) || (parsed?.message as string) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // chat returns an SSE stream; for your test page we return the raw text
  if (name === "chat") {
    const sseText = await res.text();
    return sseText as unknown as T;
  }

  // All other functions: parse JSON
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : null) as T;
  } catch {
    // In case a function ever returns plain text
    return text as unknown as T;
  }
}

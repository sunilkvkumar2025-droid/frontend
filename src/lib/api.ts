// File: lib/api.ts
// Shared helpers to talk to Supabase Edge Functions via fetch streaming

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";


export function functionUrl(name: string) {
if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
return `${SUPABASE_URL}/functions/v1/${name}`;
}

export async function ssePost({
    url,
    token,
    body,
    signal,
    }: {
    url: string;
    token: string;
    body: unknown;
    signal?: AbortSignal;
    }): Promise<Response> {
    return fetch(url, {
    method: "POST",
    headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
    },
    body: JSON.stringify(body ?? {}),
    signal,
    });
    }



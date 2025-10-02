// File: components/chat/MessageList.tsx
// Renders a simple, readable message list with basic roles

"use client";
import type { Message } from "./ChatWindow";

export default function MessageList({
    messages,
    isStreaming,
    }: {
    messages: Message[];
    isStreaming: boolean;
}) {
return (
    <div className="flex-1 min-h-[60vh] border rounded-2xl p-3 bg-neutral-950/30 overflow-y-auto space-y-3">
     {messages.map((m) => (
        <div key={m.id} className="flex">
    <div
      className={
        m.role === "user"
        ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600/20 border border-blue-400/30 px-3 py-2"
        : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-zinc-700/30 border border-zinc-600/50 px-3 py-2"
    }
    >
        <div className="text-xs opacity-70 mb-1">
        {m.role === "user" ? "You" : m.role === "assistant" ? "Coco" : "System"}
        </div>
        <div className="whitespace-pre-wrap text-sm leading-6">{m.text}</div>
    </div>
</div>
    ))}
    {isStreaming ? (
    <div className="mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-zinc-700/30 border border-zinc-600/50 px-3 py-2 animate-pulse">
    <div className="text-xs opacity-70 mb-1">Coco</div>
    <div className="h-5 w-16 bg-zinc-500/40 rounded" />
    </div>
    ) : null}
    </div>
);
}
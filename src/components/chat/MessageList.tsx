// File: components/chat/MessageList.tsx
// Renders a simple, readable message list with basic roles

"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Message } from "./ChatWindow";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const ReportErrorButton = ({
  message
}: {
  message: Message
}) => {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleReport = async () => {
    // Step 1: Ask user what they actually said
    const actualText = prompt(
      `The app heard: "${message.text}"\n\n` +
      `What did you actually say?\n\n` +
      `(Or click Cancel if the transcription was correct)`
    );

    if (!actualText) return; // User cancelled

    if (actualText.trim().toLowerCase() === message.text.trim().toLowerCase()) {
      alert("Transcription was correct - no error to report!");
      return;
    }

    // Step 2: Ask for error type
    const errorType = prompt(
      `How was it wrong?\n\n` +
      `1 = Completely wrong (gibberish)\n` +
      `2 = Missing words\n` +
      `3 = Extra words\n` +
      `4 = Wrong language detected\n` +
      `5 = Other\n\n` +
      `Enter number (1-5):`
    );

    const errorTypeMap: { [key: string]: string } = {
      "1": "completely_wrong",
      "2": "missing_words",
      "3": "extra_words",
      "4": "wrong_language",
      "5": "other"
    };

    const selectedErrorType = errorTypeMap[errorType || "5"] || "other";

    setReporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Not authenticated - please log in");
        return;
      }

      if (!message.message_db_id) {
        alert("Cannot report - message not saved to database");
        console.error("Missing message_db_id:", message);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/report-stt-error`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message_id: message.message_db_id,
            transcribed_text: message.text,
            correction_text: actualText.trim(),
            error_type: selectedErrorType,
            notes: `Method: ${message.stt_metadata?.method || 'unknown'}`
          }),
        }
      );

      if (response.ok) {
        setReported(true);
        alert("✅ Thank you for reporting! This helps us improve transcription accuracy.");
      } else {
        const error = await response.json();
        alert(`❌ Error reporting: ${error.error || 'Unknown error'}`);
        console.error("Report error response:", error);
      }
    } catch (error: any) {
      alert(`❌ Failed to report: ${error.message}`);
      console.error("Report error exception:", error);
    } finally {
      setReporting(false);
    }
  };

  if (reported) {
    return (
      <span className="text-xs text-green-400/70" title="Error reported">
        ✓ Reported
      </span>
    );
  }

  return (
    <button
      onClick={handleReport}
      disabled={reporting}
      className="text-xs text-red-400/70 hover:text-red-400 underline transition-colors"
      title="Click if the transcription is wrong"
    >
      {reporting ? "Reporting..." : "Wrong transcription?"}
    </button>
  );
};

export default function MessageList({
    messages,
    isStreaming,
    }: {
    messages: Message[];
    isStreaming: boolean;
}) {
return (
    <div className="flex-1 min-h-[60vh]  rounded-2xl p-3 bg-neutral-950/30 overflow-y-auto space-y-3">
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
        <div className="space-y-2">
          {/* Correction appears FIRST (at top) */}
          {m.correction && (
            <div className="p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm">
              <span className="font-semibold text-yellow-800">सुधार:</span>{" "}
              <span className="text-yellow-900">{m.correction}</span>
            </div>
          )}

          {/* Main message text appears AFTER (below) */}
          <div className="whitespace-pre-wrap text-sm leading-6">{m.text}</div>

     
        </div>
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

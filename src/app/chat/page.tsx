// File: app/chat/page.tsx
// Next.js (App Router) page wrapper

export const dynamic = "force-dynamic";
export const metadata = {
    title: "Chat | CaseBuddy",
    };
    
    
    import ChatWindow from "../../components/chat/ChatWindow";
    
    
    export default function ChatPage() {
    return (
    <div className="min-h-[80vh] w-full mx-auto max-w-3xl px-4 py-6">
    <ChatWindow />
    </div>
    );
    }
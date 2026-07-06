import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChatThread } from "@/components/bloomy/ChatThread";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat — Forge" }] }),
  component: ChatPage,
});

function ChatPage() {
  const [id] = useState(() => Date.now().toString());
  return <ChatThread key={id} id={id} />;
}

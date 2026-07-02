import { createFileRoute } from "@tanstack/react-router";
import { ChatThread } from "@/components/bloomy/ChatThread";

/**
 * Chat route: render ChatThread directly with a generated ID.
 * The conversation will be created lazily when the user sends the first message.
 */
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat \u2014 Forge" }] }),
  component: ChatRoute,
});

function ChatRoute() {
  // Generate a unique ID for this session
  const id = Date.now().toString();
  return <ChatThread id={id} />;
}


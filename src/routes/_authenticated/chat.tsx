import { createFileRoute } from "@tanstack/react-router";
import { ChatThread } from "@/components/bloomy/ChatThread";

/**
 * Chat route: render ChatThread with a generated ID.
 * Conversation is created lazily on first message.
 */
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat \u2014 Forge" }] }),
  component: ChatRoute,
});

function ChatRoute() {
  // Use search param 't' if present (for + button), otherwise generate new ID
  const search = Route.useSearch();
  const id = (search.t || Date.now().toString()) as string;
  return <ChatThread key={id} id={id} />;
}


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
  // Use the search param 't' as a key to force remount when clicking +
  const search = Route.useSearch();
  const id = (search.t || Date.now().toString()) as string;
  return <ChatThread key={id} id={id} />;
}


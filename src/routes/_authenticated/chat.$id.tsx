import { createFileRoute } from "@tanstack/react-router";
import { ChatThread } from "@/components/bloomy/ChatThread";

export const Route = createFileRoute("/_authenticated/chat/$id")({
  head: () => ({ meta: [{ title: "Chat — Forge" }] }),
  component: ChatRoute,
});

function ChatRoute() {
  const { id } = Route.useParams();
  return <ChatThread key={id} id={id} />;
}

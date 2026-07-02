import { createFileRoute } from "@tanstack/react-router";
import { ChatThread } from "@/components/bloomy/ChatThread";

/**
 * Chat route: create a new conversation immediately and navigate to it.
 * This ensures we have a proper UUID from the database from the start.
 */
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat \u2014 Forge" }] }),
  component: ChatRoute,
});

function ChatRoute() {
  const navigate = Route.useNavigate();

  // Create a new conversation immediately on mount
  async function createNewConversation() {
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat", model: "claude-sonnet-4-6" }),
      });
      const data = await response.json();
      if (data.id) {
        // Navigate to the new conversation with its proper UUID
        navigate({ to: "/chat/$id", params: { id: data.id }, replace: true });
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
    }
  }

  // Trigger creation on mount
  createNewConversation();

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
      <div className="text-text-muted">Creating new chat...</div>
    </div>
  );
}


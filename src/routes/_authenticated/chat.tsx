import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Chat route: redirect to a new conversation ID without API call.
 * The conversation will be created lazily when the user sends the first message.
 * This matches the reference implementation pattern.
 */
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat \u2014 Forge" }] }),
  component: ChatRedirect,
});

function ChatRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    console.log("[ChatRedirect] Redirecting to new conversation");
    // Generate a unique ID and redirect immediately
    const newConversationId = Date.now().toString();
    console.log("[ChatRedirect] Generated ID:", newConversationId);
    navigate({ to: "/chat/$id", params: { id: newConversationId }, replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-text-muted mx-auto mb-4" />
        <p className="text-sm text-text-muted">Loading chat...</p>
      </div>
    </div>
  );
}


import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Claude-like chat route: when user visits /chat, automatically create a new
 * persisted conversation and redirect to /chat/$id. This ensures every chat
 * has a persistent ID from the start, making it easier to save and manage.
 */
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat \u2014 Forge" }] }),
  component: ChatRedirect,
});

function ChatRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    async function create() {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers,
        body: JSON.stringify({ title: "New chat" }),
      });
      if (!res.ok) {
        toast.error("Failed to create chat");
        return;
      }
      const chat = await res.json();
      navigate({ to: "/chat/$id", params: { id: chat.id }, replace: true });
    }
    create();
  }, [navigate]);
  return null;
}


import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";

export const Route = createFileRoute("/api/conversations/$id/messages")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const { data, error } = await auth.supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", params.id)
          .order("created_at", { ascending: true });

        if (error) {
          return Response.json({ message: error.message }, { status: 500 });
        }

        return Response.json(data ?? []);
      },

      POST: async ({ request, params }) => {
        console.log("[API] POST /api/conversations/$id/messages");
        const auth = await getAuthContext(request);
        if (!auth.ok) {
          console.error("[API] Auth failed");
          return auth.response;
        }

        const body = await request.json().catch(() => ({}));
        const { role, content } = body as { role?: string; content?: string };

        if (!role || !content) {
          return Response.json({ message: "role and content are required" }, { status: 400 });
        }

        if (!["user", "assistant", "system"].includes(role)) {
          return Response.json({ message: "role must be user, assistant, or system" }, { status: 400 });
        }

        const { data, error } = await auth.supabase
          .from("messages")
          .insert({
            conversation_id: params.id,
            user_id: auth.userId,
            role,
            content,
          })
          .select("id, role, content, created_at")
          .single();

        if (error) {
          console.error("[API] Database error:", error);
          return Response.json({ message: error.message }, { status: 500 });
        }

        console.log("[API] Created message:", data.id);
        return Response.json(data, { status: 201 });
      },
    },
  },
});

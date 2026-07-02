import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const { data, error } = await auth.supabase
          .from("conversations")
          .select("id, title, created_at, updated_at, model")
          .eq("user_id", auth.userId)
          .order("updated_at", { ascending: false });

        if (error) {
          return Response.json({ message: error.message }, { status: 500 });
        }

        return Response.json(data ?? []);
      },

      POST: async ({ request }) => {
        console.log("[API] POST /api/conversations - Creating conversation");
        const auth = await getAuthContext(request);
        if (!auth.ok) {
          console.error("[API] Auth failed");
          return auth.response;
        }

        const body = await request.json().catch(() => ({}));
        const { title, model } = body as { title?: string; model?: string };
        console.log("[API] Creating conversation:", { title, model, userId: auth.userId });

        const { data, error } = await auth.supabase
          .from("conversations")
          .insert({
            user_id: auth.userId,
            title: title || "New chat",
            model: model || "claude-sonnet-4-6",
          })
          .select("id, title, created_at, updated_at, model")
          .single();

        if (error) {
          console.error("[API] Database error:", error);
          return Response.json({ message: error.message }, { status: 500 });
        }

        console.log("[API] Created conversation:", data);
        return Response.json(data, { status: 201 });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";

export const Route = createFileRoute("/api/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const { data, error } = await auth.supabase
          .from("conversations")
          .select("id, title, created_at, updated_at, model")
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .single();

        if (error) {
          const status = error.code === "PGRST116" ? 404 : 500;
          return Response.json({ message: error.message }, { status });
        }

        const { data: messages, error: msgError } = await auth.supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", params.id)
          .order("created_at", { ascending: true });

        if (msgError) {
          return Response.json({ message: msgError.message }, { status: 500 });
        }

        return Response.json({ ...data, messages: messages ?? [] });
      },

      PATCH: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const updates: { title?: string; model?: string } = {};
        if (typeof body.title === "string") updates.title = body.title;
        if (typeof body.model === "string") updates.model = body.model;

        if (Object.keys(updates).length === 0) {
          return Response.json({ message: "no fields to update" }, { status: 400 });
        }

        const { data, error } = await auth.supabase
          .from("conversations")
          .update(updates)
          .eq("id", params.id)
          .eq("user_id", auth.userId)
          .select("id, title, created_at, updated_at, model")
          .single();

        if (error) {
          return Response.json({ message: error.message }, { status: 500 });
        }

        return Response.json(data);
      },

      DELETE: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const { error } = await auth.supabase
          .from("conversations")
          .delete()
          .eq("id", params.id)
          .eq("user_id", auth.userId);

        if (error) {
          return Response.json({ message: error.message }, { status: 500 });
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});

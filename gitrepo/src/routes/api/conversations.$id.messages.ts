import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseContext } from "@supabase/server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/conversations/$id/messages")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const { data, error: dbError } = await ctx.supabase
          .from("messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", params.id)
          .order("created_at", { ascending: true });

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return Response.json(data ?? []);
      },

      POST: async ({ request, params }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const body = await request.json().catch(() => ({}));
        const { role, content } = body as { role?: string; content?: string };

        if (!role || !content) {
          return Response.json({ message: "role and content are required" }, { status: 400 });
        }

        if (!["user", "assistant", "system"].includes(role)) {
          return Response.json({ message: "role must be user, assistant, or system" }, { status: 400 });
        }

        const { data, error: dbError } = await ctx.supabase
          .from("messages")
          .insert({
            conversation_id: params.id,
            user_id: ctx.userClaims!.id,
            role,
            content,
          })
          .select("id, role, content, created_at")
          .single();

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return Response.json(data, { status: 201 });
      },
    },
  },
});

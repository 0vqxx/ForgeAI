import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseContext } from "@supabase/server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const { data, error: dbError } = await ctx.supabase
          .from("conversations")
          .select("id, title, created_at, updated_at, model")
          .order("updated_at", { ascending: false });

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return Response.json(data ?? []);
      },

      POST: async ({ request }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const body = await request.json().catch(() => ({}));
        const { title, model, id } = body as { title?: string; model?: string; id?: string };

        const insertData: any = {
          user_id: ctx.userClaims!.id,
          title: title || "New chat",
          model: model || "claude-sonnet-4-6",
        };

        // If an ID is provided, use it (for client-generated IDs)
        if (id) {
          insertData.id = id;
        }

        const { data, error: dbError } = await ctx.supabase
          .from("conversations")
          .insert(insertData)
          .select("id, title, created_at, updated_at, model")
          .single();

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return Response.json(data, { status: 201 });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createSupabaseContext } from "@supabase/server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const { data, error: dbError } = await ctx.supabase
          .from("conversations")
          .select("id, title, created_at, updated_at, model")
          .eq("id", params.id)
          .single();

        if (dbError) {
          const status = dbError.code === "PGRST116" ? 404 : 500;
          return Response.json({ message: dbError.message }, { status });
        }

        const { data: messages, error: msgError } = await ctx.supabase
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
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const body = await request.json().catch(() => ({}));
        const updates: { title?: string; model?: string } = {};
        if (typeof body.title === "string") updates.title = body.title;
        if (typeof body.model === "string") updates.model = body.model;

        if (Object.keys(updates).length === 0) {
          return Response.json({ message: "no fields to update" }, { status: 400 });
        }

        const { data, error: dbError } = await ctx.supabase
          .from("conversations")
          .update(updates)
          .eq("id", params.id)
          .select("id, title, created_at, updated_at, model")
          .single();

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return Response.json(data);
      },

      DELETE: async ({ request, params }) => {
        const { data: ctx, error } = await createSupabaseContext<Database>(request, { auth: "user" });
        if (error) {
          return Response.json({ message: error.message }, { status: error.status });
        }

        const { error: dbError } = await ctx.supabase
          .from("conversations")
          .delete()
          .eq("id", params.id);

        if (dbError) {
          return Response.json({ message: dbError.message }, { status: 500 });
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});

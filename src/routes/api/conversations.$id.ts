import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/conversations/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const conv = await sql`
          SELECT id, user_id, title, project_id, agent_id, model, created_at, updated_at
          FROM conversations
          WHERE id = ${params.id} AND user_id = ${auth.userId}
        `;
        if (conv.length === 0) {
          return Response.json({ message: "Not found" }, { status: 404 });
        }

        const messages = await sql`
          SELECT id, conversation_id, user_id, role, content, created_at
          FROM messages
          WHERE conversation_id = ${params.id}
          ORDER BY created_at ASC
        `;

        return Response.json({ ...conv[0], messages });
      },

      PATCH: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { title, model } = body as { title?: string; model?: string };

        if (typeof title !== "string" && typeof model !== "string") {
          return Response.json({ message: "no fields to update" }, { status: 400 });
        }

        const rows = await sql`
          UPDATE conversations
          SET ${title !== undefined ? sql`title = ${title}` : sql``}
              ${title !== undefined && model !== undefined ? sql`, ` : sql``}
              ${model !== undefined ? sql`model = ${model}` : sql``},
              updated_at = now()
          WHERE id = ${params.id} AND user_id = ${auth.userId}
          RETURNING id, user_id, title, project_id, agent_id, model, created_at, updated_at
        `;

        if (rows.length === 0) {
          return Response.json({ message: "Not found or no permission" }, { status: 404 });
        }
        return Response.json(rows[0]);
      },

      DELETE: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const result = await sql`
          DELETE FROM conversations WHERE id = ${params.id} AND user_id = ${auth.userId}
        `;
        if (result.count === 0) {
          return Response.json({ message: "Not found or no permission" }, { status: 404 });
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});

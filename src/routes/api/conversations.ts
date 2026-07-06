import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const rows = await sql`
          SELECT id, user_id, title, project_id, agent_id, model, created_at, updated_at
          FROM conversations
          WHERE user_id = ${auth.userId}
          ORDER BY updated_at DESC
        `;
        return Response.json(rows);
      },

      POST: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { title, model, id } = body as { title?: string; model?: string; id?: string };

        const rows = id
          ? await sql`
              INSERT INTO conversations (id, user_id, title, model)
              VALUES (${id}, ${auth.userId}, ${title || "New chat"}, ${model || "claude-sonnet-4-6"})
              RETURNING id, user_id, title, project_id, agent_id, model, created_at, updated_at
            `
          : await sql`
              INSERT INTO conversations (user_id, title, model)
              VALUES (${auth.userId}, ${title || "New chat"}, ${model || "claude-sonnet-4-6"})
              RETURNING id, user_id, title, project_id, agent_id, model, created_at, updated_at
            `;
        return Response.json(rows[0], { status: 201 });
      },
    },
  },
});

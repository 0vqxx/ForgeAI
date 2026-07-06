import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/conversations/$id/messages")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const rows = await sql`
          SELECT id, conversation_id, user_id, role, content, created_at
          FROM messages
          WHERE conversation_id = ${params.id} AND user_id = ${auth.userId}
          ORDER BY created_at ASC
        `;
        return Response.json(rows);
      },

      POST: async ({ request, params }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { role, content } = body as { role?: string; content?: string };

        if (!role || !content) {
          return Response.json({ message: "role and content are required" }, { status: 400 });
        }
        if (!["user", "assistant", "system"].includes(role)) {
          return Response.json({ message: "role must be user, assistant, or system" }, { status: 400 });
        }

        const convs = await sql`
          SELECT id FROM conversations WHERE id = ${params.id} AND user_id = ${auth.userId}
        `;
        if (convs.length === 0) {
          return Response.json({ message: "Conversation not found" }, { status: 404 });
        }

        const rows = await sql`
          INSERT INTO messages (conversation_id, user_id, role, content)
          VALUES (${params.id}, ${auth.userId}, ${role}, ${content})
          RETURNING id, conversation_id, user_id, role, content, created_at
        `;
        return Response.json(rows[0], { status: 201 });
      },
    },
  },
});

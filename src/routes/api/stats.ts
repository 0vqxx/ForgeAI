import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const convs = await sql`SELECT id FROM conversations WHERE user_id = ${auth.userId}`;
        const projects = await sql`SELECT id FROM projects WHERE user_id = ${auth.userId}`;
        const agents = await sql`SELECT id FROM agents WHERE user_id = ${auth.userId}`;

        return Response.json({
          chats: convs.length,
          projects: projects.length,
          agents: agents.length,
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const rows = await sql`SELECT * FROM profiles WHERE id = ${auth.userId} LIMIT 1`;
        if (rows.length === 0) {
          return Response.json({ message: "Profile not found" }, { status: 404 });
        }
        return Response.json(rows[0]);
      },

      PATCH: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { display_name, avatar_url } = body as { display_name?: string; avatar_url?: string | null };

        if (display_name === undefined && avatar_url === undefined) {
          return Response.json({ message: "no fields to update" }, { status: 400 });
        }

        const rows = await sql`
          UPDATE profiles
          SET ${display_name !== undefined ? sql`display_name = ${display_name}` : sql``}
              ${display_name !== undefined && avatar_url !== undefined ? sql`, ` : sql``}
              ${avatar_url !== undefined ? sql`avatar_url = ${avatar_url}` : sql``},
              updated_at = now()
          WHERE id = ${auth.userId}
          RETURNING *
        `;
        if (rows.length === 0) {
          return Response.json({ message: "Profile not found" }, { status: 404 });
        }
        return Response.json(rows[0]);
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/projects")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const rows = await sql`
          SELECT id, user_id, name, description, accent, created_at, updated_at
          FROM projects
          WHERE user_id = ${auth.userId}
          ORDER BY updated_at DESC
        `;
        return Response.json(rows);
      },

      POST: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { name, description, accent } = body as { name?: string; description?: string; accent?: string };

        if (!name) {
          return Response.json({ message: "name is required" }, { status: 400 });
        }

        const rows = await sql`
          INSERT INTO projects (user_id, name, description, accent)
          VALUES (${auth.userId}, ${name}, ${description ?? null}, ${accent ?? "bloom"})
          RETURNING id, user_id, name, description, accent, created_at, updated_at
        `;
        return Response.json(rows[0], { status: 201 });
      },

      PATCH: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const body = await request.json().catch(() => ({}));
        const { id, name, description, accent } = body as { id?: string; name?: string; description?: string; accent?: string };

        if (!id) return Response.json({ message: "id is required" }, { status: 400 });

        const rows = await sql`
          UPDATE projects
          SET ${name !== undefined ? sql`name = ${name}` : sql``}
              ${name !== undefined && description !== undefined ? sql`, ` : sql``}
              ${description !== undefined ? sql`description = ${description}` : sql``}
              ${(name !== undefined || description !== undefined) && accent !== undefined ? sql`, ` : sql``}
              ${accent !== undefined ? sql`accent = ${accent}` : sql``},
              updated_at = now()
          WHERE id = ${id} AND user_id = ${auth.userId}
          RETURNING id, user_id, name, description, accent, created_at, updated_at
        `;
        if (rows.length === 0) {
          return Response.json({ message: "Not found or no permission" }, { status: 404 });
        }
        return Response.json(rows[0]);
      },

      DELETE: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ message: "id is required" }, { status: 400 });

        const result = await sql`DELETE FROM projects WHERE id = ${id} AND user_id = ${auth.userId}`;
        if (result.count === 0) {
          return Response.json({ message: "Not found or no permission" }, { status: 404 });
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});

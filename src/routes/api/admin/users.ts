import { createFileRoute } from "@tanstack/react-router";
import { getAuthContext } from "@/lib/api-auth";
import { sql, isAdminRole } from "@/lib/db";

export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const profile = await sql`SELECT role FROM profiles WHERE id = ${auth.userId} LIMIT 1`;
        if (profile.length === 0 || !isAdminRole(profile[0].role)) {
          return Response.json({ message: "Unauthorized" }, { status: 403 });
        }

        const users = await sql`
          SELECT id, display_name, email, avatar_url, role, created_at, updated_at
          FROM profiles
          ORDER BY created_at DESC
        `;
        return Response.json(users);
      },

      PATCH: async ({ request }) => {
        const auth = await getAuthContext(request);
        if (!auth.ok) return auth.response;

        const profile = await sql`SELECT role FROM profiles WHERE id = ${auth.userId} LIMIT 1`;
        if (profile.length === 0 || profile[0].role !== "founder") {
          return Response.json({ message: "Unauthorized - only founders can change roles" }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { userId, role } = body as { userId?: string; role?: "user" | "dev" | "admin" | "founder" };

        if (!userId || !role) {
          return Response.json({ message: "userId and role are required" }, { status: 400 });
        }
        if (!["user", "dev", "admin", "founder"].includes(role)) {
          return Response.json({ message: "invalid role" }, { status: 400 });
        }

        const rows = await sql`
          UPDATE profiles SET role = ${role}, updated_at = now()
          WHERE id = ${userId}
          RETURNING id, display_name, email, avatar_url, role, created_at, updated_at
        `;
        if (rows.length === 0) {
          return Response.json({ message: "User not found" }, { status: 404 });
        }
        return Response.json(rows[0]);
      },
    },
  },
});

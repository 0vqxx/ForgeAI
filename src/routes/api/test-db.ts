import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/test-db")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const res = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages'`;
          return Response.json(res);
        } catch (e: any) {
          return Response.json({ error: e.message }, { status: 500 });
        }
      },
    },
  },
});

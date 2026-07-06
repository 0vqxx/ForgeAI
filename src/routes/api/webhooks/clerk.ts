import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook } from "@clerk/backend/webhooks";
import { sql } from "@/lib/db";

export const Route = createFileRoute("/api/webhooks/clerk")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let evt;
        try {
          evt = await verifyWebhook(request);
        } catch (err) {
          console.error("[webhooks/clerk] verification failed:", err);
          return Response.json({ message: "Invalid webhook signature" }, { status: 401 });
        }

        const payload = evt.data as {
          id?: string;
          email_addresses?: { email_address: string }[];
          first_name?: string | null;
          last_name?: string | null;
          image_url?: string | null;
        };

        if (evt.type === "user.created" && payload.id) {
          const email = payload.email_addresses?.[0]?.email_address ?? null;
          const display =
            [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || null;
          await sql`
            INSERT INTO profiles (id, email, display_name, avatar_url)
            VALUES (${payload.id}, ${email}, ${display}, ${payload.image_url ?? null})
            ON CONFLICT (id) DO NOTHING
          `;
        }

        if (evt.type === "user.updated" && payload.id) {
          const email = payload.email_addresses?.[0]?.email_address ?? null;
          const display =
            [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || null;
          await sql`
            INSERT INTO profiles (id, email, display_name, avatar_url)
            VALUES (${payload.id}, ${email}, ${display}, ${payload.image_url ?? null})
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
              avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
              updated_at = now()
          `;
        }

        if (evt.type === "user.deleted" && payload.id) {
          await sql`DELETE FROM profiles WHERE id = ${payload.id}`;
        }

        return Response.json({ received: true });
      },
    },
  },
});

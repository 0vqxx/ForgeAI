/**
 * Shared auth helper for TanStack Start HTTP server route handlers.
 *
 * Extracts the Bearer token from the request, creates a user-scoped
 * Supabase client (RLS enforced), and returns the userId.
 * Returns a 401 Response on any auth failure so callers can early-return.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

type AuthSuccess = {
  ok: true;
  supabase: ReturnType<typeof createClient<Database>>;
  userId: string;
};

type AuthFailure = {
  ok: false;
  response: Response;
};

export async function getAuthContext(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[api-auth] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
    return {
      ok: false,
      response: Response.json(
        { message: "Server misconfiguration: missing Supabase env vars" },
        { status: 500 },
      ),
    };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);

  // Create a Supabase client scoped to this user token (RLS applies)
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Validate the token by fetching the user
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.error("[api-auth] Invalid token:", error?.message);
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized: invalid token" }, { status: 401 }),
    };
  }

  return { ok: true, supabase, userId: data.user.id };
}

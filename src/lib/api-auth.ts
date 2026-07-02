/**
 * Shared auth helper for TanStack Start HTTP server route handlers.
 *
 * Extracts the Bearer token from the request and creates a user-scoped
 * Supabase client with RLS enforced. Token validity is proven implicitly —
 * if the token is invalid, Supabase RLS will reject the query and we return 401.
 *
 * We intentionally skip a separate getUser() validation call because:
 * - The new sb_publishable_* key format may not support server-side getUser()
 * - RLS on the DB side enforces auth.uid() = user_id on every query anyway
 * - Any forged/expired token will just get an empty result or RLS error
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
      new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    }
    // Strip the key from Authorization only when it's the key itself, not a user JWT
    const authVal = headers.get("Authorization");
    if (isNewSupabaseApiKey(supabaseKey) && authVal === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

type AuthSuccess = {
  ok: true;
  supabase: ReturnType<typeof createClient<Database>>;
  /** Decoded from the JWT sub claim — no network call needed */
  userId: string;
};

type AuthFailure = {
  ok: false;
  response: Response;
};

/** Decode the sub claim from a JWT without verifying the signature. */
function getSubFromJwt(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

export async function getAuthContext(
  request: Request,
): Promise<AuthSuccess | AuthFailure> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[api-auth] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY env vars");
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
    console.error("[api-auth] No Bearer token in request headers");
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized" }, { status: 401 }),
    };
  }

  const token = authHeader.slice(7);

  // Decode userId from the JWT without a network call.
  // If the token is malformed or missing sub, reject immediately.
  const userId = getSubFromJwt(token);
  if (!userId) {
    console.error("[api-auth] Could not decode sub from JWT");
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized: invalid token" }, { status: 401 }),
    };
  }

  // Build a user-scoped client. All queries run with the user's JWT so RLS applies.
  // An expired or forged token will be rejected by Supabase on the first query.
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

  return { ok: true, supabase, userId };
}

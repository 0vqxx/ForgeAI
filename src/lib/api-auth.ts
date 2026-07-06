import { verifyToken } from "@clerk/backend";

const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkSecretKey) {
  console.error("[api-auth] CLERK_SECRET_KEY env var is missing — Clerk is not configured");
}

export type AuthSuccess = {
  ok: true;
  userId: string;
};

export type AuthFailure = {
  ok: false;
  response: Response;
};

export async function getAuthContext(request: Request): Promise<AuthSuccess | AuthFailure> {
  if (!clerkSecretKey) {
    console.error("[api-auth] Missing CLERK_SECRET_KEY env var");
    return {
      ok: false,
      response: Response.json(
        { message: "Server misconfiguration: missing Clerk secret key" },
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
  if (!token) {
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized: empty token" }, { status: 401 }),
    };
  }

  try {
    const claims = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });
    if (!claims.sub) {
      return {
        ok: false,
        response: Response.json({ message: "Unauthorized: no subject" }, { status: 401 }),
      };
    }
    return { ok: true, userId: claims.sub };
  } catch (err) {
    console.error("[api-auth] Clerk token verification failed:", err);
    return {
      ok: false,
      response: Response.json({ message: "Unauthorized: invalid token" }, { status: 401 }),
    };
  }
}

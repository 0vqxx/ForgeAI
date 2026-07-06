import postgres from "postgres";

export interface ProfileRow {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "user" | "dev" | "admin" | "founder";
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  accent: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  system_prompt: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  project_id: string | null;
  agent_id: string | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: unknown | null;
  created_at: string;
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[db] DATABASE_URL env var is missing — Supabase is not configured");
}

export const sql = postgres(DATABASE_URL ?? "postgres://unconfigured", {
  ssl: "require",
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const rows = await sql<ProfileRow[]>`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function upsertProfileOnSignup(params: {
  userId: string;
  email: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}): Promise<ProfileRow> {
  const rows = await sql<ProfileRow[]>`
    INSERT INTO profiles (id, email, display_name, avatar_url)
    VALUES (${params.userId}, ${params.email ?? null}, ${params.displayName ?? null}, ${params.avatarUrl ?? null})
    ON CONFLICT (id) DO UPDATE
      SET email = EXCLUDED.email,
          updated_at = now()
    RETURNING *
  `;
  return rows[0];
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "dev" || role === "founder";
}

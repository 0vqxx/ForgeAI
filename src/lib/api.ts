/**
 * Client-side data access — talks directly to Supabase (no /api/* routes).
 * RLS on the database enforces per-user isolation.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ConversationRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model: string;
}

export interface MessageRow {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export interface ConversationWithMessages extends ConversationRow {
  messages: MessageRow[];
}

export async function listConversations(): Promise<ConversationRow[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at, model")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at, model")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgError) throw new Error(msgError.message);

  return { ...data, messages: (messages ?? []) as MessageRow[] };
}

export async function createConversation(title?: string, model?: string): Promise<ConversationRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: user.id, title: title || "New chat", model: model || "claude-sonnet-4-6" })
    .select("id, title, created_at, updated_at, model")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateConversation(id: string, updates: { title?: string; model?: string }): Promise<ConversationRow> {
  const { data, error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", id)
    .select("id, title, created_at, updated_at, model")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
): Promise<MessageRow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: user.id, role, content })
    .select("id, role, content, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as MessageRow;
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MessageRow[];
}

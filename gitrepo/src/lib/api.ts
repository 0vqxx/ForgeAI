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

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function listConversations(): Promise<ConversationRow[]> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/conversations", { headers });
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function getConversation(id: string): Promise<ConversationWithMessages> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${id}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch conversation");
  return res.json();
}

export async function createConversation(title?: string, model?: string): Promise<ConversationRow> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ title, model }),
  });
  if (!res.ok) throw new Error("Failed to create conversation");
  return res.json();
}

export async function updateConversation(id: string, updates: { title?: string; model?: string }): Promise<ConversationRow> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update conversation");
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${id}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete conversation");
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
): Promise<MessageRow> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ role, content }),
  });
  if (!res.ok) throw new Error("Failed to add message");
  return res.json();
}

export async function listMessages(conversationId: string): Promise<MessageRow[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers });
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

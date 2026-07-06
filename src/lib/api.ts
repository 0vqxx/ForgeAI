import { useAuthedFetch, type ConversationRow, type MessageRow, type ConversationWithMessages } from "./api-fetch";

export type { ConversationRow, MessageRow, ConversationWithMessages };

export function useConversationsApi() {
  const fetch = useAuthedFetch();

  return {
    list: async (): Promise<ConversationRow[]> => {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    get: async (id: string): Promise<ConversationWithMessages> => {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    create: async (title?: string, model?: string, id?: string): Promise<ConversationRow> => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title, model, id }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    update: async (id: string, updates: { title?: string; model?: string }): Promise<ConversationRow> => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    remove: async (id: string): Promise<void> => {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
    },

    addMessage: async (
      conversationId: string,
      role: "user" | "assistant" | "system",
      content: string,
    ): Promise<MessageRow> => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({ role, content }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    listMessages: async (conversationId: string): Promise<MessageRow[]> => {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

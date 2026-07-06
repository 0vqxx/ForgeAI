import { useAuth } from "@clerk/tanstack-react-start";
import { useCallback } from "react";

type FetchInit = RequestInit & { auth?: boolean };

export function useAuthedFetch() {
  const { getToken } = useAuth();

  return useCallback(
    async (input: RequestInfo | URL, init: FetchInit = {}) => {
      const token = await getToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      return fetch(input, { ...init, headers });
    },
    [getToken],
  );
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
  created_at: string;
}

export interface ConversationWithMessages extends ConversationRow {
  messages: MessageRow[];
}

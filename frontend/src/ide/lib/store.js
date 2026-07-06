/** Zustand global store for BloomIDE. */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_SETTINGS = {
  theme: "dark",
  fontFamily: "JetBrains Mono",
  fontSize: 13,
  tabSize: 2,
  wordWrap: "on",
  model: "z-ai/glm-5.1",
  autoSave: true,
  ghostText: true,
  terminalShell: "/bin/bash",
};

export const useSettings = create(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: "bloomide.settings.v1" },
  ),
);

export const useChatHistory = create(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      newConversation: () => {
        const id = "c_" + Date.now();
        const conv = { id, title: "New chat", messages: [], created: Date.now() };
        set((s) => ({ conversations: [conv, ...s.conversations], activeId: id }));
        return id;
      },
      setActive: (id) => set({ activeId: id }),
      appendMessage: (id, msg) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, messages: [...c.messages, msg] } : c,
          ),
        })),
      updateLastAssistant: (id, content) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== id) return c;
            const ms = [...c.messages];
            for (let i = ms.length - 1; i >= 0; i--) {
              if (ms[i].role === "assistant") {
                ms[i] = { ...ms[i], content };
                break;
              }
            }
            return { ...c, messages: ms };
          }),
        })),
      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
        })),
      deleteConversation: (id) =>
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          return {
            conversations,
            activeId: s.activeId === id ? conversations[0]?.id ?? null : s.activeId,
          };
        }),
      getActive: () => {
        const s = get();
        return s.conversations.find((c) => c.id === s.activeId) || null;
      },
    }),
    { name: "bloomide.chats.v1" },
  ),
);

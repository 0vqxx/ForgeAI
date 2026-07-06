// NVIDIA NIM AI Integration
// Provides streaming access to NVIDIA NIM models via local backend /api/chat

export type NvidiaModel =
  | "moonshotai/kimi-k2.6"
  | "z-ai/glm-5.2";

export type ModelProvider = "moonshot" | "z-ai";

export interface ModelInfo {
  label: string;
  provider: ModelProvider;
  providerLabel: string;
}

export const NVIDIA_MODELS: Record<NvidiaModel, ModelInfo> = {
  "moonshotai/kimi-k2.6": { label: "Kimi K2.6", provider: "moonshot", providerLabel: "Moonshot AI" },
  "z-ai/glm-5.2": { label: "GLM 5.2", provider: "z-ai", providerLabel: "Zhipu AI" },
};

export const PROVIDER_GROUPS: { provider: ModelProvider; label: string; models: NvidiaModel[] }[] = [
  { provider: "moonshot", label: "Moonshot AI", models: ["moonshotai/kimi-k2.6"] },
  { provider: "z-ai", label: "Zhipu AI", models: ["z-ai/glm-5.2"] },
];

export class NvidiaAI {
  private static instance: NvidiaAI;

  private constructor() {}

  static getInstance(): NvidiaAI {
    if (!NvidiaAI.instance) {
      NvidiaAI.instance = new NvidiaAI();
    }
    return NvidiaAI.instance;
  }

  // Mimic Puter AI state for compatibility with UI state loaders
  isAvailable(): boolean {
    return true;
  }

  isSignedIn(): boolean {
    return true;
  }

  async ensureAuth(): Promise<void> {
    return; // No-op: client authentication not needed for secure backend routes
  }

  async chat(messages: Array<{ role: string; content: string }>, model: NvidiaModel = "moonshotai/kimi-k2.6"): Promise<string> {
    // @ts-ignore
    const token = await window.Clerk?.session?.getToken();
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        model,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || "Failed to communicate with AI endpoint.");
    }

    const data = await response.text();
    return data;
  }

  async chatStream(
    messages: Array<{ role: string; content: string }>,
    model: NvidiaModel = "moonshotai/kimi-k2.6",
    onChunk: (chunk: string) => void
  ): Promise<string> {
    // @ts-ignore
    const token = await window.Clerk?.session?.getToken();
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        model,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || "Failed to communicate with AI endpoint.");
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable.");
    }

    const decoder = new TextDecoder();
    let fullText = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        fullText += text;
        onChunk(text);
      }
    } finally {
      reader.releaseLock();
    }

    return fullText;
  }
}

export const nvidiaAI = NvidiaAI.getInstance();

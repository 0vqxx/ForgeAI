import { createFileRoute } from "@tanstack/react-router";
import { type UIMessage } from "ai";

type Body = {
  messages?: unknown;
  system?: string;
  model?: string;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as Body;
        if (!Array.isArray(body.messages)) {
          return new Response("messages required", { status: 400 });
        }

        const modelId = typeof body.model === "string" && body.model ? body.model : "moonshotai/kimi-k2.6";
        const system = typeof body.system === "string" && body.system.trim() ? body.system : undefined;

        const authHeader = request.headers.get("authorization");

        const proxyUrl = process.env.NVIDIA_PROXY_URL || "https://forge-backend-jewallah.fly.dev/api/ai/chat";

        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (authHeader) {
            headers["Authorization"] = authHeader;
          }

          const GLM_THINKING_INJECTION = modelId.includes("glm")
            ? `\n\nIMPORTANT: You MUST think step by step before answering. Wrap ALL of your reasoning and thinking inside <think>...</think> XML tags. Place the <think> block FIRST, before any response. After the closing </think> tag, write your final answer.`
            : "";

          const response = await fetch(proxyUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              messages: body.messages,
              model: modelId,
              system: system ? system + GLM_THINKING_INJECTION : GLM_THINKING_INJECTION || undefined,
              provider: (body as any).provider || "nvidia",
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            return new Response(`Proxy Error: ${errText}`, { status: response.status });
          }

          return new Response(response.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
          });
        } catch (err: any) {
          return new Response(`Proxy Connection Error: ${err.message || err}`, { status: 502 });
        }
      },
    },
  },
});
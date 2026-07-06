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

        const proxyUrl = process.env.NVIDIA_PROXY_URL || "https://ghostdetector2-forge-api-proxy.hf.space/api/ai/chat";

        try {
          const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: body.messages,
              model: modelId,
              system: system,
              provider: "nvidia",
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
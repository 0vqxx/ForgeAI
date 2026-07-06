import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { ContentWithTools } from "./ToolBlock";

/** Parse <think>...</think> from raw content, returns { thinking, answer } */
export function parseThinking(raw: string): { thinking: string | null; answer: string } {
  // Handle streaming — the closing tag may not have arrived yet
  const openIdx = raw.indexOf("<think>");
  if (openIdx === -1) return { thinking: null, answer: raw };

  const closeIdx = raw.indexOf("</think>", openIdx);

  if (closeIdx === -1) {
    // Still streaming — everything inside think so far is thinking
    const thinking = raw.slice(openIdx + 7);
    return { thinking: thinking.trim() || null, answer: "" };
  }

  const thinking = raw.slice(openIdx + 7, closeIdx).trim();
  const answer = (raw.slice(0, openIdx) + raw.slice(closeIdx + 8)).trim();
  return { thinking: thinking || null, answer };
}

/** Collapsible thinking block shown above the assistant's answer */
export function ThinkingBlock({ content }: { content: string }) {
  const { thinking, answer } = parseThinking(content);
  const [open, setOpen] = useState(false);

  const isStreaming = content.includes("<think>") && !content.includes("</think>");

  return (
    <div className="w-full">
      {thinking !== null && (
        <div className="mb-3">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Brain className="h-3.5 w-3.5 text-purple-400" />
            {isStreaming ? (
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:0ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:150ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 [animation-delay:300ms]" />
                Thinking...
              </span>
            ) : (
              <>
                <span className="text-purple-400">Thought for a moment</span>
                {open ? (
                  <ChevronDown className="h-3 w-3 opacity-60" />
                ) : (
                  <ChevronRight className="h-3 w-3 opacity-60" />
                )}
              </>
            )}
          </button>

          {open && thinking && (
            <div className="mt-1.5 overflow-hidden rounded-xl border border-purple-500/20 bg-purple-950/20">
              <div className="px-4 py-3 font-mono text-[12px] leading-relaxed text-purple-200/70 whitespace-pre-wrap">
                {thinking}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Final answer — only render once thinking is done or there's no think block */}
      {!isStreaming && answer && <ContentWithTools content={answer} />}

      {/* While streaming the answer after think closed */}
      {isStreaming && (
        <div className="text-sm text-foreground/50 italic">Generating response...</div>
      )}
    </div>
  );
}

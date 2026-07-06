import { Wrench, Download } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";

/**
 * Parses raw text and splits it into text segments and tool segments.
 */
export function parseTools(raw: string) {
  // Hide raw XML tool tags that models use as a fallback, including streaming incomplete tags
  raw = raw.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/g, "").trim();

  const segments = [];
  let current = raw;

  while (true) {
    const startIdx = current.indexOf("[TOOL_START:");
    if (startIdx === -1) {
      if (current) segments.push({ type: "text", content: current });
      break;
    }

    if (startIdx > 0) {
      segments.push({ type: "text", content: current.slice(0, startIdx) });
    }

    // Find the end of the TOOL_START line
    const startEndIdx = current.indexOf("]", startIdx);
    if (startEndIdx === -1) {
      // Incomplete tool start (streaming)
      segments.push({
        type: "tool",
        call: current.slice(startIdx + 12).trim(), // still typing
        status: "running"
      });
      break;
    }

    const callStr = current.slice(startIdx + 12, startEndIdx).trim();
    
    // Now look for TOOL_END
    const endTagStr = "[TOOL_END:";
    const endIdx = current.indexOf(endTagStr, startEndIdx);
    
    if (endIdx === -1) {
      // Started but not ended (tool is running)
      segments.push({
        type: "tool",
        call: callStr,
        status: "running"
      });
      // The rest of the text after TOOL_START might be newlines or partial TOOL_END, but usually empty.
      break;
    } else {
      const endTagEndIdx = current.indexOf("]", endIdx);
      if (endTagEndIdx === -1) {
         // partial tool end tag
         segments.push({
            type: "tool",
            call: callStr,
            status: "running"
         });
         break;
      }
      segments.push({
        type: "tool",
        call: callStr,
        status: "completed"
      });
      current = current.slice(endTagEndIdx + 1).replace(/^\n+/, ''); // trim leading newlines after tool
    }
  }

  return segments;
}

export function ToolBlock({ call, status }: { call: string, status: "running" | "completed" }) {
  return (
    <div className="my-2 flex items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-xs font-mono">
      <Wrench className={`h-3.5 w-3.5 ${status === "running" ? "animate-pulse text-blue-400" : "text-foreground/50"}`} />
      <span className={status === "completed" ? "text-foreground/90" : "text-blue-400"}>{call}</span>
      {status === "running" && (
        <span className="ml-auto flex items-center gap-1 text-blue-400">
           <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-blue-400 [animation-delay:0ms]" />
           <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
           <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-blue-400 [animation-delay:300ms]" />
        </span>
      )}
    </div>
  );
}

export function ContentWithTools({ content }: { content: string }) {
  const segments = parseTools(content);

  const extractDownloadUrl = (text: string): string | null => {
    const match = text.match(/\/api\/downloads\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\.zip/);
    return match ? match[0] : null;
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          const downloadUrl = seg.content ? extractDownloadUrl(seg.content) : null;
          return (
            <div key={i}>
              <MarkdownMessage content={seg.content || ""} />
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Download className="h-3 w-3" />
                  Download file
                </a>
              )}
            </div>
          );
        } else {
          return <ToolBlock key={i} call={seg.call!} status={seg.status as "running" | "completed"} />;
        }
      })}
    </div>
  );
}

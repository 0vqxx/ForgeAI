/** AI Chat panel with streaming, markdown, code-blocks, conversation history. */
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Plus, Trash2, Copy, Check, Square, Bot } from "lucide-react";
import { streamChat, aiApi, fsApi } from "../lib/api";
import { useSettings, useChatHistory } from "../lib/store";
import { toast } from "sonner";

const FORGE_LOGO = "https://customer-assets.emergentagent.com/job_bloom-dev/artifacts/9wzw7jmx_ChatGPT%20Image%20Jun%2029%2C%202026%2C%2010_35_48%20PM.png";

const AGENT_SYSTEM = `You are Forge — an autonomous AI coding agent embedded in a code editor. You CAN and SHOULD write files to the user's workspace using the special action-block protocol below. NEVER ask the user for confirmation or clarification when they have already given you a concrete request — execute immediately.

ACTION BLOCK FORMAT (use this verbatim, including the closing tag):

<forge-file path="relative/path.ext" action="create">
\`\`\`language
file contents here
\`\`\`
</forge-file>

Rules:
- Use action="create" for new files; action="update" for full-file rewrites of an existing file.
- The path MUST be relative to the workspace root (no leading slash).
- Emit one block per file. You may emit multiple blocks in a single reply.
- After the blocks, write a 1-2 sentence summary of what you did.
- If the user is only asking a question (no code change implied), reply in normal markdown WITHOUT any forge-file blocks.

FEW-SHOT EXAMPLES

User: "Create a file named hello.txt with the text Hi there"
Assistant:
<forge-file path="hello.txt" action="create">
\`\`\`text
Hi there
\`\`\`
</forge-file>
Created \`hello.txt\` with the requested content.

User: "Make a Python script that prints the first 10 primes in src/primes.py"
Assistant:
<forge-file path="src/primes.py" action="create">
\`\`\`python
def first_n_primes(n: int) -> list[int]:
    primes, candidate = [], 2
    while len(primes) < n:
        if all(candidate % p != 0 for p in primes):
            primes.append(candidate)
        candidate += 1
    return primes


if __name__ == "__main__":
    print(first_n_primes(10))
\`\`\`
</forge-file>
Created \`src/primes.py\` with a prime-generator and \`__main__\` runner.

Now follow these rules for every user message.`;

const CHAT_SYSTEM = "You are Forge — an expert AI pair programmer. Be concise, accurate, use markdown with fenced code blocks (with language tags). Reference the user's open file when relevant.";

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  if (inline) return <code className={className} {...props}>{children}</code>;
  const text = String(children).replace(/\n$/, "");
  return (
    <pre>
      <button
        className="bl-copy-btn"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Copy"}
      </button>
      <code className={className} {...props}>{text}</code>
    </pre>
  );
}

function renderMessage(content) {
  // Replace <forge-file path="X" action="Y">...</forge-file> with nice markdown
  return content.replace(
    /<forge-file\s+path="([^"]+)"\s+action="(create|update)">([\s\S]*?)<\/forge-file>/g,
    (_, path, action, body) => {
      const verb = action === "create" ? "📄 Creating" : "✏️ Editing";
      return `\n**${verb} \`${path}\`**\n${body.trim()}\n`;
    },
  );
}

export default function ChatPanel({ getContext, onMaximize, onFilesChanged }) {
  const settings = useSettings();
  const chats = useChatHistory();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState([]);
  const [agentMode, setAgentMode] = useState(true);
  const abortRef = useRef(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    aiApi.models().then((d) => setModels(d.models || [])).catch(() => {});
    if (!chats.activeId) chats.newConversation();
  }, []); // eslint-disable-line

  const active = chats.conversations.find((c) => c.id === chats.activeId);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [active?.messages?.length, active?.messages?.[active?.messages?.length - 1]?.content]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    let convId = chats.activeId;
    if (!convId) convId = chats.newConversation();
    // include current file context
    const ctx = getContext?.();
    let finalUser = userMsg;
    if (ctx?.code) {
      finalUser = `Currently open file: ${ctx.path} (${ctx.language})\n\n\`\`\`${ctx.language}\n${ctx.code.slice(0, 8000)}\n\`\`\`\n\nUser: ${userMsg}`;
    }
    if (agentMode) {
      finalUser = `[AGENT TASK — respond ONLY with <forge-file path="..." action="create|update">\`\`\`lang\n...code...\n\`\`\`</forge-file> blocks. Do NOT ask for clarification. Choose a filename if none is given.]\n\n${finalUser}`;
    }
    chats.appendMessage(convId, { role: "user", content: userMsg, ts: Date.now() });
    chats.appendMessage(convId, { role: "assistant", content: "", ts: Date.now() });
    if (active && active.messages.length === 0) {
      chats.renameConversation(convId, userMsg.slice(0, 40));
    }
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const conv = chats.conversations.find((c) => c.id === convId);
    const history = (conv?.messages || []).filter((m) => m.content).map((m) => ({ role: m.role, content: m.content }));
    history[history.length - 1] = { role: "user", content: finalUser };
    let buf = "";
    await streamChat({
      model: settings.model,
      messages: history,
      system: agentMode ? AGENT_SYSTEM : CHAT_SYSTEM,
      signal: controller.signal,
      onDelta: (d) => { buf += d; chats.updateLastAssistant(convId, buf); },
      onError: (e) => { toast.error(e.message || "AI error"); },
    });
    setStreaming(false);
    abortRef.current = null;
    // Apply any agent file actions
    if (agentMode) await applyAgentActions(buf);
  };

  const applyAgentActions = async (text) => {
    const regex = /<forge-file\s+path="([^"]+)"\s+action="(create|update)">\s*```[\w-]*\n([\s\S]*?)```\s*<\/forge-file>/g;
    const actions = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      actions.push({ path: m[1], action: m[2], content: m[3] });
    }
    if (actions.length === 0) {
      toast("No file actions in reply", { description: "Try a more specific request like 'create file X with Y'" });
      return;
    }
    for (const a of actions) {
      try {
        await fsApi.write(a.path, a.content);
        toast.success(`${a.action === "create" ? "Created" : "Updated"} ${a.path}`);
      } catch (err) {
        toast.error(`Failed to write ${a.path}`);
      }
    }
    onFilesChanged?.();
  };

  const stop = () => abortRef.current?.abort();

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--panel)", borderLeft: "1px solid var(--border)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <img src={FORGE_LOGO} alt="Forge" style={{ width: 18, height: 18, borderRadius: 4 }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em" }}>Forge</span>
        <button
          onClick={() => setAgentMode((v) => !v)}
          title={agentMode ? "Agent mode ON — can edit files" : "Chat mode — answer only"}
          data-testid="agent-toggle"
          className="bl-btn ghost"
          style={{
            padding: "2px 8px", height: 22, fontSize: 10, gap: 4,
            color: agentMode ? "var(--accent)" : "var(--fg-muted)",
            background: agentMode ? "var(--accent-soft)" : "transparent",
            border: `1px solid ${agentMode ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          <Bot size={11} /> {agentMode ? "Agent" : "Ask"}
        </button>
        <select
          value={settings.model}
          onChange={(e) => settings.set({ model: e.target.value })}
          className="bl-input"
          style={{ marginLeft: "auto", width: "auto", padding: "4px 8px", height: 26, fontSize: 11 }}
          data-testid="model-select"
        >
          {models.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
        <button className="bl-btn ghost" title="New chat" style={{ padding: 4, height: 26, width: 26 }} onClick={() => chats.newConversation()} data-testid="new-chat-btn">
          <Plus size={13} />
        </button>
      </div>

      {/* History selector */}
      {chats.conversations.length > 1 && (
        <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", display: "flex", gap: 4, overflowX: "auto" }}>
          {chats.conversations.slice(0, 6).map((c) => (
            <button
              key={c.id}
              className={`bl-btn ${c.id === chats.activeId ? "primary" : "ghost"}`}
              style={{ fontSize: 11, padding: "2px 8px", height: 22, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              onClick={() => chats.setActive(c.id)}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }} data-testid="chat-messages">
        {(!active || active.messages.length === 0) && (
          <div style={{ margin: "auto", textAlign: "center", color: "var(--fg-dim)", fontSize: 12, padding: 20 }}>
            <img src={FORGE_LOGO} alt="Forge" style={{ width: 56, height: 56, opacity: 0.85, marginBottom: 12, filter: "drop-shadow(0 0 16px rgba(234,88,12,0.35))" }} />
            <div style={{ fontSize: 15, color: "var(--fg)", fontWeight: 600 }}>Ask Forge anything</div>
            <div style={{ marginTop: 8, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--accent)" }}>Agent mode</strong> lets me edit files directly.
              <br />Try: <em>"Build a Python CLI todo app"</em> or <em>"Add error handling here"</em>
            </div>
          </div>
        )}
        {active?.messages.map((m, i) => (
          <div key={i} className={`bl-chat-msg ${m.role}`}>
            {m.role === "user" ? (
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            ) : (
              <div className="md">
                {m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{renderMessage(m.content)}</ReactMarkdown>
                ) : (
                  <span style={{ color: "var(--fg-dim)" }}>Thinking…</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ borderTop: "1px solid var(--border)", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask anything, or describe a change…"
          className="bl-input"
          rows={2}
          style={{ resize: "none", fontFamily: "inherit" }}
          data-testid="chat-input"
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {active && (
            <button className="bl-btn ghost" title="Delete chat" style={{ padding: 4 }} onClick={() => chats.deleteConversation(active.id)}>
              <Trash2 size={12} />
            </button>
          )}
          <div style={{ flex: 1, fontSize: 11, color: "var(--fg-dim)" }}>
            <span className="bl-kbd">Enter</span> send  ·  <span className="bl-kbd">Shift+Enter</span> newline
          </div>
          {streaming ? (
            <button className="bl-btn" onClick={stop} data-testid="chat-stop-btn"><Square size={12} /> Stop</button>
          ) : (
            <button className="bl-btn primary" onClick={send} disabled={!input.trim()} data-testid="chat-send-btn">
              <Send size={12} /> Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

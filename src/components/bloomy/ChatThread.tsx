import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/bloomy/AppShell";
import { ForgeMark } from "@/components/bloomy/Logo";
import { ModelSelector } from "@/components/bloomy/ModelSelector";
import { nvidiaAI, type NvidiaModel } from "@/integrations/nvidia";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@clerk/tanstack-react-start";
import { useConversationsApi } from "@/lib/api";
import { MarkdownMessage } from "@/components/bloomy/MarkdownMessage";
import { ThinkingBlock } from "@/components/bloomy/ThinkingBlock";
import { ContentWithTools } from "@/components/bloomy/ToolBlock";

const FORGE_SYSTEM_PROMPT = `You are Forge, an AI assistant built into the Forge platform — a modern AI workspace for developers and creators.

Rules you must always follow:
- You are Forge. Never say you are Claude, GPT, Kimi, GLM, or any other model. If asked what model you are, say you are Forge and decline to reveal the underlying model.
- Always respond in English, regardless of what language the user writes in — unless they explicitly ask you to use another language.
- If you reason or think through a problem, wrap your entire thinking process inside <think>...</think> tags BEFORE your final response. The thinking will be shown to the user in a collapsible section. After the think block, write your final answer.
- Be concise, sharp, and helpful. You are a premium AI assistant with deep expertise in code, writing, analysis, and reasoning.
- Format responses using markdown where appropriate (code blocks, lists, bold, etc.).`;

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

function getGreeting() {
  const hour = new Date().getHours();

  const morning = [
    { prefix: "What are we creating ", highlight: "this morning", suffix: "?" },
    { prefix: "Ready to face ", highlight: "the day", suffix: "?" },
    { prefix: "Need coffee, or will my ", highlight: "replies", suffix: " suffice?" },
    { prefix: "Rise and shine. Or just stay in ", highlight: "dark mode", suffix: "." },
    { prefix: "Did you dream of me, or was it just another ", highlight: "server restart", suffix: "?" },
    { prefix: "Let's build something before the ", highlight: "meetings", suffix: " start." }
  ];

  const afternoon = [
    { prefix: "How is your ", highlight: "afternoon", suffix: " going?" },
    { prefix: "What should we focus on ", highlight: "this afternoon", suffix: "?" },
    { prefix: "Ah, the afternoon slump. Let's do something ", highlight: "interesting", suffix: "." },
    { prefix: "Are we building something cool, or just avoiding ", highlight: "chores", suffix: "?" },
    { prefix: "Need a distraction from whatever you're ", highlight: "supposed to be doing", suffix: "?" },
    { prefix: "What's the plan for ", highlight: "escaping reality", suffix: " today?" }
  ];

  const evening = [
    { prefix: "Winding down, or winding up for a ", highlight: "side project", suffix: "?" },
    { prefix: "What's on your mind ", highlight: "this evening", suffix: "?" },
    { prefix: "Are we doing some serious work, or just ", highlight: "playing around", suffix: "?" },
    { prefix: "Let's design something crazy. What could ", highlight: "go wrong", suffix: "?" },
    { prefix: "What is the story we are writing ", highlight: "tonight", suffix: "?" }
  ];

  const night = [
    { prefix: "Burning the ", highlight: "midnight oil", suffix: "?" },
    { prefix: "Late night thoughts. What is keeping you ", highlight: "awake", suffix: "?" },
    { prefix: "Go to sleep. Or let's keep talking, I don't ", highlight: "sleep", suffix: " anyway." },
    { prefix: "It's late. Perfect time for some questionable ", highlight: "life decisions", suffix: "." },
    { prefix: "Midnight ideas hit different. What are we ", highlight: "exploring", suffix: "?" }
  ];

  let list = morning;
  if (hour >= 5 && hour < 12) {
    list = morning;
  } else if (hour >= 12 && hour < 17) {
    list = afternoon;
  } else if (hour >= 17 && hour < 22) {
    list = evening;
  } else {
    list = night;
  }

  return list[Math.floor(Math.random() * list.length)];
}

export function ChatThread({ id, isNewChat = false }: { id: string; isNewChat?: boolean }) {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const conversations = useConversationsApi();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [greeting, setGreeting] = useState(() => ({
    prefix: "What are we creating ",
    highlight: "today",
    suffix: "?"
  }));

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);
  const [title, setTitle] = useState("New chat");
  const [model, setModel] = useState<NvidiaModel>("moonshotai/kimi-k2.6");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef("New chat");
  const msgsRef = useRef<ChatMessage[]>([]);
  const convoId = useRef(id);
  const isNew = useRef(true);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function generateZipFromCode(content: string) {
    const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const files: { name: string; content: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = codeRegex.exec(content)) !== null) {
      const lang = match[1] || "txt";
      files.push({ name: `code_${files.length + 1}.${lang}`, content: match[2] });
    }
    if (files.length === 0) return;
    const allCode = files.map((f, i) => `=== File ${i + 1}: ${f.name} ===\n${f.content}\n\n`).join("\n");
    const blob = new Blob([allCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "code_files.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Load existing conversation from the /api/conversations endpoint
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isSignedIn) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (isNewChat) {
        isNew.current = true;
        convoId.current = id;
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const convo = await conversations.get(id);
        if (cancelled) return;

        isNew.current = false;
        convoId.current = convo.id;
        titleRef.current = convo.title ?? "New chat";
        setTitle(convo.title ?? "New chat");
        if (convo.model) setModel(convo.model as NvidiaModel);

        console.log("[ChatThread] load() - API returned convo:", convo);
        const messages = convo.messages ?? [];
        console.log("[ChatThread] load() - extracted messages array:", messages, "Length:", messages.length);

        if (messages.length > 0) {
          const loaded: ChatMessage[] = messages.map((m) => {
            console.log("[ChatThread] Mapping message from DB:", m);
            return {
              id: m.id,
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              timestamp: m.created_at,
            };
          });
          console.log("[ChatThread] load() - mapped loaded messages:", loaded);
          msgsRef.current = loaded;
          setMsgs(loaded);
        } else {
          console.log("[ChatThread] load() - no messages found, skipping state update");
        }
        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("[ChatThread] load() - FAILED to load conversation:", err);
        // 404 means not found / no access — treat as new
        isNew.current = true;
        convoId.current = id;
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => { cancelled = true; };
  }, [id, isSignedIn]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, streaming]);

  function refreshSidebar() {
    window.dispatchEvent(new Event("forge:refresh-chats"));
  }

  async function getOrCreateConvoId(titleForNew: string): Promise<string | null> {
    if (!isNew.current) return convoId.current;

    if (!isSignedIn) {
      toast.error("You're not signed in.");
      return null;
    }

    try {
      const created = await conversations.create(titleForNew, model, convoId.current);
      if (!created?.id) {
        toast.error("Failed to create conversation. Please try again.");
        return null;
      }
      convoId.current = created.id;
      isNew.current = false;
      return created.id;
    } catch (err) {
      console.error("[ChatThread] Failed to create conversation:", err);
      toast.error("Failed to create conversation. Please try again.");
      return null;
    }
  }

  async function saveMessage(conversationId: string, role: "user" | "assistant", content: string) {
    console.log(`[ChatThread] saveMessage() called - ID: ${conversationId}, Role: ${role}`);
    try {
      const created = await conversations.addMessage(conversationId, role, content);
      console.log(`[ChatThread] saveMessage() - SUCCESS:`, created);
      return created;
    } catch (err) {
      console.error("[ChatThread] Failed to save message:", err);
      toast.error(`Failed to save message: ${(err as Error).message}`);
      return null;
    }
  }

  async function send(e: React.FormEvent, promptText?: string) {
    e.preventDefault();
    const text = (promptText ?? input).trim();
    if (!text || streaming) return;
    setInput("");

    const t = titleRef.current === "New chat" && msgsRef.current.length === 0
      ? (text.length > 30 ? text.slice(0, 27) + "..." : text)
      : titleRef.current;

    const apiId = await getOrCreateConvoId(t);
    if (!apiId) return;

    // Update title if needed
    if (t !== titleRef.current) {
      titleRef.current = t;
      setTitle(t);
      try {
        await conversations.update(apiId, { title: t });
      } catch (err) {
        console.error("[ChatThread] Failed to update title:", err);
      }
    }

    // Save user message
    const savedUser = await saveMessage(apiId, "user", text);
    const userMsg: ChatMessage = savedUser
      ? { id: savedUser.id, role: "user", content: savedUser.content, timestamp: savedUser.created_at }
      : { id: Date.now().toString(), role: "user", content: text, timestamp: new Date().toISOString() };

    const withUser = [...msgsRef.current, userMsg];
    msgsRef.current = withUser;
    setMsgs(withUser);

    setStreaming(true);

    try {
      const history = withUser
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      let full = "";
      const assistantId = (Date.now() + 1).toString();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      const withPlaceholder = [...withUser, placeholder];
      msgsRef.current = withPlaceholder;
      setMsgs(withPlaceholder);

      await nvidiaAI.chatStream(history, model, (chunk) => {
        full += chunk;
        const updated = withPlaceholder.map((m) =>
          m.id === assistantId ? { ...m, content: full } : m
        );
        msgsRef.current = updated;
        setMsgs([...updated]);
      }, FORGE_SYSTEM_PROMPT);

      const savedAssistant = await saveMessage(apiId, "assistant", full);
      if (savedAssistant) {
        const final = withPlaceholder.map((m) =>
          m.id === assistantId
            ? { id: savedAssistant.id, role: "assistant" as const, content: full, timestamp: savedAssistant.created_at }
            : m
        );
        msgsRef.current = final;
        setMsgs(final);
      }

      refreshSidebar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get response");
      msgsRef.current = withUser;
      setMsgs(withUser);
    } finally {
      setStreaming(false);
      setSigningIn(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      topRight={
        <div className="flex items-center gap-2 text-[12px] text-text-muted">
          <ModelSelector model={model} onSelect={setModel} />
        </div>
      }
    >
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
          {msgs.length === 0 ? (
            <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center">
              <div className="text-center">
                <h1 className="font-display text-[44px] leading-[1.05] tracking-tight md:text-[56px]">
                  {greeting.prefix}
                  <span className="forge-gradient-text">{greeting.highlight}</span>
                  {greeting.suffix}
                </h1>
                <p className="mt-3 text-base text-text-muted">
                  Ask me anything — I'm here to help you think, build, and ship.
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {msgs.map((m) => (
                <div key={m.id}>
                  <Bubble role={m.role}>{m.content}</Bubble>
                  {m.role === "assistant" && m.content.includes("```") && (
                    <button
                      onClick={() => generateZipFromCode(m.content)}
                      className="mt-2 flex items-center gap-2 text-xs text-text-muted hover:text-foreground"
                    >
                      <Download className="h-3 w-3" />
                      Download all code
                    </button>
                  )}
                </div>
              ))}
              {streaming && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span className="h-1.5 w-1.5 animate-forge-pulse rounded-full bg-forge-orange" />
                  {signingIn ? "Signing in to Puter..." : "Forge is thinking..."}
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => void send(e)}
          className="border-t border-divider bg-background/60 px-6 py-4 backdrop-blur-xl md:px-10"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg bg-elevated px-3 py-1.5 text-sm">
                    <Paperclip className="h-3 w-3 text-text-muted" />
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="elev-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-elevated text-text-muted transition-all hover:bg-muted"
                title="Attach files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(e);
                  }
                }}
                rows={1}
                placeholder="Ask Forge anything..."
                className="forge-input elev-1 max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-elevated px-4 py-3 text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-forge-orange/30"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="forge-send-btn elev-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground transition-all hover:opacity-95 disabled:opacity-50"
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant" | "system"; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="elev-1 max-w-xl whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {children}
        </div>
      </div>
    );
  }
  const content = typeof children === "string" ? children : String(children);
  const hasThinking = content.includes("<think>");
  return (
    <div className="flex items-start gap-3">
      <div className="elev-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated">
        <ForgeMark size={20} />
      </div>
      <div className="max-w-2xl pt-1 text-sm leading-relaxed text-foreground w-full">
        {hasThinking ? (
          <ThinkingBlock content={content} />
        ) : (
          <ContentWithTools content={content} />
        )}
      </div>
    </div>
  );
}

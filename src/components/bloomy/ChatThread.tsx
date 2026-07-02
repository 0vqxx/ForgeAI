import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/bloomy/AppShell";
import { ForgeMark } from "@/components/bloomy/Logo";
import { ModelSelector } from "@/components/bloomy/ModelSelector";
import { puterAI, type PuterModel } from "@/integrations/puter";
import { ArrowUp, Loader2, Paperclip, X, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { MessageRow } from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

function toChatMessage(m: MessageRow): ChatMessage {
  return {
    id: m.id,
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
    timestamp: m.created_at,
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function fetchJSON(url: string, opts?: RequestInit) {
  const headers = await authHeaders();
  const merged = opts?.headers ? { ...headers, ...(opts.headers as Record<string, string>) } : headers;
  console.log("[fetchJSON] Request:", url, opts?.method || "GET", headers);
  const res = await fetch(url, { ...opts, headers: merged });
  console.log("[fetchJSON] Response status:", res.status, res.statusText);
  if (!res.ok) {
    console.error("[fetchJSON] Request failed:", res.status, res.statusText);
    return null;
  }
  const data = await res.json();
  console.log("[fetchJSON] Response data:", data);
  return data;
}

export function ChatThread({ id }: { id: string }) {
  console.log("[ChatThread] Mounted with id:", id);
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState("New chat");
  const [model, setModel] = useState<PuterModel>("claude-sonnet-4-6");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loading, setLoading] = useState(false);
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
      const code = match[2];
      files.push({ name: `code_${files.length + 1}.${lang}`, content: code });
    }

    if (files.length === 0) return;

    // Create a simple text file with all code blocks
    const allCode = files.map((f, i) => `=== File ${i + 1}: ${f.name} ===\n${f.content}\n\n`).join("\n");
    const blob = new Blob([allCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "code_files.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      console.log("[ChatThread] Loading conversation:", id);
      try {
        const convo = await fetchJSON(`/api/conversations/${id}`);
        console.log("[ChatThread] Conversation data:", convo);
        if (cancelled) return;

        // If we successfully retrieved a conversation, load its data.
        // If the conversation doesn't exist yet (new chat), we'll create it on first message.
        if (convo) {
          isNew.current = false;
          titleRef.current = convo.title ?? "New chat";
          setTitle(convo.title ?? "New chat");
          if (convo.model) setModel(convo.model);
          const loaded = (convo.messages ?? []).map(toChatMessage);
          msgsRef.current = loaded;
          setMsgs(loaded);
          console.log("[ChatThread] Loaded existing conversation with", loaded.length, "messages");
        } else {
          // Conversation doesn't exist yet - this is a new chat
          // It will be created when the user sends the first message
          isNew.current = true;
          convoId.current = id;
          console.log("[ChatThread] New conversation, will create on first message");
        }
      } catch (error) {
        console.error("[ChatThread] Failed to load conversation:", error);
        // On error, treat as new chat
        isNew.current = true;
        convoId.current = id;
      } finally {
        if (!cancelled) {
          setLoading(false);
          console.log("[ChatThread] Loading complete, loading state:", false);
        }
      }
    }

    // Add timeout to ensure loading always clears
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.log("[ChatThread] Timeout reached, forcing loading to false");
        setLoading(false);
      }
    }, 5000);

    load();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [id]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, streaming]);

  // Auto-save input when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (input.trim() && msgsRef.current.length === 0) {
        localStorage.setItem(`draft-${convoId.current || 'new'}`, input);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [input]);

  // Load draft on mount
  useEffect(() => {
    if (!id && msgsRef.current.length === 0) {
      const draft = localStorage.getItem(`draft-new`);
      if (draft) {
        setInput(draft);
        localStorage.removeItem(`draft-new`);
      }
    }
  }, [id]);

  function refreshSidebar() {
    window.dispatchEvent(new Event("forge:refresh-chats"));
  }

  async function send(e: React.FormEvent, promptText?: string) {
    e.preventDefault();
    const text = (promptText ?? input).trim();
    if (!text || streaming) return;
    setInput("");

    const t = titleRef.current === "New chat" && msgsRef.current.length === 0
      ? (text.length > 30 ? text.slice(0, 27) + "..." : text)
      : titleRef.current;

    async function getApiId(): Promise<string | null> {
      if (!isNew.current) return convoId.current;
      // Check if conversation already exists in database
      const existing = await fetchJSON(`/api/conversations/${convoId.current}`);
      if (existing) {
        isNew.current = false;
        return convoId.current;
      }
      // Create new conversation
      const convo = await fetchJSON("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title: t, model }),
      });
      if (!convo) return null;
      // Use the ID returned by the API
      convoId.current = convo.id;
      isNew.current = false;
      return convo.id;
    }

    const apiId = await getApiId();
    if (!apiId) {
      toast.error("Failed to create conversation. Please try again.");
      return;
    }

    // Update title if needed
    if (t !== titleRef.current) {
      titleRef.current = t;
      setTitle(t);
      await fetchJSON(`/api/conversations/${apiId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: t }),
      });
    }

    // Save user message
    const savedUser = await fetchJSON(`/api/conversations/${apiId}/messages`, {
      method: "POST",
      body: JSON.stringify({ role: "user", content: text }),
    });

    const userMsg: ChatMessage = savedUser
      ? toChatMessage(savedUser)
      : { id: Date.now().toString(), role: "user", content: text, timestamp: new Date().toISOString() };

    const withUser = [...msgsRef.current, userMsg];
    msgsRef.current = withUser;
    setMsgs(withUser);

    setStreaming(true);
    setSigningIn(!puterAI.isSignedIn());

    try {
      const history = withUser
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      let full = "";
      const assistantId = (Date.now() + 1).toString();
      const placeholder: ChatMessage = { id: assistantId, role: "assistant", content: "", timestamp: new Date().toISOString() };
      const withPlaceholder = [...withUser, placeholder];
      msgsRef.current = withPlaceholder;
      setMsgs(withPlaceholder);

      await puterAI.chatStream(history, model, (chunk) => {
        full += chunk;
        const updated = withPlaceholder.map((m) => m.id === assistantId ? { ...m, content: full } : m);
        msgsRef.current = updated;
        setMsgs([...updated]);
      });

      const savedAssistant = await fetchJSON(`/api/conversations/${apiId}/messages`, {
        method: "POST",
        body: JSON.stringify({ role: "assistant", content: full }),
      });

      if (savedAssistant) {
        const final = withPlaceholder.map((m) => m.id === assistantId ? { ...m, id: savedAssistant.id, content: full } : m);
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
                  How can I help, <span className="forge-gradient-text">today</span>?
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

        <form onSubmit={(e) => void send(e)} className="border-t border-divider bg-background/60 px-6 py-4 backdrop-blur-xl md:px-10">
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

/** Helper to render markdown‑like headings and fenced code blocks with copy / download buttons. */
function renderMessage(content: string) {
  const elements: JSX.Element[] = [];
  const codeRegex = /```([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const codeBlocks: string[] = [];

  while ((match = codeRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) elements.push(...renderTextBlock(before, elements.length));
    const code = match[1];
    codeBlocks.push(code);
    const key = `code-${elements.length}`;
    elements.push(
      <pre key={key} className="relative rounded bg-gray-800 p-4 text-sm text-white overflow-x-auto">
        <code className="block whitespace-pre">{code}</code>
        <button
          className="absolute top-2 right-2 rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
          onClick={() => navigator.clipboard.writeText(code)}
        >Copy</button>
        <a
          className="absolute top-2 right-24 rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600"
          href={URL.createObjectURL(new Blob([code], { type: "text/plain" }))}
          download="snippet.txt"
        >Download</a>
      </pre>
    );
    lastIndex = codeRegex.lastIndex;
  }
  const tail = content.slice(lastIndex);
  if (tail) elements.push(...renderTextBlock(tail, elements.length));
  return elements;
}

function renderTextBlock(txt: string, startIdx: number): JSX.Element[] {
  return txt.split("\n").map((line, i) => {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag = (`h${level}`) as keyof JSX.IntrinsicElements;
      return <Tag key={`${startIdx}-${i}`} className="mt-2 mb-1 font-bold">{heading[2]}</Tag>;
    }
    return <p key={`${startIdx}-${i}`} className="whitespace-pre-wrap">{line}</p>;
  });
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
  return (
    <div className="flex items-start gap-3">
      <div className="elev-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated">
        <ForgeMark size={36} />
      </div>
      <div className="max-w-2xl pt-1 text-sm leading-relaxed text-foreground">{renderMessage(content)}</div>
    </div>
  );
}

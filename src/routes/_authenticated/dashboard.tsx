import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { useAuthedFetch } from "@/lib/api-fetch";
import { useConversationsApi } from "@/lib/api";
import { AppShell } from "@/components/bloomy/AppShell";
import { Plus, MessageSquareText, Bot, FolderGit2, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { ConversationRow } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Forge" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const authedFetch = useAuthedFetch();
  const conversations = useConversationsApi();
  const [name, setName] = useState<string>("");
  const [counts, setCounts] = useState<{ chats: number; agents: number; projects: number } | null>(null);
  const [recent, setRecent] = useState<ConversationRow[]>([]);

  useEffect(() => {
    void (async () => {
      if (!user) return;

      try {
        const profileRes = await authedFetch("/api/profile");
        if (profileRes.ok) {
          const p = await profileRes.json();
          setName(p.display_name ?? user.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "");
        }
      } catch {
        // profile not yet created — fall back to email
      }

      try {
        const statsRes = await authedFetch("/api/stats");
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setCounts(stats);
        }
      } catch (err) {
        console.error("[dashboard] stats failed", err);
      }

      try {
        const convos = await conversations.list();
        setCounts((c) => (c ? { ...c, chats: convos.length } : { chats: convos.length, agents: 0, projects: 0 }));
        setRecent(convos.slice(0, 5));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load chats");
      }
    })();
  }, [user]);

  function newChat() {
    navigate({ to: "/chat" });
  }

  const greeting = greet();

  return (
    <AppShell
      topRight={
        <button onClick={newChat} className="elev-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:opacity-95">
          <Plus className="h-3.5 w-3.5" /> New chat
        </button>
      }
    >
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
        <p className="text-[12px] uppercase tracking-[0.18em] text-text-muted">{greeting}</p>
        <h1 className="font-display mt-2 text-[40px] leading-[1.05] tracking-tight md:text-[56px]">
          {name ? <>Hello, <span className="forge-gradient-text">{name}</span>.</> : <span className="forge-gradient-text">Welcome.</span>}
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Stat label="Conversations" value={counts?.chats ?? null} icon={MessageSquareText} to="/chat" />
          <Stat label="Projects" value={counts?.projects ?? null} icon={FolderGit2} to="/projects" />
        </div>

        <div className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Recent chats</h2>
            <Link to="/chat" className="text-xs text-text-muted hover:text-foreground">See all</Link>
          </div>
          {recent.length === 0 ? (
            <button onClick={newChat} className="elev-1 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-elevated/40 p-10 text-text-muted transition-colors hover:border-foreground/30 hover:text-foreground">
              <MessageSquareText className="h-5 w-5 text-forge-orange" />
              <span className="font-display text-lg">Start your first chat</span>
            </button>
          ) : (
            <ul className="divide-y divide-divider rounded-2xl border border-border/60 bg-elevated/70">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link to="/chat/$id" params={{ id: r.id }} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
                    <MessageSquareText className="h-4 w-4 text-text-muted" />
                    <span className="flex-1 truncate text-sm">{r.title}</span>
                    <span className="text-[11px] text-text-muted">{formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, icon: Icon, to }: { label: string; value: number | null; icon: typeof MessageSquareText; to: "/chat" | "/projects" }) {
  return (
    <Link to={to} className="elev-1 group rounded-2xl border border-border/60 bg-elevated/70 p-5 transition-all hover:-translate-y-0.5 hover:elev-2">
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-text-muted" />
        <ArrowUpRight className="h-3.5 w-3.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-4 font-display text-3xl text-foreground">{value ?? "—"}</div>
      <div className="text-[12px] uppercase tracking-wider text-text-muted">{label}</div>
    </Link>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

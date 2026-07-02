import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  MessageSquareText,
  LayoutDashboard,
  FolderGit2,
  Bot,
  Settings as SettingsIcon,
  Search,
  Command,
  Download,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { ForgeLockup } from "./Logo";
import { AmbientBackground } from "./AmbientBackground";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import type { ConversationRow } from "@/lib/api";

type NavItem = { to: string; label: string; icon: LucideIcon; soon?: boolean };

const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquareText },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/projects", label: "Projects", icon: FolderGit2 },
];

const SECONDARY_NAV: NavItem[] = [
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children, topRight }: { children: ReactNode; topRight?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string>("");
  const [recentChats, setRecentChats] = useState<ConversationRow[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  async function loadChats() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/conversations", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const convos: ConversationRow[] = await res.json();
      setRecentChats(convos.slice(0, 8));
    } catch {
      setRecentChats([]);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    loadChats();
    function onRefresh() { loadChats(); }
    window.addEventListener("forge:refresh-chats", onRefresh);
    window.addEventListener("storage", onRefresh);
    return () => {
      window.removeEventListener("forge:refresh-chats", onRefresh);
      window.removeEventListener("storage", onRefresh);
    };
  }, []);

  useEffect(() => {
    loadChats();
  }, [pathname]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Open a fresh composer at /chat. The conversation is persisted only after the
  // first message is sent. The `t` search param remounts the thread when already
  // on /chat so the "+" button always clears the current draft.
  function createNewChat() {
    navigate({ to: "/chat", search: { t: String(Date.now()) } });
  }

  function startRename(chat: ConversationRow) {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }

  async function confirmRename() {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`/api/conversations/${renamingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      setRecentChats((prev) =>
        prev.map((c) => (c.id === renamingId ? { ...c, title: renameValue.trim() } : c))
      );
    } catch {
      toast.error("Failed to rename");
    }
    setRenamingId(null);
  }

  async function deleteChat(id: string) {
    const prev = recentChats;
    setRecentChats((chats) => chats.filter((c) => c.id !== id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (pathname === `/chat/${id}`) {
        navigate({ to: "/chat" });
      }
    } catch {
      setRecentChats(prev);
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full text-foreground">
      <AmbientBackground />

      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-border/60 bg-sidebar/70 px-3 py-4 backdrop-blur-xl md:flex">
        <Link to="/" className="group mb-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent">
          <ForgeLockup size={32} />
        </Link>

        <button
          type="button"
          className="elev-1 mb-3 flex items-center gap-2 rounded-xl border border-border/70 bg-elevated/80 px-3 py-2 text-left text-sm text-text-muted transition-all hover:border-border hover:bg-elevated"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1">Search...</span>
          <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            <Command className="h-2.5 w-2.5" /> K
          </kbd>
        </button>

        <NavSection items={PRIMARY_NAV} pathname={pathname} onChat={createNewChat} />

        {/* Recent chats */}
        <div className="mt-1 flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Recent</span>
          {/* The "+" button creates a new chat. On the Downloads page we want to show a "Coming Soon" state instead. */}
          {pathname.startsWith("/downloads") ? (
            <button
              disabled
              title="Coming Soon"
              className="rounded-md p-1 text-text-muted opacity-50 cursor-not-allowed"
            >
              Coming Soon
            </button>
          ) : (
            <button
              onClick={createNewChat}
              className="rounded-md p-1 text-text-muted transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {recentChats.map((c) => (
              <ContextMenu key={c.id}>
                <ContextMenuTrigger asChild>
                  {renamingId === c.id ? (
                    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px]">
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={confirmRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void confirmRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="min-w-0 flex-1 rounded bg-background px-1 py-0.5 text-[12.5px] text-foreground outline-none ring-1 ring-ring"
                      />
                    </div>
                  ) : (
                    <Link
                      to="/chat/$id"
                      params={{ id: c.id }}
                      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors hover:bg-sidebar-accent ${
                        pathname === `/chat/${c.id}` ? "bg-sidebar-accent text-foreground" : "text-text-muted"
                      }`}
                    >
                      <MessageSquareText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </Link>
                  )}
                </ContextMenuTrigger>
                <ContextMenuContent className="w-48">
                  <ContextMenuItem onClick={() => startRename(c)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Rename
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => void deleteChat(c.id)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <div className="my-2 h-px bg-divider" />
          <NavSection items={SECONDARY_NAV} pathname={pathname} />
          <div className="mt-auto">
            <div className="elev-1 flex items-center gap-2 rounded-xl border border-border/60 bg-elevated/70 p-2">
              <div className="elev-1 grid h-8 w-8 shrink-0 place-items-center rounded-full forge-gradient-bg text-[12px] font-semibold text-white">
                {(email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-foreground">{email || "Loading..."}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted">Forge account</div>
              </div>
              <button onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-text-muted hover:bg-muted hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-background/60 px-5 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[13px] text-text-muted md:hidden">
            <ForgeLockup size={28} />
          </div>
          <div className="ml-auto flex items-center gap-2">{topRight}</div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ items, pathname, onChat }: { items: NavItem[]; pathname: string; onChat?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        const Icon = item.icon;
        // For Chat button, only active when exactly on /chat, not on /chat/$id
        const isActive = !item.soon && (
          item.to === "/chat" ? pathname === "/chat" : pathname.startsWith(item.to)
        ) && item.to !== "/";

        if (item.to === "/chat" && onChat) {
          return (
            <button
              key={`${item.label}-${i}`}
              type="button"
              onClick={onChat}
              className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ease-out w-full text-left ${
                isActive
                  ? "text-foreground"
                  : "text-text-muted hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 -z-10 rounded-lg bg-sidebar-accent" />
              )}
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full forge-gradient-bg" />
              )}
              <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.soon && (
                <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                  Soon
                </span>
              )}
            </button>
          );
        }

        return (
          <Link
            key={`${item.label}-${i}`}
            to={item.to as never}
            className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-200 ease-out ${
              isActive
                ? "text-foreground"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            {isActive && (
              <span className="absolute inset-0 -z-10 rounded-lg bg-sidebar-accent" />
            )}
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full forge-gradient-bg" />
            )}
            <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            <span className="flex-1 truncate">{item.label}</span>
            {item.soon && (
              <span className="rounded-md border border-border/60 bg-background px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                Soon
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/bloomy/AppShell";
import { Plus, FolderGit2, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — Forge" }] }),
  component: ProjectsPage,
});

type Project = { id: string; name: string; description: string | null; accent: string; updated_at: string };

const ACCENTS: { id: string; cls: string }[] = [
  { id: "bloom", cls: "forge-gradient-bg" },
  { id: "pink", cls: "bg-forge-orange" },
  { id: "violet", cls: "bg-forge-orange" },
  { id: "indigo", cls: "bg-forge-orange" },
];

function ProjectsPage() {
  const [items, setItems] = useState<Project[] | null>(null);
  const [editing, setEditing] = useState<Project | "new" | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data, error } = await supabase.from("projects").select("id,name,description,accent,updated_at").order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
  }

  async function remove(id: string) {
    const prev = items;
    setItems((items ?? []).filter((p) => p.id !== id));
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { setItems(prev); toast.error(error.message); }
  }

  return (
    <AppShell
      topRight={
        <button onClick={() => setEditing("new")} className="elev-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95">
          <Plus className="h-3.5 w-3.5" /> New project
        </button>
      }
    >
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-14">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-text-muted">Workspaces</p>
          <h1 className="font-display mt-2 text-[40px] leading-[1.05] tracking-tight md:text-[52px]">
            <span className="forge-gradient-text">Projects</span>.
          </h1>
        </div>

        <div className="mt-10">
          {items === null ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-text-muted" /></div>
          ) : items.length === 0 ? (
            <button onClick={() => setEditing("new")} className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-elevated/40 p-12 text-text-muted transition-colors hover:border-foreground/30 hover:text-foreground">
              <FolderGit2 className="h-6 w-6 text-forge-orange" />
              <div className="font-display text-xl">Create your first project</div>
              <p className="text-[13px]">Organise chats and agents around a goal.</p>
            </button>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((p) => {
                const accent = ACCENTS.find((a) => a.id === p.accent) ?? ACCENTS[0];
                return (
                  <div key={p.id} className="elev-1 group relative overflow-hidden rounded-2xl border border-border/60 bg-elevated/80 p-6 transition-all hover:-translate-y-0.5 hover:elev-2">
                    <div className={`absolute -right-16 -top-16 h-40 w-40 rounded-full ${accent.cls} opacity-30 blur-2xl`} />
                    <div className="relative flex items-start justify-between">
                      <div className="elev-1 grid h-11 w-11 place-items-center rounded-xl bg-background">
                        <FolderGit2 className="h-5 w-5 text-foreground" />
                      </div>
                      <button onClick={() => remove(p.id)} className="rounded-md p-1 text-text-muted opacity-0 transition-all hover:text-destructive group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button onClick={() => setEditing(p)} className="relative mt-4 block text-left">
                      <div className="font-display text-2xl text-foreground">{p.name}</div>
                      {p.description && <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{p.description}</p>}
                    </button>
                    <div className="relative mt-4 text-[11px] text-text-muted">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {editing && <ProjectEditor project={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />}
    </AppShell>
  );
}

function ProjectEditor({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [accent, setAccent] = useState(project?.accent ?? "bloom");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      if (project) {
        const { error } = await supabase.from("projects").update({ name, description, accent }).eq("id", project.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert({ user_id: u.user.id, name, description, accent });
        if (error) throw error;
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="elev-3 w-full max-w-md rounded-2xl border border-border bg-elevated p-6">
        <div className="flex items-center justify-between">
          <div className="font-display text-2xl">{project ? "Edit project" : "New project"}</div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-text-muted hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="forge-input mt-1.5" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="forge-input mt-1.5 resize-y" />
          </label>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Accent</span>
            <div className="mt-1.5 flex gap-2">
              {ACCENTS.map((a) => (
                <button type="button" key={a.id} onClick={() => setAccent(a.id)} className={`h-9 w-9 rounded-full ${a.cls} transition-all ${accent === a.id ? "ring-2 ring-foreground/60 ring-offset-2 ring-offset-elevated" : ""}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
          <button type="submit" disabled={busy} className="elev-1 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60">
            {busy && <Loader2 className="h-3 w-3 animate-spin" />} {project ? "Save" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
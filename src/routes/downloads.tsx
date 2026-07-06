import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bloomy/AppShell";
import { Apple, Monitor, Smartphone, Download, Check, Terminal, Chrome, FileArchive, Clock } from "lucide-react";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/downloads")({
  head: () => ({
    meta: [
      { title: "Downloads — Forge" },
      { name: "description", content: "Get Forge for macOS, Windows, Linux, iOS, Android and the web." },
    ],
  }),
  component: DownloadsPage,
});

const PLATFORMS = [
  { name: "macOS", subtitle: "Universal · Apple Silicon & Intel", icon: Apple, primary: true, version: "1.0.4" },
  { name: "Windows", subtitle: "Windows 11 · 64-bit", icon: Monitor, primary: false, version: "1.0.4" },
  { name: "Linux", subtitle: "AppImage · deb · rpm", icon: Terminal, primary: false, version: "1.0.4" },
  { name: "iOS", subtitle: "iPhone & iPad · iOS 17+", icon: Smartphone, primary: false, version: "1.0.2" },
  { name: "Android", subtitle: "Android 12+", icon: Smartphone, primary: false, version: "1.0.2" },
  { name: "Web", subtitle: "Any modern browser", icon: Chrome, primary: false, version: "Always latest" },
];

function DownloadsPage() {
  const [aiFiles, setAiFiles] = useState<Array<{name: string, url: string, size: number, created: number}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/downloads/list")
      .then(res => res.json())
      .then(data => {
        setAiFiles(data.files || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load downloads:", err);
        setLoading(false);
      });
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-16">
        <div className="text-center">
          <p className="text-[12px] uppercase tracking-[0.18em] text-text-muted">Forge 1.0.4 — Spring release</p>
          <h1 className="font-display mt-3 text-[44px] leading-[1.02] tracking-tight md:text-[64px]">
            Take Forge <span className="forge-gradient-text">everywhere</span>.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-text-muted">
            Native, fast and quietly powerful. Sign in once and your work follows you across every surface.
          </p>
        </div>

        {/* AI-Generated Downloads Section */}
        {aiFiles.length > 0 && (
          <div className="elev-1 mt-10 rounded-2xl border border-border/60 bg-elevated/70 p-6">
            <div className="font-display text-xl">AI-Generated Files</div>
            <p className="mt-2 text-sm text-text-muted">Files created by Forge AI agents for you to download.</p>
            <div className="mt-4 space-y-3">
              {aiFiles.map((file) => (
                <div key={file.name} className="elev-1 flex items-center justify-between rounded-xl border border-border/40 bg-background p-4">
                  <div className="flex items-center gap-3">
                    <div className="elev-1 grid h-10 w-10 place-items-center rounded-lg bg-primary/10">
                      <FileArchive className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{file.name}</div>
                      <div className="flex items-center gap-3 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(file.created)}
                        </span>
                        <span>{formatSize(file.size)}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={file.url}
                    download
                    className="elev-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.99] bg-primary text-primary-foreground hover:opacity-95"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.name} className={`elev-1 group relative overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:elev-2 ${p.primary ? "border-foreground/20 bg-elevated" : "border-border/60 bg-elevated/70"}`}>
                {p.primary && (
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full forge-gradient-bg opacity-20 blur-2xl" />
                )}
                <div className="relative flex items-center gap-3">
                  <div className="elev-1 grid h-11 w-11 place-items-center rounded-xl bg-background">
                    <Icon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-xl">{p.name}</div>
                    <p className="truncate text-[12px] text-text-muted">{p.subtitle}</p>
                  </div>
                </div>
                <div className="relative mt-5 flex items-center justify-between">
                  <span className="text-[11px] text-text-muted">v{p.version}</span>
                  <a 
                    href={`https://github.com/0vqxx/ForgeAI/releases/download/v${p.version}/forge-${p.name.toLowerCase()}-${p.version}.zip`}
                    download
                    className={`elev-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.99] ${p.primary ? "bg-primary text-primary-foreground hover:opacity-95" : "bg-background text-foreground hover:bg-muted"}`}
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="elev-1 mt-10 rounded-2xl border border-border/60 bg-elevated/70 p-6">
          <div className="font-display text-xl">What's new in 1.0.4</div>
          <ul className="mt-4 space-y-2 text-sm text-text-muted">
            {[
              "Calmer streaming with a soft typing caret.",
              "Agents can now share memory across projects.",
              "Faster cold start on macOS and Windows.",
              "New keyboard-first command palette (⌘K).",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/bloomy/AppShell";
import { Monitor, Apple, Terminal, Download, Check } from "lucide-react";
import { ForgeMark } from "@/components/bloomy/Logo";

export const Route = createFileRoute("/forgeide")({
  head: () => ({
    meta: [
      { title: "ForgeIDE — Downloads" },
      { name: "description", content: "Download ForgeIDE: The premium, local-first AI code editor for Windows, macOS, and Linux." },
    ],
  }),
  component: ForgeIDEDownloadsPage,
});

const PLATFORMS = [
  { 
    name: "Windows", 
    subtitle: "Windows 10 / 11 · 64-bit", 
    icon: Monitor, 
    primary: true, 
    version: "1.0.0",
    link: "https://github.com/0vqxx/forgeide1/releases/latest"
  },
  { 
    name: "macOS", 
    subtitle: "Apple Silicon & Intel", 
    icon: Apple, 
    primary: false, 
    version: "1.0.0",
    link: "https://github.com/0vqxx/forgeide1/releases/latest"
  },
  { 
    name: "Linux", 
    subtitle: "AppImage · deb · rpm", 
    icon: Terminal, 
    primary: false, 
    version: "1.0.0",
    link: "https://github.com/0vqxx/forgeide1/releases/latest"
  },
];

function ForgeIDEDownloadsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10 md:px-10 md:py-16">
        <div className="text-center">
          <div className="mx-auto flex justify-center mb-6">
            <div className="elev-1 flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated border border-border/60">
              <ForgeMark size={32} />
            </div>
          </div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-text-muted">ForgeIDE 1.0.0</p>
          <h1 className="font-display mt-3 text-[44px] leading-[1.02] tracking-tight md:text-[64px]">
            The AI Editor, <span className="forge-gradient-text">forged</span> locally.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-text-muted">
            Native, blisteringly fast, and quietly powerful. Download the open-source ForgeIDE for your OS and elevate your workflow.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <a href={p.link} target="_blank" rel="noopener noreferrer" key={p.name} className={`elev-1 group relative overflow-hidden rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:elev-2 block ${p.primary ? "border-foreground/20 bg-elevated" : "border-border/60 bg-elevated/70"}`}>
                {p.primary && (
                    <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full forge-gradient-bg opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-30" />
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
                  <div className={`elev-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.99] ${p.primary ? "bg-primary text-primary-foreground hover:opacity-95" : "bg-background text-foreground group-hover:bg-muted"}`}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="elev-1 mt-10 rounded-2xl border border-border/60 bg-elevated/70 p-6">
          <div className="font-display text-xl">What's new in 1.0.0</div>
          <ul className="mt-4 space-y-2 text-sm text-text-muted">
            {[
              "First stable release for Windows with custom installer and icon.",
              "Integrated local terminal with smooth, tear-free WebGL rendering.",
              "Automatic WebSocket fallback for systems without native PTY support.",
              "Fixed visual flickering and layout loops in the UI grid.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 text-success shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

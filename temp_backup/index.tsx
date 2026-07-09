import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles, Command } from "lucide-react";
import { ForgeLockup, ForgeMark } from "@/components/bloomy/Logo";
import { AmbientBackground } from "@/components/bloomy/AmbientBackground";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Forge — Intelligence, forged." },
      { name: "description", content: "Forge is a premium AI platform for thinking, building, and shipping — chat, agents, editor, and workspaces in one elegant surface." },
      { property: "og:title", content: "Forge — Intelligence, forged." },
      { property: "og:description", content: "A premium AI platform for thinking, building, and shipping." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientBackground />

      {/* Nav */}
      <header className="sticky top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
        <ForgeLockup />
        <nav className="hidden items-center gap-7 text-sm text-text-muted md:flex">
          {["Product", "Agents", "Pricing", "Docs"].map((l) => (
            <a key={l} href="#" className="relative transition-colors hover:text-foreground">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden rounded-full px-3 py-1.5 text-sm text-text-muted transition-colors hover:text-foreground sm:inline-flex">Sign in</Link>
          <Link to="/auth" className="elev-1 group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-95 active:scale-[0.99]">
            Open app
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-12 md:px-10 md:pb-32 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="elev-1 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/80 px-3 py-1 text-[12px] font-medium text-text-muted">
            <Sparkles className="h-3 w-3 text-orange-500" />
            Forge 1.0 — now in private beta
          </span>

          <h1 className="font-display mt-7 text-[44px] leading-[1.02] tracking-tight text-foreground sm:text-[64px] md:text-[88px]">
            Intelligence,
            <br />
            <span className="forge-gradient-text">forged.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-text-muted sm:text-lg">
            A quiet, considered AI workspace. Chat, agents, editor, and
            workspaces — held together by a single, premium surface.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth" className="elev-2 group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-95 active:scale-[0.99]">
              Start chatting
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <button className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated/60 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-xl transition-all hover:bg-elevated">
              <Command className="h-3.5 w-3.5" />
              <span>Press <kbd className="font-sans">⌘K</kbd> anywhere</span>
            </button>
          </div>
        </div>

        {/* Product preview */}
        <div className="relative mx-auto mt-20 max-w-5xl">
          <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[40px] forge-gradient-bg opacity-25 blur-3xl" />
          <div className="elev-3 overflow-hidden rounded-3xl border border-border/60 bg-elevated/80 backdrop-blur-xl">
            <div className="flex items-center gap-1.5 border-b border-divider px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.85_0.13_25)]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.86_0.14_85)]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.82_0.15_150)]/70" />
              <div className="mx-auto flex items-center gap-2 text-[12px] text-text-muted">
                <ForgeMark size={18} /> forge.ai / chat
              </div>
            </div>
            <div className="grid grid-cols-12 gap-0">
              <div className="col-span-3 hidden border-r border-divider bg-sidebar/60 p-4 md:block">
                {["New chat", "Marketing ideas", "Refactor planner", "Trip to Kyoto", "Q3 roadmap"].map((t, i) => (
                  <div key={t} className={`mb-1 rounded-lg px-2.5 py-2 text-[12.5px] ${i === 1 ? "bg-sidebar-accent text-foreground" : "text-text-muted"}`}>{t}</div>
                ))}
              </div>
              <div className="col-span-12 p-6 md:col-span-9 md:p-8">
                <div className="space-y-5">
                  <Bubble role="user">Draft a launch note for our spring release.</Bubble>
                  <Bubble role="assistant">
                    <span className="font-display text-[17px]">Spring, gently.</span>
                    <br />
                    We've quietly rebuilt Forge from the ground up. New
                    agents, a calmer editor, and a chat that finally feels like
                    yours…
                  </Bubble>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 pb-32 md:px-10">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border/60 bg-divider md:grid-cols-3">
          {[
            { title: "Chat", body: "Streaming responses, beautiful markdown, ambient typing." },
            { title: "Agents", body: "Compose tools, memory and prompts into reliable workflows." },
            { title: "Editor", body: "Inline AI, ghost text, diff review — a writer's IDE." },
          ].map((f) => (
            <div key={f.title} className="bg-elevated p-8">
              <div className="font-display text-2xl text-foreground">{f.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-divider bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-[12px] text-text-muted md:px-10">
          <ForgeLockup size={24} />
          <div className="flex items-center gap-4">
            <Link to="/forgeide" className="transition-colors hover:text-foreground">Download ForgeIDE</Link>
            <span>© 2026 Forge. Made with care.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="elev-1 max-w-md rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <div className="elev-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-elevated">
        <ForgeMark size={16} />
      </div>
      <div className="max-w-xl pt-1 text-sm leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

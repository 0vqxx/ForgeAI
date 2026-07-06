import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/bloomy/AmbientBackground";
import { ForgeLockup } from "@/components/bloomy/Logo";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Forge" },
      { name: "description", content: "Sign in or create your Forge account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // bounce if already signed in
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: "/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate({ to: "/dashboard" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        toast.success("Welcome to Forge.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        // Redirect to a dedicated callback route for Google OAuth.
        // Ensure this URL is added to Supabase allowed redirect URLs.
        options: { 
          redirectTo: import.meta.env.VITE_GOOGLE_REDIRECT_URI || 
                    `${window.location.origin}/api/auth/callback/google` 
        },
      });
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscord() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        // Redirect to a dedicated callback route for Discord OAuth.
        // Ensure this URL is added to Supabase allowed redirect URLs.
        options: { 
          redirectTo: import.meta.env.VITE_DISCORD_REDIRECT_URI || 
                    `${window.location.origin}/api/auth/callback/discord` 
        },
      });
      if (error) toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <AmbientBackground />
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><ForgeLockup /></div>

        <h1 className="font-display mt-8 text-center text-[34px] leading-tight tracking-tight">
          {mode === "signin" ? "Welcome back." : "Make it yours."}
        </h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          {mode === "signin" ? "Sign in to your Forge workspace." : "Create a Forge account in seconds."}
        </p>

        <div className="elev-2 mt-8 rounded-2xl border border-border/60 bg-elevated/90 p-5 backdrop-blur-xl">
          <div className="space-y-2">
            <button
              onClick={handleGoogle}
              disabled={busy}
              className="elev-1 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-60"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <button
              onClick={handleDiscord}
              disabled={busy}
              className="elev-1 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:opacity-60"
            >
              <DiscordIcon /> Continue with Discord
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <span className="h-px flex-1 bg-divider" /> or <span className="h-px flex-1 bg-divider" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@forge.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="elev-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-forge-orange/30"
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="elev-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition-all focus:border-foreground/40 focus:ring-2 focus:ring-forge-orange/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="elev-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:opacity-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight className="h-3.5 w-3.5" /></>}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] text-text-muted">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 11v3.2h5.3c-.2 1.4-1.6 4-5.3 4-3.2 0-5.8-2.6-5.8-5.9S8.8 6.4 12 6.4c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.9 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.1-1.3H12z" />
    </svg>
  );
}
function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.27 5.33A18 18 0 0 0 14.92 4l-.2.4a16.5 16.5 0 0 0-5.44 0L9.08 4a18 18 0 0 0-4.35 1.34A19 19 0 0 0 2 14.5a18 18 0 0 0 5.4 2.74l.43-.6a13 13 0 0 1-2-1 .15.15 0 0 1 .02-.24c.13-.1.27-.2.4-.3a13 13 0 0 0 11.5 0c.13.1.26.2.4.3a.15.15 0 0 1 .01.24c-.62.36-1.29.69-2 1l.43.6A18 18 0 0 0 22 14.5a19 19 0 0 0-2.73-9.17ZM9.34 13.45c-.85 0-1.55-.79-1.55-1.76 0-.97.69-1.76 1.55-1.76.87 0 1.56.8 1.55 1.76 0 .97-.69 1.76-1.55 1.76Zm5.32 0c-.86 0-1.55-.79-1.55-1.76 0-.97.69-1.76 1.55-1.76.87 0 1.56.8 1.55 1.76 0 .97-.68 1.76-1.55 1.76Z" />
    </svg>
  );
}

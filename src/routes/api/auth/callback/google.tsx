import { useEffect, useState } from "react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Callback route for Google OAuth.
 * Supabase redirects here with a `code` query param (PKCE flow).
 * We exchange the code for a session, then forward to the dashboard.
 */
export const Route = createFileRoute("/api/auth/callback/google")({
  component: () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      async function handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error("[Google OAuth] Failed to exchange code:", exchangeError.message);
            setError(exchangeError.message);
            return;
          }
        }

        navigate({ to: "/dashboard", replace: true });
      }

      handleCallback();
    }, [navigate]);

    if (error) {
      return (
        <div className="grid min-h-dvh place-items-center text-center px-4">
          <div>
            <p className="text-sm text-red-500 mb-4">Sign-in failed: {error}</p>
            <a href="/auth" className="text-sm underline text-foreground">Back to sign in</a>
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { AmbientBackground } from "@/components/bloomy/AmbientBackground";
import { ForgeLockup } from "@/components/bloomy/Logo";

export const Route = createFileRoute("/auth/sso-callback")({
  component: SSOCallbackPage,
});

function SSOCallbackPage() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <AmbientBackground />
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><ForgeLockup /></div>
        <h1 className="font-display mt-8 text-center text-[34px] leading-tight tracking-tight">
          Authenticating...
        </h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          Please wait while we complete your sign in.
        </p>
        <div className="elev-2 mt-8 rounded-2xl border border-border/60 bg-elevated/90 p-5 backdrop-blur-xl flex justify-center">
          <AuthenticateWithRedirectCallback />
        </div>
      </div>
    </div>
  );
}

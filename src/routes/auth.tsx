import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { AmbientBackground } from "@/components/bloomy/AmbientBackground";
import { ForgeLockup } from "@/components/bloomy/Logo";
import { SignIn } from "@clerk/tanstack-react-start";

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
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) navigate({ to: "/dashboard", replace: true });
  }, [isSignedIn, navigate]);

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <AmbientBackground />
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><ForgeLockup /></div>
        <h1 className="font-display mt-8 text-center text-[34px] leading-tight tracking-tight">
          Welcome back.
        </h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          Sign in to your Forge workspace.
        </p>
        <div className="elev-2 mt-8 rounded-2xl border border-border/60 bg-elevated/90 p-5 backdrop-blur-xl">
          <SignIn signUpUrl="/sign-up" />
        </div>
      </div>
    </div>
  );
}

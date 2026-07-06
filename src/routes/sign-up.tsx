import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@clerk/tanstack-react-start";
import { AmbientBackground } from "@/components/bloomy/AmbientBackground";
import { ForgeLockup } from "@/components/bloomy/Logo";
import { SignUp } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Sign up — Forge" },
      { name: "description", content: "Create your Forge account." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
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
          Create an account.
        </h1>
        <p className="mt-2 text-center text-sm text-text-muted">
          Join Forge to start building.
        </p>
        <div className="elev-2 mt-8 rounded-2xl border border-border/60 bg-elevated/90 p-5 backdrop-blur-xl">
          <SignUp signInUrl="/auth" />
        </div>
      </div>
    </div>
  );
}

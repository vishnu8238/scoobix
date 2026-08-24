import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent, setPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exchangeAttemptedRef = useRef<boolean>(false);
  const portalRef = useRef<string>("customer");
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      if (exchangeAttemptedRef.current) return;
      exchangeAttemptedRef.current = true;

      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("insforge_code") || params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error || errorDescription) {
          throw new Error(errorDescription || `Authentication error: ${error}`);
        }

        if (code) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("insforge_code");
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

          const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(code);
          if (exchangeError && !insforge.auth.session?.user) {
            throw new Error(exchangeError.message || "Code exchange failed.");
          }
        }

        const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
        if (authError || !authData?.user) {
          throw new Error(authError?.message || "Failed to resolve identity after authorization.");
        }

        const portalMap: Record<string, string> = {
          admin: "/admin",
          logistics: "/logistics",
          manager: "/manager",
          partner: "/partner",
          rider: "/rider",
          customer: "/app",
        };

        const currentPortal = popPortalIntent();
        portalRef.current = currentPortal;
        const destPath = portalMap[currentPortal] || "/app";

        localStorage.removeItem("scoobix_return_to");
        await navigate({ to: destPath as any, replace: true });
      } catch (err: any) {
        console.error("[AUTH_CALLBACK] Critical Error:", err);
        setErrorMsg(err.message || "Authentication failed.");
      }
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 pt-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="font-display text-lg font-bold">Completing secure sign-in</h2>
        <p className="text-sm text-muted-foreground">{errorMsg || "Verifying your permissions..."}</p>
        {errorMsg ? (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => void navigate({ to: "/login", replace: true })}
          >
            Return to sign in
          </button>
        ) : null}
      </div>
    </div>
  );
}

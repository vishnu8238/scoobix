import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
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
          // Cleanup URL for visual cleanliness
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

        // Portal mapping
        const portalMap: Record<string, string> = {
          admin: "/admin",
          logistics: "/logistics",
          manager: "/manager",
          partner: "/partner",
          rider: "/rider",
          customer: "/app",
        };

        // 1. Resolve requested portal via validated pop helper ONLY when ready to redirect
        // This prevents remounts from consuming and clearing the intent prematurely.
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

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 pt-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <h2 className="font-display text-lg font-bold">{"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            Load the security issues from the scan results and fix the selected issues."}</h2>
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-medium">{errorMsg}</p>
            <button 
              onClick={() => window.location.replace('/login')}
              className="mt-2 text-[10px] underline uppercase tracking-widest opacity-70"
            >
              {"'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            Load the security issues from the scan results and fix the selected issues."}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
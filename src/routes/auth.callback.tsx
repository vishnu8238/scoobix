import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent, setPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

/**
 * P0.1: Authoritative OAuth Callback Handler
 * Handles single code exchange and deterministic portal redirection.
 */
function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const exchangeAttemptedRef = useRef<boolean>(false);
  const portalRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Preserve portal intent in closure for this mount
    if (!portalRef.current) {
      portalRef.current = popPortalIntent();
      // Re-persist briefly for hydration stability
      if (portalRef.current) setPortalIntent(portalRef.current);
    }
    
    const portal = portalRef.current || "customer";

    const handleCallback = async () => {
      // P0.1: Idempotency guard for code exchange
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
          console.log("[AUTH_CALLBACK] Exchanging code for session...");
          
          // Cleanup URL immediately to prevent multi-exchange if user refreshes
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("insforge_code");
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

          // P0.1 Correction: Official InsForge SDK method is exchangeOAuthCode
          const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(code);
          if (exchangeError) {
            // Check if SDK already resolved it in background (race condition with singleton)
            if (!insforge.auth.session?.user) {
              throw new Error(exchangeError.message || "Code exchange failed.");
            }
          }
        }

        // 2. Deterministic session resolution via SDK identity check
        // After exchange, we resolve the principal immediately from the SDK
        console.log("[AUTH_CALLBACK] Resolving identity from SDK...");
        const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
        
        if (authError || !authData?.user) {
          throw new Error(authError?.message || "Failed to resolve identity after authorization.");
        }

        const user = authData.user;

        // 3. Deterministic portal mapping
        const portalMap: Record<string, string> = {
          admin: "/admin",
          logistics: "/logistics",
          manager: "/manager",
          partner: "/partner",
          rider: "/rider",
          customer: "/app",
        };

        const destPath = portalMap[portal] || "/app";
        const dest = new URL(destPath, window.location.origin).href;

        // Cleanup storage
        localStorage.removeItem("scoobix_oauth_portal_intent");
        localStorage.removeItem("scoobix_return_to");

        console.log(`[AUTH_CALLBACK] Authorized user ${user.id}. Redirecting to ${destPath}`);
        window.location.replace(dest);

      } catch (err: any) {
        console.error("[AUTH_CALLBACK] Critical Error:", err);
        setErrorMsg(err.message || "Authentication failed.");
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 pt-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <h2 className="font-display text-lg font-bold">Verifying identity...</h2>
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-medium">{errorMsg}</p>
            <button 
              onClick={() => window.location.replace('/login')}
              className="mt-2 text-[10px] underline uppercase tracking-widest opacity-70"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exchangeAttempted, setExchangeAttempted] = useState(false);

  useEffect(() => {
    const portal = popPortalIntent();
    console.log("[APPLE_DEBUG] [AUTH] Callback portal intent recovered:", portal);

    const checkAuth = async () => {
      if (exchangeAttempted) return;
      
      console.log("[APPLE_DEBUG] [AUTH] Starting session check...");
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");

      // APPLE OAUTH FIX: The SDK looks for 'insforge_code', but Apple returns 'code'.
      // We manually perform the exchange if 'code' is present.
      if (code) {
        console.log("[APPLE_DEBUG] [AUTH] Found standard OAuth 'code' parameter, attempting manual exchange.");
        setExchangeAttempted(true);
        
        try {
          const pkceVerifier = sessionStorage.getItem("insforge_pkce_verifier");
          if (!pkceVerifier) {
            console.error("[APPLE_DEBUG] [AUTH] Missing PKCE verifier in sessionStorage");
            setErrorMsg("Authentication failed: Missing PKCE verifier. Please try logging in again.");
            return;
          }

          // Use the internal exchange method.
          console.log("[APPLE_DEBUG] [AUTH] Calling exchangeOAuthCode with verifier...");
          
          // @ts-ignore - accessing public exchange method
          const { error: exchangeError } = await (insforge.auth as any).exchangeOAuthCode(code, pkceVerifier);

          if (exchangeError) {
            console.error("[APPLE_DEBUG] [AUTH] Exchange error:", exchangeError.message);
            setErrorMsg(`Login failed: ${exchangeError.message}`);
            return;
          }

          console.log("[APPLE_DEBUG] [AUTH] Exchange successful.");
          // Clean the URL code param to prevent reuse on refresh
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err: any) {
          console.error("[APPLE_DEBUG] [AUTH] Unexpected exchange crash:", err);
          setErrorMsg("An unexpected error occurred during login.");
          return;
        }
      }

      // Proceed to verify session
      const { data, error } = await insforge.auth.getCurrentUser();
      
      if (error) {
        console.error("[APPLE_DEBUG] [AUTH] Callback user check error:", error);
        if (!code) setErrorMsg(error.message);
        return;
      }

      if (data.user) {
        console.log("[APPLE_DEBUG] [AUTH] User verified, admitted to portal:", portal);
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        window.location.assign(dest);
      } else {
        console.log("[APPLE_DEBUG] [AUTH] No user session found after check.");
        if (code) {
          setErrorMsg("We couldn't establish a secure session. Please try again.");
        }
      }
    };

    checkAuth();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log("[APPLE_DEBUG] [AUTH] AUTH_STATE_CHANGE:", event);
      if (event === 'signedIn') {
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        window.location.assign(dest);
      }
    });

    return () => unsubscribe();
  }, [navigate, exchangeAttempted]);

  if (errorMsg) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold">Authentication failed</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">{errorMsg}</p>
        <button 
          onClick={() => navigate({ to: "/" as any })}
          className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Return to home
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
      <h2 className="font-display text-xl font-bold">Finishing login...</h2>
      <p className="text-sm text-muted-foreground mt-2">Almost there! We're setting up your session.</p>
    </div>
  );
}

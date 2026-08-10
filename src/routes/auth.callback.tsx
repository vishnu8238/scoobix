import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { insforge, INSFORGE_URL } from "@/lib/insforge";
import { popPortalIntent, getOAuthCallbackUrl } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exchangeAttempted, setExchangeAttempted] = useState(false);

  useEffect(() => {
    const portal = popPortalIntent();
    console.log("[APPLE_EXCHANGE_DEBUG] APPLE_CALLBACK_REACHED");
    console.log("[APPLE_EXCHANGE_DEBUG] PORTAL_INTENT:", portal);

    const checkAuth = async () => {
      if (exchangeAttempted) return;
      
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      console.log("[APPLE_EXCHANGE_DEBUG] APPLE_CODE_PRESENT:", !!code);

      if (code) {
        setExchangeAttempted(true);
        console.log("[APPLE_EXCHANGE_DEBUG] EXCHANGE_STARTED");
        
        try {
          const pkceVerifier = sessionStorage.getItem("insforge_pkce_verifier");
          console.log("[APPLE_EXCHANGE_DEBUG] PKCE_VERIFIER_PRESENT:", !!pkceVerifier);
          if (pkceVerifier) {
            console.log("[APPLE_EXCHANGE_DEBUG] PKCE_VERIFIER_LENGTH_VALID:", pkceVerifier.length >= 43);
          }

          if (!pkceVerifier) {
            console.error("[APPLE_EXCHANGE_DEBUG] PKCE_VERIFIER_MISSING");
            setErrorMsg("Authentication failed: Missing PKCE verifier. Please try logging in again.");
            return;
          }

          const redirectUri = getOAuthCallbackUrl();
          console.log("[APPLE_EXCHANGE_DEBUG] AUTH_REDIRECT_URI:", redirectUri);
          console.log("[APPLE_EXCHANGE_DEBUG] EXCHANGE_REDIRECT_URI:", redirectUri);
          
          // SDK v1.4.2 exchangeOAuthCode(code, codeVerifier) signature verified.
          // We manually perform the exchange to ensure redirect_uri parity and capture full response.
          console.log("[APPLE_EXCHANGE_DEBUG] EXCHANGE_REQUEST_SENT (Manual Fetch)");
          
          const exchangeBody = {
            code,
            code_verifier: pkceVerifier,
            redirect_uri: redirectUri
          };
          
          const response = await fetch(`${INSFORGE_URL}/api/auth/oauth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(exchangeBody)
          });

          console.log("[APPLE_EXCHANGE_DEBUG] EXCHANGE_HTTP_STATUS:", response.status);
          
          if (!response.ok) {
            const errText = await response.text();
            let errData = {};
            try { errData = JSON.parse(errText); } catch(e) {}
            console.error("[APPLE_EXCHANGE_DEBUG] EXCHANGE_RESPONSE_FAILURE:", errData || errText);
            setErrorMsg(`Login failed (HTTP ${response.status}): ${errData.message || errText || 'Unknown error'}`);
            return;
          }

          const sessionData = await response.json();
          console.log("[APPLE_EXCHANGE_DEBUG] EXCHANGE_RESPONSE_SUCCESS: true");
          
          // Manually persist session into SDK
          // @ts-ignore - accessing internal session persistence
          if (insforge.auth && typeof (insforge.auth as any).saveSessionFromResponse === 'function') {
             (insforge.auth as any).saveSessionFromResponse(sessionData);
          }

          console.log("[APPLE_EXCHANGE_DEBUG] SESSION_PRESENT_AFTER_EXCHANGE:", !!sessionData.access_token);
          console.log("[APPLE_EXCHANGE_DEBUG] ACCESS_TOKEN_PRESENT:", !!sessionData.access_token);
          console.log("[APPLE_EXCHANGE_DEBUG] REFRESH_TOKEN_PRESENT:", !!sessionData.refresh_token);

          // Clean the URL code param to prevent reuse
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err: any) {
          console.error("[APPLE_EXCHANGE_DEBUG] EXCHANGE_CRASH:", err);
          setErrorMsg("An unexpected error occurred during login.");
          return;
        }
      }

      const { data, error: authError } = await insforge.auth.getCurrentUser();
      if (authError) {
        console.error("[APPLE_EXCHANGE_DEBUG] AUTH_ERROR_AFTER_EXCHANGE:", (authError as any).message || authError);
      }

      console.log("[APPLE_EXCHANGE_DEBUG] AUTH_USER_PRESENT:", !!data.user);
      
      if (data.user) {
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        console.log("[APPLE_EXCHANGE_DEBUG] FINAL_NAVIGATION:", dest);
        window.location.assign(dest);
      } else if (code) {
        console.error("[APPLE_EXCHANGE_DEBUG] SESSION_RESTORE_FAILED");
        setErrorMsg("Session established but user profile could not be loaded.");
      }
    };

    checkAuth();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log("[APPLE_EXCHANGE_DEBUG] AUTH_STATE_CHANGED:", event);
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
          onClick={() => {
             // Use window.location.assign for a clean reload/redirect
             window.location.assign("/");
          }}
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

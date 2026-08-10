import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge, INSFORGE_URL } from "@/lib/insforge";
import { popPortalIntent, getOAuthCallbackUrl } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

const TIMEOUT_DURATION = 15000;

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exchangeAttempted, setExchangeAttempted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const portal = popPortalIntent();
    const timestamp = () => new Date().toISOString();
    
    console.log(`[APPLE_CALLBACK_START] ${timestamp()} - Portal Intent: ${portal}`);
    
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const checkAuth = async () => {
      if (exchangeAttempted) {
        console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - EXCHANGE_ATTEMPTS: 2 (Blocked)`);
        return;
      }
      
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      const insforgeCode = search.get("insforge_code");

      if (insforgeCode) {
        console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - SDK_AUTO_CALLBACK_DETECTED (insforge_code)`);
        // We let the SDK handle its own auto-exchange, but we still need to wait for it.
      }

      if (!code && !insforgeCode) {
        console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - NO_CODE_DETECTED`);
        return;
      }

      if (code) {
        console.log(`[APPLE_CODE_DETECTED] ${timestamp()}`);
        setExchangeAttempted(true);
        
        // Start timeout for the whole exchange process
        timeoutRef.current = setTimeout(() => {
          console.error(`[APPLE_CALLBACK_TIMEOUT] ${timestamp()} - Exchange/Session completion timed out after ${TIMEOUT_DURATION}ms`);
          setErrorMsg("Login timed out. Please try again.");
        }, TIMEOUT_DURATION);

        try {
          const pkceVerifier = sessionStorage.getItem("insforge_pkce_verifier");
          console.log(`[PKCE_DETECTED] ${timestamp()} - Present: ${!!pkceVerifier}`);
          
          if (!pkceVerifier) {
            cleanup();
            console.error(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - PKCE_VERIFIER_MISSING`);
            setErrorMsg("Authentication failed: Missing PKCE verifier. Please try logging in again.");
            return;
          }

          const redirectUri = getOAuthCallbackUrl();
          const expectedRedirectUri = `${window.location.origin}/auth/callback`;
          console.log(`[APPLE_EXCHANGE_DEBUG] AUTHORIZATION_REDIRECT_URI: ${redirectUri}`);
          console.log(`[APPLE_EXCHANGE_DEBUG] EXCHANGE_REDIRECT_URI: ${redirectUri}`);
          console.log(`[APPLE_EXCHANGE_DEBUG] REDIRECT_URI_EXACT_MATCH: ${redirectUri === expectedRedirectUri}`);
          
          console.log(`[EXCHANGE_START] ${timestamp()}`);
          console.log(`[EXCHANGE_REQUEST_SENT] ${timestamp()} - Manual Fetch to /api/auth/oauth/exchange`);
          
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

          console.log(`[EXCHANGE_RESPONSE_RECEIVED] ${timestamp()} - Status: ${response.status}`);
          
          if (!response.ok) {
            cleanup();
            const errText = await response.text();
            let errData: any = {};
            try { errData = JSON.parse(errText); } catch(e) {}
            console.error(`[EXCHANGE_FAILURE] ${timestamp()} - Status: ${response.status} - Error:`, errData || errText);
            setErrorMsg(`Login failed (HTTP ${response.status}): ${errData.message || errText || 'Unknown error'}`);
            return;
          }

          const sessionData = await response.json();
          console.log(`[EXCHANGE_SUCCESS] ${timestamp()}`);
          console.log(`[APPLE_EXCHANGE_DEBUG] ACCESS_TOKEN_PRESENT: ${!!(sessionData.access_token || sessionData.accessToken)}`);
          console.log(`[APPLE_EXCHANGE_DEBUG] REFRESH_TOKEN_PRESENT: ${!!(sessionData.refresh_token || sessionData.refreshToken)}`);
          
          console.log(`[SESSION_SAVE_START] ${timestamp()}`);
          
          const normalizedSession = {
            ...sessionData,
            accessToken: sessionData.access_token || sessionData.accessToken,
            refreshToken: sessionData.refresh_token || sessionData.refreshToken,
            user: sessionData.user
          };
          
          let saveSuccess = false;
          // @ts-ignore - accessing internal session persistence
          if (insforge.auth && typeof (insforge.auth as any).saveSessionFromResponse === 'function') {
             (insforge.auth as any).saveSessionFromResponse(normalizedSession);
             saveSuccess = true;
          }

          console.log(`[SESSION_SAVE_COMPLETE] ${timestamp()} - Success: ${saveSuccess}`);
          if (!saveSuccess) {
            cleanup();
            console.error(`[APPLE_EXCHANGE_DEBUG] SESSION_SAVE_FAILURE - Method not found`);
            setErrorMsg("Internal error: Could not save session.");
            return;
          }

          // Clean the URL code param to prevent reuse
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err: any) {
          cleanup();
          console.error(`[EXCHANGE_CRASH] ${timestamp()} - Error:`, err.message || err);
          setErrorMsg("An unexpected error occurred during login.");
          return;
        }
      }

      // 4. Verify Session/Identity
      try {
        console.log(`[GET_CURRENT_USER_START] ${timestamp()}`);
        const { data, error: authError } = await insforge.auth.getCurrentUser();
        console.log(`[GET_CURRENT_USER_COMPLETE] ${timestamp()} - User Present: ${!!data?.user}`);
        
        if (authError) {
          console.error(`[APPLE_EXCHANGE_DEBUG] GET_CURRENT_USER_FAILURE - Error:`, authError.message || authError);
        }

        if (!data?.user) {
          // If we had a code and exchanged it but still no user, it's a failure.
          if (code || insforgeCode) {
            cleanup();
            console.error(`[APPLE_EXCHANGE_DEBUG] SESSION_RESTORE_FAILED - No user data returned after exchange`);
            setErrorMsg("Session established but user profile could not be loaded.");
            return;
          }
          // Otherwise, maybe just a landing page refresh?
          return;
        }

        cleanup(); // Success, clear timeout
        console.log(`[IDENTITY_RESOLUTION_START] ${timestamp()}`);
        // Identity resolution happens in AuthProvider via resolveUser(), but we trigger navigation here.
        console.log(`[IDENTITY_RESOLUTION_COMPLETE] ${timestamp()} - Triggering destination resolution`);
        
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        console.log(`[PORTAL_NAVIGATION_START] ${timestamp()} - Destination: ${dest}`);
        window.location.assign(dest);
      } catch (err: any) {
        cleanup();
        console.error(`[APPLE_EXCHANGE_DEBUG] IDENTITY_RESOLUTION_CRASH:`, err.message || err);
        setErrorMsg("Failed to resolve user identity.");
      }
    };

    checkAuth();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log(`[APPLE_EXCHANGE_DEBUG] AUTH_STATE_CHANGED: ${event}`);
    });

    return () => {
      cleanup();
      unsubscribe();
    };
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
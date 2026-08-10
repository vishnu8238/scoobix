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

  useEffect(() => {
    const portal = popPortalIntent();
    console.log("[APPLE_DEBUG] [AUTH] Callback portal intent recovered:", portal);

    const checkAuth = async () => {
      console.log("[APPLE_DEBUG] [AUTH] Starting session check...");
      console.log("[APPLE_DEBUG] [AUTH] CALLBACK_URL:", window.location.href);
      console.log("[APPLE_DEBUG] [AUTH] CALLBACK_SEARCH_PARAMS:", window.location.search);
      console.log("[APPLE_DEBUG] [AUTH] CALLBACK_HASH_PARAMS:", window.location.hash);

      // Forensic: Try to detect Apple's post-redirect tokens in URL if SDK didn't pick them up
      const hash = window.location.hash;
      const search = window.location.search;
      console.log("[APPLE_DEBUG] [AUTH] AUTH_CODE_PRESENT:", search.includes("code=") || hash.includes("code="));
      console.log("[APPLE_DEBUG] [AUTH] ACCESS_TOKEN_PRESENT:", hash.includes("access_token="));
      console.log("[APPLE_DEBUG] [AUTH] REFRESH_TOKEN_PRESENT:", hash.includes("refresh_token="));

      const { data, error } = await insforge.auth.getCurrentUser();
      
      if (error) {
        console.error("[APPLE_DEBUG] [AUTH] Callback user error:", error);
        setErrorMsg(error.message);
        return;
      }

      console.log("[APPLE_DEBUG] [AUTH] USER_PRESENT:", !!data.user);
      console.log("[APPLE_DEBUG] [AUTH] SESSION_USER_ID:", data.user?.id);

      if (data.user) {
        console.log("[APPLE_DEBUG] [AUTH] Callback success, navigating to portal:", portal);
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        console.log("[APPLE_DEBUG] [AUTH] FINAL_NAVIGATION:", dest);
        window.location.assign(dest);
      } else {
        // If SDK didn't auto-resolve but tokens are in URL, we may need a manual sync
        console.log("[APPLE_DEBUG] [AUTH] No user found yet. Waiting for SDK to process URL tokens...");
      }
    };

    checkAuth();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      console.log("[APPLE_DEBUG] [AUTH] AUTH_STATE_CHANGE:", event);
      if (event === 'signedIn') {
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        console.log("[APPLE_DEBUG] [AUTH] Event signedIn, navigating:", dest);
        window.location.assign(dest);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

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

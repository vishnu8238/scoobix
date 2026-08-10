import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  validateSearch: (search: Record<string, unknown>) => ({
    portal: (search.portal as string) || "customer",
    error: search.error as string | undefined,
    error_description: search.error_description as string | undefined,
  }),
});

function AuthCallback() {
  const { portal, error: searchError, error_description } = useSearch({ from: "/auth/callback" });
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(searchError ? error_description || searchError : null);

  useEffect(() => {
    // If there's an error in the query params, stop here
    if (searchError) return;

    // The InsForge SDK's createClient handles the PKCE/Token exchange 
    // automatically by listening for hash params or query params if 
    // onAuthStateChange is active. 
    
    const checkAuth = async () => {
      const { data, error } = await insforge.auth.getSession();
      
      if (error) {
        console.error("[AUTH] Callback session error:", error);
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        console.log("[AUTH] Callback success, navigating to portal:", portal);
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        
        // Use a short delay or direct assignment to ensure state reflects
        window.location.assign(dest);
      } else {
        // If no session yet, we might still be in the middle of an exchange
        // or the SDK hasn't picked it up yet. 
        console.log("[AUTH] No session in callback yet...");
      }
    };

    checkAuth();

    // Listen for the SIGNED_IN event which happens after the exchange
    const { data: { subscription } } = insforge.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        window.location.assign(dest);
      }
    });

    return () => subscription.unsubscribe();
  }, [portal, searchError]);

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

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
    if (searchError) return;

    const checkAuth = async () => {
      const { data, error } = await insforge.auth.getCurrentUser();
      
      if (error) {
        console.error("[AUTH] Callback user error:", error);
        setErrorMsg(error.message);
        return;
      }

      if (data.user) {
        console.log("[AUTH] Callback success, navigating to portal:", portal);
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        window.location.assign(dest);
      }
    };

    checkAuth();

    const unsubscribe = insforge.auth.onAuthStateChange((event) => {
      if (event === 'signedIn') {
        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        window.location.assign(dest);
      }
    });

    return () => unsubscribe();
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

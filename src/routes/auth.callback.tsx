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
  const portalRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Prefer persisted portal intent
    let portal: string | null = popPortalIntent();
    
    // 2. Fallback to query param
    const params = new URLSearchParams(window.location.search);
    if (!portal) {
      portal = params.get("portal");
    }
    
    // 3. Last resort fallback
    portal = portal || "customer";
    
    portalRef.current = portal as string;



    const handleCallback = async () => {
      if (exchangeAttemptedRef.current) return;
      exchangeAttemptedRef.current = true;

      try {
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

        const destPath = portalMap[portal] || "/app";

        localStorage.removeItem("scoobix_oauth_portal_intent");
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
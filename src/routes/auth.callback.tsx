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
    
    const checkAuth = async () => {
      try {
        const { data, error } = await insforge.auth.getCurrentUser();
        
        if (error) {
          setErrorMsg(error.message || "Authentication failed.");
          return;
        }

        if (data?.user) {
          // Determine destination based on portal intent
          const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
          window.location.assign(dest);
        } else {
          // Polling for session
          const checkSession = setInterval(async () => {
            const { data: sessionData } = await insforge.auth.getCurrentUser();
            if (sessionData?.user) {
              clearInterval(checkSession);
              const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
              window.location.assign(dest);
            }
          }, 500);

          setTimeout(() => clearInterval(checkSession), 10000);
        }
      } catch (err: any) {
        console.error("Callback error:", err);
        setErrorMsg("An unexpected error occurred.");
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4">
      <div className="w-full max-w-md space-y-4 pt-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
        <h2 className="font-display text-lg font-bold">Finishing login...</h2>
        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-medium">{errorMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}

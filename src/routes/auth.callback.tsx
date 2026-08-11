import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent, setPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const portalRef = useRef<string | null>(null);

  useEffect(() => {
    // 1. Immediately extract and preserve the portal intent before any potential re-renders or navigation
    if (!portalRef.current) {
      portalRef.current = popPortalIntent();
      // Put it back in storage immediately so it survives a page refresh/reload during the exchange
      setPortalIntent(portalRef.current);
    }
    
    const portal = portalRef.current;
    console.log("[AUTH_DEBUG] auth.callback.tsx [CHECKPOINT: CALLBACK_MOUNTED] Portal:", portal);
    
    const checkAuth = async () => {
      try {
        console.log("[AUTH_DEBUG] auth.callback.tsx [CHECKPOINT: AUTH_CALLBACK_REACHED] Portal Intent:", portal);
        
        // Use a longer polling duration and more frequent checks for the initial session exchange
        let attempts = 0;
        const maxAttempts = 30; // 15 seconds total with 500ms intervals
        
        const checkSession = async () => {
          attempts++;
          console.log(`[AUTH_TRACE] auth.callback.tsx Polling attempt ${attempts}...`);
          
          const { data, error } = await insforge.auth.getCurrentUser();
          const authUser = data?.user;

          if (authUser) {
            console.log("[AUTH_TRACE] auth.callback.tsx [SESSION_FOUND] ID:", authUser.id);
            
            // Authorization Check
            if (portal === "admin" && authUser.email !== "scoobix.info@gmail.com") {
               console.error("[AUTH_TRACE] Admin unauthorized");
               window.location.assign("/admin/login?error=unauthorized");
               return true;
            }

            if (portal === "logistics") {
              const { listTable } = await import("@/lib/insforge-crud");
              try {
                const rows = await listTable("logistics_staff", { 
                  user_id: `eq.${authUser.id}`, 
                  limit: 1 
                }, { ttl: 0 }); 
                
                if (!rows.length) {
                  console.error("[AUTH_TRACE] Logistics unauthorized");
                  window.location.assign("/logistics/login?error=unauthorized");
                  return true;
                }
                console.log("[AUTH_TRACE] Logistics authorized");
              } catch (e) {
                console.error("[AUTH_TRACE] Logistics check failed:", e);
                // Continue to RoleGuard if DB is down but user exists
              }
            }

            const dest = portal === "customer" || !portal ? "/app" : (portal.startsWith("/") ? portal : `/${portal}`);
            console.log("[AUTH_TRACE] Redirecting to final destination:", dest);
            
            localStorage.removeItem("scoobix_oauth_portal_intent");
            window.location.assign(dest);
            return true;
          }

          if (attempts >= maxAttempts) {
            console.warn("[AUTH_TRACE] Callback timed out");
            setErrorMsg("Login timed out. Please try again.");
            return true;
          }
          
          return false;
        };

        // Start polling immediately
        const intervalId = setInterval(async () => {
          const shouldStop = await checkSession();
          if (shouldStop) clearInterval(intervalId);
        }, 500);

        // Run the first check immediately
        const firstCheck = await checkSession();
        if (firstCheck) clearInterval(intervalId);

      } catch (err: any) {
        console.error("[AUTH_DEBUG] auth.callback.tsx Unexpected Error:", err);
        setErrorMsg("An unexpected error occurred during the login callback.");
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

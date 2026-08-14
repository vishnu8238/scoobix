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
        
        // 1. Diagnostics only: check for insforge_code
        const params = new URLSearchParams(window.location.search);
        const insforgeCode = params.get("insforge_code") || params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        console.log("[AUTH_TRACE] Callback params detected:", { 
          hasCode: !!insforgeCode, 
          error: error || "none" 
        });

        if (error || errorDescription) {
          console.error("[AUTH_DEBUG] OAuth Error:", error, errorDescription);
          setErrorMsg(errorDescription || `Authentication error: ${error}`);
          return;
        }

        // 2. Explicitly exchange the code for a session if present
        if (insforgeCode) {
          console.log("[AUTH_TRACE] Exchanging authorization code for session...");
          // Clean the URL hash/query to prevent duplicate exchange on reload
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("insforge_code");
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

          const { data, error: exchangeError } = await insforge.auth.exchangeCodeForSession(insforgeCode);
          if (exchangeError) {
             console.error("[AUTH_TRACE] Code exchange failed:", exchangeError);
             // Verify if we actually have a session despite the error (e.g. concurrent exchange)
             const session = insforge.auth.getSession();
             if (!session?.user) {
               throw new Error(exchangeError.message || "Failed to exchange authorization code.");
             }
          } else if (data?.accessToken) {
            console.log("[AUTH_TRACE] Code exchange successful.");
          }
        }

        // 3. Wait for the SDK to process the callback and emit a user
        // We use a simple loop to wait for the user session to be established by the SDK automatically
        let retryCount = 0;
        const maxRetries = 30; // ~15 seconds total
        
        const waitForUser = async (): Promise<any> => {
          const { data: userData, error: userError } = await insforge.auth.getCurrentUser();
          const authUser = userData?.user;
          
          if (authUser && authUser.id && authUser.email) {
            return authUser;
          }
          
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
            return waitForUser();
          }
          
          throw new Error(userError?.message || "Authentication timed out. No session established.");
        };

        console.log("[AUTH_TRACE] Waiting for InsForge SDK to establish session...");
        const authUser = await waitForUser();

        console.log("[AUTH_TRACE] [SESSION_VERIFIED] ID:", authUser.id, "Email:", authUser.email);
        
        // 3. Authorization Check
        // We ALWAYS verify access against the portal_access table for privileged portals
        const privilegedPortals = ["logistics", "partner", "rider", "manager", "admin"];
        if (privilegedPortals.includes(portal || "")) {
          const { checkPortalAccess } = await import("@/lib/portal-authorization");
          
          let access;
          const userEmail = authUser.email?.toLowerCase().trim();
          const isSuperAdmin = userEmail === "scoobix.info@gmail.com";

          if (isSuperAdmin) {
            access = { ok: true, status: "active" };
          } else {
            access = await checkPortalAccess(userEmail, portal as any);
          }

          if (!access.ok) {
            const reason = access.reason;
            console.warn(`[AUTH_TRACE] ${portal} access denied:`, reason);
            
            if (reason === "lookup_failed") {
              setErrorMsg(`Unable to verify ${portal} access due to a database error. Please try again.`);
              return;
            }

            const errorParam = reason === "disabled" ? "disabled" : "denied";
            // Clean redirect to login with the error flag
            window.location.replace(`${window.location.origin}/login?portal=${portal}&${errorParam}=${portal}`);
            return;
          }
          
          console.log(`[AUTH_TRACE] ${portal} authorized`);
          const { recordPortalLogin } = await import("@/lib/portal-authorization");
          void recordPortalLogin(userEmail, portal as any);
        }



        // 4. Force a Store Hydration Check
        // Before redirecting, we must ensure the global AuthProvider has 
        // resolved the user and roles. We don't have direct access to the context here,
        // so we trust the destination portal's RoleGuard will pick up the session.
        // We use window.location.replace to ensure the callback page is removed from history.

        const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
        console.log("[AUTH_TRACE] Authorization complete. Redirecting to:", dest);
        
        // Remove callback from history and redirect
        // We use absolute URL to ensure we hit the portal guard correctly
        window.location.replace(new URL(dest, window.location.origin).href);
        
        // Remove portal intent only after successful redirect initiation
        setTimeout(() => localStorage.removeItem("scoobix_oauth_portal_intent"), 2000);

      } catch (err: any) {
        console.error("[AUTH_DEBUG] auth.callback.tsx Unexpected Error:", err);
        setErrorMsg(err.message || "An unexpected error occurred during the login callback.");
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

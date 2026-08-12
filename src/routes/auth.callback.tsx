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
        const insforgeCode = params.get("insforge_code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        console.log("[AUTH_TRACE] Callback params detected:", { 
          hasInsforgeCode: !!insforgeCode, 
          error: error || "none" 
        });

        if (error || errorDescription) {
          console.error("[AUTH_DEBUG] OAuth Error:", error, errorDescription);
          setErrorMsg(errorDescription || `Authentication error: ${error}`);
          return;
        }

        // 2. Wait for the SDK to process the callback and emit a user
        // We use a simple loop to wait for the user session to be established by the SDK automatically
        let retryCount = 0;
        const maxRetries = 20; // ~10 seconds total
        
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
        if (portal === "admin" && authUser.email !== "scoobix.info@gmail.com") {
          console.error("[AUTH_TRACE] Admin unauthorized");
          window.location.assign("/admin/login?error=unauthorized");
          return;
        }

        if (portal === "logistics" || portal === "partner" || portal === "rider" || portal === "manager") {
          const { checkPortalAccess } = await import("@/lib/portal-authorization");
          const access = await checkPortalAccess(authUser.email, portal as any);

          if (!access.ok && access.reason === "lookup_failed") {
            setErrorMsg(`Unable to verify ${portal} access. Please try again.`);
            return;
          }

          if (!access.ok) {
            const errorParam = access.reason === "disabled" ? "disabled" : "denied";
            // Do not redirect to Customer, keep them at the portal login with an error
            window.location.assign(`/${portal}/login?${errorParam}=${portal}`);
            return;
          }
          console.log(`[AUTH_TRACE] ${portal} authorized via portal_access`);
          // Record login timestamp
          const { recordPortalLogin } = await import("@/lib/portal-authorization");
          void recordPortalLogin(authUser.email, portal as any);
        }



        const dest = portal === "customer" || !portal ? "/app" : (portal.startsWith("/") ? portal : `/${portal}`);
        localStorage.removeItem("scoobix_oauth_portal_intent");
        console.log("[AUTH_TRACE] Redirecting to final destination:", dest);
        window.location.assign(dest);

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

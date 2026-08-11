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
        
        // 2. Extract OAuth code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (error || errorDescription) {
          console.error("[AUTH_DEBUG] OAuth Error:", error, errorDescription);
          setErrorMsg(errorDescription || `Authentication error: ${error}`);
          return;
        }

        if (!code) {
          console.error("[AUTH_DEBUG] No code found in URL search params");
          setErrorMsg("Google authentication callback did not contain an authorization code.");
          return;
        }

        // 3. Perform OAuth exchange
        console.log("[AUTH_TRACE] Exchanging OAuth code for session...");
        try {
          // @ts-ignore - Assuming exact method from SDK signature verification
          await insforge.auth.exchangeOAuthCode(code);
          console.log("[AUTH_TRACE] OAuth exchange successful");
        } catch (exchangeErr: any) {
          console.error("[AUTH_DEBUG] OAuth exchange failed:", exchangeErr);
          setErrorMsg("Unable to establish the Scoobix authentication session. Please try Google sign-in again.");
          return;
        }

        // 4. Verify the session and resolve the user
        const { data: userData, error: userError } = await insforge.auth.getCurrentUser();
        const authUser = userData?.user;

        if (userError || !authUser || !authUser.id || !authUser.email) {
          console.error("[AUTH_DEBUG] Session verification failed:", userError || "No user record returned");
          setErrorMsg("Unable to verify your authentication session. Please try again.");
          return;
        }

        console.log("[AUTH_TRACE] [SESSION_VERIFIED] ID:", authUser.id, "Email:", authUser.email);
        
        // 5. Authorization Check
        if (portal === "admin" && authUser.email !== "scoobix.info@gmail.com") {
          console.error("[AUTH_TRACE] Admin unauthorized");
          window.location.assign("/admin/login?error=unauthorized");
          return;
        }

        if (portal === "logistics") {
          const { listTable } = await import("@/lib/insforge-crud");
          try {
            // Determine admission based on email (authoritative staff list)
            const rows = await listTable("logistics_staff", { 
              email: `eq.${authUser.email}`, 
              limit: 1 
            }, { ttl: 0 }); 
            
            if (!rows.length) {
              console.error("[AUTH_TRACE] Logistics unauthorized (email check failed)");
              window.location.assign("/logistics/login?error=unauthorized");
              return;
            }
            console.log("[AUTH_TRACE] Logistics authorized (email check passed)");
          } catch (e) {
            console.error("[AUTH_TRACE] Logistics check failed:", e);
            setErrorMsg("Error verifying logistics authorization.");
            return;
          }
        }

        const dest = portal === "customer" || !portal ? "/app" : (portal.startsWith("/") ? portal : `/${portal}`);
        localStorage.removeItem("scoobix_oauth_portal_intent");
        console.log("[AUTH_TRACE] Redirecting to final destination:", dest);
        window.location.assign(dest);

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

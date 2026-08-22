import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge } from "@/lib/insforge";
import { popPortalIntent, setPortalIntent } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

type FinalBranch = "would_navigate" | "no_current_user" | "access_denied" | "exchange_error";
type ErrorCategory = "NETWORK_ERROR" | "AUTH_FAILED" | "CONFIG_ERROR" | "UNKNOWN";

interface DiagnosticData {
  codePresent: boolean;
  exchangeSucceeded: boolean;
  currentUserPresent: boolean;
  sdkSessionPresent: boolean;
  portalIntent: string;
  portalAccessResolved: boolean;
  requestedPortalAllowed: boolean;
  finalBranch: FinalBranch;
  errorCategory?: ErrorCategory;
}

function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const exchangeAttemptedRef = useRef<boolean>(false);
  const portalRef = useRef<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!portalRef.current) {
      portalRef.current = popPortalIntent();
      if (portalRef.current) setPortalIntent(portalRef.current);
    }
    
    const portal = portalRef.current || "customer";
    const params = new URLSearchParams(window.location.search);
    const isDebug = params.get("auth_debug") === "1";

    const handleCallback = async () => {
      if (exchangeAttemptedRef.current) return;
      exchangeAttemptedRef.current = true;

      const diag: Partial<DiagnosticData> = {
        portalIntent: portal,
        codePresent: false,
        exchangeSucceeded: false,
        currentUserPresent: false,
        sdkSessionPresent: false,
        portalAccessResolved: false,
        requestedPortalAllowed: false,
      };

      try {
        const code = params.get("insforge_code") || params.get("code");
        const error = params.get("error");
        const errorDescription = params.get("error_description");

        if (code) diag.codePresent = true;

        if (error || errorDescription) {
          diag.finalBranch = "exchange_error";
          diag.errorCategory = "AUTH_FAILED";
          if (isDebug) setDiagnostic(diag as DiagnosticData);
          throw new Error(errorDescription || `Authentication error: ${error}`);
        }

        if (code) {
          // Cleanup URL for visual cleanliness even in debug
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("insforge_code");
          cleanUrl.searchParams.delete("code");
          window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search);

          const { error: exchangeError } = await insforge.auth.exchangeOAuthCode(code);
          if (exchangeError && !insforge.auth.session?.user) {
            diag.finalBranch = "exchange_error";
            diag.errorCategory = "NETWORK_ERROR";
            if (isDebug) setDiagnostic(diag as DiagnosticData);
            throw new Error(exchangeError.message || "Code exchange failed.");
          }
          diag.exchangeSucceeded = true;
        }

        const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
        
        diag.sdkSessionPresent = !!insforge.auth.session;
        diag.currentUserPresent = !!authData?.user;

        if (authError || !authData?.user) {
          diag.finalBranch = "no_current_user";
          diag.errorCategory = "AUTH_FAILED";
          if (isDebug) setDiagnostic(diag as DiagnosticData);
          throw new Error(authError?.message || "Failed to resolve identity after authorization.");
        }

        const user = authData.user;
        
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
        
        // Membership resolution check (simulated from user metadata/roles which is where portalAccessResolved logic lives)
        diag.portalAccessResolved = !!(user as any).membershipsResolved;
        diag.requestedPortalAllowed = (user as any).roles?.includes(portal) || portal === "customer";
        
        if (!diag.requestedPortalAllowed && portal !== "customer") {
            diag.finalBranch = "access_denied";
        } else {
            diag.finalBranch = "would_navigate";
        }

        localStorage.removeItem("scoobix_oauth_portal_intent");
        localStorage.removeItem("scoobix_return_to");

        if (isDebug) {
          setDiagnostic(diag as DiagnosticData);
        } else {
          await navigate({ to: destPath as any, replace: true });
        }

      } catch (err: any) {
        console.error("[AUTH_CALLBACK] Critical Error:", err);
        setErrorMsg(err.message || "Authentication failed.");
      }
    };

    handleCallback();
  }, []);

  if (diagnostic) {
    return (
      <div className="flex min-h-svh flex-col items-center bg-background p-6 font-mono text-[10px] uppercase tracking-wider">
        <div className="w-full max-w-md space-y-6 pt-20 border border-border p-8 rounded-xl bg-card/50">
          <h2 className="text-sm font-bold text-primary mb-4 border-b border-border pb-2">Auth Diagnostic Mode</h2>
          <div className="space-y-2">
            {Object.entries(diagnostic).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
                <span className="text-muted-foreground">{key}</span>
                <span className={value === true || value === 'would_navigate' ? 'text-emerald-500 font-bold' : (value === false || ['access_denied', 'exchange_error', 'no_current_user'].includes(String(value)) ? 'text-destructive font-bold' : 'text-foreground font-bold')}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
          <button 
            onClick={() => window.location.replace('/login')}
            className="w-full py-3 border border-primary/20 hover:bg-primary/5 transition-colors font-bold mt-4"
          >
            Exit Diagnostic
          </button>
        </div>
      </div>
    );
  }

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
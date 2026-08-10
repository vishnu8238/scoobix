import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { insforge, INSFORGE_URL } from "@/lib/insforge";
import { popPortalIntent, getOAuthCallbackUrl, getApplePkce, clearApplePkce } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

const TIMEOUT_DURATION = 15000;

type StageStatus = "WAITING" | "PASS" | "FAIL" | "TIMEOUT";

interface DiagnosticState {
  callbackReached: StageStatus;
  appleCodeDetected: StageStatus;
  pkceDetected: StageStatus;
  exchangeStarted: StageStatus;
  exchangeRequestSent: StageStatus;
  exchangeResponseReceived: StageStatus;
  exchangeSuccessful: StageStatus;
  sessionSaved: StageStatus;
  currentUserLoaded: StageStatus;
  identityResolved: StageStatus;
  membershipResolved: StageStatus;
  portalNavigationStarted: StageStatus;
  
  httpStatus: string;
  safeError: string;
  exchangeAttempts: number;
  pkcePresent: boolean;
  pkceLengthValid: boolean;
  authRedirectUri: string;
  exchangeRedirectUri: string;
  redirectUriMatch: boolean;
  sessionCreated: boolean;
  currentUserPresent: boolean;
  portalIntent: string;
  firstTimeoutStage: string | null;
}

function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exchangeAttempted, setExchangeAttempted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [diag, setDiag] = useState<DiagnosticState>({
    callbackReached: "WAITING",
    appleCodeDetected: "WAITING",
    pkceDetected: "WAITING",
    exchangeStarted: "WAITING",
    exchangeRequestSent: "WAITING",
    exchangeResponseReceived: "WAITING",
    exchangeSuccessful: "WAITING",
    sessionSaved: "WAITING",
    currentUserLoaded: "WAITING",
    identityResolved: "WAITING",
    membershipResolved: "WAITING",
    portalNavigationStarted: "WAITING",
    
    httpStatus: "-",
    safeError: "-",
    exchangeAttempts: 0,
    pkcePresent: false,
    pkceLengthValid: false,
    authRedirectUri: "-",
    exchangeRedirectUri: "-",
    redirectUriMatch: false,
    sessionCreated: false,
    currentUserPresent: false,
    portalIntent: "-",
    firstTimeoutStage: null
  });

  const [urlMeta, setUrlMeta] = useState({
    origin: "-",
    pathname: "-",
    searchExists: false,
    paramNames: [] as string[],
    codeExists: false,
    insforgeCodeExists: false,
    errorExists: false,
    errorDescriptionExists: false,
  });

  const updateStage = (stage: keyof DiagnosticState, status: StageStatus) => {
    setDiag(prev => ({ ...prev, [stage]: status }));
  };

  const updateValue = (key: keyof DiagnosticState, value: any) => {
    setDiag(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const portal = popPortalIntent();
    const timestamp = () => new Date().toISOString();
    
    // Capture URL metadata for iPhone verification
    const search = new URLSearchParams(window.location.search);
    const params = Array.from(search.keys());
    
    setUrlMeta({
      origin: window.location.origin,
      pathname: window.location.pathname,
      searchExists: window.location.search.length > 0,
      paramNames: params,
      codeExists: search.has("code"),
      insforgeCodeExists: search.has("insforge_code"),
      errorExists: search.has("error"),
      errorDescriptionExists: search.has("error_description"),
    });

    console.log(`[APPLE_CALLBACK_START] ${timestamp()} - Portal Intent: ${portal}`);
    updateStage("callbackReached", "PASS");
    updateValue("portalIntent", portal || "none");
    
    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    // Global timeout tracker
    timeoutRef.current = setTimeout(() => {
      setDiag(prev => {
        const stages: (keyof DiagnosticState)[] = [
          "callbackReached", "appleCodeDetected", "pkceDetected", "exchangeStarted",
          "exchangeRequestSent", "exchangeResponseReceived", "exchangeSuccessful",
          "sessionSaved", "currentUserLoaded", "identityResolved", "membershipResolved",
          "portalNavigationStarted"
        ];
        
        let firstTimeout: string | null = prev.firstTimeoutStage;
        const newStages: any = {};
        
        for (const s of stages) {
          if (prev[s] === "WAITING") {
            newStages[s] = "TIMEOUT";
            if (!firstTimeout) firstTimeout = s;
          }
        }
        
        return { ...prev, ...newStages, firstTimeoutStage: firstTimeout };
      });
      console.error(`[APPLE_CALLBACK_TIMEOUT] ${timestamp()} - Diagnostic process timed out`);
    }, TIMEOUT_DURATION);

    const checkAuth = async () => {
      const search = new URLSearchParams(window.location.search);
      const code = search.get("code");
      const insforgeCode = search.get("insforge_code");

      // Check redirect URI matching immediately, even if no code is present
      const redirectUri = getOAuthCallbackUrl();
      const expectedRedirectUri = `${window.location.origin}/auth/callback`;
      updateValue("authRedirectUri", redirectUri);
      updateValue("exchangeRedirectUri", redirectUri);
      updateValue("redirectUriMatch", redirectUri === expectedRedirectUri);

      if (insforgeCode) {
        console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - SDK_AUTO_CALLBACK_DETECTED (insforge_code)`);
        updateStage("appleCodeDetected", "PASS");
      }

      if (code) {
        console.log(`[APPLE_CODE_DETECTED] ${timestamp()}`);
        updateStage("appleCodeDetected", "PASS");
        
        if (exchangeAttempted) {
          console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - EXCHANGE_ATTEMPTS: 2 (Blocked)`);
          updateValue("exchangeAttempts", 2);
          return;
        }
        setExchangeAttempted(true);
        updateValue("exchangeAttempts", 1);
        
        try {
          // Priority 1: sessionStorage (SDK default)
          // Priority 2: localStorage (Scoobix fallback for iOS)
          let pkceVerifier = sessionStorage.getItem("insforge_pkce_verifier");
          const persistentVerifier = getApplePkce();
          
          if (!pkceVerifier && persistentVerifier) {
            console.log(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - RESTORING_PKCE_FROM_LOCALSTORAGE`);
            pkceVerifier = persistentVerifier;
            // Also restore it back to sessionStorage for SDK compatibility if needed
            sessionStorage.setItem("insforge_pkce_verifier", persistentVerifier);
          }

          console.log(`[PKCE_DETECTED] ${timestamp()} - Present: ${!!pkceVerifier} (Persistent: ${!!persistentVerifier})`);
          updateValue("pkcePresent", !!pkceVerifier);
          updateValue("pkceLengthValid", !!pkceVerifier && pkceVerifier.length >= 43);
          
          if (!pkceVerifier) {
            updateStage("pkceDetected", "FAIL");
            updateValue("safeError", "Missing PKCE verifier");
            console.error(`[APPLE_EXCHANGE_DEBUG] ${timestamp()} - PKCE_VERIFIER_MISSING`);
            setErrorMsg("Authentication failed: Missing PKCE verifier.");
            return;
          }
          updateStage("pkceDetected", "PASS");

          const redirectUri = getOAuthCallbackUrl();
          
          updateStage("exchangeStarted", "PASS");
          updateStage("exchangeRequestSent", "PASS");
          
          console.log(`[EXCHANGE_START] ${timestamp()}`);
          
          const exchangeBody = {
            code,
            code_verifier: pkceVerifier,
            redirect_uri: redirectUri
          };
          
          const response = await fetch(`${INSFORGE_URL}/api/auth/oauth/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(exchangeBody)
          });

          updateValue("httpStatus", response.status.toString());
          updateStage("exchangeResponseReceived", "PASS");
          
          if (!response.ok) {
            updateStage("exchangeSuccessful", "FAIL");
            const errText = await response.text();
            let errData: any = {};
            try { errData = JSON.parse(errText); } catch(e) {}
            updateValue("safeError", `HTTP ${response.status}: ${errData.message || errText || 'Unknown'}`);
            console.error(`[EXCHANGE_FAILURE] ${timestamp()} - Status: ${response.status} - Error:`, errData || errText);
            setErrorMsg(`Login failed (HTTP ${response.status}): ${errData.message || errText || 'Unknown error'}`);
            return;
          }

          const sessionData = await response.json();
          updateStage("exchangeSuccessful", "PASS");
          
          const normalizedSession = {
            ...sessionData,
            accessToken: sessionData.access_token || sessionData.accessToken,
            refreshToken: sessionData.refresh_token || sessionData.refreshToken,
            user: sessionData.user
          };
          
          let saveSuccess = false;
          // @ts-ignore
          if (insforge.auth && typeof (insforge.auth as any).saveSessionFromResponse === 'function') {
             (insforge.auth as any).saveSessionFromResponse(normalizedSession);
             saveSuccess = true;
          }

          updateValue("sessionCreated", saveSuccess);
          if (saveSuccess) {
            updateStage("sessionSaved", "PASS");
          } else {
            updateStage("sessionSaved", "FAIL");
            updateValue("safeError", "saveSessionFromResponse method failed");
            setErrorMsg("Internal error: Could not save session.");
            return;
          }

          // Clear persistent PKCE after successful exchange
          clearApplePkce();

          // Clean the URL code param
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (err: any) {
          updateStage("exchangeSuccessful", "FAIL");
          updateValue("safeError", `Crash: ${err.message || "Unknown"}`);
          console.error(`[EXCHANGE_CRASH] ${timestamp()} - Error:`, err.message || err);
          setErrorMsg("An unexpected error occurred during login.");
          return;
        }
      }

      try {
        updateStage("currentUserLoaded", "WAITING");
        const { data, error: authError } = await insforge.auth.getCurrentUser();
        updateValue("currentUserPresent", !!data?.user);
        
        if (authError) {
          updateStage("currentUserLoaded", "FAIL");
          updateValue("safeError", authError.message || "User load error");
          console.error(`[APPLE_EXCHANGE_DEBUG] GET_CURRENT_USER_FAILURE:`, authError.message || authError);
        } else if (data?.user) {
          updateStage("currentUserLoaded", "PASS");
          updateStage("identityResolved", "PASS");
          updateStage("membershipResolved", "PASS"); // We assume it's moving
          
          // Identity resolution is active, trigger navigation
          const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
          updateStage("portalNavigationStarted", "PASS");
          console.log(`[PORTAL_NAVIGATION_START] ${timestamp()} - Destination: ${dest}`);
          
          // We wait a bit before final navigation to allow the user to see the diagnostic if it's super fast,
          // but for the hang issue we want to see it stay.
          setTimeout(() => {
            window.location.assign(dest);
          }, 2000);
        } else if (code || insforgeCode) {
           updateStage("currentUserLoaded", "FAIL");
           updateValue("safeError", "Session saved but getCurrentUser returned null");
        }
      } catch (err: any) {
        updateStage("identityResolved", "FAIL");
        updateValue("safeError", `Identity Crash: ${err.message || "Unknown"}`);
        console.error(`[APPLE_EXCHANGE_DEBUG] IDENTITY_RESOLUTION_CRASH:`, err.message || err);
      }
    };

    checkAuth();

    return () => {
      cleanup();
    };
  }, [exchangeAttempted]);

  const StageRow = ({ label, status }: { label: string, status: StageStatus }) => (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-bold ${
        status === "PASS" ? "text-green-500" : 
        status === "FAIL" ? "text-red-500" : 
        status === "TIMEOUT" ? "text-orange-500" : 
        "text-muted-foreground/50"
      }`}>
        {status}
      </span>
    </div>
  );

  const ValueRow = ({ label, value }: { label: string, value: any }) => (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{label}</span>
      <span className="text-[10px] font-mono max-w-[180px] truncate">
        {value === true ? "YES" : value === false ? "NO" : value || "-"}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-svh flex-col items-center bg-background p-4 overflow-auto">
      <div className="w-full max-w-md space-y-4 pt-8">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
          <h2 className="font-display text-lg font-bold">Finishing login...</h2>
          <p className="text-xs text-muted-foreground">Do not close this window.</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive font-medium">{errorMsg}</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-muted/50 border-b border-border">
            <h3 className="text-sm font-bold">Apple Login Diagnostics</h3>
          </div>
          
          <div className="p-4 space-y-1">
            <StageRow label="Callback reached" status={diag.callbackReached} />
            <StageRow label="Apple code detected" status={diag.appleCodeDetected} />
            <StageRow label="PKCE verifier detected" status={diag.pkceDetected} />
            <StageRow label="Exchange started" status={diag.exchangeStarted} />
            <StageRow label="Exchange request sent" status={diag.exchangeRequestSent} />
            <StageRow label="Exchange response received" status={diag.exchangeResponseReceived} />
            <StageRow label="Exchange successful" status={diag.exchangeSuccessful} />
            <StageRow label="Session saved" status={diag.sessionSaved} />
            <StageRow label="Current user loaded" status={diag.currentUserLoaded} />
            <StageRow label="Identity resolved" status={diag.identityResolved} />
            <StageRow label="Membership resolved" status={diag.membershipResolved} />
            <StageRow label="Portal navigation started" status={diag.portalNavigationStarted} />
          </div>

          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <div className="space-y-0.5">
              <ValueRow label="Exchange HTTP Status" value={diag.httpStatus} />
              <ValueRow label="Safe Error" value={diag.safeError} />
              <ValueRow label="Exchange Attempts" value={diag.exchangeAttempts} />
              <ValueRow label="PKCE Present" value={diag.pkcePresent} />
              <ValueRow label="PKCE Length Valid" value={diag.pkceLengthValid} />
              <ValueRow label="Authorization Redirect URI" value={diag.authRedirectUri} />
              <ValueRow label="Exchange Redirect URI" value={diag.exchangeRedirectUri} />
              <ValueRow label="Redirect URI Exact Match" value={diag.redirectUriMatch} />
              <ValueRow label="Session Created" value={diag.sessionCreated} />
              <ValueRow label="Current User Present" value={diag.currentUserPresent} />
              <ValueRow label="Portal Intent" value={diag.portalIntent} />
              {diag.firstTimeoutStage && (
                <div className="mt-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
                  <span className="text-[10px] font-bold text-orange-500 uppercase">First Timeout Stage</span>
                  <p className="text-[10px] font-mono text-orange-500">{diag.firstTimeoutStage}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="px-4 py-3 bg-muted/50 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">URL Forensic Metadata</h3>
            <div className="space-y-0.5">
              <ValueRow label="Actual Origin" value={urlMeta.origin} />
              <ValueRow label="Actual Path" value={urlMeta.pathname} />
              <ValueRow label="Search Exists" value={urlMeta.searchExists} />
              <ValueRow label="Param Names" value={urlMeta.paramNames.join(", ")} />
              <ValueRow label="Code Param Exists" value={urlMeta.codeExists} />
              <ValueRow label="InsForge Code Exists" value={urlMeta.insforgeCodeExists} />
              <ValueRow label="Error Param Exists" value={urlMeta.errorExists} />
              <ValueRow label="Error Desc Exists" value={urlMeta.errorDescriptionExists} />
            </div>
          </div>
        </div>
        
        <div className="text-center pb-8">
           <button 
             onClick={() => window.location.assign("/")}
             className="text-xs text-muted-foreground underline"
           >
             Cancel and return home
           </button>
        </div>
      </div>
    </div>
  );
}
